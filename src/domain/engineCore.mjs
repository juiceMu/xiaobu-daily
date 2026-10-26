import { validateGiftState } from './giftCore.mjs';
import { ICON_KEYS } from './iconCatalog.mjs';
import { milestoneUnitError } from './milestoneUnit.mjs';
import { validateCompanionTicket, isTicketReserved } from './companionValidation.mjs';
const DAY_NAMES = ['早睡', '运动'];
let sequence = 0;
const makeId = (prefix) => `${prefix}-${Date.now().toString(36)}-${(++sequence).toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const success = (message, extra = {}) => ({ ok: true, message, ...extra });
const failure = (message) => ({ ok: false, message });
const asDate = (value) => new Date(value);
const isIntegerInRange = (value, max = 999) => !numericInputError(value, 'integer', 1, max);
const VALUE_MAX = 1000000;
const MAX_TICKETS_PER_ENTRY = 10000;
const DEFAULT_GOAL = { name: '体重', unit: '斤', direction: 'decrease', step: 1 };
const LEGACY_GOAL_ID = 'legacy-weight';
export const MILESTONE_ICONS = ICON_KEYS;
export const DEFAULT_MILESTONE_ICON = '🌱';
const validMilestoneIcon = (icon) => typeof icon === 'string' && MILESTONE_ICONS.includes(icon);
const isActiveTask = (task) => task && !task.deleted;

// 先校验原始词法再转数值，不能将指数、布尔或残缺小数静默转换成合法值。
export function numericInputError(input, kind, min, max) {
  const pattern = kind === 'integer' ? /^\d+$/ : /^\d+(?:\.\d)?$/;
  const format = kind === 'integer' ? '整数' : '数字，最多一位小数';
  if ((typeof input !== 'number' && typeof input !== 'string') || (typeof input === 'string' && !pattern.test(input.trim()))) return `请输入 ${min}–${max} 的${format}`;
  const value = Number(input);
  if (!Number.isFinite(value) || value < min || value > max || (kind === 'integer' ? !Number.isInteger(value) : Math.round(value * 10) / 10 !== value)) return `请输入 ${min}–${max} 的${format}`;
  return '';
}

function weightUnits(input) {
  if (numericInputError(input, 'decimal', 0, VALUE_MAX)) return null;
  const value = Number(input);
  const units = Math.round(value * 10);
  return Number.isFinite(value) && value >= 0 && value <= VALUE_MAX && units / 10 === value ? units : null;
}

export function dateKey(now = new Date()) {
  const date = asDate(now);
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function weekKey(now = new Date()) {
  const date = asDate(now);
  date.setDate(date.getDate() - (date.getDay() + 6) % 7);
  return dateKey(date);
}

export function createInitialState(now = new Date()) {
  return {
    version: 4,
    tasks: DAY_NAMES.map((name, index) => ({
      id: `task-${index + 1}`, name,
      icon: ['🌙', '🏃'][index],
      color: ['purple', 'green'][index],
      target: 1, archived: false,
    })),
    checkins: [], tickets: [], redemptions: [],
    weight: { id: LEGACY_GOAL_ID, ...DEFAULT_GOAL, enabled: false, startWeight: null, entries: [], unlockedMilestones: [] },
    milestoneGoals: [],
    settings: { threshold: 3, rewardName: '快乐自由券', expiryEnabled: true, expiryDay: 1, expiryTime: '00:00' },
  };
}

export function migrateState(saved) {
  const invalid = () => { throw new Error('本地数据格式无效，请保留原始数据后重试'); };
  const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
  const isText = (value) => typeof value === 'string' && value.trim().length > 0;
  const isTimestamp = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value));
  const isDateKey = (value) => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T12:00:00`);
    return Number.isFinite(date.getTime()) && dateKey(date) === value;
  };
  if (!isObject(saved) || ![1, 2, 3, 4].includes(saved.version)) invalid();
  let state;
  try { state = JSON.parse(JSON.stringify(saved)); } catch { invalid(); }
  for (const name of ['tasks', 'checkins', 'tickets', 'redemptions']) {
    if (!Array.isArray(state[name]) || state[name].some((entry) => !isObject(entry) || !isText(entry.id))) invalid();
    if (new Set(state[name].map((entry) => entry.id)).size !== state[name].length) invalid();
  }
  if (state.tasks.some((task) => validateTask(task) || typeof task.target !== 'number' || typeof task.archived !== 'boolean' || (task.deleted !== undefined && typeof task.deleted !== 'boolean'))) invalid();
  if (!isObject(state.settings) || typeof state.settings.threshold !== 'number' || typeof state.settings.expiryDay !== 'number' || !updateSettings({ settings: { ...state.settings } }, {}).ok) invalid();
  const taskIds = new Set(state.tasks.map((task) => task.id));
  const ticketIds = new Set(state.tickets.map((ticket) => ticket.id));
  if (state.checkins.some((entry) => !taskIds.has(entry.taskId) || !isDateKey(entry.date) || !isDateKey(entry.week) || weekKey(`${entry.date}T12:00:00`) !== entry.week || !isTimestamp(entry.createdAt))) invalid();
  if (state.tickets.some((ticket) => !isText(ticket.name) || !isTimestamp(ticket.createdAt) || !isDateKey(ticket.week) || weekKey(`${ticket.week}T12:00:00`) !== ticket.week || !(ticket.expiresAt === null || isTimestamp(ticket.expiresAt)) || !(ticket.usedAt === null || isTimestamp(ticket.usedAt)) || ![undefined, 'checkin', 'weight', 'gift', 'companion'].includes(ticket.source) || !validateCompanionTicket(ticket, state.sync?.accountId))) invalid();
  if (state.tickets.some((ticket) => ticket.source === 'companion' && !state.redemptions.some((entry) => entry.ticketId === ticket.id && entry.cost === 1))) invalid();
  if (new Set(state.tickets.flatMap((ticket) => (ticket.companionUses || []).map((entry) => entry.id))).size !== state.tickets.reduce((count, ticket) => count + (ticket.companionUses || []).length, 0)) invalid();
  if (!validateGiftState(state)) invalid();
  if (state.tickets.some((ticket) => ticket.usageNote !== undefined && (typeof ticket.usageNote !== 'string' || ticket.usageNote.length > 200 || ticket.usageNote !== ticket.usageNote.trim() || (!ticket.usedAt && ticket.usageNote !== '')))) invalid();
  if (state.redemptions.some((entry) => !ticketIds.has(entry.ticketId) || !isDateKey(entry.week) || !Number.isInteger(entry.cost) || entry.cost < 1)) invalid();
  if (new Set(state.redemptions.map((entry) => entry.ticketId)).size !== state.redemptions.length) invalid();
  if (state.redemptions.some((entry) => {
    const ticket = state.tickets.find((item) => item.id === entry.ticketId);
    return ticket.source === 'weight' || ticket.source === 'gift' || ticket.week !== entry.week;
  })) invalid();
  for (const week of new Set(state.redemptions.map((entry) => entry.week))) {
    const spent = state.redemptions.filter((entry) => entry.week === week).reduce((total, entry) => total + entry.cost, 0);
    if (spent > state.checkins.filter((entry) => entry.week === week).length) invalid();
  }
  if (state.version === 1) {
    if (state.tickets.some((ticket) => ticket.source === 'weight')) invalid();
    state.weight = { enabled: false, startWeight: null, entries: [], unlockedMilestones: [] };
  }
  if (state.version < 3) state.weight = { ...state.weight, ...DEFAULT_GOAL };
  if (state.version < 4) {
    state.weight = { ...state.weight, id: LEGACY_GOAL_ID };
    state.milestoneGoals = [];
    for (const ticket of state.tickets) {
      if (ticket.source === 'weight') ticket.goalId = LEGACY_GOAL_ID;
    }
  }
  state.version = 4;
  if (!isObject(state.weight) || state.weight.id !== LEGACY_GOAL_ID || !Array.isArray(state.milestoneGoals)) invalid();
  const goals = [state.weight, ...state.milestoneGoals];
  if (goals.some((goal) => !isObject(goal) || !isText(goal.id)) || new Set(goals.map((goal) => goal.id)).size !== goals.length) invalid();
  const goalIds = new Set(goals.map((goal) => goal.id));
  if (state.tickets.some((ticket) => ticket.source === 'weight' && !goalIds.has(ticket.goalId))) invalid();
  for (const weight of goals) {
    if (!isObject(weight) || typeof weight.enabled !== 'boolean' || !Array.isArray(weight.entries) || !Array.isArray(weight.unlockedMilestones)) invalid();
    if (weight.icon !== undefined && !validMilestoneIcon(weight.icon)) invalid();
    if (weight.deleted !== undefined && typeof weight.deleted !== 'boolean') invalid();
    if (weight.archived !== undefined && typeof weight.archived !== 'boolean') invalid();
    if (weight.deleted && (weight.enabled || weight.startWeight === null)) invalid();
    if (typeof weight.name !== 'string' || !weight.name.trim() || weight.name.length > 30 || typeof weight.unit !== 'string' || !weight.unit.trim() || weight.unit.length > 8 || !['increase', 'decrease'].includes(weight.direction) || typeof weight.step !== 'number' || weightUnits(weight.step) === null || weight.step <= 0) invalid();
    const startUnits = weight.startWeight === null ? null : weightUnits(weight.startWeight);
    if (weight.startWeight !== null && (typeof weight.startWeight !== 'number' || startUnits === null)) invalid();
    if (startUnits === null && (weight.enabled || weight.archived || weight.entries.length || weight.unlockedMilestones.length)) invalid();
    if (weight !== state.weight && startUnits === null) invalid();
    if (weight.entries.some((entry) => !isObject(entry) || !isText(entry.id) || typeof entry.weight !== 'number' || weightUnits(entry.weight) === null || !isDateKey(entry.date) || !isTimestamp(entry.createdAt))) invalid();
    if (new Set(weight.entries.map((entry) => entry.id)).size !== weight.entries.length) invalid();
    const milestoneUnits = weight.unlockedMilestones.map((milestone) => typeof milestone === 'number' ? weightUnits(milestone) : null);
    const sign = weight.direction === 'increase' ? 1 : -1;
    const stepUnits = weightUnits(weight.step);
    if (milestoneUnits.some((units, index) => units === null || startUnits === null || units !== startUnits + sign * (index + 1) * stepUnits)) invalid();
    const reached = weight.entries.reduce((best, entry) => Math.max(best, sign * (weightUnits(entry.weight) - startUnits)), 0);
    if (milestoneUnits.length !== Math.floor(reached / stepUnits)) invalid();
    const weightTickets = state.tickets.filter((ticket) => ticket.source === 'weight' && ticket.goalId === weight.id);
    if (weightTickets.some((ticket) => ticket.goalIcon !== undefined && (!validMilestoneIcon(ticket.goalIcon) || ticket.goalIcon !== (weight.icon || DEFAULT_MILESTONE_ICON)))) invalid();
    if (weightTickets.length !== milestoneUnits.length || weightTickets.some((ticket) => ticket.expiresAt !== null || typeof ticket.milestone !== 'number' || !weight.unlockedMilestones.includes(ticket.milestone) || (ticket.goalName !== undefined && ticket.goalName !== weight.name) || (ticket.unit !== undefined && ticket.unit !== weight.unit))) invalid();
    if (new Set(weightTickets.map((ticket) => ticket.milestone)).size !== weightTickets.length) invalid();
  }
  return state;
}

