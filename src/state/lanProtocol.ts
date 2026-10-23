import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { hmacHex } from '../domain/hmac';
import type { AccountJournal } from '../domain/syncModel';
import type { LanExchange } from './lanExchange';
import type { LanChannel } from './lanTransport';

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
const bytes = (value: string) => encoder.encode(value);
const hexBytes = (value: string) =>
  Uint8Array.from(value.match(/.{2}/g) ?? [], (part) => parseInt(part, 16));
const stable = (value: unknown) => JSON.stringify(value);

export interface LanSessionOptions {
  randomBytes: (length: number) => Promise<Uint8Array>;
  onSessionStart?: (
    input: LanExchange,
    peerAccountId: string,
  ) => void | Promise<void>;
  onReceive?: (journals: AccountJournal[]) => Promise<unknown>;
  onSynchronized?: (
    input: LanExchange,
    peerStoredInput: boolean,
  ) => void | Promise<void>;
  onSessionEnd?: () => void | Promise<void>;
}

function authError(message = '小组口令验证失败') {
  return Object.assign(new Error(message), { code: 'AUTH_FAILED' });
}

function sessionContext(
  groupId: string,
  left: { accountId: string; nonce: string },
  right: { accountId: string; nonce: string },
) {
  const peers = [left, right].sort((a, b) =>
    a.accountId.localeCompare(b.accountId),
  );
  return stable({ version: 2, groupId, peers });
}

function envelopeBytes(value: unknown) {
  return bytes(stable(value));
}

async function seal(
  channel: LanChannel,
  key: Uint8Array,
  aad: string,
  value: unknown,
  randomBytes: LanSessionOptions['randomBytes'],
) {
  const nonce = await randomBytes(24);
  const ciphertext = xchacha20poly1305(key, nonce, bytes(aad)).encrypt(
    envelopeBytes(value),
  );
  await channel.send({
    type: 'sealed',
    nonce: [...nonce],
    ciphertext: [...ciphertext],
  });
}

