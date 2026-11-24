import React, { useMemo, useState } from 'react';
import {
  Platform,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { dateKey } from '../domain/engine';
import {
  buildTaskHistoryIndex,
  createTaskHistoryCalendar,
  initialTaskHistoryAnchor,
  type TaskHistoryDay,
} from '../domain/taskHistory';
import { useApp } from '../state/AppProvider';
import { ActionButton } from '../ui/components';
import {
  HistoryPanel,
  HistoryPeriodArrow,
  HistoryTabs,
} from '../ui/HistoryControls';
import { iconName, tint } from '../ui/theme';
import { useAppTheme } from '../ui/ThemeProvider';

const HISTORY_PERIODS = [
  { value: 'month', label: '月' },
  { value: 'week', label: '周' },
] as const;
const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'] as const;
type HistoryPeriod = (typeof HISTORY_PERIODS)[number]['value'];

function dateParts(date: string) {
  return {
    year: Number(date.slice(0, 4)),
    month: Number(date.slice(5, 7)),
    day: Number(date.slice(8, 10)),
  };
}

function dayLabel(date: string, withYear = false) {
  const { year, month, day } = dateParts(date);
  return `${withYear ? `${year}年` : ''}${month}月${day}日`;
}

function periodLabel(period: HistoryPeriod, start: string, end: string) {
  const { year, month } = dateParts(start);
  if (period === 'month') return `${year} 年 ${month} 月`;
  const crossesYear = start.slice(0, 4) !== end.slice(0, 4);
  return `${dayLabel(start, crossesYear)} – ${dayLabel(end, crossesYear)}`;
}

export function TaskHistoryScreen({
  taskId,
  initialDate,
}: {
  taskId: string;
  initialDate?: string;
}) {
  const { state, now } = useApp();
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const [period, setPeriod] = useState<HistoryPeriod>('month');
  const [pickedAnchor, setPickedAnchor] = useState<string | null>();
  const task = state.tasks.find((item) => item.id === taskId && !item.deleted);
  const index = useMemo(
    () => buildTaskHistoryIndex(state.tasks, state.checkins),
    [state.tasks, state.checkins],
  );
  const summary = index.get(taskId);
  if (!task || !summary) {
    return (
      <SafeAreaView edges={['bottom']} style={styles.page}>
        <Text
          accessibilityRole="header"
          style={[styles.empty, { color: colors.muted }]}
        >
          找不到这项任务
        </Text>
      </SafeAreaView>
    );
  }

  const today = dateKey(now);
  const initialAnchor = initialTaskHistoryAnchor(initialDate, today);
  const anchor =
    pickedAnchor === undefined ? initialAnchor : (pickedAnchor ?? today);
  const earliest =
    summary.firstDate && summary.firstDate < initialAnchor
      ? summary.firstDate
      : initialAnchor;
  const calendar = createTaskHistoryCalendar({
    period,
    anchor,
    today,
    earliest,
    summary,
  });
  const { previousAnchor, nextAnchor } = calendar;
  const unit = period === 'month' ? '月' : '周';
  const selectedLabel = calendar.isCurrent ? `本${unit}` : `所选${unit}`;

  return (
    <SafeAreaView
      edges={['bottom']}
      style={[styles.page, { backgroundColor: colors.background }]}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingHorizontal: width < 360 ? 12 : 16 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.taskHeading}>
          <View
            aria-hidden
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            style={[
              styles.taskIcon,
              { backgroundColor: tint(task.color, colors) },
            ]}
          >
            <Icon
              source={iconName(task.icon)}
              size={20}
              color={colors.primary}
            />
          </View>
          <Text
            accessibilityRole="header"
            style={[styles.name, { color: colors.ink }]}
          >
            {task.name}
          </Text>
        </View>
        <View style={styles.stats}>
          <HistoryStat label="累计打卡" value={summary.total} unit="次" />
          <View
            style={[styles.statDivider, { backgroundColor: colors.border }]}
          />
          <HistoryStat label="打卡天数" value={summary.days} unit="天" />
        </View>
        <HistoryTabs<HistoryPeriod>
          options={HISTORY_PERIODS}
          value={period}
          onChange={setPeriod}
          label="打卡记录查看方式"
          testID="task-history-period-tabs"
        />
        <HistoryPanel label={unit + '视图'}>
          <View style={styles.periodNavigation}>
            <HistoryPeriodArrow
              direction="left"
              label={`查看上一${unit}`}
              onPress={
                previousAnchor
                  ? () => setPickedAnchor(previousAnchor)
                  : undefined
              }
              testID="task-history-previous-period"
            />
            <Text
              accessibilityRole="header"
              style={[styles.periodTitle, { color: colors.ink }]}
            >
              {periodLabel(period, calendar.start, calendar.end)}
            </Text>
            <HistoryPeriodArrow
              direction="right"
              label={`查看下一${unit}`}
              onPress={
                nextAnchor ? () => setPickedAnchor(nextAnchor) : undefined
              }
              testID="task-history-next-period"
            />
          </View>
          <View style={styles.periodSummary}>
            <Text
              accessibilityLiveRegion="polite"
              style={[styles.caption, { color: colors.muted }]}
            >
              {selectedLabel} {calendar.total} 次 · {calendar.days} 天
            </Text>
            {!calendar.isCurrent ? (
              <ActionButton
                mode="text"
                testID="task-history-current-period"
                onPress={() => setPickedAnchor(null)}
              >
                回到本{unit}
              </ActionButton>
            ) : null}
          </View>
          <View testID="task-history-calendar">
            <View
              aria-hidden
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={[styles.weekdayRow, { borderBottomColor: colors.border }]}
            >
              {WEEKDAYS.map((day) => (
                <Text
                  key={day}
                  style={[
                    styles.weekday,
                    styles.caption,
                    { color: colors.muted },
                  ]}
                >
                  {day}
                </Text>
              ))}
            </View>
            {calendar.rows.map((row) => (
              <View
                key={row.find((day) => day !== null)?.date}
                style={styles.calendarRow}
              >
                {row.map((day, index) =>
                  day ? (
                    <HistoryDay
                      key={day.date}
                      day={day}
                      weekday={WEEKDAYS[index]}
                    />
                  ) : (
                    <View key={index} style={styles.day} />
                  ),
                )}
              </View>
            ))}
          </View>
          {calendar.total === 0 ? (
            <Text style={[styles.empty, { color: colors.muted }]}>
              {selectedLabel}暂无打卡记录
            </Text>
          ) : null}
          <View style={[styles.legend, { borderTopColor: colors.border }]}>
            <View style={styles.legendItem}>
              <HistoryMark count={1} decorative />
              <Text style={[styles.caption, { color: colors.muted }]}>
                打卡 1 次
              </Text>
            </View>
            <View style={[styles.legendItem, styles.legendTextItem]}>
              <Text
                aria-hidden
                accessibilityElementsHidden
                importantForAccessibility="no"
                style={[styles.caption, { color: colors.onSave }]}
              >
                ×2
              </Text>
              <Text style={[styles.caption, { color: colors.muted }]}>
                同日打卡 2 次
              </Text>
            </View>
          </View>
        </HistoryPanel>
      </ScrollView>
    </SafeAreaView>
  );
}

