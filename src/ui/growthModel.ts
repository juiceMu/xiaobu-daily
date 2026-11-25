import { dateKey } from '../domain/engine';
import type { Checkin, Task } from '../domain/types';

export const GROWTH_LOOKBACK = 3;
const DAYS_PER_WEEK = 7;

export function moveGrowthOffset(offset: number, step: -1 | 1) {
  return Math.max(-GROWTH_LOOKBACK, Math.min(0, offset + step));
}

export function growthPeriod(
  now: Date,
  unit: 'week' | 'month',
  offset: number,
) {
  const start = new Date(now);
  start.setHours(12, 0, 0, 0);
  const isMonth = unit === 'month';
  if (isMonth) {
    start.setMonth(start.getMonth() + offset, 1);
  } else {
    start.setDate(
      start.getDate() - ((start.getDay() + 6) % 7) + offset * DAYS_PER_WEEK,
    );
  }
  const end = new Date(start);
  if (isMonth) end.setMonth(end.getMonth() + 1, 0);
  else end.setDate(end.getDate() + DAYS_PER_WEEK - 1);
  const dates: string[] = [];
  for (
    const cursor = new Date(start);
    cursor <= end;
    cursor.setDate(cursor.getDate() + 1)
  ) {
    dates.push(dateKey(cursor));
  }
  return {
    start: dates[0],
    end: dates[dates.length - 1],
    year: start.getFullYear(),
    month: start.getMonth() + 1,
    leading: (start.getDay() + 6) % 7,
    dates,
  };
}

export function buildGrowthProgress(
  tasks: readonly Task[],
  checkins: readonly Checkin[],
  dates: readonly string[],
  today: string,
) {
  const visibleDates = new Set(dates.filter((date) => date <= today));
  const totals = new Map<string, number>();
  const perTask = new Map<string, Map<string, number>>();
  let total = 0;
  for (const entry of checkins) {
    if (!visibleDates.has(entry.date)) continue;
    total += 1;
    totals.set(entry.date, (totals.get(entry.date) ?? 0) + 1);
    const counts = perTask.get(entry.taskId) ?? new Map<string, number>();
    counts.set(entry.date, (counts.get(entry.date) ?? 0) + 1);
    perTask.set(entry.taskId, counts);
  }
  const progress = tasks
    .filter((task) => !task.deleted)
    .map((task) => {
      const counts = dates.map((date) => perTask.get(task.id)?.get(date) ?? 0);
      const completed = counts.map((count) => count >= task.target);
      return {
        task,
        total: counts.reduce((sum, count) => sum + count, 0),
        completed,
        completedDays: completed.filter(Boolean).length,
      };
    });
  const active = progress.filter(({ task }) => !task.archived);
  const days = dates.map((date, index) => {
    const count = totals.get(date) ?? 0;
    const status: 'future' | 'full' | 'partial' | 'empty' =
      date > today
        ? 'future'
        : active.length > 0 && active.every(({ completed }) => completed[index])
          ? 'full'
          : count > 0
            ? 'partial'
            : 'empty';
    return { date, count, status };
  });
  return {
    days,
    total,
    progress,
    completedDays: days.filter(({ status }) => status === 'full').length,
  };
}
