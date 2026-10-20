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

export interface AppContextValue {
  state: AppState;
  busy: boolean;
  now: Date;
  run: (mutation: Mutation) => Promise<ActionResult>;
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
  const demoRequested = useRef(false);

  useEffect(() => {
    void store.initialize();
  }, [store]);
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
      setMessage(result.message);
      setNow(new Date());
      return result;
    },
    [store],
  );
  const clearMessage = useCallback(() => setMessage(''), []);

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
            <Text selectable style={styles.detail}>
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
        busy: snapshot.busy,
        now,
        run,
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
