import {
  checkIn,
  createInitialState,
  ensureGiftProfile,
  migrateState,
  redeemTicket,
  updateLocalProfile,
  updateTask,
  updateSettings,
  type AppState,
  type ActionResult,
} from '../src/domain/engine';
import {
  applyGroupJournals,
  exportInvite,
  joinGroup,
  peerBoards,
} from '../src/domain/groupSync';
import {
  commitSync,
  initializeSync,
  exportAccountJournal,
  validateSync,
} from '../src/domain/syncModel';
import { hasDemoHistory } from '../src/domain/demoData';

export const PROTECTION_PEER_ID = 'fixture-protection-peer-v1';
const DEVICE_ID = 'fixture-protection-device-v1';

function requireSuccess(result: ActionResult) {
  if (!result.ok) throw new Error(result.message);
}

// 仅供同包名专用入口；不接收外部数据，不重新构造任何已有成员日志。
export function prepareProtectionPeer(
  state: AppState,
  now = new Date(),
): ActionResult {
  try {
    validateSync(state);
    const peers = peerBoards(state);
    if (
      !Number.isFinite(now.getTime()) ||
      state.groupLink?.groupId !== 'fixture-ranking-group-v1' ||
      state.groupLink.name !== '排行夹具小组' ||
      state.groupLink.secret !== 'fixture-offline-only-secret-v1' ||
      state.groupOwned?.id !== state.groupLink.groupId ||
      state.groupOwned.name !== state.groupLink.name ||
      state.groupLink.ownerAccountId !== state.sync.accountId ||
      state.pendingGroupDeparture ||
      hasDemoHistory(state) ||
      peers.length !== 10 ||
      !state.giftState?.profile.name ||
      state.weight.startWeight === null ||
      state.sync.accountId === PROTECTION_PEER_ID ||
      state.sync.accountId === DEVICE_ID ||
      state.sync.deviceId === DEVICE_ID ||
      state.sync.deviceId === PROTECTION_PEER_ID ||
      peers.some(
        (peer) =>
          [PROTECTION_PEER_ID, DEVICE_ID].includes(peer.accountId) ||
          [PROTECTION_PEER_ID, DEVICE_ID].includes(peer.app.sync.deviceId),
      )
    ) {
      return {
        ok: false,
        message:
          '需原10成员专用组、本机非空资料与目标且未添加演示；重复或其他存档保持不变',
      };
    }
    for (let index = 0; index < 10; index += 1) {
      const peer = peers.find(
        (entry) => entry.accountId === 'fixture-ranking-peer-' + (index + 1),
      );
      if (
        !peer ||
        peer.left ||
        peer.app.sync?.deviceId !== 'fixture-ranking-device-' + (index + 1) ||
        !peer.app.giftState?.profile.name ||
        !peer.app.giftState.profile.avatar ||
        peer.app.checkins.length !== 10 - index ||
        peer.app.checkins.some((entry) => entry.taskId !== 'task-1') ||
        peer.app.tasks.find((task) => task.id === 'task-1')?.name !==
          '夹具·共同任务' ||
        peer.app.tasks.find((task) => task.id === 'task-1')?.target !== 11 ||
        !!peer.app.tasks.find((task) => task.id === 'task-1')?.deleted !==
          (index === 9)
      )
        return {
          ok: false,
          message: '原10成员副本不符合完整夹具前置，未修改存档',
        };
    }
    const oldPeers = JSON.stringify(state.groupPeers);
    const original = migrateState(state);
    const ids = [PROTECTION_PEER_ID, DEVICE_ID];
    let idIndex = 0;
    const clock = {
      now: () => now,
      id: () => {
        const id = ids[idIndex++];
        if (!id) throw new Error('测试身份编号不足');
        return id;
      },
    };
    const previous = initializeSync(createInitialState(now), clock);
    const remote = migrateState(previous);
    requireSuccess(
      ensureGiftProfile(remote, {
        id: PROTECTION_PEER_ID,
        name: '副本保护测试成员',
      }),
    );
    requireSuccess(
      updateLocalProfile(remote, {
        id: PROTECTION_PEER_ID,
        name: '副本保护测试成员',
        avatar: { kind: 'preset', id: 'sun' },
      }),
    );
    requireSuccess(joinGroup(remote, exportInvite(state)));
    requireSuccess(
      updateTask(remote, 'task-1', { name: '副本保护已有任务', target: 3 }),
    );
    requireSuccess(updateSettings(remote, { expiryEnabled: false }));
    for (let count = 0; count < 3; count += 1)
      requireSuccess(checkIn(remote, 'task-1', now));
    requireSuccess(redeemTicket(remote, now));
    const journal = exportAccountJournal(commitSync(previous, remote, clock));
    const next = applyGroupJournals(state, [journal], now.toISOString()).state;
    const imported = peerBoards(next).find(
      (peer) => peer.accountId === PROTECTION_PEER_ID,
    );
    if (
      !imported ||
      imported.app.checkins.length !== 3 ||
      imported.app.tickets.length !== 1 ||
      imported.app.tickets[0].expiresAt !== null ||
      imported.app.tickets[0].usedAt !== null ||
      JSON.stringify(
        next.groupPeers?.filter(
          (peer) => peer.accountId !== PROTECTION_PEER_ID,
        ),
      ) !== oldPeers
    )
      throw new Error('副本追加校验失败');
    if (
      JSON.stringify({ ...next, groupPeers: original.groupPeers }) !==
      JSON.stringify(original)
    )
      throw new Error('本机业务不应改变');
    validateSync(next);
    Object.assign(state, next);
    return {
      ok: true,
      message: '已保存1名合法离线成员：3次打卡、1张永久可用券；不是WiFi同步',
    };
  } catch {
    return { ok: false, message: '副本未追加；原存档保留' };
  }
}

