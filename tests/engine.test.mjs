import test from 'node:test';
import assert from 'node:assert/strict';
import { MILESTONE_ICONS, DEFAULT_MILESTONE_ICON, updateMilestoneIcon } from '../src/domain/engineCore.mjs';
import { createInitialState, dateKey, weekKey, getWeekStats, getTaskCount, checkIn, undoCheckIn, redeemTicket, useTicket, getTicketStatus, addTask, updateTask, archiveTask, restoreTask, deleteTask, updateSettings, configureWeightGoal, configureMilestoneGoal, addMilestoneGoal, updateMilestoneGoal, deleteMilestoneGoal, recordMilestoneValue, setMilestoneEnabled, recordWeight, disableWeightGoal, migrateState } from '../src/domain/engineCore.mjs';

test('里程碑可选独立图标，永久奖券保存对应图标且旧API使用默认图标', () => {
  const state = createInitialState();
  const first = addMilestoneGoal(state, { name: '阅读', unit: '页', startWeight: 0, step: 5, direction: 'increase', icon: '📖' }).goal;
  const second = addMilestoneGoal(state, { name: '跑步', unit: '公里', startWeight: 0, step: 1, direction: 'increase', icon: '🏃' }).goal;
  recordMilestoneValue(state, first.id, 10);
  recordMilestoneValue(state, second.id, 2);
  assert.deepEqual(state.tickets.map((ticket) => ticket.goalIcon), ['📖', '📖', '🏃', '🏃']);
  assert.equal(MILESTONE_ICONS.length, 48);
  assert.equal(new Set(MILESTONE_ICONS).size, 48);
  assert.ok(MILESTONE_ICONS.includes(DEFAULT_MILESTONE_ICON));
  const legacy = createInitialState();
  configureWeightGoal(legacy, 130);
  recordWeight(legacy, 129);
  assert.equal(legacy.weight.icon, DEFAULT_MILESTONE_ICON);
  assert.equal(legacy.tickets[0].goalIcon, DEFAULT_MILESTONE_ICON);
  assert.deepEqual(migrateState(JSON.parse(JSON.stringify(state))), state);
});

test('已记录目标更换图标同步历史券，不改变规则、备注、使用状态和其他目标', () => {
  const state = createInitialState();
  const rule = { name: '阅读', unit: '页', startWeight: 0, step: 5, direction: 'increase', icon: '📖' };
  const first = addMilestoneGoal(state, rule).goal;
  const second = addMilestoneGoal(state, { ...rule, icon: '🏃' }).goal;
  recordMilestoneValue(state, first.id, 10);
  recordMilestoneValue(state, second.id, 5);
  useTicket(state, state.tickets[0].id, new Date(), '喝杯奶茶');
  const before = JSON.parse(JSON.stringify(state));
  assert.equal(updateMilestoneIcon(state, first.id, '🎓').ok, true);
  const expected = JSON.parse(JSON.stringify(before));
  expected.weight.icon = '🎓';
  expected.tickets.filter((ticket) => ticket.goalId === first.id).forEach((ticket) => { ticket.goalIcon = '🎓'; });
  assert.deepEqual(state, expected);
  assert.equal(updateMilestoneGoal(state, first.id, { ...rule, icon: '⭐' }).ok, true);
  assert.deepEqual(state.tickets.filter((ticket) => ticket.goalId === first.id).map((ticket) => ticket.goalIcon), ['⭐', '⭐']);
  const locked = JSON.stringify(state);
  assert.equal(updateMilestoneGoal(state, first.id, { ...rule, step: 1, icon: '💧' }).ok, false);
  assert.equal(JSON.stringify(state), locked);
  assert.deepEqual(migrateState(JSON.parse(JSON.stringify(state))), state);
});

test('图标输入白名单严格验证，未知未配置已删除目标拒绝且操作原子', () => {
  const state = createInitialState();
  assert.equal(updateMilestoneIcon(state, state.weight.id, '📖').ok, false);
  const rule = { name: '阅读', unit: '页', startWeight: 0, step: 5, direction: 'increase' };
  const goal = addMilestoneGoal(state, rule).goal;
  for (const icon of ['', null, 1, {}, ['📖'], '<img src=x>', 'not-icon', ' 📖 ']) {
    const before = JSON.stringify(state);
    assert.equal(updateMilestoneIcon(state, goal.id, icon).ok, false);
    assert.equal(addMilestoneGoal(state, { ...rule, icon }).ok, false);
    assert.equal(updateMilestoneGoal(state, goal.id, { ...rule, icon }).ok, false);
    assert.equal(JSON.stringify(state), before);
  }
  assert.equal(updateMilestoneIcon(state, 'missing', '📖').ok, false);
  recordMilestoneValue(state, goal.id, 5);
  deleteMilestoneGoal(state, goal.id);
  const before = JSON.stringify(state);
  assert.equal(updateMilestoneIcon(state, goal.id, '⭐').ok, false);
  assert.equal(JSON.stringify(state), before);
  assert.equal(state.tickets[0].goalIcon, DEFAULT_MILESTONE_ICON);
  assert.deepEqual(migrateState(JSON.parse(before)), state);
});

test('旧存档缺图标保持原样可重载，新增图标后补齐券且拒绝损坏或串目标图标', () => {
  const state = createInitialState();
  const goal = addMilestoneGoal(state, { name: '阅读', unit: '页', startWeight: 0, step: 5, direction: 'increase' }).goal;
  recordMilestoneValue(state, goal.id, 5);
  delete goal.icon;
  delete state.tickets[0].goalIcon;
  assert.deepEqual(migrateState(JSON.parse(JSON.stringify(state))), state);
  assert.equal(updateMilestoneIcon(state, goal.id, '📖').ok, true);
  assert.equal(state.tickets[0].goalIcon, '📖');
  assert.deepEqual(migrateState(JSON.parse(JSON.stringify(state))), state);
  for (const change of [
    (copy) => { copy.weight.icon = ''; },
    (copy) => { copy.weight.icon = null; },
    (copy) => { copy.tickets[0].goalIcon = '<img>'; },
    (copy) => { copy.tickets[0].goalIcon = '🏃'; },
  ]) {
    const copy = JSON.parse(JSON.stringify(state));
    change(copy);
    const before = JSON.stringify(copy);
    assert.throws(() => migrateState(copy), /本地数据格式无效/);
    assert.equal(JSON.stringify(copy), before);
  }
  assert.equal(updateMilestoneGoal(state, goal.id, { name: '阅读', unit: '页', startWeight: 0, step: 5, direction: 'increase' }).ok, true);
  assert.equal(state.weight.icon, '📖');
});

