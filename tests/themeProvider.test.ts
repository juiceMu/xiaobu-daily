import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import ts from 'typescript';
import type { ThemeId } from '../src/ui/themeCatalog';

const providerText = readFileSync(
  new URL('../src/ui/ThemeProvider.tsx', import.meta.url),
  'utf8',
);
const providerAst = ts.createSourceFile(
  'ThemeProvider.tsx',
  providerText,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
function findNode(predicate: (node: ts.Node) => boolean): ts.Node {
  let found: ts.Node | undefined;
  function visit(node: ts.Node) {
    if (!found && predicate(node)) found = node;
    ts.forEachChild(node, visit);
  }
  visit(providerAst);
  assert.ok(found, '主题实现节点应存在');
  return found;
}
const selection = findNode(
  (node) => ts.isFunctionDeclaration(node) && node.name?.text === 'selectTheme',
);
const effectCall = findNode(
  (node) =>
    ts.isCallExpression(node) &&
    node.expression.getText(providerAst) === 'useEffect',
) as ts.CallExpression;

// 执行源码中真实动作/加载回调并注入状态依赖，不模拟 React 渲染或视觉。
function compileExpression(source: string, names: string[], values: unknown[]) {
  const output = ts.transpileModule('const extracted = ' + source + ';', {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.None,
    },
  }).outputText;
  return new Function(...names, output + '\nreturn extracted;')(
    ...values,
  ) as unknown;
}
function harness(repository: {
  load(): Promise<ThemeId>;
  save(id: ThemeId): Promise<void>;
}) {
  const state = {
    themeId: 'warm' as ThemeId,
    ready: false,
    busy: false,
    error: '',
  };
  const changing = { current: false };
  const setters = {
    setThemeId(id: ThemeId) {
      state.themeId = id;
    },
    setThemeReady(value: boolean) {
      state.ready = value;
    },
    setThemeBusy(value: boolean) {
      state.busy = value;
    },
    setThemeError(value: string) {
      state.error = value;
    },
  };
  function select(id: ThemeId) {
    const action = compileExpression(
      selection.getText(providerAst),
      [
        'themeReady',
        'themeId',
        'themeError',
        'changing',
        'themePreferenceRepository',
        'setThemeId',
        'setThemeBusy',
        'setThemeError',
      ],
      [
        state.ready,
        state.themeId,
        state.error,
        changing,
        repository,
        setters.setThemeId,
        setters.setThemeBusy,
        setters.setThemeError,
      ],
    ) as (id: ThemeId) => Promise<boolean>;
    return action(id);
  }
  function load() {
    const effect = compileExpression(
      effectCall.arguments[0].getText(providerAst),
      [
        'themePreferenceRepository',
        'setThemeId',
        'setThemeError',
        'setThemeReady',
      ],
      [
        repository,
        setters.setThemeId,
        setters.setThemeError,
        setters.setThemeReady,
      ],
    ) as () => () => void;
    return effect();
  }
  return { state, changing, select, load };
}
const settle = () => new Promise<void>((resolve) => setImmediate(resolve));

test('主题加载完成前不可选择；持久化完成才提交并同步防连点', async () => {
  let resolveSave: (() => void) | undefined;
  const saves: ThemeId[] = [];
  const app = harness({
    load: async () => 'lavender',
    save: (id) => {
      saves.push(id);
      return new Promise<void>((resolve) => {
        resolveSave = resolve;
      });
    },
  });
  assert.equal(await app.select('mint'), false);
  assert.deepEqual(saves, []);
  app.load();
  await settle();
  assert.equal(app.state.themeId, 'lavender');
  assert.equal(app.state.ready, true);
  const saving = app.select('mint');
  assert.equal(app.state.busy, true);
  assert.equal(app.state.themeId, 'lavender');
  assert.equal(await app.select('peach'), false);
  assert.deepEqual(saves, ['mint']);
  assert.ok(resolveSave);
  resolveSave();
  assert.equal(await saving, true);
  assert.equal(app.state.themeId, 'mint');
  assert.equal(app.state.busy, false);
  assert.equal(app.changing.current, false);
});

