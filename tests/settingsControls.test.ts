import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { formatTime, isValidTime } from '../src/ui/timeFieldModel';

// 纯函数和源码结构回归；不代表真机或浏览器视觉验收。
function parse(path: string) {
  return ts.createSourceFile(
    path,
    readFileSync(new URL(path, import.meta.url), 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
}
type Element = ts.JsxElement | ts.JsxSelfClosingElement;
function opening(node: Element) {
  return ts.isJsxElement(node) ? node.openingElement : node;
}
function find(source: ts.SourceFile, name: string): Element[] {
  const items: Element[] = [];
  function visit(node: ts.Node) {
    if (
      (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) &&
      opening(node).tagName.getText(source) === name
    )
      items.push(node);
    ts.forEachChild(node, visit);
  }
  visit(source);
  return items;
}
function attr(node: Element, name: string, source: ts.SourceFile) {
  return opening(node).attributes.properties.find(
    (item): item is ts.JsxAttribute =>
      ts.isJsxAttribute(item) && item.name.getText(source) === name,
  );
}
function expr(node: Element, name: string, source: ts.SourceFile) {
  const value = attr(node, name, source)?.initializer;
  assert.ok(value && ts.isJsxExpression(value) && value.expression);
  return value.expression.getText(source);
}

test('时间值严格限制HH:mm，边界正确，空白非法不能形成设置值', () => {
  for (const value of ['00:00', '09:05', '12:30', '23:59'])
    assert.equal(isValidTime(value), true);
  for (const value of [
    '',
    ' ',
    '9:05',
    '24:00',
    '23:60',
    '12:30:00',
    '00:00 ',
    '00:0',
  ])
    assert.equal(isValidTime(value), false);
  assert.equal(formatTime(0, 0), '00:00');
  assert.equal(formatTime(9, 5), '09:05');
  assert.equal(formatTime(23, 59), '23:59');
});

test('关闭到期仍保留设置入口，Web 开关使用真实按钮和对称轨道', () => {
  const source = parse('../src/screens/MoreScreens.tsx');
  const switches = find(source, 'CompactSwitch');
  assert.equal(switches.length, 1);
  assert.equal(expr(switches[0], 'disabled', source), 'busy');
  assert.equal(expr(switches[0], 'onValueChange', source), 'setExpiryEnabled');
  assert.equal(find(source, 'TimeField').length, 1);
  assert.match(
    expr(find(source, 'TimeField')[0], 'onChange', source),
    /if \(!expiryLocked\) setExpiryTime\(value\)/,
  );
  const web = parse('../src/ui/CompactSwitch.web.tsx');
  const button = find(web, 'button')[0];
  assert.equal(expr(button, 'aria-checked', web), 'value');
  for (const prop of ['disabled', 'aria-disabled']) {
    assert.equal(expr(button, prop, web), 'disabled');
  }
  const outer = expr(button, 'style', web);
  assert.match(outer, /height: control\[44\]/);
  const track = expr(find(web, 'span')[0], 'style', web);
  assert.match(track, /width: 38[\s\S]*height: 22[\s\S]*border: 0/);
  assert.match(track, /boxShadow: disabled/);
});

test('到期星期保留七个单排选项及首末边框，允许每格随容器缩窄', () => {
  const source = parse('../src/screens/MoreScreens.tsx');
  assert.ok(source.text.includes("EXPIRY_WEEKDAYS = '一二三四五六日'"));
  const picker = find(source, 'View').find(
    (node) =>
      attr(node, 'testID', source)?.initializer?.getText(source) ===
      '"expiry-weekdays"',
  );
  assert.ok(picker);
  assert.match(expr(picker, 'style', source), /flexDirection: 'row'/);
  assert.doesNotMatch(picker.getText(source), /ScrollView|flexWrap/);
  const radio = find(source, 'Pressable').find(
    (node) =>
      attr(node, 'accessibilityRole', source)?.initializer?.getText(source) ===
      '"radio"',
  );
  assert.ok(radio);
  assert.match(expr(radio, 'style', source), /minWidth: 0/);
  assert.match(expr(radio, 'style', source), /minHeight: control\[44\]/);
  assert.match(radio.getText(source), /borderTopRightRadius: last/);
});

test('Web使用小时分钟选择弹窗，不用系统time输入，仅确认提交时间', () => {
  const source = parse('../src/ui/TimeField.web.tsx');
  assert.equal(find(source, 'input').length, 0);
  assert.equal(source.text.includes('type="time"'), false);
  const modal = find(source, 'Modal')[0];
  assert.ok(modal);
  assert.ok(
    expr(modal, 'onRequestClose', source).includes('setVisible(false)'),
  );
  assert.ok(source.text.includes('onChange(formatTime(hour, minute))'));
  assert.ok(source.text.includes('column === 0 ? 24 : 60'));
  assert.ok(source.text.includes('keyboardFocus.focusVisible'));
  assert.ok(source.text.includes('backgroundColor: colors.field'));
  assert.ok(source.text.includes('borderWidth: 0'));
});

test('原生使用社区时间选择器，Android 系统弹窗，iOS 确认才提交', () => {
  const source = parse('../src/ui/TimeField.tsx');
  assert.equal(find(source, 'input').length, 0);
  assert.equal(find(source, 'TextInput').length, 0);
  assert.ok(source.text.includes('@react-native-community/datetimepicker'));
  assert.ok(source.text.includes('DateTimePickerAndroid.open'));
  assert.ok(source.text.includes("mode: 'time'"));
  assert.ok(source.text.includes('is24Hour: true'));
  const modal = find(source, 'Modal')[0];
  assert.ok(modal);
  const back = expr(modal, 'onRequestClose', source);
  assert.ok(back.includes('setVisible(false)'));
  assert.equal(back.includes('onChange'), false);
  const buttons = find(source, 'ActionButton');
  const confirm = buttons.filter((button) =>
    expr(button, 'onPress', source).includes('onChange('),
  );
  assert.equal(confirm.length, 1);
  assert.ok(
    expr(confirm[0], 'onPress', source).includes(
      'formatTime(draft.getHours(), draft.getMinutes())',
    ),
  );
  const cancel = buttons.find((button) =>
    button.getText(source).includes('取消'),
  );
  assert.ok(cancel);
  assert.equal(expr(cancel, 'onPress', source).includes('onChange'), false);
  assert.ok(source.text.includes("Platform.OS === 'ios'"));
});