const monday = new Date(2026, 9, 19, 10);
const water = 'task-1';
const fill = (state, now = monday, count = 3) => {
  assert.equal(updateTask(state, water, { target: count }).ok, true);
  for (let i = 0; i < count; i += 1) assert.equal(checkIn(state, water, now).ok, true);
};

test('初始真实零数据与每日任务目标', () => {
  const state = createInitialState(monday);
  assert.deepEqual(state.tasks.map((task) => [task.name, task.target, task.icon]), [['早睡', 1, '🌙'], ['运动', 1, '🏃']]);
  assert.equal(state.checkins.length, 0);
  assert.equal(state.tickets.length, 0);
  assert.equal(getWeekStats(state, monday).total, 0);
  fill(state);
  assert.equal(getTaskCount(state, water, monday), 3);
  assert.equal(checkIn(state, water, monday).ok, false);
  assert.equal(checkIn(state, water, new Date(2026, 9, 20)).ok, true);
});

test('本地日期和周一边界跨月跨年', () => {
  assert.equal(dateKey(new Date(2026, 9, 19, 0)), '2026-10-19');
  assert.equal(weekKey(new Date(2026, 9, 18, 23, 59)), '2026-10-12');
  assert.equal(weekKey(new Date(2026, 9, 19, 0)), '2026-10-19');
  assert.equal(weekKey(new Date(2027, 0, 1)), '2026-12-28');
});

test('合计各任务次数手动兑换且禁止超额兑换', () => {
  const state = createInitialState();
  assert.equal(redeemTicket(state, monday).ok, false);
  assert.equal(addTask(state, { name: '临时', target: 1 }).ok, true);
  checkIn(state, water, monday);
  checkIn(state, 'task-2', monday);
  checkIn(state, state.tasks.at(-1).id, monday);
  assert.equal(state.tickets.length, 0);
  const { ticket, ok } = redeemTicket(state, monday);
  assert.equal(ok, true);
  assert.equal(ticket.name, '快乐自由券');
  assert.equal(redeemTicket(state, monday).ok, false);
  const stats = getWeekStats(state, monday);
  assert.deepEqual([stats.total, stats.spent, stats.available, stats.redeemable, stats.remainder], [3, 3, 0, 0, 0]);
  assert.deepEqual(stats.days.map((day) => day.count), [3, 0, 0, 0, 0, 0, 0]);
  assert.equal(stats.days[6].date, '2026-10-25');
});

test('过期时间固定在下一周指定星期且到点即失效', () => {
  const state = createInitialState();
  updateSettings(state, { expiryDay: 4, expiryTime: '15:30' });
  const sunday = new Date(2026, 9, 25, 23, 59);
  fill(state, sunday);
  const { ticket } = redeemTicket(state, sunday);
  assert.equal(ticket.expiresAt, new Date(2026, 9, 29, 15, 30).toISOString());
  assert.equal(getTicketStatus(ticket, state, new Date(2026, 9, 29, 15, 29, 59)), 'available');
  assert.equal(getTicketStatus(ticket, state, new Date(2026, 9, 29, 15, 30)), 'expired');
  assert.equal(useTicket(state, ticket.id, new Date(2026, 9, 29, 15, 30)).ok, false);
  assert.equal(ticket.usedAt, null);
});

test('默认下周一过期，关闭后新券永久且不追溯修改已发券', () => {
  const state = createInitialState();
  fill(state);
  const oldTicket = redeemTicket(state, monday).ticket;
  const originalExpiry = oldTicket.expiresAt;
  assert.equal(originalExpiry, new Date(2026, 9, 26, 0).toISOString());
  updateSettings(state, { expiryEnabled: false });
  assert.equal(oldTicket.expiresAt, originalExpiry);
  fill(state, new Date(2026, 9, 20));
  const permanent = redeemTicket(state, new Date(2026, 9, 20)).ticket;
  assert.equal(permanent.expiresAt, null);
  updateSettings(state, { expiryEnabled: true });
  assert.equal(getTicketStatus(permanent, state, new Date(2030, 0, 1)), 'available');
});

test('奖券使用不可重复，已使用状态不因过期改变', () => {
  const state = createInitialState();
  fill(state);
  const { ticket } = redeemTicket(state, monday);
  assert.equal(useTicket(state, ticket.id, monday).ok, true);
  const usedAt = ticket.usedAt;
  assert.equal(useTicket(state, ticket.id, new Date(2026, 9, 20)).ok, false);
  assert.equal(ticket.usedAt, usedAt);
  assert.equal(getTicketStatus(ticket, state, new Date(2030, 0, 1)), 'used');
  assert.equal(useTicket(state, 'missing', monday).ok, false);
});

test('门槛改变按历史成本计账，不重复消费已兑换次数', () => {
  const state = createInitialState();
  fill(state);
  redeemTicket(state, monday);
  updateSettings(state, { threshold: 2 });
  assert.equal(redeemTicket(state, monday).ok, false);
  assert.equal(addTask(state, { name: '临时', target: 1 }).ok, true);
  checkIn(state, 'task-2', monday);
  checkIn(state, state.tasks.at(-1).id, monday);
  assert.equal(redeemTicket(state, monday).ok, true);
  assert.equal(getWeekStats(state, monday).spent, 5);
  updateSettings(state, { threshold: 1 });
  assert.equal(redeemTicket(state, monday).ok, false);
  assert.deepEqual(state.redemptions.map((entry) => entry.cost), [3, 2]);
});

test('撤销当天最后一次且保护已兑换成本', () => {
  const state = createInitialState();
  fill(state);
  const firstId = state.checkins[0].id;
  assert.equal(undoCheckIn(state, water, monday).ok, true);
  assert.equal(state.checkins.length, 2);
  assert.equal(state.checkins[0].id, firstId);
  checkIn(state, water, monday);
  redeemTicket(state, monday);
  assert.equal(undoCheckIn(state, water, monday).ok, false);
  checkIn(state, 'task-2', monday);
  assert.equal(undoCheckIn(state, water, monday).ok, true);
  assert.equal(undoCheckIn(state, water, monday).ok, false);
  assert.equal(undoCheckIn(state, water, new Date(2026, 9, 20)).ok, false);
});