export function getTaskCount(state, taskId, now = new Date()) {
  return state.checkins.filter((entry) => entry.taskId === taskId && entry.date === dateKey(now)).length;
}

export function getWeekStats(state, now = new Date()) {
  const week = weekKey(now);
  const entries = state.checkins.filter((entry) => entry.week === week);
  const total = entries.length;
  const spent = state.redemptions.filter((entry) => entry.week === week).reduce((sum, entry) => sum + entry.cost, 0);
  const available = Math.max(0, total - spent);
  const threshold = state.settings.threshold;
  const start = asDate(now);
  start.setDate(start.getDate() - (start.getDay() + 6) % 7);
  const days = Array.from({ length: 7 }, (_, index) => {
    const day = asDate(start);
    day.setDate(day.getDate() + index);
    const date = dateKey(day);
    return { date, count: entries.filter((entry) => entry.date === date).length };
  });
  return { total, spent, available, redeemable: Math.floor(available / threshold), remainder: available % threshold, days };
}

function occurrenceDate(now, requested) {
  if (!Number.isFinite(asDate(now).getTime())) return null;
  const key = requested === undefined ? dateKey(now) : requested;
  if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key) || key < '0001-01-01') return null;
  const date = new Date(`${key}T12:00:00`);
  return Number.isFinite(date.getTime()) && dateKey(date) === key && key <= dateKey(now) ? date : null;
}

