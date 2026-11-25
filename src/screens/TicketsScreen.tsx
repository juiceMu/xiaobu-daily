import React, { useMemo, useState } from 'react';
import { FlatList, Platform, Pressable, View } from 'react-native';
import {
  useIsFocused,
  useRoute,
  type RouteProp,
} from '@react-navigation/native';
import { Icon, Text } from 'react-native-paper';
import { AppTextInput as TextInput } from '../ui/AppTextInput';
import { getTicketStatus, useTicket as consumeTicket } from '../domain/engine';
import type {
  ProfileAvatar as AvatarValue,
  Ticket,
  TicketStatus,
} from '../domain/types';
import { useApp } from '../state/AppProvider';
import { ActionButton, Empty, Page, Panel } from '../ui/components';
import { ConfirmationDialog } from '../ui/ConfirmationDialog';
import { iconName } from '../ui/theme';
import { useAppTheme } from '../ui/ThemeProvider';
import {
  formatMilestoneSource,
  formatTicketValidity,
} from '../ui/ticketLabels';
import { font, radius, space } from '../ui/uiTokens';
import { usedTicketRows, type TicketListRow } from '../ui/rewardHistory';
import {
  CouponRuleDetails,
  discardDraft,
  ErrorText,
  formatDate,
  useScreenStyles,
} from './shared';
import { GroupViewSwitch } from '../ui/GroupViewSwitch';
import { useGroupView } from '../ui/GroupViewProvider';
import { useTicketLanding } from '../ui/useTicketLanding';
import { peerBoards } from '../domain/groupSync';
import { ProfileAvatar } from '../ui/ProfileAvatar';
import { isTicketReserved } from '../domain/companion';
import { CompanionInvitations } from '../ui/CompanionInvitations';
import { CompanionUseDialog } from '../ui/CompanionUseDialog';
import { CompanionHistory } from '../ui/CompanionHistory';
import { companionStageLabel } from '../ui/companionUi';
import { useKeyboardFocus } from '../ui/useKeyboardFocus';
import { HistoryTabs } from '../ui/HistoryControls';

function MemberFilter({
  name,
  avatar,
  showAvatar,
  selected,
  onPress,
}: {
  name: string;
  avatar?: AvatarValue;
  showAvatar: boolean;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors, quiet } = useAppTheme();
  const focus = useKeyboardFocus();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={name}
      accessibilityState={{ checked: selected }}
      aria-checked={selected}
      onPress={onPress}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      style={{
        borderRadius: 18,
        minHeight: 48,
        minWidth: 48,
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          minHeight: 30,
          paddingHorizontal: 8,
          borderRadius: 18,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          borderWidth: quiet ? 1 : 0,
          borderColor: selected && quiet ? colors.primary : 'transparent',
          backgroundColor: selected ? colors.primaryContainer : 'transparent',
          ...(Platform.OS === 'web'
            ? {
                outlineWidth: focus.focusVisible ? 2 : 0,
                outlineStyle: 'solid' as const,
                outlineColor: colors.primary,
                outlineOffset: -2,
              }
            : null),
        }}
      >
        {showAvatar ? <ProfileAvatar avatar={avatar} size={20} /> : null}
        <Text
          style={{
            fontSize: 12,
            lineHeight: 18,
            fontWeight: selected ? '600' : '400',
            color: colors.ink,
          }}
        >
          {name}
        </Text>
      </View>
    </Pressable>
  );
}

