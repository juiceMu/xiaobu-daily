import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addTask,
  archiveTask,
  checkIn,
  createInitialState,
  deleteTask,
  redeemCompanionTicket,
  undoCheckIn,
} from '../src/domain/engine';
import {
  buildTaskHistoryIndex,
  createTaskHistoryCalendar,
  initialTaskHistoryAnchor,
  type TaskHistoryPeriod,
} from '../src/domain/taskHistory';

function calendar({
  period = 'month',
  anchor,
  today,
  earliest = today,
  checkinDates = [],
}: {
  period?: TaskHistoryPeriod;
  anchor: string;
  today: string;
  earliest?: string;
  checkinDates?: string[];
}) {
  const now = new Date(today + 'T12:00:00');
  const state = createInitialState(now);
  const task = state.tasks[0];
  task.target = 9;
  for (const date of checkinDates) {
    assert.equal(checkIn(state, task.id, now, date).ok, true);
  }
  const summary = buildTaskHistoryIndex(state.tasks, state.checkins).get(
    task.id,
  );
  assert.ok(summary);
  return createTaskHistoryCalendar({
    period,
    anchor,
    today,
    earliest,
    summary,
  });
}

test('打卡记录按任务 ID 与所属日汇总，撤销减少当天次数，归档保留历史', () => {
  const now = new Date(2026, 10, 24, 10);
  const state = createInitialState(now);
  const [archivedTask, deletedTask] = state.tasks;
  archivedTask.target = 3;
  // 同名任务仍按独立 ID 计数。
  assert.equal(addTask(state, { name: archivedTask.name, target: 1 }).ok, true);
  const emptyTask = state.tasks[2];
  for (const date of ['2026-11-24', '2026-11-23', '2026-11-23', '2026-10-09'])
    assert.equal(checkIn(state, archivedTask.id, now, date).ok, true);
  assert.equal(checkIn(state, deletedTask.id, now, '2026-11-23').ok, true);
  assert.equal(undoCheckIn(state, archivedTask.id, now, '2026-11-23').ok, true);
  assert.equal(archiveTask(state, archivedTask.id).ok, true);
  assert.equal(checkIn(state, archivedTask.id, now, '2026-11-23').ok, true);
  assert.equal(deleteTask(state, deletedTask.id).ok, true);
  const before = JSON.stringify(state);
  const index = buildTaskHistoryIndex(state.tasks, state.checkins);
  assert.deepEqual(index.get(archivedTask.id), {
    total: 4,
    days: 3,
    counts: new Map([
      ['2026-11-24', 1],
      ['2026-11-23', 2],
      ['2026-10-09', 1],
    ]),
    firstDate: '2026-10-09',
    lastDate: '2026-11-24',
  });
  assert.deepEqual(index.get(emptyTask.id), {
    total: 0,
    days: 0,
    counts: new Map(),
    firstDate: null,
    lastDate: null,
  });
  assert.equal(index.has(deletedTask.id), false);
  assert.equal(
    state.checkins.some(({ taskId }) => taskId === deletedTask.id),
    true,
  );
  assert.equal(JSON.stringify(state), before);
});

test('已用于兑换的打卡仍计入任务历史', () => {
  const now = new Date(2026, 10, 24, 10);
  const state = createInitialState(now);
  const task = state.tasks[0];
  assert.equal(checkIn(state, task.id, now).ok, true);
  assert.equal(redeemCompanionTicket(state, now).ok, true);
  assert.equal(undoCheckIn(state, task.id, now).ok, false);
  const summary = buildTaskHistoryIndex(state.tasks, state.checkins).get(
    task.id,
  );
  assert.equal(summary?.total, 1);
  assert.equal(summary?.days, 1);
  assert.equal(summary?.counts.get('2026-11-24'), 1);
});

test('入口日期接受有效过去日期，非法格式、非闰年和未来日期回退今天', () => {
  const today = '2026-11-24';
  for (const key of [
    undefined,
    '2026-02-29',
    '1900-02-29',
    '2026-11-25',
    '2026-1-01',
    '0000-12-31',
    '2026-11-24T00:00:00Z',
  ]) {
    assert.equal(initialTaskHistoryAnchor(key, today), today);
  }
  for (const key of ['2024-02-29', '2000-02-29', '0001-01-01', today]) {
    assert.equal(initialTaskHistoryAnchor(key, today), key);
  }
});

test('月历只显示所属月，前后填空，统计同时区分同日次数与天数', () => {
  const result = calendar({
    anchor: '2024-02-28',
    today: '2024-02-28',
    checkinDates: ['2024-01-31', '2024-02-01', '2024-02-28', '2024-02-28'],
  });
  assert.equal(result.start, '2024-02-01');
  assert.equal(result.end, '2024-02-29');
  assert.equal(result.isCurrent, true);
  assert.equal(result.rows.length, 5);
  assert.ok(result.rows.every((row) => row.length === 7));
  assert.deepEqual(
    result.rows[0].slice(0, 4).map((day) => day?.date ?? null),
    [null, null, null, '2024-02-01'],
  );
  assert.deepEqual(result.rows.at(-1)?.[2], {
    date: '2024-02-28',
    count: 2,
    isToday: true,
    isFuture: false,
  });
  assert.deepEqual(result.rows.at(-1)?.slice(3), [
    { date: '2024-02-29', count: 0, isToday: false, isFuture: true },
    null,
    null,
    null,
  ]);
  assert.equal(result.total, 3);
  assert.equal(result.days, 2);
  assert.equal(result.previousAnchor, '2024-01-31');
  assert.equal(result.nextAnchor, null);
});

