import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialState,
  checkIn,
  undoCheckIn,
  redeemTicket,
  configureMilestoneGoal,
  recordWeight,
  deleteMilestoneGoal,
  updateSettings,
  ensureGiftProfile,
  createGift,
  receiveGift,
  recordGiftReceipt,
  migrateState,
} from '../src/domain/engine';
import {
  initializeSync,
  commitSync,
  validateSync,
  getSyncBatch,
  acknowledgeSync,
  type SyncClock,
} from '../src/domain/syncModel';
import { createAppStore } from '../src/state/store';
import {
  createWebRepository,
  WEB_STORAGE_KEY,
} from '../src/state/webRepository';
import type {
  AppState,
  PersistedAppState,
  SyncEntityType,
} from '../src/domain/types';

const NOW = new Date('2026-10-20T12:00:00.000Z');
const clone = <T>(value: T): T => structuredClone(value);
function clock() {
  let sequence = 0;
  return { now: () => NOW, id: () => `secure-id-${++sequence}` };
}
function initial() {
  return initializeSync(createInitialState(NOW), clock());
}
function change(
  state: PersistedAppState,
  mutation: (draft: AppState) => unknown,
  provider: SyncClock = clock(),
) {
  const draft = clone(state);
  mutation(draft);
  return commitSync(state, migrateState(draft), provider);
}
function flush(state: PersistedAppState) {
  return acknowledgeSync(
    state,
    getSyncBatch(state, state.sync.accountId, 1000),
  );
}

test('首次无昵称也建立稳定owner/device、完整初始索引与初始事务，重载不重复排队', async () => {
  let saved: PersistedAppState | null = null;
  const repo = {
    load: async () => clone(saved),
    save: async (state: PersistedAppState) => {
      saved = clone(state);
    },
  };
  const store = createAppStore(repo, clock());
  await store.initialize();
  const state = store.getSnapshot().state!;
  assert.ok(state);
  assert.notEqual(state.sync.accountId, state.sync.deviceId);
  assert.equal(state.giftState, undefined);
  assert.equal(state.storageVersion, 1);
  assert.equal(state.sync.dataVersion, 4);
  assert.equal(Object.keys(state.sync.entities).length, 7);
  assert.equal(
    new Set(state.sync.outbox.map((op) => op.transactionId)).size,
    1,
  );
  assert.equal(
    state.sync.entities[`profile:${state.sync.accountId}`].ownerId,
    state.sync.accountId,
  );
  const reloaded = createAppStore(repo, clock());
  await reloaded.initialize();
  assert.deepEqual(reloaded.getSnapshot().state, state);
  const own = state.sync.accountId;
  assert.equal(
    (
      await reloaded.run((draft) =>
        ensureGiftProfile(draft, { id: 'different-12345', name: '错误' }),
      )
    ).ok,
    false,
  );
  assert.equal(
    (
      await reloaded.run((draft) =>
        ensureGiftProfile(draft, { id: own, name: '小林' }),
      )
    ).ok,
    true,
  );
  assert.equal(reloaded.getSnapshot().state!.giftState!.profile.id, own);
});

test('兑换、里程碑与赠收回执覆盖全部实体类型，同一业务组共享transaction且不可变快照', () => {
  let state = initial();
  const owner = state.sync.accountId;
  state = change(state, (draft) => {
    ensureGiftProfile(draft, { id: owner, name: '本机' });
    for (let i = 0; i < 3; i++) checkIn(draft, 'task-1', NOW);
    redeemTicket(draft, NOW);
    configureMilestoneGoal(draft, {
      name: '体重',
      unit: '斤',
      direction: 'decrease',
      step: 1,
      startWeight: 10,
    });
    recordWeight(draft, 9, NOW);
    createGift(
      draft,
      { name: '奶茶', validity: 'permanent' },
      { giftId: 'outgoing-123', ticketId: 'outticket-123' },
      NOW,
    );
  });
  const latest = state.sync.outbox.filter(
    (op) => op.transactionId === state.sync.outbox.at(-1)!.transactionId,
  );
  assert.ok(latest.some((op) => op.entity.entityType === 'redemptions'));
  assert.ok(latest.some((op) => op.entity.entityType === 'tickets'));
  const friend = createInitialState(NOW);
  ensureGiftProfile(friend, { id: 'friend-12345', name: '朋友' });
  const gift = createGift(
    friend,
    { name: '休息券', validity: 'permanent' },
    { giftId: 'incoming-123', ticketId: 'inticket-123' },
    NOW,
  ).gift!;
  state = change(state, (draft) => receiveGift(draft, gift, NOW));
  const ownGift = state.giftState!.outgoing[0];
  const receipt = receiveGift(friend, ownGift, NOW).receipt!;
  state = change(state, (draft) => recordGiftReceipt(draft, receipt, NOW));
  const types = new Set(
    Object.values(state.sync.entities).map((entity) => entity.entityType),
  );
  for (const type of [
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
  ] as SyncEntityType[])
    assert.ok(types.has(type), type);
  const before = clone(latest);
  state = change(state, (draft) => updateSettings(draft, { threshold: 4 }));
  assert.deepEqual(
    state.sync.outbox.filter(
      (op) => op.transactionId === before[0].transactionId,
    ),
    before,
  );
  validateSync(state);
});

