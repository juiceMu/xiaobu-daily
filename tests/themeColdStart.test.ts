import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import {
  prepareThemeColdStart,
  THEME_READ_FAILURE_URL,
} from '../acceptance/themeColdStart';
import { installThemePreferenceControl } from '../acceptance/themePreferenceControl';

test('仅完整固定冷启动URL待命一次，读取失败不访问或改写原偏好，随后读取恢复', async () => {
  let reads = 0;
  let writes = 0;
  const repository = {
    async load() {
      reads += 1;
      return 'mint' as const;
    },
    async save() {
      writes += 1;
    },
  };
  const control = installThemePreferenceControl(repository);
  const message = await prepareThemeColdStart(
    async () => THEME_READ_FAILURE_URL,
    control,
  );
  assert.match(message, /已待命一次/);
  await assert.rejects(repository.load(), /验收注入/);
  assert.equal(reads, 0);
  assert.equal(writes, 0);
  assert.equal(await repository.load(), 'mint');
  assert.equal(reads, 1);
  assert.equal(writes, 0);
  assert.equal(control.getSnapshot().hits, 1);
});

test('普通启动及相似、编码、额外和重复参数均不待命', async () => {
  for (const url of [
    null,
    '',
    'sprout-scenarioacceptanceqa://more/settings',
    THEME_READ_FAILURE_URL.replace('scenarioacceptanceqa', 'acceptanceqa'),
    THEME_READ_FAILURE_URL.replace('sprout-', 'SPROUT-'),
    THEME_READ_FAILURE_URL.replace('/theme-', '/%74heme-'),
    THEME_READ_FAILURE_URL.replace('?once=1', '/?once=1'),
    `${THEME_READ_FAILURE_URL}&once=1`,
    `${THEME_READ_FAILURE_URL}&other=1`,
    `${THEME_READ_FAILURE_URL}#extra`,
    `${THEME_READ_FAILURE_URL} `,
  ]) {
    let arms = 0;
    const message = await prepareThemeColdStart(async () => url, {
      arm: () => {
        arms += 1;
        return true;
      },
    });
    assert.equal(arms, 0, String(url));
    assert.match(message, /未请求/);
  }
});

test('异常、拒绝待命和超时诚实诊断；迟到URL绝不注入', async () => {
  let arms = 0;
  const control = {
    arm: () => {
      arms += 1;
      return false;
    },
  };
  assert.match(
    await prepareThemeColdStart(async () => {
      throw new Error('不应输出的原始异常');
    }, control),
    /参数读取异常.*未注入/,
  );
  assert.equal(arms, 0);
  assert.match(
    await prepareThemeColdStart(async () => THEME_READ_FAILURE_URL, control),
    /未待命/,
  );
  assert.equal(arms, 1);
  let resolveURL!: (url: string) => void;
  const pending = new Promise<string>((resolve) => {
    resolveURL = resolve;
  });
  assert.match(
    await prepareThemeColdStart(() => pending, control, 5),
    /超时.*未注入/,
  );
  resolveURL(THEME_READ_FAILURE_URL);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(arms, 1);
});

// 执行实际scenario模块与注册组件，React/Expo原生边界用替身，不冒充UI挂载。
async function loadScenario(url: Promise<string | null>) {
  let rootComponent!: () => unknown;
  let state: string | null = null;
  const effects: (() => void | (() => void))[] = [];
  let initialCalls = 0;
  let reads = 0;
  let appRenders = 0;
  const repository = {
    async load() {
      reads += 1;
      return 'mint' as const;
    },
    async save() {},
  };
  const react = {
    useState: () => [
      state,
      (value: string) => {
        state = value;
      },
    ],
    useEffect: (effect: () => void | (() => void)) => {
      effects.push(effect);
    },
    createElement: (component: unknown, props: unknown) => {
      appRenders += 1;
      return { component, props };
    },
  };
  const source = ts.transpileModule(
    readFileSync(
      resolve(import.meta.dirname, '../acceptance/scenario.tsx'),
      'utf8',
    ),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.React,
        esModuleInterop: true,
      },
    },
  ).outputText;
  const requireModule = (name: string): unknown => {
    if (name === 'react') return react;
    if (name === 'expo')
      return {
        registerRootComponent: (component: () => unknown) => {
          rootComponent = component;
        },
      };
    if (name === 'expo-linking')
      return {
        getInitialURL: () => {
          initialCalls += 1;
          return url;
        },
      };
    if (name === './AcceptanceApp')
      return { default: 'acceptance-app', __esModule: true };
    if (name === '../src/state/nativeRepository')
      return { nativeRepository: {} };
    if (name === './saveObservation')
      return { installSaveObservation: () => ({}) };
    if (name === '../src/state/themeStorage')
      return { themePreferenceRepository: repository };
    if (name === './themePreferenceControl')
      return { installThemePreferenceControl };
    if (name === './themeColdStart') return { prepareThemeColdStart };
    throw new Error(`未提供入口依赖：${name}`);
  };
  new Function('exports', 'require', source)({}, requireModule);
  return {
    render: () => rootComponent(),
    effect: () => effects.shift()!(),
    repository,
    reads: () => reads,
    appRenders: () => appRenders,
    initialCalls: () => initialCalls,
  };
}

test('实际入口先gate后待命再首次渲染；重渲染不再读取URL或二次待命', async () => {
  let resolveURL!: (url: string) => void;
  const initialURL = new Promise<string>((resolve) => {
    resolveURL = resolve;
  });
  const scenario = await loadScenario(initialURL);
  assert.equal(scenario.render(), null);
  scenario.effect();
  assert.equal(scenario.appRenders(), 0);
  assert.equal(scenario.reads(), 0);
  resolveURL(THEME_READ_FAILURE_URL);
  await new Promise((resolve) => setImmediate(resolve));
  assert.ok(scenario.render());
  assert.equal(scenario.initialCalls(), 1);
  await assert.rejects(scenario.repository.load(), /验收注入/);
  assert.equal(scenario.reads(), 0);
  scenario.render();
  assert.equal(await scenario.repository.load(), 'mint');
  assert.equal(scenario.initialCalls(), 1);
  assert.equal(scenario.reads(), 1);
  const entry = readFileSync(
    resolve(import.meta.dirname, '../acceptance/scenario.tsx'),
    'utf8',
  );
  assert.doesNotMatch(entry, /addEventListener|useURL|key=/);
});

test('普通及异常实际入口均正常首次渲染、不注入故障', async () => {
  for (const makeURL of [
    () => Promise.resolve(null),
    () => Promise.reject(new Error('原始错误')),
  ]) {
    const scenario = await loadScenario(makeURL());
    assert.equal(scenario.render(), null);
    scenario.effect();
    await new Promise((resolve) => setImmediate(resolve));
    assert.ok(scenario.render());
    assert.equal(await scenario.repository.load(), 'mint');
    assert.equal(scenario.reads(), 1);
    assert.equal(scenario.initialCalls(), 1);
  }
});
