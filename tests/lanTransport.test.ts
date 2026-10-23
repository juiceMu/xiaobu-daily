import test from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'buffer';
import {
  createLanChannel,
  LAN_IDLE_TIMEOUT_MS,
  LAN_MAX_FRAME_BYTES,
  type LanSocket,
} from '../src/state/lanTransport';

class FakeSocket implements LanSocket {
  listeners = new Map<string, (value?: never) => void>();
  written = '';
  destroyed = false;
  timeout = 0;

  write(value: string, _encoding: 'utf8', callback?: (error?: Error) => void) {
    this.written += value;
    callback?.();
    return true;
  }

  destroy() {
    this.destroyed = true;
  }

  on(
    event: 'data' | 'error' | 'close' | 'end' | 'timeout',
    listener:
      | ((data: Buffer | string) => void)
      | ((error: Error) => void)
      | (() => void),
  ) {
    this.listeners.set(event, listener as (value?: never) => void);
  }

  setTimeout(timeout: number) {
    this.timeout = timeout;
  }

  emit(event: string, value?: unknown) {
    this.listeners.get(event)?.(value as never);
  }
}

test('LAN 通道正确拼接拆分 JSON 帧并等待写入完成', async () => {
  const socket = new FakeSocket();
  const channel = createLanChannel(socket);
  assert.equal(socket.timeout, LAN_IDLE_TIMEOUT_MS);
  await channel.send({ type: 'hello' });
  assert.equal(socket.written, '{"type":"hello"}\n');
  const received = channel.receive();
  socket.emit('data', '{"type":');
  socket.emit('data', '"proof"}\n{"type":"ack"}\n');
  assert.deepEqual(await received, { type: 'proof' });
  assert.deepEqual(await channel.receive(), { type: 'ack' });
});

test('TCP 分块切开多字节 UTF-8 字符时仍可无损解码 JSON', async () => {
  const socket = new FakeSocket();
  const channel = createLanChannel(socket);
  const payload = Buffer.from('{"name":"树🌱"}\n', 'utf8');
  const split = payload.indexOf(Buffer.from('🌱')) + 2;
  const received = channel.receive();
  socket.emit('data', payload.subarray(0, split));
  socket.emit('data', payload.subarray(split));
  assert.deepEqual(await received, { name: '树🌱' });
});

test('LAN 通道对端关闭时立即拒绝等待中的接收', async () => {
  const socket = new FakeSocket();
  const channel = createLanChannel(socket);
  const pending = channel.receive();
  socket.emit('close');
  await assert.rejects(pending, /同步连接已关闭/);
  await assert.rejects(channel.receive(), /同步连接已关闭/);
});

test('LAN 通道拒绝超限或畸形消息并销毁连接', async () => {
  const oversized = new FakeSocket();
  createLanChannel(oversized);
  oversized.emit('data', 'x'.repeat(LAN_MAX_FRAME_BYTES + 1));
  assert.equal(oversized.destroyed, true);

  const malformed = new FakeSocket();
  const channel = createLanChannel(malformed);
  const pending = channel.receive();
  malformed.emit('data', '{bad json}\n');
  await assert.rejects(pending, /同步消息格式无效/);
  assert.equal(malformed.destroyed, true);
});

test('LAN 通道拒绝超限的出站消息', async () => {
  const socket = new FakeSocket();
  const channel = createLanChannel(socket);
  await assert.rejects(
    channel.send({ payload: 'x'.repeat(LAN_MAX_FRAME_BYTES) }),
    /同步消息超过允许大小/,
  );
  assert.equal(socket.written, '');
});
