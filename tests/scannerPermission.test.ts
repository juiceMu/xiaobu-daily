import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// 执行真实组件函数，替身模拟hooks、权限与AppState；不挂载React或原生相机。
function scannerHarness() {
  const source = ts.createSourceFile(
    'GiftScanner.tsx',
    readFileSync(new URL('../src/ui/GiftScanner.tsx', import.meta.url), 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const component = source.statements.find(
    (node): node is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(node) && node.name?.text === 'GiftScanner',
  );
  assert.ok(component);
  const slots: unknown[] = [];
  const effects: (() => void)[] = [];
  let stateWrites = 0;
  let index = 0;
  let closed = 0;
  let requests = 0;
  let permission = { granted: false, canAskAgain: true };
  let resolvePermission!: (result: typeof permission) => void;
  let rejectPermission!: (error: Error) => void;
  let listener: ((status: string) => void) | undefined;
  let onClose = () => {
    closed += 1;
  };
  const scanned: string[] = [];
  let onScan = (value: string) => scanned.push(value);
  let subscriptions = 0;
  const appState = {
    currentState: 'active',
    addEventListener: (_: string, next: typeof listener) => {
      subscriptions += 1;
      listener = next;
      return {
        remove: () => {
          listener = undefined;
        },
      };
    },
  };
  const createElement = (
    type: unknown,
    props: Record<string, unknown> | null,
    ...children: unknown[]
  ) => ({ type, props: props ?? {}, children: children.flat(Infinity) });
  const renderComponent = new Function(
    'React',
    'useState',
    'useRef',
    'useEffect',
    'AppState',
    'View',
    'CameraView',
    'useCameraPermissions',
    'Text',
    'ActionButton',
    'useAppTheme',
    ts.transpileModule(
      `${component.getText(source).replace(/^export\s+/, '')};return GiftScanner;`,
      {
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.React,
        },
      },
    ).outputText,
  )(
    { createElement, Fragment: 'fragment' },
    (initial: unknown) => {
      const at = index++;
      if (!(at in slots)) slots[at] = initial;
      return [
        slots[at],
        (value: unknown) => {
          stateWrites += 1;
          slots[at] = value;
        },
      ];
    },
    (initial: unknown) => {
      const at = index++;
      if (!(at in slots)) slots[at] = { current: initial };
      return slots[at];
    },
    (setup: () => (() => void) | void, deps: unknown[]) => {
      const at = index++;
      const previous = slots[at] as
        { deps: unknown[]; cleanup?: () => void } | undefined;
      if (
        !previous ||
        deps.some(
          (value, position) => !Object.is(value, previous.deps[position]),
        )
      ) {
        previous?.cleanup?.();
        const cleanup = setup();
        slots[at] = { deps, cleanup };
        if (cleanup) effects.push(cleanup);
      }
    },
    appState,
    'View',
    'CameraView',
    () => [
      permission,
      () => {
        requests += 1;
        return new Promise<typeof permission>((resolve, reject) => {
          resolvePermission = (result) => {
            permission = result;
            resolve(result);
          };
          rejectPermission = reject;
        });
      },
    ],
    'Text',
    'ActionButton',
    () => ({ colors: { muted: 'muted', danger: 'danger' } }),
  );
  type Element = {
    type: unknown;
    props: Record<string, unknown>;
    children: unknown[];
  };
  function render() {
    index = 0;
    return renderComponent({
      onClose,
      onScan,
    }) as Element;
  }
  function nodes(root: unknown, type: string): Element[] {
    if (!root || typeof root !== 'object') return [];
    const node = root as Element;
    return [
      ...(node.type === type ? [node] : []),
      ...(node.children ?? []).flatMap((child) => nodes(child, type)),
    ];
  }
  render();
  return {
    change(status: string) {
      appState.currentState = status;
      listener?.(status);
    },
    request() {
      const button = nodes(render(), 'ActionButton').find(
        (node) => !node.children.includes('关闭扫码'),
      );
      assert.ok(button);
      (button.props.onPress as () => void)();
    },
    close() {
      const button = nodes(render(), 'ActionButton').find((node) =>
        node.children.includes('关闭扫码'),
      );
      assert.ok(button);
      (button.props.onPress as () => void)();
    },
    resolve(granted: boolean) {
      resolvePermission({ granted, canAskAgain: true });
    },
    reject() {
      rejectPermission(new Error('synthetic permission error'));
    },
    unmount() {
      effects.forEach((cleanup) => cleanup());
    },
    cameras: () => nodes(render(), 'CameraView').length,
    text: () => JSON.stringify(render()),
    closed: () => closed,
    requests: () => requests,
    stateWrites: () => stateWrites,
    scan(value: string) {
      const camera = nodes(render(), 'CameraView')[0];
      assert.ok(camera);
      const callback = camera.props.onBarcodeScanned as (event: {
        data: string;
      }) => void;
      callback({ data: value });
      callback({ data: value });
    },
    captureScan() {
      const camera = nodes(render(), 'CameraView')[0];
      assert.ok(camera);
      return camera.props.onBarcodeScanned as (event: { data: string }) => void;
    },
    scanned: () => scanned,
    subscriptions: () => subscriptions,
    replaceCallbacks(prefix = '最新:') {
      onClose = () => {
        closed += 10;
      };
      onScan = (value: string) => scanned.push(`${prefix}${value}`);
      render();
    },
  };
}

const settle = async () => {
  for (let i = 0; i < 6; i += 1) await Promise.resolve();
};

test('系统授权期间background不关闭扫码，拒绝结果在原界面明确显示', async () => {
  const h = scannerHarness();
  h.request();
  h.change('background');
  assert.equal(h.closed(), 0);
  assert.equal(h.cameras(), 0);
  h.change('active');
  h.resolve(false);
  await settle();
  assert.match(h.text(), /未获得相机权限/);
});

for (const order of ['resultFirst', 'activeFirst']) {
  test(`授权临时离开后显式开始才开镜头，返回与结果顺序${order}`, async () => {
    const h = scannerHarness();
    h.request();
    h.request();
    assert.equal(h.requests(), 1);
    h.change('background');
    if (order === 'resultFirst') {
      h.resolve(true);
      await settle();
      assert.equal(h.cameras(), 0);
      h.change('active');
    } else {
      h.change('active');
      h.resolve(true);
      await settle();
    }
    assert.equal(h.closed(), 0);
    assert.equal(h.cameras(), 0);
    assert.match(h.text(), /已允许使用相机.*开始扫码/);
    h.request();
    assert.equal(h.requests(), 1);
    assert.equal(h.cameras(), 1);
  });
}

test('拒绝后重试授权清理旧错误，不经过background时直接开启', async () => {
  const h = scannerHarness();
  h.request();
  h.resolve(false);
  await settle();
  assert.match(h.text(), /未获得相机权限/);
  h.request();
  assert.doesNotMatch(h.text(), /未获得相机权限/);
  h.resolve(true);
  await settle();
  assert.equal(h.cameras(), 1);
  assert.doesNotMatch(h.text(), /未获得相机权限/);
});

test('授权异常明确反馈并释放busy，可重新请求', async () => {
  const h = scannerHarness();
  h.request();
  h.reject();
  await settle();
  assert.match(h.text(), /无法请求相机权限.*重试/);
  assert.doesNotMatch(h.text(), /synthetic permission error/);
  h.request();
  assert.equal(h.requests(), 2);
  h.resolve(false);
  await settle();
});

test('无权限请求时后台关闭并卸载镜头，返回前台不自动重新开启', async () => {
  const h = scannerHarness();
  h.request();
  h.resolve(true);
  await settle();
  assert.equal(h.cameras(), 1);
  h.change('background');
  assert.equal(h.cameras(), 0);
  assert.equal(h.closed(), 1);
  h.change('active');
  assert.equal(h.cameras(), 0);
  h.request();
  assert.equal(h.cameras(), 0);
});

test('权限等待期间Home再回来也需显式开始，不自动打开镜头', async () => {
  const h = scannerHarness();
  h.request();
  h.change('background');
  h.resolve(true);
  await settle();
  assert.equal(h.cameras(), 0);
  h.change('active');
  assert.equal(h.cameras(), 0);
});

for (const finish of ['resolve', 'reject'] as const) {
  test(`关闭或卸载后晚到权限${finish}不发布状态或重开镜头`, async () => {
    for (const operation of ['close', 'unmount'] as const) {
      const h = scannerHarness();
      h.request();
      h[operation]();
      if (operation === 'close') h.replaceCallbacks();
      const before = h.stateWrites();
      if (finish === 'resolve') h.resolve(true);
      else h.reject();
      await settle();
      assert.equal(h.stateWrites(), before);
      if (operation === 'close') assert.equal(h.cameras(), 0);
    }
  });
}

test('父回调重建不重装监听，扫描连续帧只向最新回调交付一次', async () => {
  const h = scannerHarness();
  h.request();
  h.replaceCallbacks();
  assert.equal(h.subscriptions(), 1);
  h.resolve(true);
  await settle();
  const nativeCallback = h.captureScan();
  h.replaceCallbacks('第二次更新:');
  nativeCallback({ data: 'synthetic-qr-code' });
  nativeCallback({ data: 'synthetic-qr-code' });
  assert.deepEqual(h.scanned(), ['第二次更新:synthetic-qr-code']);
  h.change('background');
  assert.equal(h.closed(), 10);
  nativeCallback({ data: 'late-event' });
  assert.equal(h.scanned().length, 1);
});
