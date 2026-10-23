import React, { useState, type ComponentType } from 'react';
import { Platform, View } from 'react-native';
import { Text } from 'react-native-paper';
import * as Crypto from 'expo-crypto';
import {
  dateKey,
  getTaskCount,
  getTicketStatus,
  getWeekStats,
  weekKey,
} from '../domain/engine';
import {
  createGroup,
  exportInvite,
  joinGroup,
  leaveGroup,
  peerBoards,
  renameGroup,
} from '../domain/groupSync';
import type { AppState } from '../domain/types';
import { useApp } from '../state/AppProvider';
import {
  ActionButton,
  Empty,
  Page,
  Panel,
  SectionTitle,
} from '../ui/components';
import { AppTextInput } from '../ui/AppTextInput';
import { ConfirmationDialog } from '../ui/ConfirmationDialog';
import { GroupViewSwitch } from '../ui/GroupViewSwitch';
import { ProfileAvatar } from '../ui/ProfileAvatar';
import type { GiftScannerProps } from '../ui/GiftScanner';
import { useAndroidMountReady } from '../ui/useAndroidMountReady';
import { useAppTheme } from '../ui/ThemeProvider';
import { useGroupView } from '../ui/GroupViewProvider';
import { formatDate, useScreenStyles } from './shared';

