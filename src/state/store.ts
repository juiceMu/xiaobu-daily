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
  type AccountJournal,
  exportAccountJournal,
} from '../domain/syncModel';
import {
  applyGroupJournals as mergeGroupJournals,
  journalIsPersistedPrefix,
} from '../domain/groupSync';
import { reconcileCompanionUses } from '../domain/companion';

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
  let groupSyncLease = false;
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
  const applyGroupJournals = async (
    journals: AccountJournal[],
    syncedAt: string,
  ): Promise<ActionResult & { persisted: boolean }> => {
    if ((snapshot.busy && !groupSyncLease) || !snapshot.state)
      return {
        ok: false,
        message: '本地数据正在保存或尚未就绪',
        persisted: false,
      };
    const current = snapshot.state;
    publish({ ...snapshot, busy: true, error: null });
    try {
      const merged = mergeGroupJournals(current, journals, syncedAt);
      // 联合用券只推进本机记录，与收到的副本一起落盘后才能向对方确认。
      const reconciled = reconcileCompanionUses(merged.state, syncedAt);
      if (!reconciled.ok) throw new Error(reconciled.message);
      const next = commitSync(current, migrateState(merged.state), clock);
      validateSync(next);
      const persisted =
        journals.length > 0 &&
        journals.every((journal) => {
          // 对方会转回本机旧日志；只确认与本机已落盘链完全一致的前缀。
          if (journal.accountId === next.sync.accountId)
            return journalIsPersistedPrefix(journal, {
              ...exportAccountJournal(next),
              syncedAt,
            });
          const saved = next.groupPeers?.find(
            (peer) => peer.accountId === journal.accountId,
          );
          return !!saved && journalIsPersistedPrefix(journal, saved);
        });
      await repository.save(next);
      publish({ state: next, busy: groupSyncLease, error: null });
      return { ok: true, message: merged.message, persisted };
    } catch (error) {
      const detail = error instanceof Error ? error.message : '同步没有完成';
      publish({ state: current, busy: groupSyncLease, error: null });
      return { ok: false, message: `${detail}，原记录保留`, persisted: false };
    }
  };
  const beginGroupSync = () => {
    if (snapshot.busy || groupSyncLease || !snapshot.state) return null;
    groupSyncLease = true;
    publish({ ...snapshot, busy: true, error: null });
    let released = false;
    return () => {
      if (released) return;
      released = true;
      groupSyncLease = false;
      publish({ ...snapshot, busy: false, error: null });
    };
  };
  const completeGroupDeparture = async (
    sent: AccountJournal,
    peerStored: boolean,
  ): Promise<ActionResult> => {
    if ((snapshot.busy && !groupSyncLease) || !snapshot.state)
      return { ok: false, message: '本地数据正在保存或尚未就绪' };
    if (!peerStored)
      return { ok: false, message: '对方尚未保存本机记录，离开通知仍待同步' };
    const current = snapshot.state;
    const pending = current.pendingGroupDeparture;
    if (
      !pending ||
      !current.sync?.entities[
        `memberships:${pending.groupId}/${current.sync.accountId}`
      ]?.deletedAt
    )
      return { ok: false, message: '没有匹配的待完成离组通知' };
    try {
      const latest = exportAccountJournal(current);
      if (
        !latest ||
        sent.accountId !== latest.accountId ||
        sent.deviceId !== latest.deviceId
      )
        return { ok: false, message: '离组期间本机数据已变化，请重新同步' };
      const sentTail = sent.operations.at(-1)?.operationId;
      const localTail = latest.operations.at(-1)?.operationId;
      if (!sentTail || sentTail !== localTail)
        return { ok: false, message: '离组期间本机数据已变化，请重新同步' };
      const next = structuredClone(current);
      delete next.pendingGroupDeparture;
      validateSync(next);
      publish({ ...snapshot, busy: true, error: null });
      await repository.save(next);
      publish({ state: next, busy: groupSyncLease, error: null });
      return { ok: true, message: '对方已保存离开通知' };
    } catch (error) {
      const detail = error instanceof Error ? error.message : '保存失败';
      publish({ state: current, busy: groupSyncLease, error: detail });
      return { ok: false, message: `离开通知仍待同步：${detail}` };
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
    applyGroupJournals,
    completeGroupDeparture,
    beginGroupSync,
  };
}

export type AppStore = ReturnType<typeof createAppStore>;
