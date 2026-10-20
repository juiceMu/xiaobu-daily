import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const milestoneText = readFileSync(
  new URL('../src/screens/MilestonesScreen.tsx', import.meta.url),
  'utf8',
);
const componentText = readFileSync(
  new URL('../src/ui/components.tsx', import.meta.url),
  'utf8',
);
const milestone = ts.createSourceFile(
  'MilestonesScreen.tsx',
  milestoneText,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
function functionSource(name: string) {
  const node = milestone.statements.find(
    (entry) => ts.isFunctionDeclaration(entry) && entry.name?.text === name,
  );
  assert.ok(node, name);
  return node.getText(milestone);
}

test('目标胶囊Web透明ripple去悬停铺底，原生反馈和独立键盘焦点保留', () => {
  const tab = functionSource('MilestoneTab');
  for (const value of [
    "Platform.OS === 'web' ? 'transparent' : undefined",
    'useKeyboardFocus()',
    'onFocus={keyboardFocus.onFocus}',
    'onBlur={keyboardFocus.onBlur}',
    'keyboardFocus.focusVisible ? 2 : 0',
    'minHeight: 48',
    'accessibilityRole="tab"',
    'accessibilityState={{ selected, disabled }}',
    'disabled={disabled}',
    'onPress={onPress}',
  ])
    assert.ok(tab.includes(value), value);
  assert.ok(
    tab.replace(/\s+/g, '').includes('selected?colors.primaryContainer'),
  );
  assert.ok(milestoneText.includes('<MilestoneTab'));
});

test('永久奖励行12号文图24字14上下6，奖励区紧凑标题13并保留导航和触控高度', () => {
  const row = functionSource('RewardRow');
  for (const value of [
    'paddingVertical: 6',
    'gap: 6',
    'width: 24',
    'height: 24',
    'size={14}',
    'fontSize: 12',
    'lineHeight: 18',
    '已发放 · 不重复领取',
  ])
    assert.ok(row.includes(value), value);
  assert.equal(row.includes('fontSize: 14'), false);
  const section = milestoneText.slice(
    milestoneText.indexOf('title="已解锁的永久奖励"'),
    milestoneText.indexOf('{isArchived &&'),
  );
  assert.ok(
    section.includes("fontSize: 13, lineHeight: 20, fontWeight: '500'"),
  );
  assert.ok(section.includes('contentStyle={rewardButtonContent}'));
  assert.ok(section.includes('labelStyle={rewardButtonLabel}'));
  assert.ok(section.includes("navigation.navigate('tickets')"));
  assert.ok(milestoneText.includes('{ padding: 10, gap: 4 }'));
  assert.ok(milestoneText.includes('minHeight: 26'));
  assert.ok(
    milestoneText.includes("marginVertical: Platform.OS === 'web' ? 7 : 11"),
  );
  assert.ok(milestoneText.includes('marginVertical: 4'));
});

test('表单标题安全区内顶部16底部4，固定16标题和小关闭保留，奖励历史同顶部16', () => {
  const modalHeader = componentText.slice(
    componentText.indexOf('modalHeader: {'),
    componentText.indexOf('formContent: {'),
  );
  assert.ok(modalHeader.includes('paddingTop: 16'));
  assert.ok(modalHeader.includes('paddingBottom: 4'));
  assert.ok(componentText.includes('titleStyle?: StyleProp<TextStyle>'));
  assert.ok(componentText.includes('style={[styles.sectionText, titleStyle]}'));
  assert.ok(componentText.includes('accessibilityRole="header"'));
  const history = milestoneText.slice(
    milestoneText.indexOf('visible={historyOpen}'),
    milestoneText.indexOf('<FormModal'),
  );
  assert.ok(history.includes('flex: 1, padding: 16'));
  assert.ok(history.includes('SafeAreaView'));
});
