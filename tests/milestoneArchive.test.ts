import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addMilestoneGoal,
  archiveMilestoneGoal,
  configureMilestoneGoal,
  configureWeightGoal,
  createInitialState,
  deleteMilestoneGoal,
  disableWeightGoal,
  migrateState,
  recordMilestoneValue,
  recordWeight,
  restoreMilestoneGoal,
  setMilestoneEnabled,
  updateMilestoneGoal,
  updateMilestoneIcon,
  useTicket,
} from '../src/domain/engine';
import { createAppStore } from '../src/state/store';
import { initializeSync } from '../src/domain/syncModel';
import type {
  AppState,
  MilestoneGoal,
  MilestoneInput,
} from '../src/domain/types';

const NOW = new Date(2026, 9, 19, 10);
const RULE: MilestoneInput = {
  name: '阅读',
  unit: '页',
  direction: 'increase',
  step: 10,
  startWeight: 0,
  icon: '📖',
};
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

for (const legacy of [true, false]) {
  for (const enabled of [true, false]) {
    test(`${legacy ? '旧目标' : '独立目标'}归档恢复保留${enabled ? '进行' : '暂停'}状态与首达券`, () => {
      const state = createInitialState();
      assert.equal(addMilestoneGoal(state, RULE).ok, true);
      const goal = legacy
        ? state.weight
        : addMilestoneGoal(state, { ...RULE, name: '第二目标' }).goal!;
      assert.deepEqual(
        recordMilestoneValue(state, goal.id, 20, NOW).milestones,
        [10, 20],
      );
      assert.equal(
        useTicket(
          state,
          state.tickets.find((ticket) => ticket.goalId === goal.id)!.id,
          NOW,
          '喝咖啡',
        ).ok,
        true,
      );
      if (!enabled)
        assert.equal(setMilestoneEnabled(state, goal.id, false).ok, true);
      const entries = clone(goal.entries);
      const milestones = clone(goal.unlockedMilestones);
      const tickets = clone(state.tickets);
      assert.equal(archiveMilestoneGoal(state, goal.id).ok, true);
      assert.equal(goal.enabled, enabled);
      assert.equal(goal.archived, true);
      assert.equal(archiveMilestoneGoal(state, goal.id).ok, false);
      const archived = JSON.stringify(state);
      for (const result of [
        recordMilestoneValue(state, goal.id, 30, NOW),
        updateMilestoneGoal(state, goal.id, RULE),
        updateMilestoneIcon(state, goal.id, '⭐'),
        setMilestoneEnabled(state, goal.id, !enabled),
        ...(legacy
          ? [
              configureMilestoneGoal(state, RULE),
              configureWeightGoal(state, 130),
              disableWeightGoal(state),
              recordWeight(state, 30, NOW),
            ]
          : []),
      ])
        assert.equal(result.ok, false);
      assert.equal(JSON.stringify(state), archived);
      assert.deepEqual(migrateState(state), state);
      assert.equal(restoreMilestoneGoal(state, goal.id).ok, true);
      assert.equal(restoreMilestoneGoal(state, goal.id).ok, false);
      assert.equal(goal.enabled, enabled);
      assert.equal(goal.archived, false);
      assert.deepEqual(goal.entries, entries);
      assert.deepEqual(goal.unlockedMilestones, milestones);
      assert.deepEqual(state.tickets, tickets);
      if (!enabled) {
        assert.equal(recordMilestoneValue(state, goal.id, 30, NOW).ok, false);
        assert.equal(setMilestoneEnabled(state, goal.id, true).ok, true);
      }
      assert.deepEqual(
        recordMilestoneValue(state, goal.id, 10, NOW).milestones,
        [],
      );
      assert.deepEqual(
        recordMilestoneValue(state, goal.id, 20, NOW).milestones,
        [],
      );
      assert.deepEqual(
        recordMilestoneValue(state, goal.id, 30, NOW).milestones,
        [30],
      );
      assert.equal(state.tickets.length, tickets.length + 1);
    });
  }
}