test('主题保存失败保留旧主题并解锁，重试成功后才发布', async () => {
  let fails = true;
  const app = harness({
    load: async () => 'mint',
    save: async () => {
      if (fails) throw new Error('保存失败');
    },
  });
  app.load();
  await settle();
  assert.equal(await app.select('peach'), false);
  assert.equal(app.state.themeId, 'mint');
  assert.match(app.state.error, /保存失败/);
  assert.equal(app.state.busy, false);
  assert.equal(app.changing.current, false);
  fails = false;
  assert.equal(await app.select('peach'), true);
  assert.equal(app.state.themeId, 'peach');
  assert.equal(app.state.error, '');
});

test('主题读取失败不写默认值，可重选当前主题修复；卸载不发布加载结果', async () => {
  let saves = 0;
  const app = harness({
    load: async () => {
      throw new Error('读取失败');
    },
    save: async () => {
      saves++;
    },
  });
  app.load();
  await settle();
  assert.equal(app.state.themeId, 'warm');
  assert.equal(app.state.ready, true);
  assert.match(app.state.error, /读取失败/);
  assert.equal(saves, 0);
  assert.equal(await app.select('warm'), true);
  assert.equal(saves, 1);
  assert.equal(app.state.error, '');
  assert.equal(await app.select('warm'), true);
  assert.equal(saves, 1);
  const unmounted = harness({
    load: async () => 'peach',
    save: async () => {},
  });
  unmounted.load()();
  await settle();
  assert.equal(unmounted.state.themeId, 'warm');
  assert.equal(unmounted.state.ready, false);
});

test('主题切换不按颜色重建导航，颜色消费者订阅动态主题', () => {
  const appText = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  const ast = ts.createSourceFile(
    'App.tsx',
    appText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  let providers = 0;
  function visit(node: ts.Node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const name = node.tagName.getText(ast);
      if (name === 'ThemeProvider') providers++;
      if (
        /Provider$|Navigator$|^Navigation$|^NavigationContainer$/.test(name)
      ) {
        assert.equal(
          node.attributes.properties.some(
            (p) => ts.isJsxAttribute(p) && p.name.getText(ast) === 'key',
          ),
          false,
          name + '不应因主题重建',
        );
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.equal(providers, 1);
  assert.match(appText, /const \{ theme \} = useAppTheme\(\)/);
  const settings = readFileSync(
    new URL('../src/screens/MoreScreens.tsx', import.meta.url),
    'utf8',
  );
  for (const contract of [
    'themeOptions.map((option)',
    'selected={themeId === option.id}',
    'disabled={themeBusy || !themeReady}',
    'void selectTheme(option.id)',
    'accessibilityRole="radiogroup"',
    'message={themeError}',
  ])
    assert.ok(settings.includes(contract), contract);
  for (const dir of ['ui', 'screens']) {
    for (const name of readdirSync(
      new URL('../src/' + dir + '/', import.meta.url),
    ).filter((name) => /\.tsx$/.test(name))) {
      const text = readFileSync(
        new URL('../src/' + dir + '/' + name, import.meta.url),
        'utf8',
      );
      const file = ts.createSourceFile(
        name,
        text,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX,
      );
      for (const node of file.statements) {
        if (
          ts.isImportDeclaration(node) &&
          ts.isStringLiteral(node.moduleSpecifier) &&
          /(?:^|\/)theme$/.test(node.moduleSpecifier.text)
        ) {
          const bindings = node.importClause?.namedBindings;
          if (bindings && ts.isNamedImports(bindings))
            for (const imported of bindings.elements)
              assert.equal(
                ['colors', 'theme'].includes(
                  (imported.propertyName ?? imported.name).text,
                ),
                false,
                name + '不可静态消费主题',
              );
        }
      }
      if (/\bcolors\./.test(text)) assert.match(text, /useAppTheme\(\)/, name);
    }
  }
});
