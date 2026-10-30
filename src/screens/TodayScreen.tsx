import React, { useEffect, useRef, useState } from 'react';
import { FlatList, Platform, Pressable, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Icon, IconButton, Menu, ProgressBar, Text } from 'react-native-paper';
import { AppTextInput as TextInput } from '../ui/AppTextInput';
import { useKeyboardFocus } from '../ui/useKeyboardFocus';
import {
  addTask,
  archiveTask,
  checkIn,
  dateKey,
  deleteTask,
  getTaskCount,
  getWeekStats,
  getTicketStatus,
  redeemTicket,
  redeemCompanionTicket,
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
import {
  Confirm,
  discardDraft,
  ErrorText,
  formatDate,
  useScreenStyles,
} from './shared';
import { GroupViewSwitch } from '../ui/GroupViewSwitch';
import { useGroupView } from '../ui/GroupViewProvider';
import { peerBoards } from '../domain/groupSync';
import { ProfileAvatar } from '../ui/ProfileAvatar';
export function TodayScreen() {
  const { colors } = useAppTheme();
  const styles = useScreenStyles();
  const { state, now, busy, run } = useApp();
  const navigation = useNavigation();
  const { mode, error: viewError, readFailed } = useGroupView();
  const showGroup = mode === 'group' && !!state.groupLink;
  const peers = showGroup ? peerBoards(state) : [];
  const [pickedDate, setPickedDate] = useState<string | null>(null);
  const listRef = useRef<FlatList<Task>>(null);
  const scrollOffsetRef = useRef(0);
  const restoreScrollRef = useRef<number | null>(null);
  const selectedDate = pickedDate ?? dateKey(now);
  function webListScroller(): HTMLElement | null {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return null;
    const root = document.querySelector(
      '[data-testid="today-task-list"]',
    ) as HTMLElement | null;
    if (!root) return null;
    const queue: HTMLElement[] = [root];
    while (queue.length) {
      const node = queue.shift()!;
      if (node.scrollHeight > node.clientHeight + 20) return node;
      queue.push(...(Array.from(node.children) as HTMLElement[]));
    }
    return null;
  }
  function applyListScroll(offset: number) {
    listRef.current?.scrollToOffset({ offset, animated: false });
    const scroller = webListScroller();
    if (scroller) scroller.scrollTop = offset;
  }
  // 切换日期时列表内容高度会变，避免 FlatList / 焦点滚入视口把位置打回顶部。
  function changePickedDate(next: string | null) {
    if ((next ?? dateKey(now)) === selectedDate) {
      // 有效日期未变时不会触发恢复effect，不能遗留锁；null仍需保留跟随今天的语义。
      restoreScrollRef.current = null;
      setPickedDate(next);
      return;
    }
    const scroller = webListScroller();
    restoreScrollRef.current = scroller?.scrollTop ?? scrollOffsetRef.current;
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const active = document.activeElement;
      if (active instanceof HTMLElement) active.blur();
    }
    setPickedDate(next);
  }
  useEffect(() => {
    const offset = restoreScrollRef.current;
    if (offset == null) return;
    let cancelled = false;
    const restore = () => {
      if (!cancelled && restoreScrollRef.current === offset)
        applyListScroll(offset);
    };
    restore();
    const timers = [0, 32, 80, 160, 320, 480].map((delay) =>
      setTimeout(() => {
        restore();
        if (delay === 480 && restoreScrollRef.current === offset)
          restoreScrollRef.current = null;
      }, delay),
    );
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [selectedDate]);
  useEffect(() => {
    // 进页/刷新从列表顶部开始，并清掉浏览器恢复的焦点，避免自动滚到旧控件。
    restoreScrollRef.current = null;
    scrollOffsetRef.current = 0;
    const reset = () => {
      applyListScroll(0);
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const active = document.activeElement;
        if (active instanceof HTMLElement) active.blur();
      }
    };
    reset();
    const timers = [50, 150, 400].map((delay) => setTimeout(reset, delay));
    return () => timers.forEach(clearTimeout);
  }, []);
  const selectedNow = localDateFromKey(selectedDate) ?? now;
  const isToday = selectedDate === dateKey(now);
  const historicalWeek = weekKey(selectedNow) !== weekKey(now);
  const stats = getWeekStats(state, selectedNow);
  // 可用券始终按实际当前时间统计，选历史日期只影响打卡与兑换统计。
  const availableTickets = state.tickets.filter(
    (ticket) => getTicketStatus(ticket, state, now) === 'available',
  ).length;
  const summaryCardStyle = { minWidth: 0, padding: 8 };
  const tasks = state.tasks.filter(
    (task) => !task.deleted && (!task.archived || !isToday),
  );
  const [datePickerVisible, setDatePickerVisible] = useState(false);
  const [dateInput, setDateInput] = useState(selectedDate);
  const [dateError, setDateError] = useState('');
  const [calendarView, setCalendarView] = useState<'day' | 'month' | 'year'>(
    'day',
  );
  const [calendarMonth, setCalendarMonth] = useState(
    () => dateKey(now).slice(0, 7) + '-01',
  );
  const todayKey = dateKey(now);
  const todayYear = Number(todayKey.slice(0, 4));
  const todayMonth = Number(todayKey.slice(5, 7));
  const calendarYear = Number(calendarMonth.slice(0, 4));
  const calendarMonthNumber = Number(calendarMonth.slice(5, 7));
  const yearPageStart = Math.floor(calendarYear / 12) * 12;
  const calendarStart = localDateFromKey(calendarMonth) ?? now;
  const calendarOffset = (calendarStart.getDay() + 6) % 7;
  const calendarEnd = new Date(calendarStart);
  calendarEnd.setMonth(calendarEnd.getMonth() + 1);
  calendarEnd.setDate(0);
  const calendarLength = calendarEnd.getDate();
  const dateNavigationSize = 28;
  const dateNavigationIconSize = 22;
  const dateNavigationStyle = {
    margin: 0,
    width: dateNavigationSize,
    height: dateNavigationSize,
    borderRadius: dateNavigationSize / 2,
  };
  const weekRangeLabel = (() => {
    const start = stats.days[0].date;
    const end = stats.days[6].date;
    const short = (key: string) =>
      `${Number(key.slice(5, 7))}/${Number(key.slice(8, 10))}`;
    return start.slice(0, 4) === end.slice(0, 4)
      ? `${short(start)} — ${short(end)}`
      : `${start.slice(0, 4)}/${short(start)} — ${end.slice(0, 4)}/${short(end)}`;
  })();
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
  const [pressedAction, setPressedAction] = useState<string | null>(null);
  const keyboardFocus = useKeyboardFocus();
  function dateNavigationProps(id: string) {
    return {
      onPressIn: () => setPressedAction(id),
      onPressOut: () =>
        setPressedAction((current) => (current === id ? null : current)),
      onFocus: () => {
        keyboardFocus.onFocus();
        setFocusedAction(id);
      },
      onBlur: () => {
        keyboardFocus.onBlur();
        setFocusedAction(null);
        setPressedAction((current) => (current === id ? null : current));
      },
      // Web 上按钮获焦会 scrollIntoView，把列表拽回周切换区域。
      ...(Platform.OS === 'web'
        ? {
            onMouseDown: (event: { preventDefault: () => void }) => {
              event.preventDefault();
            },
          }
        : {}),
      style: [
        dateNavigationStyle,
        {
          alignItems: 'center' as const,
          justifyContent: 'center' as const,
          opacity: 1,
          backgroundColor:
            pressedAction === id ? colors.primaryContainer : 'transparent',
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
    type: 'archive' | 'delete' | 'undo' | 'redeem' | 'companion';
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
        : confirm.type === 'companion'
          ? redeemCompanionTicket(draft, new Date(), confirm.date)
          : confirm.type === 'archive'
            ? archiveTask(draft, confirm.task!.id)
            : confirm.type === 'delete'
              ? deleteTask(draft, confirm.task!.id)
              : undoCheckIn(draft, confirm.task!.id, new Date(), confirm.date),
    );
    if (result.ok) setConfirm(null);
    else setError(result.message);
  }
  function ask(
    type: 'archive' | 'delete' | 'undo' | 'redeem' | 'companion',
    task?: Task,
  ) {
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
        ref={listRef}
        testID="today-task-list"
        style={styles.listViewport}
        data={tasks}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        onScroll={(event) => {
          const y = event.nativeEvent.contentOffset.y;
          const pending = restoreScrollRef.current;
          if (pending != null && Math.abs(y - pending) > 1) {
            applyListScroll(pending);
            return;
          }
          scrollOffsetRef.current = y;
        }}
        scrollEventThrottle={16}
        onContentSizeChange={() => {
          const offset = restoreScrollRef.current;
          if (offset == null) return;
          applyListScroll(offset);
        }}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <View style={[styles.column, styles.listHeader]}>
            <Panel style={styles.card}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    flexShrink: 1,
                    minWidth: 0,
                  }}
                >
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="查看上一周"
                    disabled={busy || selectedDate === '0001-01-01'}
                    onPress={() =>
                      changePickedDate(shiftLocalDate(selectedDate, -7))
                    }
                    {...dateNavigationProps('previous-week')}
                  >
                    <Icon
                      source="chevron-left"
                      size={dateNavigationIconSize}
                      color={
                        busy || selectedDate === '0001-01-01'
                          ? colors.muted
                          : colors.primary
                      }
                    />
                  </Pressable>
                  <Text
                    numberOfLines={1}
                    style={{
                      flexShrink: 1,
                      fontSize: 13,
                      lineHeight: 18,
                      fontWeight: '500',
                      color: colors.ink,
                    }}
                  >
                    {weekRangeLabel}
                  </Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="查看下一周"
                    disabled={busy || !historicalWeek}
                    onPress={() => {
                      const next = shiftLocalDate(selectedDate, 7);
                      changePickedDate(
                        next > dateKey(now) ? dateKey(now) : next,
                      );
                    }}
                    {...dateNavigationProps('next-week')}
                  >
                    <Icon
                      source="chevron-right"
                      size={dateNavigationIconSize}
                      color={
                        busy || !historicalWeek ? colors.muted : colors.primary
                      }
                    />
                  </Pressable>
                </View>
                <View style={[styles.row, { flexShrink: 0 }]}>
                  <ActionButton
                    compact
                    mode="text"
                    disabled={busy}
                    icon="calendar-month-outline"
                    onPress={() => {
                      setDateInput(selectedDate);
                      setCalendarMonth(selectedDate.slice(0, 7) + '-01');
                      setCalendarView('day');
                      setDateError('');
                      setDatePickerVisible(true);
                    }}
                  >
                    选日期
                  </ActionButton>
                  <ActionButton
                    compact
                    disabled={busy || isToday}
                    onPress={() => changePickedDate(null)}
                  >
                    回今天
                  </ActionButton>
                </View>
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
                      onPress={() => changePickedDate(day.date)}
                      {...(Platform.OS === 'web'
                        ? {
                            onMouseDown: (event: {
                              preventDefault: () => void;
                            }) => {
                              event.preventDefault();
                            },
                          }
                        : {})}
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
                accessible
                accessibilityRole="progressbar"
                accessibilityLabel="距离下一张奖券的打卡进度"
                aria-valuemin={0}
                aria-valuemax={state.settings.threshold}
                aria-valuenow={stats.remainder}
                aria-valuetext={
                  '已积累 ' +
                  stats.remainder +
                  ' 次，共需 ' +
                  state.settings.threshold +
                  ' 次'
                }
                style={{ height: 6, flexShrink: 0 }}
              >
                <View
                  aria-hidden
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                >
                  <ProgressBar
                    progress={stats.remainder / state.settings.threshold}
                    style={{ height: 6, borderRadius: 3 }}
                  />
                </View>
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
                  disabled={busy || historicalWeek || stats.redeemable === 0}
                  onPress={() => ask('redeem')}
                  style={{ flexShrink: 0 }}
                >
                  兑换
                </ActionButton>
              </View>
              <View
                testID="companion-redemption-bar"
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Text style={[styles.muted, { flex: 1, minWidth: 160 }]}>
                  1 次打卡换 1 张同行券，仅能随另一人的奖券一起使用。
                </Text>
                <ActionButton
                  testID="redeem-companion-button"
                  tone="reward"
                  mode="contained-tonal"
                  accessibilityLabel="消耗一次打卡兑换同行券"
                  icon="account-multiple-outline"
                  disabled={busy || historicalWeek || stats.available < 1}
                  onPress={() => ask('companion')}
                >
                  换同行券
                </ActionButton>
              </View>
            </Panel>
            {!state.groupLink && readFailed ? (
              <ErrorText message={viewError} />
            ) : null}
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
        ListFooterComponent={
          state.groupLink ? (
            <View style={[styles.column, { marginTop: 12 }]}>
              <Text style={styles.muted}>
                上方统计与任务仍属自己；选择看全组可浏览其他成员
              </Text>
              <GroupViewSwitch />
              <ErrorText message={viewError} />
              {showGroup ? (
                peers.length ? (
                  peers.map((peer) => {
                    const peerTasks = peer.app.tasks.filter(
                      (task) => !task.deleted && (!task.archived || !isToday),
                    );
                    const done = peerTasks.filter(
                      (task) =>
                        getTaskCount(
                          peer.app,
                          task.id,
                          new Date(`${selectedDate}T12:00:00`),
                        ) >= task.target,
                    ).length;
                    const available = peer.app.tickets.filter(
                      (ticket) =>
                        getTicketStatus(ticket, peer.app, now) === 'available',
                    ).length;
                    const used = peer.app.tickets.filter(
                      (ticket) => ticket.usedAt,
                    ).length;
                    const redeemed = peer.app.redemptions.filter(
                      (entry) => entry.week === weekKey(selectedNow),
                    ).length;
                    return (
                      <Pressable
                        key={peer.accountId}
                        accessibilityRole="button"
                        accessibilityLabel={`${peer.name}的记录`}
                        onPress={() => {
                          (
                            navigation.navigate as (
                              name: string,
                              params: object,
                            ) => void
                          )('more', {
                            initial: false,
                            screen: 'member',
                            params: {
                              accountId: peer.accountId,
                              date: selectedDate,
                            },
                          });
                        }}
                      >
                        <Panel style={styles.card}>
                          <View style={styles.row}>
                            <ProfileAvatar avatar={peer.avatar} size={36} />
                            <View style={styles.grow}>
                              <Text style={styles.heading}>
                                {peer.name}
                                {peer.left ? ' · 已离开' : ''}
                              </Text>
                              <Text style={styles.muted}>
                                已同步 {formatDate(peer.syncedAt)} · 完成 {done}
                                /{peerTasks.length}
                              </Text>
                              <Text style={styles.muted}>
                                可用 {available} · 本周已兑 {redeemed} · 已使用{' '}
                                {used}
                              </Text>
                            </View>
                          </View>
                          {peerTasks.map((task) => (
                            <Text key={task.id} style={styles.muted}>
                              {task.name}{' '}
                              {getTaskCount(
                                peer.app,
                                task.id,
                                new Date(`${selectedDate}T12:00:00`),
                              )}
                              /{task.target}
                            </Text>
                          ))}
                        </Panel>
                      </Pressable>
                    );
                  })
                ) : (
                  <Text style={styles.muted}>
                    同步后可以看到其他成员。打开应用不会自动同步。
                  </Text>
                )
              ) : null}
            </View>
          ) : null
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
                    rippleColor={'transparent'}
                    onPressIn={() => setPressedAction(item.id + '-checkin')}
                    onPressOut={() =>
                      setPressedAction((current) =>
                        current === item.id + '-checkin' ? null : current,
                      )
                    }
                    onFocus={() => {
                      keyboardFocus.onFocus();
                      setFocusedAction(item.id + '-checkin');
                    }}
                    onBlur={() => {
                      keyboardFocus.onBlur();
                      setFocusedAction(null);
                      setPressedAction((current) =>
                        current === item.id + '-checkin' ? null : current,
                      );
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
                              : pressedAction === item.id + '-checkin'
                                ? colors.primary
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
                      borderRadius: taskActionSize / 2,
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
                    rippleColor={'transparent'}
                    onPressIn={() => setPressedAction(item.id + '-undo')}
                    onPressOut={() =>
                      setPressedAction((current) =>
                        current === item.id + '-undo' ? null : current,
                      )
                    }
                    onFocus={() => {
                      keyboardFocus.onFocus();
                      setFocusedAction(item.id + '-undo');
                    }}
                    onBlur={() => {
                      keyboardFocus.onBlur();
                      setFocusedAction(null);
                      setPressedAction((current) =>
                        current === item.id + '-undo' ? null : current,
                      );
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
                      borderRadius: taskActionSize / 2,
                      borderWidth:
                        keyboardFocus.focusVisible &&
                        focusedAction === item.id + '-undo'
                          ? 1
                          : 0,
                      borderColor: colors.primary,
                      flexShrink: 0,
                      backgroundColor:
                        pressedAction === item.id + '-undo'
                          ? colors.primaryContainer
                          : 'transparent',
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
                        rippleColor={'transparent'}
                        onPressIn={() => setPressedAction(item.id + '-more')}
                        onPressOut={() =>
                          setPressedAction((current) =>
                            current === item.id + '-more' ? null : current,
                          )
                        }
                        onFocus={() => {
                          keyboardFocus.onFocus();
                          setFocusedAction(item.id + '-more');
                        }}
                        onBlur={() => {
                          keyboardFocus.onBlur();
                          setFocusedAction(null);
                          setPressedAction((current) =>
                            current === item.id + '-more' ? null : current,
                          );
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
                          borderRadius: taskActionSize / 2,
                          borderWidth:
                            keyboardFocus.focusVisible &&
                            focusedAction === item.id + '-more'
                              ? 1
                              : 0,
                          borderColor: colors.primary,
                          flexShrink: 0,
                          backgroundColor:
                            pressedAction === item.id + '-more'
                              ? colors.primaryContainer
                              : 'transparent',
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
                    <Menu.Item
                      dense
                      style={{ minHeight: 40 }}
                      titleStyle={{ fontSize: 13, lineHeight: 20 }}
                      title="删除任务"
                      leadingIcon={({ color }) => (
                        <Icon
                          source="trash-can-outline"
                          size={18}
                          color={color}
                        />
                      )}
                      disabled={busy}
                      onPress={() => {
                        setMenuId(null);
                        ask('delete', item);
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
              size={dateNavigationIconSize}
              {...dateNavigationProps(
                calendarView === 'day'
                  ? 'previous-month'
                  : calendarView === 'month'
                    ? 'previous-year'
                    : 'previous-years',
              )}
              accessibilityLabel={
                calendarView === 'day'
                  ? '日历上一月'
                  : calendarView === 'month'
                    ? '日历上一年'
                    : '日历上一组年份'
              }
              disabled={
                busy ||
                (calendarView === 'day'
                  ? calendarMonth === '0001-01-01'
                  : calendarView === 'month'
                    ? calendarYear <= 1
                    : yearPageStart <= 0)
              }
              onPress={() => {
                if (calendarView === 'day') {
                  const date = localDateFromKey(calendarMonth)!;
                  date.setMonth(date.getMonth() - 1);
                  setCalendarMonth(dateKey(date));
                  return;
                }
                if (calendarView === 'month') {
                  setCalendarMonth(
                    String(calendarYear - 1).padStart(4, '0') +
                      calendarMonth.slice(4),
                  );
                  return;
                }
                setCalendarMonth(
                  String(Math.max(1, yearPageStart - 12)).padStart(4, '0') +
                    calendarMonth.slice(4),
                );
              }}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                calendarView === 'day'
                  ? '选择月份和年份'
                  : calendarView === 'month'
                    ? '选择年份'
                    : '当前年份范围'
              }
              disabled={busy || calendarView === 'year'}
              onPress={() => {
                if (calendarView === 'day') setCalendarView('month');
                else if (calendarView === 'month') setCalendarView('year');
              }}
              style={{
                flex: 1,
                minHeight: dateNavigationSize,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ textAlign: 'center' }}>
                {calendarView === 'day'
                  ? `${calendarYear}年${calendarMonthNumber}月`
                  : calendarView === 'month'
                    ? `${calendarYear}年`
                    : `${yearPageStart}–${yearPageStart + 11}年`}
              </Text>
            </Pressable>
            <IconButton
              icon="chevron-right"
              size={dateNavigationIconSize}
              {...dateNavigationProps(
                calendarView === 'day'
                  ? 'next-month'
                  : calendarView === 'month'
                    ? 'next-year'
                    : 'next-years',
              )}
              accessibilityLabel={
                calendarView === 'day'
                  ? '日历下一月'
                  : calendarView === 'month'
                    ? '日历下一年'
                    : '日历下一组年份'
              }
              disabled={
                busy ||
                (calendarView === 'day'
                  ? calendarMonth.slice(0, 7) >= todayKey.slice(0, 7)
                  : calendarView === 'month'
                    ? calendarYear >= todayYear
                    : yearPageStart + 12 > todayYear)
              }
              onPress={() => {
                if (calendarView === 'day') {
                  const date = localDateFromKey(calendarMonth)!;
                  date.setMonth(date.getMonth() + 1);
                  setCalendarMonth(dateKey(date));
                  return;
                }
                if (calendarView === 'month') {
                  setCalendarMonth(
                    String(calendarYear + 1).padStart(4, '0') +
                      calendarMonth.slice(4),
                  );
                  return;
                }
                setCalendarMonth(
                  String(yearPageStart + 12).padStart(4, '0') +
                    calendarMonth.slice(4),
                );
              }}
            />
          </View>
          {calendarView === 'day' ? (
            <>
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
                          disabled: key > todayKey,
                        }}
                        disabled={busy || key > todayKey}
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
                          opacity: key > todayKey ? 0.35 : 1,
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
            </>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
              {(calendarView === 'month'
                ? Array.from({ length: 12 }, (_, index) => index + 1)
                : Array.from(
                    { length: 12 },
                    (_, index) => yearPageStart + index,
                  )
              ).map((value) => {
                const isMonth = calendarView === 'month';
                const disabled = isMonth
                  ? calendarYear > todayYear ||
                    (calendarYear === todayYear && value > todayMonth)
                  : value > todayYear || value < 1;
                const selected = isMonth
                  ? value === calendarMonthNumber
                  : value === calendarYear;
                const label = isMonth ? `${value}月` : `${value}年`;
                return (
                  <Pressable
                    key={label}
                    testID={
                      isMonth ? 'month-picker-option' : 'year-picker-option'
                    }
                    accessibilityRole="button"
                    accessibilityLabel={label}
                    accessibilityState={{ selected, disabled }}
                    disabled={busy || disabled}
                    onPress={() => {
                      if (isMonth) {
                        setCalendarMonth(
                          String(calendarYear).padStart(4, '0') +
                            '-' +
                            String(value).padStart(2, '0') +
                            '-01',
                        );
                        setCalendarView('day');
                        return;
                      }
                      const nextMonth =
                        value === todayYear
                          ? Math.min(calendarMonthNumber, todayMonth)
                          : calendarMonthNumber;
                      setCalendarMonth(
                        String(value).padStart(4, '0') +
                          '-' +
                          String(nextMonth).padStart(2, '0') +
                          '-01',
                      );
                      setCalendarView('month');
                    }}
                    style={{
                      width: '25%',
                      minHeight: Platform.OS === 'web' ? 40 : 44,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: 'transparent',
                      opacity: disabled ? 0.35 : 1,
                    }}
                  >
                    <View
                      style={{
                        minWidth: 56,
                        minHeight: 32,
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 999,
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: selected
                          ? colors.primaryContainer
                          : 'transparent',
                      }}
                    >
                      <Text style={styles.body}>{label}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
          <Text style={styles.muted}>
            已选 {dateInput}
            。点击上方年月可切换；可选今天或过去日期，历史周只补记录，不结转本周。
          </Text>
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
                  setDateError('请选择有效的今天或过去日期');
                  return;
                }
                changePickedDate(dateInput);
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
        danger={confirm?.type === 'delete'}
        tone={
          confirm?.type === 'archive'
            ? 'archive'
            : confirm?.type === 'redeem' || confirm?.type === 'companion'
              ? 'reward'
              : confirm?.type === 'delete'
                ? 'danger'
                : 'save'
        }
        title={
          confirm?.type === 'companion'
            ? '兑换一张同行券？'
            : confirm?.type === 'redeem'
              ? '兑换一张奖券？'
              : confirm?.type === 'archive'
                ? '归档这个任务？'
                : confirm?.type === 'delete'
                  ? '删除这个任务？'
                  : '撤销最近一次打卡？'
        }
        description={
          confirm?.type === 'companion'
            ? '消耗本周 1 次未兑换打卡，与普通奖券共用打卡余额和有效期设置。同行券不能单独使用，也不能搭配自己的券；须与另一人的打卡券、里程碑券或赠送券共同确认使用。'
            : confirm?.type === 'redeem'
              ? `消耗本周 ${state.settings.threshold} 次未兑换打卡。未兑换的打卡次数不会结转下周。`
              : confirm?.type === 'archive'
                ? `「${confirm.task?.name}」会移至更多中的归档任务，历史记录保留，可随时恢复。`
                : confirm?.type === 'delete'
                  ? `「${confirm.task?.name}」删除后不会出现在归档任务，也不能恢复。历史打卡仍计入周统计。`
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
