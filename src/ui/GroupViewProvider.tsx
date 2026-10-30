import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { groupViewRepository } from '../state/groupViewStorage';
import { isGroupViewMode, type GroupViewMode } from '../state/groupView';

interface GroupViewContextValue {
  mode: GroupViewMode;
  busy: boolean;
  error: string;
  readFailed: boolean;
  setMode: (mode: GroupViewMode) => Promise<boolean>;
}
const GroupViewContext = createContext<GroupViewContextValue | null>(null);
export function GroupViewProvider({ children }: { children: ReactNode }) {
  const [mode, setStoredMode] = useState<GroupViewMode>('self');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [readFailed, setReadFailed] = useState(false);
  const changing = useRef(false);
  const loaded = useRef(false);
  useEffect(() => {
    let active = true;
    void groupViewRepository
      .load()
      .then((value) => {
        if (active) setStoredMode(value);
      })
      .catch(() => {
        if (active) {
          setReadFailed(true);
          setError('查看方式读取失败，暂只看自己。');
        }
      })
      .finally(() => {
        if (active) {
          loaded.current = true;
          setBusy(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);
  async function setMode(next: GroupViewMode) {
    if (!isGroupViewMode(next) || !loaded.current || changing.current)
      return false;
    if (next === mode && !error) return true;
    changing.current = true;
    setBusy(true);
    setError('');
    try {
      await groupViewRepository.save(next);
      setStoredMode(next);
      setReadFailed(false);
      return true;
    } catch {
      setError('查看方式保存失败，已保留当前选择。');
      return false;
    } finally {
      changing.current = false;
      setBusy(false);
    }
  }
  return (
    <GroupViewContext.Provider
      value={{ mode, busy, error, readFailed, setMode }}
    >
      {children}
    </GroupViewContext.Provider>
  );
}
export function useGroupView() {
  const value = useContext(GroupViewContext);
  if (!value) throw new Error('useGroupView 必须在 GroupViewProvider 内使用');
  return value;
}
