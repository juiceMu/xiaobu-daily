import test from 'node:test';
import assert from 'node:assert/strict';
import { installSaveObservation } from '../acceptance/saveObservation';
import { installBusinessSaveControl } from '../acceptance/businessSaveControl';
import { readFileSync } from 'node:fs';
import type { StateRepository } from '../src/state/store';

test('观察窗口仅统计窗口内调用，进行中不允许开始或停止', async () => {
  let release!: () => void;
  let delayed = true;
  const repository: StateRepository = {
    load: async () => null,
    save: async () => {
      if (delayed)
        await new Promise<void>((resolve) => {
          release = resolve;
        });
    },
  };
  const observation = installSaveObservation(repository);
  const value = {} as Parameters<typeof repository.save>[0];
  const initial = repository.save(value);
  assert.equal(observation.start(), false);
  release();
  await initial;
  assert.equal(observation.start(), true);
  const pending = repository.save(value);
  assert.equal(observation.stop(), false);
  release();
  await pending;
  delayed = false;
  await repository.save(value);
  assert.equal(observation.stop(), true);
  assert.deepEqual(observation.getSnapshot(), {
    observing: false,
    calls: 2,
    succeeded: 2,
    failed: 0,
    inFlight: 0,
  });
  await repository.save(value);
  assert.equal(observation.getSnapshot().calls, 2);
  assert.equal(observation.start(), true);
  assert.equal(observation.getSnapshot().calls, 0);
});

test('组合故障控制时统计仓储接口失败而不声称实际SQLite写入', async () => {
  let writes = 0;
  const repository: StateRepository = {
    load: async () => null,
    save: async () => {
      writes += 1;
    },
  };
  const fault = installBusinessSaveControl(repository);
  const observation = installSaveObservation(repository);
  assert.equal(fault.arm('fail'), true);
  assert.equal(observation.start(), true);
  await assert.rejects(
    repository.save({} as Parameters<typeof repository.save>[0]),
    /验收注入/,
  );
  assert.equal(observation.stop(), true);
  assert.equal(observation.getSnapshot().calls, 1);
  assert.equal(observation.getSnapshot().failed, 1);
  assert.equal(writes, 0);
});

test('只有场景入口安装并传入观察器', () => {
  const read = (path: string) =>
    readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
  assert.match(
    read('acceptance/scenario.tsx'),
    /installSaveObservation\(nativeRepository\)/,
  );
  for (const entry of [
    'index.ts',
    'acceptance/index.tsx',
    'acceptance/fresh.tsx',
    'fixture/index.tsx',
  ]) {
    assert.doesNotMatch(read(entry), /installSaveObservation|observation=/);
  }
});

test('失败计数且原始异常不变，空窗口保持零调用', async () => {
  const error = new Error('test');
  const repository: StateRepository = {
    load: async () => null,
    save: async () => {
      throw error;
    },
  };
  const observation = installSaveObservation(repository);
  assert.equal(observation.start(), true);
  assert.equal(observation.stop(), true);
  assert.equal(observation.getSnapshot().calls, 0);
  assert.equal(observation.start(), true);
  await assert.rejects(
    repository.save({} as Parameters<typeof repository.save>[0]),
    (actual) => actual === error,
  );
  assert.equal(observation.stop(), true);
  assert.equal(observation.getSnapshot().failed, 1);
  assert.equal(observation.getSnapshot().succeeded, 0);
});
