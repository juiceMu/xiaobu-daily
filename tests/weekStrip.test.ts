import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createInitialState, getWeekStats } from '../src/domain/engine';
import { weekStripDay } from '../src/ui/weekStripModel';

test('周日期条跨月跨年显示实际几号，只在本地今天标记今天', () => {
  for (const [now, expected] of [
    [new Date(2026, 9, 31, 0, 5), [26, 27, 28, 29, 30, 31, 1]],
    [new Date(2027, 0, 1, 0, 5), [28, 29, 30, 31, 1, 2, 3]],
  ] as const) {
    const days = getWeekStats(createInitialState(), now).days.map(
      (day, index) => weekStripDay(day.date, index, now),
    );
    assert.deepEqual(
      days.map((day) => day.dayNumber),
      expected,
    );
    assert.equal(days.filter((day) => day.isToday).length, 1);
    const today = days.find((day) => day.isToday);
    assert.equal(today?.dayNumber, now.getDate());
    assert.equal(today?.label, '今天');
    assert.ok(today?.accessibilityLabel.includes('今天'));
    assert.ok(days.every((day) => day.weekday.startsWith('周')));
  }
});

test('周日期模型直接读取本地键，不因UTC字符串解析导致日期错位', () => {
  const now = new Date(2026, 9, 19, 0, 1);
  assert.equal(weekStripDay('2026-10-19', 0, now).isToday, true);
  assert.equal(weekStripDay('2026-10-18', 6, now).isToday, false);
  assert.equal(weekStripDay('2026-10-19', 0, now).dayNumber, 19);
  const model = readFileSync(
    new URL('../src/ui/weekStripModel.ts', import.meta.url),
    'utf8',
  );
  assert.ok(model.includes('date === dateKey(now)'));
  assert.equal(model.includes('new Date(date)'), false);
});

test('日期条展示日号和今天而非每日次数，原进度条6dp约束不变', () => {
  const source = readFileSync(
    new URL('../src/screens/TodayScreen.tsx', import.meta.url),
    'utf8',
  );
  const strip = source.slice(
    source.indexOf('stats.days.map'),
    source.indexOf('每 {state.settings.threshold}'),
  );
  assert.ok(strip.includes('{calendar.dayNumber}'));
  assert.ok(strip.includes('{calendar.label}'));
  const normalized = Array.from(strip)
    .filter((character) => character.charCodeAt(0) > 32)
    .join('');
  assert.ok(
    normalized.includes('weekStripDay(day.date,index,now,selectedDate'),
  );
  assert.ok(
    normalized.includes(
      "calendar.isSelected?colors.primaryContainer:'transparent'",
    ),
  );
  assert.ok(strip.includes('week-date-circle'));
  assert.ok(strip.includes('minWidth: 32'));
  assert.ok(strip.includes('minHeight: 32'));
  assert.ok(strip.includes('borderRadius: 999'));
  assert.equal(strip.includes(' ✓'), false);
  assert.ok(strip.includes('已选'));
  assert.equal(strip.includes('borderWidth'), false);
  assert.equal(strip.includes('day.count'), false);
  assert.ok(source.includes('testID="reward-progress-track"'));
});
