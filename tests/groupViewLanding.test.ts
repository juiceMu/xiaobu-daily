import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import {
  createGroupViewRepository,
  isGroupViewMode,
  type GroupViewMode,
} from '../src/state/groupView';
import { nextTicketLandingId } from '../src/ui/ticketLandingId';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((ok, fail) => {
    resolve = ok;
    reject = fail;
  });
  return { promise, resolve, reject };
}

// 执行真实函数，hooks与提交顺序使用替身，不冒充React挂载或UI交互。
function harness(
  file: string,
  name: string,
  dependencies: Record<string, unknown>,
) {
  const source = ts.createSourceFile(
    file,
    readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const node = source.statements.find(
    (entry): entry is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(entry) && entry.name?.text === name,
  );
  assert.ok(node);
  const slots: unknown[] = [];
  let index = 0;
  let dirty = false;
  let pending: (() => void)[] = [];
  const hooks = {
    useState(initial: unknown) {
      const slot = index++;
      if (!(slot in slots)) slots[slot] = initial;
      return [
        slots[slot],
        (next: unknown) => {
          const value = typeof next === 'function' ? next(slots[slot]) : next;
          if (!Object.is(value, slots[slot])) {
            slots[slot] = value;
            dirty = true;
          }
        },
      ];
    },
    useRef(initial: unknown) {
      const slot = index++;
      if (!(slot in slots)) slots[slot] = { current: initial };
      return slots[slot];
    },
    useEffect(effect: () => void | (() => void), deps: unknown[]) {
      const slot = index++;
      const prior = slots[slot] as
        { deps: unknown[]; cleanup?: () => void } | undefined;
      if (!prior || deps.some((value, i) => !Object.is(value, prior.deps[i]))) {
        pending.push(() => {
          prior?.cleanup?.();
          slots[slot] = { deps, cleanup: effect() };
        });
      }
    },
  };
  const bindings = { ...hooks, ...dependencies };
  const js = ts.transpileModule(
    node.getText(source).replace(/^export\s+/, ''),
    {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.React,
      },
    },
  ).outputText;
  const run = new Function(...Object.keys(bindings), `${js}; return ${name};`)(
    ...Object.values(bindings),
  ) as (...args: unknown[]) => unknown;
  let args: unknown[] = [];
  let result: unknown;
  function flush(...next: unknown[]) {
    if (next.length) args = next;
    let loops = 0;
    do {
      assert.ok(++loops < 30, '状态更新不得无限循环');
      dirty = false;
      index = 0;
      pending = [];
      result = run(...args);
      // 模拟render中更新时，先重渲染再提交effect。
      if (dirty) continue;
      const effects = pending;
      pending = [];
      for (const effect of effects) effect();
    } while (dirty);
    return result;
  }
  return { flush };
}

const tick = () => new Promise<void>((resolve) => setImmediate(resolve));
type View = {
  mode: GroupViewMode;
  busy: boolean;
  error: string;
  readFailed: boolean;
  setMode(mode: GroupViewMode): Promise<boolean>;
};
type LandingView = {
  forceSelf: boolean;
  pending: boolean;
  failed: boolean;
  selectMode(mode: GroupViewMode): Promise<boolean>;
};

