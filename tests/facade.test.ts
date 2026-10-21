import test from 'node:test';
import assert from 'node:assert/strict';
import * as engine from '../src/domain/engine';
import * as legacyEngine from '../src/domain/engineCore.mjs';
import type { AppState, MilestoneGoal } from '../src/domain/engine';

test('TypeScript门面完整导出32项业务API含数字校验，首达跨越和重复不发券保持一致', () => {
  assert.equal(Object.keys(legacyEngine).length, 32);
  for (const [key, value] of Object.entries(legacyEngine))
    assert.equal(
      Object.entries(engine).find(([name]) => name === key)?.[1],
      value,
      key,
    );
  for (const key of [
    'ensureGiftProfile',
    'createGift',
    'exportGift',
    'parseGift',
    'previewGift',
    'receiveGift',
    'recordGiftReceipt',
    'exportGiftReceipt',
    'parseGiftReceipt',
    'validateGiftState',
  ] as const)
    assert.equal(
      typeof Object.entries(engine).find(([name]) => name === key)?.[1],
      'function',
      key,
    );
  assert.equal(
    engine.numericInputError('1e1', 'integer', 1, 99).length > 0,
    true,
  );
  assert.equal(engine.MILESTONE_ICONS.length, 48);
  const state: AppState = engine.createInitialState();
  const result = engine.addMilestoneGoal(state, {
    name: '减重',
    unit: '斤',
    direction: 'decrease',
    startWeight: 130,
    step: 1,
    icon: '⚖️',
  });
  const goal: MilestoneGoal | undefined = result.goal;
  if (!goal) throw new Error('目标添加失败');
  assert.equal(
    engine.recordMilestoneValue(state, goal.id, 110).milestones?.length,
    20,
  );
  assert.equal(
    engine.recordMilestoneValue(state, goal.id, 110).milestones?.length,
    0,
  );
  assert.equal(state.tickets.length, 20);
});