function memberTasks(app: AppState, date: string, today: string) {
  const isToday = date === today;
  return app.tasks.filter(
    (task) => !task.deleted && (!task.archived || !isToday),
  );
}
export function GroupScreen() {
  const mountReady = useAndroidMountReady(600);
  const styles = useScreenStyles();
  const { state, busy, run, syncGroup } = useApp();
  const { error: viewError } = useGroupView();
  const [name, setName] = useState(state.groupOwned?.name ?? '我们家');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [ScannerView, setScannerView] =
    useState<ComponentType<GiftScannerProps> | null>(null);
  const [QrView, setQrView] = useState<ComponentType<{ value: string }> | null>(
    null,
  );
  const peers = state.groupLink ? peerBoards(state) : [];
  async function create() {
    if (busy) return;
    const result = await run((draft) =>
      createGroup(draft, name, {
        groupId: Crypto.randomUUID(),
        secret: Crypto.randomUUID(),
      }),
    );
    setError(result.ok ? '' : result.message);
  }
  async function join(raw: string) {
    if (busy) return;
    const result = await run((draft) => joinGroup(draft, raw.trim()));
    if (result.ok) {
      setCode('');
      setScanning(false);
    }
    setError(result.ok ? '' : result.message);
  }
  function showInvite() {
    void import('../ui/GiftQrCode')
      .then((module) => setQrView(() => module.GiftQrCode))
      .catch(() => setError('二维码暂时无法显示，请使用下方邀请码。'));
  }
  return (
    <Page title="小组" subtitle="每个人记自己的账，点同步才交换。">
      {!mountReady ? (
        <View collapsable={false} style={{ minHeight: 160 }} />
      ) : (
        <View collapsable={false} style={styles.column}>
          <GroupViewSwitch />
          {viewError ? <Text style={styles.muted}>{viewError}</Text> : null}
          {state.groupLink ? (
            <Panel>
              <SectionTitle title={state.groupLink.name} />
              <Text style={styles.muted}>
                {peers.length
                  ? `已有 ${peers.length} 位其他成员的副本`
                  : '还没有其他成员的记录。双方都打开应用后点同步。'}
              </Text>
              {state.groupOwned ? (
                <AppTextInput
                  label="小组名称"
                  value={name}
                  onChangeText={setName}
                  maxLength={20}
                  disabled={busy}
                />
              ) : null}
              {state.groupOwned ? (
                <ActionButton
                  mode="contained-tonal"
                  disabled={busy || name.trim() === state.groupLink.name}
                  onPress={() => {
                    void run((draft) => renameGroup(draft, name)).then(
                      (result) => setError(result.ok ? '' : result.message),
                    );
                  }}
                >
                  保存名称
                </ActionButton>
              ) : null}
              <View style={styles.row}>
                <ProfileAvatar
                  avatar={state.giftState?.profile.avatar}
                  size={36}
                />
                <Text style={styles.body}>
                  {state.giftState?.profile.name ?? '我'} · 本机
                </Text>
              </View>
              {peers.map((peer) => (
                <Text key={peer.accountId} style={styles.muted}>
                  {peer.name}
                  {peer.left ? ' · 已离开' : ''} · 已同步{' '}
                  {formatDate(peer.syncedAt)}
                </Text>
              ))}
              <ActionButton
                mode="contained"
                disabled={busy}
                onPress={() => {
                  void syncGroup();
                }}
              >
                同步
              </ActionButton>
              <ActionButton mode="contained-tonal" onPress={showInvite}>
                显示邀请二维码
              </ActionButton>
              {QrView && state.groupLink ? (
                <QrView value={exportInvite(state)} />
              ) : null}
              <Text selectable={Platform.OS !== 'android'} style={styles.muted}>
                {exportInvite(state)}
              </Text>
              <ActionButton
                mode="text"
                tone="danger"
                disabled={busy}
                onPress={() => setLeaving(true)}
              >
                离开小组
              </ActionButton>
            </Panel>
          ) : state.pendingGroupDeparture ? (
            <Panel>
              <SectionTitle title="离开通知待同步" />
              <Text style={styles.muted}>
                连接原小组中的任一成员并同步。对方保存离开状态后，这台设备才能加入或创建其他小组。
              </Text>
              <ActionButton
                mode="contained"
                disabled={busy}
                onPress={() => {
                  void syncGroup();
                }}
              >
                同步离开通知
              </ActionButton>
            </Panel>
          ) : (
            <Panel>
              {state.groupOwned ? (
                <Text style={styles.muted}>
                  这台手机创建过小组。离开后不能再用原来的身份加入。
                </Text>
              ) : (
                <>
                  <AppTextInput
                    label="小组名称"
                    value={name}
                    onChangeText={setName}
                    maxLength={20}
                    disabled={busy}
                  />
                  <ActionButton
                    mode="contained"
                    disabled={busy || !name.trim()}
                    onPress={() => {
                      void create();
                    }}
                  >
                    创建小组
                  </ActionButton>
                </>
              )}
              <SectionTitle title="加入小组" />
              <ActionButton
                mode="contained-tonal"
                disabled={busy}
                onPress={() => {
                  setError('');
                  void import('../ui/GiftScanner')
                    .then((module) => {
                      setScannerView(() => module.GiftScanner);
                      setScanning(true);
                    })
                    .catch(() =>
                      setError('暂时无法打开相机，请改用粘贴邀请码。'),
                    );
                }}
              >
                扫描邀请码
              </ActionButton>
              {scanning && ScannerView ? (
                <ScannerView
                  onScan={(value) => {
                    void join(value);
                  }}
                  onClose={() => setScanning(false)}
                />
              ) : null}
              <AppTextInput
                label="也可以粘贴邀请码"
                value={code}
                onChangeText={setCode}
                disabled={busy}
                multiline
              />
              <ActionButton
                mode="contained"
                disabled={busy || !code.trim()}
                onPress={() => {
                  void join(code);
                }}
              >
                加入
              </ActionButton>
            </Panel>
          )}
          {error ? <Text style={styles.muted}>{error}</Text> : null}
          <ConfirmationDialog
            visible={leaving}
            busy={busy}
            title="离开小组？"
            onDismiss={() => {
              if (!busy) setLeaving(false);
            }}
          >
            <Text style={styles.body}>
              离开后不再接收别人的记录。自己的打卡和奖券保留。
            </Text>
            <ActionButton
              mode="contained"
              tone="danger"
              disabled={busy}
              onPress={() => {
                void run((draft) => leaveGroup(draft)).then(() =>
                  setLeaving(false),
                );
              }}
            >
              确认离开
            </ActionButton>
          </ConfirmationDialog>
        </View>
      )}
    </Page>
  );
}
export function MemberScreen({
  route,
}: {
  route: { params: { accountId: string; date?: string } };
}) {
  const styles = useScreenStyles();
  const { colors } = useAppTheme();
  const { state, now } = useApp();
  const { mode } = useGroupView();
  const date = route.params.date ?? dateKey(now);
  const peer = peerBoards(state).find(
    (item) => item.accountId === route.params.accountId,
  );
  if (mode !== 'group' || !state.groupLink || !peer)
    return (
      <Page title="成员记录">
        <Empty
          title="现在只看自己"
          description="在小组里选择看全组后，才能打开其他成员的记录。"
        />
      </Page>
    );
  const tasks = memberTasks(peer.app, date, dateKey(now));
  const stats = getWeekStats(peer.app, new Date(`${date}T12:00:00`));
  const available = peer.app.tickets.filter(
    (ticket) => getTicketStatus(ticket, peer.app, now) === 'available',
  ).length;
  const used = peer.app.tickets.filter((ticket) => ticket.usedAt).length;
  const redeemed = peer.app.redemptions.filter(
    (entry) => entry.week === weekKey(new Date(`${date}T12:00:00`)),
  ).length;
  return (
    <Page
      title={peer.name}
      subtitle={
        peer.left
          ? '已离开，以下是上次同步的记录'
          : `已同步 ${formatDate(peer.syncedAt)}`
      }
    >
      <Panel>
        <View style={styles.row}>
          <ProfileAvatar avatar={peer.avatar} size={40} />
          <Text style={styles.body}>
            {date} · 可用 {available} · 本周已兑 {redeemed} · 已使用 {used}
          </Text>
        </View>
        <Text style={styles.muted}>这一周打卡 {stats.total} 次</Text>
        {tasks.map((task) => (
          <Text key={task.id} style={styles.body}>
            {task.name}{' '}
            {getTaskCount(peer.app, task.id, new Date(`${date}T12:00:00`))}/
            {task.target}
          </Text>
        ))}
      </Panel>
      <Panel>
        <SectionTitle title="奖券" />
        {peer.app.tickets.length ? (
          peer.app.tickets.map((ticket) => (
            <Text key={ticket.id} style={styles.muted}>
              {ticket.name} ·{' '}
              {ticket.usedAt
                ? `已使用 ${formatDate(ticket.usedAt)}${ticket.usageNote ? ` · ${ticket.usageNote}` : ''}`
                : getTicketStatus(ticket, peer.app, now) === 'expired'
                  ? '已过期'
                  : '可使用'}
            </Text>
          ))
        ) : (
          <Text style={styles.muted}>没有奖券</Text>
        )}
      </Panel>
      <Panel>
        <SectionTitle title="里程碑" />
        {[peer.app.weight, ...peer.app.milestoneGoals]
          .filter((goal) => !goal.deleted)
          .map((goal) => (
            <Text key={goal.id} style={styles.muted}>
              {goal.name} · {goal.unlockedMilestones.length} 个刻度
              {goal.entries.length
                ? ` · 最近 ${goal.entries[goal.entries.length - 1].weight}${goal.unit}`
                : ''}
            </Text>
          ))}
      </Panel>
      <Panel>
        <SectionTitle title="奖励规则" />
        <Text style={styles.muted}>
          每 {peer.app.settings.threshold} 次打卡兑换一张
          {peer.app.settings.rewardName}。
          {peer.app.settings.expiryEnabled
            ? '新兑换的打卡券会到期。'
            : '新兑换的打卡券永久有效。'}
        </Text>
        <Text style={{ color: colors.muted, fontSize: 12 }}>
          这里只能查看，不能修改。
        </Text>
      </Panel>
    </Page>
  );
}