test('真实Provider等待初始加载，保存失败保留原值，并拒绝并发写入', async () => {
  const loading = deferred<GroupViewMode>();
  const write = deferred<void>();
  const saves: GroupViewMode[] = [];
  const provider = harness(
    'src/ui/GroupViewProvider.tsx',
    'GroupViewProvider',
    {
      React: {
        createElement: (_: unknown, props: { value: View }) => props.value,
      },
      GroupViewContext: { Provider: 'provider' },
      groupViewRepository: {
        load: () => loading.promise,
        save: (value: GroupViewMode) => {
          saves.push(value);
          return write.promise;
        },
      },
      isGroupViewMode,
    },
  );
  let value = provider.flush({ children: null }) as View;
  assert.equal(value.busy, true);
  assert.equal(await value.setMode('self'), false);
  assert.deepEqual(saves, []);
  loading.resolve('group');
  await tick();
  value = provider.flush() as View;
  assert.equal(value.mode, 'group');
  assert.equal(value.busy, false);
  const saving = value.setMode('self');
  value = provider.flush() as View;
  assert.equal(value.busy, true);
  assert.equal(value.mode, 'group');
  assert.equal(await value.setMode('group'), false);
  write.reject(new Error('存储失败'));
  assert.equal(await saving, false);
  value = provider.flush() as View;
  assert.equal(value.mode, 'group');
  assert.match(value.error, /保存失败/);
  assert.equal(value.busy, false);
  assert.deepEqual(saves, ['self']);
});

test('真实偏好仓库读取失败不写入，保存失败不改变旧值', async () => {
  let stored = JSON.stringify('group');
  let failRead = false;
  let failWrite = true;
  const repository = createGroupViewRepository({
    getItem: () => {
      if (failRead) throw new Error('读取失败');
      return stored;
    },
    setItem: (_key, value) => {
      if (failWrite) throw new Error('写入失败');
      stored = value;
    },
  });
  assert.equal(await repository.load(), 'group');
  failRead = true;
  await assert.rejects(repository.load());
  failRead = false;
  await assert.rejects(repository.save('self'));
  assert.equal(await repository.load(), 'group');
  failWrite = false;
  await repository.save('self');
  assert.equal(await repository.load(), 'self');
});

test('读取失败保留默认并反馈，可以重试保存当前选择', async () => {
  const saves: GroupViewMode[] = [];
  const provider = harness(
    'src/ui/GroupViewProvider.tsx',
    'GroupViewProvider',
    {
      React: {
        createElement: (_: unknown, props: { value: View }) => props.value,
      },
      GroupViewContext: { Provider: 'provider' },
      groupViewRepository: {
        load: async () => {
          throw new Error('读取失败');
        },
        save: async (value: GroupViewMode) => {
          saves.push(value);
        },
      },
      isGroupViewMode,
    },
  );
  provider.flush({ children: null });
  await tick();
  let value = provider.flush() as View;
  assert.equal(value.mode, 'self');
  assert.match(value.error, /读取失败/);
  assert.equal(value.readFailed, true);
  assert.equal(await value.setMode('self'), true);
  value = provider.flush() as View;
  assert.equal(value.mode, 'self');
  assert.equal(value.error, '');
  assert.equal(value.readFailed, false);
  assert.deepEqual(saves, ['self']);
});

test('真实Provider读取失败与入口组合：不自动覆盖未知偏好，手动选择才保存', async () => {
  let stored: GroupViewMode = 'group';
  const saves: GroupViewMode[] = [];
  const provider = harness(
    'src/ui/GroupViewProvider.tsx',
    'GroupViewProvider',
    {
      React: {
        createElement: (_: unknown, props: { value: View }) => props.value,
      },
      GroupViewContext: { Provider: 'provider' },
      groupViewRepository: {
        load: async () => {
          throw new Error('读取失败');
        },
        save: async (mode: GroupViewMode) => {
          saves.push(mode);
          stored = mode;
        },
      },
      isGroupViewMode,
    },
  );
  provider.flush({ children: null });
  await tick();
  let value = provider.flush() as View;
  const hook = harness('src/ui/useTicketLanding.ts', 'useTicketLanding', {});
  let result = hook.flush(
    1,
    true,
    value.mode,
    value.busy,
    value.setMode,
    value.readFailed,
  ) as LandingView;
  assert.equal(result.forceSelf, true);
  assert.equal(result.failed, true);
  assert.equal(stored, 'group');
  assert.deepEqual(saves, []);
  assert.equal(await result.selectMode('group'), true);
  value = provider.flush() as View;
  result = hook.flush(
    1,
    true,
    value.mode,
    value.busy,
    value.setMode,
    value.readFailed,
  ) as LandingView;
  assert.equal(result.forceSelf, false);
  assert.equal(value.readFailed, false);
  assert.deepEqual(saves, ['group']);
});

