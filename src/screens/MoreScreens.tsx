import React, { useState } from 'react';
import {
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  View,
} from 'react-native';
import { useNavigation, usePreventRemove } from '@react-navigation/native';
import { useHeaderHeight } from '@react-navigation/elements';
import { Icon, Text, TouchableRipple } from 'react-native-paper';
import { AppTextInput as TextInput } from '../ui/AppTextInput';
import { restoreTask, updateSettings } from '../domain/engine';
import type { Task } from '../domain/types';
import { useApp } from '../state/AppProvider';
import { ActionButton, Empty, Page, Panel } from '../ui/components';
import { iconName, tint } from '../ui/theme';
import { CompactSwitch } from '../ui/CompactSwitch';
import { useAppTheme } from '../ui/ThemeProvider';
import {
  themeOptions,
  getThemeOption,
  categoryInk,
  softThemeRoles,
  type ThemeOption,
} from '../ui/themeCatalog';
import { control, font, radius, space } from '../ui/uiTokens';
import { useKeyboardFocus } from '../ui/useKeyboardFocus';
import { TimeField } from '../ui/TimeField';
import { ProfileAvatar } from '../ui/ProfileAvatar';
import { DemoHistoryPanel } from '../ui/DemoHistoryPanel';
import { isAcceptanceDemoPreviewAllowed } from '../ui/demoPreviewAccess';
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
      description: '每个新刻度，都能解锁奖券',
      icon: 'flag-outline',
      color: colors.primaryContainer,
    },
    {
      route: 'growth',
      title: '成长记录',
      description: '查看每周总览和每个任务的打卡记录',
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
                  账户资料 · 本机保存，小组同步可见
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

export function ArchivedScreen() {
  const { colors, palette } = useAppTheme();
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
                    color={categoryInk(item.color, palette, colors.primary)}
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
  const {
    colors,
    palette,
    themeId,
    selectTheme,
    themeBusy,
    themeReady,
    themeError,
  } = useAppTheme();
  const weekdayBorder = palette ? softThemeRoles.borderSoft : colors.border;
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
  const expiryLocked = busy || !expiryEnabled;
  const canSave = !!rewardName.trim();
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
    if (busy || !canSave) return;
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
                  style={{
                    flexDirection: 'row',
                    flexWrap: 'wrap',
                    gap: space[6],
                  }}
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
                    <Text style={styles.muted}>
                      只影响以后兑换的打卡券；里程碑券永久有效
                    </Text>
                  </View>
                  <CompactSwitch
                    value={expiryEnabled}
                    disabled={busy}
                    onValueChange={setExpiryEnabled}
                    accessibilityLabel="启用每周奖券过期"
                  />
                </View>
                <View
                  testID="expiry-settings"
                  aria-disabled={!expiryEnabled}
                  style={styles.form}
                >
                  <Text style={expiryEnabled ? styles.body : styles.muted}>
                    下周哪一天过期？
                  </Text>
                  <ExpiryWeekdayPicker
                    value={expiryDay}
                    disabled={expiryLocked}
                    borderColor={weekdayBorder}
                    onChange={(day) => {
                      if (!expiryLocked) setExpiryDay(day);
                    }}
                  />
                  <TimeField
                    label="到期时间"
                    value={expiryTime}
                    onChange={(value) => {
                      if (!expiryLocked) setExpiryTime(value);
                    }}
                    disabled={expiryLocked}
                  />
                  <Text style={styles.muted}>
                    {expiryEnabled
                      ? `新兑换的打卡券将在下一周周${'一二三四五六日'[expiryDay - 1]} ${expiryTime} 到期，按手机本地时间计算。`
                      : '开启「每周奖券到期」后可设置'}
                  </Text>
                </View>
                <Text style={styles.muted}>
                  本周未兑换的打卡次数不会结转。已发奖券维持原有效期。
                </Text>
                <ErrorText message={error} />
                <ActionButton
                  mode="contained"
                  icon="check"
                  tone="save"
                  loading={busy}
                  disabled={busy || !canSave}
                  aria-disabled={busy || !canSave}
                  onPress={() => {
                    void save();
                  }}
                >
                  保存奖励规则
                </ActionButton>
              </View>
            </Panel>
            {(__DEV__ || isAcceptanceDemoPreviewAllowed()) && (
              <DemoHistoryPanel />
            )}
          </>
        )}
      </Page>
    </KeyboardAvoidingView>
  );
}

