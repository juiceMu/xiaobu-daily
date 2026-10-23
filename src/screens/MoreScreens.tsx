import React, { useState } from 'react';
import {
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  View,
} from 'react-native';
import { useNavigation, usePreventRemove } from '@react-navigation/native';
import { useHeaderHeight } from '@react-navigation/elements';
import { Icon, Switch, Text, TouchableRipple } from 'react-native-paper';
import { AppTextInput as TextInput } from '../ui/AppTextInput';
import {
  getWeekStats,
  restoreTask,
  updateSettings,
  weekKey,
} from '../domain/engine';
import type { Task } from '../domain/types';
import { useApp } from '../state/AppProvider';
import {
  ActionButton,
  Empty,
  Page,
  Panel,
  SectionTitle,
} from '../ui/components';
import { iconName, tint } from '../ui/theme';
import { useAppTheme } from '../ui/ThemeProvider';
import {
  themeOptions,
  getThemeOption,
  type ThemeOption,
} from '../ui/themeCatalog';
import { useKeyboardFocus } from '../ui/useKeyboardFocus';
import { TimeField } from '../ui/TimeField';
import { ProfileAvatar } from '../ui/ProfileAvatar';
import { DemoHistoryPanel } from '../ui/DemoHistoryPanel';
import { useAndroidMountReady } from '../ui/useAndroidMountReady';
import { Confirm, confirmDiscard, ErrorText, useScreenStyles } from './shared';

export type MoreRoute =
  | 'milestones'
  | 'growth'
  | 'archived'
  | 'settings'
  | 'gifts'
  | 'account'
  | 'group';
export function MoreScreen({
  onNavigate,
}: {
  onNavigate: (route: MoreRoute) => void;
}) {
  const { colors } = useAppTheme();
  const styles = useScreenStyles();
  const { state } = useApp();
  const entries: {
    route: MoreRoute;
    title: string;
    description: string;
    icon: string;
    color: string;
  }[] = [
    {
      route: 'group',
      title: '小组',
      description: '邀请成员，点同步后查看大家的打卡和奖券',
      icon: 'account-group-outline',
      color: colors.primaryContainer,
    },
    {
      route: 'gifts',
      title: '赠送与领取',
      description: '做一张心意券，扫码送给对方',
      icon: 'gift-outline',
      color: colors.peach,
    },
    {
      route: 'milestones',
      title: '里程碑',
      description: '每个新刻度，都值得一份永久奖励',
      icon: 'flag-outline',
      color: colors.primaryContainer,
    },
    {
      route: 'growth',
      title: '成长记录',
      description: '看看这一周积累的小小进步',
      icon: 'chart-bar',
      color: colors.blue,
    },
    {
      route: 'archived',
      title: '已归档任务',
      description:
        state.tasks.filter((task) => task.archived && !task.deleted).length +
        ' 个任务，历史打卡妥善保留',
      icon: 'archive-outline',
      color: colors.peach,
    },
    {
      route: 'settings',
      title: '设置',
      description: '切换主题，安排兑换规则与奖券有效期',
      icon: 'tune-variant',
      color: colors.purple,
    },
  ];
  return (
    <Page title="留一点空间，给自己" subtitle="目标、记录和奖励，都在这里。">
      <View style={[styles.column, styles.listHeader]}>
        <TouchableRipple
          onPress={() => {
            Keyboard.dismiss();
            onNavigate('account');
          }}
          accessibilityRole="button"
          accessibilityLabel="账户资料"
          style={{ borderRadius: 18, overflow: 'hidden' }}
        >
          <Panel style={styles.card}>
            <View style={styles.row}>
              <ProfileAvatar
                avatar={state.giftState?.profile.avatar}
                size={44}
              />
              <View style={styles.grow}>
                <Text style={styles.heading}>
                  {state.giftState?.profile.name ?? '设置头像和昵称'}
                </Text>
                <Text style={styles.muted}>
                  账户资料 · 仅本机，未登录云账户
                </Text>
              </View>
              <Icon source="chevron-right" size={20} color={colors.muted} />
            </View>
          </Panel>
        </TouchableRipple>
        {entries.map((entry) => (
          <TouchableRipple
            key={entry.route}
            onPress={() => {
              if (entry.route === 'group') Keyboard.dismiss();
              onNavigate(entry.route);
            }}
            accessibilityRole="button"
            accessibilityLabel={entry.title}
            style={{ borderRadius: 18, overflow: 'hidden' }}
          >
            <Panel style={styles.card}>
              <View style={styles.row}>
                <View style={[styles.icon, { backgroundColor: entry.color }]}>
                  <Icon source={entry.icon} size={20} color={colors.primary} />
                </View>
                <View style={styles.grow}>
                  <Text style={styles.heading}>{entry.title}</Text>
                  <Text style={styles.muted}>{entry.description}</Text>
                </View>
                <Icon source="chevron-right" size={20} color={colors.muted} />
              </View>
            </Panel>
          </TouchableRipple>
        ))}
        <Text style={[styles.muted, { textAlign: 'center', marginTop: 20 }]}>
          不必一下子很厉害，慢慢来就很好。
        </Text>
      </View>
    </Page>
  );
}

