import React, { useMemo, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, View } from 'react-native';
import {
  StackActions,
  useNavigation,
  useLinkProps,
  type NavigationProp,
} from '@react-navigation/native';
import { Icon, Text } from 'react-native-paper';
import { dateKey } from '../domain/engine';
import { buildTaskHistoryIndex } from '../domain/taskHistory';
import { useApp } from '../state/AppProvider';
import {
  ActionButton,
  Empty,
  Page,
  Panel,
  SectionTitle,
} from '../ui/components';
import {
  buildGrowthProgress,
  GROWTH_LOOKBACK,
  growthPeriod,
  moveGrowthOffset,
} from '../ui/growthModel';
import { HistoryPanel, HistoryTabs } from '../ui/HistoryControls';
import { iconName, tint } from '../ui/theme';
import { utilityColors } from '../ui/themeCatalog';
import { useAppTheme } from '../ui/ThemeProvider';
import { control, font, radius, space } from '../ui/uiTokens';
import { useKeyboardFocus } from '../ui/useKeyboardFocus';
import { useScreenStyles } from './shared';

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];
const GROWTH_VIEWS = [
  { value: 'weekly', label: '每周总览' },
  { value: 'tasks', label: '按任务' },
] as const;
const MONTH_STATES = {
  full: '达标',
  partial: '有打卡',
  empty: '未完成',
  future: '未来不可选',
} as const;
const MONTH_MARKS = {
  full: 'check',
  partial: 'circle-small',
  empty: null,
  future: null,
} as const;
type GrowthView = (typeof GROWTH_VIEWS)[number]['value'];
type GrowthProgress = ReturnType<typeof buildGrowthProgress>;
type TaskProgress = GrowthProgress['progress'][number];

function cssFocus(color: string) {
  return Platform.OS === 'web'
    ? {
        outlineColor: color,
        outlineOffset: 2,
        outlineStyle: 'solid' as const,
        outlineWidth: 2,
      }
    : undefined;
}

function PeriodArrow({
  direction,
  label,
  disabled,
  onPress,
  testID,
}: {
  direction: 'left' | 'right';
  label: string;
  disabled: boolean;
  onPress: () => void;
  testID: string;
}) {
  const { colors } = useAppTheme();
  const focus = useKeyboardFocus();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      aria-disabled={disabled}
      accessibilityState={{ disabled }}
      onPress={onPress}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      style={styles.touchTarget}
      testID={testID}
    >
      {({ pressed }) => (
        <View
          style={[
            styles.arrow,
            {
              backgroundColor:
                pressed && !disabled ? colors.primaryContainer : colors.surface,
              borderColor: colors.border,
            },
            focus.focusVisible && !disabled && cssFocus(colors.primary),
          ]}
        >
          <Icon
            source={direction === 'left' ? 'chevron-left' : 'chevron-right'}
            size={font[14]}
            color={disabled ? colors.muted : colors.primary}
          />
        </View>
      )}
    </Pressable>
  );
}

function PeriodNavigation({
  unit,
  label,
  offset,
  setOffset,
}: {
  unit: 'week' | 'month';
  label: string;
  offset: number;
  setOffset: React.Dispatch<React.SetStateAction<number>>;
}) {
  const { colors } = useAppTheme();
  const isMonth = unit === 'month';
  const periodName = isMonth ? '月' : '周';
  const prefix = isMonth ? 'growth-month' : 'growth-week';
  return (
    <View style={styles.periodRow} testID={prefix}>
      <PeriodArrow
        direction="left"
        label={isMonth ? '查看前一个月' : '查看前一周'}
        disabled={offset <= -GROWTH_LOOKBACK}
        onPress={() => setOffset((value) => moveGrowthOffset(value, -1))}
        testID={isMonth ? 'growth-previous-month' : 'growth-previous-week'}
      />
      <View style={styles.periodCenter}>
        <Text style={[styles.periodLabel, { color: colors.ink }]}>{label}</Text>
        {offset === 0 && (
          <Text
            testID={prefix + '-current-tag'}
            style={[
              styles.periodTag,
              {
                color: colors.primary,
                backgroundColor: colors.primaryContainer,
              },
            ]}
          >
            本{periodName}
          </Text>
        )}
      </View>
      <PeriodArrow
        direction="right"
        label={isMonth ? '查看后一个月' : '查看后一周'}
        disabled={offset >= 0}
        onPress={() => setOffset((value) => moveGrowthOffset(value, 1))}
        testID={isMonth ? 'growth-next-month' : 'growth-next-week'}
      />
    </View>
  );
}