test('删除任务与归档分离，历史打卡保留且不可恢复到列表', () => {
  const state = createInitialState();
  checkIn(state, water, monday);
  assert.equal(deleteTask(state, water).ok, true);
  assert.equal(state.tasks[0].deleted, true);
  assert.equal(state.tasks[0].archived, false);
  assert.equal(state.checkins.length, 1);
  assert.equal(getWeekStats(state, monday).total, 1);
  assert.equal(checkIn(state, water, monday).ok, false);
  assert.equal(archiveTask(state, water).ok, false);
  assert.equal(restoreTask(state, water).ok, false);
  assert.equal(updateTask(state, water, { name: '改名' }).ok, false);
  assert.equal(deleteTask(state, water).ok, false);
  assert.equal(deleteTask(state, 'missing').ok, false);
  const archived = state.tasks[1];
  assert.equal(archiveTask(state, archived.id).ok, true);
  assert.equal(deleteTask(state, archived.id).ok, true);
  assert.equal(archived.deleted, true);
  assert.equal(archived.archived, false);
  assert.equal(state.tasks.filter((task) => task.archived && !task.deleted).length, 0);
});

test('周统计重置，旧周次数不能兑换，新周撤销不受旧周消费影响', () => {
  const state = createInitialState();
  fill(state);
  redeemTicket(state, monday);
  const nextMonday = new Date(2026, 9, 26, 0);
  assert.equal(getWeekStats(state, nextMonday).total, 0);
  assert.equal(getWeekStats(state, nextMonday).spent, 0);
  assert.equal(redeemTicket(state, nextMonday).ok, false);
  checkIn(state, water, nextMonday);
  assert.equal(undoCheckIn(state, water, nextMonday).ok, true);
});

test('任务新增编辑归档、非法配置原子拒绝并保留历史', () => {
  const state = createInitialState();
  assert.equal(addTask(state, { name: ' 写日记 ', target: 2 }).ok, true);
  const task = state.tasks.at(-1);
  assert.equal(task.name, '写日记');
  assert.equal(updateTask(state, task.id, { target: 3 }).ok, true);
  assert.equal(updateTask(state, task.id, { target: 0 }).ok, false);
  assert.equal(task.target, 3);
  checkIn(state, task.id, monday);
  assert.equal(archiveTask(state, task.id).ok, true);
  assert.equal(checkIn(state, task.id, monday).ok, false);
  assert.equal(getWeekStats(state, monday).total, 1);
  assert.equal(addTask(state, { name: '', target: 1 }).ok, false);
  for (const input of [{ threshold: 0 }, { threshold: 1.5 }, { expiryDay: 8 }, { expiryTime: '24:00' }, { expiryEnabled: 'false' }, { rewardName: '' }]) {
    const before = JSON.stringify(state.settings);
    assert.equal(updateSettings(state, input).ok, false);
    assert.equal(JSON.stringify(state.settings), before);
  }
});

test('体重首次突破才发永久券，回升和同日反复记录均不会重复发券', () => {
  const state = createInitialState();
  assert.equal(state.version, 4);
  assert.deepEqual(state.weight, { id: 'legacy-weight', name: '体重', unit: '斤', direction: 'decrease', step: 1, enabled: false, startWeight: null, entries: [], unlockedMilestones: [] });
  assert.equal(configureWeightGoal(state, 130).ok, true);
  for (const [value, expected] of [[130, []], [129, [129]], [131, []], [130, []], [129, []], [128, [128]], [128, []]]) {
    const result = recordWeight(state, value, monday);
    assert.equal(result.ok, true);
    assert.deepEqual(result.milestones, expected);
  }
  assert.equal(state.weight.entries.length, 7);
  assert.deepEqual(state.weight.unlockedMilestones, [129, 128]);
  assert.equal(state.tickets.length, 2);
  assert.equal(state.redemptions.length, 0);
  assert.equal(getWeekStats(state, monday).total, 0);
  for (const ticket of state.tickets) {
    assert.equal(ticket.source, 'weight');
    assert.equal(ticket.expiresAt, null);
    assert.equal(ticket.usedAt, null);
  }
});

test('未到阈值不发券，跳过多个阈值逐个补发', () => {
  const state = createInitialState();
  configureWeightGoal(state, 130);
  assert.deepEqual(recordWeight(state, 129.5, monday).milestones, []);
  assert.deepEqual(recordWeight(state, 128.8, monday).milestones, [129]);
  assert.deepEqual(recordWeight(state, 127.5, monday).milestones, [128]);
  assert.deepEqual(recordWeight(state, 127, monday).milestones, [127]);
  const another = createInitialState();
  configureWeightGoal(another, 130);
  assert.deepEqual(recordWeight(another, 127.5, monday).milestones, [129, 128]);
});

test('小数起点每降低一斤解锁，十分之一刻度不误判边界', () => {
  const state = createInitialState();
  assert.equal(configureWeightGoal(state, '130.5').ok, true);
  assert.deepEqual(recordWeight(state, 129.6, monday).milestones, []);
  assert.deepEqual(recordWeight(state, 129.5, monday).milestones, [129.5]);
  assert.deepEqual(recordWeight(state, 127.5, monday).milestones, [128.5, 127.5]);
  const precision = createInitialState();
  assert.equal(configureWeightGoal(precision, 130.1).ok, true);
  assert.deepEqual(recordWeight(precision, 129.2, monday).milestones, []);
  assert.deepEqual(recordWeight(precision, 129.1, monday).milestones, [129.1]);
  assert.deepEqual(recordWeight(precision, 128.1, monday).milestones, [128.1]);
});

test('永久里程碑券跨周和过期设置调整后仍可用，使用后不补发', () => {
  const state = createInitialState();
  configureWeightGoal(state, 130);
  recordWeight(state, 129, monday);
  const ticket = state.tickets[0];
  updateSettings(state, { expiryEnabled: true, expiryDay: 7, expiryTime: '23:59' });
  assert.equal(getTicketStatus(ticket, state, new Date(2030, 0, 1)), 'available');
  assert.equal(useTicket(state, ticket.id, new Date(2030, 0, 1)).ok, true);
  assert.equal(useTicket(state, ticket.id, new Date(2030, 0, 1)).ok, false);
  assert.equal(getTicketStatus(ticket, state, new Date(2035, 0, 1)), 'used');
  recordWeight(state, 131, new Date(2030, 0, 2));
  assert.deepEqual(recordWeight(state, 129, new Date(2030, 0, 2)).milestones, []);
  assert.equal(state.tickets.length, 1);
});

