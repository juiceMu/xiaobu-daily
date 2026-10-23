import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const text = readFileSync(
  new URL('../src/screens/TodayScreen.tsx', import.meta.url),
  'utf8',
);
const source = ts.createSourceFile(
  'TodayScreen.tsx',
  text,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
function element(id: string) {
  let found: ts.JsxElement | undefined;
  function visit(node: ts.Node) {
    if (
      ts.isJsxElement(node) &&
      node.openingElement.attributes.properties.some(
        (prop) =>
          ts.isJsxAttribute(prop) &&
          prop.name.getText(source) === 'testID' &&
          prop.initializer &&
          ts.isStringLiteral(prop.initializer) &&
          prop.initializer.text === id,
      )
    )
      found = node;
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(found, id);
  return found;
}

test('周月日期仅独立32起步浅蓝圆形选中，列透明且不插入勾号', () => {
  for (const id of ['week-date-circle', 'month-date-circle']) {
    const circle = element(id);
    const style = circle.openingElement.getText(source);
    for (const value of [
      'minWidth: 32',
      'minHeight: 32',
      'padding: 4',
      'borderRadius: 999',
      'colors.primaryContainer',
    ])
      assert.ok(style.includes(value), value);
    assert.equal(style.includes('height: 32,'), false);
    assert.equal(circle.getText(source).includes('✓'), false);
    assert.ok(ts.isJsxElement(circle.parent));
    assert.ok(
      circle.parent.openingElement
        .getText(source)
        .includes("backgroundColor: 'transparent'"),
    );
  }
  assert.ok(text.includes('已选'));
  assert.ok(text.includes('disabled={busy || calendar.isFuture}'));
  assert.ok(text.includes('disabled={busy || key > todayKey}'));
});

test('颜色选择使用实际tint圆点、12字和已选文本，触控48且保留禁用与按压反馈', () => {
  const color = element('task-color-option').getText(source);
  for (const value of [
    'tint(color, colors)',
    'width: 24',
    'height: 24',
    'minWidth: 48',
    'minHeight: 48',
    'fontSize: 12',
    '已选',
    'disabled={busy}',
    'pressed',
    'selected: form.color === color',
  ])
    assert.ok(color.includes(value), value);
  assert.equal(color.includes('borderWidth'), false);
});

test('日期前后按钮图标22、触控28并与选日期同行，保留键盘焦点和读屏名称', () => {
  assert.ok(text.includes('const dateNavigationSize = 28'));
  assert.ok(text.includes('const dateNavigationIconSize = 22'));
  assert.ok(text.includes('size={dateNavigationIconSize}'));
  assert.ok(text.includes('weekRangeLabel'));
  assert.ok(text.includes("accessibilityLabel=\"查看上一周\""));
  assert.ok(text.includes('event.preventDefault()'));
  assert.ok(text.includes('changePickedDate'));
  assert.ok(
    text.includes(
      "pressedAction === id ? colors.primaryContainer : 'transparent'",
    ),
  );
  assert.ok(
    text.includes('keyboardFocus.focusVisible && focusedAction === id'),
  );
  for (const id of [
    'previous-week',
    'next-week',
    'previous-month',
    'next-month',
    'previous-year',
    'next-year',
    'previous-years',
    'next-years',
  ])
    assert.ok(text.includes("'" + id + "'"));
  for (const label of [
    '查看上一周',
    '查看下一周',
    '日历上一月',
    '日历下一月',
    '日历上一年',
    '日历下一年',
    '选择月份和年份',
    '选择年份',
  ])
    assert.ok(text.includes("'" + label + "'") || text.includes('"' + label + '"'));
  assert.ok(text.includes("calendarView === 'month'"));
  assert.ok(text.includes("calendarView === 'year'"));
  assert.equal(text.includes('日期（YYYY-MM-DD）'), false);
  assert.equal(text.includes('例如 2026-10-19'), false);
});
