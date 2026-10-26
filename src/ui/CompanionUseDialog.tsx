import React, { useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { Text } from 'react-native-paper';
import { startCompanionUse } from '../domain/companion';
import type { Ticket } from '../domain/types';
import { useApp } from '../state/AppProvider';
import { discardDraft, ErrorText, useScreenStyles } from '../screens/shared';
import { AppTextInput } from './AppTextInput';
import { ActionButton } from './components';
import { ConfirmationDialog } from './ConfirmationDialog';
import { companionCandidates } from './companionUi';

export function CompanionUseDialog({
  ticket,
  onDismiss,
}: {
  ticket: Ticket;
  onDismiss: () => void;
}) {
  const { state, now, busy, run, syncGroup } = useApp();
  const styles = useScreenStyles();
  const [choice, setChoice] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const submitting = useRef(false);
  const candidates = companionCandidates(state, ticket, now);
  const selected = candidates.find(
    (item) => `${item.peer.accountId}:${item.ticket.id}` === choice,
  );
  const locked = busy || sending;
  const companion = ticket.source === 'companion';
  const dismiss = () => {
    if (!locked) discardDraft(!!note || !!choice, onDismiss);
  };
  async function submit() {
    if (locked || submitting.current || !selected || Platform.OS === 'web')
      return;
    submitting.current = true;
    setSending(true);
    setError('');
    try {
      const result = await run((draft) =>
        startCompanionUse(draft, {
          ticketId: ticket.id,
          peerAccountId: selected.peer.accountId,
          peerTicketId: selected.ticket.id,
          note,
        }),
      );
      if (!result.ok) {
        setError(result.message);
        return;
      }
      // 本地保存成功才发送，等待状态由邀请区继续呈现。
      await syncGroup();
      onDismiss();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : '发送未完成，已保存的同行邀请仍可在邀请区重试同步。',
      );
    } finally {
      submitting.current = false;
      setSending(false);
    }
  }
  return (
    <ConfirmationDialog
      visible
      title={companion ? '找伙伴一起用' : '邀请同行'}
      busy={locked}
      onDismiss={dismiss}
    >
      <View style={styles.form}>
        <Text style={styles.body}>我的券：{ticket.name}</Text>
        <Text style={styles.muted}>
          {companion
            ? '选择另一人的打卡券、里程碑券或赠送券，双方各自确认。'
            : '选择另一人的同行券。发送即授权使用自己的主券，对方确认后会在主券设备同步时联合使用。'}
        </Text>
        <Text style={styles.muted}>
          成员奖券是上次同步的副本，发送和确认时会重新校验。请连接同一
          WiFi，双方保持应用在前台；邀请 15 分钟内有效。
        </Text>
        {Platform.OS === 'web' ? (
          <Text style={styles.muted}>
            网页版不支持局域网联合使用，请在手机上操作。同行券仍可正常兑换。
          </Text>
        ) : !state.groupLink ? (
          <Text style={styles.muted}>
            请先在「更多 → 小组」加入伙伴的小组并同步。
          </Text>
        ) : candidates.length === 0 ? (
          <Text style={styles.muted}>
            伙伴暂无可搭配的奖券。请先同步；伙伴的券可能已使用、过期或正在等待同行确认。
          </Text>
        ) : (
          <View style={styles.column} accessibilityRole="radiogroup">
            {candidates.map((item) => {
              const key = `${item.peer.accountId}:${item.ticket.id}`;
              return (
                <ActionButton
                  key={key}
                  mode={choice === key ? 'contained-tonal' : 'outlined'}
                  accessibilityState={{ selected: choice === key }}
                  disabled={locked}
                  onPress={() => setChoice(key)}
                >
                  {item.peer.name} · {item.ticket.name}
                </ActionButton>
              );
            })}
          </View>
        )}
        {selected ? (
          <Text style={styles.body}>
            一起使用：我「{ticket.name}」× 1 + {selected.peer.name}「
            {selected.ticket.name}」× 1
          </Text>
        ) : null}
        <AppTextInput
          label="一起做什么？（选填）"
          mode="outlined"
          value={note}
          onChangeText={setNote}
          maxLength={200}
          multiline
          disabled={locked}
        />
        <Text style={styles.muted}>{note.length} / 200 字</Text>
        <ErrorText message={error} />
        <View style={styles.actions}>
          <ActionButton
            mode="outlined"
            tone="neutral"
            disabled={locked}
            onPress={dismiss}
          >
            取消
          </ActionButton>
          <ActionButton
            mode="contained"
            tone="reward"
            disabled={locked || !selected || Platform.OS === 'web'}
            loading={sending}
            onPress={() => {
              void submit();
            }}
          >
            {companion ? '确认并请求同行' : '确认使用并邀请'}
          </ActionButton>
        </View>
      </View>
    </ConfirmationDialog>
  );
}