test('离页后在途self保存先完成，后续跨页手动选择group保持最后生效', async () => {
  let stored: GroupViewMode = 'group';
  const first = deferred<void>();
  const saves: GroupViewMode[] = [];
  const provider = harness(
    'src/ui/GroupViewProvider.tsx',
    'GroupViewProvider',
    {
      React: {
        createElement: (_: unknown, props: { value: View }) => props.value,
      },
      GroupViewContext: { Provider: 'provider' },
      groupViewRepository: {
        load: async () => stored,
        save: async (mode: GroupViewMode) => {
          saves.push(mode);
          if (saves.length === 1) await first.promise;
          stored = mode;
        },
      },
      isGroupViewMode,
    },
  );
  provider.flush({ children: null });
  await tick();
  let value = provider.flush() as View;
  const hook = harness('src/ui/useTicketLanding.ts', 'useTicketLanding', {});
  hook.flush(1, true, value.mode, value.busy, value.setMode, value.readFailed);
  value = provider.flush() as View;
  assert.equal(value.busy, true);
  hook.flush(1, false, value.mode, value.busy, value.setMode, value.readFailed);
  assert.equal(await value.setMode('group'), false);
  first.resolve();
  await tick();
  value = provider.flush() as View;
  assert.equal(value.mode, 'self');
  assert.equal(stored, 'self');
  assert.equal(await value.setMode('group'), true);
  value = provider.flush() as View;
  const landing = hook.flush(
    1,
    true,
    value.mode,
    value.busy,
    value.setMode,
    value.readFailed,
  ) as LandingView;
  assert.equal(landing.forceSelf, false);
  assert.equal(value.mode, 'group');
  assert.equal(stored, 'group');
  assert.deepEqual(saves, ['self', 'group']);
});

test('同毫秒多次入口使用不同标识', () => {
  const original = Date.now;
  Date.now = () => 1000;
  try {
    assert.equal(nextTicketLandingId(), 1000);
    assert.equal(nextTicketLandingId(), 1001);
  } finally {
    Date.now = original;
  }
});

test('入口等待在途操作，失败保持本人且可主动切回全组', async () => {
  const save = deferred<boolean>();
  const requests: GroupViewMode[] = [];
  const setMode = (mode: GroupViewMode) => {
    requests.push(mode);
    return requests.length === 1 ? save.promise : Promise.resolve(true);
  };
  const hook = harness('src/ui/useTicketLanding.ts', 'useTicketLanding', {});
  let result = hook.flush(1, true, 'group', true, setMode) as LandingView;
  assert.equal(result.forceSelf, true);
  assert.deepEqual(requests, []);
  result = hook.flush(1, true, 'group', false, setMode) as LandingView;
  assert.equal(result.pending, true);
  assert.deepEqual(requests, ['self']);
  assert.equal(await result.selectMode('group'), false);
  assert.deepEqual(requests, ['self']);
  save.resolve(false);
  await tick();
  result = hook.flush() as LandingView;
  assert.equal(result.forceSelf, true);
  assert.equal(result.failed, true);
  assert.equal(await result.selectMode('group'), true);
  result = hook.flush() as LandingView;
  assert.equal(result.forceSelf, false);
  assert.deepEqual(requests, ['self', 'group']);
});

