import type { StateRepository } from '../src/state/store';

type Snapshot = {
  observing: boolean;
  calls: number;
  succeeded: number;
  failed: number;
  inFlight: number;
};

export function installSaveObservation(repository: StateRepository) {
  const originalSave = repository.save;
  let snapshot: Snapshot = {
    observing: false,
    calls: 0,
    succeeded: 0,
    failed: 0,
    inFlight: 0,
  };
  const listeners = new Set<() => void>();
  const update = (next: Snapshot) => {
    snapshot = next;
    listeners.forEach((listener) => listener());
  };
  repository.save = async (state) => {
    const observed = snapshot.observing;
    update({
      ...snapshot,
      inFlight: snapshot.inFlight + 1,
      calls: snapshot.calls + (observed ? 1 : 0),
    });
    try {
      await originalSave.call(repository, state);
      update({
        ...snapshot,
        inFlight: snapshot.inFlight - 1,
        succeeded: snapshot.succeeded + (observed ? 1 : 0),
      });
    } catch (error) {
      update({
        ...snapshot,
        inFlight: snapshot.inFlight - 1,
        failed: snapshot.failed + (observed ? 1 : 0),
      });
      throw error;
    }
  };
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start() {
      if (snapshot.observing || snapshot.inFlight) return false;
      update({
        observing: true,
        calls: 0,
        succeeded: 0,
        failed: 0,
        inFlight: 0,
      });
      return true;
    },
    stop() {
      if (!snapshot.observing || snapshot.inFlight) return false;
      update({ ...snapshot, observing: false });
      return true;
    },
  };
}

export type SaveObservation = ReturnType<typeof installSaveObservation>;
