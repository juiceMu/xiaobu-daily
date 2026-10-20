import { createInitialState, migrateState } from '../domain/engine';
import type {
  ActionResult,
  AppState,
  PersistedAppState,
} from '../domain/engine';
import {
  initializeSync,
  commitSync,
  validateSync,
  getSyncBatch,
  acknowledgeSync,
  defaultSyncClock,
  type SyncClock,
  type SyncBatch,
} from '../domain/syncModel';

export interface StateRepository {
  load(): Promise<unknown | null>;
  save(state: PersistedAppState): Promise<void>;
}

export type Mutation = (draft: AppState) => ActionResult;
export type StoreSnapshot = {
  state: PersistedAppState | null;
  busy: boolean;
  error: string | null;
};

export function createAppStore(
  repository: StateRepository,
  clock: SyncClock = defaultSyncClock,
) {
  let snapshot: StoreSnapshot = { state: null, busy: false, error: null };
  const subscribers = new Set<() => void>();
  const publish = (next: StoreSnapshot) => {
    snapshot = next;
    for (const subscriber of subscribers) subscriber();
  };

  const initialize = async (): Promise<void> => {
    if (snapshot.busy || snapshot.state) return;
    publish({ state: null, busy: true, error: null });
    try {
      const saved = await repository.load();
      const business =
        saved === null ? createInitialState() : migrateState(saved);
      const hasSchema =
        business.storageVersion !== undefined || business.sync !== undefined;
      if (saved !== null && !hasSchema)
        throw new Error(
          '此存档属于旧存储版本，请保留原始数据；本版本不会自动转换或清空',
        );
      if (hasSchema) validateSync(business);
      const state = hasSchema ? business : initializeSync(business, clock);
      validateSync(state);
      // 仅确实无存档时建立身份和初始事务；旧版或损坏记录绝不覆盖。
      if (!hasSchema) await repository.save(state);
      publish({ state, busy: false, error: null });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : '本地数据读取失败';
      publish({ state: null, busy: false, error: message });
    }
  };

  const run = async (mutation: Mutation): Promise<ActionResult> => {
    if (snapshot.busy) return { ok: false, message: '正在保存，请稍后再试' };
    if (!snapshot.state)
      return { ok: false, message: '本地数据尚未就绪，请先重试加载' };
    const current = snapshot.state;
    publish({ ...snapshot, busy: true, error: null });
    try {
      const draft = migrateState(current);
      const result = mutation(draft);
      if (!result.ok) {
        publish({ state: current, busy: false, error: null });
        return result;
      }
      const validated = commitSync(current, migrateState(draft), clock);
      await repository.save(validated);
      // 事务完成后才发布，保存失败时保留上一份可见数据和表单输入。
      publish({ state: validated, busy: false, error: null });
      return result;
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : '未知错误';
      publish({ state: current, busy: false, error: detail });
      return { ok: false, message: `保存失败，未更改数据：${detail}` };
    }
  };
  const pendingSync = (accountId: string, maxTransactions = 20) => {
    if (!snapshot.state) throw new Error('本地数据尚未就绪');
    return getSyncBatch(snapshot.state, accountId, maxTransactions);
  };
  const acknowledge = async (batch: SyncBatch): Promise<ActionResult> => {
    if (snapshot.busy || !snapshot.state)
      return { ok: false, message: '本地数据正在保存或尚未就绪' };
    const current = snapshot.state;
    publish({ ...snapshot, busy: true, error: null });
    try {
      const next = acknowledgeSync(current, batch);
      await repository.save(next);
      publish({ state: next, busy: false, error: null });
      return { ok: true, message: '已记录指定事务的同步确认' };
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : '同步确认保存失败';
      publish({ state: current, busy: false, error: detail });
      return { ok: false, message: detail };
    }
  };

  return {
    getSnapshot: () => snapshot,
    subscribe: (subscriber: () => void) => {
      subscribers.add(subscriber);
      return () => {
        subscribers.delete(subscriber);
      };
    },
    initialize,
    run,
    pendingSync,
    acknowledge,
  };
}

export type AppStore = ReturnType<typeof createAppStore>;
