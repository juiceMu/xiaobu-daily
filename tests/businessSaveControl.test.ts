import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installBusinessSaveControl } from '../acceptance/businessSaveControl';
import { createAppStore, type StateRepository } from '../src/state/store';
import { checkIn } from '../src/domain/engine';

function deferred() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

test('真实store延迟一次保存，先消费再通知；并发不能再命中或重新待命，释放后正常提交', async () => {
  const gate = deferred();
  let writes = 0;
  const repository: StateRepository = {
    load: async () => null,
    save: async () => {
      writes += 1;
    },
  };
  const control = installBusinessSaveControl(repository, () => gate.promise);
  let id = 0;
  const store = createAppStore(repository, {
    now: () => new Date('2026-11-06T12:00:00Z'),
    id: () => `save-control-id-${++id}`,
  });
  await store.initialize();
  assert.equal(writes, 1);
  const notifications: string[] = [];
  control.subscribe(() => {
    notifications.push(control.getSnapshot().status);
    if (control.getSnapshot().status === 'processing')
      assert.equal(control.arm('fail'), false);
  });
  assert.equal(control.arm('delay'), true);
  assert.equal(control.arm('fail'), false);
  const pending = store.run((draft) => checkIn(draft, 'task-1'));
  assert.equal(control.getSnapshot().status, 'processing');
  assert.equal(control.getSnapshot().hits, 1);
  assert.equal(store.getSnapshot().busy, true);
  assert.equal(
    (await store.run((draft) => checkIn(draft, 'task-2'))).ok,
    false,
  );
  assert.equal(control.cancel(), false);
  assert.equal(writes, 1);
  gate.release();
  assert.equal((await pending).ok, true);
  assert.equal(writes, 2);
  assert.equal(store.getSnapshot().busy, false);
  assert.equal(control.getSnapshot().status, 'completed');
  assert.deepEqual(notifications, ['armed', 'processing', 'completed']);
});

test('取消待命、注入失败后可重试；真实保存异常原样传播并标失败', async () => {
  let calls = 0;
  const originalError = new Error('真实保存异常');
  let reject = false;
  const repository: StateRepository = {
    load: async () => null,
    save: async () => {
      calls += 1;
      if (reject) throw originalError;
    },
  };
  const control = installBusinessSaveControl(repository, async () => {});
  const value = {} as Parameters<typeof repository.save>[0];
  assert.equal(control.arm('fail'), true);
  assert.equal(control.cancel(), true);
  await repository.save(value);
  assert.equal(calls, 1);
  assert.equal(control.getSnapshot().hits, 0);
  assert.equal(control.arm('fail'), true);
  await assert.rejects(repository.save(value), /验收注入/);
  assert.equal(calls, 1);
  assert.equal(control.getSnapshot().status, 'failed');
  await repository.save(value);
  assert.equal(calls, 2);
  reject = true;
  assert.equal(control.arm('delay'), true);
  await assert.rejects(
    repository.save(value),
    (error) => error === originalError,
  );
  assert.equal(control.getSnapshot().status, 'failed');
  assert.equal(control.getSnapshot().hits, 2);
  reject = false;
  await repository.save(value);
  assert.equal(calls, 4);
});

test('指定第3次业务保存失败，前两次真实提交，重试不再注入', async () => {
  let calls = 0;
  const repository: StateRepository = {
    load: async () => null,
    save: async () => {
      calls += 1;
    },
  };
  const control = installBusinessSaveControl(repository);
  const value = {} as Parameters<typeof repository.save>[0];
  assert.equal(control.arm('fail', 0), false);
  assert.equal(control.arm('fail', 3), true);
  await repository.save(value);
  assert.equal(control.getSnapshot().remaining, 2);
  await repository.save(value);
  assert.equal(control.getSnapshot().remaining, 1);
  await assert.rejects(repository.save(value), /验收注入/);
  assert.equal(calls, 2);
  assert.equal(control.getSnapshot().hits, 1);
  await repository.save(value);
  assert.equal(calls, 3);
});

test('验收面板条件Modal隔离后台，关闭不取消待命且不发起业务写入', () => {
  const source = readFileSync(
    new URL('../acceptance/AcceptanceApp.tsx', import.meta.url),
    'utf8',
  );
  assert.match(source, /useAndroidMountReady\(600\)/);
  assert.match(
    source,
    /ready && open \? \(\s*<Modal\s+visible\s+animationType="none"\s+onRequestClose=\{\(\) => setOpen\(false\)\}/,
  );
  assert.match(source, /accessibilityViewIsModal\s+aria-modal/);
  assert.match(source, /installBusinessSaveControl\(nativeRepository\)/);
  assert.doesNotMatch(source, /listenForControlBack|store\.run|run\(\(draft/);
});
