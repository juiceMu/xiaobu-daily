import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useRef,
  useSyncExternalStore,
} from 'react';
import {
  AppState as NativeAppState,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { ActivityIndicator, Button, Text } from 'react-native-paper';
import type { ActionResult, AppState } from '../domain/engine';
import * as Crypto from 'expo-crypto';
import { nativeRepository } from './nativeRepository';
import { createAppStore } from './store';
import type { AppStore, Mutation } from './store';
import { loadDemoHistory } from './demoHistory';
import {
  journalsForSend,
  validateDepartureJournals,
} from '../domain/groupSync';
import type { LanExchange } from './lanExchange';
import { exchangeOnLan, startLanListener } from './lanSync';
import { hasPendingCompanionUse, syncCompanionRounds } from './companionSync';

export interface AppContextValue {
  state: AppState;
  busy: boolean;
  now: Date;
  run: (mutation: Mutation) => Promise<ActionResult>;
  previewDemoHistory: () => Promise<ActionResult>;
  syncGroup: () => Promise<void>;
  message: string;
  clearMessage: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);
const defaultStore = createAppStore(nativeRepository, {
  now: () => new Date(),
  id: () => Crypto.randomUUID(),
});

export function AppProvider({
  children,
  store = defaultStore,
}: {
  children: React.ReactNode;
  store?: AppStore;
}) {
  const snapshot = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getSnapshot,
  );
  const [now, setNow] = useState(() => new Date());
  const [message, setMessage] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [appActive, setAppActive] = useState(
    NativeAppState.currentState === 'active',
  );
  const demoRequested = useRef(false);
  const activeGroupSession = useRef<(() => void) | null>(null);
  const manualSyncActive = useRef(false);
  const peerDidNotStoreJournal = useRef(false);

  const listenerGroupId =
    snapshot.state?.groupLink?.groupId ??
    snapshot.state?.pendingGroupDeparture?.groupId;
  useEffect(() => {
    void store.initialize();
  }, [store]);
  useEffect(() => {
    // 刷新时不要恢复上次滚动/焦点位置，避免页面自己跳到旧位置。
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const previous = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    return () => {
      window.history.scrollRestoration = previous;
    };
  }, []);
  useEffect(() => {
    const subscription = NativeAppState.addEventListener('change', (status) =>
      setAppActive(status === 'active'),
    );
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    if (
      !__DEV__ ||
      Platform.OS !== 'web' ||
      typeof window === 'undefined' ||
      !snapshot.state ||
      snapshot.busy ||
      demoRequested.current ||
      new URLSearchParams(window.location.search).get('demoHistory') !== '1'
    )
      return;
    demoRequested.current = true;
    void loadDemoHistory(store)
      .then((result) => setMessage(result.message))
      .catch(() => {
        setMessage('演示历史未添加，请在设置中重试。原数据已保留。');
      });
  }, [store, snapshot.state, snapshot.busy]);
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    const subscription = NativeAppState.addEventListener('change', (status) => {
      if (status === 'active') setNow(new Date());
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);

  const run = useCallback(
    async (mutation: Mutation): Promise<ActionResult> => {
      const result = await store.run(mutation);
      if (!activeGroupSession.current) setMessage(result.message);
      setNow(new Date());
      return result;
    },
    [store],
  );
  const clearMessage = useCallback(() => setMessage(''), []);
  const previewDemoHistory = useCallback(async () => {
    const result = await loadDemoHistory(store);
    setMessage(result.message);
    setNow(new Date());
    return result;
  }, [store]);
  const receiveGroupJournals = useCallback(
    async (journals: import('../domain/syncModel').AccountJournal[]) => {
      const state = store.getSnapshot().state;
      if (!state) return { ok: false, message: '本地数据尚未就绪' };
      if (state.pendingGroupDeparture) {
        validateDepartureJournals(state, journals);
        return store.applyGroupJournals(journals, new Date().toISOString());
      }
      return store.applyGroupJournals(journals, new Date().toISOString());
    },
    [store],
  );
  const sessionOptions = useCallback(
    () => ({
      randomBytes: (length: number) => Crypto.getRandomBytesAsync(length),
      onSessionStart: (input: LanExchange) => {
        const latest = store.getSnapshot().state;
        const sentTail = input.journals[0]?.operations.at(-1)?.operationId;
        const latestTail =
          latest && journalsForSend(latest)[0]?.operations.at(-1)?.operationId;
        if (!latest || sentTail !== latestTail)
          throw new Error('扫描期间本机记录已变化，请重新同步');
        const release = store.beginGroupSync();
        if (!release) throw new Error('本机正在保存或同步，请稍后重试');
        activeGroupSession.current = release;
      },
      onReceive: receiveGroupJournals,
      onSynchronized: async (input: LanExchange, peerStoredInput: boolean) => {
        if (!peerStoredInput) {
          peerDidNotStoreJournal.current = true;
          if (!manualSyncActive.current)
            setMessage('已收到对方离组通知；对方未保存本机记录');
        }
        const state = store.getSnapshot().state;
        if (
          state?.pendingGroupDeparture &&
          input.groupId === state.pendingGroupDeparture.groupId
        ) {
          const result = await store.completeGroupDeparture(
            input.journals[0],
            peerStoredInput,
          );
          if (!result.ok) throw new Error(result.message);
          setMessage(result.message);
        }
      },
      onSessionEnd: async () => {
        const release = activeGroupSession.current;
        activeGroupSession.current = null;
        release?.();
      },
    }),
    [receiveGroupJournals, store],
  );

  useEffect(() => {
    const state = store.getSnapshot().state;
    if (
      Platform.OS === 'web' ||
      !appActive ||
      (!state?.groupLink && !state?.pendingGroupDeparture)
    )
      return;
    const stop = startLanListener({
      getInput: () => {
        const current = store.getSnapshot();
        if (!appActive || current.busy || !current.state) return null;
        const membership =
          current.state.groupLink ?? current.state.pendingGroupDeparture;
        if (!membership) return null;
        return {
          groupId: membership.groupId,
          secret: membership.secret,
          accountId: current.state.sync.accountId,
          journals: journalsForSend(current.state),
        };
      },
      ...sessionOptions(),
      onError: (error) => {
        if (!/口令验证|认证失败/.test(error.message)) setMessage(error.message);
      },
    });
    return stop;
  }, [appActive, listenerGroupId, sessionOptions, store]);

  const syncGroup = useCallback(async () => {
    const current = store.getSnapshot();
    if (
      !current.state ||
      (!current.state.groupLink && !current.state.pendingGroupDeparture)
    ) {
      setMessage('还没有加入小组');
      return;
    }
    if (current.busy || manualSyncActive.current) {
      setMessage('正在保存，请稍后再试');
      return;
    }
    manualSyncActive.current = true;
    setSyncing(true);
    peerDidNotStoreJournal.current = false;
    setMessage('正在同一 WiFi 下寻找其他手机…');
    try {
      await syncCompanionRounds(
        () => store.getSnapshot().state,
        async (state) => {
          const membership = state.groupLink ?? state.pendingGroupDeparture;
          if (!membership || !state.sync) throw new Error('还没有加入小组');
          await exchangeOnLan(
            {
              groupId: membership.groupId,
              secret: membership.secret,
              accountId: state.sync.accountId,
              journals: journalsForSend(state),
            },
            sessionOptions(),
          );
        },
      );
      const latest = store.getSnapshot().state;
      setMessage(
        peerDidNotStoreJournal.current
          ? '已收到对方离组通知；对方未保存本机记录'
          : latest && hasPendingCompanionUse(latest)
            ? '记录已同步，同行确认尚未完成；请查看同行邀请或继续同步核对'
            : '局域网同步完成',
      );
    } catch (error) {
      const latest = store.getSnapshot().state;
      const detail = error instanceof Error ? error.message : '同步没有完成';
      setMessage(
        latest && hasPendingCompanionUse(latest)
          ? `${detail}。已保存的同行记录保留，请重新同步核对`
          : detail,
      );
    } finally {
      manualSyncActive.current = false;
      setSyncing(false);
    }
  }, [sessionOptions, store]);

  if (!snapshot.state) {
    return (
      <View style={styles.gate}>
        {snapshot.busy ? (
          <>
            <ActivityIndicator accessibilityLabel="正在读取本地数据" />
            <Text variant="titleMedium">正在打开你的小小日常…</Text>
          </>
        ) : (
          <>
            <Text variant="headlineSmall">暂时无法读取本地数据</Text>
            <Text style={styles.detail}>
              原始数据已保留，不会自动清空或覆盖。请检查设备存储后重试。
            </Text>
            <Text selectable={Platform.OS !== 'android'} style={styles.detail}>
              {snapshot.error}
            </Text>
            <Button
              mode="contained"
              onPress={() => {
                void store.initialize();
              }}
              accessibilityLabel="重新加载本地数据"
            >
              重新加载
            </Button>
          </>
        )}
      </View>
    );
  }

  return (
    <AppContext.Provider
      value={{
        state: snapshot.state,
        busy: snapshot.busy || syncing,
        now,
        run,
        previewDemoHistory,
        syncGroup,
        message,
        clearMessage,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp 必须在 AppProvider 内使用');
  return context;
}

const styles = StyleSheet.create({
  gate: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 20,
  },
  detail: { textAlign: 'center', lineHeight: 24 },
});