test('体重起点不能重建刷券，暂停恢复保留历史与已使用状态', () => {
  const state = createInitialState();
  assert.equal(recordWeight(state, 129, monday).ok, false);
  configureWeightGoal(state, 130);
  recordWeight(state, 129, monday);
  useTicket(state, state.tickets[0].id, monday);
  const before = JSON.stringify(state);
  assert.equal(configureWeightGoal(state, 130).ok, false);
  assert.equal(configureWeightGoal(state, 140).ok, false);
  assert.equal(JSON.stringify(state), before);
  assert.equal(disableWeightGoal(state).ok, true);
  const paused = JSON.stringify(state);
  assert.equal(recordWeight(state, 128, monday).ok, false);
  assert.equal(configureWeightGoal(state, 140).ok, false);
  assert.equal(disableWeightGoal(state).ok, false);
  assert.equal(JSON.stringify(state), paused);
  assert.equal(configureWeightGoal(state, '130').ok, true);
  assert.equal(JSON.stringify(state), before);
  assert.deepEqual(recordWeight(state, 129, monday).milestones, []);
  assert.deepEqual(recordWeight(state, 128, monday).milestones, [128]);
});

test('非法体重输入原子拒绝，不将空白布尔空值或多位小数当有效值', () => {
  const invalid = ['', '   ', false, true, null, undefined, NaN, Infinity, -Infinity, 19.9, 400.1, 130.11, '130.00', '1e2', {}, [], 20.300000000000004];
  const state = createInitialState();
  for (const input of invalid) {
    const before = JSON.stringify(state);
    assert.equal(configureWeightGoal(state, input).ok, false, String(input));
    assert.equal(JSON.stringify(state), before);
  }
  configureWeightGoal(state, 130);
  for (const input of invalid.filter((value) => ![19.9, 400.1].includes(value))) {
    const before = JSON.stringify(state);
    assert.equal(recordWeight(state, input, monday).ok, false, String(input));
    assert.equal(JSON.stringify(state), before);
  }
  const before = JSON.stringify(state);
  assert.equal(recordWeight(state, 129, new Date('invalid')).ok, false);
  assert.equal(JSON.stringify(state), before);
  assert.equal(recordWeight(state, 20, monday).ok, true);
  assert.equal(recordWeight(state, 400, monday).ok, true);
  assert.equal(state.tickets.length, 110);
});

test('旧版数据无损迁移到v4，永久旧券与设置均保留，结果与原数据独立', () => {
  const legacy = createInitialState();
  legacy.version = 1;
  delete legacy.weight;
  fill(legacy);
  const first = redeemTicket(legacy, monday).ticket;
  useTicket(legacy, first.id, monday);
  updateSettings(legacy, { expiryEnabled: false });
  fill(legacy, new Date(2026, 9, 20));
  redeemTicket(legacy, new Date(2026, 9, 20));
  const original = JSON.stringify(legacy);
  const state = migrateState(legacy);
  assert.equal(state.version, 4);
  assert.deepEqual(state.weight, { id: 'legacy-weight', name: '体重', unit: '斤', direction: 'decrease', step: 1, enabled: false, startWeight: null, entries: [], unlockedMilestones: [] });
  for (const name of ['tasks', 'checkins', 'tickets', 'redemptions', 'settings']) assert.deepEqual(state[name], legacy[name]);
  assert.equal(JSON.stringify(legacy), original);
  state.tasks[0].name = '独立副本';
  assert.notEqual(state.tasks[0].name, legacy.tasks[0].name);
});

test('v3重新加载保留已解锁里程碑和用券状态，不重复发券', () => {
  const original = createInitialState();
  configureWeightGoal(original, 130.5);
  recordWeight(original, 128.5, monday);
  useTicket(original, original.tickets[0].id, monday);
  disableWeightGoal(original);
  const state = migrateState(JSON.parse(JSON.stringify(original)));
  assert.deepEqual(state, original);
  configureWeightGoal(state, 130.5);
  assert.deepEqual(recordWeight(state, 128.5, monday).milestones, []);
  assert.equal(state.tickets.length, 2);
  assert.equal(getTicketStatus(state.tickets[0], state, monday), 'used');
});

test('损坏或未来版存档拒绝加载，不能破坏永久券去重及渲染结构', () => {
  const base = createInitialState();
  configureWeightGoal(base, 130);
  recordWeight(base, 129, monday);
  const changes = [
    (state) => { state.version = 5; },
    (state) => { state.tasks = null; },
    (state) => { state.checkins = [{}]; },
    (state) => { state.settings.expiryTime = '25:00'; },
    (state) => { state.settings.threshold = true; },
    (state) => { state.tasks[0].target = true; },
    (state) => { state.tickets[0].expiresAt = monday.toISOString(); },
    (state) => { state.tickets[0].usedAt = 'bad date'; },
    (state) => { state.tickets[0].createdAt = null; },
    (state) => { state.weight.entries[0].date = '2026-02-30'; },
    (state) => { state.weight.unlockedMilestones = []; },
    (state) => { state.weight.unlockedMilestones = [129, 129]; },
    (state) => { state.weight.unlockedMilestones = [129.5]; },
    (state) => { state.weight.startWeight = null; },
    (state) => { state.weight.entries = null; },
    (state) => { state.redemptions = [{ id: 'bad', week: '2026-10-19', cost: 3, ticketId: 'missing' }]; },
    (state) => { state.redemptions = [{ id: 'bad', week: '2026-10-19', cost: 3, ticketId: state.tickets[0].id }]; },
  ];
  for (const change of changes) {
    const state = JSON.parse(JSON.stringify(base));
    change(state);
    const before = JSON.stringify(state);
    assert.throws(() => migrateState(state), /本地数据格式无效/);
    assert.equal(JSON.stringify(state), before);
  }
  for (const state of [null, [], {}, { version: 2 }]) assert.throws(() => migrateState(state));
});

test('递增目标每增加5个单位补发跨过的阈值，倒退和重录不重复', () => {
  const state = createInitialState();
  assert.equal(configureMilestoneGoal(state, { name: '阅读', unit: '页', startWeight: 0, direction: 'increase', step: 5 }).ok, true);
  assert.deepEqual(recordWeight(state, 4.9, monday).milestones, []);
  assert.deepEqual(recordWeight(state, 16, monday).milestones, [5, 10, 15]);
  useTicket(state, state.tickets[0].id, monday);
  for (const value of [0, 5, 15, 14]) assert.deepEqual(recordWeight(state, value, monday).milestones, []);
  assert.deepEqual(recordWeight(state, 20, monday).milestones, [20]);
  assert.deepEqual(state.weight.unlockedMilestones, [5, 10, 15, 20]);
  assert.equal(state.tickets[0].name, '阅读 · 5页里程碑奖券');
  assert.equal(state.tickets[0].goalName, '阅读');
  assert.equal(state.tickets[0].unit, '页');
  const reloaded = migrateState(state);
  assert.deepEqual(reloaded, state);
  assert.deepEqual(recordWeight(reloaded, 20, monday).milestones, []);
  assert.equal(getTicketStatus(reloaded.tickets[0], reloaded, monday), 'used');
});

