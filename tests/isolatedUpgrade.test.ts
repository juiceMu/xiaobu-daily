import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const read = (path: string) =>
  readFileSync(new URL('../' + path, import.meta.url), 'utf8');

test('执行真实升级入口只注册原App并显式关闭LAN，不调用任何测试初始化', () => {
  const imports: string[] = [];
  let registered: (() => { type: unknown; props: unknown }) | undefined;
  let appRenders = 0;
  const App = () => {
    appRenders += 1;
  };
  const module = { exports: {} };
  const code = ts.transpileModule(read('upgrade/index.tsx'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.React,
      esModuleInterop: true,
    },
  }).outputText;
  const require = (name: string) => {
    imports.push(name);
    if (name === 'react')
      return {
        createElement: (type: unknown, props: unknown) => ({ type, props }),
      };
    if (name === 'expo')
      return {
        registerRootComponent: (component: typeof registered) => {
          assert.equal(registered, undefined);
          registered = component;
        },
      };
    if (name === '../App') return { __esModule: true, default: App };
    throw new Error('升级入口不允许额外初始化依赖：' + name);
  };
  new Function('require', 'module', 'exports', code)(
    require,
    module,
    module.exports,
  );
  assert.deepEqual(imports, ['react', 'expo', '../App']);
  assert.equal(appRenders, 0);
  assert.ok(registered);
  assert.deepEqual(registered(), { type: App, props: { lanEnabled: false } });
});

test('升级variant继承release签名、禁备份且只使用专用production bundle', () => {
  const gradle = read('android/app/build.gradle');
  const block = gradle.match(
    /        isolatedUpgrade \{([\s\S]*?)\n        \}/,
  )?.[1];
  assert.ok(block);
  assert.match(block, /initWith release/);
  assert.match(block, /debuggable false/);
  assert.match(block, /applicationIdSuffix "\.isolatedqa"/);
  assert.match(block, /matchingFallbacks = \['release'\]/);
  assert.match(block, /appScheme: "sprout-isolatedqa"/);
  assert.doesNotMatch(block, /signingConfig|versionCode|versionName/);
  assert.match(
    gradle,
    /withBuildType\("isolatedUpgrade"\)[\s\S]*?tasks.named\("createBundleIsolatedUpgradeJsAndAssets"\)[\s\S]*?entryFile.set\(file\("\.\.\/\.\.\/upgrade\/index.tsx"\)\)[\s\S]*?devEnabled.set\(false\)/,
  );
  assert.match(
    read('android/app/src/isolatedUpgrade/AndroidManifest.xml'),
    /android:allowBackup="false"/,
  );
  assert.match(
    read('android/app/src/isolatedUpgrade/res/values/strings.xml'),
    /小步升级验收/,
  );
});

test('只读预检明确覆盖保留旧存档，不执行Gradle或声称新安装空间', () => {
  const result = spawnSync(
    process.execPath,
    ['scripts/build-apk.mjs', '--isolated-upgrade', '--check'],
    { cwd: new URL('..', import.meta.url), encoding: 'utf8' },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /com.smallsteps.checkin.isolatedqa/);
  assert.match(result.stdout, /覆盖升级既有 isolatedqa，保留其存档/);
  assert.doesNotMatch(result.stdout, /不替换用户应用|BUILD SUCCESSFUL/);
});