test('no-op不刷版本或队列，撤销打卡保tombstone，删除目标和嵌套记录都留删除标记且拒绝复活', () => {
  let state = initial();
  assert.deepEqual(
    change(state, () => {}),
    state,
  );
  state = change(state, (draft) => checkIn(draft, 'task-1', NOW));
  const id = state.checkins[0].id;
  state = change(state, (draft) => undoCheckIn(draft, 'task-1', NOW));
  const tombstone = state.sync.entities[`checkins:${id}`];
  assert.equal(state.checkins.length, 0);
  assert.ok(tombstone.deletedAt);
  assert.equal(tombstone.revision, 2);
  assert.ok(JSON.parse(tombstone.payload).taskId);
  assert.throws(
    () =>
      change(state, (draft) => {
        draft.checkins.push(JSON.parse(tombstone.payload));
      }),
    /不能复活/,
  );
  state = change(state, (draft) => {
    configureMilestoneGoal(draft, {
      name: '体重',
      unit: '斤',
      direction: 'decrease',
      step: 1,
      startWeight: 10,
    });
    recordWeight(draft, 9, NOW);
  });
  state = change(state, (draft) => deleteMilestoneGoal(draft, draft.weight.id));
  assert.ok(state.sync.entities[`goals:${state.weight.id}`].deletedAt);
  for (const entity of Object.values(state.sync.entities).filter(
    (item) => item.entityType === 'goalEntries',
  ))
    assert.ok(entity.deletedAt);
});

test('ACK精确整组连续前缀，幂等重放不吞同实体新revision，乱序/跨账户/伪造/部分均拒', () => {
  let state = initial();
  const first = getSyncBatch(state, state.sync.accountId);
  state = change(state, (draft) => updateSettings(draft, { threshold: 5 }));
  const later = clone(getSyncBatch(state, state.sync.accountId));
  later.transactions = later.transactions.slice(1);
  assert.throws(() => acknowledgeSync(state, later));
  const partial = clone(first);
  partial.transactions[0].operations.pop();
  assert.throws(() => acknowledgeSync(state, partial));
  const wrongOwner = { ...first, accountId: 'other-123456' };
  assert.throws(() => acknowledgeSync(state, wrongOwner));
  const altered = clone(first);
  altered.transactions[0].operations[0].baseRevision++;
  assert.throws(() => acknowledgeSync(state, altered));
  state = acknowledgeSync(state, first);
  assert.equal(state.sync.outbox.length, 1);
  const before = clone(state);
  assert.deepEqual(acknowledgeSync(state, first), before);
  const oldLastId = state.sync.outbox[0].operationId;
  state = flush(state);
  state = change(state, (draft) => updateSettings(draft, { threshold: 6 }));
  assert.notEqual(state.sync.outbox[0].operationId, oldLastId);
  assert.equal(state.sync.outbox[0].baseRevision, 2);
  assert.throws(() => getSyncBatch(state, 'other-123456'));
});

