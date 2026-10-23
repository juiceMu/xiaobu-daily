import test from 'node:test';
import assert from 'node:assert/strict';
import { runLanSession } from '../src/state/lanProtocol';
import type { LanSessionOptions } from '../src/state/lanProtocol';
import type { AccountJournal } from '../src/domain/syncModel';
import type { LanChannel } from '../src/state/lanTransport';

function pair() {
  const queues: unknown[][] = [[], []];
  const waiters: ((value: unknown) => void)[][] = [[], []];
  const sent: unknown[][] = [[], []];
  const channel = (side: number): LanChannel => ({
    async send(value) {
      sent[side].push(structuredClone(value));
      const peer = 1 - side;
      const waiter = waiters[peer].shift();
      if (waiter) waiter(structuredClone(value));
      else queues[peer].push(structuredClone(value));
    },
    receive() {
      const queued = queues[side].shift();
      if (queued !== undefined) return Promise.resolve(queued);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error('test channel timeout')),
          100,
        );
        waiters[side].push((value) => {
          clearTimeout(timer);
          resolve(value);
        });
      });
    },
  });
  return { channels: [channel(0), channel(1)] as const, sent };
}

const journal = (accountId: string): AccountJournal => ({
  accountId,
  deviceId: `${accountId}-device`,
  operations: [
    {
      operationId: `${accountId}-device-1`,
      accountId,
      deviceId: `${accountId}-device`,
      transactionId: `${accountId}-device-1`,
      entityRevision: 1,
      baseRevision: 0,
      entity: {
        entityType: 'profile' as const,
        entityId: accountId,
        ownerId: accountId,
        revision: 1,
        createdAt: '2026-10-22T00:00:00.000Z',
        payload: '{}',
        deletedAt: null,
        updatedAt: '2026-10-22T00:00:00.000Z',
      },
    },
  ],
  attachments: {},
});

const input = (accountId: string) => ({
  groupId: 'lan-group-001',
  secret: 'lan-secret-001',
  accountId,
  journals: [journal(accountId)],
});
let randomSequence = 0;
const options = (
  onReceive: LanSessionOptions['onReceive'] = async () => ({ ok: true }),
): LanSessionOptions => ({
  randomBytes: async (length: number) => {
    const bytes = new Uint8Array(length);
    bytes.fill(++randomSequence);
    return bytes;
  },
  onReceive,
});

test('双方使用新随机挑战建立加密会话并仅确认匹配的本人日志', async () => {
  const { channels } = pair();
  const [left, right] = await Promise.all([
    runLanSession(channels[0], input('account-left-001'), options()),
    runLanSession(channels[1], input('account-right-001'), options()),
  ]);
  assert.equal(left.accountId, 'account-right-001');
  assert.equal(right.accountId, 'account-left-001');
  assert.equal(left.journals[0].accountId, left.accountId);
  assert.equal(right.journals[0].accountId, right.accountId);
});

test('错误口令及被篡改的密文不会交给接收回调', async () => {
  const { channels } = pair();
  let received = false;
  const results = await Promise.allSettled([
    runLanSession(
      channels[0],
      input('account-left-002'),
      options(() => {
        received = true;
        return Promise.resolve({ ok: true });
      }),
    ),
    runLanSession(
      channels[1],
      {
        ...input('account-right-002'),
        secret: 'wrong-secret-002',
      },
      options(),
    ),
  ]);
  assert.ok(results.some((result) => result.status === 'rejected'));
  assert.equal(received, false);
});

test('协议允许转发已缓存的第三方日志，但仍按账号去重', async () => {
  const { channels } = pair();
  const left = input('account-left-003');
  left.journals.push(journal('account-peer-003'));
  const received: string[][] = [];
  const results = await Promise.all([
    runLanSession(channels[0], left, options()),
    runLanSession(channels[1], input('account-right-003'), {
      ...options(),
      onReceive: async (journals) => {
        received.push(journals.map((item) => item.accountId));
        return { ok: true };
      },
    }),
  ]);
  assert.equal(results[1].journals.length, 2);
  assert.deepEqual(received[0], ['account-left-003', 'account-peer-003']);
});

test('ACK区分已持久化和仅验证的记录，双向结果分别确认', async () => {
  const { channels } = pair();
  const leftPeerStored: boolean[] = [];
  const rightPeerStored: boolean[] = [];
  const [left, right] = await Promise.all([
    runLanSession(
      channels[0],
      input('account-left-005'),
      options(async () => ({ ok: true, persisted: false })),
    ).then((result) => {
      leftPeerStored.push(result.peerStoredInput);
      return result;
    }),
    runLanSession(channels[1], input('account-right-005'), {
      ...options(),
      onSynchronized: (_input, persisted) => {
        rightPeerStored.push(persisted);
      },
    }).then((result) => {
      rightPeerStored.push(result.peerStoredInput);
      return result;
    }),
  ]);
  assert.equal(left.accountId, 'account-right-005');
  assert.equal(right.accountId, 'account-left-005');
  assert.deepEqual(leftPeerStored, [true]);
  assert.deepEqual(rightPeerStored, [false, false]);
});

test('旧握手 transcript 重放无法通过新会话挑战', async () => {
  const first = pair();
  await Promise.all([
    runLanSession(first.channels[0], input('account-left-004'), options()),
    runLanSession(first.channels[1], input('account-right-004'), options()),
  ]);
  const oldHello = first.sent[1].find(
    (message) => (message as { type?: string }).type === 'hello',
  );
  const replay = first.sent[1].find(
    (message) => (message as { type?: string }).type === 'proof',
  );
  assert.ok(replay);
  let firstMessage = true;
  const replayChannel: LanChannel = {
    async send() {},
    async receive() {
      if (firstMessage) {
        firstMessage = false;
        return structuredClone(oldHello);
      }
      return structuredClone(replay);
    },
  };
  await assert.rejects(
    runLanSession(replayChannel, input('account-left-004'), options()),
    { code: 'AUTH_FAILED' },
  );
});
