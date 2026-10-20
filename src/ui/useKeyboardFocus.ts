import { useState, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { createKeyboardModality } from './keyboardFocusModel';

// 仅订阅时读取DOM，原生与服务端导入不访问浏览器全局对象。
const modality = createKeyboardModality(() =>
  Platform.OS === 'web' && typeof document !== 'undefined' ? document : null,
);

export function useKeyboardFocus() {
  const [focused, setFocused] = useState(false);
  const keyboard = useSyncExternalStore(
    modality.subscribe,
    modality.getSnapshot,
    modality.getServerSnapshot,
  );
  return {
    focusVisible: Platform.OS === 'web' && focused && keyboard,
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
  };
}