const EXPIRY_WEEKDAYS = '一二三四五六日';

function ExpiryWeekdayPicker({
  value,
  disabled,
  borderColor,
  onChange,
}: {
  value: number;
  disabled: boolean;
  borderColor: string;
  onChange: (day: number) => void;
}) {
  return (
    <View
      testID="expiry-weekdays"
      accessibilityRole="radiogroup"
      accessibilityLabel="到期星期"
      style={{ flexDirection: 'row' }}
    >
      {Array.from(EXPIRY_WEEKDAYS, (name, index) => (
        <ExpiryWeekday
          key={name}
          label={'周' + name}
          checked={value === index + 1}
          disabled={disabled}
          borderColor={borderColor}
          onPress={() => onChange(index + 1)}
          first={index === 0}
          last={index === EXPIRY_WEEKDAYS.length - 1}
        />
      ))}
    </View>
  );
}

function ExpiryWeekday({
  label,
  checked,
  disabled,
  borderColor,
  onPress,
  first,
  last,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  borderColor: string;
  onPress: () => void;
  first: boolean;
  last: boolean;
}) {
  const { colors, palette, theme } = useAppTheme();
  const focus = useKeyboardFocus();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked, disabled }}
      aria-checked={checked}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={onPress}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: control[44],
        justifyContent: 'center',
      }}
    >
      {({ pressed }) => (
        <View
          style={{
            minHeight: control[28],
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: disabled
              ? theme.colors.surfaceDisabled
              : checked || pressed
                ? colors.primaryContainer
                : colors.surface,
            borderColor,
            borderTopWidth: 1,
            borderBottomWidth: 1,
            borderLeftWidth: first ? 1 : 0,
            borderRightWidth: 1,
            borderTopLeftRadius: first ? radius[8] : 0,
            borderBottomLeftRadius: first ? radius[8] : 0,
            borderTopRightRadius: last ? radius[8] : 0,
            borderBottomRightRadius: last ? radius[8] : 0,
            ...(Platform.OS === 'web' && {
              outlineColor: colors.primary,
              outlineStyle: 'solid',
              outlineOffset: -2,
              outlineWidth: !disabled && focus.focusVisible ? 2 : 0,
            }),
          }}
        >
          <Text
            style={{
              fontSize: font[11],
              fontWeight: checked && !disabled ? '600' : '400',
              color:
                checked && !disabled
                  ? (palette?.brand.ink ?? colors.primary)
                  : colors.muted,
            }}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
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
  const focus = useKeyboardFocus();
  return (
    <TouchableRipple
      onPress={onPress}
      disabled={disabled}
      aria-disabled={disabled}
      rippleColor="transparent"
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      accessibilityRole="radio"
      accessibilityLabel={option.name + '，' + option.description}
      accessibilityState={{ checked: selected, disabled }}
      style={{
        flexBasis: '31%',
        flexGrow: 1,
        minHeight: control[44],
        minWidth: control[44],
        borderRadius: radius[8],
        borderWidth: 1,
        borderColor: selected ? colors.primary : colors.border,
        backgroundColor: selected ? colors.primaryContainer : colors.surface,
        outlineWidth: focus.focusVisible ? 2 : 0,
        outlineStyle: 'solid',
        outlineColor: colors.primary,
        outlineOffset: 2,
      }}
    >
      <View
        style={{
          alignItems: 'center',
          gap: space[4],
          padding: space[6],
          minWidth: 0,
        }}
      >
        <View
          style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}
          accessible={false}
          aria-hidden
          importantForAccessibility="no-hide-descendants"
        >
          {[
            ...(option.palette
              ? [
                  option.palette.brand.solid,
                  option.palette.accent.solid,
                  option.palette.c3.solid,
                  option.palette.c4.solid,
                ]
              : [
                  option.colors.brandFill,
                  option.signal ?? option.colors.primaryContainer,
                  option.colors.primary,
                ]),
          ].map((color, index) => (
            <View
              key={index}
              style={{
                width: space[8],
                height: space[8],
                borderRadius: radius.full,
                backgroundColor: color,
              }}
            />
          ))}
          {selected ? (
            <Icon source="check" size={font[12]} color={colors.primary} />
          ) : null}
        </View>
        <Text
          style={{
            fontSize: font[11],
            textAlign: 'center',
            color: disabled ? colors.muted : colors.ink,
          }}
        >
          {option.name}
        </Text>
      </View>
    </TouchableRipple>
  );
}
