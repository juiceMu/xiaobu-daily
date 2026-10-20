import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  addTask,
  updateTask,
  updateSettings,
  addMilestoneGoal,
  updateMilestoneGoal,
  recordMilestoneValue,
  configureWeightGoal,
  recordWeight,
  createInitialState,
  numericInputError,
} from '../src/domain/engine';

const invalidIntegers = [
  '',
  '   ',
  '0...',
  '1e1',
  '0x10',
  '+2',
  '-2',
  '2.',
  '2.0',
  '1.5',
  'abc',
  true,
  [2],
  null,
  undefined,
  NaN,
  Infinity,
];
const invalidDecimals = [
  '',
  '   ',
  '0...',
  '1..2',
  '1e2',
  '0x10',
  '+2',
  '-1',
  '2.',
  '1.11',
  '130.00',
  'abc',
  true,
  [2],
  null,
  undefined,
  NaN,
  Infinity,
  0.01,
  1000000.1,
];

test('整数真实业务入口拒绝非法词法与越界，拒绝时不改变状态', () => {
  for (const value of [...invalidIntegers, 0, 1000]) {
    const state = createInitialState();
    const before = structuredClone(state);
    // 通过未受信任运行时输入核查业务边界，而非依靠TS静态类型。
    const input = value as string;
    assert.equal(
      addTask(state, { name: '任务', target: input }).ok,
      false,
      String(value),
    );
    assert.equal(
      updateTask(state, state.tasks[0].id, { target: input }).ok,
      false,
      String(value),
    );
    assert.equal(
      updateSettings(state, { threshold: input }).ok,
      false,
      String(value),
    );
    assert.deepEqual(state, before);
  }
  const state = createInitialState();
  for (const value of [1, 99, ' 2 '])
    assert.equal(
      updateTask(state, state.tasks[0].id, { target: value }).ok,
      true,
    );
  assert.equal(updateTask(state, state.tasks[0].id, { target: 100 }).ok, false);
  for (const value of [1, 999, ' 2 '])
    assert.equal(updateSettings(state, { threshold: value }).ok, true);
  for (const value of [...invalidIntegers, 0, 8]) {
    const before = structuredClone(state);
    assert.equal(
      updateSettings(state, { expiryDay: value as number }).ok,
      false,
      String(value),
    );
    assert.deepEqual(state, before);
  }
});

test('里程碑创建修改记录及兼容体重入口拒绝多点指数精度和越界，草稿不转换', () => {
  const rule = {
    name: '阅读',
    unit: '页',
    direction: 'increase' as const,
    startWeight: 0,
    step: 1,
  };
  for (const value of invalidDecimals) {
    const state = createInitialState();
    const before = structuredClone(state);
    assert.equal(
      addMilestoneGoal(state, { ...rule, startWeight: value as string }).ok,
      false,
      String(value),
    );
    assert.equal(
      addMilestoneGoal(state, { ...rule, step: value as string }).ok,
      false,
      String(value),
    );
    assert.equal(
      configureWeightGoal(state, value as string).ok,
      false,
      String(value),
    );
    assert.deepEqual(state, before);
    const added = addMilestoneGoal(state, rule);
    assert.ok(added.goal);
    const configured = structuredClone(state);
    assert.equal(
      updateMilestoneGoal(state, added.goal.id, {
        ...rule,
        startWeight: value as string,
      }).ok,
      false,
    );
    assert.equal(
      recordMilestoneValue(state, added.goal.id, value as string).ok,
      false,
    );
    assert.equal(recordWeight(state, value as string).ok, false);
    assert.deepEqual(state, configured);
  }
  assert.equal(numericInputError('0', 'decimal', 0, 1000000), '');
  assert.notEqual(numericInputError('0', 'decimal', 0.1, 1000000), '');
  for (const value of ['0.1', 1000000, ' 130.5 '])
    assert.equal(numericInputError(value, 'decimal', 0, 1000000), '');
});

test('五个数字输入复用严格业务规则并提供失焦与提交错误，冗余零点由输入层规范', () => {
  const read = (file: string) =>
    readFileSync(new URL(file, import.meta.url), 'utf8');
  const wrapper = read('../src/ui/AppTextInput.tsx');
  assert.ok(wrapper.includes('numericInputError('));
  assert.ok(wrapper.includes('touched || validationVisible'));
  assert.ok(wrapper.includes('setTouched(true)'));
  assert.ok(wrapper.includes('nativeID={errorId}'));
  assert.ok(wrapper.includes('aria-describedby='));
  assert.ok(wrapper.includes('aria-invalid={!!error}'));
  for (const [file, count] of [
    ['TodayScreen', 1],
    ['MoreScreens', 1],
    ['MilestonesScreen', 3],
  ] as const) {
    const source = read('../src/screens/' + file + '.tsx');
    assert.equal((source.match(/numericRule=/g) || []).length, count);
    assert.equal((source.match(/validationVisible=/g) || []).length, count);
  }
});
