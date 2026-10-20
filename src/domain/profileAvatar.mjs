export const AVATAR_PRESETS = ['sprout', 'sun', 'moon', 'flower'];
export const MAX_AVATAR_BYTES = 200 * 1024;
// 只接收应用压缩后的 JPEG，不允许远端地址、临时文件或可执行图片格式。
export function validProfileAvatar(avatar) {
  if (!avatar || typeof avatar !== 'object' || Array.isArray(avatar))
    return false;
  if (avatar.kind === 'preset')
    return (
      Object.keys(avatar).length === 2 && AVATAR_PRESETS.includes(avatar.id)
    );
  if (
    avatar.kind !== 'image' ||
    Object.keys(avatar).length !== 2 ||
    typeof avatar.dataUri !== 'string'
  )
    return false;
  const prefix = 'data:image/jpeg;base64,';
  if (!avatar.dataUri.startsWith(prefix)) return false;
  const raw = avatar.dataUri.slice(prefix.length);
  if (
    !raw.length ||
    raw.length > Math.ceil(MAX_AVATAR_BYTES / 3) * 4 ||
    raw.length % 4 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(raw)
  )
    return false;
  const alphabet =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const bytes = [];
  for (let i = 0; i < raw.length; i += 4) {
    const a = alphabet.indexOf(raw[i]),
      b = alphabet.indexOf(raw[i + 1]);
    const c = alphabet.indexOf(raw[i + 2]),
      d = alphabet.indexOf(raw[i + 3]);
    if ((c < 0 && (d >= 0 || b & 15)) || (d < 0 && c >= 0 && c & 3))
      return false;
    bytes.push((a << 2) | (b >> 4));
    if (c >= 0) bytes.push(((b & 15) << 4) | (c >> 2));
    if (d >= 0) bytes.push(((c & 3) << 6) | d);
  }
  if (
    bytes.length > MAX_AVATAR_BYTES ||
    bytes[0] !== 255 ||
    bytes[1] !== 216 ||
    bytes.at(-2) !== 255 ||
    bytes.at(-1) !== 217
  )
    return false;
  let offset = 2,
    hasFrame = false;
  while (offset < bytes.length - 2) {
    if (bytes[offset++] !== 255) return false;
    while (bytes[offset] === 255) offset++;
    const marker = bytes[offset++];
    const length = (bytes[offset] << 8) | bytes[offset + 1];
    if (length < 2 || offset + length > bytes.length - 2) return false;
    if ([192, 193, 194].includes(marker)) {
      const height = (bytes[offset + 3] << 8) | bytes[offset + 4];
      const width = (bytes[offset + 5] << 8) | bytes[offset + 6];
      if (
        length < 11 ||
        bytes[offset + 2] !== 8 ||
        width < 1 ||
        height < 1 ||
        width > 512 ||
        height > 512
      )
        return false;
      hasFrame = true;
    }
    if (marker === 218) return hasFrame && offset + length < bytes.length - 2;
    offset += length;
  }
  return false;
}
