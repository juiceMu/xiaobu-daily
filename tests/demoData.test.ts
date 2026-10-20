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
  weekKey,
  type PersistedAppState,
} from '../src/domain/engine';
import { hasDemoHistory, seedDemoHistory } from '../src/domain/demoData';
import { initializeSync, validateSync } from '../src/domain/syncModel';
import { createAppStore } from '../src/state/store';

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