export function checkIn(state, taskId, now = new Date(), occurredDate) {
  const selected = occurrenceDate(now, occurredDate);
  if (!selected) return failure('请选择有效的今天或过去日期，不能提前打卡');
  const historical = dateKey(selected) < dateKey(now);
  const task = state.tasks.find((entry) => entry.id === taskId && isActiveTask(entry) && (!entry.archived || historical));
  if (!task) return failure('任务不存在、已删除或已归档');
  if (getTaskCount(state, taskId, selected) >= task.target) return failure('所选日期的打卡目标已完成');
  state.checkins.push({ id: makeId('checkin'), taskId, date: dateKey(selected), week: weekKey(selected), createdAt: asDate(now).toISOString() });
  return success(historical ? '补卡成功，记录已计入发生日期所在周' : '打卡成功，继续加油！');
}

export function undoCheckIn(state, taskId, now = new Date(), occurredDate) {
  const selected = occurrenceDate(now, occurredDate);
  if (!selected) return failure('请选择有效的今天或过去日期');
  const date = dateKey(selected);
  const index = state.checkins.findLastIndex((entry) => entry.taskId === taskId && entry.date === date);
  if (index < 0) return failure('所选日期还没有可撤销的打卡');
  const stats = getWeekStats(state, selected);
  if (stats.total - 1 < stats.spent) return failure('这次打卡已用于兑换奖券，无法撤销');
  state.checkins.splice(index, 1);
  return success('已撤销所选日期最近一次打卡');
}

