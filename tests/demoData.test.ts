import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addMilestoneGoal,
  addTask,
  checkIn,
  createInitialState,
  dateKey,
  ensureGiftProfile,
  getTicketStatus,
  getWeekStats,
  migrateState,
  redeemTicket,
  updateTask,
  weekKey,
  type PersistedAppState,
} from '../src/domain/engine';
import {
  hasCompanionDemoHistory,
  hasDemoHistory,
  seedCompanionDemoHistory,
  seedDemoHistory,
  hasGroupActivityDemoHistory,
  seedGroupActivityDemoHistory,
} from '../src/domain/demoData';
import {
  exportAccountJournal,
  initializeSync,
  validateSync,
} from '../src/domain/syncModel';
import { createAppStore } from '../src/state/store';
import { populateDemoHistory } from '../src/state/demoHistory';
import {
  createGroup,
  exportInvite,
  joinGroup,
  peerBoards,
} from '../src/domain/groupSync';
import { getGroupActivity } from '../src/domain/groupActivity';

const NOW = new Date(2026, 9, 20, 12);
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

test('演示历史覆盖四周、奖券三状态及三来源、里程碑生命周期和离线赠券回执，存档可重载', () => {
  const state = createInitialState(NOW);
  assert.equal(seedDemoHistory(state, NOW).ok, true);
  assert.deepEqual(migrateState(state), state);
  assert.equal(new Set(state.checkins.map((item) => item.week)).size, 4);
  assert.ok(state.checkins.every((item) => item.date <= dateKey(NOW)));
  assert.ok(getWeekStats(state, NOW).redeemable >= 1);
  assert.deepEqual(
    [
      ...new Set(
        state.tickets.map((ticket) => getTicketStatus(ticket, state, NOW)),
      ),
    ].sort(),
    ['available', 'expired', 'used'],
  );
  assert.equal(
    new Set(
      state.tickets
        .filter((ticket) => ticket.usedAt)
        .map((ticket) => weekKey(ticket.usedAt!)),
    ).size,
    3,
  );
  for (const source of ['checkin', 'weight', 'gift'])
    assert.ok(
      state.tickets.some((ticket) => (ticket.source ?? 'checkin') === source),
    );
  const goals = [state.weight, ...state.milestoneGoals];
  assert.ok(goals.some((goal) => goal.enabled && !goal.archived));
  assert.ok(goals.some((goal) => !goal.enabled && !goal.archived));
  assert.ok(goals.some((goal) => goal.archived));
  assert.ok(
    goals.every(
      (goal) =>
        goal.entries.length === 4 && goal.unlockedMilestones.length === 4,
    ),
  );
  assert.ok(state.tasks.some((task) => task.archived));
  assert.equal(state.giftState?.outgoing.length, 2);
  assert.equal(state.giftState?.received.length, 4);
  assert.equal(state.giftState?.receipts.length, 1);
  assert.ok(
    state.giftState?.received.every(
      (receipt) => receipt.gift.issuer.name === '演示好友',
    ),
  );
});

test('追加不替换已有任务、资料、规则、里程碑或同步身份，重复点击和无效时钟不变异', () => {
  const state = initializeSync(createInitialState(NOW));
  assert.equal(
    ensureGiftProfile(state, { id: state.sync.accountId, name: '原始昵称' }).ok,
    true,
  );
  assert.equal(
    addMilestoneGoal(state, {
      name: '已有目标',
      unit: '页',
      direction: 'increase',
      startWeight: 0,
      step: 10,
    }).ok,
    true,
  );
  assert.equal(checkIn(state, state.tasks[0].id, NOW).ok, true);
  state.settings.threshold = 7;
  state.settings.expiryEnabled = false;
  const before = copy(state);
  assert.equal(seedDemoHistory(state, NOW).ok, true);
  assert.deepEqual(state.tasks.slice(0, before.tasks.length), before.tasks);
  assert.deepEqual(
    state.checkins.slice(0, before.checkins.length),
    before.checkins,
  );
  assert.deepEqual(state.weight, before.weight);
  assert.deepEqual(state.settings, before.settings);
  assert.deepEqual(state.giftState?.profile, before.giftState?.profile);
  assert.deepEqual(state.sync, before.sync);
  assert.ok(getWeekStats(state, NOW).redeemable >= 1);
  const after = copy(state);
  assert.equal(hasDemoHistory(state), true);
  assert.equal(seedDemoHistory(state, NOW).ok, false);
  assert.deepEqual(state, after);
  const blank = createInitialState(NOW);
  const original = copy(blank);
  assert.equal(seedDemoHistory(blank, new Date(NaN)).ok, false);
  assert.deepEqual(blank, original);
});