test('递减目标支持0.1、0.5、2的自定义差值和小数起点', () => {
  for (const [startWeight, step, values, expected] of [
    [1.3, 0.1, [1.3, 1.2, 1], [[1.2], [1.1, 1]]],
    [130.5, 0.5, [130.1, 130, 128.5], [[130], [129.5, 129, 128.5]]],
    [130, 2, [129, 128, 124], [[128], [126, 124]]],
  ]) {
    const state = createInitialState();
    assert.equal(configureMilestoneGoal(state, { name: '体重', unit: '斤', startWeight, direction: 'decrease', step }).ok, true);
    assert.deepEqual(recordWeight(state, values[0], monday).milestones, []);
    assert.deepEqual(recordWeight(state, values[1], monday).milestones, expected[0]);
    assert.deepEqual(recordWeight(state, values[2], monday).milestones, expected[1]);
    assert.deepEqual(migrateState(state), state);
  }
});

test('递增0.1刻度精确跨越边界且0和最大值均可记录', () => {
  const state = createInitialState();
  configureMilestoneGoal(state, { name: '进度', unit: '格', startWeight: 999999.7, direction: 'increase', step: 0.1 });
  assert.deepEqual(recordWeight(state, 999999.8, monday).milestones, [999999.8]);
  assert.deepEqual(recordWeight(state, 1000000, monday).milestones, [999999.9, 1000000]);
  assert.deepEqual(recordWeight(state, 0, monday).milestones, []);
  assert.deepEqual(migrateState(state), state);
});

test('尚无记录可以编辑规则，有记录后全字段锁定且暂停恢复不重置', () => {
  const state = createInitialState();
  const rule = { name: '存钱', unit: '元', startWeight: 10, direction: 'increase', step: 2 };
  configureMilestoneGoal(state, rule);
  assert.equal(configureMilestoneGoal(state, { ...rule, startWeight: 20 }).ok, true);
  assert.equal(configureMilestoneGoal(state, rule).ok, true);
  recordWeight(state, 10, monday);
  for (const update of [{ name: '阅读' }, { unit: '页' }, { startWeight: 11 }, { direction: 'decrease' }, { step: 1 }]) {
    const before = JSON.stringify(state);
    assert.equal(configureMilestoneGoal(state, { ...rule, ...update }).ok, false);
    assert.equal(JSON.stringify(state), before);
  }
  disableWeightGoal(state);
  assert.equal(recordWeight(state, 14, monday).ok, false);
  assert.equal(configureMilestoneGoal(state, rule).ok, true);
  assert.deepEqual(recordWeight(state, 14, monday).milestones, [12, 14]);
  assert.equal(state.weight.entries.length, 2);
});

test('非法目标规则及记录原子拒绝，禁止零负差值和超范围值', () => {
  const state = createInitialState();
  const rule = { name: '进度', unit: '格', startWeight: 0, direction: 'increase', step: 1 };
  for (const update of [{ name: '' }, { name: 'a'.repeat(31) }, { unit: '' }, { unit: 'a'.repeat(9) }, { direction: 'up' }, { step: 0 }, { step: -1 }, { step: 0.01 }, { step: '1.00' }, { step: true }, { startWeight: -0.1 }, { startWeight: 1000000.1 }, { startWeight: null }]) {
    const before = JSON.stringify(state);
    assert.equal(configureMilestoneGoal(state, { ...rule, ...update }).ok, false);
    assert.equal(JSON.stringify(state), before);
  }
  configureMilestoneGoal(state, rule);
  for (const value of [-0.1, 1000000.1, 0.01, null, true, '', '1e2']) {
    const before = JSON.stringify(state);
    assert.equal(recordWeight(state, value, monday).ok, false);
    assert.equal(JSON.stringify(state), before);
  }
});

test('单次超大批量发券原子拒绝，10000张边界可发且可继续分段', () => {
  const state = createInitialState();
  configureMilestoneGoal(state, { name: '进度', unit: '格', startWeight: 0, direction: 'increase', step: 0.1 });
  const before = JSON.stringify(state);
  assert.equal(recordWeight(state, 1000.1, monday).ok, false);
  assert.equal(JSON.stringify(state), before);
  assert.equal(recordWeight(state, 1000, monday).milestones.length, 10000);
  assert.deepEqual(recordWeight(state, 1000.1, monday).milestones, [1000.1]);
  assert.equal(state.tickets.length, 10001);
});

test('v2体重档案迁移保留旧奖券名称使用状态和全部历史', () => {
  const original = createInitialState();
  configureWeightGoal(original, 130);
  recordWeight(original, 128, monday);
  useTicket(original, original.tickets[0].id, monday);
  original.version = 2;
  for (const key of ['name', 'unit', 'direction', 'step']) delete original.weight[key];
  original.tickets.forEach((ticket) => {
    ticket.name = `${ticket.milestone} 斤里程碑奖券`;
    delete ticket.goalName;
    delete ticket.unit;
  });
  const before = JSON.stringify(original);
  const state = migrateState(original);
  assert.equal(state.version, 4);
  assert.deepEqual(state.tickets, original.tickets);
  assert.deepEqual(state.weight.entries, original.weight.entries);
  assert.equal(JSON.stringify(original), before);
  assert.deepEqual(recordWeight(state, 128, monday).milestones, []);
  assert.deepEqual(recordWeight(state, 127, monday).milestones, [127]);
  assert.equal(getTicketStatus(state.tickets[0], state, monday), 'used');
});

test('v3拒绝损坏的方向、差值、阈值顺序、缺失券及伪造解锁记录', () => {
  const base = createInitialState();
  configureMilestoneGoal(base, { name: '阅读', unit: '页', startWeight: 0, direction: 'increase', step: 5 });
  recordWeight(base, 15, monday);
  for (const change of [
    (state) => { state.weight.direction = 'invalid'; },
    (state) => { state.weight.step = 0; },
    (state) => { state.weight.step = -1; },
    (state) => { state.weight.step = 0.01; },
    (state) => { state.weight.unlockedMilestones = [5, 15, 10]; },
    (state) => { state.weight.unlockedMilestones = [5, 10]; },
    (state) => { state.weight.entries[0].weight = 10; },
    (state) => { state.tickets.pop(); },
    (state) => { state.tickets[0].milestone = 6; },
    (state) => { state.tickets[0].goalName = '伪造'; },
    (state) => { state.tickets[0].unit = '斤'; },
  ]) {
    const state = JSON.parse(JSON.stringify(base));
    change(state);
    assert.throws(() => migrateState(state), /本地数据格式无效/);
  }
});