test('归档后删除只保留墓碑与奖券，不能恢复或重复归档，未配置目标不能归档', () => {
  const state = createInitialState();
  assert.equal(archiveMilestoneGoal(state, state.weight.id).ok, false);
  assert.equal(restoreMilestoneGoal(state, state.weight.id).ok, false);
  assert.equal(archiveMilestoneGoal(state, 'missing').ok, false);
  for (let index = 0; index < 2; index += 1) {
    const goal = addMilestoneGoal(state, RULE).goal!;
    recordMilestoneValue(state, goal.id, 20, NOW);
    archiveMilestoneGoal(state, goal.id);
    assert.equal(deleteMilestoneGoal(state, goal.id).ok, true);
    assert.equal(goal.deleted, true);
    assert.equal(goal.enabled, false);
    assert.equal(restoreMilestoneGoal(state, goal.id).ok, false);
    assert.equal(archiveMilestoneGoal(state, goal.id).ok, false);
    assert.equal(recordMilestoneValue(state, goal.id, 30, NOW).ok, false);
  }
  assert.equal(state.tickets.length, 4);
  assert.deepEqual(migrateState(state), state);
});

test('旧暂停存档保持暂停不自动归档，归档字段严格校验且未配置不可归档', () => {
  const state = createInitialState();
  configureMilestoneGoal(state, RULE);
  setMilestoneEnabled(state, state.weight.id, false);
  const restored = migrateState(state);
  assert.equal(restored.weight.enabled, false);
  assert.equal(restored.weight.archived, undefined);
  const extra = addMilestoneGoal(state, RULE).goal!;
  for (const archived of ['true', 1, null]) {
    const invalid = clone(state);
    Object.assign(
      invalid.milestoneGoals.find((goal) => goal.id === extra.id)!,
      { archived },
    );
    assert.throws(() => migrateState(invalid), /本地数据格式无效/);
  }
  for (const archived of ['true', 1, null]) {
    const invalid = clone(state);
    Object.assign(invalid.weight, { archived });
    assert.throws(() => migrateState(invalid), /本地数据格式无效/);
  }
  const unconfigured = createInitialState();
  unconfigured.weight.archived = true;
  assert.throws(() => migrateState(unconfigured), /本地数据格式无效/);
  for (const archived of [true, false]) {
    const valid = clone(state);
    valid.weight.archived = archived;
    assert.deepEqual(migrateState(valid), valid);
  }
});

test('归档与恢复保存失败不改变可见目标状态，重试只发布持久化成功结果', async () => {
  let saved: AppState = createInitialState();
  configureMilestoneGoal(saved, RULE);
  recordWeight(saved, 20, NOW);
  saved = initializeSync(saved);
  let fail = true;
  const store = createAppStore({
    load: async () => clone(saved),
    save: async (state) => {
      if (fail) throw new Error('保存不可用');
      saved = clone(state);
    },
  });
  await store.initialize();
  const id = saved.weight.id;
  const visible = store.getSnapshot().state;
  assert.equal(
    (await store.run((state) => archiveMilestoneGoal(state, id))).ok,
    false,
  );
  assert.equal(store.getSnapshot().state, visible);
  fail = false;
  assert.equal(
    (await store.run((state) => archiveMilestoneGoal(state, id))).ok,
    true,
  );
  const archived = store.getSnapshot().state;
  fail = true;
  assert.equal(
    (await store.run((state) => restoreMilestoneGoal(state, id))).ok,
    false,
  );
  assert.equal(store.getSnapshot().state, archived);
  assert.equal(saved.weight.archived, true);
  fail = false;
  assert.equal(
    (await store.run((state) => restoreMilestoneGoal(state, id))).ok,
    true,
  );
  const goal: MilestoneGoal = store.getSnapshot().state!.weight;
  assert.equal(goal.archived, false);
  assert.equal(goal.enabled, true);
  assert.deepEqual(goal.unlockedMilestones, [10, 20]);
  assert.equal(store.getSnapshot().state!.tickets.length, 2);
  const reloaded = createAppStore({
    load: async () => clone(saved),
    save: async () => {
      throw new Error('已存在存档不应被初始化覆盖');
    },
  });
  await reloaded.initialize();
  assert.deepEqual(reloaded.getSnapshot().state, saved);
});
