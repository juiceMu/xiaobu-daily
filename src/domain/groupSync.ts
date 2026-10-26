import type {
  ActionResult,
  AppState,
  GroupPeer,
  PersistedAppState,
  ProfileAvatar,
} from './types';
import {
  exportAccountJournal,
  journalState,
  validateSync,
  type AccountJournal,
} from './syncModel';
import { isTicketReserved } from './companionValidation.mjs';

const idValid = (value: string) =>
  /^[a-zA-Z0-9][a-zA-Z0-9_-]{7,79}$/.test(value);
const nameValid = (value: string) =>
  value.length >= 1 &&
  value.length <= 20 &&
  value === value.trim() &&
  !/[\u0000-\u001f\u007f]/.test(value);
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
export interface GroupInvite {
  groupId: string;
  name: string;
  secret: string;
  ownerAccountId?: string;
}
function opMark(operation: AccountJournal['operations'][number]) {
  return [
    operation.operationId,
    operation.entityRevision,
    operation.entity.payload,
    operation.entity.deletedAt,
  ].join('\n');
}
function chainRelation(
  local: GroupPeer['operations'],
  incoming: GroupPeer['operations'],
) {
  const limit = Math.min(local.length, incoming.length);
  for (let index = 0; index < limit; index++)
    if (opMark(local[index]) !== opMark(incoming[index])) return 'fork';
  if (incoming.length > local.length) return 'extend';
  if (incoming.length < local.length) return 'shorter';
  return 'same';
}
export function journalIsPersistedPrefix(
  incoming: AccountJournal,
  saved: GroupPeer,
) {
  return (
    incoming.accountId === saved.accountId &&
    incoming.deviceId === saved.deviceId &&
    incoming.operations.length <= saved.operations.length &&
    incoming.operations.every(
      (operation, index) =>
        JSON.stringify(operation) === JSON.stringify(saved.operations[index]),
    )
  );
}
function assertGroup(journal: AccountJournal, groupId: string) {
  const state = journalState(journal);
  let membership = false;
  for (const entity of Object.values(state.sync.entities)) {
    if (entity.entityType === 'groups' && entity.entityId !== groupId)
      throw new Error('收到的小组编号不一致');
    if (entity.entityType !== 'memberships') continue;
    const payload = JSON.parse(entity.payload) as { groupId?: string };
    if (payload.groupId !== groupId)
      throw new Error('收到的成员不属于这个小组');
    membership = true;
  }
  if (!membership) throw new Error('收到的记录没有小组成员身份');
}
export function createGroup(
  state: AppState,
  name: string,
  ids: { groupId: string; secret: string },
): ActionResult {
  const trimmed = name.trim();
  if (!nameValid(trimmed))
    return { ok: false, message: '小组名称需要 1–20 个字' };
  if (
    !idValid(ids.groupId) ||
    !idValid(ids.secret) ||
    ids.groupId === ids.secret
  )
    return { ok: false, message: '小组编号无效' };
  if (state.groupLink) return { ok: false, message: '已经在一个小组里' };
  if (state.pendingGroupDeparture)
    return { ok: false, message: '请先同步并完成上一小组的离开通知' };
  if (state.groupOwned) return { ok: false, message: '这台手机已经创建过小组' };
  state.groupOwned = { id: ids.groupId, name: trimmed };
  state.groupLink = {
    groupId: ids.groupId,
    name: trimmed,
    secret: ids.secret,
    ...(state.sync?.accountId ? { ownerAccountId: state.sync.accountId } : {}),
  };
  return { ok: true, message: '小组已创建。对方加入后，点同步才交换记录。' };
}
export function exportInvite(state: AppState) {
  if (!state.groupLink) throw new Error('还没有加入小组');
  return JSON.stringify({
    version: state.groupLink.ownerAccountId ? 2 : 1,
    kind: 'sprout-group',
    groupId: state.groupLink.groupId,
    name: state.groupLink.name,
    secret: state.groupLink.secret,
    ...(state.groupLink.ownerAccountId
      ? { ownerAccountId: state.groupLink.ownerAccountId }
      : {}),
  });
}
export function parseInvite(raw: string): GroupInvite {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error('这不是小组邀请');
  }
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    (value as { kind?: string }).kind !== 'sprout-group' ||
    ![1, 2].includes((value as { version?: number }).version ?? 0)
  )
    throw new Error('这不是小组邀请');
  const invite = value as {
    groupId?: unknown;
    name?: unknown;
    secret?: unknown;
    ownerAccountId?: unknown;
  };
  if (
    typeof invite.groupId !== 'string' ||
    typeof invite.name !== 'string' ||
    typeof invite.secret !== 'string' ||
    !idValid(invite.groupId) ||
    !idValid(invite.secret) ||
    invite.groupId === invite.secret ||
    !nameValid(invite.name) ||
    ((value as { version: number }).version === 2 &&
      (typeof invite.ownerAccountId !== 'string' ||
        !idValid(invite.ownerAccountId))) ||
    (invite.ownerAccountId !== undefined &&
      (typeof invite.ownerAccountId !== 'string' ||
        !idValid(invite.ownerAccountId)))
  )
    throw new Error('小组邀请无效');
  return {
    groupId: invite.groupId,
    name: invite.name,
    secret: invite.secret,
    ...(typeof invite.ownerAccountId === 'string'
      ? { ownerAccountId: invite.ownerAccountId }
      : {}),
  };
}
export function joinGroup(state: AppState, raw: string): ActionResult {
  if (state.groupLink) return { ok: false, message: '已经在一个小组里' };
  if (state.pendingGroupDeparture)
    return { ok: false, message: '请先同步并完成上一小组的离开通知' };
  let invite: GroupInvite;
  try {
    invite = parseInvite(raw);
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : '小组邀请无效',
    };
  }
  const accountId = state.sync?.accountId;
  if (!accountId) return { ok: false, message: '本地数据尚未就绪' };
  const key = `memberships:${invite.groupId}/${accountId}`;
  if (state.sync?.entities[key]?.deletedAt)
    return { ok: false, message: '离开后不能再用原来的身份加入这个小组' };
  if (state.groupOwned && state.groupOwned.id !== invite.groupId)
    return { ok: false, message: '这台手机已经创建过别的小组' };
  state.groupLink = invite;
  return {
    ok: true,
    message: '已加入小组。点同步后才会交换记录。',
  };
}
export function renameGroup(state: AppState, name: string): ActionResult {
  const trimmed = name.trim();
  if (!nameValid(trimmed))
    return { ok: false, message: '小组名称需要 1–20 个字' };
  if (!state.groupOwned)
    return { ok: false, message: '只有创建小组的手机可以改名称' };
  state.groupOwned = { ...state.groupOwned, name: trimmed };
  if (state.groupLink) state.groupLink = { ...state.groupLink, name: trimmed };
  return { ok: true, message: '小组名称已保存' };
}
export function leaveGroup(state: AppState): ActionResult {
  if (!state.groupLink) return { ok: false, message: '还没有加入小组' };
  if (state.tickets.some(isTicketReserved))
    return {
      ok: false,
      message: '还有待处理的同行记录，请先完成或取消并同步核对，再离开小组',
    };
  state.pendingGroupDeparture = { ...state.groupLink };
  delete state.groupLink;
  delete state.groupPeers;
  return { ok: true, message: '已离开小组，自己的打卡和奖券仍保留。' };
}
export function peerBoards(state: AppState) {
  const groupId =
    state.groupLink?.groupId ?? state.pendingGroupDeparture?.groupId ?? '';
  return (state.groupPeers ?? []).map((peer) => {
    const app = journalState(peer);
    const membership =
      app.sync.entities[`memberships:${groupId}/${peer.accountId}`];
    return {
      accountId: peer.accountId,
      syncedAt: peer.syncedAt,
      left: !membership || !!membership.deletedAt,
      name: app.giftState?.profile.name ?? '成员',
      avatar: app.giftState?.profile.avatar as ProfileAvatar | undefined,
      app,
    };
  });
}
export function journalsForSend(state: AppState): AccountJournal[] {
  validateSync(state);
  if (!state.groupLink && !state.pendingGroupDeparture)
    throw new Error('还没有加入小组');
  const own = exportAccountJournal(state);
  const peers = (state.groupPeers ?? []).map((peer) => ({
    accountId: peer.accountId,
    deviceId: peer.deviceId,
    operations: copy(peer.operations),
    attachments: copy(peer.attachments),
  }));
  return [own, ...peers];
}
function groupNameFrom(journal: AccountJournal, groupId: string) {
  const state = journalState(journal);
  const entity = state.sync.entities[`groups:${groupId}`];
  if (!entity || entity.deletedAt || entity.ownerId !== journal.accountId)
    return '';
  const payload = JSON.parse(entity.payload) as { name?: string };
  return typeof payload.name === 'string' ? payload.name : '';
}
export function applyGroupJournals(
  state: AppState,
  journals: AccountJournal[],
  syncedAt: string,
): { state: PersistedAppState; message: string } {
  validateSync(state);
  if (!state.groupLink && !state.pendingGroupDeparture)
    throw new Error('还没有加入小组');
  if (!Array.isArray(journals)) throw new Error('收到的同步内容无效');
  const next = copy(state);
  const groupLink = next.groupLink ?? next.pendingGroupDeparture;
  if (!groupLink) throw new Error('还没有加入小组');
  const peers = new Map(
    (next.groupPeers ?? []).map((peer) => [peer.accountId, peer]),
  );
  const knownOwnerId =
    groupLink.ownerAccountId ??
    [...peers.values()].find((peer) => groupNameFrom(peer, groupLink.groupId))
      ?.accountId;
  let accepted = 0;
  let forks = 0;
  for (const journal of journals) {
    if (journal.accountId === next.sync!.accountId) continue;
    journalState(journal);
    assertGroup(journal, groupLink.groupId);
    const current = peers.get(journal.accountId);
    const relation = chainRelation(
      current?.operations ?? [],
      journal.operations,
    );
    if (relation === 'fork') {
      forks += 1;
      continue;
    }
    if (relation === 'extend' || !current) {
      peers.set(journal.accountId, {
        accountId: journal.accountId,
        deviceId: journal.deviceId,
        operations: copy(journal.operations),
        attachments: copy(journal.attachments),
        syncedAt,
      });
    } else if (current) current.syncedAt = syncedAt;
    accepted += 1;
  }
  next.groupPeers = [...peers.values()];
  if (!next.groupOwned && next.groupLink) {
    const incomingOwners = journals.filter((journal) =>
      groupNameFrom(journal, groupLink.groupId),
    );
    const ownerId =
      knownOwnerId ??
      (incomingOwners.length === 1 ? incomingOwners[0].accountId : undefined);
    if (!knownOwnerId && ownerId) groupLink.ownerAccountId = ownerId;
    const owner = ownerId ? peers.get(ownerId) : undefined;
    const name = owner && groupNameFrom(owner, groupLink.groupId);
    if (name) groupLink.name = name;
  }
  validateSync(next);
  const message = forks
    ? `已同步 ${accepted} 人的记录，${forks} 人的记录无法合并，原副本保留`
    : accepted
      ? `已同步 ${accepted} 人的记录`
      : '没有新的小组记录';
  return { state: next, message };
}

export function validateDepartureJournals(
  state: AppState,
  journals: AccountJournal[],
) {
  validateSync(state);
  const pending = state.pendingGroupDeparture;
  if (!pending || !Array.isArray(journals))
    throw new Error('没有待发送的小组离开通知');
  for (const journal of journals) {
    if (journal.accountId === state.sync!.accountId) continue;
    journalState(journal);
    assertGroup(journal, pending.groupId);
  }
}
