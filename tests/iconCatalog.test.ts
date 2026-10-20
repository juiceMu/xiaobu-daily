import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ICON_KEYS, ICON_OPTIONS } from '../src/domain/iconCatalog.mjs';
import {
  addMilestoneGoal,
  addTask,
  createInitialState,
  migrateState,
  recordMilestoneValue,
  updateMilestoneIcon,
  updateTask,
} from '../src/domain/engine';

test('48个精选图标全部存在于已安装图标库，旧存储键保留且领域共用目录', () => {
  const glyphs = JSON.parse(
    readFileSync(
      new URL(
        '../node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialCommunityIcons.json',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  assert.equal(ICON_OPTIONS.length, 48);
  assert.equal(new Set(ICON_KEYS).size, 48);
  assert.deepEqual(ICON_KEYS.slice(0, 16), [
    '🌱',
    '📖',
    '🏃',
    '⚖️',
    '💧',
    '🎓',
    '💰',
    '🚴',
    '🧘',
    '🎨',
    '🎵',
    '🥗',
    '🌙',
    '✍️',
    '🏊',
    '⭐',
  ]);
  for (const [, name, label] of ICON_OPTIONS) {
    assert.ok(Object.hasOwn(glyphs, name), `${label}缺少图标${name}`);
  }
  assert.equal(ICON_OPTIONS.find(([key]) => key === '🌙')?.[1], 'bed-outline');
  assert.equal(ICON_OPTIONS.find(([key]) => key === '🌙')?.[2], '睡眠');
});

test('新增图标可保存任务、编辑任务并完整重载', () => {
  const state = createInitialState();
  assert.equal(
    addTask(state, { name: '遛狗', target: 1, icon: '🐕' }).ok,
    true,
  );
  const task = state.tasks.at(-1)!;
  assert.equal(task.icon, '🐕');
  assert.equal(updateTask(state, task.id, { icon: '🐈' }).ok, true);
  assert.equal(task.icon, '🐈');
  assert.deepEqual(migrateState(JSON.parse(JSON.stringify(state))), state);
});

test('新增图标可配置里程碑、随券发放并同步历史券，非法图标仍原子拒绝', () => {
  const state = createInitialState();
  const rule = {
    name: '力量训练',
    unit: '次',
    startWeight: 0,
    step: 1,
    direction: 'increase' as const,
    icon: '🏋️' as const,
  };
  const result = addMilestoneGoal(state, rule);
  assert.equal(result.ok, true);
  const goal = result.goal!;
  assert.equal(recordMilestoneValue(state, goal.id, 2).ok, true);
  assert.deepEqual(
    state.tickets.map((ticket) => ticket.goalIcon),
    ['🏋️', '🏋️'],
  );
  assert.deepEqual(migrateState(JSON.parse(JSON.stringify(state))), state);
  assert.equal(updateMilestoneIcon(state, goal.id, '🥾').ok, true);
  assert.deepEqual(
    state.tickets.map((ticket) => ticket.goalIcon),
    ['🥾', '🥾'],
  );
  assert.deepEqual(migrateState(JSON.parse(JSON.stringify(state))), state);
  const before = JSON.stringify(state);
  const invalidIcon = 'unknown' as Parameters<typeof updateMilestoneIcon>[2];
  assert.equal(updateMilestoneIcon(state, goal.id, invalidIcon).ok, false);
  assert.equal(
    addMilestoneGoal(state, { ...rule, icon: invalidIcon }).ok,
    false,
  );
  assert.equal(JSON.stringify(state), before);
  const corrupted = JSON.parse(before);
  corrupted.tickets[0].goalIcon = invalidIcon;
  assert.throws(() => migrateState(corrupted), /本地数据格式无效/);
});
