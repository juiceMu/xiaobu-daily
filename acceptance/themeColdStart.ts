export const THEME_READ_FAILURE_URL =
  'sprout-scenarioacceptanceqa://acceptance/theme-read-failure?once=1';

type Control = { arm(mode: 'load-fail'): boolean };

// 仅首次挂载前调用；超时或异常后不处理迟到结果，不输出启动URL。
export async function prepareThemeColdStart(
  getInitialURL: () => Promise<string | null>,
  control: Control,
  timeoutMs = 2000,
): Promise<string> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      Promise.resolve()
        .then(getInitialURL)
        .then((url) => ({ kind: 'url' as const, url })),
      new Promise<{ kind: 'timeout' }>((resolve) => {
        timer = setTimeout(() => resolve({ kind: 'timeout' }), timeoutMs);
      }),
    ]);
    if (result.kind === 'timeout')
      return '冷启动参数读取超时：未注入主题读取失败，正常启动；迟到结果忽略。';
    if (result.url !== THEME_READ_FAILURE_URL)
      return '本次冷启动未请求主题读取失败；运行中收到链接不会注入。';
    return control.arm('load-fail')
      ? '本次冷启动已待命一次主题读取前失败；原偏好不改写，不重载应用。'
      : '本次冷启动主题读取失败未待命：控制不可用，正常启动。';
  } catch {
    return '冷启动参数读取异常：未注入主题读取失败，正常启动。';
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