function periodDate(key: string, withYear: boolean) {
  const [year, month, day] = key.split('-').map(Number);
  return (withYear ? year + '年' : '') + month + '月' + day + '日';
}

function MonthLink() {
  const link = useLinkProps<{ month: undefined }>({
    screen: 'month',
    href: '/more/month',
  });
  const { colors } = useAppTheme();
  const focus = useKeyboardFocus();
  return (
    <Pressable
      {...link}
      accessibilityLabel="按月回顾"
      testID="growth-month-link"
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      style={styles.monthLinkTarget}
    >
      {({ pressed }) => (
        <View
          style={[
            styles.monthLink,
            {
              backgroundColor: pressed
                ? colors.primaryAccent
                : colors.primaryContainer,
            },
            focus.focusVisible && cssFocus(colors.primary),
          ]}
        >
          <Text style={[styles.smallText, { color: colors.primary }]}>
            按月回顾
          </Text>
          <Icon source="chevron-right" color={colors.primary} size={font[14]} />
        </View>
      )}
    </Pressable>
  );
}

function ProgressCard({
  item,
  dates,
  periodLabel,
  lifetime,
  onOpen,
}: {
  item: TaskProgress;
  dates: readonly string[];
  periodLabel: string;
  lifetime?: number;
  onOpen?: () => void;
}) {
  const { colors } = useAppTheme();
  const screen = useScreenStyles();
  const focus = useKeyboardFocus();
  const { task, total, completed, completedDays } = item;
  return (
    <Panel style={screen.card}>
      <View style={styles.cardHeader}>
        <Text style={[screen.heading, styles.title]} numberOfLines={2}>
          {task.name}
        </Text>
        <Text style={screen.muted}>
          {periodLabel} {total} 次
        </Text>
      </View>
      <View
        style={[styles.progressTrack, { backgroundColor: colors.field }]}
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={task.name + '达标天数'}
        accessibilityValue={{ min: 0, max: dates.length, now: completedDays }}
      >
        <View
          style={[
            styles.progressFill,
            {
              width: `${(completedDays / dates.length) * 100}%` as const,
              backgroundColor: colors.primary,
            },
          ]}
        />
      </View>
      <Text style={screen.muted}>
        每日目标 {task.target} 次 · 达标 {completedDays} / {dates.length} 天
        {task.archived ? ' · 已归档' : ''}
      </Text>
      {lifetime !== undefined && (
        <>
          <View
            style={styles.miniDays}
            accessible
            accessibilityLabel={completed
              .map(
                (day, index) =>
                  '周' + WEEKDAYS[index] + (day ? '达标' : '未达标'),
              )
              .join('，')}
          >
            {completed.map((day, index) => (
              <View
                key={dates[index]}
                style={[
                  styles.miniDay,
                  {
                    backgroundColor: day ? colors.primary : colors.field,
                    borderColor: day ? colors.primary : colors.border,
                  },
                ]}
              />
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              task.name + '，累计打卡 ' + lifetime + ' 次，查看打卡记录'
            }
            onPress={onOpen}
            onFocus={focus.onFocus}
            onBlur={focus.onBlur}
            style={[
              styles.taskLink,
              focus.focusVisible && cssFocus(colors.primary),
            ]}
            testID={'growth-task-history-' + task.id}
          >
            <Text style={[screen.body, styles.title]}>
              累计 {lifetime} 次 · 打卡记录
            </Text>
            <Icon source="chevron-right" size={font[18]} color={colors.muted} />
          </Pressable>
        </>
      )}
    </Panel>
  );
}

function WeeklyChart({ summary }: { summary: GrowthProgress }) {
  const { colors } = useAppTheme();
  const screen = useScreenStyles();
  const max = Math.max(1, ...summary.days.map((entry) => entry.count));
  return (
    <Panel style={screen.card}>
      <Text style={screen.number}>
        {summary.total}
        <Text style={screen.body}> 次打卡</Text>
      </Text>
      <View style={styles.barRow}>
        {summary.days.map((entry, index) => (
          <View
            key={entry.date}
            style={styles.barColumn}
            accessible
            accessibilityLabel={
              '周' + WEEKDAYS[index] + '，' + entry.count + '次打卡'
            }
          >
            <Text style={screen.body}>{entry.count}</Text>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  {
                    height: Math.max(
                      space[4],
                      (entry.count / max) * control[44] * 2,
                    ),
                    backgroundColor: colors.primary,
                  },
                ]}
              />
            </View>
            <Text style={screen.muted}>{WEEKDAYS[index]}</Text>
          </View>
        ))}
      </View>
      <Text style={screen.muted}>横轴：周一至周日 · 数字为每日打卡次数</Text>
    </Panel>
  );
}

