import {
  checkIn,
  createInitialState,
  dateKey,
  deleteTask,
  ensureGiftProfile,
  migrateState,
  updateLocalProfile,
  updateTask,
  weekKey,
  type ActionResult,
  type AppState,
} from '../src/domain/engine';
import {
  applyGroupJournals,
  createGroup,
  exportInvite,
  joinGroup,
} from '../src/domain/groupSync';
import {
  commitSync,
  exportAccountJournal,
  initializeSync,
} from '../src/domain/syncModel';

const GROUP_ID = 'fixture-ranking-group-v1';
const GROUP_SECRET = 'fixture-offline-only-secret-v1';
const GROUP_NAME = '排行夹具小组';

function requireSuccess(result: ActionResult) {
  if (!result.ok) throw new Error(result.message);
}

// 只接受全新默认业务；主题和查看偏好不在业务存档中，不受此限制。
function hasPristineBusiness(state: AppState) {
  const initial = createInitialState();
  const keys = [
    'tasks',
    'checkins',
    'tickets',
    'redemptions',
    'weight',
    'milestoneGoals',
    'settings',
    'giftState',
  ] as const;
  return (
    keys.every(
      (key) => JSON.stringify(state[key]) === JSON.stringify(initial[key]),
    ) &&
    !!state.sync &&
    Object.values(state.sync.entities).every(
      (entity) =>
        [
          'tasks',
          'goals',
          'settings',
          'profile',
          'groups',
          'memberships',
        ].includes(entity.entityType) &&
        entity.revision === 1 &&
        !entity.deletedAt,
    )
  );
}

export function prepareFixtureGroup(state: AppState): ActionResult {
  if (
    !hasPristineBusiness(state) ||
    state.groupLink ||
    state.groupOwned ||
    state.pendingGroupDeparture ||
    (state.groupPeers?.length ?? 0) > 0
  )
    return {
      ok: false,
      message: '仅接受全新夹具存档；已有业务或小组已保留，不会重置',
    };
  return createGroup(state, GROUP_NAME, {
    groupId: GROUP_ID,
    secret: GROUP_SECRET,
  });
}

export function appendRankingFixture(
  state: AppState,
  now = new Date(),
): ActionResult {
  if (Number.isFinite(now.getTime()) && dateKey(now) === weekKey(now)) {
    return {
      ok: false,
      message: '周一没有同周其他过去日期；请周二至周日添加，原存档保留',
    };
  }
  if (
    !Number.isFinite(now.getTime()) ||
    !hasPristineBusiness(state) ||
    state.groupLink?.groupId !== GROUP_ID ||
    state.groupLink.secret !== GROUP_SECRET ||
    state.groupLink.name !== GROUP_NAME ||
    state.groupOwned?.id !== GROUP_ID ||
    state.pendingGroupDeparture ||
    (state.groupPeers?.length ?? 0) > 0
  )
    return {
      ok: false,
      message: '需先准备专用空小组；已有夹具或其他业务保持不变',
    };
  try {
    const invite = exportInvite(state);
    const journals = Array.from({ length: 10 }, (_, index) => {
      const accountId = `fixture-ranking-peer-${index + 1}`;
      const ids = [accountId, `fixture-ranking-device-${index + 1}`];
      let idIndex = 0;
      const clock = {
        now: () => now,
        id: () => {
          const id = ids[idIndex++];
          if (!id) throw new Error('夹具身份编号不足');
          return id;
        },
      };
      const previous = initializeSync(createInitialState(now), clock);
      const peer = migrateState(previous);
      const name =
        index === 8 ? '夹具·第十名长昵称换行观察' : `夹具·成员${index + 1}`;
      requireSuccess(ensureGiftProfile(peer, { id: accountId, name }));
      requireSuccess(
        updateLocalProfile(peer, {
          id: accountId,
          name,
          avatar: { kind: 'preset', id: index % 2 ? 'moon' : 'sun' },
        }),
      );
      requireSuccess(joinGroup(peer, invite));
      requireSuccess(
        updateTask(peer, 'task-1', { name: '夹具·共同任务', target: 11 }),
      );
      for (let count = 0; count < 10 - index; count += 1) {
        requireSuccess(
          checkIn(peer, 'task-1', now, index === 9 ? weekKey(now) : undefined),
        );
      }
      // 最后一位仅一条有效记录，任务删除后该记录仍应计入名次和足迹。
      if (index === 9) requireSuccess(deleteTask(peer, 'task-1'));
      return exportAccountJournal(commitSync(previous, peer, clock));
    });
    const next = applyGroupJournals(state, journals, now.toISOString()).state;
    requireSuccess(
      updateTask(next, 'task-1', { name: '夹具·排行与跨年补卡', target: 11 }),
    );
    for (let count = 0; count < 11; count += 1) {
      requireSuccess(checkIn(next, 'task-1', now));
    }
    Object.assign(state, next);
    return {
      ok: true,
      message: '已追加11位成员、次数11至1；这是离线夹具，不是真实同步',
    };
  } catch {
    return { ok: false, message: '夹具未添加，原存档保留' };
  }
}
