import React, { useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { Text } from 'react-native-paper';
import {
  acceptCompanionUse,
  cancelCompanionUse,
  companionUseOffers,
} from '../domain/companion';
import type { CompanionUse } from '../domain/types';
import { useApp } from '../state/AppProvider';
import { ErrorText, formatDate, useScreenStyles } from '../screens/shared';
import { ActionButton, Panel } from './components';
import { ConfirmationDialog } from './ConfirmationDialog';
import { companionStageLabel } from './companionUi';

export function CompanionInvitations() {
  const { state, now, busy, run, syncGroup } = useApp();
  const styles = useScreenStyles();
  const [sending, setSending] = useState(false);
  const actionLock = useRef(false);
  const [error, setError] = useState('');
  const [action, setAction] = useState<{
    id: string;
    accept: boolean;
    main: boolean;
  } | null>(null);
  const local = state.tickets.flatMap((ticket) =>
    (ticket.companionUses ?? [])
      .filter((session) => !['completed', 'cancelled'].includes(session.stage))
      .map((session) => ({ ticket, session })),
  );
  const offers = companionUseOffers(state, now).filter(
    (offer) =>
      offer.canAccept ||
      !local.some((item) => item.session.id === offer.session.id),
  );
  const locked = busy || sending;
  const pendingSession = action
    ? (offers.find((offer) => offer.session.id === action.id)?.session ??
      local.find((item) => item.session.id === action.id)?.session)
    : undefined;
  function summary(session: CompanionUse) {
    const main = session.mainAccountId === state.sync?.accountId;
    return main
      ? `我「${session.mainTicketName}」+ ${session.companionName}「${session.companionTicketName}」`
      : `我「${session.companionTicketName}」+ ${session.mainName}「${session.mainTicketName}」`;
  }
  async function synchronize() {
    if (locked || actionLock.current || Platform.OS === 'web') return;
    actionLock.current = true;
    setSending(true);
    try {
      await syncGroup();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : '同步未完成，请保持同一 WiFi 后重试。',
      );
    } finally {
      actionLock.current = false;
      setSending(false);
    }
  }
  async function confirm() {
    if (!action || locked || actionLock.current || Platform.OS === 'web')
      return;
    actionLock.current = true;
    setSending(true);
    setError('');
    try {
      const result = await run((draft) =>
        action.accept
          ? acceptCompanionUse(draft, action.id)
          : cancelCompanionUse(draft, action.id),
      );
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setAction(null);
      await syncGroup();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : '操作未完成，已保存记录保留，请重试同步。',
      );
    } finally {
      actionLock.current = false;
      setSending(false);
    }
  }
  if (!local.length && !offers.length) return null;
  return (
    <View style={styles.column} testID="companion-invitations">
      <Text accessibilityRole="header" style={styles.body}>
        同行邀请
      </Text>
      <Text style={styles.muted}>
        {Platform.OS === 'web'
          ? '网页版无法发送或确认同行邀请，请使用原生手机。'
          : '同一 WiFi · 双方应用保持前台。等待或断线不代表扣券失败，请同步核对，不要重新用券。'}
      </Text>
      {offers.map((offer) => (
        <Panel
          key={`offer:${offer.session.id}`}
          style={[styles.card, { gap: 8 }]}
        >
          <Text style={styles.body}>
            {offer.peerName}{' '}
            {offer.localTicket.source === 'companion'
              ? '邀请你同行'
              : '请求搭配你的奖券'}
          </Text>
          <Text style={styles.muted}>{summary(offer.session)}</Text>
          <Text style={styles.muted}>
            共同用途：{offer.session.note || '未填写'}
          </Text>
          <Text style={styles.muted}>
            确认截止 {formatDate(offer.session.expiresAt)}
            ；成员信息来自上次同步。
          </Text>
          {offer.canAccept ? (
            <View style={styles.actions}>
              <ActionButton
                disabled={locked || Platform.OS === 'web'}
                mode="outlined"
                tone="neutral"
                onPress={() =>
                  setAction({
                    id: offer.session.id,
                    accept: false,
                    main: offer.localTicket.source !== 'companion',
                  })
                }
              >
                拒绝
              </ActionButton>
              <ActionButton
                disabled={locked || Platform.OS === 'web'}
                mode="contained"
                tone="reward"
                onPress={() =>
                  setAction({
                    id: offer.session.id,
                    accept: true,
                    main: offer.localTicket.source !== 'companion',
                  })
                }
              >
                {offer.localTicket.source === 'companion'
                  ? '确认同行'
                  : '同意并授权主券'}
              </ActionButton>
            </View>
          ) : (
            <Text style={styles.muted}>
              邀请待核对；已到期或奖券状态变化时不能确认，请同步最新结果。
            </Text>
          )}
        </Panel>
      ))}
      {local
        .filter(
          (item) =>
            !offers.some(
              (offer) =>
                offer.canAccept && offer.session.id === item.session.id,
            ),
        )
        .map(({ ticket, session }) => (
          <Panel key={`local:${session.id}`} style={[styles.card, { gap: 8 }]}>
            <Text style={styles.body}>{summary(session)}</Text>
            <Text style={styles.muted} accessibilityLiveRegion="polite">
              {companionStageLabel(session)}
            </Text>
            <Text style={styles.muted}>
              共同用途：{session.note || '未填写'}
            </Text>
            <Text style={styles.muted}>
              {session.stage === 'committed'
                ? '主券已提交且不能回滚；对方确认保存前，不代表双方已完成。'
                : `确认截止 ${formatDate(session.expiresAt)}。已确认的同行券需与主券方同步核对后才能解除占用。`}
            </Text>
            {session.stage !== 'committed' && !session.cancelRequestedAt ? (
              <ActionButton
                mode="outlined"
                tone="neutral"
                disabled={locked || Platform.OS === 'web'}
                onPress={() =>
                  setAction({
                    id: session.id,
                    accept: false,
                    main: ticket.source !== 'companion',
                  })
                }
              >
                {session.stage === 'accepted' ? '请求取消' : '取消邀请'}
              </ActionButton>
            ) : null}
          </Panel>
        ))}
      <ErrorText message={error} />
      <ActionButton
        icon="sync"
        mode="contained-tonal"
        disabled={locked || Platform.OS === 'web' || !state.groupLink}
        loading={sending}
        onPress={() => {
          void synchronize();
        }}
      >
        同步同行结果
      </ActionButton>
      <ConfirmationDialog
        visible={!!action}
        busy={locked}
        title={
          action?.accept
            ? action.main
              ? '授权使用主券？'
              : '确认使用同行券？'
            : '取消这次同行？'
        }
        onDismiss={() => {
          if (!locked) setAction(null);
        }}
      >
        <View style={styles.form}>
          {pendingSession ? (
            <>
              <Text style={styles.body}>{summary(pendingSession)}</Text>
              <Text style={styles.muted}>
                共同用途：{pendingSession.note || '未填写'}
              </Text>
            </>
          ) : null}
          <Text style={styles.body}>
            {action?.accept
              ? action.main
                ? '你确认使用自己的主券；伙伴确认同行后，主券设备在同步时提交联合使用。'
                : '你只授权使用自己的同行券。双方确认并同步后一起使用；断线时保持占用，需核对结果。'
              : '尚未提交时可取消；已确认同行的取消需要同步核对，不会立即释放奖券。已提交的使用不能回滚。'}
          </Text>
          <ErrorText message={error} />
          <View style={styles.actions}>
            <ActionButton
              mode="outlined"
              tone="neutral"
              disabled={locked}
              onPress={() => setAction(null)}
            >
              返回
            </ActionButton>
            <ActionButton
              mode="contained"
              tone="reward"
              disabled={locked}
              loading={sending}
              onPress={() => {
                void confirm();
              }}
            >
              确认{action?.accept ? '' : '取消'}
            </ActionButton>
          </View>
        </View>
      </ConfirmationDialog>
    </View>
  );
}
