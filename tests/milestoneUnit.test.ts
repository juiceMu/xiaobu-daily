import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { milestoneUnitError } from '../src/domain/milestoneUnit.mjs';
import {
  addMilestoneGoal,
  createInitialState,
  migrateState,
  recordMilestoneValue,
  updateMilestoneGoal,
} from '../src/domain/engine';

const input = {
  name: '减肥',
  unit: '斤',
  startWeight: '150',
  direction: 'decrease' as const,
  step: '1',
  icon: '🏃' as const,
};

test('数字单位拒绝保存，数值字段与单位保持独立，失败不修改状态', () => {
  for (const unit of ['150', ' 150 ', '０１５０', '1.5', '1,500', '-150']) {
    const state = createInitialState();
    const before = structuredClone(state);
    assert.ok(milestoneUnitError(unit), unit);
    assert.equal(addMilestoneGoal(state, { ...input, unit }).ok, false);
    assert.deepEqual(state, before);
  }
  for (const unit of ['斤', '页', '元', 'km', 'm²', '%', '千克'])
    assert.equal(milestoneUnitError(unit), '', unit);
  const state = createInitialState();
  assert.equal(addMilestoneGoal(state, input).ok, true);
  assert.equal(state.weight.startWeight, 150);
  assert.equal(state.weight.unit, '斤');
});

test('旧数字单位存档仍可读，不猜测改写；无记录目标允许用户纠正', () => {
  const state = createInitialState();
  assert.equal(addMilestoneGoal(state, input).ok, true);
  state.weight.unit = '150';
  state.weight.startWeight = 0;
  const loaded = migrateState(state);
  assert.equal(loaded.weight.startWeight, 0);
  assert.equal(loaded.weight.unit, '150');
  const before = structuredClone(loaded);
  assert.equal(recordMilestoneValue(loaded, loaded.weight.id, '1').ok, false);
  assert.deepEqual(loaded, before);
  assert.equal(updateMilestoneGoal(loaded, loaded.weight.id, input).ok, true);
  assert.equal(loaded.weight.startWeight, 150);
  assert.equal(loaded.weight.unit, '斤');
});

test('里程碑统计数值和单位单独呈现，表单先填写起点并解释单位含义', () => {
  const source = readFileSync(
    new URL('../src/screens/MilestonesScreen.tsx', import.meta.url),
    'utf8',
  );
  assert.ok(source.includes('单位：{goal.unit}'));
  assert.ok(
    source.indexOf('label="起始数值') < source.indexOf('label="计量单位'),
  );
  assert.ok(source.includes('起始数值实际为'));
  assert.ok(source.includes('起始数值填\n                150'));
  assert.ok(source.includes('testID="milestone-start-group"'));
  assert.ok(source.includes('testID="milestone-start-value"'));
  assert.ok(source.includes('testID="milestone-start-unit"'));
  assert.ok(source.includes('label="起始数值（主要填写）"'));
  assert.ok(source.includes('flexBasis: 160'));
  assert.ok(source.includes('flexBasis: 96'));
});