test('同步字段篡改、丢meta、丢末尾op、丢ACK链、序号回退、损坏payload严格拒绝', () => {
  const state = initial();
  for (const mutate of [
    (draft: PersistedAppState) => {
      draft.sync.accountId = 'other-123456';
    },
    (draft: PersistedAppState) => {
      draft.sync.sequence = 0;
    },
    (draft: PersistedAppState) => {
      delete draft.sync.entities['tasks:task-1'];
    },
    (draft: PersistedAppState) => {
      draft.sync.outbox.pop();
    },
    (draft: PersistedAppState) => {
      draft.sync.outbox[0].entity.payload = '{}';
    },
    (draft: PersistedAppState) => {
      draft.sync.entities['tasks:task-1'].revision = 2;
    },
    (draft: PersistedAppState) => {
      draft.sync.schemaVersion = 2 as never;
    },
  ]) {
    const broken = clone(state);
    mutate(broken);
    assert.throws(() => validateSync(broken));
  }
  const acknowledged = flush(state);
  const missing = clone(acknowledged);
  missing.sync.acknowledged = {};
  assert.throws(() => validateSync(missing));
  for (const mutate of [
    (draft: AppState) => {
      draft.sync!.deviceId = 'new-device-123';
    },
    (draft: AppState) => {
      delete draft.sync;
    },
    (draft: AppState) => {
      delete draft.storageVersion;
    },
  ])
    assert.throws(() => change(state, mutate));
});

test('拒绝待发事务和revision倒序，不能将后序事务挪到ACK历史绕过前缀', () => {
  const state = initial();
  const next = change(state, (draft) =>
    updateSettings(draft, { threshold: 4 }),
  );
  const later = change(next, (draft) =>
    updateSettings(draft, { threshold: 5 }),
  );
  const reversed = clone(later);
  const groups = getSyncBatch(later, later.sync.accountId).transactions;
  reversed.sync.outbox = groups
    .slice()
    .reverse()
    .flatMap((tx) => tx.operations);
  assert.throws(() => validateSync(reversed));
  const moved = clone(later),
    last = groups.at(-1)!;
  moved.sync.outbox = moved.sync.outbox.filter(
    (op) => op.transactionId !== last.transactionId,
  );
  // 通过正规ACK生成该事务的规范签名，再移动到有更早pending的存档。
  const allAcknowledged = flush(later);
  moved.sync.acknowledged[last.transactionId] =
    allAcknowledged.sync.acknowledged[last.transactionId];
  assert.throws(() => validateSync(moved));
  const badHistory = clone(allAcknowledged);
  const signature = JSON.parse(
    badHistory.sync.acknowledged[last.transactionId],
  );
  signature[0].baseRevision = 1;
  badHistory.sync.acknowledged[last.transactionId] = JSON.stringify(signature);
  assert.throws(() => validateSync(badHistory));
});

test('保存和ACK失败均保原业务/outbox，损坏新schema与旧存档不自动初始化覆盖', async () => {
  let saved = initial(),
    fails = true;
  const store = createAppStore(
    {
      load: async () => clone(saved),
      save: async (next) => {
        if (fails) throw new Error('磁盘已满');
        saved = clone(next);
      },
    },
    clock(),
  );
  await store.initialize();
  const before = clone(store.getSnapshot().state);
  assert.equal(
    (await store.run((draft) => checkIn(draft, 'task-1', NOW))).ok,
    false,
  );
  assert.deepEqual(store.getSnapshot().state, before);
  const batch = store.pendingSync(saved.sync.accountId);
  assert.equal((await store.acknowledge(batch)).ok, false);
  assert.deepEqual(saved, before);
  fails = false;
  assert.equal((await store.acknowledge(batch)).ok, true);
  assert.equal(saved.sync.outbox.length, 0);
  const bad = clone(initial());
  delete (bad as AppState).sync;
  for (const payload of [createInitialState(NOW), bad]) {
    let writes = 0;
    const original = JSON.stringify(payload);
    const repo = createWebRepository(() => ({
      getItem: (key) => {
        assert.equal(key, WEB_STORAGE_KEY);
        return original;
      },
      setItem: () => {
        writes++;
      },
    }));
    const brokenStore = createAppStore(repo, clock());
    await brokenStore.initialize();
    assert.equal(brokenStore.getSnapshot().state, null);
    assert.ok(brokenStore.getSnapshot().error);
    assert.equal(writes, 0);
  }
});

test('设备时间回拨不破坏metadata单调性，revision作本机排序且普通用户文字不被误当图片', () => {
  const state = initial();
  const next = change(
    state,
    (draft) => {
      draft.tasks[0].name = 'data:image/ 只是文字';
    },
    { ...clock(), now: () => new Date('2020-01-01T00:00:00.000Z') },
  );
  const entity = next.sync.entities['tasks:task-1'];
  assert.equal(entity.revision, 2);
  assert.equal(entity.updatedAt, entity.createdAt);
  validateSync(next);
});
