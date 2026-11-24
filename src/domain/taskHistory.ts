import type { Checkin, Task } from './types';

export type TaskHistoryPeriod = 'month' | 'week';

export type TaskHistorySummary = {
  total: number;
  days: number;
  counts: ReadonlyMap<string, number>;
  firstDate: string | null;
  lastDate: string | null;
};

export type TaskHistoryDay = {
  date: string;
  count: number;
  isToday: boolean;
  isFuture: boolean;
};

const LAST_DATE = '9999-12-31';

function calendarKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseCalendarDate(key: string | undefined): Date | null {
  if (
    typeof key !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(key) ||
    key < '0001-01-01'
  )
    return null;
  const [year, month, day] = key.split('-').map(Number);
  // 打卡所属日是存档里的日历日期。统一用 UTC 字段做纯日历运算，避免换时区或夏令时改变日期。
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return calendarKey(date) === key ? date : null;
}

export function initialTaskHistoryAnchor(
  initialDate: string | undefined,
  today: string,
): string {
  return initialDate && parseCalendarDate(initialDate) && initialDate <= today
    ? initialDate
    : today;
}

export function buildTaskHistoryIndex(
  tasks: readonly Task[],
  checkins: readonly Checkin[],
): ReadonlyMap<string, TaskHistorySummary> {
  const history = new Map<
    string,
    TaskHistorySummary & { counts: Map<string, number> }
  >();
  for (const task of tasks) {
    if (task.deleted) continue;
    history.set(task.id, {
      total: 0,
      days: 0,
      counts: new Map(),
      firstDate: null,
      lastDate: null,
    });
  }
  for (const { taskId, date } of checkins) {
    const summary = history.get(taskId);
    if (!summary || !parseCalendarDate(date)) continue;
    summary.counts.set(date, (summary.counts.get(date) ?? 0) + 1);
    summary.total += 1;
    if (summary.firstDate === null || date < summary.firstDate)
      summary.firstDate = date;
    if (summary.lastDate === null || date > summary.lastDate)
      summary.lastDate = date;
  }
  for (const summary of history.values()) summary.days = summary.counts.size;
  return history;
}

function shiftDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function shiftPeriod(
  date: Date,
  period: TaskHistoryPeriod,
  offset: -1 | 1,
): Date {
  if (period === 'week') return shiftDays(date, 7 * offset);
  const day = date.getUTCDate();
  const next = new Date(date.getTime());
  next.setUTCMonth(next.getUTCMonth() + offset, 1);
  const monthEnd = new Date(next.getTime());
  monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1, 0);
  next.setUTCDate(Math.min(day, monthEnd.getUTCDate()));
  return next;
}

function clampDate(key: string, earliest: string, latest: string): string {
  return key < earliest ? earliest : key > latest ? latest : key;
}

export function createTaskHistoryCalendar({
  period,
  anchor,
  today,
  earliest,
  summary,
}: {
  period: TaskHistoryPeriod;
  anchor: string;
  today: string;
  earliest: string;
  summary: TaskHistorySummary;
}) {
  const initial = initialTaskHistoryAnchor(earliest, today);
  const lower =
    summary.firstDate && summary.firstDate < initial
      ? summary.firstDate
      : initial;
  // 设备时钟倒退时，已保存的记录仍可查看。
  const upper =
    summary.lastDate && summary.lastDate > today ? summary.lastDate : today;
  const key = clampDate(
    parseCalendarDate(anchor) ? anchor : today,
    lower,
    upper,
  );
  const selected = parseCalendarDate(key);
  if (!selected) throw new RangeError('打卡记录日历需要有效日期');

  const month = period === 'month';
  const first = new Date(selected.getTime());
  const last = new Date(selected.getTime());
  if (month) {
    first.setUTCDate(1);
    last.setUTCMonth(last.getUTCMonth() + 1, 0);
  } else {
    const weekday = (selected.getUTCDay() + 6) % 7;
    first.setUTCDate(first.getUTCDate() - weekday);
    last.setUTCDate(last.getUTCDate() + 6 - weekday);
  }
  const start = calendarKey(first);
  const end = last.getUTCFullYear() > 9999 ? LAST_DATE : calendarKey(last);
  const rows: (TaskHistoryDay | null)[][] = [];
  let row: (TaskHistoryDay | null)[] = Array.from(
    { length: (first.getUTCDay() + 6) % 7 },
    () => null,
  );
  let total = 0;
  let days = 0;
  for (
    let cursor = first;
    cursor <= last && cursor.getUTCFullYear() <= 9999;
    cursor = shiftDays(cursor, 1)
  ) {
    const date = calendarKey(cursor);
    const count = summary.counts.get(date) ?? 0;
    total += count;
    if (count > 0) days += 1;
    row.push({ date, count, isToday: date === today, isFuture: date > today });
    if (row.length === 7) {
      rows.push(row);
      row = [];
    }
  }
  if (row.length) {
    while (row.length < 7) row.push(null);
    rows.push(row);
  }

  const navigationAnchor = (offset: -1 | 1) => {
    const next = shiftPeriod(selected, period, offset);
    if (next.getUTCFullYear() < 1) return lower;
    if (next.getUTCFullYear() > 9999) return upper;
    return clampDate(calendarKey(next), lower, upper);
  };
  return {
    start,
    end,
    rows,
    total,
    days,
    previousAnchor: lower < start ? navigationAnchor(-1) : null,
    nextAnchor: upper > end ? navigationAnchor(1) : null,
    isCurrent: start <= today && today <= end,
  };
}