test('周一、跨年和最高兑换门槛仍无未来记录、保留规则并产生可兑换余额', () => {
  for (const now of [new Date(2026, 0, 1, 0), new Date(2026, 9, 19, 0)]) {
    const state = createInitialState(now);
    state.settings.threshold = 999;
    assert.equal(seedDemoHistory(state, now).ok, true);
    assert.equal(state.settings.threshold, 999);
    assert.ok(getWeekStats(state, now).redeemable >= 1);
    assert.ok(state.checkins.length < 2100);
    assert.ok(state.checkins.every((item) => item.date <= dateKey(now)));
    assert.ok(
      state.tickets.every(
        (item) => Date.parse(item.createdAt) <= now.getTime(),
      ),
    );
    migrateState(state);
  }
});

test('已有高额可兑换余额不被演示兑换消耗，样例只消费自身新增的打卡额度', () => {
  const state = createInitialState(NOW);
  state.settings.threshold = 999;
  for (let index = 0; index < 11; index += 1) {
    assert.equal(
      addTask(state, { name: `已有任务${index}`, target: 99 }).ok,
      true,
    );
    const task = state.tasks.at(-1)!;
    const count = index === 10 ? 10 : 99;
    for (let entry = 0; entry < count; entry += 1)
      assert.equal(checkIn(state, task.id, NOW).ok, true);
  }
  const before = getWeekStats(state, NOW).available;
  const countBefore = state.checkins.length;
  assert.equal(before, 1000);
  assert.equal(seedDemoHistory(state, NOW).ok, true);
  assert.ok(getWeekStats(state, NOW).available >= before + 999);
  assert.ok(state.checkins.length - countBefore < 2100);
  migrateState(state);
});

test('通过存储事务提交演示历史后同步校验通过，失败重试原子保留原状态与outbox', async () => {
  const initial = initializeSync(createInitialState(NOW));
  let saved: PersistedAppState = initial;
  let reject = true;
  const store = createAppStore({
    load: async () => copy(saved),
    save: async (state) => {
      if (reject) throw new Error('演示写入失败');
      saved = copy(state);
    },
  });
  await store.initialize();
  const before = copy(store.getSnapshot().state!);
  assert.equal(
    (await store.run((state) => seedDemoHistory(state, NOW))).ok,
    false,
  );
  assert.deepEqual(store.getSnapshot().state, before);
  assert.equal(hasDemoHistory(saved), false);
  reject = false;
  assert.equal(
    (await store.run((state) => seedDemoHistory(state, NOW))).ok,
    true,
  );
  validateSync(saved);
  const added = saved.sync.outbox.slice(before.sync.outbox.length);
  assert.ok(added.length > 0);
  assert.equal(
    new Set(added.map((operation) => operation.transactionId)).size,
    1,
  );
  assert.ok(
    added.every((operation) => operation.accountId === initial.sync.accountId),
  );
  const reloaded = createAppStore({
    load: async () => copy(saved),
    save: async () => {},
  });
  await reloaded.initialize();
  assert.equal(reloaded.getSnapshot().error, null);
  assert.equal(hasDemoHistory(reloaded.getSnapshot().state!), true);
  const last = copy(saved);
  assert.equal(
    (await store.run((state) => seedDemoHistory(state, NOW))).ok,
    false,
  );
  assert.deepEqual(saved, last);
});

