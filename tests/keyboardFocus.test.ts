import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { createKeyboardModality } from '../src/ui/keyboardFocusModel';

test('键盘模式延迟订阅DOM，指针和触摸取消焦点框，键盘恢复可见且退出清理监听', () => {
  const target = new EventTarget();
  let reads = 0;
  let updates = 0;
  const modality = createKeyboardModality(() => {
    reads += 1;
    return target;
  });
  assert.equal(reads, 0);
  assert.equal(modality.getServerSnapshot(), false);
  const stop = modality.subscribe(() => {
    updates += 1;
  });
  assert.equal(reads, 1);
  for (const event of ['pointerdown', 'mousedown', 'touchstart']) {
    target.dispatchEvent(new Event(event));
    assert.equal(modality.getSnapshot(), false);
    const key = new Event('keydown');
    Object.assign(key, {
      key: 'Tab',
      altKey: false,
      ctrlKey: false,
      metaKey: false,
    });
    target.dispatchEvent(key);
    assert.equal(modality.getSnapshot(), true);
  }
  const modifier = new Event('keydown');
  target.dispatchEvent(new Event('pointerdown'));
  Object.assign(modifier, { key: 'c', ctrlKey: true });
  target.dispatchEvent(modifier);
  assert.equal(modality.getSnapshot(), false);
  const count = updates;
  stop();
  target.dispatchEvent(new Event('keydown'));
  assert.equal(updates, count);
  assert.equal(modality.getSnapshot(), false);
});

test('旧主题共享卡片无常驻描边，新主题条件描边，图标以名称和读屏表达选择', () => {
  const source = readFileSync(
    new URL('../src/ui/components.tsx', import.meta.url),
    'utf8',
  );
  assert.equal((source.match(/borderWidth: 1/g) ?? []).length, 1);
  assert.match(
    source,
    /quiet && \{ borderWidth: 1, borderColor: colors\.border \}/,
  );
  assert.equal(source.includes('outlined ? 1'), false);
  assert.ok(source.includes('filled || outlined'));
  assert.ok(source.includes('keyboardFocus.focusVisible'));
  assert.ok(source.includes('checked: selected'));
  assert.equal(source.includes('source="check"'), false);
  assert.ok(source.includes('当前图标：'));
  assert.ok(source.includes('width: 32'));
  assert.ok(source.includes('height: 32'));
  assert.match(source, /source=\{name\}\s+size=\{18\}/);
  const parsed = ts.createSourceFile(
    'components.tsx',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const iconChoice = parsed.statements.find(
    (node): node is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(node) && node.name?.text === 'IconChoice',
  );
  assert.ok(iconChoice);
  let background: ts.Expression | undefined;
  let hot: ts.Expression | undefined;
  function visit(node: ts.Node) {
    if (
      ts.isPropertyAssignment(node) &&
      node.name.getText(parsed) === 'backgroundColor' &&
      ts.isConditionalExpression(node.initializer)
    )
      background = node.initializer;
    if (ts.isVariableDeclaration(node) && node.name.getText(parsed) === 'hot')
      hot = node.initializer;
    ts.forEachChild(node, visit);
  }
  visit(iconChoice);
  assert.ok(background);
  assert.ok(hot);
  const evaluate = new Function(
    'selected',
    'hovered',
    'pressed',
    'colors',
    `const hot = ${hot.getText(parsed)}; return ${background.getText(parsed)};`,
  );
  const colors = {
    selectedIcon: 'selected',
    brandFill: 'hover',
    field: 'idle',
  };
  for (const selected of [false, true]) {
    for (const hovered of [false, true]) {
      for (const pressed of [false, true]) {
        assert.equal(
          evaluate(selected, hovered, pressed, colors),
          selected
            ? colors.selectedIcon
            : hovered || pressed
              ? colors.brandFill
              : colors.field,
        );
      }
    }
  }
  assert.ok(source.includes('selected ? colors.surface : colors.primary'));
  assert.match(source, /scale: selected && hot \? 0\.88 : 1/);
  const nativeTime = readFileSync(
    new URL('../src/ui/TimeField.tsx', import.meta.url),
    'utf8',
  );
  assert.ok(nativeTime.includes('borderWidth: 0'));
  assert.ok(nativeTime.includes('backgroundColor: colors.field'));
});
