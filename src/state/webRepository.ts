import type { PersistedAppState } from '../domain/engine';
import { validateSync } from '../domain/syncModel';
import type { StateRepository } from './store';

export const WEB_STORAGE_KEY = 'sprout-native-sync-v1';

export interface WebStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function createWebRepository(
  getStorage: () => WebStorage,
): StateRepository {
  return {
    async load(): Promise<unknown | null> {
      // 延迟访问，服务端导入和测试不需要存在 window。
      const payload = getStorage().getItem(WEB_STORAGE_KEY);
      if (payload === null) return null;
      const parsed: unknown = JSON.parse(payload);
      if (parsed === null)
        throw new Error('本地数据格式无效，请保留原始数据后重试');
      return parsed;
    },
    async save(state: PersistedAppState): Promise<void> {
      validateSync(state);
      // 配额或隐私模式导致写入失败时直接上抛，store 不发布未保存状态。
      getStorage().setItem(WEB_STORAGE_KEY, JSON.stringify(state));
    },
  };
}
