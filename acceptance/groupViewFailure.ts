import type { GroupViewMode } from '../src/state/groupView';

// 仅由验收入口导入，不替换业务仓库，也不模拟真实 SQLite I/O 故障。
export function installGroupViewFailure(repository: {
  save(mode: GroupViewMode): Promise<void>;
}) {
  const originalSave = repository.save;
  let armed = false;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());
  const save = async (mode: GroupViewMode) => {
    if (armed && mode === 'group') {
      armed = false;
      notify();
      throw new Error('验收注入：本次查看方式保存失败');
    }
    await originalSave.call(repository, mode);
  };
  repository.save = save;
  return {
    getSnapshot: () => armed,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    arm() {
      armed = true;
      notify();
    },
    cancel() {
      armed = false;
      notify();
    },
    dispose() {
      armed = false;
      if (repository.save === save) repository.save = originalSave;
      listeners.clear();
    },
  };
}