export function createProtectionBaseline() {
  let baseline: AppState | null = null;
  return {
    capture(state: AppState) {
      if (baseline || hasDemoHistory(state)) return false;
      try {
        validateSync(state);
        const peers = peerBoards(state);
        const imported = peers.find(
          (peer) => peer.accountId === PROTECTION_PEER_ID,
        );
        if (
          state.groupLink?.groupId !== 'fixture-ranking-group-v1' ||
          state.pendingGroupDeparture ||
          peers.length !== 11 ||
          !imported ||
          imported.left ||
          imported.app.checkins.length !== 3 ||
          imported.app.tickets.length !== 1 ||
          imported.app.tickets[0].expiresAt !== null ||
          imported.app.tickets[0].usedAt !== null
        )
          return false;
      } catch {
        return false;
      }
      baseline = migrateState(state);
      return true;
    },
    compare(state: AppState) {
      if (!baseline) return null;
      const prior = baseline;
      const unchanged = (before: unknown, after: unknown) =>
        JSON.stringify(before) === JSON.stringify(after);
      const entities = [
        'tasks',
        'checkins',
        'tickets',
        'redemptions',
        'milestoneGoals',
      ] as const;
      return {
        peers: unchanged(prior.groupPeers, state.groupPeers),
        local:
          entities.every(
            (key) =>
              new Set(prior[key].map((entity) => entity.id)).size ===
                prior[key].length &&
              new Set(state[key].map((entity) => entity.id)).size ===
                state[key].length &&
              prior[key].every((entity) =>
                unchanged(
                  entity,
                  state[key].find((entry) => entry.id === entity.id),
                ),
              ),
          ) &&
          (!prior.giftState
            ? !state.giftState
            : !!state.giftState &&
              unchanged(prior.giftState.profile, state.giftState.profile) &&
              (['outgoing', 'received', 'receipts'] as const).every((key) =>
                prior.giftState![key].every((entity) =>
                  state.giftState![key].some((entry) =>
                    unchanged(entity, entry),
                  ),
                ),
              )) &&
          unchanged(prior.settings, state.settings) &&
          unchanged(prior.weight, state.weight),
        group:
          unchanged(prior.groupLink, state.groupLink) &&
          unchanged(prior.groupOwned, state.groupOwned) &&
          unchanged(prior.pendingGroupDeparture, state.pendingGroupDeparture),
      };
    },
  };
}
