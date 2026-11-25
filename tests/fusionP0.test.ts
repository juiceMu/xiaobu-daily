import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import { numericInputError } from '../src/domain/engine';
import { formatTicketValidity } from '../src/ui/ticketLabels';
import {
  bottomNavigationHeight,
  taskMenuLayout,
} from '../src/ui/taskMenuLayout';

function screen(file: string) {
  const name = file + '.tsx';
  return ts.createSourceFile(
    name,
    readFileSync(new URL('../src/screens/' + name, import.meta.url), 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
}

function find<T>(root: ts.Node, check: (node: ts.Node) => T | undefined): T {
  const result = check(root);
  if (result !== undefined) return result;
  let child: T | undefined;
  ts.forEachChild(root, (node) => {
    try {
      child = find(node, check);
      return node;
    } catch (error) {
      if (error !== NOT_FOUND) throw error;
    }
  });
  if (child === undefined) throw NOT_FOUND;
  return child;
}

const NOT_FOUND = new Error('未找到界面定义');
const today = screen('TodayScreen');
const settings = screen('MoreScreens');

function declaration(source: ts.SourceFile, name: string) {
  return find(source, (node) =>
    ts.isVariableDeclaration(node) &&
    node.name.getText(source) === name &&
    node.initializer
      ? node.getText(source)
      : undefined,
  );
}

function transition(source: ts.SourceFile, id: string, attribute: string) {
  const item = find(source, (node) =>
    ts.isJsxElement(node) &&
    node.openingElement.attributes.properties.some(
      (prop) =>
        ts.isJsxAttribute(prop) && prop.getText(source) === `testID="${id}"`,
    )
      ? node
      : undefined,
  );
  return find(item.openingElement, (node) =>
    ts.isJsxAttribute(node) &&
    node.name.getText(source) === attribute &&
    node.initializer &&
    ts.isJsxExpression(node.initializer)
      ? node.initializer.expression?.getText(source)
      : undefined,
  );
}

test('关闭奖券到期后星期和时间仍挂载，并使用同一锁定状态', () => {
  const locked = new Function(
    'busy',
    'expiryEnabled',
    'const ' + declaration(settings, 'expiryLocked') + '; return expiryLocked;',
  );
  for (const [busy, enabled, expected] of [
    [false, false, true],
    [true, false, true],
    [false, true, false],
    [true, true, true],
  ]) {
    assert.equal(locked(busy, enabled), expected);
  }
  const group = find(settings, (node) =>
    ts.isJsxElement(node) &&
    node.openingElement.getText(settings).includes('testID="expiry-settings"')
      ? node.getText(settings)
      : undefined,
  );
  assert.match(group, /<ExpiryWeekday[^]*disabled=\{expiryLocked\}/);
  assert.match(
    group,
    /<TimeField[^]*label="到期时间"[^]*disabled=\{expiryLocked\}/,
  );
  assert.match(group, /开启「每周奖券到期」后可设置/);
});

test('周日期的未来状态既禁止触发回调又在可访问属性体现', () => {
  const disabled = transition(today, 'week-strip-day', 'disabled');
  assert.equal(transition(today, 'week-strip-day', 'aria-disabled'), disabled);
  const press = transition(today, 'week-strip-day', 'onPress');
  let picked = '';
  const date = '2026-11-26';
  const changePickedDate = (value: string) => (picked = value);
  const tap = new Function(
    'busy',
    'calendar',
    'day',
    'changePickedDate',
    'const disabled = ' + disabled + '; (' + press + ')(); return disabled;',
  );
  assert.equal(
    tap(false, { isFuture: true }, { date }, changePickedDate),
    true,
  );
  assert.equal(picked, '');
  assert.equal(
    tap(true, { isFuture: false }, { date }, changePickedDate),
    true,
  );
  assert.equal(picked, '');
  assert.equal(
    tap(false, { isFuture: false }, { date }, changePickedDate),
    false,
  );
  assert.equal(picked, date);
  assert.match(today.text, /borderStyle: 'dashed'/);
  assert.match(today.text, />未来不可选</);
});

test('任务名称空白或次数越界均禁用保存，修正字段后可继续', () => {
  const canSave = new Function(
    'form',
    'numericInputError',
    'const ' +
      declaration(today, 'taskTargetError') +
      '; const ' +
      declaration(today, 'canSaveTask') +
      '; return canSaveTask;',
  );
  for (const [form, expected] of [
    [null, false],
    [{ name: '', target: '1' }, false],
    [{ name: ' \u3000 ', target: '1' }, false],
    [{ name: '读书', target: '100' }, false],
    [{ name: '读书', target: '1.1' }, false],
    [{ name: '读书', target: '1' }, true],
    [{ name: '读书', target: '99' }, true],
  ]) {
    assert.equal(canSave(form, numericInputError), expected);
  }
  assert.match(today.text, /disabled=\{busy \|\| !canSaveTask\}[^]*保存任务/);
});

test('奖券显示当地日期与 24 小时截止时间，已保存的空日期没有伪造截止时间', () => {
  assert.equal(
    formatTicketValidity({ source: 'weight', expiresAt: null }),
    '永久有效',
  );
  assert.equal(
    formatTicketValidity({ source: 'checkin', expiresAt: null }),
    '未设到期时间',
  );
  assert.equal(formatTicketValidity({ expiresAt: null }), '未设到期时间');
  assert.equal(
    formatTicketValidity({
      expiresAt: new Date(2027, 0, 1, 0, 9).toISOString(),
    }),
    '2027年1月1日 00:09 到期',
  );
  assert.equal(
    formatTicketValidity({
      source: 'checkin',
      expiresAt: new Date(2026, 10, 25, 23, 59).toISOString(),
    }),
    '2026年11月25日 23:59 到期',
  );
});

test('靠近底栏的菜单向上展开，短视口把菜单限制在可滚动区域', () => {
  for (const [windowHeight, bottomInset, fontScale, anchorTop] of [
    [844, 34, 1.5, 700],
    [568, 0, 1, 500],
    [240, 12, 1.5, 195],
    [568, 0, 1, 40],
  ]) {
    const navigationHeight = bottomNavigationHeight(fontScale, bottomInset);
    const menu = taskMenuLayout(anchorTop, windowHeight, 24, navigationHeight);
    assert.ok(menu.top >= 24);
    assert.ok(menu.top + menu.height <= windowHeight - navigationHeight);
    if (windowHeight > 250 && anchorTop > 100) {
      assert.equal(menu.height, 177);
      assert.ok(menu.top + menu.height <= anchorTop);
    }
  }
  assert.match(today.text, /style=\{\{ maxHeight: menuLayout.height \}\}/);
  assert.match(today.text, /styles.separator[^]*title="删除任务"/);
  assert.match(today.text, /setDatePickerVisible\(true\)/);
});