function getExpiry(settings, now) {
  if (!settings.expiryEnabled) return null;
  const date = asDate(now);
  date.setDate(date.getDate() - (date.getDay() + 6) % 7 + 7 + settings.expiryDay - 1);
  const [hours, minutes] = settings.expiryTime.split(':').map(Number);
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
}

export function redeemTicket(state, now = new Date(), occurredDate) {
  const selected = occurrenceDate(now, occurredDate);
  if (!selected || weekKey(selected) !== weekKey(now)) return failure('历史周补卡只保留记录，不兑换或结转本周奖券');
  const cost = state.settings.threshold;
  if (getWeekStats(state, now).available < cost) return failure('本周可兑换的打卡次数还不够');
  const ticket = {
    id: makeId('ticket'), name: state.settings.rewardName, createdAt: asDate(now).toISOString(),
    week: weekKey(now), expiresAt: getExpiry(state.settings, now), usedAt: null,
  };
  state.tickets.push(ticket);
  state.redemptions.push({ id: makeId('redemption'), week: ticket.week, cost, ticketId: ticket.id });
  return success('兑换成功，收好你的奖券！', { ticket });
}

export function redeemCompanionTicket(state, now = new Date(), occurredDate) {
  const selected = occurrenceDate(now, occurredDate);
  if (!selected || weekKey(selected) !== weekKey(now)) return failure('历史周打卡不能兑换同行券');
  if (getWeekStats(state, now).available < 1) return failure('本周还没有可兑换的打卡次数');
  const ticket = { id: makeId('ticket'), name: '同行券', createdAt: asDate(now).toISOString(), week: weekKey(now), expiresAt: getExpiry(state.settings, now), usedAt: null, source: 'companion' };
  state.tickets.push(ticket);
  state.redemptions.push({ id: makeId('redemption'), week: ticket.week, cost: 1, ticketId: ticket.id });
  return success('已兑换同行券，需要和另一人的奖券一起使用', { ticket });
}

export function getTicketStatus(ticket, state, now = new Date()) {
  if (ticket.usedAt) return 'used';
  if (ticket.expiresAt && asDate(now).getTime() >= asDate(ticket.expiresAt).getTime()) return 'expired';
  return 'available';
}

export function useTicket(state, ticketId, now = new Date(), note = '') {
  const ticket = state.tickets.find((entry) => entry.id === ticketId);
  if (!ticket) return failure('奖券不存在');
  if (ticket.source === 'companion') return failure('同行券不能单独使用，请找伙伴一起用');
  if (isTicketReserved(ticket)) return failure('这张券有待处理的同行记录，请先完成或取消');
  const status = getTicketStatus(ticket, state, now);
  if (status === 'used') return failure('这张奖券已经使用过了');
  if (status === 'expired') return failure('这张奖券已过期');
  if (typeof note !== 'string' || note.trim().length > 200) return failure('使用备注最多填写 200 个字符');
  ticket.usedAt = asDate(now).toISOString();
  ticket.usageNote = note.trim();
  return success('奖券已使用，享受奖励吧！', { ticket });
}

