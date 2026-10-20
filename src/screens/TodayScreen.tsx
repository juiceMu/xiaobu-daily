import React, { useState } from 'react';
import { FlatList, Platform, Pressable, View } from 'react-native';
import { Icon, IconButton, Menu, ProgressBar, Text } from 'react-native-paper';
import { AppTextInput as TextInput } from '../ui/AppTextInput';
import { useKeyboardFocus } from '../ui/useKeyboardFocus';
import {
  addTask,
  archiveTask,
  checkIn,
  dateKey,
  getTaskCount,
  getWeekStats,
  getTicketStatus,
  redeemTicket,
  undoCheckIn,
  updateTask,
  weekKey,
} from '../domain/engine';
import type { Task } from '../domain/types';
import { useApp } from '../state/AppProvider';
import {
  ActionButton,
  Empty,
  FormModal,
  IconPicker,
  Page,
  Panel,
  SectionTitle,
} from '../ui/components';
import { iconName, tint } from '../ui/theme';
import { useAppTheme } from '../ui/ThemeProvider';
import {
  localDateFromKey,
  shiftLocalDate,
  weekStripDay,
} from '../ui/weekStripModel';
import { Confirm, discardDraft, ErrorText, useScreenStyles } from './shared';
export function TodayScreen() {
  const { colors } = useAppTheme();
  const styles = useScreenStyles();
  const { state, now, busy, run } = useApp();
  const [pickedDate, setPickedDate] = useState<string | null>(null);
  const selectedDate = pickedDate ?? dateKey(now);
  const selectedNow = localDateFromKey(selectedDate) ?? now;
  const isToday = selectedDate === dateKey(now);
  const historicalWeek = weekKey(selectedNow) !== weekKey(now);
  const stats = getWeekStats(state, selectedNow);
  // 可用券始终按实际当前时间统计，选历史日期只影响打卡与兑换统计。
  const availableTickets = state.tickets.filter(
    (ticket) => getTicketStatus(ticket, state, now) === 'available',
  ).length;
  const summaryCardStyle = { minWidth: 0, padding: 8 };
  const tasks = state.tasks.filter((task) => !task.archived || !isToday);
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [dateInput, setDateInput] = useState(selectedDate);
  const [dateError, setDateError] = useState('');
  const [calendarMonth, setCalendarMonth] = useState(
    () => dateKey(now).slice(0, 7) + '-01',
  );
  const calendarStart = localDateFromKey(calendarMonth) ?? now;
  const calendarOffset = (calendarStart.getDay() + 6) % 7;
  const calendarEnd = new Date(calendarStart);
  calendarEnd.setMonth(calendarEnd.getMonth() + 1);
  calendarEnd.setDate(0);
  const calendarLength = calendarEnd.getDate();
  const dateNavigationSize = Platform.OS === 'web' ? 32 : 44;
  const dateNavigationStyle = {
    margin: 0,
    width: dateNavigationSize,
    height: dateNavigationSize,
  };
  const [form, setForm] = useState<{
    id?: string;
    name: string;
    target: string;
    icon: string;
    color: string;
  } | null>(null);
  const [error, setError] = useState('');
  const [menuId, setMenuId] = useState<string | null>(null);
  const [focusedAction, setFocusedAction] = useState<string | null>(null);
  const keyboardFocus = useKeyboardFocus();
  function dateNavigationProps(id: string) {
    return {
      onFocus: () => {
        keyboardFocus.onFocus();
        setFocusedAction(id);
      },
      onBlur: () => {
        keyboardFocus.onBlur();
        setFocusedAction(null);
      },
      style: [
        dateNavigationStyle,
        {
          backgroundColor: 'transparent',
          borderWidth:
            keyboardFocus.focusVisible && focusedAction === id ? 1 : 0,
          borderColor: colors.primary,
        },
      ],
    };
  }
  const taskActionSize = Platform.OS === 'web' ? 36 : 44;
  const [initialForm, setInitialForm] = useState('');
  const [confirm, setConfirm] = useState<{
    type: 'archive' | 'undo' | 'redeem';
    task?: Task;
    date: string;
  } | null>(null);
  function edit(task?: Task) {
    const next = task
      ? { ...task, target: String(task.target) }
      : { name: '', target: '1', icon: '🌱', color: 'green' };
    setError('');
    setInitialForm(JSON.stringify(next));
    setForm(next);
  }
  function dismissForm() {
    if (!busy)
      discardDraft(JSON.stringify(form) !== initialForm, () => setForm(null));
  }
  async function save() {
    if (!form || busy) return;
    const result = await run((draft) =>
      form.id ? updateTask(draft, form.id, form) : addTask(draft, form),
    );
    if (result.ok) setForm(null);
    else setError(result.message);
  }
  async function confirmAction() {
    if (!confirm || busy) return;
    const result = await run((draft) =>
      confirm.type === 'redeem'
        ? redeemTicket(draft, new Date(), confirm.date)
        : confirm.type === 'archive'
          ? archiveTask(draft, confirm.task!.id)
          : undoCheckIn(draft, confirm.task!.id, new Date(), confirm.date),
    );
    if (result.ok) setConfirm(null);
    else setError(result.message);
  }
  function ask(type: 'archive' | 'undo' | 'redeem', task?: Task) {
    setError('');
    setConfirm({ type, task, date: selectedDate });
  }
  return (
    <Page
      title={isToday ? '今日打卡' : '历史补卡'}
      subtitle={selectedNow.toLocaleDateString('zh-CN', {
        month: 'long',
        day: 'numeric',
        weekday: 'long',
      })}
      scroll={false}
    >
      <FlatList
        style={styles.listViewport}
        data={tasks}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <View style={[styles.column, styles.listHeader]}>
            <Panel style={styles.card}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: 4,
                }}
              >
                <IconButton
                  icon="chevron-left"
                  size={18}
                  {...dateNavigationProps('previous-week')}
                  accessibilityLabel="查看上一周"
                  disabled={busy || selectedDate === '0001-01-01'}
                  onPress={() =>
                    setPickedDate(shiftLocalDate(selectedDate, -7))
                  }
                />
                <Text
                  style={{
                    flex: 1,
                    minWidth: 100,
                    fontSize: 12,
                    color: colors.muted,
                  }}
                >
                  {stats.days[0].date} — {stats.days[6].date}
                </Text>
                <IconButton
                  icon="chevron-right"
                  size={18}
                  {...dateNavigationProps('next-week')}
                  accessibilityLabel="查看下一周"
                  disabled={busy || !historicalWeek}
                  onPress={() => {
                    const next = shiftLocalDate(selectedDate, 7);
                    setPickedDate(next > dateKey(now) ? dateKey(now) : next);
                  }}
                />
              </View>
              <View style={styles.row}>
                <ActionButton
                  compact
                  mode="text"
                  disabled={busy}
                  icon="calendar-month-outline"
                  onPress={() => {
                    setDateInput(selectedDate);
                    setCalendarMonth(selectedDate.slice(0, 7) + '-01');
                    setDateError('');
                    setDatePickerVisible(true);
                  }}
                >
                  选日期
                </ActionButton>
                {!isToday && (
                  <ActionButton
                    compact
                    disabled={busy}
                    onPress={() => setPickedDate(null)}
                  >
                    回今天
                  </ActionButton>
                )}
              </View>
              <View style={[styles.row, { alignItems: 'stretch' }]}>
                <View style={[styles.stat, summaryCardStyle]}>
                  <Text style={styles.muted}>
                    {historicalWeek ? '所选周打卡' : '本周打卡'}
                  </Text>
                  <Text style={styles.number}>
                    {stats.total}
                    <Text style={styles.body}> 次</Text>
                  </Text>
                </View>
                <View
                  style={[
                    styles.stat,
                    summaryCardStyle,
                    { backgroundColor: colors.peach },
                  ]}
                >
                  <Text style={styles.muted}>
                    {historicalWeek ? '历史已兑换' : '可兑换'}
                  </Text>
                  <Text style={styles.number}>
                    {historicalWeek
                      ? state.redemptions.filter(
                          (entry) => entry.week === weekKey(selectedNow),
                        ).length
                      : stats.redeemable}
                    <Text style={styles.body}> 张</Text>
                  </Text>
                </View>
                <View
                  style={[
                    styles.stat,
                    summaryCardStyle,
                    { backgroundColor: colors.blue },
                  ]}
                >
                  <Text style={styles.muted}>可用奖券</Text>
                  <Text
                    style={styles.number}
                    accessibilityLabel={`当前可用奖券 ${availableTickets} 张`}
                  >
                    {availableTickets}
                    <Text style={styles.body}> 张</Text>
                  </Text>
                </View>
              </View>
              <View
                style={[
                  styles.row,
                  { gap: 4, justifyContent: 'space-between' },
                ]}
              >
                {stats.days.map((day, index) => {
                  const calendar = weekStripDay(
                    day.date,
                    index,
                    now,
                    selectedDate,
                  );
                  return (
                    <Pressable
                      key={day.date}
                      testID="week-strip-day"
                      accessibilityRole="button"
                      accessibilityState={{
                        selected: calendar.isSelected,
                        disabled: busy || calendar.isFuture,
                      }}
                      disabled={busy || calendar.isFuture}
                      onPress={() => setPickedDate(day.date)}
                      style={{
                        flex: 1,
                        alignItems: 'center',
                        gap: 4,
                        paddingVertical: 6,
                        borderRadius: 12,
                        minHeight: 48,
                        opacity: calendar.isFuture ? 0.4 : 1,
                        backgroundColor: 'transparent',
                      }}
                      accessible
                      accessibilityLabel={calendar.accessibilityLabel}
                    >
                      <Text
                        style={[
                          styles.muted,
                          {
                            fontWeight: calendar.isToday ? '700' : '400',
                            fontSize: 12,
                            lineHeight: 18,
                            color: colors.muted,
                          },
                        ]}
                      >
                        {calendar.label}
                      </Text>
                      <View
                        testID="week-date-circle"
                        style={{
                          minWidth: 32,
                          minHeight: 32,
                          padding: 4,
                          borderRadius: 999,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: calendar.isSelected
                            ? colors.primaryContainer
                            : 'transparent',
                        }}
                      >
                        <Text
                          style={[
                            styles.body,
                            {
                              fontWeight: '700',
                              color: colors.ink,
                            },
                          ]}
                        >
                          {calendar.dayNumber}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={styles.muted}>
                已选 {Number(selectedDate.slice(5, 7))}月
                {Number(selectedDate.slice(8, 10))}日
              </Text>
              {!isToday && (
                <Text style={styles.muted}>
                  {historicalWeek
                    ? '历史周补卡仅保留在发生周，不兑换、不结转本周。'
                    : '补卡计入所选日期，当前周仍按本周规则兑换。'}{' '}
                  已归档任务可补历史记录，次数按当前任务目标上限。
                </Text>
              )}
              <Text style={styles.body}>
                每 {state.settings.threshold} 次，换一点小快乐
              </Text>
              <View
                testID="reward-progress-track"
                style={{ height: 6, flexShrink: 0 }}
              >
                <ProgressBar
                  accessibilityLabel="距离下一张奖券的打卡进度"
                  accessibilityValue={{
                    min: 0,
                    max: state.settings.threshold,
                    now: stats.remainder,
                    text:
                      '已积累 ' +
                      stats.remainder +
                      ' 次，共需 ' +
                      state.settings.threshold +
                      ' 次',
                  }}
                  progress={stats.remainder / state.settings.threshold}
                  style={{ height: 6, borderRadius: 3 }}
                />
              </View>
              <View
                testID="redemption-bar"
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 8,
                  flexShrink: 0,
                }}
              >
                <Text
                  style={[
                    styles.muted,
                    { flexGrow: 1, flexShrink: 1, minWidth: 120 },
                  ]}
                >
                  {historicalWeek
                    ? '历史周不开放兑换'
                    : stats.redeemable > 0
                      ? `可兑换 ${stats.redeemable} 张`
                      : `还差 ${state.settings.threshold - stats.available} 次`}
                </Text>
                <ActionButton
                  testID="redeem-ticket-button"
                  tone="reward"
                  accessibilityLabel="兑换一张奖券"
                  mode="contained"
                  compact
                  icon="ticket-outline"
                  loading={busy}
                  disabled={busy || historicalWeek || stats.redeemable === 0}
                  onPress={() => ask('redeem')}
                  style={{ flexShrink: 0 }}
                >
                  兑换
                </ActionButton>
              </View>
            </Panel>
            <SectionTitle
              title={isToday ? '今日小任务' : selectedDate + ' 的任务'}
              action={
                <ActionButton
                  icon="plus"
                  mode="text"
                  disabled={busy}
                  onPress={() => edit()}
                >
                  新增
                </ActionButton>
              }
            />
          </View>
        }
        ListEmptyComponent={
          <Empty
            title="从一个小任务开始"
            description="点右上方新增，为今天安排一点喜欢的事。"
          />
        }
        renderItem={({ item }) => {
          const count = getTaskCount(state, item.id, selectedNow);
          const complete = count >= item.target;
          return (
            <Panel style={[styles.card, { padding: 12 }]}>
              <View
                testID="task-main-row"
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  flexWrap: 'nowrap',
                  gap: 8,
                }}
              >
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 12,
                    flexShrink: 0,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: tint(item.color, colors),
                  }}
                >
                  <Icon
                    source={iconName(item.icon)}
                    size={18}
                    color={colors.primary}
                  />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text
                    style={styles.heading}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    accessibilityLabel={item.name}
                  >
                    {item.name}
                  </Text>
                  {item.archived && (
                    <Text style={styles.muted}>已归档 · 可补历史</Text>
                  )}
                  <Text
                    style={[styles.muted, { fontSize: 12, lineHeight: 18 }]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                    accessibilityLabel={
                      item.name +
                      '，' +
                      selectedDate +
                      ' 已打卡' +
                      count +
                      '次，目标' +
                      item.target +
                      '次'
                    }
                  >
                    {count}/{item.target}次
                  </Text>
                </View>
                <View
                  testID="task-action-group"
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    flexWrap: 'nowrap',
                    gap: 0,
                    flexShrink: 0,
                  }}
                >
                  <IconButton
                    testID="task-checkin-button"
                    rippleColor={
                      Platform.OS === 'web' ? 'transparent' : undefined
                    }
                    onFocus={() => {
                      keyboardFocus.onFocus();
                      setFocusedAction(item.id + '-checkin');
                    }}
                    onBlur={() => {
                      keyboardFocus.onBlur();
                      setFocusedAction(null);
                    }}
                    hitSlop={0}
                    disabled={busy || complete}
                    icon={({ color }) => (
                      <View
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 14,
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor:
                            busy || complete
                              ? colors.border
                              : colors.primaryContainer,
                        }}
                      >
                        <Icon
                          source={
                            complete
                              ? 'check-circle'
                              : 'checkbox-marked-circle-outline'
                          }
                          size={18}
                          color={color}
                        />
                      </View>
                    )}
                    iconColor={colors.primary}
                    size={18}
                    accessibilityLabel={
                      item.name +
                      '，' +
                      selectedDate +
                      (complete
                        ? '，当天已完成'
                        : isToday
                          ? '，打卡'
                          : '，补卡')
                    }
                    style={{
                      margin: 0,
                      width: taskActionSize,
                      height: taskActionSize,
                      borderWidth:
                        keyboardFocus.focusVisible &&
                        focusedAction === item.id + '-checkin'
                          ? 1
                          : 0,
                      borderColor: colors.primary,
                      flexShrink: 0,
                      backgroundColor: 'transparent',
                    }}
                    onPress={() => {
                      void run((draft) =>
                        checkIn(draft, item.id, new Date(), selectedDate),
                      );
                    }}
                  />
                  <IconButton
                    testID="task-undo-button"
                    rippleColor={
                      Platform.OS === 'web' ? 'transparent' : undefined
                    }
                    onFocus={() => {
                      keyboardFocus.onFocus();
                      setFocusedAction(item.id + '-undo');
                    }}
                    onBlur={() => {
                      keyboardFocus.onBlur();
                      setFocusedAction(null);
                    }}
                    hitSlop={0}
                    icon="undo-variant"
                    iconColor={colors.primary}
                    size={18}
                    accessibilityLabel={
                      item.name + '，撤销' + selectedDate + '最近一次打卡'
                    }
                    style={{
                      margin: 0,
                      width: taskActionSize,
                      height: taskActionSize,
                      borderWidth:
                        keyboardFocus.focusVisible &&
                        focusedAction === item.id + '-undo'
                          ? 1
                          : 0,
                      borderColor: colors.primary,
                      flexShrink: 0,
                      backgroundColor: 'transparent',
                    }}
                    disabled={busy || !count}
                    onPress={() => ask('undo', item)}
                  />
                  <Menu
                    contentStyle={{
                      backgroundColor: colors.surface,
                      borderRadius: 12,
                      paddingVertical: 4,
                    }}
                    visible={menuId === item.id}
                    onDismiss={() => setMenuId(null)}
                    anchor={
                      <IconButton
                        testID="task-more-button"
                        rippleColor={
                          Platform.OS === 'web' ? 'transparent' : undefined
                        }
                        onFocus={() => {
                          keyboardFocus.onFocus();
                          setFocusedAction(item.id + '-more');
                        }}
                        onBlur={() => {
                          keyboardFocus.onBlur();
                          setFocusedAction(null);
                        }}
                        hitSlop={0}
                        icon="dots-horizontal"
                        size={18}
                        accessibilityLabel={item.name + '，更多操作'}
                        disabled={busy}
                        style={{
                          margin: 0,
                          width: taskActionSize,
                          height: taskActionSize,
                          borderWidth:
                            keyboardFocus.focusVisible &&
                            focusedAction === item.id + '-more'
                              ? 1
                              : 0,
                          borderColor: colors.primary,
                          flexShrink: 0,
                          backgroundColor: 'transparent',
                        }}
                        onPress={() => setMenuId(item.id)}
                      />
                    }
                  >
                    <Menu.Item
                      dense
                      style={{ minHeight: 40 }}
                      titleStyle={{ fontSize: 13, lineHeight: 20 }}
                      title="编辑任务"
                      leadingIcon={({ color }) => (
                        <Icon source="pencil-outline" size={18} color={color} />
                      )}
                      disabled={busy || item.archived}
                      onPress={() => {
                        setMenuId(null);
                        edit(item);
                      }}
                    />
                    <Menu.Item
                      dense
                      style={{ minHeight: 40 }}
                      titleStyle={{ fontSize: 13, lineHeight: 20 }}
                      title="归档任务"
                      leadingIcon={({ color }) => (
                        <Icon
                          source="archive-outline"
                          size={18}
                          color={color}
                        />
                      )}
                      disabled={busy || item.archived}
                      onPress={() => {
                        setMenuId(null);
                        ask('archive', item);
                      }}
                    />
                  </Menu>
                </View>
              </View>
            </Panel>
          );
        }}
      />
      <FormModal
        visible={datePickerVisible}
        title="选择打卡日期"
        onDismiss={() => {
          if (!busy) setDatePickerVisible(false);
        }}
      >
        <View style={styles.form}>
          <View style={styles.row}>
            <IconButton
              icon="chevron-left"
              size={18}
              {...dateNavigationProps('previous-month')}
              accessibilityLabel="日历上一月"
              disabled={busy || calendarMonth === '0001-01-01'}
              onPress={() => {
                const date = localDateFromKey(calendarMonth)!;
                date.setMonth(date.getMonth() - 1);
                setCalendarMonth(dateKey(date));
              }}
            />
            <Text style={{ flex: 1, textAlign: 'center' }}>
              {calendarMonth.slice(0, 7)}
            </Text>
            <IconButton
              icon="chevron-right"
              size={18}
              {...dateNavigationProps('next-month')}
              accessibilityLabel="日历下一月"
              disabled={
                busy || calendarMonth.slice(0, 7) >= dateKey(now).slice(0, 7)
              }
              onPress={() => {
                const date = localDateFromKey(calendarMonth)!;
                date.setMonth(date.getMonth() + 1);
                setCalendarMonth(dateKey(date));
              }}
            />
          </View>
          <View style={{ flexDirection: 'row' }}>
            {['一', '二', '三', '四', '五', '六', '日'].map((day) => (
              <Text
                key={day}
                style={[
                  styles.muted,
                  { width: '14.285714%', textAlign: 'center' },
                ]}
              >
                {day}
              </Text>
            ))}
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {Array.from(
              { length: calendarOffset + calendarLength },
              (_, index) => {
                const day = index - calendarOffset + 1;
                const key =
                  calendarMonth.slice(0, 8) + String(day).padStart(2, '0');
                return day < 1 ? (
                  <View
                    key={'blank-' + index}
                    style={{ width: '14.285714%' }}
                  />
                ) : (
                  <Pressable
                    key={key}
                    accessibilityRole="button"
                    accessibilityLabel={key}
                    accessibilityState={{
                      selected: key === dateInput,
                      disabled: key > dateKey(now),
                    }}
                    disabled={busy || key > dateKey(now)}
                    onPress={() => {
                      setDateInput(key);
                      setDateError('');
                    }}
                    style={{
                      width: '14.285714%',
                      minHeight: Platform.OS === 'web' ? 40 : 44,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: 'transparent',
                      opacity: key > dateKey(now) ? 0.35 : 1,
                    }}
                  >
                    <View
                      testID="month-date-circle"
                      style={{
                        minWidth: 32,
                        minHeight: 32,
                        padding: 4,
                        borderRadius: 999,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor:
                          key === dateInput
                            ? colors.primaryContainer
                            : 'transparent',
                      }}
                    >
                      <Text style={styles.body}>{day}</Text>
                    </View>
                  </Pressable>
                );
              },
            )}
          </View>
          <Text style={styles.muted}>
            已选 {dateInput}。
            可选择今天或任何过去日期，历史周只补记录，不结转本周。
          </Text>
          <TextInput
            dense
            mode="outlined"
            label="日期（YYYY-MM-DD）"
            placeholder="例如 2026-10-19"
            value={dateInput}
            onChangeText={setDateInput}
            keyboardType="numbers-and-punctuation"
            disabled={busy}
          />
          <ErrorText message={dateError} />
          <View style={styles.actions}>
            <ActionButton
              disabled={busy}
              onPress={() => setDatePickerVisible(false)}
              tone="neutral"
            >
              取消
            </ActionButton>
            <ActionButton
              mode="contained"
              disabled={busy}
              onPress={() => {
                if (
                  !localDateFromKey(dateInput) ||
                  dateInput > dateKey(new Date())
                ) {
                  setDateError('请输入有效的今天或过去日期');
                  return;
                }
                setPickedDate(dateInput);
                setDatePickerVisible(false);
              }}
            >
              查看日期
            </ActionButton>
          </View>
        </View>
      </FormModal>
      <FormModal
        visible={!!form}
        title={form?.id ? '编辑任务' : '新增小任务'}
        onDismiss={dismissForm}
      >
        {form && (
          <View style={styles.form}>
            <TextInput
              dense
              mode="outlined"
              label="任务名称（必填）"
              value={form.name}
              onChangeText={(name) => setForm({ ...form, name })}
              maxLength={30}
              disabled={busy}
            />
            <TextInput
              dense
              mode="outlined"
              label="每天打卡次数（1–99）"
              numericRule={{ kind: 'integer', min: 1, max: 99 }}
              validationVisible={!!error}
              keyboardType="number-pad"
              value={form.target}
              onChangeText={(target) => setForm({ ...form, target })}
              disabled={busy}
            />
            <Text style={styles.body}>任务图标</Text>
            <IconPicker
              value={form.icon}
              onChange={(icon) => setForm({ ...form, icon })}
            />
            <Text style={styles.body}>卡片颜色</Text>
            <View style={styles.actions}>
              {(['green', 'peach', 'blue', 'purple'] as const).map(
                (color, index) => (
                  <Pressable
                    testID="task-color-option"
                    key={color}
                    accessibilityRole="button"
                    accessibilityLabel={
                      ['浅绿', '奶杏', '雾蓝', '淡紫'][index] +
                      (form.color === color ? '，已选' : '')
                    }
                    accessibilityState={{ selected: form.color === color }}
                    disabled={busy}
                    style={({ pressed }) => ({
                      minWidth: 48,
                      minHeight: 48,
                      padding: 8,
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      opacity: busy ? 0.4 : pressed ? 0.7 : 1,
                    })}
                    onPress={() => setForm({ ...form, color })}
                  >
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        backgroundColor: tint(color, colors),
                      }}
                    />
                    <Text
                      style={{
                        fontSize: 12,
                        lineHeight: 18,
                        color: colors.ink,
                      }}
                    >
                      {['浅绿', '奶杏', '雾蓝', '淡紫'][index]}
                      {form.color === color ? ' · 已选' : ''}
                    </Text>
                  </Pressable>
                ),
              )}
            </View>
            <ErrorText message={error} />
            <View style={styles.actions}>
              <ActionButton
                mode="outlined"
                disabled={busy}
                onPress={dismissForm}
                tone="neutral"
              >
                取消
              </ActionButton>
              <ActionButton
                mode="contained"
                loading={busy}
                disabled={busy}
                tone="save"
                onPress={() => {
                  void save();
                }}
              >
                保存任务
              </ActionButton>
            </View>
          </View>
        )}
      </FormModal>
      <Confirm
        visible={!!confirm}
        tone={
          confirm?.type === 'archive'
            ? 'archive'
            : confirm?.type === 'redeem'
              ? 'reward'
              : 'save'
        }
        title={
          confirm?.type === 'redeem'
            ? '兑换一张奖券？'
            : confirm?.type === 'archive'
              ? '归档这个任务？'
              : '撤销最近一次打卡？'
        }
        description={
          confirm?.type === 'redeem'
            ? `消耗本周 ${state.settings.threshold} 次未兑换打卡。未兑换的打卡次数不会结转下周。`
            : confirm?.type === 'archive'
              ? `「${confirm.task?.name}」会移至更多中的归档任务，历史记录保留，可随时恢复。`
              : `仅撤销 ${confirm?.date} 最近一次记录。已用于兑换的次数不能撤销。`
        }
        busy={busy}
        error={error}
        onDismiss={() => {
          if (!busy) setConfirm(null);
        }}
        onConfirm={() => {
          void confirmAction();
        }}
      />
    </Page>
  );
}
