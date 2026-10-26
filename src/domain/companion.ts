import { getTicketStatus } from './engineCore.mjs';
import { peerBoards } from './groupSync';
import { isTicketReserved, sameCompanionUse } from './companionValidation.mjs';
import type {
  ActionResult,
  AppState,
  CompanionUse,
  DateInput,
  Ticket,
} from './types';

export { isTicketReserved } from './companionValidation.mjs';
const fail = (message: string): ActionResult => ({ ok: false, message });
const done = (message: string): ActionResult => ({ ok: true, message });
const available = (ticket: Ticket, state: AppState, now: DateInput) =>
  !isTicketReserved(ticket) &&
  getTicketStatus(ticket, state, now) === 'available';
const terminal = (session: CompanionUse) =>
  ['completed', 'cancelled'].includes(session.stage);
const SESSION_LIFETIME_MS = 15 * 60 * 1000;
function stamp(now: DateInput) {
  const value = new Date(now);
  return Number.isFinite(value.getTime()) ? value.toISOString() : null;
}
function peer(state: AppState, accountId: string) {
  return peerBoards(state).find(
    (board) => board.accountId === accountId && !board.left,
  );
}
function localSession(state: AppState, id: string) {
  for (const ticket of state.tickets) {
    const session = ticket.companionUses?.find((entry) => entry.id === id);
    if (session) return { ticket, session };
  }
}
function remoteSession(state: AppState, session: CompanionUse) {
  const main = state.sync?.accountId === session.mainAccountId;
  // 已离组日志仍可携带最后的提交/取消决定，不能因墓碑而永久忽略。
  const board = peerBoards(state).find(
    (entry) =>
      entry.accountId ===
      (main ? session.companionAccountId : session.mainAccountId),
  );
  const ticket = board?.app.tickets.find(
    (entry) =>
      entry.id === (main ? session.companionTicketId : session.mainTicketId),
  );
  const remote = ticket?.companionUses?.find(
    (entry) => entry.id === session.id && sameCompanionUse(entry, session),
  );
  return { board, ticket, session: remote };
}
function consume(ticket: Ticket, session: CompanionUse, committedAt: string) {
  ticket.usedAt = committedAt;
  ticket.usageNote = session.note;
  session.committedAt = committedAt;
}

export interface CompanionUseInput {
  ticketId: string;
  peerAccountId: string;
  peerTicketId: string;
  note?: string;
}
export interface CompanionUseOffer {
  session: CompanionUse;
  localTicket: Ticket;
  peerTicket: Ticket;
  peerName: string;
  canAccept: boolean;
}

