import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source = ts.createSourceFile(
  'AppProvider.tsx',
  readFileSync(
    new URL('../src/state/AppProvider.tsx', import.meta.url),
    'utf8',
  ),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
let listen: ts.Node | undefined;
let sync: ts.Node | undefined;
let defaultEnabled: ts.Node | undefined;
function visit(node: ts.Node) {
  if (ts.isBindingElement(node) && node.name.getText(source) === 'lanEnabled')
    defaultEnabled = node.initializer;
  if (
    ts.isCallExpression(node) &&
    node.expression.getText(source) === 'useEffect' &&
    node.arguments[0]?.getText(source).includes('const stop = startLanListener')
  )
    listen = node.arguments[0];
  if (
    ts.isVariableDeclaration(node) &&
    node.name.getText(source) === 'syncGroup'
  ) {
    assert.ok(node.initializer && ts.isCallExpression(node.initializer));
    sync = node.initializer.arguments[0];
  }
  ts.forEachChild(node, visit);
}
visit(source);
assert.ok(listen && sync && defaultEnabled);
const make = (node: ts.Node, dependencies: Record<string, unknown>) =>
  new Function(
    ...Object.keys(dependencies),
    ts.transpileModule(`return (${node.getText(source)});`, {
      compilerOptions: { target: ts.ScriptTarget.ES2022 },
    }).outputText,
  )(...Object.values(dependencies));

test('LAN默认开启；夹具关闭时不监听、不交换且不显示同步成功', async () => {
  const defaultValue = new Function(
    `return ${defaultEnabled!.getText(source)}`,
  )();
  assert.equal(defaultValue, true);
  for (const lanEnabled of [false, defaultValue]) {
    let listeners = 0;
    let stopped = 0;
    let exchanges = 0;
    const messages: string[] = [];
    const deps = {
      lanEnabled,
      store: {
        getSnapshot: () => ({
          state: {
            groupLink: { groupId: 'fixture-group', secret: 'fixture-secret' },
            sync: { accountId: 'fixture-self' },
          },
          busy: false,
        }),
      },
      Platform: { OS: 'android' },
      appActive: true,
      startLanListener: () => {
        listeners += 1;
        return () => {
          stopped += 1;
        };
      },
      sessionOptions: () => ({}),
      journalsForSend: () => [],
      setMessage: (value: string) => messages.push(value),
      manualSyncActive: { current: false },
      peerDidNotStoreJournal: { current: false },
      setSyncing: () => {},
      setSyncStatus: () => {},
      syncCompanionRounds: async (
        getState: () => unknown,
        exchange: (state: unknown) => Promise<void>,
      ) => {
        await exchange(getState());
      },
      exchangeOnLan: async () => {
        exchanges += 1;
      },
      hasPendingCompanionUse: () => false,
    };
    const cleanup = make(listen!, deps)();
    await make(sync!, deps)();
    assert.equal(listeners, lanEnabled ? 1 : 0);
    assert.equal(exchanges, lanEnabled ? 1 : 0);
    if (!lanEnabled)
      assert.deepEqual(messages, ['此独立夹具入口已禁用局域网，不会同步记录']);
    else assert.equal(messages.at(-1), '局域网同步完成');
    cleanup?.();
    assert.equal(stopped, lanEnabled ? 1 : 0);
  }
});

test('夹具入口隔离、生产bundle与禁备份声明，默认导航Provider层级保留', () => {
  const read = (path: string) =>
    readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
  const gradle = read('android/app/build.gradle');
  assert.match(
    gradle,
    /fixture\s*\{[\s\S]*?initWith release[\s\S]*?debuggable false[\s\S]*?applicationIdSuffix "\.fixtureqa"/,
  );
  assert.match(
    gradle,
    /withBuildType\("fixture"\)[\s\S]*?entryFile.set\(file\("\.\.\/\.\.\/fixture\/index.tsx"\)\)[\s\S]*?devEnabled.set\(false\)/,
  );
  assert.match(
    read('android/app/src/fixture/AndroidManifest.xml'),
    /android:allowBackup="false"/,
  );
  assert.match(
    read('android/app/src/fixture/res/values/strings.xml'),
    /小步夹具/,
  );
  assert.match(
    read('fixture/index.tsx'),
    /<App lanEnabled=\{false\}>[\s\S]*?<FixtureControls \/>/,
  );
  assert.doesNotMatch(
    read('fixture/index.tsx'),
    /registerAcceptanceDemoPreview|loadDemoHistory/,
  );
  assert.match(
    read('App.tsx'),
    /<AppProvider\s+lanEnabled=\{lanEnabled\}\s+demoHistoryLoader=\{demoHistoryLoader\}\s*>\s*<GroupViewProvider>\s*<Navigation \/>\s*\{children\}\s*<\/GroupViewProvider>/,
  );
});

test('首次导入验收入口单独禁用LAN，不改变普通验收或正式入口', () => {
  const read = (path: string) =>
    readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
  const gradle = read('android/app/build.gradle');
  assert.match(
    gradle,
    /withBuildType\("acceptance"\)[\s\S]*?entryFile.set\(file\("\.\.\/\.\.\/acceptance\/index.tsx"\)\)/,
  );
  assert.match(
    gradle,
    /withBuildType\("freshAcceptance"\)[\s\S]*?entryFile.set\(file\("\.\.\/\.\.\/acceptance\/fresh.tsx"\)\)[\s\S]*?devEnabled.set\(false\)/,
  );
  assert.match(
    gradle,
    /scenarioAcceptance\s*\{[\s\S]*?initWith freshAcceptance[\s\S]*?applicationIdSuffix "\.scenarioacceptanceqa"[\s\S]*?sprout-scenarioacceptanceqa/,
  );
  assert.match(
    gradle,
    /withBuildType\("scenarioAcceptance"\)[\s\S]*?entryFile.set\(file\("\.\.\/\.\.\/acceptance\/scenario.tsx"\)\)[\s\S]*?devEnabled.set\(false\)/,
  );
  assert.match(
    read('android/app/src/scenarioAcceptance/AndroidManifest.xml'),
    /android:allowBackup="false"/,
  );
  assert.match(read('App.tsx'), /sprout-scenarioacceptanceqa:\/\//);
  assert.match(
    read('acceptance/index.tsx'),
    /registerRootComponent\(AcceptanceApp\)/,
  );
  assert.match(
    read('acceptance/fresh.tsx'),
    /<AcceptanceApp lanEnabled=\{false\} demoControls \/>/,
  );
  assert.match(
    read('acceptance/AcceptanceApp.tsx'),
    /<App\s+lanEnabled=\{lanEnabled\}\s+demoHistoryLoader=\{demoControls \? demoDate\.load : undefined\}\s*\/>/,
  );
});

test('夹具控制仅展开后挂原生Modal，系统返回清除确认并关闭，保留门控及模态语义', () => {
  const text = readFileSync(
    new URL('../fixture/index.tsx', import.meta.url),
    'utf8',
  );
  assert.match(text, /useAndroidMountReady\(600\)/);
  assert.match(text, /if \(!ready\) return null/);
  assert.match(
    text,
    /return open \? \(\s*<Modal visible animationType="none" onRequestClose=\{close\}>/,
  );
  assert.match(
    text,
    /collapsable=\{false\}\s+accessibilityViewIsModal\s+aria-modal/,
  );
  assert.doesNotMatch(text, /BackHandler|visible=\{open\}/);
  const tree = ts.createSourceFile(
    'fixture.tsx',
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  let close: ts.FunctionDeclaration | undefined;
  const find = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === 'close')
      close = node;
    ts.forEachChild(node, find);
  };
  find(tree);
  assert.ok(close);
  const events: [string, boolean][] = [];
  const callback = new Function(
    'setConfirm',
    'setOpen',
    ts.transpileModule(`return (${close.getText(tree)});`, {
      compilerOptions: { target: ts.ScriptTarget.ES2022 },
    }).outputText,
  )(
    (value: boolean) => events.push(['confirm', value]),
    (value: boolean) => events.push(['open', value]),
  );
  callback();
  assert.deepEqual(events, [
    ['confirm', false],
    ['open', false],
  ]);
});
