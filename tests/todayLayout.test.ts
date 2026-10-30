import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import React from 'react';
import ts from 'typescript';

// 源码 AST 结构回归，不代替浏览器或真机的视觉布局测试。
const source = ts.createSourceFile(
  'TodayScreen.tsx',
  readFileSync(
    new URL('../src/screens/TodayScreen.tsx', import.meta.url),
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
function elements(node: ts.Node = source): Element[] {
  const result: Element[] = [];
  function visit(current: ts.Node) {
    if (ts.isJsxElement(current) || ts.isJsxSelfClosingElement(current))
      result.push(current);
    ts.forEachChild(current, visit);
  }
  visit(node);
  return result;
}
function attribute(node: Element, name: string) {
  return opening(node).attributes.properties.find(
    (item): item is ts.JsxAttribute =>
      ts.isJsxAttribute(item) && item.name.getText(source) === name,
  );
}
function expression(node: Element, name: string) {
  const value = attribute(node, name)?.initializer;
  assert.ok(
    value && ts.isJsxExpression(value) && value.expression,
    name + ' 应为表达式',
  );
  return value.expression;
}
function byTestId(id: string) {
  const matches = elements().filter((node) => {
    const value = attribute(node, 'testID')?.initializer;
    return value && ts.isStringLiteral(value) && value.text === id;
  });
  assert.equal(matches.length, 1, id + ' 应有且只有一个');
  return matches[0];
}
function styleProperties(node: Element) {
  const style = expression(node, 'style');
  assert.ok(ts.isObjectLiteralExpression(style));
  return new Map(
    style.properties
      .filter(ts.isPropertyAssignment)
      .map((property) => [
        property.name.getText(source),
        property.initializer.getText(source),
      ]),
  );
}
function jsxChildren(node: ts.JsxElement) {
  return node.children.filter(
    (child): child is Element =>
      ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child),
  );
}

test('进度条由独立6dp不收缩容器约束，兑换行紧随其后且同属滚动统计卡', () => {
  const track = byTestId('reward-progress-track');
  assert.ok(ts.isJsxElement(track));
  assert.equal(opening(track).tagName.getText(source), 'View');
  const bounds = styleProperties(track);
  assert.equal(bounds.get('height'), '6');
  assert.equal(bounds.get('flexShrink'), '0');
  const visual = jsxChildren(track);
  assert.equal(visual.length, 1);
  assert.ok(ts.isJsxElement(visual[0]));
  const progress = jsxChildren(visual[0]);
  assert.equal(progress.length, 1);
  assert.equal(opening(progress[0]).tagName.getText(source), 'ProgressBar');
  assert.equal(styleProperties(progress[0]).get('height'), '6');
  assert.ok(attribute(track, 'accessibilityLabel'));
  const panel = track.parent;
  assert.ok(ts.isJsxElement(panel));
  assert.equal(panel.openingElement.tagName.getText(source), 'Panel');
  assert.equal(expression(panel, 'style').getText(source), 'styles.card');
  const siblings = jsxChildren(panel);
  assert.equal(
    siblings[siblings.indexOf(track) + 1],
    byTestId('redemption-bar'),
  );
  let ancestor: ts.Node | undefined = panel;
  while (
    ancestor &&
    !(
      ts.isJsxAttribute(ancestor) &&
      ancestor.name.getText(source) === 'ListHeaderComponent'
    )
  )
    ancestor = ancestor.parent;
  assert.ok(ancestor, '统计卡必须位于FlatList头部随列表滚动');
  assert.ok(ancestor.parent.parent.getText(source).startsWith('<FlatList'));
});

test('兑换进度语义按实际次数提供，不把可见进度误报为忙碌', () => {
  const require = createRequire(import.meta.url);
  const { renderToStaticMarkup } = require('react-dom/server') as {
    renderToStaticMarkup: (element: React.ReactElement) => string;
  };
  const track = byTestId('reward-progress-track');
  const compiled = ts.transpileModule(
    `const element = ${track.getText(source)};`,
    {
      compilerOptions: {
        jsx: ts.JsxEmit.React,
        target: ts.ScriptTarget.ES2020,
      },
    },
  ).outputText;
  const view = require('react-native-web/dist/cjs/exports/View');
  const simulatedPaper = ({ progress }: { progress: number }) =>
    React.createElement(view, {
      accessibilityRole: 'progressbar',
      'aria-busy': true,
      'aria-valuenow': Math.round(progress * 100),
    });
  const render = new Function(
    'React',
    'View',
    'ProgressBar',
    'state',
    'stats',
    `${compiled}\nreturn element;`,
  ) as (
    react: typeof React,
    view: unknown,
    progressBar: typeof simulatedPaper,
    state: { settings: { threshold: number } },
    stats: { remainder: number },
  ) => React.ReactElement;

  for (const [remainder, threshold] of [
    [0, 3],
    [1, 3],
    [998, 999],
    [0, 1],
  ]) {
    const element = render(
      React,
      view,
      simulatedPaper,
      { settings: { threshold } },
      { remainder },
    );
    const props = element.props as Record<string, unknown>;
    assert.equal(props.accessibilityRole, 'progressbar');
    assert.equal(props.accessibilityLabel, '距离下一张奖券的打卡进度');
    assert.equal(props['aria-valuemin'], 0);
    assert.equal(props['aria-valuemax'], threshold);
    assert.equal(props['aria-valuenow'], remainder);
    assert.equal(
      props['aria-valuetext'],
      `已积累 ${remainder} 次，共需 ${threshold} 次`,
    );
    assert.equal(props['aria-busy'], undefined);
    assert.equal(props.accessibilityState, undefined);

    const visual = props.children as React.ReactElement;
    const visualProps = visual.props as Record<string, unknown>;
    assert.equal(visualProps['aria-hidden'], true);
    assert.equal(visualProps.accessibilityElementsHidden, true);
    assert.equal(visualProps.importantForAccessibility, 'no-hide-descendants');
    const paper = visualProps.children as React.ReactElement;
    assert.equal(
      (paper.props as { progress: number }).progress,
      remainder / threshold,
    );

    // RN Web 0.21 不转发 accessibilityValue 对象，检验真实 View 服务端映射。
    // Paper 以替身模拟，不能视为浏览器或原生读屏实测。
    const html = renderToStaticMarkup(element);
    const root = html.slice(0, html.indexOf('>') + 1);
    assert.match(root, /role="progressbar"/);
    assert.match(root, /aria-valuemin="0"/);
    assert.ok(root.includes(`aria-valuemax="${threshold}"`));
    assert.ok(root.includes(`aria-valuenow="${remainder}"`));
    assert.ok(
      root.includes(
        `aria-valuetext="已积累 ${remainder} 次，共需 ${threshold} 次"`,
      ),
    );
    assert.doesNotMatch(root, /aria-busy/);
    assert.match(html, /aria-hidden="true"/);
  }
});

test('兑换按钮始终存在，保留禁用和确认逻辑，兑换行可换行且不设置固定高度', () => {
  const row = byTestId('redemption-bar');
  assert.ok(ts.isJsxElement(row));
  const style = styleProperties(row);
  assert.equal(style.get('flexDirection'), "'row'");
  assert.equal(style.get('flexWrap'), "'wrap'");
  assert.equal(style.get('flexShrink'), '0');
  assert.equal(style.get('gap'), '8');
  assert.equal(style.has('height'), false);
  assert.equal(style.has('position'), false);
  const button = byTestId('redeem-ticket-button');
  assert.equal(
    button.parent,
    row,
    '按钮必须直接无条件渲染，不能只在可兑换时出现',
  );
  assert.equal(opening(button).tagName.getText(source), 'ActionButton');
  assert.equal(
    expression(button, 'disabled').getText(source),
    'busy || historicalWeek || stats.redeemable === 0',
  );
  assert.equal(
    expression(button, 'onPress').getText(source),
    "() => ask('redeem')",
  );
  assert.equal(styleProperties(button).get('flexShrink'), '0');
  assert.equal(
    attribute(button, 'contentStyle'),
    undefined,
    '兑换按钮沿用共享紧凑尺寸，不单独放大',
  );
  const label = attribute(button, 'accessibilityLabel')?.initializer;
  assert.ok(label && ts.isStringLiteral(label));
  assert.equal(label.text, '兑换一张奖券');
});

test('所有页面ActionButton不残留36以上视觉高度覆盖', () => {
  for (const file of [
    'TodayScreen',
    'TicketsScreen',
    'MilestonesScreen',
    'MoreScreens',
  ]) {
    const content = readFileSync(
      new URL('../src/screens/' + file + '.tsx', import.meta.url),
      'utf8',
    );
    const ast = ts.createSourceFile(
      file,
      content,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    function visit(node: ts.Node) {
      if (
        (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
        node.tagName.getText(ast) === 'ActionButton'
      ) {
        const style = node.attributes.properties.find(
          (prop) =>
            ts.isJsxAttribute(prop) &&
            prop.name.getText(ast) === 'contentStyle',
        );
        assert.ok(
          !style?.getText(ast).match(/minHeight:\s*(3[6-9]|[4-9]\d)/),
          file,
        );
      }
      ts.forEachChild(node, visit);
    }
    visit(ast);
  }
});
