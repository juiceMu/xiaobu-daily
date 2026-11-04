import test from 'node:test';
import assert from 'node:assert/strict';
import { openMemberRecord } from '../src/ui/openMemberRecord';

test('成员入口保存成功才导航，失败或异常反馈并可重试', async () => {
  const calls: string[] = [];
  const navigate = () => calls.push('navigate');
  const fail = () => calls.push('failure');
  await openMemberRecord(
    async () => false,
    () => true,
    navigate,
    fail,
  );
  await openMemberRecord(
    async () => {
      throw new Error('save');
    },
    () => true,
    navigate,
    fail,
  );
  await openMemberRecord(
    async () => true,
    () => true,
    navigate,
    fail,
  );
  assert.deepEqual(calls, ['failure', 'failure', 'navigate']);
});

test('切分区、离页、离组及新请求取代旧请求后，迟到成功或失败都不导航不反馈', async () => {
  for (const result of [true, false]) {
    let resolve!: (value: boolean) => void;
    const saved = new Promise<boolean>((done) => {
      resolve = done;
    });
    let intent = 1;
    const calls: string[] = [];
    const pending = openMemberRecord(
      () => saved,
      () => intent === 1,
      () => calls.push('navigate'),
      () => calls.push('failure'),
    );
    intent += 1;
    resolve(result);
    await pending;
    assert.deepEqual(calls, []);
  }
});
