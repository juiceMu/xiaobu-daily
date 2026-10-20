import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/domain/engine';
import { initializeSync } from '../src/domain/syncModel';
import { createSQLiteRepository } from '../src/state/sqliteRepository';
import type { SqliteConnection } from '../src/state/sqliteRepository';

function databaseFixture(initial: string | null = null) {
  let payload = initial;
  let failCommit = false;
  let inTransaction = false;
  const writes: string[] = [];
  const database: SqliteConnection = {
    execAsync: async () => {},
    getFirstAsync: async <T>() =>
      (payload === null ? null : { payload }) as T | null,
    withExclusiveTransactionAsync: async (task) => {
      let pending: string | null = payload;
      inTransaction = true;
      try {
        await task({
          runAsync: async (query, ...params) => {
            assert.equal(inTransaction, true);
            assert.equal(query.includes('ON CONFLICT(id)'), true);
            assert.equal(params.length, 1);
            assert.equal(typeof params[0], 'string');
            pending = String(params[0]);
            writes.push(pending);
          },
        });
        if (failCommit) throw new Error('事务提交失败');
        payload = pending;
      } finally {
        inTransaction = false;
      }
    },
  };
  return {
    repository: createSQLiteRepository(async () => database),
    getPayload: () => payload,
    writes,
    failNextCommit: () => {
      failCommit = true;
    },
  };
}

test('SQLite仓库仅无记录返回null；读取不写入，事务参数化提交完整状态', async () => {
  const fixture = databaseFixture();
  assert.equal(await fixture.repository.load(), null);
  assert.equal(fixture.writes.length, 0);
  const business = createInitialState();
  business.tasks[0].name = "提醒 ' 喝水 ?";
  const state = initializeSync(business);
  await fixture.repository.save(state);
  assert.deepEqual(await fixture.repository.load(), state);
  assert.equal(fixture.writes.length, 1);
});

test('SQLite提交失败回滚原内容，损坏JSON原样保留并上抛', async () => {
  const original = JSON.stringify(createInitialState());
  const fixture = databaseFixture(original);
  fixture.failNextCommit();
  const business = createInitialState();
  business.tasks[0].name = '更新不可丢失原数据';
  const updated = initializeSync(business);
  await assert.rejects(fixture.repository.save(updated), /事务提交失败/);
  assert.equal(fixture.getPayload(), original);
  const corrupted = databaseFixture('{损坏的原始数据');
  await assert.rejects(corrupted.repository.load());
  assert.equal(corrupted.getPayload(), '{损坏的原始数据');
  assert.equal(corrupted.writes.length, 0);
  const nullPayload = databaseFixture('null');
  await assert.rejects(nullPayload.repository.load(), /本地数据格式无效/);
  assert.equal(nullPayload.getPayload(), 'null');
  assert.equal(nullPayload.writes.length, 0);
});
