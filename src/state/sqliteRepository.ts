import type { PersistedAppState } from '../domain/engine';
import { validateSync } from '../domain/syncModel';
import type { StateRepository } from './store';

export interface SqliteTransaction {
  runAsync(
    query: string,
    ...params: (string | number | null)[]
  ): Promise<unknown>;
}

export interface SqliteConnection {
  execAsync(query: string): Promise<void>;
  getFirstAsync<T>(query: string): Promise<T | null>;
  withExclusiveTransactionAsync(
    task: (transaction: SqliteTransaction) => Promise<void>,
  ): Promise<void>;
}

export function createSQLiteRepository(
  connect: () => Promise<SqliteConnection>,
): StateRepository {
  return {
    async load(): Promise<unknown | null> {
      const database = await connect();
      await database.execAsync(
        'CREATE TABLE IF NOT EXISTS app_state (id INTEGER PRIMARY KEY CHECK(id = 1), payload TEXT NOT NULL)',
      );
      const row = await database.getFirstAsync<{ payload: string }>(
        'SELECT payload FROM app_state WHERE id = 1',
      );
      if (!row) return null;
      // 解析失败上抛给错误页，保留数据库原文，不替换为空数据。
      const parsed: unknown = JSON.parse(row.payload);
      if (parsed === null)
        throw new Error('本地数据格式无效，请保留原始数据后重试');
      return parsed;
    },
    async save(state: PersistedAppState): Promise<void> {
      validateSync(state);
      const payload = JSON.stringify(state);
      const database = await connect();
      await database.withExclusiveTransactionAsync(async (transaction) => {
        await transaction.runAsync(
          'INSERT INTO app_state (id, payload) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload',
          payload,
        );
      });
    },
  };
}
