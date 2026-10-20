import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import {
  normalizeNumericInput,
  finalizeNumericInput,
} from '../src/ui/numericInputModel';
import { numericInputError } from '../src/domain/engine';

test('整数去掉冗余前导零，支持清空，不经过数值转换丢精度', () => {
  for (const [input, expected] of [
    ['010400', '10400'],
    ['000', '0'],
    ['0', '0'],
    ['', ''],
    ['0009007199254740993', '9007199254740993'],
  ]) {
    assert.equal(normalizeNumericInput(input, 'integer'), expected);
  }
});
test('小数只保留第一个点，补齐零整数部分并允许末尾点草稿', () => {
  for (const [input, expected] of [
    ['00.5', '0.5'],
    ['.5', '0.5'],
    ['1.....', '1.'],
    ['1..2', '1.2'],
    ['000', '0'],
    ['010400', '10400'],
    ['.', '0.'],
    ['', ''],
    ['000.500', '0.500'],
    ['1.23456789', '1.23456789'],
  ]) {
    assert.equal(normalizeNumericInput(input, 'decimal'), expected);
    assert.equal(normalizeNumericInput(expected, 'decimal'), expected);
  }
});
test('非法字符符号和指数原样交给错误提示，不把整数小数变成另一数值', () => {
  for (const kind of ['integer', 'decimal'] as const) {
    for (const input of [
      '1e3',
      '-01',
      '+01',
      '01a',
      '1,200',
      '0x10',
      ' 01 ',
      'NaN',
      'Infinity',
      '１',
      '1..a2',
    ]) {
      assert.equal(normalizeNumericInput(input, kind), input);
      assert.equal(finalizeNumericInput(input, kind), input);
    }
  }
  for (const input of ['1.5', '1..2', '.5', '000.5'])
    assert.equal(normalizeNumericInput(input, 'integer'), input);
});
test('失焦只收尾小数点，领域入口保持既有前导零接受及非法点精度范围拒绝', () => {
  assert.equal(finalizeNumericInput('1.', 'decimal'), '1');
  assert.equal(finalizeNumericInput('000.', 'decimal'), '0');
  assert.equal(finalizeNumericInput('', 'decimal'), '');
  assert.equal(finalizeNumericInput('1.', 'integer'), '1.');
  assert.equal(numericInputError('010400', 'integer', 1, 999999), '');
  assert.notEqual(numericInputError('1..2', 'decimal', 0, 999999), '');
  for (const input of ['1.234', '999999999']) {
    const normalized = normalizeNumericInput(input, 'decimal');
    assert.equal(normalized, input);
    assert.notEqual(numericInputError(normalized, 'decimal', 0, 100), '');
  }
});

const source = readFileSync(
  new URL('../src/ui/AppTextInput.tsx', import.meta.url),
  'utf8',
);
const ast = ts.createSourceFile(
  'AppTextInput.tsx',
  source,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
function callback(name: string, dependencies: Record<string, unknown>) {
  let expression: string | undefined;
  function visit(node: ts.Node) {
    if (
      ts.isJsxAttribute(node) &&
      node.name.getText(ast) === name &&
      node.initializer &&
      ts.isJsxExpression(node.initializer)
    )
      expression = node.initializer.expression?.getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(expression);
  const output = ts.transpileModule('const extracted = ' + expression, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.None,
    },
  }).outputText;
  return new Function(
    ...Object.keys(dependencies),
    output + ';return extracted;',
  )(...Object.values(dependencies)) as (value: unknown) => void;
}
test('真实输入回调传递规范值，失焦先提交收尾再透传事件且不吞普通文本回调', () => {
  const events: unknown[] = [];
  const latestText = { current: '' };
  const latestChangeEvent = {
    current: null as null | { nativeEvent: { text: string } },
  };
  const dependencies = {
    numericRule: { kind: 'decimal' },
    normalizeNumericInput,
    finalizeNumericInput,
    latestText,
    latestChangeEvent,
    setNumericDraft: (text: string) => events.push(['draft', text]),
    onChangeText: (text: string) => events.push(['change', text]),
    setTouched: () => {},
    setFocused: () => {},
    keyboardFocus: { onBlur: () => {} },
    onBlur: (event: unknown) => events.push(['blur', event]),
  };
  callback('onChangeText', dependencies)('001.....');
  assert.equal(latestText.current, '1.');
  assert.deepEqual(events.slice(-1), [['change', '1.']]);
  const event = { nativeEvent: { text: '1.' } };
  callback('onBlur', dependencies)(event);
  assert.equal(latestText.current, '1');
  assert.deepEqual(events.slice(-2), [
    ['change', '1'],
    ['blur', { nativeEvent: { text: '1' } }],
  ]);
  events.length = 0;
  callback('onChangeText', { ...dependencies, numericRule: undefined })(
    '001..原文',
  );
  assert.deepEqual(events, [['change', '001..原文']]);
  // 普通文本事件仍原样透传，ref、无障碍、主题及紧凑样式继续由共享控件承担。
  assert.ok(source.includes('{...props}'));
  const rawEvent = {
    nativeEvent: { text: '001..2', eventCount: 4 },
    timeStamp: 123,
  };
  const changed: unknown[] = [];
  callback('onChange', {
    ...dependencies,
    onChange: (event: unknown) => changed.push(event),
  })(rawEvent);
  assert.deepEqual(changed, [
    { nativeEvent: { text: '1.2', eventCount: 4 }, timeStamp: 123 },
  ]);
  assert.equal(rawEvent.nativeEvent.text, '001..2');
  const plain: unknown[] = [];
  callback('onChange', {
    ...dependencies,
    numericRule: undefined,
    onChange: (event: unknown) => plain.push(event),
  })(rawEvent);
  assert.equal(plain[0], rawEvent);
  const order: string[] = [];
  const paired = {
    ...dependencies,
    onChange: (event: { nativeEvent: { text: string } }) =>
      order.push('event:' + event.nativeEvent.text),
    onChangeText: (text: string) => order.push('text:' + text),
  };
  callback('onChange', paired)(rawEvent);
  callback('onChangeText', paired)(rawEvent.nativeEvent.text);
  assert.deepEqual(order, ['event:1.2', 'text:1.2']);
  let controlled = '';
  const onlyChange = {
    ...dependencies,
    onChangeText: undefined,
    onChange: (event: { nativeEvent: { text: string } }) => {
      controlled = event.nativeEvent.text;
    },
  };
  callback('onChange', onlyChange)({ nativeEvent: { text: '001.....' } });
  assert.equal(controlled, '1.');
  callback('onBlur', onlyChange)({ nativeEvent: {} });
  assert.equal(controlled, '1');
  const blurEvents: unknown[] = [];
  callback('onBlur', {
    ...dependencies,
    onBlur: (event: unknown) => blurEvents.push(event),
  })({ nativeEvent: { text: '1.' } });
  assert.deepEqual(blurEvents, [{ nativeEvent: { text: '1' } }]);
  assert.ok(source.includes('onBlur?.(blurEvent)'));
  assert.ok(source.includes('inputRef.current = instance'));
});
