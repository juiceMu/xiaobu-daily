export type ClipboardWriter = (value: string) => Promise<boolean>;

// 不读取剪贴板，也不向反馈或日志暴露完整券码、回执或邀请凭证。
export async function copyCode(
  value: string,
  write: ClipboardWriter,
): Promise<boolean> {
  if (!value.trim()) return false;
  try {
    return (await write(value)) === true;
  } catch {
    return false;
  }
}
