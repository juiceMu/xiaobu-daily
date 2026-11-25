export function formatMilestoneSource(name?: string) {
  if (!name) return '里程碑';
  return name.endsWith('里程碑') ? name : `${name}里程碑`;
}

export function formatTicketExpiry(value: string | null) {
  if (value === null) return '未设到期时间';
  const date = new Date(value);
  const twoDigits = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())} 到期`;
}
