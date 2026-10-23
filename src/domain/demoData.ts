import {
  addMilestoneGoal,
  addTask,
  archiveMilestoneGoal,
  archiveTask,
  checkIn,
  createGift,
  createInitialState,
  dateKey,
  ensureGiftProfile,
  getWeekStats,
  migrateState,
  receiveGift,
  recordGiftReceipt,
  recordMilestoneValue,
  redeemTicket,
  setMilestoneEnabled,
  updateLocalProfile,
  updateSettings,
  useTicket as consumeTicket,
  weekKey,
  type ActionResult,
  type AppState,
  type GroupPeer,
  type PersistedAppState,
} from './engine';
import { createGroup, joinGroup, leaveGroup } from './groupSync';
import { commitSync, exportAccountJournal, initializeSync } from './syncModel';

const DEMO_MARKER = 'demo-history-v1-reading';
const DEMO_GROUP_ID = 'demo-group-0001';
const DEMO_GROUP_SECRET = 'demo-group-secret';
const DEMO_INVITE = JSON.stringify({
  version: 1,
  kind: 'sprout-group',
  groupId: DEMO_GROUP_ID,
  name: '演示小组',
  secret: DEMO_GROUP_SECRET,
});

export function hasDemoHistory(state: AppState): boolean {
  return state.tasks.some((task) => task.id === DEMO_MARKER);
}

function requireSuccess(result: ActionResult): ActionResult {
  if (!result.ok) throw new Error(result.message);
  return result;
}

// 日期按本地日历移动，跨夏令时仍落在正确的自然日。
function dayAt(now: Date, offset: number): Date {
  const date = new Date(now);
  date.setDate(date.getDate() + offset);
  return date;
}

/** 仅由用户明确触发；在私有草稿内构造，通过 store.run 一次提交业务与同步事务。 */
export function seedDemoHistory(
  state: AppState,
  now = new Date(),
): ActionResult {
  if (!Number.isFinite(now.getTime()))
    return { ok: false, message: '当前日期无效，未添加演示数据' };
  const hadHistory = hasDemoHistory(state);
  if (hadHistory && (state.groupLink || state.groupOwned))
    return { ok: false, message: '已添加过演示历史，不会重复添加' };
  const canCreateGroup = !state.groupLink && !state.groupOwned;

  try {
    if (!hadHistory) seedPersonalHistory(state, now);
    if (canCreateGroup) {
      requireSuccess(
        createGroup(state, '演示小组', {
          groupId: DEMO_GROUP_ID,
          secret: DEMO_GROUP_SECRET,
        }),
      );
      state.groupPeers = [activeMember(now), departedMember(now)];
    }
    const message = [
      hadHistory ? '' : `已添加最近四周的演示历史（截至${dateKey(now)}）`,
      canCreateGroup
        ? '已创建演示小组，到今日或奖券打开「看全组」即可查看其他成员'
        : '',
      '原有数据已保留',
    ]
      .filter(Boolean)
      .join('，');
    return { ok: true, message };
  } catch (error) {
    return {
      ok: false,
      message: `未添加演示数据：${error instanceof Error ? error.message : '构造失败'}`,
    };
  }
}