const readingRule = { name: '阅读', unit: '本', startWeight: 0, direction: 'increase', step: 5 };
const weightRule = { name: '减重', unit: '斤', startWeight: 130, direction: 'decrease', step: 1 };

test('普通券和永久里程碑券支持可选用途备注，去除首尾空白并保留换行', () => {
  const state = createInitialState();
  updateSettings(state, { threshold: 1 });
  checkIn(state, water, monday);
  const ordinary = redeemTicket(state, monday).ticket;
  configureWeightGoal(state, 130);
  recordWeight(state, 129, monday);
  const permanent = state.tickets.find((ticket) => ticket.source === 'weight');
  for (const ticket of [ordinary, permanent]) {
    assert.equal(useTicket(state, ticket.id, monday, '  买一杯奶茶\n庆祝坚持  ').ok, true);
    assert.equal(ticket.usageNote, '买一杯奶茶\n庆祝坚持');
    assert.equal(ticket.usedAt, monday.toISOString());
  }
  assert.deepEqual(migrateState(JSON.parse(JSON.stringify(state))), state);
});

test('使用备注可空及恰好200字符，旧调用和无备注历史均兼容', () => {
  for (const note of [undefined, '', '   \n ', '奖'.repeat(200)]) {
    const state = createInitialState();
    configureWeightGoal(state, 130);
    recordWeight(state, 129, monday);
    const ticket = state.tickets[0];
    assert.equal(useTicket(state, ticket.id, monday, note).ok, true);
    assert.equal(ticket.usageNote, (note ?? '').trim());
    assert.deepEqual(migrateState(JSON.parse(JSON.stringify(state))), state);
    delete ticket.usageNote;
    assert.deepEqual(migrateState(JSON.parse(JSON.stringify(state))), state);
  }
});

test('超长及非法备注原子拒绝，不消耗奖券或写入使用时间', () => {
  const state = createInitialState();
  configureWeightGoal(state, 130);
  recordWeight(state, 129, monday);
  for (const note of ['奖'.repeat(201), null, 123, {}, []]) {
    const before = JSON.stringify(state);
    assert.equal(useTicket(state, state.tickets[0].id, monday, note).ok, false);
    assert.equal(JSON.stringify(state), before);
  }
});

test('重复及过期奖券不能通过填写新备注消费或覆盖原备注', () => {
  const state = createInitialState();
  updateSettings(state, { threshold: 1 });
  assert.equal(updateTask(state, water, { target: 2 }).ok, true);
  assert.equal(checkIn(state, water, monday).ok, true);
  const firstRedemption = redeemTicket(state, monday);
  assert.equal(firstRedemption.ok, true);
  const used = firstRedemption.ticket;
  assert.equal(useTicket(state, used.id, monday, '第一次用途').ok, true);
  assert.equal(checkIn(state, water, monday).ok, true);
  const secondRedemption = redeemTicket(state, monday);
  assert.equal(secondRedemption.ok, true);
  const expired = secondRedemption.ticket;
  const before = JSON.stringify(state);
  assert.equal(useTicket(state, used.id, monday, '不能覆盖').ok, false);
  assert.equal(useTicket(state, expired.id, new Date(expired.expiresAt), '已过期').ok, false);
  assert.equal(useTicket(state, 'missing', monday, '不存在').ok, false);
  assert.equal(JSON.stringify(state), before);
});

test('备注重载拒绝非法类型超长及未使用券伪造用途，文本内容原样保留', () => {
  const base = createInitialState();
  configureWeightGoal(base, 130);
  recordWeight(base, 129, monday);
  useTicket(base, base.tickets[0].id, monday, '<script>用途 & 引用</script>');
  assert.deepEqual(migrateState(JSON.parse(JSON.stringify(base))), base);
  for (const change of [
    (ticket) => { ticket.usageNote = null; },
    (ticket) => { ticket.usageNote = 123; },
    (ticket) => { ticket.usageNote = '奖'.repeat(201); },
    (ticket) => { ticket.usageNote = ' 多余空白 '; },
    (ticket) => { ticket.usedAt = null; },
  ]) {
    const state = JSON.parse(JSON.stringify(base));
    change(state.tickets[0]);
    const before = JSON.stringify(state);
    assert.throws(() => migrateState(state), /本地数据格式无效/);
    assert.equal(JSON.stringify(state), before);
  }
});

test('新增入口首次配置主目标，其后添加独立递增递减目标而不覆写旧数据', () => {
  const state = createInitialState();
  const reading = addMilestoneGoal(state, readingRule).goal;
  assert.equal(reading.id, 'legacy-weight');
  assert.equal(state.milestoneGoals.length, 0);
  recordMilestoneValue(state, reading.id, 12, monday);
  const before = JSON.stringify(reading);
  const weight = addMilestoneGoal(state, weightRule).goal;
  assert.notEqual(weight.id, reading.id);
  assert.equal(state.milestoneGoals.length, 1);
  assert.equal(JSON.stringify(reading), before);
  assert.deepEqual(recordMilestoneValue(state, weight.id, 127, monday).milestones, [129, 128, 127]);
  assert.deepEqual(reading.unlockedMilestones, [5, 10]);
  assert.equal(state.tickets.filter((ticket) => ticket.goalId === reading.id).length, 2);
  assert.equal(state.tickets.filter((ticket) => ticket.goalId === weight.id).length, 3);
  assert.equal(state.tickets.every((ticket) => ticket.expiresAt === null), true);
});

test('暂停目标A不影响目标B，新目标相同阈值和名称也不会相互串券', () => {
  const state = createInitialState();
  const first = addMilestoneGoal(state, readingRule).goal;
  const second = addMilestoneGoal(state, readingRule).goal;
  assert.deepEqual(recordMilestoneValue(state, first.id, 5, monday).milestones, [5]);
  assert.deepEqual(recordMilestoneValue(state, second.id, 5, monday).milestones, [5]);
  assert.equal(setMilestoneEnabled(state, first.id, false).ok, true);
  const firstBefore = JSON.stringify(first);
  assert.equal(recordMilestoneValue(state, first.id, 10, monday).ok, false);
  assert.deepEqual(recordMilestoneValue(state, second.id, 10, monday).milestones, [10]);
  assert.equal(JSON.stringify(first), firstBefore);
  assert.equal(setMilestoneEnabled(state, first.id, true).ok, true);
  assert.deepEqual(recordMilestoneValue(state, first.id, 5, monday).milestones, []);
  assert.deepEqual(migrateState(JSON.parse(JSON.stringify(state))), state);
});

