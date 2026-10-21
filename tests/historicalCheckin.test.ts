import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  archiveTask,
  checkIn,
  createInitialState,
  getTaskCount,
  getWeekStats,
  migrateState,
  redeemTicket,
  undoCheckIn,
  updateSettings,
} from '../src/domain/engine';
import {
  localDateFromKey,
  shiftLocalDate,
  weekStripDay,
} from '../src/ui/weekStripModel';

const NOW = new Date(2026, 9, 21, 10);
test('补卡保存真实创建时间，归属发生日和历史周，不能兑换或结转本周', () => {
  const state = createInitialState();
  state.tasks[0].target = 3;
  for (let index = 0; index < 3; index += 1)
    assert.equal(checkIn(state, 'task-1', NOW, '2026-10-18').ok, true);
  assert.equal(state.checkins[0].date, '2026-10-18');
  assert.equal(state.checkins[0].week, '2026-10-12');
  assert.equal(state.checkins[0].createdAt, NOW.toISOString());
  assert.equal(getWeekStats(state, NOW).total, 0);
  assert.equal(getWeekStats(state, '2026-10-18T12:00:00').total, 3);
  assert.equal(redeemTicket(state, NOW, '2026-10-18').ok, false);
  assert.equal(redeemTicket(state, NOW).ok, false);
  assert.equal(checkIn(state, 'task-1', NOW, '2026-10-18').ok, false);
  assert.deepEqual(migrateState(state), state);
});
test('本周补卡正常兑换，已消费次数不能通过历史日撤销', () => {
  const state = createInitialState();
  updateSettings(state, { threshold: 1 });
  checkIn(state, 'task-1', NOW, '2026-10-19');
  assert.equal(redeemTicket(state, NOW, '2026-10-19').ok, true);
  assert.equal(state.tickets[0].createdAt, NOW.toISOString());
  assert.equal(undoCheckIn(state, 'task-1', NOW, '2026-10-19').ok, false);
  checkIn(state, 'task-2', NOW, '2026-10-20');
  assert.equal(undoCheckIn(state, 'task-1', NOW, '2026-10-19').ok, true);
  assert.equal(getTaskCount(state, 'task-1', '2026-10-19T12:00:00'), 0);
});
test('历史周已经兑换的次数仍受撤销保护，只能撤销后来新增的余量', () => {
  const state = createInitialState();
  const previousNow = new Date(2026, 9, 18, 10);
  updateSettings(state, { threshold: 1 });
  state.tasks[0].target = 2;
  assert.equal(checkIn(state, 'task-1', previousNow).ok, true);
  assert.equal(redeemTicket(state, previousNow).ok, true);
  assert.equal(undoCheckIn(state, 'task-1', NOW, '2026-10-18').ok, false);
  assert.equal(checkIn(state, 'task-1', NOW, '2026-10-18').ok, true);
  assert.equal(undoCheckIn(state, 'task-1', NOW, '2026-10-18').ok, true);
  assert.equal(undoCheckIn(state, 'task-1', NOW, '2026-10-18').ok, false);
  assert.equal(getWeekStats(state, NOW).total, 0);
  assert.equal(redeemTicket(state, NOW, '2026-10-18').ok, false);
});
test('非法和未来日期原子拒绝，归档任务仅过去日期补卡并保持每日上限', () => {
  const state = createInitialState();
  for (const date of ['2026-10-22', '2026-02-30', '', '2026-1-01']) {
    const before = JSON.stringify(state);
    assert.equal(checkIn(state, 'task-1', NOW, date).ok, false);
    assert.equal(undoCheckIn(state, 'task-1', NOW, date).ok, false);
    assert.equal(JSON.stringify(state), before);
  }
  archiveTask(state, 'task-2');
  assert.equal(checkIn(state, 'task-2', NOW).ok, false);
  assert.equal(checkIn(state, 'task-2', NOW, '2026-10-20').ok, true);
  assert.equal(checkIn(state, 'task-2', NOW, '2026-10-20').ok, false);
  assert.equal(undoCheckIn(state, 'task-2', NOW, '2026-10-20').ok, true);
});
test('历史日历跨年按本地日移周，选中和今天分开且未来不可选', () => {
  assert.equal(shiftLocalDate('2027-01-01', -7), '2026-12-25');
  assert.equal(shiftLocalDate('0001-01-01', -7), '0001-01-01');
  assert.equal(localDateFromKey('0001-01-01')?.getFullYear(), 1);
  assert.equal(localDateFromKey('0000-12-31'), null);
  assert.equal(localDateFromKey('2026-02-30'), null);
  const selected = weekStripDay('2026-10-19', 0, NOW, '2026-10-19');
  assert.equal(selected.isSelected, true);
  assert.equal(selected.isToday, false);
  assert.equal(weekStripDay('2026-10-22', 3, NOW).isFuture, true);
});
test('补卡支持四位年份最早日期且不接受公元零年', () => {
  const state = createInitialState();
  assert.equal(checkIn(state, 'task-1', NOW, '0001-01-01').ok, true);
  assert.equal(state.checkins[0].date, '0001-01-01');
  assert.equal(state.checkins[0].week, '0001-01-01');
  assert.deepEqual(migrateState(state), state);
  assert.equal(checkIn(state, 'task-1', NOW, '0000-12-31').ok, false);
});

test('历史日期界面提供周切换月历与回今天，记录和确认按选日而非模拟实际时间', () => {
  const source = readFileSync(
    new URL('../src/screens/TodayScreen.tsx', import.meta.url),
    'utf8',
  );
  const compact = Array.from(source)
    .filter((character) => character.charCodeAt(0) > 32)
    .join('');
  assert.ok(source.includes('查看上一周'));
  assert.ok(source.includes('查看下一周'));
  assert.ok(source.includes('日历上一月'));
  assert.ok(source.includes('回今天'));
  assert.ok(compact.includes('getTaskCount(state,item.id,selectedNow)'));
  assert.ok(compact.includes('checkIn(draft,item.id,newDate(),selectedDate)'));
  assert.ok(
    compact.includes(
      'undoCheckIn(draft,confirm.task!.id,newDate(),confirm.date)',
    ),
  );
  assert.ok(compact.includes('redeemTicket(draft,newDate(),confirm.date)'));
  assert.ok(compact.includes('busy||historicalWeek||stats.redeemable===0'));
  assert.ok(source.includes('calendar.isSelected'));
  assert.ok(source.includes('calendar.isFuture'));
  assert.ok(source.includes('已归档 · 可补历史'));
  assert.ok(source.includes('minHeight: 40'));
  assert.ok(source.includes('fontSize: 13'));
});
