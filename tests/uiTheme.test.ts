import { bottomNavigationHeight } from '../src/ui/taskMenuLayout';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import {
  defaultColors,
  themeOptions,
  utilityColors,
} from '../src/ui/themeCatalog';

// 主题和结构回归，不替代浏览器/真机上的实际视觉验收。
const themeText = readFileSync(
  new URL('../src/ui/theme.ts', import.meta.url),
  'utf8',
);
test('各主题的禁用按钮使用统一中性灰背景与前景', () => {
  const components = readFileSync(
    new URL('../src/ui/components.tsx', import.meta.url),
    'utf8',
  );
  assert.match(
    themeText,
    /surfaceDisabled: palette \? colors\.field : '#E9EBE9'/,
  );
  assert.match(themeText, /onSurfaceDisabled: '#707570'/);
  assert.match(
    components,
    /const fill =[\s\S]*?theme\.colors\.surfaceDisabled/,
  );
  assert.ok(contrast('#707570', '#E9EBE9') >= 3);
});
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
test('新主题的进度填充与实际轨道有足够区分', () => {
  const today = readFileSync(
    new URL('../src/screens/TodayScreen.tsx', import.meta.url),
    'utf8',
  );
  assert.match(
    today,
    /backgroundColor: quiet \? signal : theme\.colors\.primary/,
  );
  assert.match(themeText, /surfaceVariant: colors\.field/);
  assert.match(today, /backgroundColor: theme\.colors\.surfaceVariant/);
  for (const option of themeOptions.filter((item) => item.quiet)) {
    assert.ok(option.signal, `${option.id} 缺少进度颜色`);
    assert.ok(
      contrast(option.signal, option.colors.field) >= 3,
      `${option.id}: 进度填充与轨道对比度不足`,
    );
  }
});
test('赠券发出及收到记录使用主题行间分隔且文字在各主题可读', () => {
  const gifts = readFileSync(
    new URL('../src/screens/GiftsScreen.tsx', import.meta.url),
    'utf8',
  );
  const entries = gifts.slice(
    gifts.indexOf('<SectionTitle title="本机发出"'),
    gifts.indexOf('<Confirm', gifts.indexOf('<SectionTitle title="本机收到"')),
  );
  assert.equal((entries.match(/giftRowStyle,/g) ?? []).length, 2);
  const giftRowStyle = gifts.slice(
    gifts.indexOf('const giftRowStyle = {'),
    gifts.indexOf('};', gifts.indexOf('const giftRowStyle = {')),
  );
  assert.doesNotMatch(giftRowStyle, /backgroundColor/);
  assert.match(gifts, /borderColor: colors\.border/);
  assert.match(gifts, /borderBottomWidth: 1/);
  assert.match(gifts, /paddingVertical: 8/);
  assert.equal((entries.match(/index === \w+\.length - 1/g) ?? []).length, 2);
  assert.doesNotMatch(giftRowStyle, /borderRadius|borderWidth/);
  for (const { id, colors } of themeOptions) {
    assert.ok(contrast(colors.ink, colors.surface) >= 4.5, `${id} 标题对比度`);
    assert.ok(
      contrast(colors.muted, colors.surface) >= 4.5,
      `${id} 说明对比度`,
    );
    assert.ok(
      Math.abs(luminance(colors.surface) - luminance(colors.border)) >= 0.1,
      `${id} 分隔线与面板底区分`,
    );
  }
});
test('各主题按钮的文字与语义填充达到正文对比度', () => {
  for (const { id, colors } of themeOptions) {
    for (const [foreground, background] of [
      [colors.onBrand, colors.brandFill],
      [colors.onSave, colors.save],
      [colors.onReward, colors.reward],
      [colors.onArchive, colors.archive],
    ]) {
      assert.ok(contrast(foreground, background) >= 4.5, id);
    }
  }
});
test('共享主题填充色彼此区分，主题及禁用前景保持可辨', () => {
  for (const { id, colors } of themeOptions.filter(
    (option) => !option.palette,
  )) {
    assert.notEqual(colors.brandFill, colors.primaryContainer, id);
    assert.ok(contrast(colors.primary, colors.brandFill) >= 3, id);
    assert.ok(contrast(colors.primary, colors.primaryContainer) >= 3, id);
  }
  assert.ok(contrast('#707570', '#E9EBE9') >= 3);
});
test('奖励按钮在森林、海盐和鸢尾跟随主题，其他主题保留奖励配色', () => {
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
  let initializer: ts.Expression | undefined;
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'tones')
      initializer = node.initializer;
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(initializer);
  const getTones = new Function(
    'colors',
    'quiet',
    'utilityColors',
    'return (' + initializer.getText(source) + ')',
  ) as (
    colors: typeof defaultColors,
    quiet: boolean,
    utility: typeof utilityColors,
  ) => { reward: { fill: string; text: string } };
  for (const option of themeOptions) {
    const { colors } = option;
    const tone = getTones(colors, option.quiet === true, utilityColors).reward;
    assert.deepEqual(
      tone,
      option.quiet
        ? { fill: colors.brandFill, text: colors.onBrand }
        : { fill: colors.reward, text: colors.onReward },
      option.id,
    );
    assert.ok(contrast(tone.text, tone.fill) >= 4.5, option.id);
  }
});
test('浅暖灰米品牌填充与独立前景保持真实消费对比度', () => {
  const colors = defaultColors;
  assert.equal(colors.brandFill, '#DCCFBE');
  assert.equal(colors.onBrand, '#514B44');
  assert.equal(colors.primary, '#625B53');
  for (const option of themeOptions.filter((option) => !option.palette)) {
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
  for (const { id, colors: theme } of themeOptions.filter(
    (option) => !option.palette,
  )) {
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
test('共享按钮使用 44 热区，保留 28 和 26 视觉档位', () => {
  const source = readFileSync(
    new URL('../src/ui/components.tsx', import.meta.url),
    'utf8',
  );
  assert.match(
    source,
    /const visuals = size === 'sm' \? control\[26\] : control\[28\]/,
  );
  assert.match(source, /minWidth: control\[44\],\s*minHeight: control\[44\]/);
  assert.match(source, /minHeight: visuals/);
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
  assert.ok(
    app.includes('height: bottomNavigationHeight(fontScale, insets.bottom)'),
  );
  for (const bottom of [0, 20, 34]) {
    for (const scale of [1, 1.25, 1.5, 2]) {
      const reserved = bottom + 12;
      assert.equal(
        bottomNavigationHeight(scale, bottom) - reserved,
        64 + Math.max(0, Math.min(scale, 1.5) - 1) * 32,
      );
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
  for (const semantic of ['save', 'archive']) {
    assert.ok(text.includes(`${semantic}: { fill: colors.${semantic}`));
  }
  assert.match(
    text,
    /reward:\s*quiet\s*\?\s*\{ fill: colors\.brandFill, text: colors\.onBrand \}\s*:\s*\{ fill: colors\.reward, text: colors\.onReward \}/,
  );
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
  assert.ok(close.includes('width: control[44]'));
  assert.ok(close.includes("backgroundColor: 'transparent'"));
  assert.doesNotMatch(close, /onPressIn|onPressOut/);
  for (const level of [1, 2, 3, 4, 5])
    assert.ok(themeText.includes('level' + level + ':'));
  for (const oldColor of ['#64617C', '#EDF3F8', '#F2F6FA'])
    assert.equal(themeText.includes(oldColor), false);
});

test('共享按钮忙碌时锁定按压并保留原文，焦点与加载语义独立', () => {
  const source = readFileSync(
    new URL('../src/ui/components.tsx', import.meta.url),
    'utf8',
  );
  const button = source.slice(
    source.indexOf('export const ActionButton'),
    source.indexOf('export function SectionTitle'),
  );
  assert.match(button, /const unavailable = !!disabled \|\| loading/);
  assert.match(button, /disabled=\{unavailable\}/);
  assert.match(button, /aria-busy=\{loading\}/);
  assert.match(button, /pressed && !unavailable \? \{ opacity: 0.82 \}/);
  assert.match(
    button,
    /outlineWidth: !unavailable && keyboardFocus.focusVisible \? 2 : 0/,
  );
  assert.match(button, /outlineOffset: 2/);
  assert.match(button, /color: loading \? 'transparent' : foreground/);
  assert.match(button, /StyleSheet.absoluteFill/);
  assert.match(button, /reducedMotion[\s\S]*ActivityIndicator/);
  assert.match(button, /onFocus\?\.\(event\)/);
  assert.match(button, /onBlur\?\.\(event\)/);
});

test('三套柔彩主题的配色满足实色、浅底和控件轮廓对比度', () => {
  for (const { id, palette, colors } of themeOptions) {
    if (!palette) continue;
    for (const tone of Object.values(palette)) {
      assert.ok(contrast(utilityColors.onSolid, tone.solid) >= 4.5, id);
      assert.ok(contrast(tone.ink, tone.soft) >= 4.5, id);
    }
    for (const bg of [colors.surface, colors.background, colors.field]) {
      assert.ok(contrast(colors.ink, bg) >= 4.5, id);
      assert.ok(contrast(colors.muted, bg) >= 4.5, id);
    }
    assert.ok(contrast(colors.border, colors.surface) >= 3, id);
    assert.ok(contrast(colors.border, colors.background) >= 3, id);
  }
});
