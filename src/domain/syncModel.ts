import type {
  AppState,
  SyncEntity,
  SyncEntityType,
  SyncOperation,
  SyncState,
  PersistedAppState,
} from './types';
import { validProfileAvatar } from './profileAvatar.mjs';
import { migrateState } from './engineCore.mjs';

export type SyncClock = { now: () => Date; id: () => string };
export const defaultSyncClock: SyncClock = {
  now: () => new Date(),
  id: () => {
    if (!globalThis.crypto?.randomUUID)
      throw new Error('本机安全编号服务不可用');
    return globalThis.crypto.randomUUID();
  },
};
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
function fail(): never {
  throw new Error('同步数据格式无效，请保留原始数据后重试');
}
const idValid = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{7,79}$/.test(value);
const timeValid = (value: unknown): value is string =>
  typeof value === 'string' &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString() === value;
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const exactFields = (value: object, fields: string[]) => {
  const keys = Object.keys(value);
  return (
    keys.length === fields.length && keys.every((key) => fields.includes(key))
  );
};
const types: SyncEntityType[] = [
  'tasks',
  'checkins',
  'tickets',
  'redemptions',
  'goals',
  'goalEntries',
  'settings',
  'profile',
  'gifts',
  'receipts',
];
const keyOf = (type: SyncEntityType, id: string) => `${type}:${id}`;
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (object(value))
    return `{${Object.keys(value)
      .sort()
      .filter((key) => value[key] !== undefined)
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(',')}}`;
  return JSON.stringify(value);
}
// 操作快照只引用附件编号；业务资料保留渲染数据，附件表单独供上传。
function profilePayload(state: AppState, sync: SyncState, clock?: SyncClock) {
  const profile = state.giftState?.profile;
  if (!profile) return { id: sync.accountId, name: null, avatar: null };
  if (profile.id !== sync.accountId) fail();
  if (profile.avatar?.kind !== 'image') return { ...profile };
  const data = profile.avatar.dataUri;
  let attachmentId = Object.keys(sync.attachments).find(
    (id) => sync.attachments[id] === data,
  );
  if (!attachmentId) {
    if (!clock) fail();
    attachmentId = clock.id();
    if (!idValid(attachmentId) || sync.attachments[attachmentId]) fail();
    sync.attachments[attachmentId] = data;
  }
  return {
    id: profile.id,
    name: profile.name,
    avatar: { kind: 'attachment', attachmentId },
  };
}
function project(state: AppState, sync: SyncState, clock?: SyncClock) {
  const result = new Map<
    string,
    { type: SyncEntityType; id: string; payload: string; deleted: boolean }
  >();
  function add(
    type: SyncEntityType,
    id: string,
    data: unknown,
    deleted = false,
  ) {
    const key = keyOf(type, id);
    if (result.has(key)) fail();
    result.set(key, { type, id, payload: canonical(data), deleted });
  }
  for (const item of state.tasks)
    add('tasks', item.id, item, !!item.deleted);
  for (const type of ['checkins', 'tickets', 'redemptions'] as const)
    for (const item of state[type]) add(type, item.id, item);
  for (const goal of [state.weight, ...state.milestoneGoals]) {
    const { entries, ...details } = goal;
    add('goals', goal.id, details, !!goal.deleted);
    for (const entry of entries)
      add(
        'goalEntries',
        `${goal.id}/${entry.id}`,
        { ...entry, goalId: goal.id },
        !!goal.deleted,
      );
  }
  add('settings', sync.accountId, state.settings);
  add('profile', sync.accountId, profilePayload(state, sync, clock));
  for (const gift of state.giftState?.outgoing ?? [])
    add('gifts', gift.giftId, gift);
  for (const receipt of state.giftState?.received ?? [])
    add('receipts', `received/${receipt.giftId}`, receipt);
  for (const receipt of state.giftState?.receipts ?? [])
    add('receipts', `recorded/${receipt.giftId}`, receipt);
  return result;
}
export function initializeSync(
  state: AppState,
  clock: SyncClock = defaultSyncClock,
): PersistedAppState {
  if (state.sync) {
    validateSync(state);
    return state;
  }
  if (state.storageVersion !== undefined) fail();
  const next = copy(state);
  const accountId = next.giftState?.profile.id ?? clock.id(),
    deviceId = clock.id();
  if (!idValid(accountId) || !idValid(deviceId) || accountId === deviceId)
    fail();
  next.sync = {
    schemaVersion: 1,
    dataVersion: 4,
    accountId,
    deviceId,
    entities: {},
    outbox: [],
    attachments: {},
    sequence: 0,
    acknowledged: {},
  };
  next.storageVersion = 1;
  return commitSync(undefined, next, clock);
}
// 所有业务变更在持久化前经过这里；一组兑换/发券/撤销只能整体上传。
export function commitSync(
  previous: AppState | undefined,
  draft: AppState,
  clock: SyncClock = defaultSyncClock,
): PersistedAppState {
  if (!draft.sync) fail();
  if (previous) {
    validateSync(previous);
    if (
      draft.storageVersion !== previous.storageVersion ||
      canonical(previous.sync) !== canonical(draft.sync)
    )
      fail();
  }
  const next = copy(draft),
    sync = next.sync!;
  const current = project(next, sync, clock);
  const clockTime = clock.now().toISOString();
  const now = Object.values(sync.entities).reduce(
    (latest, entity) => (entity.updatedAt > latest ? entity.updatedAt : latest),
    clockTime,
  );
  const changes: SyncOperation[] = [];
  let transactionId = '';
  const usedIds = new Set(
    sync.outbox.flatMap((op) => [op.operationId, op.transactionId]),
  );
  function uniqueId() {
    if (!Number.isSafeInteger(sync.sequence + 1)) fail();
    const id = `${sync.deviceId.slice(0, 50)}-${++sync.sequence}`;
    if (!idValid(id) || usedIds.has(id)) fail();
    usedIds.add(id);
    return id;
  }
  const keys = new Set([...Object.keys(sync.entities), ...current.keys()]);
  for (const key of keys) {
    const old = sync.entities[key],
      value = current.get(key);
    const deleted = value?.deleted ?? true;
    if (
      old &&
      value &&
      old.payload === value.payload &&
      !!old.deletedAt === deleted
    )
      continue;
    if (old && !value && old.deletedAt) continue;
    if (old?.deletedAt && !deleted)
      throw new Error('已删除实体不能复活，请创建新编号');
    const entity: SyncEntity = {
      entityType: value?.type ?? old.entityType,
      entityId: value?.id ?? old.entityId,
      ownerId: sync.accountId,
      revision: (old?.revision ?? 0) + 1,
      createdAt: old?.createdAt ?? now,
      updatedAt: now,
      deletedAt: deleted ? (old?.deletedAt ?? now) : null,
      payload: value?.payload ?? old.payload,
    };
    sync.entities[key] = entity;
    transactionId ||= uniqueId();
    changes.push({
      operationId: uniqueId(),
      transactionId,
      deviceId: sync.deviceId,
      accountId: sync.accountId,
      baseRevision: old?.revision ?? 0,
      entityRevision: entity.revision,
      entity: copy(entity),
    });
  }
  sync.outbox.push(...changes);
  validateSync(next);
  return next;
}
export function validateSync(
  state: AppState,
): asserts state is PersistedAppState {
  if (state.version !== 4) fail();
  const stateFields = [
    'version',
    'tasks',
    'checkins',
    'tickets',
    'redemptions',
    'weight',
    'milestoneGoals',
    'settings',
    'giftState',
    'storageVersion',
    'sync',
  ];
  if (Object.keys(state).some((key) => !stateFields.includes(key))) fail();
  migrateState(state);
  const sync = state.sync;
  if (
    state.storageVersion !== 1 ||
    !sync ||
    sync.schemaVersion !== 1 ||
    sync.dataVersion !== 4 ||
    !idValid(sync.accountId) ||
    !idValid(sync.deviceId) ||
    sync.accountId === sync.deviceId ||
    !object(sync.entities) ||
    !object(sync.attachments) ||
    !Array.isArray(sync.outbox) ||
    !Number.isSafeInteger(sync.sequence) ||
    sync.sequence < 0 ||
    !object(sync.acknowledged)
  )
    fail();
  if (
    !exactFields(sync, [
      'schemaVersion',
      'dataVersion',
      'accountId',
      'deviceId',
      'entities',
      'outbox',
      'attachments',
      'sequence',
      'acknowledged',
    ])
  )
    fail();
  for (const [id, data] of Object.entries(sync.attachments))
    if (!idValid(id) || !validProfileAvatar({ kind: 'image', dataUri: data }))
      fail();
  const validateEntity = (entity: SyncEntity) => {
    if (
      !object(entity) ||
      !exactFields(entity, [
        'entityType',
        'entityId',
        'ownerId',
        'revision',
        'createdAt',
        'updatedAt',
        'deletedAt',
        'payload',
      ]) ||
      !types.includes(entity.entityType) ||
      typeof entity.entityId !== 'string' ||
      !entity.entityId.length ||
      entity.ownerId !== sync.accountId ||
      !Number.isSafeInteger(entity.revision) ||
      entity.revision < 1 ||
      !timeValid(entity.createdAt) ||
      !timeValid(entity.updatedAt) ||
      entity.updatedAt < entity.createdAt ||
      !(
        entity.deletedAt === null ||
        (timeValid(entity.deletedAt) &&
          entity.deletedAt >= entity.createdAt &&
          entity.deletedAt <= entity.updatedAt)
      ) ||
      typeof entity.payload !== 'string'
    )
      fail();
    let payload: unknown;
    try {
      payload = JSON.parse(entity.payload);
    } catch {
      fail();
    }
    if (
      !object(payload) ||
      canonical(payload) !== entity.payload ||
      ('avatar' in payload && entity.entityType !== 'profile')
    )
      fail();
    const hasText = (key: string) =>
      typeof payload[key] === 'string' && (payload[key] as string).length > 0;
    const hasNumber = (key: string) =>
      typeof payload[key] === 'number' && Number.isFinite(payload[key]);
    const idTypes: SyncEntityType[] = [
      'tasks',
      'checkins',
      'tickets',
      'redemptions',
      'goals',
    ];
    if (idTypes.includes(entity.entityType) && payload.id !== entity.entityId)
      fail();
    switch (entity.entityType) {
      case 'tasks':
        if (
          !hasText('name') ||
          !hasText('icon') ||
          !hasText('color') ||
          !Number.isInteger(payload.target) ||
          Number(payload.target) < 1 ||
          typeof payload.archived !== 'boolean' ||
          (payload.deleted !== undefined && typeof payload.deleted !== 'boolean')
        )
          fail();
        break;
      case 'checkins':
        if (
          !hasText('taskId') ||
          !hasText('date') ||
          !hasText('week') ||
          !timeValid(payload.createdAt)
        )
          fail();
        break;
      case 'tickets':
        if (
          !hasText('name') ||
          !hasText('week') ||
          !timeValid(payload.createdAt) ||
          !(payload.expiresAt === null || timeValid(payload.expiresAt)) ||
          !(payload.usedAt === null || timeValid(payload.usedAt))
        )
          fail();
        break;
      case 'redemptions':
        if (
          !hasText('ticketId') ||
          !hasText('week') ||
          !Number.isInteger(payload.cost) ||
          Number(payload.cost) < 1
        )
          fail();
        break;
      case 'goals':
        if (
          !hasText('name') ||
          !hasText('unit') ||
          !['increase', 'decrease'].includes(String(payload.direction)) ||
          !hasNumber('step') ||
          Number(payload.step) <= 0 ||
          typeof payload.enabled !== 'boolean' ||
          !Array.isArray(payload.unlockedMilestones)
        )
          fail();
        break;
      case 'goalEntries':
        if (
          !hasText('goalId') ||
          !hasText('id') ||
          entity.entityId !== `${payload.goalId}/${payload.id}` ||
          !hasNumber('weight') ||
          !timeValid(payload.createdAt) ||
          !hasText('date')
        )
          fail();
        break;
      case 'settings':
        if (
          entity.entityId !== sync.accountId ||
          !Number.isInteger(payload.threshold) ||
          Number(payload.threshold) < 1 ||
          !hasText('rewardName') ||
          typeof payload.expiryEnabled !== 'boolean' ||
          !Number.isInteger(payload.expiryDay) ||
          !hasText('expiryTime')
        )
          fail();
        break;
      case 'gifts':
        if (
          payload.kind !== 'small-steps-gift' ||
          payload.giftId !== entity.entityId ||
          !object(payload.issuer) ||
          payload.issuer.id !== sync.accountId ||
          !hasText('name') ||
          !timeValid(payload.issuedAt)
        )
          fail();
        break;
      case 'receipts':
        if (
          payload.kind !== 'small-steps-gift-receipt' ||
          !object(payload.recipient) ||
          !object(payload.gift) ||
          !timeValid(payload.receivedAt) ||
          ![
            `received/${payload.giftId}`,
            `recorded/${payload.giftId}`,
          ].includes(entity.entityId)
        )
          fail();
        break;
    }
    function rejectEmbeddedImages(value: unknown): void {
      if (Array.isArray(value)) {
        value.forEach(rejectEmbeddedImages);
        return;
      }
      if (!object(value)) return;
      for (const [key, child] of Object.entries(value)) {
        if (
          key === 'dataUri' ||
          (key === 'avatar' && entity.entityType !== 'profile')
        )
          fail();
        rejectEmbeddedImages(child);
      }
    }
    rejectEmbeddedImages(payload);
    if (
      entity.entityType === 'profile' &&
      (payload.id !== sync.accountId ||
        (payload.name !== null &&
          (!hasText('name') || String(payload.name).length > 20)) ||
        (payload.avatar !== undefined &&
          payload.avatar !== null &&
          (!object(payload.avatar) ||
            (payload.avatar.kind !== 'attachment' &&
              !validProfileAvatar(payload.avatar)))))
    )
      fail();
    if (
      entity.entityType === 'profile' &&
      object(payload.avatar) &&
      payload.avatar.kind === 'attachment' &&
      (typeof payload.avatar.attachmentId !== 'string' ||
        !sync.attachments[payload.avatar.attachmentId])
    )
      fail();
  };
  const current = project(state, sync);
  for (const [key, entity] of Object.entries(sync.entities)) {
    validateEntity(entity);
    if (key !== keyOf(entity.entityType, entity.entityId)) fail();
    const value = current.get(key);
    if (
      value
        ? value.payload !== entity.payload ||
          value.deleted !== !!entity.deletedAt
        : !entity.deletedAt
    )
      fail();
  }
  for (const key of current.keys()) if (!sync.entities[key]) fail();
  const operationIds = new Set<string>();
  const entityVersions = new Set<string>();
  const transactionIds = new Set<string>();
  const sequences = new Set<number>();
  function sequenceOf(id: string) {
    const prefix = `${sync!.deviceId.slice(0, 50)}-`;
    if (!id.startsWith(prefix)) fail();
    const raw = id.slice(prefix.length),
      number = Number(raw);
    if (
      !/^[1-9][0-9]*$/.test(raw) ||
      !Number.isSafeInteger(number) ||
      number > sync!.sequence
    )
      fail();
    return number;
  }
  const operationCounts = new Map<string, number>();
  const journal: SyncOperation[] = [];
  function validateOperation(operation: SyncOperation) {
    if (
      !object(operation) ||
      !exactFields(operation, [
        'operationId',
        'transactionId',
        'deviceId',
        'accountId',
        'baseRevision',
        'entityRevision',
        'entity',
      ]) ||
      !idValid(operation.operationId) ||
      !idValid(operation.transactionId) ||
      operationIds.has(operation.operationId) ||
      operation.accountId !== sync!.accountId ||
      operation.deviceId !== sync!.deviceId ||
      !Number.isSafeInteger(operation.baseRevision) ||
      operation.baseRevision < 0 ||
      operation.entityRevision !== operation.baseRevision + 1 ||
      operation.entityRevision !== operation.entity?.revision
    )
      fail();
    const operationSequence = sequenceOf(operation.operationId),
      transactionSequence = sequenceOf(operation.transactionId);
    if (
      operationSequence <= transactionSequence ||
      sequences.has(operationSequence)
    )
      fail();
    sequences.add(operationSequence);
    validateEntity(operation.entity);
    const key = keyOf(operation.entity.entityType, operation.entity.entityId),
      entity = sync!.entities[key];
    const version = `${key}/${operation.entityRevision}`;
    if (
      !entity ||
      entity.revision < operation.entityRevision ||
      entityVersions.has(version) ||
      entity.createdAt !== operation.entity.createdAt ||
      operation.entity.updatedAt > entity.updatedAt ||
      (entity.revision === operation.entityRevision &&
        canonical(entity) !== canonical(operation.entity))
    )
      fail();
    operationIds.add(operation.operationId);
    journal.push(operation);
    entityVersions.add(version);
    operationCounts.set(key, (operationCounts.get(key) ?? 0) + 1);
  }
  let lastTransaction = '';
  let previousPendingSequence = 0;
  for (const operation of sync.outbox) {
    if (sequenceOf(operation.operationId) <= previousPendingSequence) fail();
    previousPendingSequence = sequenceOf(operation.operationId);
    validateOperation(operation);
    if (lastTransaction !== operation.transactionId) {
      if (transactionIds.has(operation.transactionId)) fail();
      transactionIds.add(operation.transactionId);
      lastTransaction = operation.transactionId;
    }
  }
  for (const [id, signature] of Object.entries(sync.acknowledged)) {
    if (!idValid(id) || typeof signature !== 'string') fail();
    let ops: unknown;
    try {
      ops = JSON.parse(signature);
    } catch {
      fail();
    }
    if (!Array.isArray(ops) || !ops.length || canonical(ops) !== signature)
      fail();
    for (const op of ops) {
      if (op.transactionId !== id) fail();
      validateOperation(op);
    }
    if (transactionIds.has(id)) fail();
    transactionIds.add(id);
  }
  for (const id of transactionIds) {
    const number = sequenceOf(id);
    if (sequences.has(number)) fail();
    sequences.add(number);
  }
  if (sequences.size !== sync.sequence) fail();
  const acknowledgedOperations = journal.filter(
    (operation) => !!sync.acknowledged[operation.transactionId],
  );
  const lastAcknowledgedSequence = acknowledgedOperations.reduce(
    (maximum, operation) =>
      Math.max(maximum, sequenceOf(operation.operationId)),
    0,
  );
  if (
    sync.outbox.length &&
    sequenceOf(sync.outbox[0].transactionId) <= lastAcknowledgedSequence
  )
    fail();
  const ordered = journal.sort(
    (left, right) =>
      sequenceOf(left.operationId) - sequenceOf(right.operationId),
  );
  const heads = new Map<string, SyncEntity>();
  let lastTransactionSequence = 0;
  for (const operation of ordered) {
    const transactionSequence = sequenceOf(operation.transactionId);
    if (transactionSequence < lastTransactionSequence) fail();
    lastTransactionSequence = transactionSequence;
    const key = keyOf(operation.entity.entityType, operation.entity.entityId),
      previous = heads.get(key);
    if (
      operation.baseRevision !== (previous?.revision ?? 0) ||
      (previous &&
        (operation.entity.updatedAt < previous.updatedAt ||
          (!!previous.deletedAt &&
            operation.entity.deletedAt !== previous.deletedAt)))
    )
      fail();
    heads.set(key, operation.entity);
  }
  for (const [key, entity] of Object.entries(sync.entities))
    if (operationCounts.get(key) !== entity.revision) fail();
}
export interface SyncBatch {
  accountId: string;
  deviceId: string;
  transactions: { transactionId: string; operations: SyncOperation[] }[];
  attachments: Record<string, string>;
}
export function getSyncBatch(
  state: AppState,
  accountId: string,
  maxTransactions = 20,
): SyncBatch {
  validateSync(state);
  const sync = state.sync!;
  if (
    accountId !== sync.accountId ||
    !Number.isSafeInteger(maxTransactions) ||
    maxTransactions < 1 ||
    maxTransactions > 1000
  )
    fail();
  const transactions: SyncBatch['transactions'] = [];
  for (const op of sync.outbox) {
    let tx = transactions.at(-1);
    if (tx?.transactionId !== op.transactionId) {
      if (transactions.length === maxTransactions) break;
      tx = { transactionId: op.transactionId, operations: [] };
      transactions.push(tx);
    }
    tx!.operations.push(copy(op));
  }
  const attachments: Record<string, string> = {};
  for (const tx of transactions)
    for (const op of tx.operations) {
      const payload = JSON.parse(op.entity.payload);
      const id =
        payload.avatar?.kind === 'attachment'
          ? payload.avatar.attachmentId
          : undefined;
      if (id) attachments[id] = sync.attachments[id];
    }
  return { accountId, deviceId: sync.deviceId, transactions, attachments };
}
export function acknowledgeSync(
  state: AppState,
  batch: SyncBatch,
): PersistedAppState {
  validateSync(state);
  const sync = state.sync!;
  if (
    !object(batch) ||
    batch.accountId !== sync.accountId ||
    batch.deviceId !== sync.deviceId ||
    !Array.isArray(batch.transactions) ||
    !batch.transactions.length
  )
    fail();
  const ids = new Set<string>(),
    transactions = new Set<string>();
  const pendingTransactions = [
    ...new Set(sync.outbox.map((operation) => operation.transactionId)),
  ];
  let pendingIndex = 0;
  for (const tx of batch.transactions) {
    if (
      !object(tx) ||
      !Array.isArray(tx.operations) ||
      !tx.operations.length ||
      transactions.has(tx.transactionId)
    )
      fail();
    const pending = sync.outbox.filter(
      (op) => op.transactionId === tx.transactionId,
    );
    if (!pending.length) {
      if (sync.acknowledged[tx.transactionId] !== canonical(tx.operations))
        fail();
    } else {
      if (
        pendingTransactions[pendingIndex++] !== tx.transactionId ||
        canonical(pending) !== canonical(tx.operations)
      )
        fail();
    }
    transactions.add(tx.transactionId);
    for (const op of pending) ids.add(op.operationId);
  }
  const next = copy(state);
  for (const tx of batch.transactions)
    next.sync!.acknowledged[tx.transactionId] = canonical(tx.operations);
  next.sync!.outbox = next.sync!.outbox.filter(
    (op) => !ids.has(op.operationId),
  );
  validateSync(next);
  return next;
}
