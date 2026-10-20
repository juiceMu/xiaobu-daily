import { dateKey } from '../domain/engine';

export function localDateFromKey(key: string): Date | null {
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(key) || key < '0001-01-01')
    return null;
  const parsed = new Date(`${key}T12:00:00`);
  return Number.isFinite(parsed.getTime()) && dateKey(parsed) === key
    ? parsed
    : null;
}

export function shiftLocalDate(key: string, days: number): string {
  const date = localDateFromKey(key);
  if (!date) throw new Error('日期无效');
  date.setDate(date.getDate() + days);
  if (date.getFullYear() < 1) return '0001-01-01';
  return dateKey(date);
}

export function weekStripDay(
  date: string,
  index: number,
  now: Date,
  selectedDate = dateKey(now),
) {
  const isToday = date === dateKey(now);
  const weekday = '周' + '一二三四五六日'[index];
  // date已是本地YYYY-MM-DD键，直接取日避免UTC字符串解析导致跨日。
  const dayNumber = Number(date.slice(-2));
  return {
    isToday,
    isSelected: date === selectedDate,
    isFuture: date > dateKey(now),
    weekday,
    dayNumber,
    label: isToday ? '今天' : weekday,
    accessibilityLabel: `${date}，${weekday}${isToday ? '，今天' : ''}`,
  };
}
