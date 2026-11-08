import type { StateRepository } from '../src/state/store';

type Mode = 'delay' | 'fail';
type Status = 'idle' | 'armed' | 'processing' | 'completed' | 'failed';
type Snapshot = {
  mode: Mode | null;
  status: Status;
  hits: number;
  remaining: number;
};

export function installBusinessSaveControl(
  repository: StateRepository,
  wait = () => new Promise<void>((resolve) => setTimeout(resolve, 8000)),
) {
  const originalSave = repository.save;
  let snapshot: Snapshot = {
    mode: null,
    status: 'idle',
    hits: 0,
    remaining: 0,
  };
  const listeners = new Set<() => void>();
  const update = (next: Snapshot) => {
    snapshot = next;
    listeners.forEach((listener) => listener());
  };
  const save: StateRepository['save'] = async (state) => {
    if (snapshot.status !== 'armed')
      return originalSave.call(repository, state);
    const mode = snapshot.mode!;
    if (snapshot.remaining > 1) {
      const remaining = snapshot.remaining - 1;
      update({ ...snapshot, status: 'processing' });
      try {
        await originalSave.call(repository, state);
        update({ ...snapshot, status: 'armed', remaining });
      } catch (error) {
        update({ ...snapshot, status: 'failed' });
        throw error;
      }
      return;
    }
    update({
      mode,
      status: 'processing',
      hits: snapshot.hits + 1,
      remaining: 0,
    });
    try {
      if (mode === 'fail') throw new Error('验收注入：本次业务保存失败');
      await wait();
      await originalSave.call(repository, state);
      update({ ...snapshot, status: 'completed' });
    } catch (error) {
      update({ ...snapshot, status: 'failed' });
      throw error;
    }
  };
  repository.save = save;
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    arm(mode: Mode, remaining = 1) {
      if (snapshot.status === 'processing' || snapshot.status === 'armed')
        return false;
      if (!Number.isInteger(remaining) || remaining < 1 || remaining > 4)
        return false;
      update({ mode, status: 'armed', hits: snapshot.hits, remaining });
      return true;
    },
    cancel() {
      if (snapshot.status !== 'armed') return false;
      update({ mode: null, status: 'idle', hits: snapshot.hits, remaining: 0 });
      return true;
    },
  };
}
