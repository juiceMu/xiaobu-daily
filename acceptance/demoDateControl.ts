import { createInitialState } from '../src/domain/engine';
import { loadDemoHistory } from '../src/state/demoHistory';
import type { AppStore } from '../src/state/store';

export function createDemoDateControl(clock = () => new Date()) {
  let armed = false;
  const listeners = new Set<() => void>();
  const update = (next: boolean) => {
    armed = next;
    listeners.forEach((listener) => listener());
  };
  return {
    getSnapshot: () => armed,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    arm() {
      update(true);
    },
    cancel() {
      update(false);
    },
    async load(store: AppStore) {
      if (!armed) return loadDemoHistory(store);
      update(false);
      const state = store.getSnapshot().state;
      const initial = createInitialState();
      if (
        !state ||
        state.groupLink ||
        state.groupOwned ||
        state.pendingGroupDeparture ||
        state.groupPeers?.length ||
        state.checkins.length ||
        state.tickets.length ||
        state.redemptions.length ||
        state.milestoneGoals.length ||
        state.giftState ||
        !state.sync ||
        state.sync.sequence !== 6 ||
        state.sync.outbox.length !== 5 ||
        Object.keys(state.sync.entities).length !== 5 ||
        Object.values(state.sync.entities).some(
          (entity) => entity.revision !== 1 || entity.deletedAt !== null,
        ) ||
        Object.keys(state.sync.attachments).length ||
        Object.keys(state.sync.acknowledged).length ||
        JSON.stringify(state.weight) !== JSON.stringify(initial.weight) ||
        JSON.stringify(state.tasks) !== JSON.stringify(initial.tasks) ||
        JSON.stringify(state.settings) !== JSON.stringify(initial.settings)
      ) {
        return { ok: false, message: '上周验收仅允许初始空存档，未修改数据' };
      }
      const previous = new Date(clock());
      previous.setDate(previous.getDate() - 7);
      return loadDemoHistory(store, previous);
    },
  };
}