test('同行券演示经两次事务形成可用、已使用和已过期三状态，保留原余额及设置', async () => {
  let saved = initializeSync(createInitialState(NOW));
  const store = createAppStore({
    load: async () => copy(saved),
    save: async (state) => {
      saved = copy(state);
    },
  });
  await store.initialize();
  assert.equal(
    (await store.run((state) => seedDemoHistory(state, NOW))).ok,
    true,
  );
  const before = copy(saved);
  for (let round = 0; round < 2; round += 1) {
    const result = await store.run((state) =>
      seedCompanionDemoHistory(state, NOW),
    );
    assert.equal(result.ok, true, result.message);
    validateSync(saved);
  }
  assert.equal(hasCompanionDemoHistory(saved), true);
  const tickets = saved.tickets.filter(
    (ticket) => ticket.source === 'companion',
  );
  assert.equal(tickets.length, 3);
  assert.deepEqual(
    tickets.map((ticket) => getTicketStatus(ticket, saved, NOW)).sort(),
    ['available', 'expired', 'used'],
  );
  const used = tickets.find((ticket) => ticket.usedAt)!;
  assert.equal(used.companionUses?.[0].stage, 'completed');
  assert.equal(used.companionUses?.[0].mainName, '演示同行伙伴');
  assert.match(used.usageNote!, /演示.*里程碑/);
  assert.deepEqual(saved.settings, before.settings);
  assert.equal(
    getWeekStats(saved, NOW).available,
    getWeekStats(before, NOW).available,
  );
  assert.deepEqual(
    saved.tickets.slice(0, before.tickets.length),
    before.tickets,
  );
  const complete = copy(saved);
  assert.equal(
    (await store.run((state) => seedCompanionDemoHistory(state, NOW))).ok,
    false,
  );
  assert.deepEqual(saved, complete);
});

test('同行演示第二阶段保存失败保留已确认状态，隔日重载仍按原提交时间恢复', async () => {
  let saved = initializeSync(createInitialState(NOW));
  let reject = false;
  const repository = {
    load: async () => copy(saved),
    save: async (state: PersistedAppState) => {
      if (reject) throw new Error('演示保存失败');
      saved = copy(state);
    },
  };
  let store = createAppStore(repository);
  await store.initialize();
  assert.equal(
    (await store.run((state) => seedDemoHistory(state, NOW))).ok,
    true,
  );
  assert.equal(
    (await store.run((state) => seedCompanionDemoHistory(state, NOW))).ok,
    true,
  );
  const confirmed = copy(saved);
  reject = true;
  assert.equal(
    (await store.run((state) => seedCompanionDemoHistory(state, NOW))).ok,
    false,
  );
  assert.deepEqual(saved, confirmed);
  reject = false;
  store = createAppStore(repository);
  await store.initialize();
  const tomorrow = new Date(NOW.getTime() + 24 * 60 * 60 * 1000);
  const result = await store.run((state) =>
    seedCompanionDemoHistory(state, tomorrow),
  );
  assert.equal(result.ok, true, result.message);
  assert.equal(hasCompanionDemoHistory(saved), true);
  const used = saved.tickets.find(
    (ticket) => ticket.source === 'companion' && ticket.usedAt,
  )!;
  assert.equal(used.usedAt, used.companionUses![0].createdAt);
  validateSync(saved);
});

test('预览入口为已有演示补齐同行券，重复调用不写入；真实小组不加入虚构伙伴', async () => {
  for (const realGroup of [false, true]) {
    let saved = initializeSync(createInitialState(NOW));
    const store = createAppStore({
      load: async () => copy(saved),
      save: async (next) => {
        saved = copy(next);
      },
    });
    await store.initialize();
    if (realGroup) {
      assert.equal(
        (
          await store.run((draft) =>
            createGroup(draft, '真实小组', {
              groupId: 'real-group-test',
              secret: 'real-secret-test',
            }),
          )
        ).ok,
        true,
      );
    }
    assert.equal(
      (await store.run((draft) => seedDemoHistory(draft, NOW))).ok,
      true,
    );
    const previousGroup = copy(saved.groupLink);
    const result = await populateDemoHistory(
      store.run,
      () => store.getSnapshot().state,
      NOW,
    );
    assert.equal(result.ok, true, result.message);
    assert.equal(hasCompanionDemoHistory(saved), !realGroup);
    assert.deepEqual(saved.groupLink, previousGroup);
    if (realGroup) {
      assert.equal(saved.groupPeers?.length ?? 0, 0);
      assert.equal(
        (await store.run((draft) => seedCompanionDemoHistory(draft, NOW))).ok,
        false,
      );
    }
    const before = copy(saved);
    assert.equal(
      (
        await populateDemoHistory(
          store.run,
          () => store.getSnapshot().state,
          NOW,
        )
      ).ok,
      true,
    );
    assert.deepEqual(saved, before);
    validateSync(saved);
  }
});