export function GrowthScreen() {
  const { colors } = useAppTheme();
  const styles = useScreenStyles();
  const { state, now } = useApp();
  const [offset, setOffset] = useState(0);
  const day = new Date(now);
  day.setDate(day.getDate() + offset * 7);
  const stats = getWeekStats(state, day);
  const week = weekKey(day);
  const max = Math.max(1, ...stats.days.map((entry) => entry.count));
  const tasks = state.tasks.filter(
    (task) =>
      !task.deleted &&
      state.checkins.some(
        (entry) => entry.taskId === task.id && entry.week === week,
      ),
  );
  return (
    <Page
      title="成长，有迹可循"
      subtitle="把每一个认真生活的日子，慢慢连起来。"
      scroll={false}
    >
      <FlatList
        style={styles.listViewport}
        data={tasks}
        keyExtractor={(task) => task.id}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <View style={[styles.column, styles.listHeader]}>
            <View style={[styles.actions, { justifyContent: 'space-between' }]}>
              <ActionButton
                mode="outlined"
                icon="chevron-left"
                onPress={() => setOffset(offset - 1)}
              >
                上一周
              </ActionButton>
              <ActionButton
                mode="text"
                disabled={offset === 0}
                onPress={() => setOffset(0)}
              >
                本周
              </ActionButton>
              <ActionButton
                mode="outlined"
                icon="chevron-right"
                disabled={offset >= 0}
                onPress={() => setOffset(offset + 1)}
              >
                下一周
              </ActionButton>
            </View>
            <Panel style={styles.card}>
              <Text style={styles.muted}>{week} 开始的一周</Text>
              <Text style={styles.number}>
                {stats.total}
                <Text style={styles.body}> 次打卡</Text>
              </Text>
              <Text style={styles.muted}>这一周，每一次努力都算数。</Text>
              <View style={[styles.row, { alignItems: 'flex-end', gap: 4 }]}>
                {stats.days.map((entry, index) => (
                  <View
                    key={entry.date}
                    style={{ flex: 1, alignItems: 'center', gap: 8 }}
                    accessible
                    accessibilityLabel={
                      '周' +
                      '一二三四五六日'[index] +
                      '，' +
                      entry.count +
                      '次打卡'
                    }
                  >
                    <Text style={styles.body}>{entry.count}</Text>
                    <View
                      style={{
                        height: 104,
                        justifyContent: 'flex-end',
                        width: '65%',
                      }}
                    >
                      <View
                        style={{
                          height: Math.max(4, (entry.count / max) * 104),
                          backgroundColor: colors.primary,
                          borderRadius: 8,
                        }}
                      />
                    </View>
                    <Text style={styles.muted}>{'一二三四五六日'[index]}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.muted}>
                横轴：周一至周日 · 数字为每日打卡次数
              </Text>
            </Panel>
            <SectionTitle title="每个任务的小积累" />
          </View>
        }
        ListEmptyComponent={
          <Empty
            title="这一周还很安静"
            description={
              stats.total > 0
                ? '本周次数已计入上方统计，已删除的任务不再单独列出。'
                : '去今日打卡完成一个小任务，再回来看看吧。'
            }
          />
        }
        renderItem={({ item }) => (
          <Panel style={styles.card}>
            <View style={styles.row}>
              <View
                style={[
                  styles.icon,
                  { backgroundColor: tint(item.color, colors) },
                ]}
              >
                <Icon
                  source={iconName(item.icon)}
                  size={24}
                  color={colors.primary}
                />
              </View>
              <View style={styles.grow}>
                <Text style={styles.heading}>{item.name}</Text>
                <Text style={styles.muted}>
                  {item.archived
                    ? '已归档 · 历史保留'
                    : '每日目标 ' + item.target + ' 次'}
                </Text>
              </View>
              <Text style={styles.heading}>
                {
                  state.checkins.filter(
                    (entry) => entry.taskId === item.id && entry.week === week,
                  ).length
                }{' '}
                次
              </Text>
            </View>
          </Panel>
        )}
      />
    </Page>
  );
}

export function ArchivedScreen() {
  const { colors } = useAppTheme();
  const styles = useScreenStyles();
  const { state, run, busy } = useApp();
  const [selected, setSelected] = useState<Task | null>(null);
  const [error, setError] = useState('');
  return (
    <Page
      title="暂时收好，也不遗忘"
      subtitle="已归档的任务不会出现在今日列表，历史打卡仍然保留。"
      scroll={false}
    >
      <FlatList
        style={styles.listViewport}
        data={state.tasks.filter((task) => task.archived && !task.deleted)}
        keyExtractor={(task) => task.id}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <Empty
            title="还没有归档任务"
            description="在今日任务中选择归档后，就能在这里找到，也可以随时恢复。"
          />
        }
        renderItem={({ item }) => {
          const checkins = state.checkins.filter(
            (entry) => entry.taskId === item.id,
          );
          return (
            <Panel style={styles.card}>
              <View style={styles.row}>
                <View
                  style={[
                    styles.icon,
                    { backgroundColor: tint(item.color, colors) },
                  ]}
                >
                  <Icon
                    source={iconName(item.icon)}
                    size={24}
                    color={colors.primary}
                  />
                </View>
                <View style={styles.grow}>
                  <Text style={styles.heading}>{item.name}</Text>
                  <Text style={styles.muted}>原每日目标 {item.target} 次</Text>
                </View>
              </View>
              <Text style={styles.body}>
                累计 {checkins.length} 次 · 坚持{' '}
                {new Set(checkins.map((entry) => entry.date)).size} 天
              </Text>
              <ActionButton
                mode="outlined"
                icon="restore"
                tone="save"
                disabled={busy}
                onPress={() => {
                  setSelected(item);
                  setError('');
                }}
              >
                恢复任务
              </ActionButton>
            </Panel>
          );
        }}
      />
      <Confirm
        visible={!!selected}
        title="恢复这个任务？"
        description={
          '「' +
          (selected?.name || '') +
          '」会重新出现在今日打卡，原有记录保持不变。'
        }
        busy={busy}
        error={error}
        onDismiss={() => {
          if (!busy) setSelected(null);
        }}
        onConfirm={() => {
          if (selected)
            void run((draft) => restoreTask(draft, selected.id)).then(
              (result) => {
                if (result.ok) setSelected(null);
                else setError(result.message);
              },
            );
        }}
      />
    </Page>
  );
}