test('按id只更新指定未记录目标，锁定规则及非法操作均原子拒绝', () => {
  const state = createInitialState();
  const first = addMilestoneGoal(state, readingRule).goal;
  const second = addMilestoneGoal(state, weightRule).goal;
  const firstBefore = JSON.stringify(first);
  assert.equal(updateMilestoneGoal(state, second.id, { ...weightRule, name: '健康', step: 0.5 }).ok, true);
  assert.equal(second.name, '健康');
  assert.equal(JSON.stringify(first), firstBefore);
  recordMilestoneValue(state, second.id, 130, monday);
  for (const operation of [
    () => updateMilestoneGoal(state, second.id, weightRule),
    () => updateMilestoneGoal(state, 'missing', readingRule),
    () => recordMilestoneValue(state, 'missing', 10, monday),
    () => setMilestoneEnabled(state, 'missing', true),
    () => setMilestoneEnabled(state, second.id, 'false'),
    () => addMilestoneGoal(state, { ...readingRule, step: 0 }),
  ]) {
    const before = JSON.stringify(state);
    assert.equal(operation().ok, false);
    assert.equal(JSON.stringify(state), before);
  }
});

test('旧API继续只操作主目标，新增目标不因暂停主目标而被重置', () => {
  const state = createInitialState();
  configureWeightGoal(state, 130);
  const second = addMilestoneGoal(state, readingRule).goal;
  recordWeight(state, 129, monday);
  disableWeightGoal(state);
  assert.deepEqual(recordMilestoneValue(state, second.id, 10, monday).milestones, [5, 10]);
  const secondBefore = JSON.stringify(second);
  configureWeightGoal(state, 130);
  assert.deepEqual(recordWeight(state, 128, monday).milestones, [128]);
  assert.equal(JSON.stringify(second), secondBefore);
});

test('v4重载拒绝目标重复id、孤儿券、同目标重复阈值及缺失数组', () => {
  const base = createInitialState();
  const first = addMilestoneGoal(base, readingRule).goal;
  const second = addMilestoneGoal(base, readingRule).goal;
  recordMilestoneValue(base, first.id, 5, monday);
  recordMilestoneValue(base, second.id, 5, monday);
  for (const change of [
    (state) => { state.milestoneGoals[0].id = first.id; },
    (state) => { state.weight.id = 'other'; },
    (state) => { state.tickets[0].goalId = 'missing'; },
    (state) => { delete state.tickets[0].goalId; },
    (state) => { state.tickets[1].goalId = first.id; },
    (state) => { state.tickets.push({ ...state.tickets[0], id: 'duplicate-threshold' }); },
    (state) => { state.milestoneGoals = null; },
    (state) => { state.milestoneGoals[0].entries = []; },
    (state) => { state.milestoneGoals[0].startWeight = null; },
  ]) {
    const state = JSON.parse(JSON.stringify(base));
    change(state);
    const before = JSON.stringify(state);
    assert.throws(() => migrateState(state), /本地数据格式无效/);
    assert.equal(JSON.stringify(state), before);
  }
});

test('v3升级补全主目标外键，原奖券名称状态不变，新增目标重载后不重复奖励', () => {
  const legacy = createInitialState();
  configureWeightGoal(legacy, 130);
  recordWeight(legacy, 129, monday);
  useTicket(legacy, legacy.tickets[0].id, monday);
  legacy.version = 3;
  delete legacy.weight.id;
  delete legacy.milestoneGoals;
  delete legacy.tickets[0].goalId;
  const before = JSON.stringify(legacy);
  const migrated = migrateState(legacy);
  assert.equal(JSON.stringify(legacy), before);
  assert.deepEqual(migrated.tickets[0], { ...legacy.tickets[0], goalId: 'legacy-weight' });
  const extra = addMilestoneGoal(migrated, readingRule).goal;
  recordMilestoneValue(migrated, extra.id, 10, monday);
  const reloaded = migrateState(JSON.parse(JSON.stringify(migrated)));
  assert.deepEqual(reloaded, migrated);
  assert.deepEqual(recordMilestoneValue(reloaded, extra.id, 10, monday).milestones, []);
  assert.equal(reloaded.tickets.length, 3);
  reloaded.milestoneGoals[0].name = '独立副本';
  assert.equal(extra.name, '阅读');
});

test('额外目标保持数值精度和单次发券上限，拒绝时不影响其他目标', () => {
  const state = createInitialState();
  addMilestoneGoal(state, weightRule);
  const extra = addMilestoneGoal(state, { ...readingRule, step: 0.1 }).goal;
  for (const value of [0.01, true, null, 1000.1]) {
    const before = JSON.stringify(state);
    assert.equal(recordMilestoneValue(state, extra.id, value, monday).ok, false);
    assert.equal(JSON.stringify(state), before);
  }
  assert.deepEqual(recordMilestoneValue(state, extra.id, 0.3, monday).milestones, [0.1, 0.2, 0.3]);
  assert.equal(state.weight.entries.length, 0);
});

test('归档任务可恢复且保留历史打卡和设置，不允许恢复未知或活跃任务', () => {
  const state = createInitialState();
  assert.equal(updateTask(state, water, { target: 2 }).ok, true);
  checkIn(state, water, monday);
  archiveTask(state, water);
  const beforeHistory = JSON.stringify(state.checkins);
  const taskBefore = { ...state.tasks[0] };
  assert.equal(restoreTask(state, water).ok, true);
  assert.deepEqual(state.tasks[0], { ...taskBefore, archived: false });
  assert.equal(JSON.stringify(state.checkins), beforeHistory);
  assert.equal(getTaskCount(state, water, monday), 1);
  assert.equal(checkIn(state, water, monday).ok, true);
  for (const id of [water, 'missing']) {
    const before = JSON.stringify(state);
    assert.equal(restoreTask(state, id).ok, false);
    assert.equal(JSON.stringify(state), before);
  }
});

