import React, { useEffect, useRef, useState } from 'react';
import { useNavigation, type NavigationProp } from '@react-navigation/native';
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Icon,
  TextInput as PaperTextInput,
  Text,
  TouchableRipple,
} from 'react-native-paper';
import { AppTextInput as TextInput } from '../ui/AppTextInput';
import { useKeyboardFocus } from '../ui/useKeyboardFocus';
import { nextTicketLandingId } from '../ui/ticketLandingId';
import {
  addMilestoneGoal,
  archiveMilestoneGoal,
  deleteMilestoneGoal,
  recordMilestoneValue,
  restoreMilestoneGoal,
  setMilestoneEnabled,
  updateMilestoneGoal,
  updateMilestoneIcon,
} from '../domain/engine';
import type {
  MilestoneDirection,
  MilestoneGoal,
  MilestoneIcon,
} from '../domain/types';
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
import { iconName } from '../ui/theme';
import { useAppTheme } from '../ui/ThemeProvider';
import { control, font, radius, space } from '../ui/uiTokens';
import { milestoneRewardExpiries, unlockedRewards } from '../ui/rewardHistory';
import { formatTicketExpiry } from '../ui/ticketLabels';
import { milestoneGroups, selectMilestone } from '../ui/milestoneSelection';
import { milestoneUnitError } from '../domain/milestoneUnit.mjs';
import { Confirm, discardDraft, ErrorText, useScreenStyles } from './shared';

const MILESTONES_PER_PAGE = 2;