test('自动保存成功后等待全局值发布，失败可由本人选择重试', async () => {
  const first = deferred<boolean>();
  let calls = 0;
  const setMode = () => (++calls === 1 ? first.promise : Promise.resolve(true));
  const hook = harness('src/ui/useTicketLanding.ts', 'useTicketLanding', {});
  let result = hook.flush(7, true, 'group', false, setMode) as LandingView;
  first.resolve(true);
  await tick();
  result = hook.flush(7, true, 'group', false, setMode) as LandingView;
  assert.equal(result.forceSelf, true);
  result = hook.flush(7, true, 'self', false, setMode) as LandingView;
  assert.equal(result.forceSelf, false);

  const retry = harness('src/ui/useTicketLanding.ts', 'useTicketLanding', {});
  let retryCalls = 0;
  const retrySet = () => Promise.resolve(++retryCalls > 1);
  retry.flush(8, true, 'group', false, retrySet);
  await tick();
  result = retry.flush() as LandingView;
  assert.equal(result.failed, true);
  assert.equal(await result.selectMode('self'), true);
  result = retry.flush(8, true, 'group', false, retrySet) as LandingView;
  assert.equal(result.forceSelf, true);
  result = retry.flush(8, true, 'self', false, retrySet) as LandingView;
  assert.equal(result.forceSelf, false);
});

test('重复入口和离页后旧结果不覆盖新意图，保存成功后释放覆盖', async () => {
  const first = deferred<boolean>();
  const second = deferred<boolean>();
  const requests: GroupViewMode[] = [];
  const setMode = (mode: GroupViewMode) => {
    requests.push(mode);
    return requests.length === 1 ? first.promise : second.promise;
  };
  const hook = harness('src/ui/useTicketLanding.ts', 'useTicketLanding', {});
  let result = hook.flush(1, true, 'group', false, setMode) as LandingView;
  assert.equal(result.forceSelf, true);
  result = hook.flush(2, true, 'group', false, setMode) as LandingView;
  assert.equal(result.forceSelf, true);
  first.resolve(false);
  await tick();
  result = hook.flush(2, true, 'group', false, setMode) as LandingView;
  assert.equal(result.pending, true);
  assert.equal(result.failed, false);
  second.resolve(true);
  await tick();
  result = hook.flush(2, true, 'self', false, setMode) as LandingView;
  assert.equal(result.forceSelf, false);
  result = hook.flush(2, false, 'group', false, setMode) as LandingView;
  assert.equal(result.forceSelf, false);
  result = hook.flush(2, true, 'group', false, setMode) as LandingView;
  assert.equal(result.forceSelf, false);
  assert.deepEqual(requests, ['self', 'self']);
});

test('离页再返回后，旧请求的迟到失败不重新激活入口意图', async () => {
  const save = deferred<boolean>();
  const setMode = () => save.promise;
  const hook = harness('src/ui/useTicketLanding.ts', 'useTicketLanding', {});
  let result = hook.flush(1, true, 'group', false, setMode) as LandingView;
  assert.equal(result.forceSelf, true);
  result = hook.flush(1, false, 'group', true, setMode) as LandingView;
  assert.equal(result.forceSelf, false);
  result = hook.flush(1, true, 'group', true, setMode) as LandingView;
  assert.equal(result.forceSelf, false);
  save.resolve(false);
  await tick();
  result = hook.flush(1, true, 'group', false, setMode) as LandingView;
  assert.equal(result.forceSelf, false);
  assert.equal(result.failed, false);
});

