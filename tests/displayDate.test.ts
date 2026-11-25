import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatCalendarDate,
  formatCalendarRange,
  formatChineseDate,
  formatChineseDateTime,
  formatChineseTime,
} from '../src/ui/displayDate';

test('本地新旧日期统一用中文并显示 24 小时时间，午夜为 00:00', () => {
  const midnight = new Date(2026, 10, 30, 0, 0).toISOString();
  const evening = new Date(2026, 10, 30, 23, 9).toISOString();
  assert.equal(
    formatChineseDate(midnight, { weekday: true }),
    '11月30日 · 周一',
  );
  assert.equal(formatChineseDateTime(midnight), '11月30日 00:00');
  assert.equal(formatChineseDateTime(evening, true), '2026年11月30日 23:09');
  assert.equal(formatChineseTime(evening), '23:09');
  assert.equal(formatChineseDateTime('invalid'), '日期无效');
});

test('日历日期键不做时区转换，跨年范围保留两侧年份', () => {
  assert.equal(formatCalendarDate('2026-11-30'), '11月30日');
  assert.equal(
    formatCalendarRange('2026-11-23', '2026-11-29'),
    '11月23日 — 11月29日',
  );
  assert.equal(
    formatCalendarRange('2026-12-28', '2027-01-03'),
    '2026年12月28日 — 2027年1月3日',
  );
  assert.equal(
    formatCalendarRange('2026-12-21', '2026-12-27', 2027),
    '2026年12月21日 — 12月27日',
  );
});
