import { getTicketStatus } from '../domain/engine';
import { isTicketReserved } from '../domain/companion';
import { peerBoards } from '../domain/groupSync';
import type { AppState, CompanionUse, Ticket } from '../domain/types';

export function companionCandidates(
  state: AppState,
  ticket: Ticket,
  now: Date,
) {
  if (
    !state.groupLink ||
    isTicketReserved(ticket) ||
    getTicketStatus(ticket, state, now) !== 'available'
  )
    return [];
  return peerBoards(state)
    .filter((peer) => !peer.left && peer.accountId !== state.sync?.accountId)
    .flatMap((peer) =>
      peer.app.tickets
        .filter(
          (other) =>
            (other.source === 'companion') !==
              (ticket.source === 'companion') &&
            !isTicketReserved(other) &&
            getTicketStatus(other, peer.app, now) === 'available',
        )
        .map((other) => ({ peer, ticket: other })),
    );
}

export function companionStageLabel(session: CompanionUse) {
  if (
    session.cancelRequestedAt &&
    ['requested', 'invited', 'accepted'].includes(session.stage)
  )
    return '已请求取消 · 结果待同步核对';
  switch (session.stage) {
    case 'requested':
      return '等待伙伴批准 · 请同步';
    case 'invited':
      return '已授权主券使用 · 等待伙伴确认';
    case 'accepted':
      return '已确认同行 · 结果待同步核对';
    case 'committed':
      return '主券已提交 · 等待对方核对';
    case 'completed':
      return '联合使用已完成';
    case 'cancelled':
      return '已取消';
  }
}
