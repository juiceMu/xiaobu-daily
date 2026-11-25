import type { Ticket } from '../domain/types';
import { formatChineseDateTime } from './displayDate';

export function formatMilestoneSource(name?: string) {
  if (!name) return '里程碑';
  return name.endsWith('里程碑') ? name : `${name}里程碑`;
}

export function formatTicketExpiry(value: string | null) {
  if (value === null) return '未设到期时间';
  return formatChineseDateTime(value, true) + ' 到期';
}

// 原生存档的 source 是券来源标记，旧打卡券允许省略。
export function formatTicketValidity(
  ticket: Pick<Ticket, 'source' | 'expiresAt'>,
) {
  return ticket.source === 'weight'
    ? '永久有效'
    : formatTicketExpiry(ticket.expiresAt);
}
