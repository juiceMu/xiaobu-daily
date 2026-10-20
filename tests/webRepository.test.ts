import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/domain/engine';
import { createAppStore } from '../src/state/store';
import { initializeSync } from '../src/domain/syncModel';
import {
  createWebRepository,
  WEB_STORAGE_KEY,
} from '../src/state/webRepository';
import { nativeRepository } from '../src/state/nativeRepository.web';
import type { WebStorage } from '../src/state/webRepository';

function fixture(initial: string | null = null) {
  const values = new Map<string, string>();
  if (initial !== null) values.set(WEB_STORAGE_KEY, initial);
  values.set('small-steps-v4-fresh', '旧网页数据不可读取或覆盖');
  values.set('sprout-native-web-v1', '旧原生预览数据保持原样');
  const reads: string[] = [];
  const writes: string[] = [];
  const storage: WebStorage = {
    getItem: (key) => {
      reads.push(key);
      return values.get(key) ?? null;
    },
    setItem: (key, value) => {
      writes.push(key);
      values.set(key, value);
    },
  };
  return { values, reads, writes, storage };
}

test('浏览器仓库懒访问存储，仅操作独立原生预览 key 并完整重载', async () => {
  const data = fixture();
  let accesses = 0;
  const repository = createWebRepository(() => {
    accesses += 1;
    return data.storage;
  });
  assert.equal(accesses, 0);
  assert.equal(await repository.load(), null);
  assert.equal(data.writes.length, 0);
  assert.equal(WEB_STORAGE_KEY, 'sprout-native-sync-v1');
  const business = createInitialState();
  business.tasks[0].name = '浏览器测试';
  const state = initializeSync(business);
  await repository.save(state);
  assert.deepEqual(await repository.load(), state);
  assert.deepEqual(data.reads, [WEB_STORAGE_KEY, WEB_STORAGE_KEY]);
  assert.deepEqual(data.writes, [WEB_STORAGE_KEY]);
  assert.equal(
    data.values.get('sprout-native-web-v1'),
    '旧原生预览数据保持原样',
  );
  assert.equal(
    data.values.get('small-steps-v4-fresh'),
    '旧网页数据不可读取或覆盖',
  );
});

test('存在的 null、空串和损坏 JSON 均报错保留原文，不重置', async () => {
  for (const payload of ['null', '', '{坏数据']) {
    const data = fixture(payload);
    const repository = createWebRepository(() => data.storage);
    await assert.rejects(repository.load());
    assert.equal(data.values.get(WEB_STORAGE_KEY), payload);
    assert.equal(data.writes.length, 0);
    const store = createAppStore(repository);
    await store.initialize();
    assert.equal(store.getSnapshot().state, null);
    assert.ok(store.getSnapshot().error);
    assert.equal(data.values.get(WEB_STORAGE_KEY), payload);
    assert.equal(data.writes.length, 0);
  }
});

test('存储读取与写入异常上抛，保存失败保留已发布状态和原始存档', async () => {
  const state = initializeSync(createInitialState());
  const payload = JSON.stringify(state);
  let original = payload;
  const repository = createWebRepository(() => ({
    getItem: () => original,
    setItem: () => {
      throw new Error('存储配额已满');
    },
  }));
  await assert.rejects(repository.save(state), /存储配额已满/);
  const store = createAppStore(repository);
  await store.initialize();
  const result = await store.run((draft) => {
    draft.tasks[0].name = '不能发布';
    return { ok: true, message: '保存' };
  });
  assert.equal(result.ok, false);
  assert.equal(store.getSnapshot().state?.tasks[0].name, state.tasks[0].name);
  assert.equal(original, payload);
  original = 'null';
  const unavailable = createWebRepository(() => {
    throw new Error('存储被禁用');
  });
  await assert.rejects(unavailable.load(), /存储被禁用/);
  await assert.rejects(unavailable.save(state), /存储被禁用/);
});

test('平台仓库在无 window 的 Node 环境可安全导入，访问时才报错', async () => {
  assert.equal(typeof nativeRepository.load, 'function');
  assert.equal(typeof nativeRepository.save, 'function');
  await assert.rejects(
    nativeRepository.load(),
    /当前环境无法访问浏览器本地存储/,
  );
});
