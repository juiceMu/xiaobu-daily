import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGrowthProgress,
  growthPeriod,
  moveGrowthOffset,
} from '../src/ui/growthModel';
import type { Checkin, Task } from '../src/domain/types';

const task = (id: string, target: number, flags?: Partial<Task>): Task => ({
  id,
  target,
  name: id,
  archived: false,
  color: 'green',
  icon: '🌱',
  ...flags,
});
const checkin = (
  taskId: string,
  date: string,
  id = taskId + date,
): Checkin => ({
  taskId,
  date,
  id,
  week: '2026-01-05',
  createdAt: '2026-01-20T12:00:00Z',
});

test('成长记录周月各可回看三期，跨年和闰月依本地日历对齐', () => {
  const january = new Date(2026, 0, 1, 23, 30);
  const weekly = growthPeriod(january, 'week', 0);
  assert.equal(weekly.start, '2025-12-29');
  assert.equal(weekly.end, '2026-01-04');
  assert.equal(weekly.dates.length, 7);
  const october = growthPeriod(january, 'month', -3);
  assert.equal(october.start, '2025-10-01');
  assert.equal(october.end, '2025-10-31');
  assert.equal(october.leading, 2);
  const february = growthPeriod(new Date(2024, 2, 31, 12), 'month', -1);
  assert.equal(february.start, '2024-02-01');
  assert.equal(february.end, '2024-02-29');
  assert.equal(february.leading, 3);
  const transition = growthPeriod(new Date(2026, 2, 8, 1), 'week', 0);
  assert.equal(new Set(transition.dates).size, 7);
  assert.equal(moveGrowthOffset(-3, -1), -3);
  assert.equal(moveGrowthOffset(-3, 1), -2);
  assert.equal(moveGrowthOffset(-1, -1), -2);
  assert.equal(moveGrowthOffset(0, 1), 0);
});

test('周期两视图使用同一组实际记录，月历区分四态并保留已删除任务总量', () => {
  const dates = ['2026-01-05', '2026-01-06', '2026-01-07', '2026-01-08'];
  const a = task('a', 2);
  const b = task('b', 1);
  const archived = task('archived', 1, { archived: true });
  const deleted = task('deleted', 1, { deleted: true });
  const summary = buildGrowthProgress(
    [a, b, archived, deleted],
    [
      checkin(a.id, dates[0]),
      checkin(a.id, dates[0], 'another'),
      checkin(b.id, dates[0]),
      checkin(archived.id, dates[1]),
      checkin(deleted.id, dates[1]),
      checkin(a.id, dates[3]),
      checkin(a.id, '2025-12-31'),
    ],
    dates,
    dates[2],
  );
  assert.equal(summary.total, 5);
  assert.equal(summary.completedDays, 1);
  assert.deepEqual(
    summary.days.map(({ status, count }) => [status, count]),
    [
      ['full', 3],
      ['partial', 2],
      ['empty', 0],
      ['future', 0],
    ],
  );
  assert.deepEqual(
    summary.progress.map(({ task, total, completedDays }) => [
      task.id,
      total,
      completedDays,
    ]),
    [
      ['a', 2, 1],
      ['b', 1, 1],
      ['archived', 1, 1],
    ],
  );
  const empty = buildGrowthProgress([a], [], dates, dates[2]);
  assert.equal(empty.total, 0);
  assert.equal(empty.completedDays, 0);
  assert.deepEqual(
    empty.days.map(({ status }) => status),
    ['empty', 'empty', 'empty', 'future'],
  );
});