function seedPersonalHistory(state: AppState, now: Date) {
  try {
    const draft = migrateState(state);
    const originalSettings = { ...draft.settings };
    const originalAvailable = getWeekStats(state, now).available;
    const addDemoTask = (
      name: string,
      target: number,
      icon: string,
      id?: string,
    ) => {
      requireSuccess(addTask(draft, { name, target, icon, color: 'green' }));
      const task = draft.tasks[draft.tasks.length - 1];
      if (id) task.id = id;
      return task;
    };
    const reading = addDemoTask('演示·每日阅读', 3, '📖', DEMO_MARKER);
    const walking = addDemoTask('演示·轻松散步', 2, '🚶');
    const archived = addDemoTask('演示·旧日写作', 1, '✍️');
    const monday = new Date(`${weekKey(now)}T00:00:00`);
    const currentDay = (now.getDay() + 6) % 7;

    // 历史兑换模拟当时的规则；最终保留用户当前设置，兑换成本作为历史快照存档。
    draft.settings = {
      ...originalSettings,
      threshold: 3,
      rewardName: '演示·周末小奖励',
      expiryEnabled: true,
      expiryDay: 1,
      expiryTime: '00:00',
    };
    for (let week = -3; week <= 0; week += 1) {
      const lastDay = week === 0 ? currentDay : 6;
      for (let day = 0; day <= lastDay; day += 1) {
        const at =
          week === 0 && day === currentDay
            ? new Date(now)
            : dayAt(monday, week * 7 + day);
        const count = 1 + ((day + week + 21) % 3);
        for (let index = 0; index < count; index += 1)
          requireSuccess(checkIn(draft, reading.id, at));
        if (day % 2 === 0) requireSuccess(checkIn(draft, walking.id, at));
        if (week < 0 && day < 3)
          requireSuccess(checkIn(draft, archived.id, at));
      }
      if (week < 0) {
        const at = dayAt(monday, week * 7 + 6);
        for (let index = 0; index < 3; index += 1) {
          const ticket = requireSuccess(redeemTicket(draft, at)).ticket!;
          if (index <= (week === -2 ? 1 : 0))
            requireSuccess(
              consumeTicket(draft, ticket.id, at, '演示：给自己一段休息时光'),
            );
        }
      }
    }
    draft.settings = originalSettings;
    requireSuccess(archiveTask(draft, archived.id));

    // 即便用户设置较高门槛，也保留至少一张已兑换券和一份可兑换额度。
    let remaining = Math.max(
      0,
      originalSettings.threshold * 2 -
        (getWeekStats(draft, now).available - originalAvailable),
    );
    for (let index = 0; remaining > 0; index += 1) {
      const count = Math.min(99, remaining);
      const task = addDemoTask(`演示·专注练习${index + 1}`, count, '🌱');
      for (let entry = 0; entry < count; entry += 1)
        requireSuccess(checkIn(draft, task.id, now));
      remaining -= count;
    }
    draft.settings = {
      ...originalSettings,
      rewardName: `演示·${originalSettings.rewardName}`.slice(0, 30),
    };
    requireSuccess(redeemTicket(draft, now));
    draft.settings = originalSettings;

    const goalExamples = [
      {
        name: '演示·阅读积累',
        unit: '页',
        start: 0,
        step: 20,
        icon: '📖' as const,
      },
      {
        name: '演示·健康体重',
        unit: '斤',
        start: 150,
        step: 1,
        icon: '⚖️' as const,
      },
      {
        name: '演示·储蓄计划',
        unit: '元',
        start: 0,
        step: 100,
        icon: '💰' as const,
      },
    ];
    goalExamples.forEach((example, index) => {
      const goal = requireSuccess(
        addMilestoneGoal(draft, {
          name: example.name,
          unit: example.unit,
          startWeight: example.start,
          step: example.step,
          direction: index === 1 ? 'decrease' : 'increase',
          icon: example.icon,
        }),
      ).goal!;
      for (let entry = 1; entry <= 4; entry += 1) {
        const at = dayAt(monday, -22 + entry * 4);
        const value =
          example.start + (index === 1 ? -1 : 1) * example.step * entry;
        requireSuccess(recordMilestoneValue(draft, goal.id, value, at));
      }
      const ticket = draft.tickets.find((item) => item.goalId === goal.id)!;
      requireSuccess(
        consumeTicket(
          draft,
          ticket.id,
          dayAt(monday, -3),
          '演示：首次达标的小庆祝',
        ),
      );
      if (index === 1)
        requireSuccess(setMilestoneEnabled(draft, goal.id, false));
      if (index === 2) requireSuccess(archiveMilestoneGoal(draft, goal.id));
    });

    if (!draft.giftState)
      requireSuccess(
        ensureGiftProfile(draft, {
          id: draft.sync?.accountId ?? 'demo-local-owner',
          name: '我的本机账户',
        }),
      );
    const peer = createInitialState(now);
    const peerId =
      draft.giftState!.profile.id === 'demo-friend-account'
        ? 'demo-friend-account-two'
        : 'demo-friend-account';
    requireSuccess(ensureGiftProfile(peer, { id: peerId, name: '演示好友' }));
    const incoming = [
      {
        validity: 'week' as const,
        at: dayAt(monday, -10),
        name: '演示·已过期下午茶',
      },
      {
        validity: 'permanent' as const,
        at: dayAt(monday, -8),
        name: '演示·电影之约',
      },
      { validity: 'week' as const, at: now, name: '演示·本周甜点' },
      {
        validity: 'permanent' as const,
        at: dayAt(monday, -4),
        name: '演示·一起散步',
      },
    ];
    incoming.forEach((example, index) => {
      const gift = requireSuccess(
        createGift(
          peer,
          example,
          {
            giftId: `demo-incoming-gift-${index}`,
            ticketId: `demo-incoming-ticket-${index}`,
          },
          example.at,
        ),
      ).gift!;
      const ticket = requireSuccess(
        receiveGift(draft, gift, example.at),
      ).ticket!;
      if (index === 1)
        requireSuccess(
          consumeTicket(
            draft,
            ticket.id,
            dayAt(monday, -1),
            '演示：和好友看电影',
          ),
        );
    });
    for (let index = 0; index < 2; index += 1) {
      const gift = requireSuccess(
        createGift(
          draft,
          {
            name: index === 0 ? '演示·请你喝杯茶' : '演示·待领取心意',
            validity: index === 0 ? 'permanent' : 'week',
          },
          {
            giftId: `demo-outgoing-gift-${index}`,
            ticketId: `demo-outgoing-ticket-${index}`,
          },
          now,
        ),
      ).gift!;
      if (index === 0) {
        const receipt = requireSuccess(receiveGift(peer, gift, now)).receipt!;
        requireSuccess(recordGiftReceipt(draft, receipt, now));
      }
    }

    const validated = migrateState(draft);
    // 同步元数据由 store.run 统一提交；这里仅追加业务切片。
    state.tasks = validated.tasks;
    state.checkins = validated.checkins;
    state.tickets = validated.tickets;
    state.redemptions = validated.redemptions;
    state.weight = validated.weight;
    state.milestoneGoals = validated.milestoneGoals;
    state.giftState = validated.giftState;
  } catch (error) {
    throw new Error(
      error instanceof Error ? error.message : '演示历史构造失败',
    );
  }
}

