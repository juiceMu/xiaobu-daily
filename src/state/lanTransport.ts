import { Buffer } from 'buffer';

export interface LanChannel {
  send(value: unknown): Promise<void>;
  receive(): Promise<unknown>;
}

export interface LanSocket {
  write(
    buffer: string,
    encoding: 'utf8',
    callback?: (error?: Error) => void,
  ): boolean;
  destroy(): unknown;
  on(event: 'data', listener: (data: Buffer | string) => void): unknown;
  on(event: 'error', listener: (error: Error) => void): unknown;
  on(event: 'close', listener: () => void): unknown;
  on(event: 'end', listener: () => void): unknown;
  on(event: 'timeout', listener: () => void): unknown;
  setTimeout(timeout: number): unknown;
}

export const LAN_IDLE_TIMEOUT_MS = 15_000;
export const LAN_SESSION_TIMEOUT_MS = 60_000;
export const LAN_MAX_FRAME_BYTES = 16 * 1024 * 1024;
const LAN_MAX_QUEUED_MESSAGES = 32;

export function createLanChannel(socket: LanSocket): LanChannel {
  let buffer = '';
  const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
  let closedError: Error | null = null;
  let disposed = false;
  const queue: unknown[] = [];
  const waiters: {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
  }[] = [];

  const fail = (error: Error) => {
    if (closedError) return;
    closedError = error;
    while (waiters.length) waiters.shift()?.reject(error);
  };
  const destroy = (error: Error) => {
    fail(error);
    if (disposed) return;
    disposed = true;
    socket.destroy();
  };

  socket.on('data', (data) => {
    if (closedError) return;
    let chunk: string;
    try {
      chunk =
        typeof data === 'string'
          ? data
          : utf8Decoder.decode(data, { stream: true });
    } catch {
      destroy(new Error('同步消息不是有效的 UTF-8'));
      return;
    }
    buffer += chunk;
    let newline = buffer.indexOf('\n');
    while (newline >= 0) {
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      if (Buffer.byteLength(line, 'utf8') > LAN_MAX_FRAME_BYTES) {
        destroy(new Error('同步消息超过允许大小'));
        return;
      }
      if (line) {
        let value: unknown;
        try {
          value = JSON.parse(line);
        } catch {
          destroy(new Error('同步消息格式无效'));
          return;
        }
        const waiter = waiters.shift();
        if (waiter) waiter.resolve(value);
        else if (queue.length < LAN_MAX_QUEUED_MESSAGES) queue.push(value);
        else {
          destroy(new Error('同步消息队列超过允许大小'));
          return;
        }
      }
      newline = buffer.indexOf('\n');
    }
    if (Buffer.byteLength(buffer, 'utf8') > LAN_MAX_FRAME_BYTES) {
      destroy(new Error('同步消息超过允许大小'));
    }
  });
  socket.on('error', (error) => fail(error));
  socket.on('close', () => fail(new Error('同步连接已关闭')));
  socket.on('end', () => fail(new Error('同步连接已结束')));
  socket.on('timeout', () => destroy(new Error('同步连接空闲超时')));
  socket.setTimeout(LAN_IDLE_TIMEOUT_MS);

  return {
    send(value) {
      if (closedError) return Promise.reject(closedError);
      let line: string;
      try {
        line = `${JSON.stringify(value)}\n`;
      } catch {
        return Promise.reject(new Error('同步消息无法编码'));
      }
      if (Buffer.byteLength(line, 'utf8') - 1 > LAN_MAX_FRAME_BYTES) {
        return Promise.reject(new Error('同步消息超过允许大小'));
      }
      return new Promise<void>((resolve, reject) => {
        socket.write(line, 'utf8', (error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    },
    receive() {
      const value = queue.shift();
      if (value !== undefined) return Promise.resolve(value);
      if (closedError) return Promise.reject(closedError);
      return new Promise<unknown>((resolve, reject) => {
        waiters.push({ resolve, reject });
      });
    },
  };
}
