import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { extractPathFromURL } from '../node_modules/@react-navigation/native/src/extractPathFromURL';
import { getStateFromPath } from '../node_modules/@react-navigation/core/src/getStateFromPath';

// 抽取应用真实配置，再执行导航库解析；不代替系统派发、页面授权与返回键真机验收。
const source = ts.createSourceFile(
  'App.tsx',
  readFileSync(new URL('../App.tsx', import.meta.url), 'utf8'),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
let initializer: ts.Expression | undefined;
function visit(node: ts.Node) {
  if (
    ts.isVariableDeclaration(node) &&
    node.name.getText(source) === 'linking' &&
    node.initializer &&
    ts.isObjectLiteralExpression(node.initializer)
  ) {
    initializer = node.initializer;
  }
  ts.forEachChild(node, visit);
}
visit(source);
assert.ok(initializer);
const expression = ts.transpileModule(
  `return (${initializer.getText(source)});`,
  {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
  },
).outputText;
const developmentPrefix = 'exp://127.0.0.1:8081/--/';
const linking = new Function('Linking', expression)({
  createURL: (path: string) => {
    assert.equal(path, '/');
    return developmentPrefix;
  },
}) as {
  prefixes: string[];
  config: Parameters<typeof getStateFromPath>[1];
};

function parse(url: string) {
  const path = extractPathFromURL(linking.prefixes, url);
  return path === undefined
    ? undefined
    : getStateFromPath(path, linking.config);
}

for (const prefix of [
  'sprout://',
  'sprout-qa://',
  'sprout-acceptanceqa://',
  'sprout-freshacceptanceqa://',
  'sprout-fixtureqa://',
  'sprout-isolatedqa://',
  'sprout-peerprotectionqa://',
  developmentPrefix,
]) {
  test(`${prefix}解析账户/成长/赠券/小组/设置并保留更多总览返回入口`, () => {
    for (const page of ['account', 'growth', 'gifts', 'group', 'settings']) {
      const state = parse(`${prefix}more/${page}`);
      assert.ok(state, page);
      assert.equal(state.routes.at(-1)?.name, 'more');
      const nested = state.routes.at(-1)?.state;
      assert.deepEqual(
        nested?.routes.map((route) => route.name),
        ['index', page],
      );
      assert.equal(nested?.index, 1);
    }
    for (const tab of ['today', 'tickets']) {
      assert.equal(parse(`${prefix}${tab}`)?.routes.at(-1)?.name, tab);
    }
    const member = parse(`${prefix}more/member/test-account`);
    assert.equal(member?.routes.at(-1)?.state?.routes.at(-1)?.name, 'member');
    assert.deepEqual(member?.routes.at(-1)?.state?.routes.at(-1)?.params, {
      accountId: 'test-account',
    });
  });
}

test('拒绝未知协议、相似协议、非法页面与缺失成员参数', () => {
  for (const url of [
    'unknown://more/account',
    'sprout-peerprotectionqa-other://more/settings',
    'sprout-peerprotectionqa://more/member',
    'sprout-peerprotectionqa://more/not-a-page',
    'sprout-isolatedqa-other://more/settings',
    'sprout-isolatedqa://more/member',
    'sprout-isolatedqa://more/not-a-page',
    'sprout-qa-other://more/account',
    'sprout-acceptanceqa-other://more/settings',
    'sprout-freshacceptanceqa-other://more/settings',
    'sprout-acceptance://more/settings',
    'sprout-acceptanceqa://more/not-a-page',
    'sprout-acceptanceqa://more/member',
    'sprout-fixtureqa-other://more/settings',
    'sprout-fixtureqa://more/member',
    'sprout://more/not-a-page',
    'sprout-qa://more/member',
  ]) {
    assert.equal(parse(url), undefined, url);
  }
});

test('正式、QA与验收原生协议各自注册，JS兼容前缀不扩大系统注册范围', () => {
  const gradle = readFileSync(
    new URL('../android/app/build.gradle', import.meta.url),
    'utf8',
  );
  const manifest = readFileSync(
    new URL('../android/app/src/main/AndroidManifest.xml', import.meta.url),
    'utf8',
  );
  const config = JSON.parse(
    readFileSync(new URL('../app.json', import.meta.url), 'utf8'),
  );
  assert.equal(config.expo.scheme, 'sprout');
  assert.match(gradle, /manifestPlaceholders\s*=\s*\[appScheme:\s*"sprout"\]/);
  assert.match(
    gradle,
    /qa\s*\{[\s\S]*?applicationIdSuffix\s+"\.qa"[\s\S]*?manifestPlaceholders\s*=\s*\[appScheme:\s*"sprout-qa"\]/,
  );
  assert.match(
    gradle,
    /acceptance\s*\{[\s\S]*?applicationIdSuffix\s+"\.acceptanceqa"[\s\S]*?manifestPlaceholders\s*=\s*\[appScheme:\s*"sprout-acceptanceqa"\]/,
  );
  assert.match(manifest, /android:scheme="\$\{appScheme\}"/);
  assert.match(
    gradle,
    /freshAcceptance\s*\{[\s\S]*?initWith acceptance[\s\S]*?applicationIdSuffix\s+"\.freshacceptanceqa"[\s\S]*?manifestPlaceholders\s*=\s*\[appScheme:\s*"sprout-freshacceptanceqa"\]/,
  );
  const freshManifest = readFileSync(
    new URL(
      '../android/app/src/freshAcceptance/AndroidManifest.xml',
      import.meta.url,
    ),
    'utf8',
  );
  assert.match(freshManifest, /android:allowBackup="false"/);
  assert.match(
    gradle,
    /createBundleFreshAcceptanceJsAndAssets[\s\S]*?acceptance\/fresh\.tsx[\s\S]*?devEnabled\.set\(false\)/,
  );
  assert.match(
    gradle,
    /fixture\s*\{[\s\S]*?applicationIdSuffix\s+"\.fixtureqa"[\s\S]*?manifestPlaceholders\s*=\s*\[appScheme:\s*"sprout-fixtureqa"\]/,
  );
  assert.doesNotMatch(
    manifest,
    /android:scheme="sprout(?:-qa|-acceptanceqa|-fixtureqa)?"/,
  );
});