export function configureWeightGoal(state, startWeight, now = new Date()) {
  if (state.weight?.deleted) return failure('里程碑已删除，不能重新设置或恢复');
  if (state.weight?.archived) return failure('里程碑已归档，请先恢复后再操作');
  const units = weightUnits(startWeight);
  if (units === null || units < 200 || units > 4000) return failure('起始体重请输入 20–400 斤，最多一位小数');
  const value = units / 10;
  if (state.weight?.startWeight !== null && state.weight?.startWeight !== undefined) {
    if (state.weight.startWeight !== value) return failure('起始体重已固定，不能修改或重置已解锁里程碑');
    if (state.weight.enabled) return failure('体重目标已设置，无需重复设置');
    return configureMilestoneGoal(state, { ...state.weight, startWeight: value });
  }
  return configureMilestoneGoal(state, { ...DEFAULT_GOAL, startWeight: value });
}

export function configureMilestoneGoal(state, input) {
  return saveMilestoneGoal(state, state.weight, input);
}

function saveMilestoneGoal(state, current, input) {
  if (current?.deleted) return failure('里程碑已删除，不能修改或恢复');
  if (current?.archived) return failure('里程碑已归档，请先恢复后再操作');
  if (!input || typeof input !== 'object') return failure('里程碑设置无效');
  if (typeof input.name !== 'string' || !input.name.trim() || input.name.trim().length > 30) return failure('目标名称请填写 1–30 个字符');
  const unitError = milestoneUnitError(input.unit);
  if (unitError) return failure(unitError);
  if (!['increase', 'decrease'].includes(input.direction)) return failure('请选择递增或递减解锁');
  const icon = input.icon === undefined ? current?.icon || DEFAULT_MILESTONE_ICON : input.icon;
  if (!validMilestoneIcon(icon)) return failure('请选择一个有效的里程碑图标');
  const startUnits = weightUnits(input.startWeight);
  const stepUnits = weightUnits(input.step);
  if (startUnits === null) return failure('起始值请输入 0–1000000，最多一位小数');
  if (stepUnits === null || stepUnits < 1) return failure('解锁差值请输入 0.1–1000000，最多一位小数');
  const next = { name: input.name.trim(), unit: input.unit.trim(), direction: input.direction, startWeight: startUnits / 10, step: stepUnits / 10 };
  const changed = Object.keys(next).some((key) => next[key] !== current?.[key]);
  if (changed && (current?.entries.length || current?.unlockedMilestones.length)) return failure('已有记录后不能修改目标规则，避免重复解锁奖券；暂停和恢复会保留原规则');
  Object.assign(current, next, { enabled: true });
  applyMilestoneIcon(state, current, icon);
  return success(changed ? '里程碑规则已保存，达到新里程碑即可获得永久奖券' : '目标已恢复，原规则和解锁记录保持不变', { goal: current });
}

function findMilestoneGoal(state, id) {
  if (state.weight?.id === id) return state.weight;
  return state.milestoneGoals?.find((goal) => goal.id === id);
}

export function addMilestoneGoal(state, input) {
  if (state.weight.startWeight === null && !state.weight.deleted) return configureMilestoneGoal(state, input);
  const goal = { id: makeId('goal'), enabled: false, startWeight: null, entries: [], unlockedMilestones: [] };
  const result = saveMilestoneGoal(state, goal, input);
  if (!result.ok) return result;
  state.milestoneGoals.push(goal);
  return success('新里程碑已添加，可独立记录和解锁永久奖券', { goal });
}

export function updateMilestoneGoal(state, id, input) {
  const goal = findMilestoneGoal(state, id);
  if (!goal) return failure('里程碑不存在');
  return saveMilestoneGoal(state, goal, input);
}

function applyMilestoneIcon(state, goal, icon) {
  goal.icon = icon;
  for (const ticket of state.tickets) {
    if (ticket.source === 'weight' && ticket.goalId === goal.id) ticket.goalIcon = icon;
  }
}

export function updateMilestoneIcon(state, id, icon) {
  const goal = findMilestoneGoal(state, id);
  if (!goal || goal.deleted || goal.startWeight === null) return failure('里程碑不存在、已删除或尚未配置');
  if (goal.archived) return failure('里程碑已归档，请先恢复后再操作');
  if (!validMilestoneIcon(icon)) return failure('请选择一个有效的里程碑图标');
  // 图标仅影响辨识，不改动规则、记录、奖券用途或已解锁进度。
  applyMilestoneIcon(state, goal, icon);
  return success('图标已更新，已有里程碑奖券也同步换好了', { goal });
}