function HistoryStat({
  label,
  value,
  unit,
}: {
  label: string;
  value: number;
  unit: string;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.stat}>
      <Text style={[styles.caption, { color: colors.muted }]}>{label}</Text>
      <Text style={[styles.statNumber, { color: colors.ink }]}>
        {value}
        <Text style={[styles.caption, { color: colors.muted }]}> {unit}</Text>
      </Text>
    </View>
  );
}

function HistoryDay({
  day,
  weekday,
}: {
  day: TaskHistoryDay;
  weekday: string;
}) {
  const { colors, theme } = useAppTheme();
  const label = [
    dayLabel(day.date, true),
    `星期${weekday}`,
    day.isToday ? '今天' : '',
    day.count ? `打卡 ${day.count} 次` : day.isFuture ? '未来日期' : '未打卡',
  ]
    .filter(Boolean)
    .join('，');
  const isWeb = Platform.OS === 'web';
  return (
    <View
      accessible={!isWeb}
      accessibilityRole={isWeb ? undefined : 'text'}
      accessibilityLabel={isWeb ? undefined : label}
      testID={`task-history-day-${day.date}`}
      style={styles.day}
    >
      {isWeb ? <Text style={styles.visuallyHidden}>{label}</Text> : null}
      <View
        aria-hidden
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={styles.dayMarks}
      >
        <Text
          style={[
            styles.dayNumber,
            {
              color:
                day.isFuture && !day.count
                  ? theme.colors.onSurfaceDisabled
                  : colors.ink,
              fontWeight: day.isToday || day.count ? '600' : '400',
            },
          ]}
        >
          {dateParts(day.date).day}
        </Text>
        {day.count > 0 ? <HistoryMark count={day.count} /> : null}
        {day.isToday ? (
          <Text style={[styles.todayMark, { color: colors.muted }]}>今</Text>
        ) : null}
      </View>
    </View>
  );
}

