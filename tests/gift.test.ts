import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialState,
  migrateState,
  getTicketStatus,
  useTicket as consumeTicket,
  ensureGiftProfile,
  createGift,
  exportGift,
  parseGift,
  previewGift,
  receiveGift,
  recordGiftReceipt,
  exportGiftReceipt,
  parseGiftReceipt,
  type AppState,
  type GiftEnvelope,
} from '../src/domain/engine';
import { createAppStore } from '../src/state/store';
import { initializeSync } from '../src/domain/syncModel';

const now = new Date(2026, 9, 20, 12);
function person(id: string, name: string) {
  const state = createInitialState(now);
  assert.equal(ensureGiftProfile(state, { id, name }).ok, true);
  return state;
}
function fixture(validity: 'week' | 'permanent' = 'week') {
  const sender = person('sender-12345', '小林');
  const receiver = person('receiver-12345', '小夏');
  const result = createGift(
    sender,
    { name: '一起吃甜点', validity },
    { giftId: 'gift-123456', ticketId: 'ticket-123456' },
    now,
  );
  assert.ok(result.gift);
  return { sender, receiver, gift: result.gift };
}

test('旧v4不补写身份；制作全新赠券不消耗已有券，profile稳定且独立', () => {
  const old = createInitialState(now);
  assert.deepEqual(migrateState(old), old);
  assert.equal(old.giftState, undefined);
  const { sender, gift } = fixture();
  assert.equal(sender.tickets.length, 0);
  assert.equal(sender.redemptions.length, 0);
  assert.equal(sender.giftState?.outgoing.length, 1);
  assert.equal(
    ensureGiftProfile(sender, { id: 'other-12345', name: '其他' }).ok,
    false,
  );
  assert.equal(
    ensureGiftProfile(sender, { id: 'sender-12345', name: '新称呼' }).ok,
    true,
  );
  assert.equal(gift.issuer.name, '小林');
  assert.deepEqual(migrateState(sender), sender);
});

test('发出设备本地下一周一到期跨月年/DST；领取不重设到期，永久与使用备注保持', () => {
  for (const date of [new Date(2026, 11, 31, 23), new Date(2026, 9, 31, 23)]) {
    const state = person('sender-12345', '小林');
    const result = createGift(
      state,
      { name: '周券', validity: 'week' },
      { giftId: 'gift-123456', ticketId: 'ticket-123456' },
      date,
    );
    assert.ok(result.gift?.expiresAt);
    const expiry = new Date(result.gift.expiresAt);
    assert.equal(expiry.getDay(), 1);
    assert.equal(expiry.getHours(), 0);
    assert.ok(expiry > date);
    assert.ok(expiry.getTime() - date.getTime() <= 8 * 86400000);
  }
  for (const validity of ['week', 'permanent'] as const) {
    const { receiver, gift } = fixture(validity);
    const received = receiveGift(
      receiver,
      gift,
      new Date(now.getTime() + 3600000),
    );
    assert.ok(received.ticket);
    assert.equal(received.ticket.expiresAt, gift.expiresAt);
    assert.equal(received.ticket.senderName, '小林');
    assert.equal(getTicketStatus(received.ticket, receiver, now), 'available');
    assert.equal(
      consumeTicket(receiver, received.ticket.id, now, '喝奶茶').ok,
      true,
    );
    assert.equal(received.ticket.usageNote, '喝奶茶');
    assert.deepEqual(migrateState(receiver), receiver);
  }
});

test('预览只读，确认重验到期、自领、指定接收人、未来时钟和本机双重编号', () => {
  const { sender, receiver, gift } = fixture();
  const before = structuredClone(receiver);
  assert.equal(previewGift(receiver, exportGift(gift), now).ok, true);
  assert.deepEqual(receiver, before);
  assert.equal(receiveGift(sender, gift, now).ok, false);
  assert.equal(
    receiveGift(receiver, { ...gift, recipientId: 'other-12345' }, now).ok,
    false,
  );
  assert.equal(receiveGift(receiver, gift, gift.expiresAt!).ok, false);
  assert.equal(
    receiveGift(
      receiver,
      { ...gift, issuedAt: new Date(now.getTime() + 300001).toISOString() },
      now,
    ).ok,
    false,
  );
  assert.deepEqual(receiver, before);
  assert.equal(receiveGift(receiver, gift, now).ok, true);
  const received = structuredClone(receiver);
  for (const duplicate of [
    gift,
    { ...gift, giftId: 'gift-different' },
    { ...gift, ticketId: 'ticket-different' },
  ])
    assert.equal(receiveGift(receiver, duplicate, now).ok, false);
  assert.deepEqual(receiver, received);
  assert.equal(
    createGift(
      sender,
      { name: '重复', validity: 'permanent' },
      { giftId: gift.giftId, ticketId: 'ticket-different' },
      now,
    ).ok,
    false,
  );
});