export function deleteMilestoneGoal(state, id) {
  const goal = findMilestoneGoal(state, id);
  if (!goal || goal.deleted || goal.startWeight === null) return failure('里程碑不存在、已删除或尚未配置');
  // 保留已发奖券的目标引用和历史记录，避免删除后串券或丢失用途备注。
  Object.assign(goal, { deleted: true, enabled: false });
  return success('里程碑已删除，已获得的奖券和使用备注仍会保留', { goal });
}

export function archiveMilestoneGoal(state, id) {
  const goal = findMilestoneGoal(state, id);
  if (!goal || goal.deleted || goal.startWeight === null) return failure('里程碑不存在、已删除或尚未配置');
  if (goal.archived) return failure('里程碑已经归档');
  // 归档独立于暂停，恢复时保持原启用状态及所有首达记录。
  goal.archived = true;
  return success('里程碑已归档，记录和奖券保留，恢复后延续原状态', { goal });
}

export function restoreMilestoneGoal(state, id) {
  const goal = findMilestoneGoal(state, id);
  if (!goal || goal.deleted || goal.startWeight === null) return failure('里程碑不存在、已删除或尚未配置');
  if (!goal.archived) return failure('里程碑尚未归档');
  goal.archived = false;
  return success(goal.enabled ? '里程碑已恢复，继续记录即可解锁新奖券' : '里程碑已恢复，仍保持暂停状态', { goal });
}

export function setMilestoneEnabled(state, id, enabled) {
  const goal = findMilestoneGoal(state, id);
  if (!goal || goal.deleted || goal.startWeight === null) return failure('里程碑不存在、已删除或尚未配置');
  if (goal.archived) return failure('里程碑已归档，请先恢复后再操作');
  if (typeof enabled !== 'boolean') return failure('目标状态无效');
  if (goal.enabled === enabled) return failure(enabled ? '里程碑目标已经启用' : '里程碑目标已经暂停');
  goal.enabled = enabled;
  return success(enabled ? '目标已恢复，原规则和解锁记录保持不变' : '已暂停目标，历史记录和里程碑奖券会保留', { goal });
}

export function recordWeight(state, weightValue, now = new Date()) {
  return recordMilestoneValue(state, state.weight.id, weightValue, now);
}

export function recordMilestoneValue(state, id, weightValue, now = new Date()) {
  const goal = findMilestoneGoal(state, id);
  if (!goal || goal.deleted) return failure('里程碑不存在或已删除');
  if (goal.archived) return failure('里程碑已归档，请先恢复后再操作');
  const unitError = milestoneUnitError(goal.unit);
  if (unitError) return failure(unitError);
  if (!goal.enabled || goal.startWeight === null || weightUnits(goal.startWeight) === null) return failure('请先设置或恢复里程碑目标');
  const units = weightUnits(weightValue);
  if (units === null) return failure('记录值请输入 0–1000000，最多一位小数');
  if (!Number.isFinite(asDate(now).getTime())) return failure('记录时间无效');
  const stepUnits = weightUnits(goal.step);
  if (stepUnits === null || stepUnits < 1 || !['increase', 'decrease'].includes(goal.direction)) return failure('里程碑规则无效');
  const sign = goal.direction === 'increase' ? 1 : -1;
  const startUnits = weightUnits(goal.startWeight);
  const reachedCount = Math.max(0, Math.floor(sign * (units - startUnits) / stepUnits));
  const newCount = Math.max(0, reachedCount - goal.unlockedMilestones.length);
  if (newCount > MAX_TICKETS_PER_ENTRY) return failure('单次最多解锁 10000 张奖券，请调大解锁差值或分段记录');
  const value = units / 10;
  const date = dateKey(now);
  const newMilestones = [];
  // 使用十分之一的整数刻度，按进展顺序补发跨过的首次阈值，避免浮点误差。
  for (let index = goal.unlockedMilestones.length + 1; index <= reachedCount; index += 1) {
    newMilestones.push((startUnits + sign * index * stepUnits) / 10);
  }
  goal.entries.push({ id: makeId('weight'), date, weight: value, createdAt: asDate(now).toISOString() });
  for (const milestone of newMilestones) {
    goal.unlockedMilestones.push(milestone);
    state.tickets.push({ id: makeId('ticket'), name: `${goal.name} · ${milestone}${goal.unit}里程碑奖券`, createdAt: asDate(now).toISOString(), week: weekKey(now), expiresAt: null, usedAt: null, source: 'weight', milestone, goalId: goal.id, goalName: goal.name, unit: goal.unit, goalIcon: goal.icon || DEFAULT_MILESTONE_ICON });
  }
  return success(newMilestones.length ? `记录成功，解锁 ${newMilestones.length} 张永久奖券！` : `${goal.name}已记录，尚未达到新的里程碑`, { milestones: newMilestones });
}

