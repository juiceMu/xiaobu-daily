import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { defaultColors, themeOptions } from '../src/ui/themeCatalog';

// 主题和结构回归，不替代浏览器/真机上的实际视觉验收。
const themeText = readFileSync(
  new URL('../src/ui/theme.ts', import.meta.url),
  'utf8',
);
function luminance(hex: string) {
  const channels = [1, 3, 5].map((offset) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
function contrast(foreground: string, background: string) {
  const values = [luminance(foreground), luminance(background)].sort(
    (a, b) => b - a,
  );
  return (values[0] + 0.05) / (values[1] + 0.05);
}
function mix(background: string, foreground: string, strength: number) {
  return (
    '#' +
    [1, 3, 5]
      .map((offset) =>
        Math.round(
          parseInt(background.slice(offset, offset + 2), 16) * (1 - strength) +
            parseInt(foreground.slice(offset, offset + 2), 16) * strength,
        )
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}
test('五套主题的按钮悬停与按压实际混色后仍达正文对比度', () => {
  for (const { id, colors } of themeOptions) {
    for (const [foreground, background] of [
      [colors.onBrand, colors.brandFill],
      [colors.onSave, colors.save],
      [colors.onReward, colors.reward],
      [colors.onArchive, colors.archive],
    ]) {
      for (const strength of [0.07, 0.12])
        assert.ok(
          contrast(foreground, mix(background, foreground, strength)) >= 4.5,
          id + '按钮混色' + strength,
        );
    }
  }
});
test('浅暖灰米品牌填充与独立前景保持真实消费对比度', () => {
  const colors = defaultColors;
  assert.equal(colors.brandFill, '#DCCFBE');
  assert.equal(colors.onBrand, '#514B44');
  assert.equal(colors.primary, '#625B53');
  for (const option of themeOptions) {
    const colors = option.colors;
    for (const [foreground, background] of [
      [colors.onUsedBadge, colors.usedBadge],
      [colors.onExpiredBadge, colors.expiredBadge],
      [colors.primary, colors.primaryAccent],
      [colors.onBrand, colors.brandFill],
      [colors.primary, colors.primaryContainer],
      [colors.primary, colors.surface],
      [colors.ink, colors.background],
      [colors.muted, colors.background],
      ['#FFFFFF', colors.primary],
      ['#FFFFFF', colors.danger],
      [colors.onSave, colors.save],
      [colors.onReward, colors.reward],
      [colors.onArchive, colors.archive],
      ['#FFFFFF', colors.selectedIcon],
      ...(['field', 'green', 'peach', 'blue', 'purple'] as const).flatMap(
        (key) => [
          [colors.ink, colors[key]],
          [colors.muted, colors[key]],
        ],
      ),
    ])
      assert.ok(
        contrast(foreground, background) >= 4.5,
        `${option.id}: ${foreground}/${background} 对比度不足`,
      );
  }
  const white = themeOptions.find(({ id }) => id === 'white')!.colors;
  assert.equal(white.background, '#FFFFFF');
  assert.equal(white.surface, '#F6F3FB');
  assert.notEqual(white.field, white.surface);
  assert.notEqual(white.primaryContainer, white.surface);
  for (const { id, colors: theme } of themeOptions) {
    const delta = Math.abs(
      luminance(theme.background) - luminance(theme.surface),
    );
    assert.ok(
      delta >= 0.02,
      `${id}: 页面底与卡片面对比过弱（ΔL=${delta.toFixed(4)}）`,
    );
  }
  assert.equal(colors.green, '#EAF7EE');
  assert.equal(colors.background, '#FFFCF8');
  assert.equal(colors.field, '#FCF7EE');
  assert.match(themeText, /onPrimary:\s*['"]#FFFFFF['"]/);
  assert.ok(luminance(colors.brandFill) > 0.6);
  const components = readFileSync(
    new URL('../src/ui/components.tsx', import.meta.url),
    'utf8',
  );
  assert.ok(
    components.includes(
      'primary: { fill: colors.brandFill, text: colors.onBrand }',
    ),
  );
  assert.ok(themeText.includes('primary: colors.primary'));
  assert.ok(contrast(colors.primary, colors.field) >= 3);
});
test('全应用采用紧凑手机字号和间距，不禁用系统文字缩放', () => {
  for (const [variant, size, lineHeight] of [
    ['headlineMedium', 16, 24],
    ['titleLarge', 16, 22],
    ['titleMedium', 14, 20],
    ['bodyLarge', 14, 20],
    ['bodyMedium', 13, 20],
  ] as const) {
    const start = themeText.indexOf(variant + ': {');
    const block = themeText.slice(start, themeText.indexOf('},', start));
    assert.ok(block.includes('fontSize: ' + size), variant);
    assert.ok(block.includes('lineHeight: ' + lineHeight), variant);
  }
  const components = readFileSync(
    new URL('../src/ui/components.tsx', import.meta.url),
    'utf8',
  );
  const shared = readFileSync(
    new URL('../src/screens/shared.tsx', import.meta.url),
    'utf8',
  );
  assert.ok(components.includes('const gutter = width < 360 ? 12 : 16'));
  assert.match(components, /title:\s*\{\s*fontSize:\s*16,\s*lineHeight:\s*24/);
  assert.ok(shared.includes('body: { fontSize: 14, lineHeight: 20'));
  assert.ok(shared.includes('muted: { fontSize: 12, lineHeight: 18'));
  assert.ok(shared.includes('separator: { height: 8 }'));
  assert.equal(components.includes('allowFontScaling={false}'), false);
});
test('统一按钮原生48网页40dp触控且视觉30dp，不依赖扩展命中范围', () => {
  const source = readFileSync(
    new URL('../src/ui/components.tsx', import.meta.url),
    'utf8',
  );
  assert.match(source, /button:\s*\{[^}]*minHeight:\s*48/s);
  assert.match(source, /minHeight:\s*30/);
  assert.ok(source.includes('minWidth: 40'));
  assert.ok(source.includes('minHeight: 40'));
  assert.ok(source.includes('marginVertical: isWeb ? 5 : 9'));
  assert.match(source, /backgroundColor:\s*['"]transparent['"]/);
  assert.match(source, /fontSize:\s*12/);
  const tickets = readFileSync(
    new URL('../src/screens/TicketsScreen.tsx', import.meta.url),
    'utf8',
  );
  assert.match(
    tickets,
    /mode=\{filter === value \? 'contained-tonal' : 'text'\}/,
  );
  assert.match(
    tickets,
    /accessibilityState=\{\{ selected: filter === value \}\}/,
  );
});

test('页面标题16号且顶部留白16dp，底栏在系统安全区之外增加12dp并同步增高', () => {
  const components = readFileSync(
    new URL('../src/ui/components.tsx', import.meta.url),
    'utf8',
  );
  assert.match(components, /title:\s*\{\s*fontSize:\s*16,\s*lineHeight:\s*24/);
  assert.ok(components.includes('paddingTop: 16'));
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  assert.ok(app.includes('const bottomInset = insets.bottom + 12'));
  assert.ok(
    app.includes('safeAreaInsets={{ ...insets, bottom: bottomInset }}'),
  );
  const source = ts.createSourceFile(
    'App.tsx',
    app,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  let heightExpression = '';
  function visit(node: ts.Node) {
    if (
      ts.isPropertyAssignment(node) &&
      node.name.getText(source) === 'height' &&
      node.initializer.getText(source).includes('bottomInset')
    )
      heightExpression = node.initializer.getText(source);
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(heightExpression);
  const height = new Function(
    'fontScale',
    'bottomInset',
    'return ' + heightExpression,
  ) as (scale: number, inset: number) => number;
  for (const bottom of [0, 20, 34]) {
    for (const scale of [1, 1.25, 1.5, 2]) {
      const reserved = bottom + 12;
      assert.equal(
        height(scale, reserved) - reserved,
        64 + Math.max(0, Math.min(scale, 1.5) - 1) * 32,
      );
      assert.equal(height(scale, reserved) - height(scale, bottom), 12);
    }
  }
  assert.ok(app.includes('labelMaxFontSizeMultiplier={1.5}'));
  assert.ok(app.includes('color={color} size={22}'));
  assert.equal(app.includes('allowFontScaling={false}'), false);
});

test('图标与关闭控件视觉缩小但保留真实触控和固定文字选择提示', () => {
  const text = readFileSync(
    new URL('../src/ui/components.tsx', import.meta.url),
    'utf8',
  );
  assert.ok(text.includes('width: 32'));
  assert.ok(text.includes('height: 32'));
  assert.match(text, /source=\{name\}\s+size=\{18\}/);
  assert.ok(text.includes('当前图标：'));
  assert.ok(
    text.includes("accessibilityState?.selected === false ? 'neutral'"),
  );
  for (const semantic of ['save', 'reward', 'archive']) {
    assert.ok(text.includes(`${semantic}: { fill: colors.${semantic}`));
  }
  assert.ok(
    text.includes("neutral: { fill: 'transparent', text: colors.muted }"),
  );
  assert.ok(text.includes('? colors.selectedIcon'));
  assert.ok(text.includes(': colors.field'));
  assert.ok(text.includes('selected ? colors.surface : colors.primary'));
  assert.equal(text.includes('source="check"'), false);
  const close = text.slice(
    text.indexOf('icon="close"'),
    text.indexOf('onPress={onDismiss}', text.indexOf('icon="close"')),
  );
  assert.ok(close.includes('size={16}'));
  assert.ok(close.includes('hitSlop={0}'));
  assert.ok(close.includes("Platform.OS === 'web' ? 32 : 44"));
  assert.ok(close.includes("backgroundColor: 'transparent'"));
  for (const level of [1, 2, 3, 4, 5])
    assert.ok(themeText.includes('level' + level + ':'));
  for (const oldColor of ['#64617C', '#EDF3F8', '#F2F6FA'])
    assert.equal(themeText.includes(oldColor), false);
});

test('Web悬停按下只变底色，键盘聚焦才绘制内层轮廓且保留原生反馈和回调', () => {
  const text = readFileSync(
    new URL('../src/ui/components.tsx', import.meta.url),
    'utf8',
  );
  const source = ts.createSourceFile(
    'components.tsx',
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  let button: ts.JsxElement | undefined;
  function visit(node: ts.Node) {
    if (
      ts.isJsxElement(node) &&
      node.openingElement.tagName.getText(source) === 'Button'
    )
      button = node;
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(button);
  function attribute(name: string) {
    const property = button!.openingElement.attributes.properties.find(
      (item): item is ts.JsxAttribute =>
        ts.isJsxAttribute(item) && item.name.getText(source) === name,
    );
    const value = property?.initializer;
    assert.ok(
      value && ts.isJsxExpression(value) && value.expression,
      name + ' 必须存在',
    );
    return value.expression;
  }
  assert.equal(attribute('rippleColor').getText(source), "'transparent'");
  assert.equal(attribute('ref').getText(source), 'ref');
  const content = attribute('contentStyle');
  assert.ok(ts.isArrayLiteralExpression(content));
  const callerIndex = content.elements.findIndex(
    (item) => item.getText(source) === 'contentStyle',
  );
  assert.ok(callerIndex >= 0);
  const feedback = content.elements[callerIndex + 1];
  assert.ok(ts.isObjectLiteralExpression(feedback));
  const feedbackStyles = new Map(
    feedback.properties
      .filter(ts.isPropertyAssignment)
      .map((property) => [
        property.name.getText(source),
        property.initializer.getText(source),
      ]),
  );
  assert.equal(
    feedbackStyles.get('backgroundColor'),
    'active ? feedbackFill : fill',
  );
  assert.equal(
    feedbackStyles.has('borderRadius'),
    false,
    '状态层不可覆盖调用方的18dp胶囊圆角',
  );
  assert.equal(
    feedbackStyles.has('height'),
    false,
    '状态层不可用固定高度阻断系统文字缩放',
  );
  const outline = content.elements[callerIndex + 2];
  assert.ok(ts.isBinaryExpression(outline));
  assert.equal(outline.left.getText(source), 'isWeb');
  assert.ok(ts.isObjectLiteralExpression(outline.right));
  const outlineStyles = new Map(
    outline.right.properties
      .filter(ts.isPropertyAssignment)
      .map((property) => [
        property.name.getText(source),
        property.initializer.getText(source),
      ]),
  );
  assert.equal(
    outlineStyles.get('outlineWidth'),
    '!disabled && keyboardFocus.focusVisible ? 2 : 0',
  );
  assert.equal(outlineStyles.get('outlineOffset'), '-2');
  for (const event of [
    'onPointerEnter',
    'onPointerLeave',
    'onFocus',
    'onBlur',
    'onPressIn',
    'onPressOut',
  ]) {
    assert.ok(
      attribute(event)
        .getText(source)
        .includes(event + '?.(event)'),
      event + ' 必须保留调用方回调',
    );
  }
  assert.ok(
    text.includes('!disabled') &&
      text.includes('!selected') &&
      text.includes('(isWeb && hovered) || pressed'),
  );
  assert.ok(text.includes('minWidth: 48'));
  assert.ok(text.includes('minHeight: 48'));
});
