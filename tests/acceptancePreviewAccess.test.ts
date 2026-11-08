import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import ts from 'typescript';

const root = resolve(import.meta.dirname, '..');

// 执行真实入口的模块初始化，原生/React边界使用替身，不冒充UI挂载。
function loadEntry(
  entry: 'index.ts' | 'acceptance/index.tsx' | 'acceptance/fresh.tsx',
) {
  const modules = new Map<string, Record<string, unknown>>();
  const appImportAccess: boolean[] = [];
  const rootRegistrationAccess: boolean[] = [];
  const accessPath = resolve(root, 'src/ui/demoPreviewAccess.ts');
  const load = (file: string): Record<string, unknown> => {
    const cached = modules.get(file);
    if (cached) return cached;
    const exports: Record<string, unknown> = {};
    modules.set(file, exports);
    const requireModule = (name: string): unknown => {
      if (name === 'expo')
        return {
          registerRootComponent() {
            rootRegistrationAccess.push(
              (
                load(accessPath).isAcceptanceDemoPreviewAllowed as () => boolean
              )(),
            );
          },
        };
      if (name === 'react') return {};
      if (name === 'react-native')
        return {
          StyleSheet: { create: (value: unknown) => value },
          StatusBar: {},
        };
      const target = resolve(dirname(file), name);
      if (target === resolve(root, 'App')) {
        appImportAccess.push(
          (load(accessPath).isAcceptanceDemoPreviewAllowed as () => boolean)(),
        );
        return { default: () => null };
      }
      if (target === resolve(root, 'src/state/groupViewStorage'))
        return { groupViewRepository: { async save() {} } };
      if (target === resolve(root, 'src/state/nativeRepository'))
        return {
          nativeRepository: {
            async save() {},
            async load() {
              return null;
            },
          },
        };
      if (target === resolve(root, 'src/ui/useAndroidMountReady')) return {};
      if (target === resolve(root, 'acceptance/demoDateControl'))
        return { createDemoDateControl: () => ({}) };
      if (name.startsWith('.')) {
        const resolved = [`${target}.ts`, `${target}.tsx`].find(existsSync);
        assert.ok(resolved, `未找到依赖：${name}`);
        return load(resolved);
      }
      throw new Error(`未提供入口依赖：${name}`);
    };
    const source = ts.transpileModule(readFileSync(file, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.React,
      },
    }).outputText;
    new Function('exports', 'require', source)(exports, requireModule);
    return exports;
  };
  load(resolve(root, entry));
  return {
    appImportAccess,
    rootRegistrationAccess,
    access: load(accessPath).isAcceptanceDemoPreviewAllowed as () => boolean,
  };
}

test('生产模式普通入口默认无演示许可，验收入口在注册根组件前显式开启', () => {
  const regular = loadEntry('index.ts');
  assert.deepEqual(regular.appImportAccess, [false]);
  assert.deepEqual(regular.rootRegistrationAccess, [false]);
  assert.equal(regular.access(), false);
  const fresh = loadEntry('acceptance/fresh.tsx');
  assert.deepEqual(fresh.appImportAccess, [false]);
  assert.deepEqual(fresh.rootRegistrationAccess, [true]);
  assert.equal(fresh.access(), true);

  const acceptance = loadEntry('acceptance/index.tsx');
  assert.deepEqual(acceptance.appImportAccess, [false]);
  assert.deepEqual(acceptance.rootRegistrationAccess, [true]);
  assert.equal(acceptance.access(), true);
  // 两个独立模块环境不共享许可，验收注册不会泄露到普通入口。
  assert.equal(regular.access(), false);
});

test('设置页实际门控在渲染时读取许可，production普通入口关闭而验收可见', () => {
  const file = resolve(root, 'src/screens/MoreScreens.tsx');
  const source = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  let expression: ts.Expression | undefined;
  const visit = (node: ts.Node) => {
    if (
      ts.isJsxExpression(node) &&
      node.expression?.getText(source).includes('<DemoHistoryPanel />')
    )
      expression = node.expression;
    ts.forEachChild(node, visit);
  };
  visit(source);
  assert.ok(expression);
  const compiled = ts.transpileModule(
    `function render() { return (${expression.getText(source)}); }`,
    { compilerOptions: { jsx: ts.JsxEmit.React } },
  ).outputText;
  let allowed = false;
  const render = new Function(
    '__DEV__',
    'isAcceptanceDemoPreviewAllowed',
    'React',
    'DemoHistoryPanel',
    `${compiled}; return render;`,
  )(
    false,
    () => allowed,
    { createElement: (component: unknown) => component },
    'demo-panel',
  ) as () => unknown;
  assert.equal(render(), false);
  allowed = true;
  assert.equal(render(), 'demo-panel');
});
