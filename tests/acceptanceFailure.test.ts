import test from 'node:test';
import assert from 'node:assert/strict';
import { installGroupViewFailure } from '../acceptance/groupViewFailure';
import { createGroupViewRepository } from '../src/state/groupView';

test('验收一次性group失败不写仓库，self不消耗开关，随后恢复真实保存', async () => {
  let saved: string | null = null;
  let writes = 0;
  const repository = createGroupViewRepository({
    getItem: () => saved,
    setItem: (_key, value) => {
      writes += 1;
      saved = value;
    },
  });
  const control = installGroupViewFailure(repository);
  const snapshots: boolean[] = [];
  const unsubscribe = control.subscribe(() =>
    snapshots.push(control.getSnapshot()),
  );
  assert.equal(control.getSnapshot(), false);
  control.arm();
  await repository.save('self');
  assert.equal(control.getSnapshot(), true);
  assert.equal(writes, 1);
  await assert.rejects(repository.save('group'), /验收注入/);
  assert.equal(await repository.load(), 'self');
  assert.equal(writes, 1);
  assert.equal(control.getSnapshot(), false);
  await repository.save('group');
  assert.equal(await repository.load(), 'group');
  assert.equal(writes, 2);
  assert.deepEqual(snapshots, [true, false]);
  unsubscribe();
  control.dispose();
});

test('取消和移除控制均不残留故障，原仓库错误仍原样传播', async () => {
  const error = new Error('真实仓库异常');
  let fail = false;
  const repository = {
    async save() {
      if (fail) throw error;
    },
  };
  const originalSave = repository.save;
  const control = installGroupViewFailure(repository);
  control.arm();
  control.cancel();
  await repository.save();
  fail = true;
  await assert.rejects(repository.save(), (caught) => caught === error);
  control.arm();
  control.dispose();
  assert.equal(repository.save, originalSave);
  assert.equal(control.getSnapshot(), false);
});