test('二维码限制格式/版本/大小/词法/日期并去除额外字段，非法入口不改数据', () => {
  const { receiver, gift } = fixture();
  for (const raw of ['', '{', 'null', '[]', 'x'.repeat(4097)])
    assert.throws(() => parseGift(raw, now));
  const malformed = [
    { version: 2 },
    { kind: 'other' },
    { name: '' },
    { name: 'a'.repeat(31) },
    { name: '券\n名' },
    { giftId: '__bad' },
    { ticketId: gift.giftId },
    { issuedAt: '2026-02-30T12:00:00.000Z' },
    { expiresAt: gift.issuedAt },
    { issuer: { id: gift.issuer.id, name: '' } },
  ];
  const before = structuredClone(receiver);
  for (const changes of malformed) {
    const input = { ...gift, ...changes };
    assert.throws(() => parseGift(JSON.stringify(input), now));
    assert.equal(receiveGift(receiver, input as GiftEnvelope, now).ok, false);
    assert.deepEqual(receiver, before);
  }
  const parsed = parseGift(
    JSON.stringify({
      ...gift,
      admin: true,
      issuer: { ...gift.issuer, trusted: true },
    }),
    now,
  );
  assert.deepEqual(parsed, gift);
});

test('回执记录接收方，需要原赠券匹配；重复/伪造关联原子拒绝并完整重载', () => {
  const { sender, receiver, gift } = fixture();
  const { receipt } = receiveGift(receiver, gift, now);
  assert.ok(receipt);
  assert.deepEqual(parseGiftReceipt(exportGiftReceipt(receipt)), receipt);
  assert.equal(recordGiftReceipt(sender, receipt, now).ok, true);
  assert.equal(sender.giftState?.receipts[0].recipient.name, '小夏');
  assert.equal(recordGiftReceipt(sender, receipt, now).ok, false);
  assert.equal(recordGiftReceipt(receiver, receipt, now).ok, false);
  assert.deepEqual(migrateState(sender), sender);
  for (const corrupt of [
    (state: AppState) => {
      state.tickets[0].expiresAt = null;
    },
    (state: AppState) => {
      state.tickets[0].senderName = '伪造';
    },
    (state: AppState) => {
      state.giftState!.received = [];
    },
    (state: AppState) => {
      delete state.giftState;
    },
    (state: AppState) => {
      state.giftState!.received[0].gift.ticketId = 'other-12345';
    },
    (state: AppState) => {
      state.redemptions.push({
        id: 'redemption-12345',
        ticketId: gift.ticketId,
        cost: 1,
        week: state.tickets[0].week,
      });
    },
  ]) {
    const changed = structuredClone(receiver);
    corrupt(changed);
    assert.throws(() => migrateState(changed));
  }
});

test('领取ticket与receipt同事务保存，失败不发布或记去重，重试只领取一次', async () => {
  const { receiver: businessReceiver, gift } = fixture('permanent');
  const receiver = initializeSync(businessReceiver);
  let saved = structuredClone(receiver);
  let fails = true;
  const store = createAppStore({
    load: async () => saved,
    save: async (state) => {
      if (fails) throw new Error('磁盘已满');
      saved = structuredClone(state);
    },
  });
  await store.initialize();
  assert.equal(
    (await store.run((draft) => receiveGift(draft, gift, now))).ok,
    false,
  );
  assert.deepEqual(store.getSnapshot().state, receiver);
  assert.deepEqual(saved, receiver);
  fails = false;
  assert.equal(
    (await store.run((draft) => receiveGift(draft, gift, now))).ok,
    true,
  );
  assert.equal(saved.tickets.length, 1);
  assert.equal(saved.giftState?.received.length, 1);
  assert.equal(
    (await store.run((draft) => receiveGift(draft, gift, now))).ok,
    false,
  );
  assert.deepEqual(migrateState(saved), saved);
});
