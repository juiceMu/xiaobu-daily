import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { formatMilestoneSource } from '../src/ui/ticketLabels';

test('奖券来源标明具体里程碑，已有后缀不重复、缺失名称安全回退', () => {
  assert.equal(formatMilestoneSource('减肥'), '减肥里程碑');
  assert.equal(formatMilestoneSource('阅读'), '阅读里程碑');
  assert.equal(formatMilestoneSource('阅读里程碑'), '阅读里程碑');
  assert.equal(formatMilestoneSource(''), '里程碑');
  assert.equal(formatMilestoneSource(), '里程碑');
});

// AST验证布局契约，不代替浏览器或真机视觉交互验证。
const source = ts.createSourceFile(
  'TicketsScreen.tsx',
  readFileSync(
    new URL('../src/screens/TicketsScreen.tsx', import.meta.url),
    'utf8',
  ),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
type Element = ts.JsxElement | ts.JsxSelfClosingElement;
function opening(node: Element) {
  return ts.isJsxElement(node) ? node.openingElement : node;
}
function elements(root: ts.Node = source): Element[] {
  const result: Element[] = [];
  function visit(node: ts.Node) {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node))
      result.push(node);
    ts.forEachChild(node, visit);
  }
  visit(root);
  return result;
}
function attribute(node: Element, name: string) {
  return opening(node).attributes.properties.find(
    (item): item is ts.JsxAttribute =>
      ts.isJsxAttribute(item) && item.name.getText(source) === name,
  );
}
function byId(id: string) {
  const matches = elements().filter((node) => {
    const value = attribute(node, 'testID')?.initializer;
    return value && ts.isStringLiteral(value) && value.text === id;
  });
  assert.equal(matches.length, 1);
  return matches[0];
}

test('奖券图标文字使用按钮同一横行，紧凑卡片不设固定高度', () => {
  const row = byId('ticket-main-row');
  assert.ok(ts.isJsxElement(row));
  const button = byId('ticket-use-button');
  assert.equal(opening(button).tagName.getText(source), 'ActionButton');
  let parent: ts.Node | undefined = button;
  while (parent && parent !== row) parent = parent.parent;
  assert.equal(parent, row);
  const panel = row.parent;
  assert.ok(ts.isJsxElement(panel));
  assert.equal(panel.openingElement.tagName.getText(source), 'Panel');
  const style = attribute(panel, 'style')?.initializer?.getText(source) ?? '';
  assert.ok(style.includes('padding: 12'));
  assert.ok(style.includes('gap: 6'));
  assert.equal(style.includes('height:'), false);
  assert.ok(
    attribute(row, 'style')
      ?.initializer?.getText(source)
      .includes("flexWrap: 'nowrap'"),
  );
  assert.ok(row.getText(source).includes('styles.grow'));
  assert.ok(row.getText(source).includes('width: 32'));
  assert.ok(row.getText(source).includes('size={18}'));
  const buttonText = button.getText(source);
  assert.ok(
    buttonText.includes("status === 'available'") ||
      button.parent.parent.getText(source).includes("status === 'available'"),
  );
  assert.ok(buttonText.includes("'使用奖券，' + item.name"));
  assert.ok(buttonText.includes('disabled={busy}'));
  assert.ok(buttonText.includes('setSelected(item)'));
  assert.ok(
    attribute(button, 'style')
      ?.initializer?.getText(source)
      .includes("alignSelf: 'center'"),
  );
  assert.ok(
    attribute(button, 'labelStyle')
      ?.initializer?.getText(source)
      .includes('fontSize: 12'),
  );
  assert.ok(ts.isJsxElement(button));
  assert.equal(
    button.children
      .filter(ts.isJsxText)
      .map((node) => node.text)
      .join('')
      .trim(),
    '使用',
  );
});

test('奖券标题两行省略保留全文读屏，状态来源获得时间紧凑且备注不截断', () => {
  const title = byId('ticket-title');
  assert.equal(
    attribute(title, 'numberOfLines')?.initializer?.getText(source),
    '{2}',
  );
  assert.equal(
    attribute(title, 'accessibilityLabel')?.initializer?.getText(source),
    '{item.name}',
  );
  assert.ok(
    attribute(title, 'style')
      ?.initializer?.getText(source)
      .includes('fontSize: 13'),
  );
  for (const id of [
    'ticket-status',
    'ticket-created-at',
    'ticket-usage-note',
  ]) {
    assert.ok(
      attribute(byId(id), 'style')
        ?.initializer?.getText(source)
        .includes('fontSize: 12'),
    );
  }
  const note = byId('ticket-usage-note');
  assert.equal(attribute(note, 'numberOfLines'), undefined);
  assert.equal(attribute(note, 'ellipsizeMode'), undefined);
  const status = byId('ticket-status').getText(source);
  assert.ok(status.includes('{sourceName} · {statusLabel}'));
  assert.ok(
    source.text.includes('formatMilestoneSource(item.goalName || goal?.name)'),
  );
  assert.ok(source.text.includes('formatDate(item.usedAt!)'));
  assert.ok(source.text.includes('formatDate(item.expiresAt!)'));
  assert.ok(source.text.includes('formatDate(item.createdAt)'));
  assert.equal(source.text.includes('永久有效 · 随时享受'), false);
  assert.ok(source.text.includes('<ConfirmationDialog'));
  assert.ok(
    source.text.includes('consumeTicket(draft, selected.id, new Date(), note)'),
  );
});

test('每张非可用奖券在卡片顶部显示带图标文字状态，不影响可用券操作', () => {
  const text = readFileSync(
    new URL('../src/ui/TicketStatusBadge.tsx', import.meta.url),
    'utf8',
  );
  const screen = readFileSync(
    new URL('../src/screens/TicketsScreen.tsx', import.meta.url),
    'utf8',
  );
  assert.ok(text.includes("if (status === 'available') return null"));
  assert.ok(text.includes("used ? '已使用' : '已过期'"));
  assert.ok(
    text.includes("used ? 'check-circle-outline' : 'clock-alert-outline'"),
  );
  assert.ok(text.includes('accessibilityLabel={label}'));
  assert.ok(text.includes("alignSelf: 'flex-end'"));
  assert.ok(screen.includes('<TicketStatusBadge status={status} />'));
  assert.ok(screen.includes("status === 'available' && ("));
});
