import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createInitialState,
  addMilestoneGoal,
  archiveMilestoneGoal,
  restoreMilestoneGoal,
} from '../src/domain/engine';
import { milestoneGroups, selectMilestone } from '../src/ui/milestoneSelection';

function goals() {
  const state = createInitialState();
  state.weight.deleted = true;
  for (const name of ['阅读', '体重', 'Read More']) {
    assert.equal(
      addMilestoneGoal(state, {
        name,
        unit: '页',
        direction: 'increase',
        startWeight: 0,
        step: 1,
      }).ok,
      true,
    );
  }
  return state;
}

test('暂停目标留在当前列表，只有明确归档才进入已归档', () => {
  const state = goals();
  state.milestoneGoals[0].enabled = false;
  const archived = state.milestoneGoals[1];
  assert.equal(archiveMilestoneGoal(state, archived.id).ok, true);
  const before = JSON.stringify(state);
  const groups = milestoneGroups([state.weight, ...state.milestoneGoals]);
  assert.deepEqual(
    groups.current.map((item) => item.name),
    ['阅读', 'Read More'],
  );
  assert.deepEqual(
    groups.archived.map((item) => item.id),
    [archived.id],
  );
  assert.equal(groups.current[0].enabled, false);
  assert.equal(JSON.stringify(state), before);
});

test('归档选中目标后回退，全归档仍保留归档入口，恢复保留暂停状态', () => {
  const state = goals();
  const first = state.milestoneGoals[0];
  first.enabled = false;
  archiveMilestoneGoal(state, first.id);
  let groups = milestoneGroups(state.milestoneGoals);
  assert.equal(
    selectMilestone(groups.current, first.id).selected?.id,
    state.milestoneGoals[1].id,
  );
  state.milestoneGoals
    .slice(1)
    .forEach((item) => archiveMilestoneGoal(state, item.id));
  groups = milestoneGroups(state.milestoneGoals);
  assert.equal(selectMilestone(groups.current, first.id).selected, undefined);
  assert.equal(groups.archived.length, 3);
  assert.equal(restoreMilestoneGoal(state, first.id).ok, true);
  groups = milestoneGroups(state.milestoneGoals);
  assert.equal(
    selectMilestone(groups.current, first.id).selected?.enabled,
    false,
  );
});

test('页内搜索忽略首尾空格和英文大小写，过滤安全回退且不改变源数据', () => {
  const state = goals();
  const before = JSON.stringify(state.milestoneGoals);
  const result = selectMilestone(
    state.milestoneGoals,
    state.milestoneGoals[0].id,
    ' READ ',
  );
  assert.equal(result.visible.length, 1);
  assert.equal(result.selected?.name, 'Read More');
  assert.equal(
    selectMilestone(state.milestoneGoals, '', '不存在').selected,
    undefined,
  );
  assert.equal(JSON.stringify(state.milestoneGoals), before);
  state.milestoneGoals[0].deleted = true;
  assert.equal(milestoneGroups(state.milestoneGoals).current.length, 2);
});

test('页内横向切换替代选择Modal，归档冻结目标并保留永久奖励入口', () => {
  const source = readFileSync(
    new URL('../src/screens/MilestonesScreen.tsx', import.meta.url),
    'utf8',
  );
  for (const text of [
    'milestone-inline-tabs',
    'ref={tabList}',
    'onScrollToIndexFailed=',
    'scrollToIndex',
    '左右滑动切换',
    '上一个里程碑',
    '下一个里程碑',
    'setArchiving({ id: goal.id, name: goal.name })',
    'archiveMilestoneGoal(draft, archiving.id)',
    'restoreMilestoneGoal(draft, goal.id)',
    'isArchived ? (',
    '继续记录',
    '恢复到当前',
    '已归档 · 归档前',
    '当前目标都已收好',
    'unlockedRewards(goal)',
    '已解锁的永久奖励',
  ])
    assert.ok(source.includes(text), text);
  assert.equal(source.includes('visible={selector}'), false);
  assert.equal(source.includes('setSelector'), false);
});