export function SettingsScreen() {
  const { themeId, selectTheme, themeBusy, themeReady, themeError } =
    useAppTheme();
  const styles = useScreenStyles();
  const { state, busy, run } = useApp();
  const navigation = useNavigation();
  const headerHeight = useHeaderHeight();
  const mountReady = useAndroidMountReady();
  const [threshold, setThreshold] = useState(String(state.settings.threshold));
  const [rewardName, setRewardName] = useState(state.settings.rewardName);
  const [expiryEnabled, setExpiryEnabled] = useState(
    state.settings.expiryEnabled,
  );
  const [expiryDay, setExpiryDay] = useState(state.settings.expiryDay);
  const [expiryTime, setExpiryTime] = useState(state.settings.expiryTime);
  const [error, setError] = useState('');
  const dirty =
    threshold !== String(state.settings.threshold) ||
    rewardName !== state.settings.rewardName ||
    expiryEnabled !== state.settings.expiryEnabled ||
    expiryDay !== state.settings.expiryDay ||
    expiryTime !== state.settings.expiryTime;
  usePreventRemove(dirty || busy, ({ data }) => {
    if (busy) return;
    confirmDiscard(
      '放弃未保存的设置？',
      '这次修改还没有保存，返回后将不会保留。',
      () => navigation.dispatch(data.action),
    );
  });
  async function save() {
    if (busy) return;
    const result = await run((draft) =>
      updateSettings(draft, {
        threshold,
        rewardName,
        expiryEnabled,
        expiryDay,
        expiryTime,
      }),
    );
    setError(result.ok ? '' : result.message);
    if (result.ok) {
      setThreshold(String(Number(threshold)));
      setRewardName(rewardName.trim());
    }
  }
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={headerHeight}
    >
      <Page
        title="给努力，一点小奖励"
        subtitle="规则和颜色，都可以按自己的节奏来。"
      >
        {!mountReady ? (
          <Panel style={styles.card}>
            <View collapsable={false} style={{ minHeight: 120 }} />
          </Panel>
        ) : (
          <>
            <Panel style={styles.card}>
              <View style={styles.form}>
                <Text accessibilityRole="header" style={styles.heading}>
                  外观主题
                </Text>
                <Text style={styles.muted}>
                  当前主题：{getThemeOption(themeId).name}
                  。选择后即时应用并保存，不影响下方未保存的奖励规则。
                </Text>
                <View
                  accessibilityRole="radiogroup"
                  accessibilityLabel="外观主题"
                  style={styles.column}
                >
                  {themeOptions.map((option) => (
                    <ThemeChoice
                      key={option.id}
                      option={option}
                      selected={themeId === option.id}
                      disabled={themeBusy || !themeReady}
                      onPress={() => {
                        void selectTheme(option.id);
                      }}
                    />
                  ))}
                </View>
                {themeBusy && (
                  <Text style={styles.muted} accessibilityLiveRegion="polite">
                    正在保存主题…
                  </Text>
                )}
                <ErrorText message={themeError} />
              </View>
            </Panel>
            <Panel style={styles.card}>
              <View style={styles.form}>
                <TextInput
                  dense
                  mode="outlined"
                  label="每多少次打卡兑换一张（1–999）"
                  numericRule={{ kind: 'integer', min: 1, max: 999 }}
                  validationVisible={!!error}
                  value={threshold}
                  onChangeText={setThreshold}
                  keyboardType="number-pad"
                  disabled={busy}
                />
                <TextInput
                  dense
                  mode="outlined"
                  label="奖券名称（必填）"
                  value={rewardName}
                  onChangeText={setRewardName}
                  maxLength={30}
                  disabled={busy}
                />
                <View style={styles.row}>
                  <View style={styles.grow}>
                    <Text style={styles.heading}>每周奖券到期</Text>
                    <Text style={styles.muted}>只影响以后兑换的打卡奖券</Text>
                  </View>
                  <View
                    style={{
                      minHeight: 48,
                      minWidth: 48,
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Switch
                      value={expiryEnabled}
                      disabled={busy}
                      onValueChange={setExpiryEnabled}
                      accessibilityLabel="启用每周奖券过期"
                    />
                  </View>
                </View>
                {expiryEnabled && (
                  <>
                    <Text style={styles.body}>下周哪一天过期？</Text>
                    <View style={[styles.actions, { marginTop: 0 }]}>
                      {Array.from({ length: 7 }, (_, index) => index + 1).map(
                        (day) => (
                          <ActionButton
                            key={day}
                            accessibilityLabel={
                              '周' + '一二三四五六日'[day - 1]
                            }
                            mode={expiryDay === day ? 'contained' : 'outlined'}
                            accessibilityState={{ selected: expiryDay === day }}
                            disabled={busy}
                            onPress={() => setExpiryDay(day)}
                          >
                            周{'一二三四五六日'[day - 1]}
                          </ActionButton>
                        ),
                      )}
                    </View>
                    <TimeField
                      label="到期时间"
                      value={expiryTime}
                      onChange={setExpiryTime}
                      disabled={busy}
                    />
                    <Text style={styles.muted}>
                      新兑换的奖券将在下一周周{'一二三四五六日'[expiryDay - 1]}{' '}
                      {expiryTime} 到期，按手机本地时间计算。
                    </Text>
                  </>
                )}
                {!expiryEnabled && (
                  <Text style={styles.muted}>
                    以后兑换的打卡奖券将永久有效。
                  </Text>
                )}
                <Text style={styles.muted}>
                  本周未兑换的打卡次数不会结转。里程碑奖券始终永久有效；已发奖券维持原有效期。
                </Text>
                <ErrorText message={error} />
                <ActionButton
                  mode="contained"
                  icon="check"
                  tone="save"
                  loading={busy}
                  disabled={busy}
                  onPress={() => {
                    void save();
                  }}
                >
                  保存奖励规则
                </ActionButton>
              </View>
            </Panel>
            {__DEV__ && <DemoHistoryPanel />}
          </>
        )}
      </Page>
    </KeyboardAvoidingView>
  );
}

function ThemeChoice({
  option,
  selected,
  disabled,
  onPress,
}: {
  option: ThemeOption;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  const styles = useScreenStyles();
  const focus = useKeyboardFocus();
  const [hovered, setHovered] = useState(false);
  return (
    <TouchableRipple
      onPress={onPress}
      disabled={disabled}
      rippleColor="transparent"
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      accessibilityRole="radio"
      accessibilityLabel={option.name + '，' + option.description}
      accessibilityState={{ checked: selected, disabled }}
      style={{
        borderRadius: 12,
        overflow: 'hidden',
        minHeight: 48,
        borderWidth: 0,
        backgroundColor:
          selected || hovered ? colors.primaryContainer : colors.field,
        opacity: disabled ? 0.6 : 1,
        outlineWidth: focus.focusVisible ? 2 : 0,
        outlineStyle: 'solid',
        outlineColor: colors.primary,
        outlineOffset: -2,
      }}
    >
      <View style={[styles.row, { padding: 10 }]}>
        <View
          style={{ flexDirection: 'row', gap: 3 }}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
        >
          {[
            option.colors.brandFill,
            option.colors.primaryContainer,
            option.colors.primary,
          ].map((color, index) => (
            <View
              key={index}
              style={{
                width: 14,
                height: 24,
                borderRadius: 6,
                backgroundColor: color,
              }}
            />
          ))}
        </View>
        <View style={styles.grow}>
          <Text style={styles.heading}>{option.name}</Text>
          <Text style={styles.muted}>{option.description}</Text>
        </View>
        <Icon
          source={selected ? 'radiobox-marked' : 'radiobox-blank'}
          size={20}
          color={colors.primary}
        />
      </View>
    </TouchableRipple>
  );
}