test('非演示组已有合法成员副本时，首次个人演示保留组和副本，重载后重复无保存或新outbox', async () => {
  function harness(prefix: string) {
    let nextId = 0;
    let writes = 0;
    const clock = {
      now: () => NOW,
      id: () => `${prefix}-${++nextId}`,
    };
    let saved = initializeSync(createInitialState(NOW), clock);
    const repository = {
      load: async () => copy(saved),
      save: async (next: PersistedAppState) => {
        validateSync(next);
        writes += 1;
        saved = copy(next);
      },
    };
    return {
      store: createAppStore(repository, clock),
      reload: () => createAppStore(repository, clock),
      get saved() {
        return saved;
      },
      get writes() {
        return writes;
      },
    };
  }
  const local = harness('demo-protected-local');
  const remote = harness('demo-protected-member');
  await local.store.initialize();
  await remote.store.initialize();
  assert.equal(
    (
      await local.store.run((draft) =>
        ensureGiftProfile(draft, {
          id: draft.sync!.accountId,
          name: '已有本机资料',
        }),
      )
    ).ok,
    true,
  );
  assert.equal(
    (
      await local.store.run((draft) =>
        createGroup(draft, '已有成员的测试小组', {
          groupId: 'demo-protection-nondemo-group',
          secret: 'demo-protection-test-only-secret',
        }),
      )
    ).ok,
    true,
  );
  assert.equal(
    (await local.store.run((draft) => checkIn(draft, 'task-1', NOW))).ok,
    true,
  );
  assert.equal(
    (
      await local.store.run((draft) =>
        addMilestoneGoal(draft, {
          name: '已有本机目标',
          unit: '页',
          direction: 'increase',
          startWeight: 0,
          step: 10,
        }),
      )
    ).ok,
    true,
  );
  assert.equal(
    (
      await remote.store.run((draft) =>
        joinGroup(draft, exportInvite(local.saved)),
      )
    ).ok,
    true,
  );
  assert.equal(
    (
      await remote.store.run((draft) =>
        ensureGiftProfile(draft, {
          id: draft.sync!.accountId,
          name: '已有真实成员',
        }),
      )
    ).ok,
    true,
  );
  assert.equal(
    (
      await remote.store.run((draft) =>
        updateTask(draft, 'task-1', { name: '已有成员任务', target: 3 }),
      )
    ).ok,
    true,
  );
  for (let index = 0; index < 3; index += 1)
    assert.equal(
      (await remote.store.run((draft) => checkIn(draft, 'task-1', NOW))).ok,
      true,
    );
  assert.equal(
    (await remote.store.run((draft) => redeemTicket(draft, NOW))).ok,
    true,
  );
  const applied = await local.store.applyGroupJournals(
    [exportAccountJournal(remote.saved)],
    NOW.toISOString(),
  );
  assert.equal(applied.ok, true, applied.message);
  assert.equal(applied.persisted, true);
  const before = copy(local.saved);
  const peersBefore = JSON.stringify(before.groupPeers);
  assert.equal(before.groupPeers?.length, 1);
  const boardBefore = peerBoards(before)[0];
  assert.equal(boardBefore.name, '已有真实成员');
  assert.equal(boardBefore.app.checkins.length, 3);
  assert.equal(boardBefore.app.tickets.length, 1);
  assert.equal(hasDemoHistory(before), false);
  const writesBefore = local.writes;
  const first = await populateDemoHistory(
    local.store.run,
    () => local.store.getSnapshot().state,
    NOW,
  );
  assert.equal(first.ok, true, first.message);
  assert.match(first.message, /已保留原有小组/);
  assert.equal(local.writes - writesBefore, 1);
  assert.equal(hasDemoHistory(local.saved), true);
  assert.equal(hasCompanionDemoHistory(local.saved), false);
  assert.equal(local.saved.sync.accountId, before.sync.accountId);
  assert.equal(local.saved.sync.deviceId, before.sync.deviceId);
  assert.deepEqual(local.saved.groupLink, before.groupLink);
  assert.deepEqual(local.saved.groupOwned, before.groupOwned);
  assert.deepEqual(
    local.saved.pendingGroupDeparture,
    before.pendingGroupDeparture,
  );
  assert.equal(JSON.stringify(local.saved.groupPeers), peersBefore);
  assert.deepEqual(peerBoards(local.saved), peerBoards(before));
  assert.deepEqual(
    local.saved.tasks.slice(0, before.tasks.length),
    before.tasks,
  );
  assert.deepEqual(
    local.saved.checkins.slice(0, before.checkins.length),
    before.checkins,
  );
  assert.deepEqual(
    local.saved.tickets.slice(0, before.tickets.length),
    before.tickets,
  );
  assert.deepEqual(local.saved.settings, before.settings);
  assert.deepEqual(local.saved.weight, before.weight);
  assert.deepEqual(
    local.saved.milestoneGoals.slice(0, before.milestoneGoals.length),
    before.milestoneGoals,
  );
  assert.deepEqual(local.saved.giftState?.profile, before.giftState?.profile);
  // 首次添加允许产生自己的演示事务，不能误称整个存档或outbox不变。
  assert.ok(local.saved.sync.outbox.length > before.sync.outbox.length);
  const after = copy(local.saved);
  const writesAfter = local.writes;
  const reloaded = local.reload();
  await reloaded.initialize();
  assert.deepEqual(reloaded.getSnapshot().state, after);
  for (let index = 0; index < 2; index += 1) {
    const repeated = await populateDemoHistory(
      reloaded.run,
      () => reloaded.getSnapshot().state,
      NOW,
    );
    assert.equal(repeated.ok, true, repeated.message);
    assert.equal(local.writes, writesAfter);
    assert.deepEqual(local.saved.sync.outbox, after.sync.outbox);
    assert.deepEqual(local.saved, after);
  }
  validateSync(local.saved);
});

