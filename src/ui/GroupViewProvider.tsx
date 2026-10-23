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
  setMode: (mode: GroupViewMode) => Promise<boolean>;
}
const GroupViewContext = createContext<GroupViewContextValue | null>(null);
export function GroupViewProvider({ children }: { children: ReactNode }) {
  const [mode, setStoredMode] = useState<GroupViewMode>('self');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const changing = useRef(false);
  useEffect(() => {
    let active = true;
    void groupViewRepository
      .load()
      .then((value) => {
        if (active) setStoredMode(value);
      })
      .catch(() => {
        if (active) setError('查看方式读取失败，暂只看自己。');
      });
    return () => {
      active = false;
    };
  }, []);
  async function setMode(next: GroupViewMode) {
    if (!isGroupViewMode(next) || changing.current) return false;
    if (next === mode && !error) return true;
    changing.current = true;
    setBusy(true);
    setError('');
    try {
      await groupViewRepository.save(next);
      setStoredMode(next);
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
    <GroupViewContext.Provider value={{ mode, busy, error, setMode }}>
      {children}
    </GroupViewContext.Provider>
  );
}
export function useGroupView() {
  const value = useContext(GroupViewContext);
  if (!value) throw new Error('useGroupView 必须在 GroupViewProvider 内使用');
  return value;
}
