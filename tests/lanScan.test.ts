import test from 'node:test';
import assert from 'node:assert/strict';
import { createLanFailureTracker, scanLanHosts } from '../src/state/lanScan';

test('LAN-013: preserve actionable local failures instead of reporting no peer', () => {
  const failures = createLanFailureTracker();
  failures.capture(new Error('connection refused'));
  assert.equal(failures.getError(), null);
  const changed = Object.assign(
    new Error('扫描期间本机记录已变化，请重新同步'),
    { code: 'LOCAL_STATE_CHANGED' },
  );
  failures.capture(changed);
  failures.capture(
    Object.assign(new Error('connection timeout'), { code: 'ETIMEDOUT' }),
  );
  assert.equal(failures.getError(), changed);
  const save = Object.assign(new Error('保存失败，原记录保留'), {
    code: 'LOCAL_SAVE_FAILED',
  });
  failures.capture(save);
  assert.equal(failures.getError(), save);
});

test('LAN-011: never queue more than two native connections', async () => {
  let active = 0;
  let maximum = 0;
  const visited: string[] = [];
  const result = await scanLanHosts(
    ['a', 'b', 'c', 'd'],
    async (host) => {
      maximum = Math.max(maximum, ++active);
      await new Promise<void>((resolve) => setImmediate(resolve));
      visited.push(host);
      active--;
    },
    { found: () => false },
  );
  assert.equal(maximum, 2);
  assert.equal(active, 0);
  assert.deepEqual(visited.sort(), ['a', 'b', 'c', 'd']);
  assert.deepEqual(result, { completed: 4, exhausted: true });
});

test('LAN-011: budget stops new probes and drains started work', async () => {
  let time = 0;
  let active = 0;
  const visited: string[] = [];
  const result = await scanLanHosts(
    ['a', 'b', 'c', 'd'],
    async (host) => {
      active++;
      visited.push(host);
      await new Promise<void>((resolve) => setImmediate(resolve));
      time = 21;
      active--;
    },
    { found: () => false, now: () => time, budgetMs: 20 },
  );
  assert.deepEqual(visited, ['a', 'b']);
  assert.equal(active, 0);
  assert.deepEqual(result, { completed: 2, exhausted: false });
});

test('LAN-011: peer found stops new probes and reports progress', async () => {
  let found = false;
  const visited: string[] = [];
  const progress: number[] = [];
  await scanLanHosts(
    ['a', 'b', 'c'],
    async (host) => {
      visited.push(host);
      found = true;
    },
    { found: () => found, progress: (completed) => progress.push(completed) },
  );
  assert.deepEqual(visited, ['a']);
  assert.deepEqual(progress, [1]);
});
