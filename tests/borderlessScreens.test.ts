import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), 'utf8');

test('所有页面输入复用无描边填色控件，标签和既有属性不丢失', () => {
  for (const name of [
    'TodayScreen',
    'TicketsScreen',
    'MilestonesScreen',
    'MoreScreens',
  ]) {
    const source = read('../src/screens/' + name + '.tsx');
    const file = ts.createSourceFile(
      name,
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    const imports = file.statements.filter(ts.isImportDeclaration);
    const paper = imports.find(
      (node) => node.moduleSpecifier.getText(file) === "'react-native-paper'",
    );
    const bindings = paper?.importClause?.namedBindings;
    assert.equal(
      bindings && ts.isNamedImports(bindings)
        ? bindings.elements.some((element) => element.name.text === 'TextInput')
        : false,
      false,
    );
    assert.ok(source.includes('AppTextInput as TextInput'));
    assert.ok(source.includes('label='));
  }
  const input = read('../src/ui/AppTextInput.tsx');
  assert.ok(input.includes('forwardRef<'));
  assert.ok(input.includes('{...props}'));
  assert.ok(input.includes("typeof ref === 'function'"));
  assert.ok(input.includes('ref.current = instance'));
  assert.ok(
    input.includes('outlineStyle={[outlineStyle, { borderWidth: 0 }]}'),
  );
  assert.ok(input.includes('theme.colors.surfaceVariant'));
  assert.ok(
    input.replace(/\s+/g, '').includes('focused?colors.primaryContainer'),
  );
  assert.ok(input.includes('onFocus?.(event)'));
  assert.ok(input.includes('onBlur?.(event)'));
  assert.ok(input.includes('label={undefined}'));
  assert.ok(input.includes('nativeID={labelId}'));
  assert.ok(input.includes('accessibilityLabelledBy={'));
  assert.ok(input.includes("typeof label === 'string' ? label : undefined"));
  assert.ok(input.includes('inputRef.current?.focus()'));
  assert.ok(input.includes('if (!props.disabled)'));
  assert.ok(input.includes('fontSize: 12'));
  assert.ok(input.includes('lineHeight: 18'));
  assert.ok(input.includes('alert-circle-outline'));
  assert.ok(input.includes('error={error}'));
  assert.ok(input.includes('keyboardFocus.focusVisible ? 2 : 0'));
  assert.ok(input.includes('keyboardFocus.onFocus()'));
  assert.ok(input.includes('keyboardFocus.onBlur()'));
  const milestone = read('../src/screens/MilestonesScreen.tsx');
  assert.ok(milestone.includes('onFocus={searchFocus.onFocus}'));
  assert.ok(milestone.includes('onBlur={searchFocus.onBlur}'));
  assert.ok(milestone.includes('searchFocus.focusVisible ? 2 : 0'));
});

test('底栏与任务菜单无装饰边框，周历使用选中填色且保留选中语义', () => {
  const app = read('../App.tsx');
  assert.equal(app.includes('borderTopWidth:'), false);
  const today = read('../src/screens/TodayScreen.tsx');
  const menuStart = today.indexOf('<Menu');
  const menu = today.slice(
    menuStart,
    today.indexOf('visible={menuId', menuStart),
  );
  assert.equal(menu.includes('borderWidth'), false);
  assert.equal(menu.includes('borderColor'), false);
  const strip = today.slice(
    today.indexOf('stats.days.map'),
    today.indexOf('每 {state.settings.threshold}'),
  );
  assert.equal(strip.includes('borderWidth'), false);
  assert.ok(strip.includes('selected: calendar.isSelected'));
  assert.equal(strip.includes(' ✓'), false);
  assert.ok(strip.includes('week-date-circle'));
  assert.ok(strip.includes('已选'));
  assert.ok(strip.includes('calendar.isSelected'));
  assert.ok(strip.includes('colors.primaryContainer'));
});