function HistoryMark({
  count,
  decorative = false,
}: {
  count: number;
  decorative?: boolean;
}) {
  const { colors } = useAppTheme();
  return (
    <View
      aria-hidden={decorative}
      accessibilityElementsHidden={decorative}
      importantForAccessibility={decorative ? 'no-hide-descendants' : undefined}
      style={styles.mark}
    >
      {count === 1 ? (
        <View style={[styles.dot, { backgroundColor: colors.onSave }]} />
      ) : (
        <Text style={[styles.markText, { color: colors.onSave }]}>
          ×{count}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    paddingTop: 16,
    paddingBottom: 24,
  },
  taskHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  taskIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { flexShrink: 1, fontSize: 20, lineHeight: 28, fontWeight: '700' },
  stats: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginVertical: 20,
    gap: 20,
  },
  stat: { flex: 1, minWidth: 0, gap: 4 },
  statDivider: { width: 1 },
  statNumber: { fontSize: 32, lineHeight: 38, fontVariant: ['tabular-nums'] },
  caption: { fontSize: 12, lineHeight: 18 },
  periodNavigation: { flexDirection: 'row', alignItems: 'center' },
  periodTitle: { flex: 1, textAlign: 'center', fontSize: 16, lineHeight: 22 },
  periodSummary: {
    minHeight: 42,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  weekdayRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingVertical: 8,
  },
  weekday: { flex: 1, textAlign: 'center' },
  calendarRow: { flexDirection: 'row', alignItems: 'stretch' },
  day: { flex: 1, minWidth: 0, minHeight: 42, paddingVertical: 3 },
  dayMarks: { alignItems: 'center' },
  dayNumber: {
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 21,
    fontVariant: ['tabular-nums'],
  },
  todayMark: { textAlign: 'center', fontSize: 10, lineHeight: 14 },
  mark: { minHeight: 15, alignItems: 'center', justifyContent: 'center' },
  markText: { fontSize: 10, lineHeight: 14, textAlign: 'center' },
  dot: { width: 5, height: 5, borderRadius: 3 },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: 28,
    rowGap: 8,
    borderTopWidth: 1,
    marginTop: 16,
    paddingTop: 8,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendTextItem: { alignItems: 'baseline' },
  empty: { padding: 16, fontSize: 13, lineHeight: 20, textAlign: 'center' },
  visuallyHidden: {
    position: 'absolute',
    width: 1,
    height: 1,
    overflow: 'hidden',
  },
});
