import type { ThemeId } from '../src/ui/themeCatalog';

type Repository = {
  load(): Promise<ThemeId>;
  save(id: ThemeId): Promise<void>;
};
type Mode = 'save-fail' | 'save-delay' | 'load-fail';
type Snapshot = {
  mode: Mode | null;
  status: 'idle' | 'armed' | 'processing' | 'completed' | 'failed';
  hits: number;
  loadCalls: number;
  saveCalls: number;
  inFlight: number;
  waitingForRelease: boolean;
};

// 仅场景入口安装；不保存控制标记，也不记录主题值或业务内容。
export function installThemePreferenceControl(repository: Repository) {
  const originalLoad = repository.load;
  const originalSave = repository.save;
  let snapshot: Snapshot = {
    mode: null,
    status: 'idle',
    hits: 0,
    loadCalls: 0,
    saveCalls: 0,
    inFlight: 0,
    waitingForRelease: false,
  };
  const listeners = new Set<() => void>();
  let releaseSave: (() => void) | undefined;
  const update = (patch: Partial<Snapshot>) => {
    snapshot = { ...snapshot, ...patch };
    listeners.forEach((listener) => listener());
  };
  const release = () => {
    if (!releaseSave) return false;
    const resolve = releaseSave;
    releaseSave = undefined;
    update({ waitingForRelease: false });
    resolve();
    return true;
  };
  async function execute<T>(
    operation: 'load' | 'save',
    invoke: () => Promise<T>,
  ): Promise<T> {
    const mode = snapshot.mode;
    const controlled =
      snapshot.status === 'armed' && mode?.startsWith(`${operation}-`);
    update({
      [operation === 'load' ? 'loadCalls' : 'saveCalls']:
        snapshot[operation === 'load' ? 'loadCalls' : 'saveCalls'] + 1,
      inFlight: snapshot.inFlight + 1,
      ...(controlled ? { status: 'processing', hits: snapshot.hits + 1 } : {}),
    });
    try {
      if (controlled && (mode === 'save-fail' || mode === 'load-fail'))
        throw new Error('验收注入：主题偏好接口调用前失败');
      if (controlled && mode === 'save-delay') {
        const pending = new Promise<void>((resolve) => {
          releaseSave = resolve;
        });
        update({ waitingForRelease: true });
        await pending;
      }
      const result = await invoke();
      if (controlled) update({ status: 'completed' });
      return result;
    } catch (error) {
      if (controlled) update({ status: 'failed' });
      throw error;
    } finally {
      update({ inFlight: snapshot.inFlight - 1 });
    }
  }
  repository.load = function () {
    return execute('load', () => originalLoad.call(this));
  };
  repository.save = function (id) {
    return execute('save', () => originalSave.call(this, id));
  };
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    arm(mode: Mode) {
      if (
        snapshot.inFlight > 0 ||
        snapshot.status === 'armed' ||
        snapshot.status === 'processing'
      )
        return false;
      update({ mode, status: 'armed' });
      return true;
    },
    cancel() {
      // 已发起的保存不可丢弃：取消等待也必须继续调用真实保存。
      if (release()) return true;
      if (snapshot.status !== 'armed') return false;
      update({ mode: null, status: 'idle' });
      return true;
    },
    release,
  };
}

export type ThemePreferenceControl = ReturnType<
  typeof installThemePreferenceControl
>;