function peerClock(now: Date, accountId: string, deviceId: string) {
  const ids = [accountId, deviceId];
  let index = 0;
  return {
    now: () => now,
    id: () => {
      const id = ids[index];
      index += 1;
      if (!id) throw new Error('演示成员编号不足');
      return id;
    },
  };
}

function applyPeer(
  peer: PersistedAppState,
  clock: { now: () => Date; id: () => string },
  mutate: (draft: AppState) => void,
) {
  const draft = migrateState(peer);
  mutate(draft);
  return commitSync(peer, migrateState(draft), clock);
}

function asPeer(peer: PersistedAppState, now: Date): GroupPeer {
  const journal = exportAccountJournal(peer);
  return {
    accountId: journal.accountId,
    deviceId: journal.deviceId,
    operations: journal.operations,
    attachments: journal.attachments,
    syncedAt: now.toISOString(),
  };
}

function saveProfile(draft: AppState, name: string, avatarId: 'sun' | 'moon') {
  const id = draft.sync?.accountId;
  if (!id) throw new Error('演示成员账户未就绪');
  requireSuccess(ensureGiftProfile(draft, { id, name }));
  requireSuccess(
    updateLocalProfile(draft, {
      id,
      name,
      avatar: { kind: 'preset', id: avatarId },
    }),
  );
}

function activeMember(now: Date): GroupPeer {
  const clock = peerClock(now, 'demo-peer-account', 'demo-peer-device1');
  const peer = applyPeer(
    initializeSync(createInitialState(now), clock),
    clock,
    (draft) => {
      saveProfile(draft, '演示成员', 'sun');
      requireSuccess(joinGroup(draft, DEMO_INVITE));
      requireSuccess(
        updateSettings(draft, { threshold: 1, rewardName: '演示·散步奖励' }),
      );
      requireSuccess(
        addTask(draft, { name: '演示·练琴', target: 3, icon: '🎹' }),
      );
      const piano = draft.tasks[draft.tasks.length - 1];
      requireSuccess(checkIn(draft, 'task-1', dayAt(now, -21)));
      requireSuccess(checkIn(draft, 'task-2', dayAt(now, -14)));
      requireSuccess(checkIn(draft, 'task-1', now));
      requireSuccess(checkIn(draft, piano.id, now));
      requireSuccess(redeemTicket(draft, dayAt(now, -21)));
      const used = requireSuccess(redeemTicket(draft, dayAt(now, -14))).ticket!;
      requireSuccess(
        consumeTicket(draft, used.id, dayAt(now, -14), '演示：周末看电影'),
      );
      requireSuccess(redeemTicket(draft, now));
      const goal = requireSuccess(
        addMilestoneGoal(draft, {
          name: '演示·阅读页',
          unit: '页',
          startWeight: 0,
          step: 20,
          direction: 'increase',
          icon: '📖',
        }),
      ).goal!;
      requireSuccess(recordMilestoneValue(draft, goal.id, 20, dayAt(now, -6)));
      requireSuccess(recordMilestoneValue(draft, goal.id, 40, dayAt(now, -2)));
    },
  );
  return asPeer(peer, now);
}

function departedMember(now: Date): GroupPeer {
  const clock = peerClock(now, 'demo-gone-account', 'demo-gone-device1');
  let peer = applyPeer(
    initializeSync(createInitialState(now), clock),
    clock,
    (draft) => {
      saveProfile(draft, '演示已离开', 'moon');
      requireSuccess(joinGroup(draft, DEMO_INVITE));
      requireSuccess(checkIn(draft, 'task-2', dayAt(now, -1)));
    },
  );
  peer = applyPeer(peer, clock, (draft) => {
    requireSuccess(leaveGroup(draft));
  });
  return asPeer(peer, now);
}
