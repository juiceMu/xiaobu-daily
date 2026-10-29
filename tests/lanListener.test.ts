import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = ts.createSourceFile(
  'lanSync.ts',
  readFileSync(new URL('../src/state/lanSync.ts', import.meta.url), 'utf8'),
  ts.ScriptTarget.Latest,
  true,
);
const listener = source.statements.find(
  (node) =>
    ts.isFunctionDeclaration(node) && node.name?.text === 'startLanListener',
);
assert.ok(listener);
const cleanupState = source.statements.find(
  (node) =>
    ts.isVariableStatement(node) &&
    node.declarationList.declarations.some(
      (declaration) => declaration.name.getText(source) === 'listenerCleanup',
    ),
);
assert.ok(cleanupState);
const compiled = ts.transpileModule(
  `${cleanupState.getText(source)}\nconst extracted = ${listener.getText(source).replace(/^export /, '')};`,
  { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
).outputText;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const settle = () => new Promise<void>((resolve) => setImmediate(resolve));

// 抽取执行真实监听生命周期；原生异步回调由夹具控制，不代表设备 mDNS/TCP。
function harness() {
  let ip = '192.168.1.8';
  let networkChanged = () => {};
  let removed = 0;
  let deviceListenersRemoved = 0;
  let input: object | null = {};
  const errors: Error[] = [];
  const servers: FakeServer[] = [];
  const publications: ReturnType<typeof deferred<{ name: string }>>[] = [];
  const unpublished: string[] = [];
  const advertised = new Map<string, object>();
  let unregister = async (_name: string) => {};
  class FakeServer extends EventEmitter {
    accept = (_socket: { destroy(): void }) => {};
    ready = () => {};
    closes = 0;
    host = '';
    listen(options: { host: string }, callback: () => void) {
      this.host = options.host;
      this.ready = callback;
    }
    close() {
      this.closes++;
    }
  }
  class FakeZeroconf {
    publishService() {
      const pending = deferred<{ name: string }>();
      publications.push(pending);
      return pending.promise.then((service) => {
        advertised.set(service.name, this);
        return service;
      });
    }
    async unpublishService(name: string) {
      unpublished.push(name);
      await unregister(name);
      advertised.delete(name);
    }
    removeDeviceListeners() {
      deviceListenersRemoved++;
    }
  }
  const names = [
    'TcpSocket',
    'Network',
    'Zeroconf',
    'wifiAddress',
    'wifiInterface',
    'Platform',
    'ImplType',
    'PORT',
    'SERVICE_TYPE',
    'SERVICE_NAME',
  ];
  const start = new Function(...names, compiled + '\nreturn extracted;')(
    {
      createServer(onConnection: (socket: { destroy(): void }) => void) {
        const server = new FakeServer();
        server.accept = onConnection;
        servers.push(server);
        return server;
      },
    },
    {
      addNetworkStateListener(callback: () => void) {
        networkChanged = callback;
        return { remove: () => removed++ };
      },
    },
    FakeZeroconf,
    async () => ip,
    () => 'wlan0',
    { OS: 'android' },
    { NSD: 'NSD' },
    39217,
    'sprout-checkin',
    'Small Steps Sync',
  ) as (options: {
    getInput(): object | null;
    onError(error: Error): void;
  }) => () => void;
  const startListener = () =>
    start({ getInput: () => input, onError: (e) => errors.push(e) });
  const stop = startListener();
  return {
    stop,
    start: startListener,
    advertised,
    servers,
    publications,
    unpublished,
    errors,
    changed(nextIp = ip) {
      ip = nextIp;
      networkChanged();
    },
    setUnregister(callback: typeof unregister) {
      unregister = callback;
    },
    setBusy(busy: boolean) {
      input = busy ? null : {};
    },
    get removed() {
      return removed;
    },
    get deviceListenersRemoved() {
      return deviceListenersRemoved;
    },
  };
}

test('LAN listener coalesces network notifications across pending listen and publish', async () => {
  const state = harness();
  await settle();
  state.changed();
  state.changed();
  await settle();
  assert.equal(state.servers.length, 1);
  state.servers[0].ready();
  await settle();
  state.changed();
  await settle();
  assert.equal(state.publications.length, 1);
  assert.equal(state.servers.length, 1);
  state.publications[0].resolve({ name: 'published-1' });
  await settle();
  state.changed();
  await settle();
  assert.equal(state.publications.length, 1);
  assert.equal(state.servers[0].closes, 0);
  state.stop();
  state.stop();
  await settle();
  assert.deepEqual(state.unpublished, ['published-1']);
  assert.equal(state.removed, 1);
  assert.equal(state.deviceListenersRemoved, 1);
});

test('LAN listener waits for old publication removal before rebinding a changed address', async () => {
  const state = harness();
  await settle();
  state.servers[0].ready();
  await settle();
  const removal = deferred<void>();
  state.setUnregister(() => removal.promise);
  state.changed('192.168.2.8');
  state.publications[0].resolve({ name: 'old-network' });
  await settle();
  assert.deepEqual(state.unpublished, ['old-network']);
  assert.equal(state.servers[0].closes, 1);
  assert.equal(state.servers.length, 1);
  removal.resolve();
  await settle();
  assert.equal(state.servers.length, 2);
  assert.equal(state.servers[1].host, '192.168.2.8');
  state.servers[1].ready();
  await settle();
  state.publications[1].resolve({ name: 'new-network' });
  await settle();
  state.stop();
  await settle();
  assert.deepEqual(state.unpublished, ['old-network', 'new-network']);
});

test('LAN listener stop removes a publication that completes after disposal', async () => {
  const state = harness();
  await settle();
  state.servers[0].ready();
  await settle();
  state.stop();
  await settle();
  assert.equal(state.servers[0].closes, 1);
  assert.equal(state.deviceListenersRemoved, 0);
  state.publications[0].resolve({ name: 'late-publication' });
  await settle();
  assert.deepEqual(state.unpublished, ['late-publication']);
  assert.equal(state.deviceListenersRemoved, 1);
  assert.equal(state.servers.length, 1);
});

test('LAN listener stop closes a late listening callback without publishing', async () => {
  const state = harness();
  await settle();
  state.stop();
  await settle();
  assert.equal(state.deviceListenersRemoved, 0);
  state.servers[0].ready();
  await settle();
  assert.equal(state.deviceListenersRemoved, 1);
  assert.equal(state.servers[0].closes, 2);
  assert.equal(state.publications.length, 0);
  let destroyed = 0;
  state.servers[0].accept({ destroy: () => destroyed++ });
  assert.equal(destroyed, 1);
});

test('LAN listener instances wait for stopped pending publication and cleanup before reusing the native service name', async () => {
  const state = harness();
  await settle();
  state.servers[0].ready();
  await settle();
  state.stop();
  const stopNext = state.start();
  await settle();
  assert.equal(state.servers.length, 1);
  assert.equal(state.publications.length, 1);
  state.publications[0].resolve({ name: 'Small Steps Sync' });
  await settle();
  assert.deepEqual(state.unpublished, ['Small Steps Sync']);
  assert.equal(state.advertised.size, 0);
  assert.equal(state.servers.length, 2);
  state.servers[1].ready();
  await settle();
  state.publications[1].resolve({ name: 'Small Steps Sync' });
  await settle();
  assert.equal(state.advertised.size, 1);
  stopNext();
  await settle();
  assert.equal(state.advertised.size, 0);
  assert.equal(state.deviceListenersRemoved, 2);
});

test('LAN listener instances wait for stopped pending unpublication before binding and publishing again', async () => {
  const state = harness();
  await settle();
  state.servers[0].ready();
  await settle();
  state.publications[0].resolve({ name: 'Small Steps Sync' });
  await settle();
  const removal = deferred<void>();
  state.setUnregister(() => removal.promise);
  state.stop();
  await settle();
  const stopNext = state.start();
  await settle();
  assert.equal(state.servers.length, 1);
  assert.equal(state.publications.length, 1);
  removal.resolve();
  await settle();
  assert.equal(state.advertised.size, 0);
  assert.equal(state.servers.length, 2);
  state.servers[1].ready();
  await settle();
  state.publications[1].resolve({ name: 'Small Steps Sync' });
  await settle();
  assert.equal(state.advertised.size, 1);
  stopNext();
  await settle();
  assert.equal(state.advertised.size, 0);
});

test('LAN listener can stop a queued instance before it starts and release the following instance', async () => {
  const state = harness();
  await settle();
  state.servers[0].ready();
  await settle();
  state.stop();
  const stopQueued = state.start();
  stopQueued();
  const stopLast = state.start();
  await settle();
  assert.equal(state.servers.length, 1);
  state.publications[0].resolve({ name: 'Small Steps Sync' });
  await settle();
  assert.equal(state.servers.length, 2);
  assert.equal(state.deviceListenersRemoved, 2);
  state.servers[1].ready();
  await settle();
  state.publications[1].resolve({ name: 'Small Steps Sync' });
  await settle();
  assert.equal(state.advertised.size, 1);
  stopLast();
  await settle();
  assert.equal(state.advertised.size, 0);
  assert.equal(state.deviceListenersRemoved, 3);
});

test('LAN listener instances wait for a stopped pending native bind callback and late close', async () => {
  const state = harness();
  await settle();
  state.stop();
  const stopNext = state.start();
  await settle();
  assert.equal(state.servers.length, 1);
  assert.equal(state.publications.length, 0);
  state.servers[0].ready();
  await settle();
  assert.equal(state.servers[0].closes, 2);
  assert.equal(state.servers.length, 2);
  assert.equal(state.publications.length, 0);
  stopNext();
  state.servers[1].ready();
  await settle();
  assert.equal(state.deviceListenersRemoved, 2);
});

test('LAN listener keeps its same-address advertisement while local saving temporarily returns no input', async () => {
  const state = harness();
  await settle();
  state.servers[0].ready();
  await settle();
  state.publications[0].resolve({ name: 'existing-service' });
  await settle();
  state.setBusy(true);
  state.changed();
  await settle();
  assert.equal(state.servers[0].closes, 0);
  assert.deepEqual(state.unpublished, []);
  let destroyed = 0;
  state.servers[0].accept({ destroy: () => destroyed++ });
  assert.equal(destroyed, 1);
  state.setBusy(false);
  state.changed();
  await settle();
  assert.equal(state.servers.length, 1);
  assert.equal(state.publications.length, 1);
  state.stop();
  await settle();
});

test('LAN listener can retry after a native listening failure', async () => {
  const state = harness();
  await settle();
  state.servers[0].emit('error', new Error('port busy'));
  await settle();
  assert.equal(state.errors[0].message, 'port busy');
  state.changed();
  await settle();
  assert.equal(state.servers.length, 2);
  state.stop();
  await settle();
});

test('LAN listener does not double-close a native server already closed by its error handler', async () => {
  const state = harness();
  await settle();
  state.servers[0].ready();
  await settle();
  state.publications[0].resolve({ name: 'failed-server' });
  await settle();
  // 原生库在发送 error 之前已 close；此处只发送对应事件。
  state.servers[0].emit('error', new Error('network lost'));
  state.changed();
  await settle();
  assert.equal(state.servers[0].closes, 0);
  assert.equal(state.servers.length, 2);
  assert.deepEqual(state.unpublished, ['failed-server']);
  state.stop();
  await settle();
});

test('LAN listener retains failed unregistration for retry and does not publish a duplicate', async () => {
  const state = harness();
  await settle();
  state.servers[0].ready();
  await settle();
  state.publications[0].resolve({ name: 'existing-service' });
  await settle();
  state.setUnregister(async () => {
    throw new Error('unregister failed');
  });
  state.changed('192.168.2.8');
  await settle();
  assert.equal(state.errors[0].message, 'unregister failed');
  assert.equal(state.publications.length, 1);
  assert.equal(state.servers.length, 1);
  state.setUnregister(async () => {});
  state.changed();
  await settle();
  assert.deepEqual(state.unpublished, ['existing-service', 'existing-service']);
  assert.equal(state.servers.length, 2);
  state.stop();
  await settle();
});