// 主券邀请已经包含本机使用授权；同行方必须在自己的设备另行确认。
export function startCompanionUse(
  state: AppState,
  input: CompanionUseInput,
  now: DateInput = new Date(),
  id?: string,
): ActionResult {
  const at = stamp(now);
  if (!at || !state.groupLink || !state.sync)
    return fail('请先加入小组并同步伙伴记录');
  if (
    typeof input.note !== 'undefined' &&
    (typeof input.note !== 'string' || input.note.trim().length > 200)
  )
    return fail('使用备注最多填写 200 个字符');
  if (input.peerAccountId === state.sync.accountId)
    return fail('同行券只能搭配另一人的奖券');
  const board = peer(state, input.peerAccountId);
  const ticket = state.tickets.find((entry) => entry.id === input.ticketId);
  const other = board?.app.tickets.find(
    (entry) => entry.id === input.peerTicketId,
  );
  if (!ticket || !other || !board)
    return fail('请先同步，确认伙伴和奖券仍在当前小组');
  if (!available(ticket, state, now) || !available(other, board.app, now))
    return fail('所选奖券已使用、过期或正在等待同行确认');
  const localCompanion = ticket.source === 'companion';
  if (localCompanion === (other.source === 'companion'))
    return fail('需要一张同行券搭配一张普通、里程碑或赠送券');
  const sessionId =
    id ??
    `companion-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  if (
    !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,159}$/.test(sessionId) ||
    state.tickets.some((entry) =>
      entry.companionUses?.some((use) => use.id === sessionId),
    )
  )
    return fail('同行记录编号无效或重复');
  const expires = Math.min(
    new Date(at).getTime() + SESSION_LIFETIME_MS,
    ...[ticket, other].flatMap((entry) =>
      entry.expiresAt ? [Date.parse(entry.expiresAt)] : [],
    ),
  );
  const session: CompanionUse = {
    id: sessionId,
    groupId: state.groupLink.groupId,
    mainAccountId: localCompanion ? board.accountId : state.sync.accountId,
    mainTicketId: localCompanion ? other.id : ticket.id,
    companionAccountId: localCompanion ? state.sync.accountId : board.accountId,
    companionTicketId: localCompanion ? ticket.id : other.id,
    mainName: localCompanion
      ? board.name
      : state.giftState?.profile.name || '成员',
    mainTicketName: localCompanion ? other.name : ticket.name,
    companionName: localCompanion
      ? state.giftState?.profile.name || '成员'
      : board.name,
    companionTicketName: localCompanion ? ticket.name : other.name,
    note: input.note?.trim() ?? '',
    createdAt: at,
    expiresAt: new Date(expires).toISOString(),
    stage: localCompanion ? 'requested' : 'invited',
  };
  (ticket.companionUses ??= []).push(session);
  return done(
    localCompanion
      ? '已请求同行，请同步后由伙伴批准'
      : '已确认使用并邀请伙伴，请同步等待对方确认',
  );
}

export function companionUseOffers(
  state: AppState,
  now: DateInput = new Date(),
): CompanionUseOffer[] {
  if (!state.groupLink || !state.sync) return [];
  const result: CompanionUseOffer[] = [];
  for (const board of peerBoards(state).filter((entry) => !entry.left)) {
    for (const peerTicket of board.app.tickets) {
      for (const session of peerTicket.companionUses ?? []) {
        const localMain = session.mainAccountId === state.sync.accountId;
        const localId = localMain
          ? session.mainTicketId
          : session.companionTicketId;
        const target = localMain
          ? session.companionAccountId
          : session.mainAccountId;
        if (
          target !== board.accountId ||
          session.groupId !== state.groupLink.groupId ||
          terminal(session)
        )
          continue;
        const localTicket = state.tickets.find((entry) => entry.id === localId);
        if (!localTicket || (localTicket.source === 'companion') === localMain)
          continue;
        const own = localTicket.companionUses?.find(
          (entry) => entry.id === session.id,
        );
        if (own && (!sameCompanionUse(own, session) || terminal(own))) continue;
        const wantedStage = localMain ? 'requested' : 'invited';
        const canAccept =
          session.stage === wantedStage &&
          (!own || own.stage === 'requested') &&
          Date.parse(session.createdAt) <= new Date(now).getTime() &&
          Date.parse(session.expiresAt) > new Date(now).getTime() &&
          getTicketStatus(localTicket, state, now) === 'available' &&
          getTicketStatus(peerTicket, board.app, now) === 'available' &&
          !(localTicket.companionUses ?? []).some(
            (entry) => entry.id !== session.id && !terminal(entry),
          );
        result.push({
          session,
          localTicket,
          peerTicket,
          peerName: board.name,
          canAccept,
        });
      }
    }
  }
  return result;
}

export function acceptCompanionUse(
  state: AppState,
  id: string,
  now: DateInput = new Date(),
): ActionResult {
  if (!stamp(now)) return fail('设备时间无效');
  const offer = companionUseOffers(state, now).find(
    (entry) => entry.session.id === id && entry.canAccept,
  );
  if (!offer) return fail('邀请已失效、奖券不可用或尚未同步最新记录');
  const stage =
    offer.localTicket.source === 'companion' ? 'accepted' : 'invited';
  const existing = localSession(state, id);
  if (existing) existing.session.stage = stage;
  else
    (offer.localTicket.companionUses ??= []).push({ ...offer.session, stage });
  return done(
    stage === 'accepted'
      ? '已确认同行，请同步完成联合使用'
      : '已批准并确认使用主券，请同步等待伙伴确认',
  );
}

export function cancelCompanionUse(
  state: AppState,
  id: string,
  now: DateInput = new Date(),
): ActionResult {
  const at = stamp(now);
  if (!at) return fail('设备时间无效');
  const own = localSession(state, id);
  if (!own) {
    const offer = companionUseOffers(state, now).find(
      (entry) => entry.session.id === id,
    );
    if (!offer || !available(offer.localTicket, state, now))
      return fail('同行记录不存在或本机奖券不可用');
    (offer.localTicket.companionUses ??= []).push({
      ...offer.session,
      stage: 'cancelled',
    });
    return done('已拒绝同行，请同步通知伙伴');
  }
  if (terminal(own.session)) return done('同行记录已经处理');
  if (own.session.stage === 'committed')
    return fail('主券已提交使用，不能取消，请同步核对结果');
  if (own.ticket.source === 'companion' && own.session.stage === 'accepted') {
    own.session.cancelRequestedAt ??= at;
    return done('已请求取消；结果待核对，请与伙伴同步，暂不释放奖券');
  }
  own.session.stage = 'cancelled';
  return done('已取消同行，请同步通知伙伴');
}

// 只推进本账户券；保存成功后才能把决定同步出去。已提交决定永不回滚。
export function reconcileCompanionUses(
  state: AppState,
  now: DateInput = new Date(),
): ActionResult {
  const at = stamp(now);
  if (!at) return fail('设备时间无效');
  let changed = 0;
  for (const ticket of state.tickets) {
    for (const session of ticket.companionUses ?? []) {
      if (terminal(session)) continue;
      const remote = remoteSession(state, session);
      const localMain = ticket.source !== 'companion';
      if (Date.parse(at) < Date.parse(session.createdAt)) continue;
      if (localMain && session.stage === 'invited') {
        const partnerLeft = peerBoards(state).some(
          (board) =>
            board.accountId === session.companionAccountId && board.left,
        );
        if (
          Date.parse(at) >= Date.parse(session.expiresAt) ||
          partnerLeft ||
          remote.session?.stage === 'cancelled' ||
          remote.session?.cancelRequestedAt
        ) {
          session.stage = 'cancelled';
          changed += 1;
        } else if (
          remote.session?.stage === 'accepted' &&
          remote.ticket &&
          getTicketStatus(ticket, state, at) === 'available' &&
          getTicketStatus(remote.ticket, remote.board!.app, at) === 'available'
        ) {
          session.stage = 'committed';
          consume(ticket, session, at);
          changed += 1;
        }
      } else if (
        localMain &&
        session.stage === 'committed' &&
        remote.session?.stage === 'completed' &&
        remote.session.committedAt === session.committedAt
      ) {
        session.stage = 'completed';
        changed += 1;
      } else if (!localMain && remote.session?.stage === 'cancelled') {
        session.stage = 'cancelled';
        changed += 1;
      } else if (
        !localMain &&
        session.stage === 'accepted' &&
        remote.session &&
        ['committed', 'completed'].includes(remote.session.stage) &&
        remote.session.committedAt
      ) {
        session.stage = 'completed';
        consume(ticket, session, remote.session.committedAt);
        changed += 1;
      } else if (
        !localMain &&
        session.stage === 'requested' &&
        Date.parse(at) >= Date.parse(session.expiresAt)
      ) {
        session.stage = 'cancelled';
        changed += 1;
      }
    }
  }
  return done(changed ? `已更新 ${changed} 条同行记录` : '同行记录无需更新');
}
