import { useEffect, useState } from 'react';
import { InteractionManager, Platform } from 'react-native';

// Android 在原生栈切换未完成时挂上 EditText/可选中文本会直接崩进程。
export function useAndroidMountReady(delayMs = 450) {
  const [ready, setReady] = useState(Platform.OS !== 'android');
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const task = InteractionManager.runAfterInteractions(() => {
      requestAnimationFrame(() => {
        timer = setTimeout(() => {
          if (alive) setReady(true);
        }, delayMs);
      });
    });
    return () => {
      alive = false;
      task.cancel();
      if (timer) clearTimeout(timer);
    };
  }, [delayMs]);
  return ready;
}
