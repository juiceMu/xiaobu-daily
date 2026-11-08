import type { BackHandlerStatic } from 'react-native';

// 控制浮层打开时接管返回；关闭或卸载后交还原应用的导航。
export function listenForControlBack(
  open: boolean,
  backHandler: Pick<BackHandlerStatic, 'addEventListener'>,
  close: () => void,
) {
  if (!open) return;
  const subscription = backHandler.addEventListener('hardwareBackPress', () => {
    close();
    return true;
  });
  return () => subscription.remove();
}
