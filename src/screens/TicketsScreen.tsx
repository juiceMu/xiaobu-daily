import React, { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
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

export function TicketsScreen() {
  const { colors } = useAppTheme();
  const styles = useScreenStyles();
  const { state, now, run, busy } = useApp();
  const [filter, setFilter] = useState<TicketStatus | 'all'>('available');
  const [selected, setSelected] = useState<Ticket | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const tickets = useMemo(
    () =>
      [...state.tickets]
        .reverse()
        .filter(
          (ticket) =>
            filter === 'all' || getTicketStatus(ticket, state, now) === filter,
        ),
    [state, filter, now],
  );
  const rows: TicketListRow[] =
    filter === 'used'
      ? usedTicketRows(tickets)
      : tickets.map((ticket) => ({ type: 'ticket', key: ticket.id, ticket }));
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
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <View style={[styles.actions, styles.listHeader]}>
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
        }
        ListEmptyComponent={
          <Empty
            title="这里还没有奖券"
            description="完成打卡后兑换，或首次达到新里程碑，即可收获奖励。"
          />
        }
        renderItem={({ item: row }) => {
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
          const status = getTicketStatus(item, state, now);
          const goal = [state.weight, ...state.milestoneGoals].find(
            (entry) => entry.id === item.goalId,
          );
          const sourceName =
            item.source === 'gift'
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
          return (
            <Panel style={[styles.card, { padding: 12, gap: 6 }]}>
              <TicketStatusBadge status={status} />
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
                        : item.source === 'weight'
                          ? iconName(item.goalIcon || goal?.icon)
                          : 'ticket-outline'
                    }
                    size={18}
                    color={colors.primary}
                  />
                </View>
                <View style={styles.grow}>
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
                {status === 'available' && (
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
                )}
              </View>
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
    </Page>
  );
}
