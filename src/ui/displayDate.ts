const WEEKDAYS = '日一二三四五六';

export function formatCalendarDate(key: string, withYear = false): string {
  const [year, month, day] = key.split('-').map(Number);
  return `${withYear ? year + '年' : ''}${month}月${day}日`;
}

export function formatCalendarRange(
  start: string,
  end: string,
  referenceYear?: number,
): string {
  const startYear = Number(start.slice(0, 4));
  const crossesYear = startYear !== Number(end.slice(0, 4));
  const showStartYear =
    crossesYear || (referenceYear !== undefined && startYear !== referenceYear);
  return `${formatCalendarDate(start, showStartYear)} — ${formatCalendarDate(end, crossesYear)}`;
}

export function formatChineseDate(
  value: string | Date,
  options: { year?: boolean; weekday?: boolean } = {},
): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '日期无效';
  const year = options.year ? date.getFullYear() + '年' : '';
  const weekday = options.weekday ? ' · 周' + WEEKDAYS[date.getDay()] : '';
  return `${year}${date.getMonth() + 1}月${date.getDate()}日${weekday}`;
}

export function formatChineseTime(value: string | Date): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '时间无效';
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${hour}:${minute}`;
}

export function formatChineseDateTime(
  value: string | Date,
  withYear = false,
): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '日期无效';
  return `${formatChineseDate(date, { year: withYear })} ${formatChineseTime(date)}`;
}