test('删除主目标保留打卡任务、已发奖券使用状态和用途备注，不影响其他目标', () => {
  const state = createInitialState();
  const first = addMilestoneGoal(state, weightRule).goal;
  const second = addMilestoneGoal(state, readingRule).goal;
  recordMilestoneValue(state, first.id, 128, monday);
  recordMilestoneValue(state, second.id, 10, monday);
  const used = state.tickets.find((ticket) => ticket.goalId === first.id);
  useTicket(state, used.id, monday, '奖励自己一杯咖啡');
  const ticketsBefore = JSON.stringify(state.tickets);
  const historyBefore = JSON.stringify(first.entries);
  const secondBefore = JSON.stringify(second);
  const tasksBefore = JSON.stringify(state.tasks);
  const result = deleteMilestoneGoal(state, first.id);
  assert.equal(result.ok, true);
  assert.equal(result.goal, first);
  assert.equal(first.deleted, true);
  assert.equal(first.enabled, false);
  assert.equal(JSON.stringify(state.tickets), ticketsBefore);
  assert.equal(JSON.stringify(first.entries), historyBefore);
  assert.equal(JSON.stringify(second), secondBefore);
  assert.equal(JSON.stringify(state.tasks), tasksBefore);
  assert.deepEqual(migrateState(JSON.parse(JSON.stringify(state))), state);
  const unused = state.tickets.find((ticket) => ticket.goalId === first.id && !ticket.usedAt);
  assert.equal(useTicket(state, unused.id, monday, '删除目标后依然可用').ok, true);
  assert.equal(used.usageNote, '奖励自己一杯咖啡');
});

test('删除额外目标保留递增或递减历史和奖券且不影响主目标继续奖励', () => {
  for (const rule of [readingRule, weightRule]) {
    const state = createInitialState();
    const main = addMilestoneGoal(state, readingRule).goal;
    const extra = addMilestoneGoal(state, rule).goal;
    recordMilestoneValue(state, extra.id, rule.direction === 'increase' ? 10 : 128, monday);
    const ticketsBefore = JSON.stringify(state.tickets);
    const extraBefore = JSON.parse(JSON.stringify(extra));
    assert.equal(deleteMilestoneGoal(state, extra.id).ok, true);
    assert.deepEqual(extra, { ...extraBefore, deleted: true, enabled: false });
    assert.equal(JSON.stringify(state.tickets), ticketsBefore);
    assert.deepEqual(recordMilestoneValue(state, main.id, 5, monday).milestones, [5]);
    assert.deepEqual(migrateState(JSON.parse(JSON.stringify(state))), state);
  }
});

test('无记录或仅起始记录的目标也能删除，不生成或删除任何奖券', () => {
  for (const recordStart of [false, true]) {
    const state = createInitialState();
    const main = addMilestoneGoal(state, readingRule).goal;
    const extra = addMilestoneGoal(state, weightRule).goal;
    if (recordStart) {
      recordMilestoneValue(state, main.id, 0, monday);
      recordMilestoneValue(state, extra.id, 130, monday);
    }
    for (const goal of [main, extra]) assert.equal(deleteMilestoneGoal(state, goal.id).ok, true);
    assert.equal(state.tickets.length, 0);
    assert.deepEqual(migrateState(JSON.parse(JSON.stringify(state))), state);
  }
});

test('删掉最后一个目标后重新新增相同规则使用新id，绝不串旧奖券', () => {
  const state = createInitialState();
  const original = addMilestoneGoal(state, weightRule).goal;
  recordMilestoneValue(state, original.id, 129, monday);
  const originalTicketId = state.tickets[0].id;
  deleteMilestoneGoal(state, original.id);
  const originalBefore = JSON.stringify(original);
  const replacement = addMilestoneGoal(state, weightRule).goal;
  assert.notEqual(replacement.id, original.id);
  assert.equal(replacement.deleted, undefined);
  assert.equal(replacement.enabled, true);
  assert.deepEqual(recordMilestoneValue(state, replacement.id, 129, monday).milestones, [129]);
  assert.equal(JSON.stringify(original), originalBefore);
  assert.deepEqual(state.tickets.map((ticket) => ticket.goalId), [original.id, replacement.id]);
  assert.equal(state.tickets[0].id, originalTicketId);
  deleteMilestoneGoal(state, replacement.id);
  const third = addMilestoneGoal(state, weightRule).goal;
  assert.equal(new Set([original.id, replacement.id, third.id]).size, 3);
  assert.deepEqual(migrateState(JSON.parse(JSON.stringify(state))), state);
});

test('删除未知、已删或未配置目标均原子拒绝，已删目标不能通过新旧API复活', () => {
  const state = createInitialState();
  for (const id of ['missing', state.weight.id, null, 123]) {
    const before = JSON.stringify(state);
    assert.equal(deleteMilestoneGoal(state, id).ok, false);
    assert.equal(JSON.stringify(state), before);
  }
  const main = addMilestoneGoal(state, weightRule).goal;
  const extra = addMilestoneGoal(state, readingRule).goal;
  deleteMilestoneGoal(state, main.id);
  deleteMilestoneGoal(state, extra.id);
  const operations = [
    () => configureWeightGoal(state, 130),
    () => configureMilestoneGoal(state, weightRule),
    () => recordWeight(state, 129, monday),
    () => disableWeightGoal(state),
    ...[main, extra].flatMap((goal) => [
      () => deleteMilestoneGoal(state, goal.id),
      () => updateMilestoneGoal(state, goal.id, weightRule),
      () => setMilestoneEnabled(state, goal.id, true),
      () => setMilestoneEnabled(state, goal.id, false),
      () => recordMilestoneValue(state, goal.id, 129, monday),
    ]),
  ];
  for (const operation of operations) {
    const before = JSON.stringify(state);
    assert.equal(operation().ok, false);
    assert.equal(JSON.stringify(state), before);
  }
});

test('重载兼容旧无deleted标记，支持显式false与删除态并严格拒绝损坏标记', () => {
  const base = createInitialState();
  addMilestoneGoal(base, weightRule);
  addMilestoneGoal(base, readingRule);
  assert.deepEqual(migrateState(JSON.parse(JSON.stringify(base))), base);
  base.weight.deleted = false;
  assert.deepEqual(migrateState(JSON.parse(JSON.stringify(base))), base);
  for (const change of [
    (state) => { state.weight.deleted = 'true'; },
    (state) => { state.weight.deleted = null; },
    (state) => { state.milestoneGoals[0].deleted = 0; },
    (state) => { state.milestoneGoals[0].deleted = true; },
    (state) => { state.weight.deleted = true; state.weight.enabled = false; state.weight.startWeight = null; },
  ]) {
    const state = JSON.parse(JSON.stringify(base));
    change(state);
    const before = JSON.stringify(state);
    assert.throws(() => migrateState(state), /本地数据格式无效/);
    assert.equal(JSON.stringify(state), before);
  }
  deleteMilestoneGoal(base, base.weight.id);
  deleteMilestoneGoal(base, base.milestoneGoals[0].id);
  assert.equal(base.version, 4);
  assert.deepEqual(migrateState(JSON.parse(JSON.stringify(base))), base);
});