type GoalForm = {
  id?: string;
  name: string;
  unit: string;
  direction: MilestoneDirection;
  startWeight: string;
  step: string;
  icon: MilestoneIcon;
  locked: boolean;
};
function MilestoneTab({
  item,
  selected,
  alternate,
  disabled,
  onPress,
}: {
  item: MilestoneGoal;
  selected: boolean;
  alternate: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  const keyboardFocus = useKeyboardFocus();
  return (
    <TouchableRipple
      testID="milestone-goal-tab"
      disabled={disabled}
      onPress={onPress}
      rippleColor={'transparent'}
      onFocus={keyboardFocus.onFocus}
      onBlur={keyboardFocus.onBlur}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      aria-pressed={selected}
      aria-disabled={disabled}
      accessibilityLabel={
        item.name +
        (item.archived ? '，已归档' : item.enabled ? '，进行中' : '，已暂停')
      }
      style={{
        flex: 1,
        minWidth: 0,
        minHeight: control[44],
        borderRadius: radius[10],
        justifyContent: 'center',
        backgroundColor: 'transparent',
      }}
    >
      <View
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: space[6],
            minHeight: control[44],
            borderRadius: radius[10],
            paddingHorizontal: space[10],
            paddingVertical: space[6],
            borderWidth: 1,
            borderColor: selected && !disabled ? colors.primary : colors.border,
            backgroundColor: disabled
              ? colors.field
              : alternate
                ? colors.purple
                : colors.peach,
          },
          Platform.OS === 'web' && {
            outlineWidth: !disabled && keyboardFocus.focusVisible ? 2 : 0,
            outlineStyle: 'solid',
            outlineColor: colors.primary,
            outlineOffset: 2,
          },
        ]}
      >
        <Icon
          source={iconName(item.icon)}
          size={font[18]}
          color={disabled ? colors.muted : colors.primary}
        />
        <Text
          numberOfLines={1}
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: font[13],
            fontWeight: selected ? '600' : '400',
            color: disabled ? colors.muted : colors.ink,
          }}
        >
          {item.name}
        </Text>
        {selected && (
          <Icon
            source="check"
            size={font[14]}
            color={disabled ? colors.muted : colors.primary}
          />
        )}
      </View>
    </TouchableRipple>
  );
}
function MilestonePageDot({
  label,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  const focus = useKeyboardFocus();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      aria-pressed={selected}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={onPress}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      style={{
        width: control[44],
        height: control[44],
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: space[8],
          height: space[8],
          borderRadius: radius.full,
          borderWidth: 1,
          borderColor: colors.muted,
          backgroundColor:
            selected && !disabled ? colors.primary : colors.surface,
          ...(focus.focusVisible && !disabled && Platform.OS === 'web'
            ? {
                outlineWidth: 2,
                outlineColor: colors.primary,
                outlineStyle: 'solid',
                outlineOffset: 2,
              }
            : {}),
        }}
      />
    </Pressable>
  );
}
const rewardButtonContent = {
  minHeight: 26,
  marginVertical: Platform.OS === 'web' ? 7 : 11,
};
const rewardButtonLabel = { fontSize: 12, lineHeight: 18, marginVertical: 4 };
function RewardRow({
  value,
  goal,
  expiresAt,
}: {
  value: number;
  goal: MilestoneGoal;
  expiresAt?: string | null;
}) {
  const { colors } = useAppTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 6,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        paddingVertical: 6,
      }}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 10,
          backgroundColor: colors.primaryContainer,
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Icon source={iconName(goal.icon)} size={14} color={colors.primary} />
      </View>
      <Text
        style={{
          flexGrow: 1,
          flexShrink: 1,
          fontSize: 12,
          lineHeight: 18,
          color: colors.ink,
        }}
      >
        首次达到{value}
        {goal.unit}
      </Text>
      <Text style={{ fontSize: 12, lineHeight: 18, color: colors.muted }}>
        已发放 ·{' '}
        {expiresAt === undefined
          ? '未查到到期信息'
          : formatTicketExpiry(expiresAt)}
      </Text>
    </View>
  );
}
export function MilestonesScreen() {
  const { colors, quiet } = useAppTheme();
  const styles = useScreenStyles();
  const navigation = useNavigation<
    NavigationProp<{
      tickets: { intent: 'own-available'; at: number } | undefined;
    }>
  >();
  const { state, run, busy } = useApp();
  const groups = milestoneGroups([state.weight, ...state.milestoneGoals]);
  const [archiveFilter, setArchiveFilter] = useState(false);
  const [selectedId, setSelectedId] = useState('');
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchFocus = useKeyboardFocus();
  const goals = archiveFilter ? groups.archived : groups.current;
  const { visible: visibleGoals, selected: goal } = selectMilestone(
    goals,
    selectedId,
    search,
  );
  const tabList = useRef<FlatList<MilestoneGoal[]>>(null);
  const [pagerWidth, setPagerWidth] = useState(0);
  const selectedIndex = visibleGoals.findIndex((item) => item.id === goal?.id);
  const selectedPage = Math.max(
    0,
    Math.floor(selectedIndex / MILESTONES_PER_PAGE),
  );
  const pages = Array.from(
    { length: Math.ceil(visibleGoals.length / MILESTONES_PER_PAGE) },
    (_, page) =>
      visibleGoals.slice(
        page * MILESTONES_PER_PAGE,
        (page + 1) * MILESTONES_PER_PAGE,
      ),
  );
  const isArchived = goal?.archived === true;
  useEffect(() => {
    if (pagerWidth > 0 && selectedIndex >= 0) {
      tabList.current?.scrollToOffset({
        offset: selectedPage * pagerWidth,
        animated: false,
      });
    }
  }, [pagerWidth, selectedIndex, selectedPage, archiveFilter, search]);
  const rewards = goal ? unlockedRewards(goal) : [];
  const rewardExpiries = goal
    ? milestoneRewardExpiries(state.tickets, goal.id)
    : undefined;
  const [historyOpen, setHistoryOpen] = useState(false);
  const [form, setForm] = useState<GoalForm | null>(null);
  const [record, setRecord] = useState('');
  const [recordOpen, setRecordOpen] = useState(false);
  const [error, setError] = useState('');
  const [recordError, setRecordError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [archiving, setArchiving] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [initialForm, setInitialForm] = useState('');
  function selectPage(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (pagerWidth <= 0 || busy) return;
    const position = event.nativeEvent.contentOffset.x;
    const nextPage = Math.round(position / pagerWidth);
    // Web 只派发滚动事件。等页面吸附到位后再更新选择。
    if (Platform.OS === 'web' && Math.abs(position - nextPage * pagerWidth) > 1)
      return;
    const nextGoal = pages[nextPage]?.[0];
    if (nextGoal && nextPage !== selectedPage) {
      setSelectedId(nextGoal.id);
      setError('');
    }
  }
  function openForm(current?: MilestoneGoal) {
    setError('');
    const next: GoalForm = current
      ? {
          id: current.id,
          name: current.name,
          unit: current.unit,
          direction: current.direction,
          startWeight: String(current.startWeight),
          step: String(current.step),
          icon: current.icon || '🌱',
          locked: current.entries.length > 0,
        }
      : {
          name: '',
          unit: '',
          direction: 'increase',
          startWeight: '0',
          step: '1',
          icon: '🌱',
          locked: false,
        };
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
      form.id
        ? form.locked
          ? updateMilestoneIcon(draft, form.id, form.icon)
          : updateMilestoneGoal(draft, form.id, form)
        : addMilestoneGoal(draft, form),
    );
    if (result.ok) {
      if (result.goal) {
        setSelectedId(result.goal.id);
        setArchiveFilter(false);
        setSearch('');
      }
      setForm(null);
    } else setError(result.message);
  }
  async function saveRecord() {
    if (!goal || busy || isArchived) return;
    const result = await run((draft) =>
      recordMilestoneValue(draft, goal.id, record, new Date()),
    );
    if (result.ok) {
      setRecordOpen(false);
      setRecord('');
    } else setRecordError(result.message);
  }
  const latest = goal?.entries.at(-1);
  const invalidUnit = goal ? milestoneUnitError(goal.unit) : '';
  const next =
    goal &&
    Math.round(
      (Number(goal.startWeight) +
        (goal.direction === 'increase' ? 1 : -1) *
          (goal.unlockedMilestones.length + 1) *
          goal.step) *
        10,
    ) / 10;
  return (
    <Page title="里程碑" subtitle="到达新刻度解锁 1 张奖券，同样适用到期规则。">
      <ActionButton
        mode="contained"
        icon="plus"
        disabled={busy}
        onPress={() => openForm()}
      >
        新增里程碑
      </ActionButton>
      <View style={styles.actions}>
        <ActionButton
          disabled={busy}
          mode={!archiveFilter ? 'contained-tonal' : 'text'}
          accessibilityState={{ selected: !archiveFilter }}
          onPress={() => {
            setArchiveFilter(false);
            setSearch('');
            setError('');
          }}
        >
          当前 {groups.current.length}
        </ActionButton>
        <ActionButton
          disabled={busy}
          mode={archiveFilter ? 'contained-tonal' : 'text'}
          accessibilityState={{ selected: archiveFilter }}
          onPress={() => {
            setArchiveFilter(true);
            setSearch('');
            setError('');
          }}
        >
          已归档 {groups.archived.length}
        </ActionButton>
        <ActionButton
          disabled={busy}
          mode="text"
          icon="magnify"
          onPress={() => {
            setSearchOpen(!searchOpen);
            if (searchOpen) setSearch('');
          }}
        >
          {searchOpen ? '收起搜索' : '搜索'}
        </ActionButton>
      </View>
      {searchOpen && (
        <TextInput
          dense
          mode="outlined"
          value={search}
          editable={!busy}
          onChangeText={setSearch}
          placeholder="搜索里程碑"
          accessibilityLabel="搜索里程碑"
          accessibilityRole="search"
          returnKeyType="search"
          onFocus={searchFocus.onFocus}
          onBlur={searchFocus.onBlur}
          style={[
            { minHeight: 44 },
            Platform.OS === 'web' && {
              outlineWidth: searchFocus.focusVisible ? 2 : 0,
              outlineStyle: 'solid',
              outlineColor: colors.primary,
              outlineOffset: 2,
            },
          ]}
          left={
            <PaperTextInput.Icon
              icon="magnify"
              size={16}
              accessibilityLabel="聚焦搜索"
              disabled={busy}
              forceTextInputFocus
            />
          }
          right={
            search ? (
              <PaperTextInput.Icon
                icon="close"
                size={16}
                accessibilityLabel="清除搜索"
                disabled={busy}
                onPress={() => setSearch('')}
              />
            ) : undefined
          }
        />
      )}
      {visibleGoals.length > 0 && (
        <View
          style={{ gap: space[4] }}
          onLayout={({ nativeEvent }) =>
            setPagerWidth(nativeEvent.layout.width)
          }
        >
          {pagerWidth > 0 && (
            <FlatList
              ref={tabList}
              testID="milestone-inline-tabs"
              accessibilityLabel="选择里程碑"
              scrollEnabled={!busy}
              horizontal
              pagingEnabled
              data={pages}
              keyExtractor={(items) => items[0].id}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}
              extraData={goal?.id}
              getItemLayout={(_, index) => ({
                length: pagerWidth,
                offset: pagerWidth * index,
                index,
              })}
              onScroll={Platform.OS === 'web' ? selectPage : undefined}
              onMomentumScrollEnd={selectPage}
              renderItem={({ item }) => (
                <View
                  style={{
                    width: pagerWidth,
                    flexDirection: 'row',
                    gap: space[8],
                  }}
                >
                  {item.map((member, index) => (
                    <MilestoneTab
                      key={member.id}
                      item={member}
                      selected={goal?.id === member.id}
                      alternate={index === 1}
                      disabled={busy}
                      onPress={() => {
                        setSelectedId(member.id);
                        setError('');
                      }}
                    />
                  ))}
                  {item.length === 1 && <View style={{ flex: 1 }} />}
                </View>
              )}
            />
          )}
          {pages.length > 1 && (
            <View
              testID="milestone-page-dots"
              style={{
                flexDirection: 'row',
                justifyContent: 'center',
                flexWrap: 'wrap',
              }}
            >
              {pages.map((items, index) => (
                <MilestonePageDot
                  key={items[0].id}
                  label={`第 ${index + 1} 页，共 ${pages.length} 页`}
                  selected={index === selectedPage}
                  disabled={busy}
                  onPress={() => {
                    if (index !== selectedPage) {
                      setSelectedId(items[0].id);
                      setError('');
                    }
                  }}
                />
              ))}
            </View>
          )}
        </View>
      )}
      {!goal ? (
        <Empty
          title={
            search
              ? '没有找到这个目标'
              : archiveFilter
                ? '还没有归档的里程碑'
                : groups.archived.length
                  ? '当前目标都已收好'
                  : '你想向哪个方向成长？'
          }
          description={
            search
              ? '试试其他关键词，或清空搜索查看全部。'
              : archiveFilter
                ? '归档后会保留记录与奖励，可以随时恢复。'
                : groups.archived.length
                  ? '点击上方“已归档”查看并恢复；暂停的目标仍会保留在当前列表。'
                  : '体重、阅读、存钱都可以。设置起点、方向与差值，开始积累自己的小成就。'
          }
        />
      ) : (
        <>
          <Panel style={styles.card}>
            <Text style={styles.heading}>{goal.name}</Text>
            <View style={[styles.row, { flexWrap: 'wrap' }]}>
              <View style={styles.stat}>
                <Text style={styles.muted}>
                  {latest ? '当前数值' : '起始数值'}
                </Text>
                <Text style={styles.number}>
                  {latest?.weight ?? goal.startWeight}
                </Text>
                <Text style={styles.muted}>单位：{goal.unit}</Text>
              </View>
              <View
                style={[
                  styles.stat,
                  quiet
                    ? { borderLeftWidth: 1, borderLeftColor: colors.border }
                    : { backgroundColor: colors.purple },
                ]}
              >
                <Text style={styles.muted}>累计解锁</Text>
                <Text style={styles.number}>
                  {goal.unlockedMilestones.length}
                  <Text style={styles.body}> 张</Text>
                </Text>
              </View>
            </View>
            {invalidUnit ? (
              <ErrorText
                message={
                  `单位“${goal.unit}”疑似误填。起始数值实际为 ${goal.startWeight}。` +
                  (goal.entries.length
                    ? '已有记录，规则已锁定；请新建单位正确的目标，原记录和奖券保留。'
                    : '请打开“规则与图标”，分别填写起始数值和单位。')
                }
              />
            ) : (
              <Text style={styles.body}>
                每{goal.direction === 'increase' ? '增加' : '减少'} {goal.step}{' '}
                {goal.unit}，解锁一张。
              </Text>
            )}
            {!invalidUnit && (
              <Text style={styles.muted}>
                {Number(next) >= 0 && Number(next) <= 1000000
                  ? '下一个里程碑：' + next + ' ' + goal.unit
                  : '已到达当前方向的数值边界'}
              </Text>
            )}
            <Text style={styles.muted}>
              {isArchived ? '已归档 · 归档前' : ''}
              {goal.enabled ? '进行中' : '已暂停'} ·
              重复到达不会重复奖励；一次跨过多个刻度会逐一补发。
            </Text>
            {isArchived ? (
              <ActionButton
                mode="contained-tonal"
                icon="archive-arrow-up-outline"
                tone="save"
                disabled={busy}
                onPress={() => {
                  setError('');
                  void run((draft) =>
                    restoreMilestoneGoal(draft, goal.id),
                  ).then((result) => {
                    if (result.ok) {
                      setArchiveFilter(false);
                      setSearch('');
                      setSelectedId(goal.id);
                    } else setError(result.message);
                  });
                }}
              >
                恢复到当前
              </ActionButton>
            ) : (
              <>
                <ActionButton
                  mode="contained"
                  icon="pencil-plus-outline"
                  disabled={busy || !goal.enabled || !!invalidUnit}
                  style={styles.card}
                  onPress={() => {
                    setRecordError('');
                    setRecord('');
                    setRecordOpen(true);
                  }}
                >
                  记录新数值
                </ActionButton>
                <View style={styles.actions}>
                  <ActionButton
                    mode="outlined"
                    disabled={busy}
                    onPress={() => openForm(goal)}
                  >
                    规则与图标
                  </ActionButton>
                  <ActionButton
                    mode="text"
                    disabled={busy}
                    onPress={() => {
                      void run((draft) =>
                        setMilestoneEnabled(draft, goal.id, !goal.enabled),
                      );
                    }}
                  >
                    {goal.enabled ? '暂停' : '继续记录'}
                  </ActionButton>
                </View>
              </>
            )}
            <ErrorText message={error} />
          </Panel>
          {!isArchived && (
            <View style={{ gap: 4 }}>
              <Text style={styles.muted}>
                暂停仍留在当前列表；归档会收起目标，记录与奖励都会保留。
              </Text>
              <ActionButton
                mode="text"
                icon="archive-outline"
                tone="archive"
                disabled={busy}
                onPress={() => {
                  setError('');
                  setArchiving({ id: goal.id, name: goal.name });
                }}
              >
                归档此里程碑
              </ActionButton>
            </View>
          )}
          <Panel style={[styles.card, { padding: 10, gap: 4 }]}>
            <SectionTitle
              title="已解锁的奖励"
              titleStyle={{ fontSize: 13, lineHeight: 20, fontWeight: '500' }}
              action={
                <ActionButton
                  mode="text"
                  contentStyle={rewardButtonContent}
                  labelStyle={rewardButtonLabel}
                  onPress={() =>
                    navigation.navigate('tickets', {
                      intent: 'own-available',
                      at: nextTicketLandingId(),
                    })
                  }
                >
                  查看奖券
                </ActionButton>
              }
            />
            {rewards.length ? (
              rewards
                .slice(0, 6)
                .map((value) => (
                  <RewardRow
                    key={value}
                    value={value}
                    goal={goal}
                    expiresAt={rewardExpiries?.get(value)}
                  />
                ))
            ) : (
              <Empty
                title="还没有解锁奖励"
                description="首次达到新的里程碑后，奖励会出现在这里。普通记录不会重复发券。"
              />
            )}
            {rewards.length > 6 && (
              <ActionButton
                mode="text"
                contentStyle={rewardButtonContent}
                labelStyle={rewardButtonLabel}
                onPress={() => setHistoryOpen(true)}
              >
                查看全部 {rewards.length} 项奖励
              </ActionButton>
            )}
          </Panel>
          {isArchived && (
            <Panel style={[styles.card, { padding: 12, gap: 8 }]}>
              <SectionTitle title="归档前的记录" />
              {goal.entries.length ? (
                <>
                  <Text style={styles.muted}>
                    共 {goal.entries.length} 次记录 · 最近 5 次
                  </Text>
                  {goal.entries
                    .slice(-5)
                    .reverse()
                    .map((entry) => (
                      <View
                        key={entry.id}
                        style={[
                          styles.row,
                          { justifyContent: 'space-between', flexWrap: 'wrap' },
                        ]}
                      >
                        <Text style={styles.muted}>{entry.date}</Text>
                        <Text style={styles.body}>
                          {entry.weight} {goal.unit}
                        </Text>
                      </View>
                    ))}
                </>
              ) : (
                <Text style={styles.muted}>
                  还没有记录，恢复后可以继续积累。
                </Text>
              )}
            </Panel>
          )}
          <ActionButton
            mode="text"
            icon="delete-outline"
            textColor={colors.danger}
            disabled={busy}
            style={{ marginTop: 8 }}
            onPress={() => {
              setError('');
              setDeleting(true);
            }}
          >
            删除此里程碑
          </ActionButton>
        </>
      )}
      {historyOpen ? (
        <Modal
          visible={historyOpen}
          animationType="none"
          onRequestClose={() => setHistoryOpen(false)}
        >
          <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
            <View style={{ flex: 1, padding: 16 }}>
              <View style={styles.row}>
                <Text style={[styles.heading, styles.grow]}>
                  {goal?.name} · 已解锁的奖励
                </Text>
                <ActionButton
                  tone="neutral"
                  onPress={() => setHistoryOpen(false)}
                >
                  关闭
                </ActionButton>
              </View>
              <FlatList
                style={styles.listViewport}
                data={rewards}
                keyExtractor={(value) => String(value)}
                showsVerticalScrollIndicator={false}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.list}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
                renderItem={({ item }) =>
                  goal ? (
                    <RewardRow
                      value={item}
                      goal={goal}
                      expiresAt={rewardExpiries?.get(item)}
                    />
                  ) : null
                }
              />
            </View>
          </SafeAreaView>
        </Modal>
      ) : null}
      <FormModal
        visible={!!form}
        title={form?.id ? '里程碑设置' : '新的成长目标'}
        onDismiss={dismissForm}
      >
        {form && (
          <View style={styles.form}>
            {form.locked && (
              <Text style={styles.muted}>
                已有记录，规则保持固定以避免重复发券。图标仍可随时更换。
              </Text>
            )}
            <TextInput
              dense
              mode="outlined"
              label="目标名称（必填）"
              value={form.name}
              onChangeText={(name) => setForm({ ...form, name })}
              maxLength={30}
              disabled={busy || form.locked}
            />
            <View testID="milestone-start-group" style={{ gap: 6 }}>
              <Text style={styles.body}>从哪里开始？</Text>
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  alignItems: 'flex-start',
                  gap: 10,
                }}
              >
                <View
                  testID="milestone-start-value"
                  style={{ flexGrow: 1, flexBasis: 160, minWidth: 140 }}
                >
                  <TextInput
                    dense
                    mode="outlined"
                    label="起始数值（主要填写）"
                    placeholder="例如：150"
                    numericRule={{ kind: 'decimal', min: 0, max: 1000000 }}
                    validationVisible={!!error}
                    value={form.startWeight}
                    onChangeText={(startWeight) =>
                      setForm({ ...form, startWeight })
                    }
                    keyboardType="decimal-pad"
                    disabled={busy || form.locked}
                  />
                </View>
                <View
                  testID="milestone-start-unit"
                  style={{ flexBasis: 96, width: 96, flexShrink: 0 }}
                >
                  <TextInput
                    dense
                    mode="outlined"
                    label="计量单位"
                    placeholder="斤 / 页 / 元"
                    value={form.unit}
                    onChangeText={(unit) => setForm({ ...form, unit })}
                    maxLength={8}
                    disabled={busy || form.locked}
                  />
                </View>
              </View>
              <Text style={styles.muted}>
                例如从 150 斤开始：起始数值填
                150，右侧单位填“斤”，不是数值。数值范围 0–1000000。
              </Text>
            </View>
            <Text style={styles.body}>解锁方向</Text>
            <View style={styles.actions}>
              {(['increase', 'decrease'] as const).map((direction) => (
                <ActionButton
                  key={direction}
                  disabled={busy || form.locked}
                  accessibilityState={{
                    selected: form.direction === direction,
                  }}
                  mode={form.direction === direction ? 'contained' : 'outlined'}
                  onPress={() => setForm({ ...form, direction })}
                >
                  {direction === 'increase' ? '递增解锁' : '递减解锁'}
                </ActionButton>
              ))}
            </View>
            <TextInput
              dense
              mode="outlined"
              label="每变化多少解锁一张？"
              numericRule={{ kind: 'decimal', min: 0.1, max: 1000000 }}
              validationVisible={!!error}
              value={form.step}
              onChangeText={(step) => setForm({ ...form, step })}
              keyboardType="decimal-pad"
              disabled={busy || form.locked}
            />
            <Text style={styles.muted}>
              数值最多一位小数，差值至少
              0.1。首次跨过的每个刻度，都会发一张奖券。
            </Text>
            <Text style={styles.body}>选择专属图标</Text>
            <IconPicker
              value={form.icon}
              onChange={(icon) =>
                setForm({ ...form, icon: icon as MilestoneIcon })
              }
            />
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
                保存{form.locked ? '图标' : '目标'}
              </ActionButton>
            </View>
          </View>
        )}
      </FormModal>
      <FormModal
        visible={recordOpen}
        title={'记录' + (goal?.name || '数值')}
        onDismiss={() => {
          if (!busy)
            discardDraft(!!record, () => {
              setRecordOpen(false);
              setRecord('');
            });
        }}
      >
        <View style={styles.form}>
          <TextInput
            dense
            mode="outlined"
            label={'当前数值（' + (goal?.unit || '') + '）'}
            numericRule={{ kind: 'decimal', min: 0, max: 1000000 }}
            validationVisible={!!recordError}
            value={record}
            onChangeText={setRecord}
            keyboardType="decimal-pad"
            disabled={busy}
          />
          <Text style={styles.muted}>
            确认后保存此记录，并自动解锁首次达到的新里程碑。
          </Text>
          <ErrorText message={recordError} />
          <View style={styles.actions}>
            <ActionButton
              mode="outlined"
              tone="neutral"
              disabled={busy}
              onPress={() =>
                discardDraft(!!record, () => {
                  setRecordOpen(false);
                  setRecord('');
                })
              }
            >
              取消
            </ActionButton>
            <ActionButton
              mode="contained"
              loading={busy}
              disabled={busy}
              tone="save"
              onPress={() => {
                void saveRecord();
              }}
            >
              确认记录
            </ActionButton>
          </View>
        </View>
      </FormModal>
      <Confirm
        visible={archiving !== null}
        title="归档这个里程碑？"
        tone="archive"
        description={
          '「' +
          (archiving?.name || '') +
          '」会收进已归档列表。历史记录和已获得的奖券全部保留，恢复时维持原来的进行或暂停状态。'
        }
        busy={busy}
        error={error}
        onDismiss={() => {
          if (!busy) setArchiving(null);
        }}
        onConfirm={() => {
          if (archiving && !busy)
            void run((draft) => archiveMilestoneGoal(draft, archiving.id)).then(
              (result) => {
                if (result.ok) {
                  setArchiving(null);
                  setSelectedId('');
                  setSearch('');
                } else setError(result.message);
              },
            );
        }}
      />
      <Confirm
        visible={deleting}
        title="删除这个里程碑？"
        description={
          '「' +
          (goal?.name || '') +
          '」删除后不能恢复。已获得的奖券、历史记录和用途备注仍然保留，不会重新发券。'
        }
        busy={busy}
        error={error}
        danger
        onDismiss={() => {
          if (!busy) setDeleting(false);
        }}
        onConfirm={() => {
          if (goal)
            void run((draft) => deleteMilestoneGoal(draft, goal.id)).then(
              (result) => {
                if (result.ok) setDeleting(false);
                else setError(result.message);
              },
            );
        }}
      />
    </Page>
  );
}