export function TicketsScreen() {
  const { colors, theme } = useAppTheme();
  const styles = useScreenStyles();
  const { state, now, run, busy } = useApp();
  const {
    mode,
    busy: viewBusy,
    error: viewError,
    readFailed,
    setMode,
  } = useGroupView();
  const focused = useIsFocused();
  const route =
    useRoute<
      RouteProp<
        { tickets: { intent?: 'own-available'; at?: number } },
        'tickets'
      >
    >();
  const landingAt =
    route.params?.intent === 'own-available' ? route.params.at : undefined;
  const landing = useTicketLanding(
    landingAt,
    focused,
    mode,
    viewBusy,
    setMode,
    readFailed,
  );
  const showGroup = !landing.forceSelf && mode === 'group' && !!state.groupLink;
  const [filterState, setFilterState] = useState<{
    at: number | undefined;
    value: TicketStatus | 'all';
  }>({ at: landingAt, value: 'available' });
  const [memberState, setMemberState] = useState({
    at: landingAt,
    value: 'all',
  });
  const filter = filterState.at === landingAt ? filterState.value : 'available';
  const memberId = memberState.at === landingAt ? memberState.value : 'all';
  const setFilter = (value: TicketStatus | 'all') =>
    setFilterState({ at: landingAt, value });
  const setMemberId = (value: string) =>
    setMemberState({ at: landingAt, value });
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [companionTicket, setCompanionTicket] = useState<Ticket | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const people = useMemo(() => {
    const self = {
      id: state.sync?.accountId ?? 'self',
      name: state.giftState?.profile.name ?? '我',
      avatar: state.giftState?.profile.avatar,
      app: state,
      own: true,
    };
    if (!showGroup) return [self];
    return [
      self,
      ...peerBoards(state).map((peer) => ({
        id: peer.accountId,
        name: peer.name,
        avatar: peer.avatar,
        app: peer.app,
        own: false,
      })),
    ];
  }, [showGroup, state]);
  const visiblePeople =
    showGroup && memberId !== 'all'
      ? people.filter((person) => person.id === memberId)
      : people;
  const ownedTickets = visiblePeople.flatMap((person) =>
    [...person.app.tickets].reverse().map((ticket) => ({
      ticket,
      person,
      status: getTicketStatus(ticket, person.app, now),
    })),
  );
  const availableCount = ownedTickets.filter(
    (item) => item.status === 'available',
  ).length;
  const usedCount = ownedTickets.filter(
    (item) => item.status === 'used',
  ).length;
  const tickets = ownedTickets.filter(
    (item) => filter === 'all' || item.status === filter,
  );
  const groupByMember = showGroup && memberId === 'all';
  const rows: TicketListRow[] = (() => {
    const ticketRowsFor = (
      personId: string,
      items: typeof tickets,
    ): TicketListRow[] => {
      if (filter === 'used')
        return usedTicketRows(items.map((item) => item.ticket)).map((row) =>
          row.type === 'ticket'
            ? { ...row, key: `${personId}:${row.ticket.id}` }
            : { ...row, key: `${personId}:${row.key}` },
        );
      return items.map((item) => ({
        type: 'ticket' as const,
        key: `${personId}:${item.ticket.id}`,
        ticket: item.ticket,
      }));
    };
    if (!groupByMember) {
      if (filter === 'used')
        return usedTicketRows(tickets.map((item) => item.ticket)).map((row) => {
          if (row.type !== 'ticket') return row;
          const owned = tickets.find((entry) => entry.ticket === row.ticket);
          return {
            ...row,
            key: `${owned?.person.id ?? 'self'}:${row.ticket.id}`,
          };
        });
      return tickets.map((item) => ({
        type: 'ticket' as const,
        key: `${item.person.id}:${item.ticket.id}`,
        ticket: item.ticket,
      }));
    }
    return visiblePeople.flatMap((person) => {
      const items = tickets.filter((item) => item.person.id === person.id);
      if (!items.length) return [];
      return [
        {
          type: 'member' as const,
          key: `member:${person.id}`,
          personId: person.id,
          name: person.name,
          count: items.length,
        },
        ...ticketRowsFor(person.id, items),
      ];
    });
  })();
  async function confirmUse() {
    if (!selected || busy) return;
    const result = await run((draft) =>
      consumeTicket(draft, selected.id, new Date(), note),
    );
    if (result.ok) setSelected(null);
    else setError(result.message);
  }
  return (
    <Page title="我的奖券" scroll={false}>
      <FlatList
        style={styles.listViewport}
        data={rows}
        keyExtractor={(row) => row.key}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <View style={[styles.column, styles.listHeader]}>
            <HistoryTabs
              testID="ticket-status-tabs"
              label="奖券状态"
              options={[
                { value: 'available', label: '可使用' },
                { value: 'used', label: '已使用' },
                { value: 'expired', label: '已过期' },
                { value: 'all', label: '全部' },
              ]}
              value={filter}
              onChange={setFilter}
            />
            {state.groupLink ? (
              <>
                <Text style={styles.muted}>选择看全组后，可按成员查看奖券</Text>
                <GroupViewSwitch
                  textOnly
                  displayMode={landing.forceSelf ? 'self' : undefined}
                  onChangeMode={landing.selectMode}
                  disabled={landing.pending}
                />
              </>
            ) : null}
            {state.groupLink || landing.failed ? (
              <ErrorText
                message={
                  landing.failed
                    ? readFailed
                      ? `${viewError} 当前仅显示自己的奖券，已存偏好尚未确认。${state.groupLink ? '请重试切换。' : ''}`
                      : `查看方式保存失败，当前仅显示自己的奖券，已存偏好需重新确认。${state.groupLink ? '请重试切换。' : ''}`
                    : viewError
                }
              />
            ) : readFailed ? (
              <ErrorText message={viewError} />
            ) : null}
            {showGroup ? (
              <View
                accessibilityRole="radiogroup"
                style={[styles.actions, { flexWrap: 'wrap' }]}
              >
                {[
                  { id: 'all' as const, name: '全部', showAvatar: false },
                  ...people.map((person) => ({
                    id: person.id,
                    name: person.name,
                    avatar: person.avatar,
                    showAvatar: true,
                  })),
                ].map((option) => {
                  const selected = memberId === option.id;
                  return (
                    <MemberFilter
                      key={option.id}
                      name={option.name}
                      avatar={'avatar' in option ? option.avatar : undefined}
                      showAvatar={option.showAvatar}
                      selected={selected}
                      onPress={() => setMemberId(option.id)}
                    />
                  );
                })}
              </View>
            ) : null}
            <View
              style={[
                styles.row,
                { justifyContent: 'space-between', flexWrap: 'wrap' },
              ]}
            >
              <Text style={styles.muted}>共 {tickets.length} 张</Text>
              <Text style={styles.muted}>
                可用 {availableCount} · 已使用 {usedCount}
              </Text>
            </View>
            <CompanionInvitations />
          </View>
        }
        ListEmptyComponent={
          <Empty
            title="这里还没有奖券"
            description="完成打卡后兑换，或首次达到新里程碑，即可收获奖励。"
          />
        }
        renderItem={({ item: row }) => {
          if (row.type === 'member') {
            const person = people.find((entry) => entry.id === row.personId);
            return (
              <View
                testID="ticket-member-header"
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  paddingTop: 4,
                  paddingBottom: 2,
                }}
              >
                <View style={styles.row}>
                  <ProfileAvatar avatar={person?.avatar} size={20} />
                  <Text
                    accessibilityRole="header"
                    style={{
                      fontSize: 13,
                      lineHeight: 18,
                      fontWeight: '600',
                      color: colors.ink,
                    }}
                  >
                    {row.name}
                  </Text>
                </View>
                <Text
                  style={{ fontSize: 12, lineHeight: 18, color: colors.muted }}
                >
                  {row.count} 张
                </Text>
              </View>
            );
          }
          if (row.type === 'week')
            return (
              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 4,
                  paddingVertical: 8,
                }}
              >
                <Text
                  accessibilityRole="header"
                  style={{
                    fontSize: 12,
                    lineHeight: 18,
                    fontWeight: '500',
                    color: colors.ink,
                  }}
                >
                  {row.title}
                </Text>
                <Text
                  style={{ fontSize: 12, lineHeight: 18, color: colors.muted }}
                >
                  已用 {row.count} 张
                </Text>
              </View>
            );
          const item = row.ticket;
          const owned = tickets.find((entry) => entry.ticket === item);
          const status = owned?.status ?? getTicketStatus(item, state, now);
          const sourceState = owned?.person.app ?? state;
          const goal = [sourceState.weight, ...sourceState.milestoneGoals].find(
            (entry) => entry.id === item.goalId,
          );
          const sourceName =
            item.source === 'companion'
              ? status === 'available'
                ? '须与伙伴奖券一起使用'
                : '同行券'
              : item.source === 'gift'
                ? `来自 ${item.senderName || '一位朋友'}`
                : item.source === 'weight'
                  ? formatMilestoneSource(item.goalName || goal?.name)
                  : '每周打卡奖励';
          const archived = status !== 'available';
          const archivedLabel = status === 'used' ? '已使用' : '已过期';
          const statusLabel =
            status === 'used'
              ? formatDate(item.usedAt!)
              : formatTicketValidity(item);
          const activeCompanion = item.companionUses?.find(
            (session) => !['completed', 'cancelled'].includes(session.stage),
          );
          const jointUse = item.companionUses?.find((session) =>
            ['committed', 'completed'].includes(session.stage),
          );
          const TicketContainer = archived ? View : Panel;
          return (
            <TicketContainer
              {...(archived ? { 'aria-disabled': true } : {})}
              style={[
                styles.card,
                { padding: space[12], gap: space[6], overflow: 'hidden' },
                archived && {
                  backgroundColor: theme.colors.surfaceDisabled,
                  borderRadius: radius[8],
                },
              ]}
            >
              <View
                testID="ticket-main-row"
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
                    backgroundColor: archived
                      ? 'transparent'
                      : item.source === 'weight'
                        ? colors.purple
                        : colors.peach,
                    borderWidth: archived ? 1 : 0,
                    borderColor: colors.border,
                  }}
                >
                  <Icon
                    source={
                      item.source === 'gift'
                        ? 'gift-outline'
                        : item.source === 'companion'
                          ? 'account-multiple-outline'
                          : item.source === 'weight'
                            ? iconName(item.goalIcon || goal?.icon)
                            : 'ticket-outline'
                    }
                    size={18}
                    color={archived ? colors.muted : colors.primary}
                  />
                </View>
                <View style={[styles.grow, { minWidth: 0 }]}>
                  {showGroup && owned && !groupByMember ? (
                    <Text
                      style={{
                        fontSize: 12,
                        lineHeight: 18,
                        color: colors.muted,
                      }}
                    >
                      {owned.person.name}
                    </Text>
                  ) : null}
                  <Text
                    testID="ticket-title"
                    style={{
                      fontSize: 13,
                      lineHeight: 18,
                      fontWeight: archived ? '400' : '500',
                      color: archived ? colors.muted : colors.ink,
                    }}
                    numberOfLines={2}
                    ellipsizeMode="tail"
                    accessibilityLabel={item.name}
                  >
                    {item.name}
                  </Text>
                  <Text
                    testID="ticket-status"
                    style={{
                      fontSize: 12,
                      lineHeight: 18,
                      color: colors.muted,
                    }}
                  >
                    {sourceName} · {statusLabel}
                  </Text>
                  <Text
                    testID="ticket-created-at"
                    style={{
                      fontSize: 12,
                      lineHeight: 18,
                      color: colors.muted,
                    }}
                  >
                    获得于 {formatDate(item.createdAt)}
                    {status === 'used'
                      ? ` · ${formatTicketValidity(item)}`
                      : ''}
                  </Text>
                </View>
                {status === 'available' &&
                item.source === 'companion' &&
                owned?.person.own !== false ? (
                  <ActionButton
                    testID="companion-find-partner-button"
                    tone="reward"
                    mode="contained-tonal"
                    compact
                    accessibilityLabel={'找伙伴一起使用同行券，' + item.name}
                    labelStyle={{ fontSize: 12, lineHeight: 18 }}
                    style={{
                      alignSelf: 'center',
                      flexShrink: 1,
                      maxWidth: 100,
                    }}
                    disabled={busy || isTicketReserved(item)}
                    onPress={() => setCompanionTicket(item)}
                  >
                    找伙伴一起用
                  </ActionButton>
                ) : null}
                {status === 'available' &&
                  item.source !== 'companion' &&
                  !isTicketReserved(item) &&
                  (owned?.person.own === false ? null : (
                    <ActionButton
                      testID="ticket-use-button"
                      tone="reward"
                      mode="contained-tonal"
                      compact
                      accessibilityLabel={'使用奖券，' + item.name}
                      labelStyle={{ fontSize: 12, lineHeight: 18 }}
                      style={{ alignSelf: 'center', flexShrink: 0 }}
                      disabled={busy}
                      onPress={() => {
                        setSelected(item);
                        setNote('');
                        setError('');
                      }}
                    >
                      使用
                    </ActionButton>
                  ))}
                {archived && (
                  <Text
                    testID="ticket-archived-label"
                    style={{
                      color: colors.muted,
                      fontSize: font[11],
                      flexShrink: 0,
                    }}
                  >
                    {archivedLabel}
                  </Text>
                )}
              </View>
              {activeCompanion ? (
                <Text style={styles.muted} accessibilityLiveRegion="polite">
                  {companionStageLabel(activeCompanion)}
                </Text>
              ) : null}
              {jointUse ? (
                <CompanionHistory
                  key={jointUse.id}
                  source={item.source}
                  session={jointUse}
                />
              ) : null}
              {item.usageNote ? (
                <Text
                  testID="ticket-usage-note"
                  style={{ fontSize: 12, lineHeight: 18, color: colors.muted }}
                >
                  用途：{item.usageNote}
                </Text>
              ) : null}
            </TicketContainer>
          );
        }}
      />
      <ConfirmationDialog
        visible={!!selected}
        busy={busy}
        title={selected ? `使用「${selected.name}」？` : '使用奖券？'}
        onDismiss={() => {
          if (!busy) discardDraft(!!note, () => setSelected(null));
        }}
      >
        <View style={styles.form}>
          <CouponRuleDetails
            cost="使用 1 张奖券"
            condition="奖券仍可使用"
            rules="确认使用后，奖券不能再次使用。若想搭配伙伴的同行券，请选择邀请同行。"
          />
          <ActionButton
            mode="contained-tonal"
            tone="reward"
            disabled={busy}
            icon="account-multiple-outline"
            onPress={() =>
              discardDraft(!!note, () => {
                setCompanionTicket(selected);
                setSelected(null);
              })
            }
          >
            邀请同行
          </ActionButton>
          <TextInput
            dense
            mode="outlined"
            label="这次奖励了自己什么？（选填）"
            value={note}
            onChangeText={setNote}
            multiline
            maxLength={200}
            disabled={busy}
            style={{ minHeight: 120 }}
          />
          <Text style={styles.muted}>{note.length} / 200 字</Text>
          <ErrorText message={error} />
          <View style={styles.actions}>
            <ActionButton
              mode="outlined"
              disabled={busy}
              onPress={() => discardDraft(!!note, () => setSelected(null))}
              tone="neutral"
            >
              取消
            </ActionButton>
            <ActionButton
              mode="contained"
              loading={busy}
              disabled={busy}
              tone="reward"
              onPress={() => {
                void confirmUse();
              }}
            >
              确认使用
            </ActionButton>
          </View>
        </View>
      </ConfirmationDialog>
      {companionTicket ? (
        <CompanionUseDialog
          ticket={companionTicket}
          onDismiss={() => setCompanionTicket(null)}
        />
      ) : null}
    </Page>
  );
}
