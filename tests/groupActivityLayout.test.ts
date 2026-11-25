import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// 源码结构回归不能替代界面交互或真机验证。
const today = readFileSync(
  new URL('../src/screens/TodayScreen.tsx', import.meta.url),
  'utf8',
);
const activity = readFileSync(
  new URL('../src/screens/GroupActivityView.tsx', import.meta.url),
  'utf8',
);

test('今日页分区切换保留原有任务、日期、兑换和成员区域', () => {
  assert.match(
    today,
    /<HistoryTabs[\s\S]*?testID="today-section"[\s\S]*?value=\{section\}/,
  );
  assert.match(today, /value: 'mine', label: '我的打卡'/);
  assert.match(today, /value: 'activity', label: '小组动态'/);
  assert.match(today, /section === 'activity' \? \(/);
  assert.match(today, /<GroupActivityView/);
  assert.match(today, /<FlatList/);
  assert.match(today, /testID="today-task-list"/);
  assert.match(today, /testID="task-checkin-button"/);
  assert.match(today, /testID="task-undo-button"/);
  assert.match(today, /testID="task-more-button"/);
  assert.match(today, /testID="redeem-ticket-button"/);
  assert.match(today, /testID="redeem-companion-button"/);
  assert.match(today, /testID="week-strip-day"/);
  assert.doesNotMatch(today, /<GroupViewSwitch/);
  assert.match(today, /section === 'activity' && state.groupLink/);
  assert.ok(
    today.indexOf('testID="redeem-companion-button"') <
      today.indexOf('<HistoryTabs'),
  );
  assert.ok(
    today.indexOf('<HistoryTabs') < today.indexOf('<GroupActivityView'),
  );
  assert.match(today, /data=\{section === 'mine' \? tasks : \[\]\}/);
  assert.doesNotMatch(activity, /<ScrollView/);
  assert.doesNotMatch(activity, /getWeekStats|getTicketStatus/);
});

test('小组动态支持当前周和历史周切换，并使用选中周统计', () => {
  assert.match(today, /key=\{weekKey\(selectedNow\)\}/);
  assert.match(today, /selectedNow=\{selectedNow\}/);
  assert.match(
    today,
    /shiftLocalDate\(\s*selectedDate,\s*previous \? -7 : 7,?\s*\)/,
  );
  assert.match(today, /changePickedDate\(null\)/);
  assert.match(activity, /getGroupActivity\([\s\S]*?selectedNow/);
  assert.match(
    today,
    /const disabled =\s*busy \|\|\s*\(previous\s*\? selectedDate === '0001-01-01'\s*:\s*!historicalWeek\)/,
  );
  assert.match(today, /disabled=\{disabled\}/);
  assert.match(today, /historicalWeek \? '所选周已兑' : '本周已兑'/);
});

test('小组动态说明同步、空态和打卡日期与操作时间', () => {
  assert.match(activity, /打卡足迹/);
  assert.match(activity, /尚未加入小组/);
  assert.match(activity, /暂无其他成员记录/);
  assert.match(activity, /同步后即可查看成员记录/);
  assert.match(activity, /最近一次同步/);
  assert.match(activity, /这一周还没有打卡记录/);
  assert.match(activity, /撤销的打卡不会显示/);
  assert.match(activity, /timelineDateLabel\(entry.date, now\)/);
  assert.match(activity, /补卡 · 操作于/);
  assert.match(activity, /recordedLabel/);
  assert.match(activity, /member\.count/);
  assert.match(activity, /rankingProgress\(member\.count/);
  assert.match(activity, /testID="ranking-progress-track"/);
  assert.match(activity, /其他成员数据以最近同步结果为准/);
});

test('排行榜名次与头像间隔12dp且名次按内容伸展', () => {
  assert.match(
    activity,
    /style=\{\[styles\.row, \{ gap: 12 \}\]\}[\s\S]*?\{member\.rank\}[\s\S]*?<ProfileAvatar avatar=\{member\.avatar\} size=\{32\} \/>/,
  );
  assert.doesNotMatch(
    activity,
    /(?:minWidth|width): (?:16|28), color: colors\.primary/,
  );
});

test('时间轴三列按日分组且同日节点之间连线', () => {
  assert.match(activity, /testID="timeline-date-heading"/);
  assert.match(
    activity,
    /testID="timeline-time"[\s\S]*?testID="timeline-axis"[\s\S]*?timelineStyles.card/,
  );
  assert.match(activity, /TIME_WIDTH = 38/);
  assert.match(activity, /AXIS_WIDTH = space\[16\]/);
  assert.match(activity, /DOT_TOP = 13/);
  assert.match(
    activity,
    /time: \{[\s\S]*?width: TIME_WIDTH,[\s\S]*?textAlign: 'right'/,
  );
  assert.match(activity, /!startsDay &&[\s\S]*?timelineStyles.lineAbove/);
  assert.match(activity, /continuesDay &&[\s\S]*?timelineStyles.lineBelow/);
  assert.match(
    activity,
    /index === 0 \|\| activity\.timeline\[index - 1\]\.date !== entry\.date/,
  );
  assert.match(
    activity,
    /activity\.timeline\[index \+ 1\]\?\.date === entry\.date/,
  );
  assert.match(activity, /index \+ 1 < visibleCount/);
  assert.match(
    activity,
    /entry\.dailyTaskCount > 1 &&[\s\S]*?当天第 \{entry\.sequence\} 次/,
  );
  assert.match(activity, /打卡了「/);
  assert.match(today, /now=\{now\}/);
  assert.doesNotMatch(today, /peerTasks\.map/);
  assert.match(today, /screen: 'member'/);
  assert.match(today, /点击成员查看最近同步的只读记录/);
  assert.match(
    today,
    /const peers = state.groupLink \? peerBoards\(state\) : \[\]/,
  );
  assert.match(today, /\(\) => setMode\('group'\)/);
  assert.match(today, /memberIntent\.current === intent/);
  assert.match(today, /memberContext\.current\.groupId === groupId/);
  assert.match(today, /disabled=\{viewBusy\}/);
});

test('时间轴分批展示且可加载剩余记录', () => {
  assert.match(activity, /useState\(30\)/);
  assert.match(activity, /activity\.timeline\.slice\(0, visibleCount\)/);
  assert.match(activity, /visibleCount < activity\.timeline\.length/);
  assert.match(activity, /setVisibleCount\(\(count\) => count \+ 30\)/);
  assert.match(activity, /查看更多/);
});
