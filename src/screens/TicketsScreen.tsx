import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, View } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { Icon, Text } from 'react-native-paper';
import { AppTextInput as TextInput } from '../ui/AppTextInput';
import { getTicketStatus, useTicket as consumeTicket } from '../domain/engine';
import type { Ticket, TicketStatus } from '../domain/types';
import { useApp } from '../state/AppProvider';
import { ActionButton, Empty, Page, Panel } from '../ui/components';
import { ConfirmationDialog } from '../ui/ConfirmationDialog';
import { iconName } from '../ui/theme';
import { useAppTheme } from '../ui/ThemeProvider';
import { formatMilestoneSource } from '../ui/ticketLabels';
import { TicketStatusBadge } from '../ui/TicketStatusBadge';
import { usedTicketRows, type TicketListRow } from '../ui/rewardHistory';
import { discardDraft, ErrorText, formatDate, useScreenStyles } from './shared';
import { GroupViewSwitch } from '../ui/GroupViewSwitch';
import { useGroupView } from '../ui/GroupViewProvider';
import { peerBoards } from '../domain/groupSync';
import { ProfileAvatar } from '../ui/ProfileAvatar';
import { isTicketReserved } from '../domain/companion';
import { CompanionInvitations } from '../ui/CompanionInvitations';
import { CompanionUseDialog } from '../ui/CompanionUseDialog';
import { CompanionHistory } from '../ui/CompanionHistory';
import { companionStageLabel } from '../ui/companionUi';

export function TicketsScreen() {
  const { colors } = useAppTheme();
  const styles = useScreenStyles();
  const { state, now, run, busy } = useApp();
  const { mode, setMode } = useGroupView();
  const route =
    useRoute<
      RouteProp<
        { tickets: { intent?: 'own-available'; at?: number } },
        'tickets'
      >
    >();
  const landingAt =
    route.params?.intent === 'own-available' ? route.params.at : undefined;
  const showGroup = mode === 'group' && !!state.groupLink;
  const [filter, setFilter] = useState<TicketStatus | 'all'>('available');
  const [memberId, setMemberId] = useState('all');
  useEffect(() => {
    if (landingAt == null) return;
    setFilter('available');
    setMemberId('all');
    void setMode('self');
  }, [landingAt]);
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
    <Page
      title="我的奖券"
      subtitle="努力存起来，也记得好好享受。"
      scroll={false}
    >
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
            <View style={styles.actions}>
              {(['available', 'used', 'expired', 'all'] as const).map(
                (value, index) => (
                  <ActionButton
                    key={value}
                    mode={filter === value ? 'contained-tonal' : 'text'}
                    contentStyle={{ borderRadius: 18 }}
                    accessibilityState={{ selected: filter === value }}
                    onPress={() => setFilter(value)}
                  >
                    {['可使用', '已使用', '已过期', '全部'][index]}
                  </ActionButton>
                ),
              )}
            </View>
            {state.groupLink ? (
              <>
                <Text style={styles.muted}>选择看全组后，可按成员查看奖券</Text>
                <GroupViewSwitch />
              </>
            ) : null}
            {showGroup ? (
              <Text style={styles.muted}>
                可用 {availableCount} · 已使用 {usedCount}
              </Text>
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
                    <Pressable
                      key={option.id}
                      accessibilityRole="radio"
                      accessibilityLabel={option.name}
                      accessibilityState={{ selected }}
                      onPress={() => setMemberId(option.id)}
                      style={{ borderRadius: 18 }}
                    >
                      <View
                        style={{
                          minHeight: 30,
                          paddingHorizontal: 8,
                          borderRadius: 18,
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 6,
                          backgroundColor: selected
                            ? colors.primaryContainer
                            : 'transparent',
                        }}
                      >
                        {option.showAvatar ? (
                          <ProfileAvatar
                            avatar={
                              'avatar' in option ? option.avatar : undefined
                            }
                            size={20}
                          />
                        ) : null}
                        <Text
                          style={{
                            fontSize: 12,
                            lineHeight: 18,
                            fontWeight: selected ? '600' : '400',
                            color: colors.ink,
                          }}
                        >
                          {option.name}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
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
          const statusLabel =
            status === 'used'
              ? `已使用 · ${formatDate(item.usedAt!)}`
              : status === 'expired'
                ? `已过期 · ${formatDate(item.expiresAt!)}`
                : item.expiresAt
                  ? `${formatDate(item.expiresAt)} 前可用`
                  : '永久有效';
          const activeCompanion = item.companionUses?.find(
            (session) => !['completed', 'cancelled'].includes(session.stage),
          );
          const jointUse = item.companionUses?.find((session) =>
            ['committed', 'completed'].includes(session.stage),
          );
          return (
            <Panel
              style={[styles.card, { padding: 12, gap: 6, overflow: 'hidden' }]}
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
                    backgroundColor:
                      item.source === 'weight' ? colors.purple : colors.peach,
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
                    color={colors.primary}
                  />
                </View>
                <View
                  style={[
                    styles.grow,
                    status !== 'available' ? { paddingRight: 64 } : null,
                  ]}
                >
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
                      fontWeight: '500',
                      color: colors.ink,
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
              </View>
              <TicketStatusBadge status={status} />
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
            </Panel>
          );
        }}
      />
      <ConfirmationDialog
        visible={!!selected}
        busy={busy}
        title="使用这张奖券？"
        onDismiss={() => {
          if (!busy) discardDraft(!!note, () => setSelected(null));
        }}
      >
        <View style={styles.form}>
          <Text style={styles.body}>{selected?.name}使用后不可重复使用。</Text>
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
