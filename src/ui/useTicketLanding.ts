import { useEffect, useRef, useState } from 'react';
import type { GroupViewMode } from '../state/groupView';

type LandingStatus = 'pending' | 'running' | 'saved' | 'failed' | 'dismissed';
type Landing = {
  at: number | undefined;
  status: LandingStatus;
  target?: GroupViewMode;
};

// 路由意图只覆盖当前页面；全局偏好仍须成功落盘后才能改变。
export function useTicketLanding(
  at: number | undefined,
  focused: boolean,
  mode: GroupViewMode,
  busy: boolean,
  setMode: (mode: GroupViewMode) => Promise<boolean>,
  readFailed = false,
) {
  const [landing, setLanding] = useState<Landing>({
    at,
    status: at == null ? 'dismissed' : 'pending',
  });
  const startedAt = useRef<number | undefined>(undefined);
  const operation = useRef<symbol | null>(null);
  const [operationVersion, setOperationVersion] = useState(0);
  const previousFocus = useRef({ focused, at });
  if (landing.at !== at) {
    setLanding({ at, status: at == null ? 'dismissed' : 'pending' });
  } else if (
    landing.status === 'saved' &&
    mode === landing.target &&
    at != null
  ) {
    setLanding({ at, status: 'dismissed' });
  }

  const current =
    landing.at === at ? landing : { at, status: 'pending' as const };
  const forceSelf = focused && at != null && current.status !== 'dismissed';

  useEffect(() => {
    const previous = previousFocus.current;
    previousFocus.current = { focused, at };
    if (previous.focused && !focused && previous.at != null) {
      const previousAt = previous.at;
      setLanding((value) =>
        value.at === previousAt
          ? { at: previousAt, status: 'dismissed' }
          : value,
      );
    }
  }, [focused, at]);

  useEffect(() => {
    if (
      !forceSelf ||
      current.status !== 'pending' ||
      busy ||
      readFailed ||
      at == null ||
      startedAt.current === at ||
      operation.current
    )
      return;
    startedAt.current = at;
    const token = Symbol();
    operation.current = token;
    setLanding({ at, status: 'running' });
    void setMode('self').then((success) => {
      if (operation.current === token) operation.current = null;
      setOperationVersion((version) => version + 1);
      setLanding((previous) =>
        previous.at === at && previous.status === 'running'
          ? { at, status: success ? 'saved' : 'failed', target: 'self' }
          : previous,
      );
    });
  }, [
    at,
    busy,
    current.status,
    forceSelf,
    operationVersion,
    readFailed,
    setMode,
  ]);

  async function selectMode(next: GroupViewMode) {
    if (busy || operation.current) return false;
    const token = Symbol();
    operation.current = token;
    if (forceSelf && at != null) {
      startedAt.current = at;
      setLanding({ at, status: 'running' });
    }
    const success = await setMode(next);
    if (operation.current === token) operation.current = null;
    setOperationVersion((version) => version + 1);
    if (forceSelf && at != null) {
      setLanding((previous) =>
        previous.at === at && previous.status === 'running'
          ? { at, status: success ? 'saved' : 'failed', target: next }
          : previous,
      );
    }
    return success;
  }

  return {
    forceSelf,
    pending: forceSelf && current.status === 'running',
    failed:
      forceSelf &&
      (current.status === 'failed' ||
        (current.status === 'pending' && !busy && readFailed)),
    selectMode,
  };
}