test('离组后旧group偏好保存self失败：奖券页展示错误，不提示不可用的切换', async () => {
  const provider = harness(
    'src/ui/GroupViewProvider.tsx',
    'GroupViewProvider',
    {
      React: {
        createElement: (_: unknown, props: { value: View }) => props.value,
      },
      GroupViewContext: { Provider: 'provider' },
      groupViewRepository: {
        load: async () => 'group',
        save: async () => {
          throw new Error('保存失败');
        },
      },
      isGroupViewMode,
    },
  );
  provider.flush({ children: null });
  await tick();
  let value = provider.flush() as View;
  const hook = harness('src/ui/useTicketLanding.ts', 'useTicketLanding', {});
  hook.flush(9, true, value.mode, value.busy, value.setMode, value.readFailed);
  await tick();
  value = provider.flush() as View;
  const landing = hook.flush(
    9,
    true,
    value.mode,
    value.busy,
    value.setMode,
    value.readFailed,
  ) as LandingView;
  assert.equal(landing.failed, true);
  assert.equal(value.mode, 'group');
  assert.equal(value.readFailed, false);

  const path = '../src/screens/TicketsScreen.tsx';
  const source = ts.createSourceFile(
    path,
    readFileSync(new URL(path, import.meta.url), 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  let expression: ts.ConditionalExpression | undefined;
  function visit(node: ts.Node) {
    if (
      ts.isConditionalExpression(node) &&
      node.condition.getText(source) === 'state.groupLink || landing.failed' &&
      node.whenTrue.getText(source).includes('landing.failed')
    )
      expression = node;
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(expression);
  const compiled = ts.transpileModule(
    `return (${expression.getText(source)});`,
    {
      compilerOptions: {
        jsx: ts.JsxEmit.React,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  const render = new Function(
    'React',
    'ErrorText',
    'state',
    'landing',
    'readFailed',
    'viewError',
    compiled,
  );
  const element = render(
    { createElement: (_: unknown, props: unknown) => props },
    'ErrorText',
    { groupLink: null },
    landing,
    value.readFailed,
    value.error,
  ) as { message: string } | null;
  assert.ok(element, '无组保存失败时应展示反馈');
  assert.match(element.message, /保存失败/);
  assert.match(element.message, /重新确认/);
  assert.doesNotMatch(element.message, /切换/);
  const noGroupReadError = render(
    { createElement: (_: unknown, props: unknown) => props },
    'ErrorText',
    { groupLink: null },
    landing,
    true,
    '查看方式读取失败。',
  ) as { message: string };
  assert.match(noGroupReadError.message, /读取失败/);
  assert.doesNotMatch(noGroupReadError.message, /切换/);
  const groupError = render(
    { createElement: (_: unknown, props: unknown) => props },
    'ErrorText',
    { groupLink: {} },
    landing,
    false,
    value.error,
  ) as { message: string };
  assert.match(groupError.message, /请重试切换/);
});

test('奖券页使用本页意图、筛选与反馈，切换控件遵守覆盖与禁用', () => {
  const screen = readFileSync(
    new URL('../src/screens/TicketsScreen.tsx', import.meta.url),
    'utf8',
  );
  const control = readFileSync(
    new URL('../src/ui/GroupViewSwitch.tsx', import.meta.url),
    'utf8',
  );
  assert.match(screen, /!landing\.forceSelf && mode === 'group'/);
  assert.match(
    screen,
    /filterState\.at === landingAt \? filterState\.value : 'available'/,
  );
  assert.match(
    screen,
    /memberState\.at === landingAt \? memberState\.value : 'all'/,
  );
  assert.match(screen, /查看方式保存失败/);
  assert.match(screen, /已存偏好需重新确认/);
  assert.match(
    screen,
    /displayMode=\{landing\.forceSelf \? 'self' : undefined\}/,
  );
  assert.match(control, /\(displayMode \?\? mode\) === value/);
  assert.match(control, /disabled=\{busy \|\| disabled\}/);
  assert.match(control, /if \(!state\.groupLink\) return null/);
  assert.match(
    screen,
    /\) : readFailed \? \(\s*<ErrorText message=\{viewError\} \/>/,
  );
  const today = readFileSync(
    new URL('../src/screens/TodayScreen.tsx', import.meta.url),
    'utf8',
  );
  assert.match(today, /error: viewError/);
  assert.match(
    today,
    /!state\.groupLink && readFailed \? \(\s*<ErrorText message=\{viewError\} \/>/,
  );
  assert.match(
    today,
    /<GroupViewSwitch \/>\s*<ErrorText message=\{viewError\} \/>/,
  );
});