test('旧演示跨周补齐本人任务与多人排行，延长成员日志且重复无写入', async () => {
  let saved = initializeSync(createInitialState(NOW));
  let writes = 0;
  const store = createAppStore({
    load: async () => copy(saved),
    save: async (state) => {
      writes += 1;
      saved = copy(state);
    },
  });
  await store.initialize();
  assert.equal(
    (await store.run((draft) => seedDemoHistory(draft, NOW))).ok,
    true,
  );
  for (let index = 0; index < 2; index += 1)
    assert.equal(
      (await store.run((draft) => seedCompanionDemoHistory(draft, NOW))).ok,
      true,
    );
  const before = copy(saved);
  const previewAt = new Date(2026, 10, 4, 12);
  const result = await populateDemoHistory(
    store.run,
    () => store.getSnapshot().state,
    previewAt,
  );
  assert.equal(result.ok, true, result.message);
  assert.equal(hasGroupActivityDemoHistory(saved, previewAt), true);
  assert.equal(getWeekStats(before, previewAt).total, 0);
  assert.equal(getWeekStats(saved, previewAt).total, 12);
  assert.equal(getWeekStats(saved, previewAt).available, 12);
  assert.deepEqual(saved.settings, before.settings);
  assert.deepEqual(saved.giftState?.profile, before.giftState?.profile);
  assert.deepEqual(saved.tasks.slice(0, before.tasks.length), before.tasks);
  assert.deepEqual(
    saved.checkins.slice(0, before.checkins.length),
    before.checkins,
  );
  assert.deepEqual(saved.tickets, before.tickets);
  assert.deepEqual(saved.redemptions, before.redemptions);
  for (const peer of before.groupPeers ?? []) {
    const extended = saved.groupPeers!.find(
      (entry) => entry.accountId === peer.accountId,
    )!;
    assert.deepEqual(
      extended.operations.slice(0, peer.operations.length),
      peer.operations,
    );
  }
  const boards = peerBoards(saved);
  const activity = getGroupActivity(saved, boards, previewAt);
  assert.equal(activity.rankings.length, 5);
  assert.ok(activity.rankings.some((member) => member.count === 0));
  assert.ok(
    activity.rankings.every((member) => !member.name.includes('已离开')),
  );
  assert.ok(activity.timeline.length > 30);
  assert.ok(new Set(activity.timeline.map((entry) => entry.date)).size > 1);
  assert.ok(
    new Set(activity.timeline.map((entry) => entry.createdAt)).size > 3,
  );
  assert.ok(
    activity.timeline.every(
      (entry) => Date.parse(entry.createdAt) <= previewAt.getTime(),
    ),
  );
  const lastWeek = new Date(2026, 9, 28, 12);
  assert.ok(getGroupActivity(saved, boards, lastWeek).timeline.length > 0);
  validateSync(saved);
  const complete = copy(saved);
  const previousWrites = writes;
  assert.equal(
    (
      await populateDemoHistory(
        store.run,
        () => store.getSnapshot().state,
        previewAt,
      )
    ).ok,
    true,
  );
  assert.equal(writes, previousWrites);
  assert.deepEqual(saved, complete);
});

