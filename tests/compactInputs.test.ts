import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const read = (file: string) =>
  readFileSync(new URL(file, import.meta.url), 'utf8');
test('共享输入文字与占位符同为14，单行44起随字体扩大，多行不固定高度', () => {
  const source = read('../src/ui/AppTextInput.tsx');
  assert.ok(source.includes('fontSize: 14, lineHeight: 20'));
  assert.ok(source.includes('!props.multiline && { height: inputHeight }'));
  assert.ok(source.includes('label={undefined}'));
  assert.ok(source.includes('fontSize: 12'));
  assert.equal(source.includes('allowFontScaling={false}'), false);
  const ast = ts.createSourceFile(
    'input.tsx',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  let expression = '';
  function visit(node: ts.Node) {
    if (
      ts.isVariableDeclaration(node) &&
      node.name.getText(ast) === 'inputHeight'
    )
      expression = node.initializer!.getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  const height = new Function('fontScale', 'return ' + expression) as (
    scale: number,
  ) => number;
  assert.equal(height(1), 44);
  assert.ok(height(2) >= 60);
  assert.ok(height(3) >= 80);
  assert.ok(
    source.includes(
      '!props.multiline && { paddingTop: 10, paddingBottom: 10 }',
    ),
  );
  for (const scale of [1, 1.5, 2, 3]) {
    assert.ok(height(scale) - 10 - 10 >= 20 * scale);
  }
  for (const file of [
    'TodayScreen',
    'TicketsScreen',
    'MilestonesScreen',
    'MoreScreens',
  ]) {
    const text = read('../src/screens/' + file + '.tsx');
    assert.equal(text.includes('contentStyle={{ fontSize: 16 }}'), false);
    assert.equal(text.includes("fontSize: Platform.OS === 'web' ? 16"), false);
  }
  const milestones = read('../src/screens/MilestonesScreen.tsx');
  assert.equal(milestones.includes('<Searchbar'), false);
  assert.ok(milestones.includes('icon="magnify"'));
  assert.ok(milestones.includes('accessibilityLabel="聚焦搜索"'));
  assert.ok(milestones.includes('accessibilityLabel="清除搜索"'));
  assert.ok(milestones.includes('accessibilityRole="search"'));
  assert.ok(milestones.includes('returnKeyType="search"'));
});
test('时间框保持原生和web时间语义，文字14和最小44高度且无边框', () => {
  const web = read('../src/ui/TimeField.web.tsx');
  const native = read('../src/ui/TimeField.tsx');
  for (const source of [web, native]) {
    assert.ok(source.includes('fontSize: 14'));
    assert.ok(source.includes('minHeight: 44'));
    assert.equal(source.includes('allowFontScaling={false}'), false);
  }
  assert.ok(web.includes('type="time"'));
  assert.ok(web.includes('step={60}'));
  assert.ok(web.includes('keyboardFocus.focusVisible'));
  assert.ok(native.includes('formatTime(hour, minute)'));
});
