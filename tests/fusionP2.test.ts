import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { calendarRowHeight } from '../src/ui/calendarLayout';

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), 'utf8');

test('足够高时日历行高72，矮屏压缩仍保持至少44点触控', () => {
  assert.equal(calendarRowHeight(844, 6), 72);
  assert.equal(calendarRowHeight(740, 6), 72);
  assert.equal(calendarRowHeight(667, 6), 59);
  assert.equal(calendarRowHeight(510, 6), 44);
});

test('扫码页从赠送与领取进入，并共用赠券回执确认', () => {
  const scan = read('../src/screens/ScanScreen.tsx');
  const gifts = read('../src/screens/GiftsScreen.tsx');
  const today = read('../src/screens/TodayScreen.tsx');
  const claim = read('../src/screens/GiftClaimFlow.tsx');
  assert.match(scan, /borderStyle: 'dashed'/);
  assert.match(scan, /'top-left', 'top-right', 'bottom-left', 'bottom-right'/);
  assert.match(gifts, /StackActions.push\('scan'\)/);
  assert.doesNotMatch(today, /StackActions.push\('scan'\)|扫码领取/);
  assert.match(scan, /claim.preview\(value\)/);
  assert.match(scan, /claim.preview\(\)/);
  assert.match(claim, /parseGiftReceipt\(raw\)/);
  assert.match(claim, /previewGift\(state, raw, new Date\(\)\)/);
  assert.match(claim, /receiveGift\(draft, incoming, new Date\(\)\)/);
  assert.match(claim, /recordGiftReceipt\(draft, incomingReceipt\)/);
});
