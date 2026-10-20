import { validProfileAvatar } from './profileAvatar.mjs';
const MAX_PAYLOAD = 4096;
const CLOCK_SKEW = 5 * 60 * 1000;
const validId = (value) =>
  typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_-]{7,79}$/.test(value);
const text = (value, max) =>
  typeof value === 'string' &&
  value === value.trim() &&
  value.length > 0 &&
  value.length <= max &&
  !/[\u0000-\u001f\u007f]/.test(value);
const identity = (value) => value && validId(value.id) && text(value.name, 20);
const timestamp = (value) =>
  typeof value === 'string' &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString() === value;
const fail = (message) => ({ ok: false, message });
const ok = (message, extra = {}) => ({ ok: true, message, ...extra });
const clone = (value) => JSON.parse(JSON.stringify(value));
const localWeek = (now) => {
  const date = new Date(now);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
function validEnvelope(value) {
  return (
    value &&
    value.version === 1 &&
    value.kind === 'small-steps-gift' &&
    validId(value.giftId) &&
    validId(value.ticketId) &&
    value.giftId !== value.ticketId &&
    text(value.name, 30) &&
    identity(value.issuer) &&
    timestamp(value.issuedAt) &&
    (value.expiresAt === null ||
      (timestamp(value.expiresAt) &&
        Date.parse(value.expiresAt) > Date.parse(value.issuedAt) &&
        Date.parse(value.expiresAt) - Date.parse(value.issuedAt) <=
          8 * 86400000)) &&
    (value.recipientId === undefined ||
      (validId(value.recipientId) && value.recipientId !== value.issuer.id))
  );
}
function validReceipt(value) {
  return (
    value &&
    value.version === 1 &&
    value.kind === 'small-steps-gift-receipt' &&
    validId(value.giftId) &&
    validId(value.ticketId) &&
    validId(value.senderId) &&
    identity(value.recipient) &&
    value.senderId !== value.recipient.id &&
    timestamp(value.receivedAt) &&
    validEnvelope(value.gift) &&
    value.gift.giftId === value.giftId &&
    value.gift.ticketId === value.ticketId &&
    value.gift.issuer.id === value.senderId &&
    (value.gift.recipientId === undefined ||
      value.gift.recipientId === value.recipient.id) &&
    Date.parse(value.receivedAt) >=
      Date.parse(value.gift.issuedAt) - CLOCK_SKEW &&
    (value.gift.expiresAt === null ||
      Date.parse(value.receivedAt) < Date.parse(value.gift.expiresAt))
  );
}
function currentError(envelope, now) {
  const time = new Date(now).getTime();
  if (!Number.isFinite(time)) return '当前时间无效';
  if (Date.parse(envelope.issuedAt) > time + CLOCK_SKEW)
    return '赠券发出时间超前，请核对两台设备时间';
  if (envelope.expiresAt !== null && Date.parse(envelope.expiresAt) <= time)
    return '这张赠券已过期';
  return '';
}
export function ensureGiftProfile(state, profile) {
  if (!identity(profile)) return fail('请填写有效的本机身份与称呼（1–20字）');
  if (state.sync && state.sync.accountId !== profile.id)
    return fail('资料必须归属当前本机账户');
  if (state.giftState && state.giftState.profile.id !== profile.id)
    return fail('本机身份已建立，不能替换身份编号');
  if (state.giftState) state.giftState.profile.name = profile.name;
  else
    state.giftState = {
      profile: clone(profile),
      outgoing: [],
      received: [],
      receipts: [],
    };
  return ok('已保存本机称呼');
}
export function updateLocalProfile(state, profile) {
  if (!identity(profile) || !validProfileAvatar(profile.avatar))
    return fail('请填写1–20字昵称，并选择有效头像（JPEG不超过200KB、512像素）');
  if (state.giftState && state.giftState.profile.id !== profile.id)
    return fail('本机身份已建立，不能替换身份编号');
  const result = ensureGiftProfile(state, {
    id: profile.id,
    name: profile.name,
  });
  if (result.ok) state.giftState.profile.avatar = clone(profile.avatar);
  return result.ok ? ok('账户资料已保存到本机') : result;
}
export function createGift(state, input, ids, now = new Date()) {
  if (!state.giftState) return fail('请先设置本机称呼');
  if (
    !input ||
    !['week', 'permanent'].includes(input.validity) ||
    !text(input.name, 30)
  )
    return fail('赠券名称须为1–30字，请选择有效期限');
  const date = new Date(now);
  if (!Number.isFinite(date.getTime())) return fail('当前时间无效');
  const expiry = new Date(date);
  expiry.setDate(expiry.getDate() - ((expiry.getDay() + 6) % 7) + 7);
  expiry.setHours(0, 0, 0, 0);
  const gift = {
    version: 1,
    kind: 'small-steps-gift',
    giftId: ids?.giftId,
    ticketId: ids?.ticketId,
    name: input.name,
    issuedAt: date.toISOString(),
    expiresAt: input.validity === 'week' ? expiry.toISOString() : null,
    issuer: {
      id: state.giftState.profile.id,
      name: state.giftState.profile.name,
    },
    ...(input.recipientId === undefined
      ? {}
      : { recipientId: input.recipientId }),
  };
  if (!validEnvelope(gift) || gift.recipientId === gift.issuer.id)
    return fail('赠券编号或接收方无效');
  if (
    state.tickets.some(
      (ticket) => ticket.id === gift.ticketId || ticket.giftId === gift.giftId,
    ) ||
    state.giftState.outgoing.some(
      (item) => item.giftId === gift.giftId || item.ticketId === gift.ticketId,
    ) ||
    state.giftState.received.some(
      (item) => item.giftId === gift.giftId || item.ticketId === gift.ticketId,
    )
  )
    return fail('赠券编号已存在，请重新制作');
  state.giftState.outgoing.push(gift);
  return ok('赠券已制作，请让对方扫码领取', { gift: clone(gift) });
}
export function exportGift(envelope) {
  if (!validEnvelope(envelope)) throw new Error('赠券格式无效');
  const raw = JSON.stringify({
    version: 1,
    kind: 'small-steps-gift',
    giftId: envelope.giftId,
    ticketId: envelope.ticketId,
    name: envelope.name,
    issuedAt: envelope.issuedAt,
    expiresAt: envelope.expiresAt,
    issuer: { id: envelope.issuer.id, name: envelope.issuer.name },
    ...(envelope.recipientId === undefined
      ? {}
      : { recipientId: envelope.recipientId }),
  });
  if (raw.length > MAX_PAYLOAD) throw new Error('赠券内容过长');
  return raw;
}
export function parseGift(raw, now = new Date()) {
  if (typeof raw !== 'string' || raw.length > MAX_PAYLOAD)
    throw new Error('二维码内容无效或过长');
  let envelope;
  try {
    envelope = JSON.parse(raw);
  } catch {
    throw new Error('不是有效的赠券二维码');
  }
  if (!validEnvelope(envelope)) throw new Error('赠券格式无效或版本不支持');
  const error = currentError(envelope, now);
  if (error) throw new Error(error);
  // 仅返回白名单字段，忽略二维码中不可信的额外内容。
  return {
    version: 1,
    kind: 'small-steps-gift',
    giftId: envelope.giftId,
    ticketId: envelope.ticketId,
    name: envelope.name,
    issuedAt: envelope.issuedAt,
    expiresAt: envelope.expiresAt,
    issuer: { id: envelope.issuer.id, name: envelope.issuer.name },
    ...(envelope.recipientId === undefined
      ? {}
      : { recipientId: envelope.recipientId }),
  };
}
export function previewGift(state, raw, now = new Date()) {
  let gift;
  try {
    gift = parseGift(raw, now);
  } catch (error) {
    return fail(error.message);
  }
  if (!state.giftState) return fail('请先设置本机称呼');
  const ownId = state.giftState.profile.id;
  if (gift.issuer.id === ownId) return fail('不能领取自己制作的赠券');
  if (gift.recipientId !== undefined && gift.recipientId !== ownId)
    return fail('这张赠券指定了其他接收方');
  if (
    state.tickets.some(
      (ticket) => ticket.id === gift.ticketId || ticket.giftId === gift.giftId,
    ) ||
    state.giftState.received.some(
      (item) => item.giftId === gift.giftId || item.ticketId === gift.ticketId,
    ) ||
    state.giftState.outgoing.some(
      (item) => item.giftId === gift.giftId || item.ticketId === gift.ticketId,
    )
  )
    return fail('本机已领取或记录过这张赠券');
  return ok('请核对赠送人、券名和有效期后确认领取', { gift });
}
export function receiveGift(state, envelope, now = new Date()) {
  let raw;
  try {
    raw = exportGift(envelope);
  } catch (error) {
    return fail(error.message);
  }
  const preview = previewGift(state, raw, now);
  if (!preview.ok) return preview;
  const gift = preview.gift;
  const receivedAt = new Date(now).toISOString();
  const receipt = {
    version: 1,
    kind: 'small-steps-gift-receipt',
    giftId: gift.giftId,
    ticketId: gift.ticketId,
    senderId: gift.issuer.id,
    recipient: {
      id: state.giftState.profile.id,
      name: state.giftState.profile.name,
    },
    receivedAt,
    gift: clone(gift),
  };
  const ticket = {
    id: gift.ticketId,
    name: gift.name,
    createdAt: receivedAt,
    week: localWeek(now),
    expiresAt: gift.expiresAt,
    usedAt: null,
    source: 'gift',
    giftId: gift.giftId,
    senderId: gift.issuer.id,
    senderName: gift.issuer.name,
  };
  state.giftState.received.push(receipt);
  state.tickets.push(ticket);
  return ok('领取成功，赠券已加入我的奖券', {
    gift,
    ticket,
    receipt: clone(receipt),
  });
}
export function recordGiftReceipt(state, receipt, now = new Date()) {
  if (
    !validReceipt(receipt) ||
    !state.giftState ||
    receipt.senderId !== state.giftState.profile.id
  )
    return fail('领取回执无效或不属于本机');
  if (
    !Number.isFinite(new Date(now).getTime()) ||
    Date.parse(receipt.receivedAt) > new Date(now).getTime() + CLOCK_SKEW
  )
    return fail('回执领取时间超前，请核对两台设备时间');
  const gift = state.giftState.outgoing.find(
    (item) =>
      item.giftId === receipt.giftId && item.ticketId === receipt.ticketId,
  );
  if (!gift || exportGift(gift) !== exportGift(receipt.gift))
    return fail('回执与赠券不匹配');
  if (
    state.giftState.receipts.some(
      (item) =>
        item.giftId === receipt.giftId || item.ticketId === receipt.ticketId,
    )
  )
    return fail('本机已记录该赠券回执');
  state.giftState.receipts.push(clone(receipt));
  return ok('已记录领取方（本机身份，未经账号验证）', {
    receipt: clone(receipt),
  });
}
export function exportGiftReceipt(receipt) {
  if (!validReceipt(receipt)) throw new Error('领取回执格式无效');
  const raw = JSON.stringify({
    version: receipt.version,
    kind: receipt.kind,
    giftId: receipt.giftId,
    ticketId: receipt.ticketId,
    senderId: receipt.senderId,
    recipient: { id: receipt.recipient.id, name: receipt.recipient.name },
    receivedAt: receipt.receivedAt,
    gift: JSON.parse(exportGift(receipt.gift)),
  });
  if (raw.length > MAX_PAYLOAD) throw new Error('回执内容过长');
  return raw;
}
export function parseGiftReceipt(raw) {
  if (typeof raw !== 'string' || raw.length > MAX_PAYLOAD)
    throw new Error('领取回执内容无效或过长');
  let receipt;
  try {
    receipt = JSON.parse(raw);
  } catch {
    throw new Error('不是有效的领取回执');
  }
  if (!validReceipt(receipt)) throw new Error('领取回执格式无效');
  return {
    version: 1,
    kind: 'small-steps-gift-receipt',
    giftId: receipt.giftId,
    ticketId: receipt.ticketId,
    senderId: receipt.senderId,
    recipient: { id: receipt.recipient.id, name: receipt.recipient.name },
    receivedAt: receipt.receivedAt,
    gift: parseGift(exportGift(receipt.gift), receipt.receivedAt),
  };
}
// 老存档不补写空身份；只对存在的赠券扩展执行关联完整性验证。
export function validateGiftState(state) {
  const slice = state.giftState;
  const tickets = state.tickets.filter((ticket) => ticket.source === 'gift');
  if (
    state.tickets.some(
      (ticket) =>
        ticket.source !== 'gift' &&
        [ticket.giftId, ticket.senderId, ticket.senderName].some(
          (value) => value !== undefined,
        ),
    )
  )
    return false;
  if (slice === undefined) return tickets.length === 0;
  if (
    !slice ||
    !identity(slice.profile) ||
    (slice.profile.avatar !== undefined &&
      !validProfileAvatar(slice.profile.avatar)) ||
    !['outgoing', 'received', 'receipts'].every((key) =>
      Array.isArray(slice[key]),
    )
  )
    return false;
  if (
    slice.outgoing.some(
      (gift) =>
        !validEnvelope(gift) ||
        gift.issuer.id !== slice.profile.id ||
        state.tickets.some((ticket) => ticket.id === gift.ticketId),
    )
  )
    return false;
  if (
    slice.received.some(
      (receipt) =>
        !validReceipt(receipt) || receipt.recipient.id !== slice.profile.id,
    )
  )
    return false;
  if (
    slice.receipts.some(
      (receipt) =>
        !validReceipt(receipt) || receipt.senderId !== slice.profile.id,
    )
  )
    return false;
  for (const list of [slice.outgoing, slice.received, slice.receipts])
    for (const key of ['giftId', 'ticketId'])
      if (new Set(list.map((item) => item[key])).size !== list.length)
        return false;
  if (
    slice.outgoing.some((gift) =>
      slice.received.some(
        (receipt) =>
          receipt.giftId === gift.giftId || receipt.ticketId === gift.ticketId,
      ),
    )
  )
    return false;
  if (tickets.length !== slice.received.length) return false;
  if (new Set(tickets.map((ticket) => ticket.giftId)).size !== tickets.length)
    return false;
  if (
    tickets.some(
      (ticket) =>
        !validId(ticket.giftId) ||
        !validId(ticket.senderId) ||
        !text(ticket.senderName, 20) ||
        ticket.milestone !== undefined ||
        ticket.goalId !== undefined ||
        !slice.received.some(
          (receipt) =>
            receipt.giftId === ticket.giftId &&
            receipt.ticketId === ticket.id &&
            receipt.senderId === ticket.senderId &&
            receipt.receivedAt === ticket.createdAt &&
            receipt.gift.name === ticket.name &&
            receipt.gift.expiresAt === ticket.expiresAt &&
            receipt.gift.issuer.name === ticket.senderName,
        ),
    )
  )
    return false;
  return slice.receipts.every((receipt) =>
    slice.outgoing.some(
      (gift) => exportGift(gift) === exportGift(receipt.gift),
    ),
  );
}