function openSealed(envelope: unknown, key: Uint8Array, aad: string): unknown {
  if (!envelope || typeof envelope !== 'object') throw authError();
  const value = envelope as {
    type?: unknown;
    nonce?: unknown;
    ciphertext?: unknown;
  };
  if (
    value.type !== 'sealed' ||
    !Array.isArray(value.nonce) ||
    value.nonce.length !== 24 ||
    !value.nonce.every(
      (byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255,
    ) ||
    !Array.isArray(value.ciphertext) ||
    !value.ciphertext.every(
      (byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255,
    )
  )
    throw authError();
  try {
    const plaintext = xchacha20poly1305(
      key,
      Uint8Array.from(value.nonce as number[]),
      bytes(aad),
    ).decrypt(Uint8Array.from(value.ciphertext as number[]));
    return JSON.parse(decoder.decode(plaintext)) as unknown;
  } catch {
    throw authError('小组同步内容认证失败');
  }
}

function lastOperationId(journal: AccountJournal) {
  return journal.operations.at(-1)?.operationId ?? '';
}

export async function runLanSession(
  channel: LanChannel,
  input: LanExchange,
  options: LanSessionOptions,
): Promise<{
  accountId: string;
  journals: AccountJournal[];
  peerStoredInput: boolean;
}> {
  let sessionStarted = false;
  try {
    if (!options.randomBytes || !options.onReceive)
      throw new Error('局域网会话缺少安全随机源或持久化回调');
    const nonce = await options.randomBytes(32);
    const local = {
      accountId: input.accountId,
      nonce: [...nonce]
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join(''),
    };
    await channel.send({ type: 'hello', groupId: input.groupId, ...local });
    const hello = await channel.receive();
    if (!hello || typeof hello !== 'object') throw authError();
    const peer = hello as {
      type?: unknown;
      groupId?: unknown;
      accountId?: unknown;
      nonce?: unknown;
    };
    if (
      peer.type !== 'hello' ||
      peer.groupId !== input.groupId ||
      typeof peer.accountId !== 'string' ||
      peer.accountId === input.accountId ||
      typeof peer.nonce !== 'string' ||
      !/^[a-f0-9]{64}$/.test(peer.nonce)
    )
      throw authError();

    const context = sessionContext(input.groupId, local, {
      accountId: peer.accountId,
      nonce: peer.nonce,
    });
    const proof = hmacHex(input.secret, context);
    await channel.send({ type: 'proof', proof });
    const proofMessage = await channel.receive();
    if (
      !proofMessage ||
      typeof proofMessage !== 'object' ||
      (proofMessage as { type?: unknown }).type !== 'proof' ||
      (proofMessage as { proof?: unknown }).proof !==
        hmacHex(input.secret, context)
    )
      throw authError();

    await options.onSessionStart?.(input, peer.accountId);
    sessionStarted = true;
    const key = hexBytes(hmacHex(input.secret, `sprout-lan-v2\n${context}`));
    const aad = `sprout-lan-v2\n${context}`;
    await seal(
      channel,
      key,
      aad,
      {
        type: 'bundle',
        accountId: input.accountId,
        journals: input.journals,
      },
      options.randomBytes,
    );
    const incoming = openSealed(await channel.receive(), key, aad);
    if (!incoming || typeof incoming !== 'object')
      throw authError('小组同步记录无效');
    const bundle = incoming as {
      type?: unknown;
      accountId?: unknown;
      journals?: unknown;
    };
    if (
      bundle.type !== 'bundle' ||
      bundle.accountId !== peer.accountId ||
      !Array.isArray(bundle.journals) ||
      bundle.journals.length < 1 ||
      bundle.journals.length > 32 ||
      bundle.journals.some(
        (journal) =>
          !journal ||
          typeof journal !== 'object' ||
          typeof (journal as AccountJournal).accountId !== 'string',
      ) ||
      new Set(
        (bundle.journals as AccountJournal[]).map(
          (journal) => journal.accountId,
        ),
      ).size !== bundle.journals.length ||
      !(bundle.journals as AccountJournal[]).some(
        (journal) => journal.accountId === peer.accountId,
      )
    )
      throw authError('拒绝接收无效的小组记录包');
    const journals = bundle.journals as AccountJournal[];
    let stored = true;
    if (options.onReceive) {
      const result = await options.onReceive(journals);
      if (
        result &&
        typeof result === 'object' &&
        'ok' in result &&
        (result as { ok?: unknown }).ok !== true
      )
        throw new Error(
          'message' in result && typeof result.message === 'string'
            ? result.message
            : '无法保存收到的小组记录',
        );
      if (
        result &&
        typeof result === 'object' &&
        'persisted' in result &&
        (result as { persisted?: unknown }).persisted === false
      )
        stored = false;
    }
    await seal(
      channel,
      key,
      aad,
      {
        type: 'ack',
        acceptedAccountId: peer.accountId,
        acceptedOperationId: lastOperationId(journals[0]),
        persisted: stored,
      },
      options.randomBytes,
    );
    const acknowledgement = openSealed(await channel.receive(), key, aad) as {
      type?: unknown;
      acceptedAccountId?: unknown;
      acceptedOperationId?: unknown;
      persisted?: unknown;
    };
    if (
      !acknowledgement ||
      acknowledgement.type !== 'ack' ||
      typeof acknowledgement.persisted !== 'boolean' ||
      acknowledgement.acceptedAccountId !== input.accountId ||
      acknowledgement.acceptedOperationId !== lastOperationId(input.journals[0])
    )
      throw new Error('对方尚未确认保存本机记录，请稍后重试');
    await options.onSynchronized?.(input, acknowledgement.persisted);
    return {
      accountId: peer.accountId,
      journals,
      peerStoredInput: acknowledgement.persisted,
    };
  } finally {
    if (sessionStarted) await options.onSessionEnd?.();
  }
}