test('小组动态演示保存失败原子保留，重试与新周凌晨追加不造未来记录', async () => {
  let saved = initializeSync(createInitialState(NOW));
  let reject = false;
  const store = createAppStore({
    load: async () => copy(saved),
    save: async (state) => {
      if (reject) throw new Error('演示动态保存失败');
      saved = copy(state);
    },
  });
  await store.initialize();
  assert.equal(
    (await populateDemoHistory(store.run, () => store.getSnapshot().state, NOW))
      .ok,
    true,
  );
  const before = copy(saved);
  const monday = new Date(2026, 10, 2, 0);
  reject = true;
  assert.equal(
    (
      await populateDemoHistory(
        store.run,
        () => store.getSnapshot().state,
        monday,
      )
    ).ok,
    false,
  );
  assert.deepEqual(saved, before);
  assert.deepEqual(store.getSnapshot().state, before);
  reject = false;
  assert.equal(
    (
      await populateDemoHistory(
        store.run,
        () => store.getSnapshot().state,
        monday,
      )
    ).ok,
    true,
  );
  assert.equal(getWeekStats(saved, monday).total, 4);
  const activity = getGroupActivity(saved, peerBoards(saved), monday);
  assert.ok(
    activity.timeline.every(
      (entry) => Date.parse(entry.createdAt) <= monday.getTime(),
    ),
  );
  assert.ok(activity.timeline.every((entry) => entry.date <= dateKey(monday)));
  validateSync(saved);
});

test('小组动态演示拒绝真实小组和演示ID碰撞，非法时钟不变异', () => {
  for (const groupId of ['real-group-test', 'demo-group-0001']) {
    const state = initializeSync(createInitialState(NOW));
    assert.equal(
      createGroup(state, '真实小组', { groupId, secret: 'real-secret-test' })
        .ok,
      true,
    );
    assert.equal(seedDemoHistory(state, NOW).ok, true);
    const before = copy(state);
    assert.equal(seedGroupActivityDemoHistory(state, NOW).ok, false);
    assert.deepEqual(state, before);
  }
  const state = initializeSync(createInitialState(NOW));
  assert.equal(seedDemoHistory(state, NOW).ok, true);
  const before = copy(state);
  assert.equal(seedGroupActivityDemoHistory(state, new Date(NaN)).ok, false);
  assert.deepEqual(state, before);
});
