import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// 源码结构回归，不代替浏览器和真机上的焦点、键盘与布局实测。
test('二次确认采用透明居中弹窗，限制宽高并保留滚动和忙碌返回保护', () => {
  const text = readFileSync(
    new URL('../src/ui/ConfirmationDialog.tsx', import.meta.url),
    'utf8',
  );
  const source = ts.createSourceFile(
    'ConfirmationDialog.tsx',
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const modals: ts.JsxOpeningElement[] = [];
  function visit(node: ts.Node) {
    if (
      ts.isJsxOpeningElement(node) &&
      node.tagName.getText(source) === 'Modal'
    )
      modals.push(node);
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.equal(modals.length, 1);
  assert.ok(
    modals[0].attributes.properties.some(
      (property) =>
        ts.isJsxAttribute(property) &&
        property.name.getText(source) === 'transparent' &&
        !property.initializer,
    ),
  );
  assert.match(text, /maxWidth:\s*420/);
  assert.match(text, /maxHeight:\s*['"]90%['"]/);
  assert.match(text, /justifyContent:\s*['"]center['"]/);
  assert.match(text, /if \(!busy\) onDismiss\(\)/);
  assert.match(text, /<ScrollView/);
  assert.match(text, /accessibilityViewIsModal/);
});
test('兑换撤销删除归档和用券确认都复用居中弹窗，不影响真正的编辑表单', () => {
  const shared = readFileSync(
    new URL('../src/screens/shared.tsx', import.meta.url),
    'utf8',
  );
  const tickets = readFileSync(
    new URL('../src/screens/TicketsScreen.tsx', import.meta.url),
    'utf8',
  );
  assert.match(shared, /<ConfirmationDialog/);
  assert.doesNotMatch(shared, /<FormModal/);
  assert.match(shared, /busy=\{busy\}/);
  assert.match(tickets, /<ConfirmationDialog/);
  assert.doesNotMatch(tickets, /<FormModal/);
  assert.match(tickets, /maxLength=\{200\}/);
  assert.match(tickets, /discardDraft\(!!note/);
  const today = readFileSync(
    new URL('../src/screens/TodayScreen.tsx', import.meta.url),
    'utf8',
  );
  assert.match(today, /<FormModal/);
  assert.match(today, /<Confirm/);
});