test('周历从周一开始并跨年，保留相对星期，导航不会超过今天', () => {
  const options = {
    period: 'week' as const,
    today: '2026-01-05',
    checkinDates: ['2025-12-25', '2025-12-31', '2026-01-01', '2026-01-05'],
  };
  const result = calendar({ ...options, anchor: '2026-01-01' });
  assert.deepEqual(
    result.rows.map((row) => row.map((day) => day?.date)),
    [
      [
        '2025-12-29',
        '2025-12-30',
        '2025-12-31',
        '2026-01-01',
        '2026-01-02',
        '2026-01-03',
        '2026-01-04',
      ],
    ],
  );
  assert.equal(result.total, 2);
  assert.equal(result.days, 2);
  assert.equal(result.isCurrent, false);
  assert.equal(result.previousAnchor, '2025-12-25');
  assert.equal(result.nextAnchor, '2026-01-05');
  const current = calendar({ ...options, anchor: result.nextAnchor });
  assert.equal(current.isCurrent, true);
  assert.equal(current.nextAnchor, null);
  assert.equal(current.total, 1);
});

test('月末导航将同日约束在目标月内，中间空月与入口选定的历史月可查看', () => {
  const options = {
    today: '2024-05-15',
    earliest: '2023-12-08',
    checkinDates: ['2024-01-31', '2024-03-31'],
  };
  const january = calendar({ ...options, anchor: '2024-01-31' });
  assert.equal(january.nextAnchor, '2024-02-29');
  const march = calendar({ ...options, anchor: '2024-03-31' });
  assert.equal(march.previousAnchor, '2024-02-29');
  assert.equal(march.nextAnchor, '2024-04-30');
  const february = calendar({ ...options, anchor: '2024-02-29' });
  assert.equal(february.total, 0);
  assert.equal(february.days, 0);
  assert.equal(february.nextAnchor, '2024-03-29');
  const april = calendar({ ...options, anchor: '2024-04-30' });
  assert.equal(april.nextAnchor, '2024-05-15');
  const december = calendar({ ...options, anchor: '2023-10-05' });
  assert.equal(december.start, '2023-12-01');
  assert.equal(december.previousAnchor, null);
  assert.equal(december.nextAnchor, '2024-01-08');
});

test('没有记录时默认当前周期，也保留当天入口选中的历史周期', () => {
  const today = '2026-11-24';
  const current = calendar({ anchor: 'invalid', today });
  assert.equal(current.start, '2026-11-01');
  assert.equal(current.previousAnchor, null);
  assert.equal(current.nextAnchor, null);
  const historical = calendar({
    period: 'week',
    anchor: '2026-11-17',
    earliest: '2026-11-17',
    today,
  });
  assert.equal(historical.start, '2026-11-16');
  assert.equal(historical.previousAnchor, null);
  assert.equal(historical.nextAnchor, today);
});

test('设备时钟倒退后可以浏览已有记录所在周期，格子和周期计数保持一致', () => {
  const recordedAt = new Date(2026, 11, 10, 11);
  const state = createInitialState(recordedAt);
  assert.equal(checkIn(state, 'task-1', recordedAt).ok, true);
  const summary = buildTaskHistoryIndex(state.tasks, state.checkins).get(
    'task-1',
  );
  assert.ok(summary);
  const today = '2026-11-24';
  const options = { period: 'month' as const, today, earliest: today, summary };
  const november = createTaskHistoryCalendar({ ...options, anchor: today });
  assert.equal(november.nextAnchor, '2026-12-10');
  const december = createTaskHistoryCalendar({
    ...options,
    anchor: november.nextAnchor,
  });
  assert.equal(december.nextAnchor, null);
  assert.equal(december.total, 1);
  assert.equal(december.days, 1);
  assert.deepEqual(
    december.rows.flat().find((day) => day?.count === 1),
    {
      date: '2026-12-10',
      count: 1,
      isToday: false,
      isFuture: true,
    },
  );
});

test('四位年份边界不会生成公元零年或五位年份', () => {
  const earliest = calendar({
    period: 'week',
    anchor: '0001-01-01',
    today: '2026-11-24',
    checkinDates: ['0001-01-01'],
  });
  assert.equal(earliest.previousAnchor, null);
  assert.equal(earliest.start, '0001-01-01');
  assert.equal(earliest.end, '0001-01-07');
  assert.equal(earliest.rows[0][0]?.count, 1);
  const latest = calendar({
    period: 'week',
    anchor: '9999-12-31',
    today: '9999-12-31',
  });
  assert.equal(latest.nextAnchor, null);
  assert.equal(latest.end, '9999-12-31');
  assert.equal(latest.rows[0][4]?.date, '9999-12-31');
  assert.deepEqual(latest.rows[0].slice(5), [null, null]);
});
