import type { AccountJournal } from '../domain/syncModel';
import type { LanExchange } from './lanExchange';
import type { LanSessionOptions } from './lanProtocol';

export async function exchangeOnLan(
  _input: LanExchange,
  _options: LanSessionOptions,
  _onProgress?: (message: string) => void,
): Promise<AccountJournal[]> {
  throw new Error(
    '这台设备不能在局域网里等待其他手机，请用手机连接同一 WiFi 后点同步',
  );
}