export function disableWeightGoal(state) {
  if (state.weight?.deleted) return failure('里程碑已删除');
  if (state.weight?.archived) return failure('里程碑已归档，请先恢复后再操作');
  if (!state.weight?.enabled) return failure('里程碑目标已经暂停');
  state.weight.enabled = false;
  return success('已暂停目标，历史记录和里程碑奖券会保留');
}

function validateTask(input) {
  if (typeof input.name !== 'string' || !input.name.trim() || input.name.trim().length > 30) return '任务名称请填写 1–30 个字符';
  if (!isIntegerInRange(input.target, 99)) return '每日次数请填写 1–99 的整数';
  if (typeof input.icon !== 'string' || !input.icon.trim() || input.icon.length > 16) return '请选择一个有效图标';
  if (typeof input.color !== 'string' || !input.color.trim() || input.color.length > 30) return '请选择有效颜色';
  return null;
}

export function addTask(state, input) {
  const task = { name: input.name, target: input.target, icon: input.icon ?? '🌱', color: input.color ?? 'green' };
  const error = validateTask(task);
  if (error) return failure(error);
  state.tasks.push({ ...task, name: task.name.trim(), target: Number(task.target), id: makeId('task'), archived: false });
  return success('新任务已添加');
}

export function updateTask(state, id, input) {
  const task = state.tasks.find((entry) => entry.id === id && isActiveTask(entry) && !entry.archived);
  if (!task) return failure('任务不存在、已删除或已归档');
  const next = { name: input.name ?? task.name, target: Object.hasOwn(input, 'target') ? input.target : task.target, icon: input.icon ?? task.icon, color: input.color ?? task.color };
  const error = validateTask(next);
  if (error) return failure(error);
  Object.assign(task, next, { name: next.name.trim(), target: Number(next.target) });
  return success('任务设置已保存');
}

export function archiveTask(state, id) {
  const task = state.tasks.find((entry) => entry.id === id && isActiveTask(entry) && !entry.archived);
  if (!task) return failure('任务不存在、已删除或已归档');
  task.archived = true;
  return success('任务已归档，历史打卡已保留');
}

export function restoreTask(state, id) {
  const task = state.tasks.find((entry) => entry.id === id && isActiveTask(entry) && entry.archived);
  if (!task) return failure('已归档任务不存在或已删除');
  task.archived = false;
  return success('任务已恢复，历史打卡保持不变');
}

export function deleteTask(state, id) {
  const task = state.tasks.find((entry) => entry.id === id && isActiveTask(entry));
  if (!task) return failure('任务不存在或已删除');
  // 删除与归档分离：墓碑保留打卡引用，且不会出现在归档列表。
  Object.assign(task, { deleted: true, archived: false });
  return success('任务已删除，历史打卡仍计入统计，不会出现在归档');
}

export function updateSettings(state, input) {
  const next = { ...state.settings };
  for (const key of ['threshold', 'rewardName', 'expiryEnabled', 'expiryDay', 'expiryTime']) {
    if (Object.hasOwn(input, key)) next[key] = input[key];
  }
  if (!isIntegerInRange(next.threshold)) return failure('兑换门槛请填写 1–999 的整数');
  if (typeof next.rewardName !== 'string' || !next.rewardName.trim() || next.rewardName.trim().length > 30) return failure('奖券名称请填写 1–30 个字符');
  if (typeof next.expiryEnabled !== 'boolean') return failure('过期选项无效');
  if (!isIntegerInRange(next.expiryDay, 7)) return failure('请选择周一至周日');
  if (typeof next.expiryTime !== 'string' || !/^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(next.expiryTime)) return failure('请输入有效的过期时间');
  Object.assign(state.settings, next, { threshold: Number(next.threshold), expiryDay: Number(next.expiryDay), rewardName: next.rewardName.trim() });
  return success('奖励规则已保存，已发奖券保持原有效期');
}