export function GrowthScreen() {
  const [view, setView] = useState<GrowthView>('weekly');
  const [offset, setOffset] = useState(0);
  const navigation = useNavigation<NavigationProp<{ today: undefined }>>();
  const { colors } = useAppTheme();
  const screen = useScreenStyles();
  const { state, now } = useApp();
  const period = growthPeriod(now, 'week', offset);
  const summary = buildGrowthProgress(
    state.tasks,
    state.checkins,
    period.dates,
    dateKey(now),
  );
  const taskHistory = useMemo(
    () => buildTaskHistoryIndex(state.tasks, state.checkins),
    [state.tasks, state.checkins],
  );
  const isWeekly = view === 'weekly';
  const showYearStart =
    period.start.slice(0, 4) !== period.end.slice(0, 4) ||
    period.year !== now.getFullYear();
  const range =
    periodDate(period.start, showYearStart) +
    ' — ' +
    periodDate(period.end, period.start.slice(0, 4) !== period.end.slice(0, 4));
  const progress = isWeekly
    ? summary.progress.filter((item) => item.total > 0)
    : [...summary.progress].sort(
        (a, b) => Number(a.task.archived) - Number(b.task.archived),
      );
  return (
    <Page title="成长记录" scroll={false}>
      <View style={styles.growthBar}>
        <View style={styles.title}>
          <HistoryTabs
            options={GROWTH_VIEWS}
            value={view}
            onChange={setView}
            label="成长记录查看方式"
            testID="growth-history-tabs"
          />
        </View>
        <MonthLink />
      </View>
      <PeriodNavigation
        unit="week"
        label={range}
        offset={offset}
        setOffset={setOffset}
      />
      {offset < 0 && (
        <ActionButton
          mode="text"
          tone="neutral"
          onPress={() => setOffset(0)}
          testID="growth-current-week"
        >
          回到本周
        </ActionButton>
      )}
      <HistoryPanel fill label={isWeekly ? '每周总览' : '按任务'}>
        <FlatList
          key={view}
          style={screen.listViewport}
          contentContainerStyle={screen.list}
          data={progress}
          keyExtractor={({ task }) => task.id}
          ItemSeparatorComponent={() => <View style={screen.separator} />}
          ListHeaderComponent={
            isWeekly ? (
              <View style={[screen.column, screen.listHeader]}>
                <WeeklyChart summary={summary} />
                <SectionTitle title="每个任务的小积累" />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View>
              <Empty
                title={isWeekly ? '该周没有任务明细' : '还没有任务'}
                description={
                  isWeekly && summary.total > 0
                    ? '已删除的任务仍计入上方统计。'
                    : '在今日打卡完成一个任务后，就能在这里查看记录。'
                }
              />
              <ActionButton
                mode="contained"
                onPress={() => navigation.navigate('today')}
              >
                去今日打卡
              </ActionButton>
            </View>
          }
          renderItem={({ item }) =>
            isWeekly ? (
              <Panel style={screen.card}>
                <View style={screen.row}>
                  <View
                    style={[
                      screen.icon,
                      { backgroundColor: tint(item.task.color, colors) },
                    ]}
                  >
                    <Icon
                      source={iconName(item.task.icon)}
                      size={control[24]}
                      color={colors.primary}
                    />
                  </View>
                  <View style={screen.grow}>
                    <Text style={screen.heading} numberOfLines={2}>
                      {item.task.name}
                    </Text>
                    <Text style={screen.muted}>
                      {item.task.archived
                        ? '已归档 · 历史保留'
                        : '每日目标 ' + item.task.target + ' 次'}
                    </Text>
                  </View>
                  <Text style={screen.heading}>{item.total} 次</Text>
                </View>
              </Panel>
            ) : (
              <ProgressCard
                item={item}
                dates={period.dates}
                periodLabel={offset === 0 ? '本周' : '该周'}
                lifetime={taskHistory.get(item.task.id)?.total ?? 0}
                onOpen={() =>
                  navigation.dispatch(
                    StackActions.push('taskHistory', {
                      taskId: item.task.id,
                      initialDate: offset < 0 ? period.start : undefined,
                    }),
                  )
                }
              />
            )
          }
        />
      </HistoryPanel>
    </Page>
  );
}

function MonthCalendar({
  days,
  leading,
}: {
  days: GrowthProgress['days'];
  leading: number;
}) {
  const { colors } = useAppTheme();
  const screen = useScreenStyles();
  const rows = Math.ceil((leading + days.length) / WEEKDAYS.length);
  const palette = {
    full: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
      color: utilityColors.onSolid,
    },
    partial: {
      backgroundColor: colors.primaryContainer,
      borderColor: colors.primaryContainer,
      color: colors.primary,
    },
    empty: {
      backgroundColor: colors.field,
      borderColor: colors.field,
      color: colors.ink,
    },
    future: {
      backgroundColor: 'transparent',
      borderColor: colors.border,
      color: colors.muted,
    },
  } as const;
  return (
    <View style={styles.calendar}>
      <View style={styles.calendarRow}>
        {WEEKDAYS.map((weekday) => (
          <Text
            key={weekday}
            style={[
              styles.calendarPosition,
              styles.weekday,
              { color: colors.muted },
            ]}
          >
            {weekday}
          </Text>
        ))}
      </View>
      {Array.from({ length: rows }, (_, row) => (
        <View key={row} style={styles.calendarRow}>
          {WEEKDAYS.map((weekday, column) => {
            const day = days[row * WEEKDAYS.length + column - leading];
            if (!day)
              return <View key={weekday} style={styles.calendarPosition} />;
            const { color, ...paint } = palette[day.status];
            const future = day.status === 'future';
            const mark = MONTH_MARKS[day.status];
            return (
              <View
                key={day.date}
                accessible
                accessibilityLabel={
                  periodDate(day.date, false) +
                  '，' +
                  MONTH_STATES[day.status] +
                  '，' +
                  day.count +
                  ' 次打卡'
                }
                accessibilityState={future ? { disabled: true } : undefined}
                aria-disabled={future || undefined}
                style={[
                  styles.calendarPosition,
                  styles.calendarCell,
                  paint,
                  future && styles.dashed,
                ]}
              >
                <Text style={[styles.calendarNumber, { color }]}>
                  {Number(day.date.slice(8))}
                </Text>
                {mark && <Icon source={mark} color={color} size={font[10]} />}
              </View>
            );
          })}
        </View>
      ))}
      <View style={styles.calendarLegend}>
        {Object.entries(MONTH_STATES).map(([key, label]) => {
          const status = key as keyof typeof MONTH_STATES;
          const { color, ...paint } = palette[status];
          const mark = MONTH_MARKS[status];
          return (
            <View key={key} style={styles.legendItem}>
              <View
                style={[
                  styles.legendMark,
                  paint,
                  key === 'future' && styles.dashed,
                ]}
              >
                {mark && <Icon source={mark} color={color} size={font[10]} />}
              </View>
              <Text style={screen.muted}>{label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export function MonthReviewScreen() {
  const navigation = useNavigation<NavigationProp<{ today: undefined }>>();
  const [offset, setOffset] = useState(0);
  const { state, now } = useApp();
  const screen = useScreenStyles();
  const period = growthPeriod(now, 'month', offset);
  const summary = buildGrowthProgress(
    state.tasks,
    state.checkins,
    period.dates,
    dateKey(now),
  );
  return (
    <Page title="月度回顾" scroll={false}>
      <PeriodNavigation
        unit="month"
        label={period.year + '年' + period.month + '月'}
        offset={offset}
        setOffset={setOffset}
      />
      <FlatList
        style={screen.listViewport}
        contentContainerStyle={screen.list}
        data={summary.total > 0 ? summary.progress : []}
        keyExtractor={({ task }) => task.id}
        ItemSeparatorComponent={() => <View style={screen.separator} />}
        ListHeaderComponent={
          <View style={[screen.column, screen.listHeader]}>
            <Panel style={screen.card}>
              <View style={styles.cardHeader}>
                <Text style={screen.heading}>{summary.total} 次打卡</Text>
                <Text style={screen.muted}>
                  达标 {summary.completedDays} / {period.dates.length} 天
                </Text>
              </View>
              <MonthCalendar days={summary.days} leading={period.leading} />
            </Panel>
            {summary.total > 0 && summary.progress.length > 0 && (
              <SectionTitle title="每个任务的月度进度" />
            )}
          </View>
        }
        ListEmptyComponent={
          summary.total === 0 ? (
            <Panel style={screen.card}>
              <Empty
                title="这个月还没有打卡记录"
                description="完成一次打卡后，这里会显示当月进度。"
              />
              <ActionButton
                mode="contained"
                onPress={() =>
                  offset < 0 ? setOffset(0) : navigation.navigate('today')
                }
              >
                {offset < 0 ? '回到本月' : '去今日打卡'}
              </ActionButton>
            </Panel>
          ) : null
        }
        renderItem={({ item }) => (
          <ProgressCard
            item={item}
            dates={period.dates}
            periodLabel={offset === 0 ? '本月' : period.month + '月'}
          />
        )}
      />
    </Page>
  );
}

const styles = StyleSheet.create({
  growthBar: { flexDirection: 'row', alignItems: 'center', gap: space[10] },
  monthLinkTarget: { minHeight: control[44], justifyContent: 'center' },
  monthLink: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: control[26],
    borderRadius: radius[6],
    paddingHorizontal: space[8],
    gap: space[4],
  },
  smallText: { fontSize: font[11] },
  periodRow: { flexDirection: 'row', alignItems: 'center', gap: space[4] },
  periodCenter: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: space[6],
  },
  periodLabel: { fontSize: font[12], textAlign: 'center', flexShrink: 1 },
  periodTag: {
    fontSize: font[10],
    paddingHorizontal: space[6],
    paddingVertical: space[2],
    borderRadius: radius[4],
  },
  touchTarget: {
    width: control[44],
    height: control[44],
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrow: {
    width: control[24],
    height: control[24],
    borderWidth: 1,
    borderRadius: radius[6],
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: space[8],
  },
  title: { flex: 1, minWidth: 0 },
  progressTrack: {
    height: space[6],
    overflow: 'hidden',
    borderRadius: radius.full,
  },
  progressFill: { height: '100%', borderRadius: radius.full },
  taskLink: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: control[44],
    borderRadius: radius[6],
  },
  miniDays: { flexDirection: 'row', gap: space[6] },
  miniDay: {
    width: space[8],
    height: space[8],
    borderRadius: radius.full,
    borderWidth: 1,
  },
  barRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space[4] },
  barColumn: { flex: 1, minWidth: 0, alignItems: 'center', gap: space[8] },
  barTrack: {
    height: control[44] * 2,
    justifyContent: 'flex-end',
    width: '65%',
  },
  barFill: { borderRadius: radius[6] },
  calendar: { gap: space[4], marginTop: space[8] },
  calendarRow: { flexDirection: 'row', gap: space[4] },
  calendarPosition: { flex: 1, minWidth: 0, minHeight: control[26] },
  weekday: {
    fontSize: font[10],
    textAlign: 'center',
    textAlignVertical: 'center',
  },
  calendarCell: {
    flexDirection: 'row',
    gap: space[2],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: radius[6],
  },
  calendarNumber: { fontSize: font[10], textAlign: 'center' },
  dashed: { borderStyle: 'dashed' },
  calendarLegend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[8],
    marginTop: space[4],
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: space[4] },
  legendMark: {
    width: space[12],
    height: space[12],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: radius[4],
  },
});
