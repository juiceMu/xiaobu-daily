import { formatChineseDateTime } from './displayDate';

export function formatMilestoneSource(name?: string) {
  if (!name) return '里程碑';
  return name.endsWith('里程碑') ? name : `${name}里程碑`;
}

export function formatTicketExpiry(value: string | null) {
  if (value === null) return '未设到期时间';
  return formatChineseDateTime(value, true) + ' 到期';
}
