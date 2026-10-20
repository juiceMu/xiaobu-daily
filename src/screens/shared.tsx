import React, { useMemo } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';
import { HelperText, Text } from 'react-native-paper';
import { ActionButton, type ActionTone } from '../ui/components';
import { ConfirmationDialog } from '../ui/ConfirmationDialog';
import { useAppTheme } from '../ui/ThemeProvider';
import type { AppColors } from '../ui/themeCatalog';

export const formatDate = (value: string) =>
  new Date(value).toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
export function discardDraft(dirty: boolean, close: () => void) {
  if (!dirty) {
    close();
    return;
  }
  confirmDiscard('放弃未保存的内容？', '这次填写的内容尚未保存。', close);
}
export function confirmDiscard(
  title: string,
  message: string,
  close: () => void,
) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n${message}`)) close();
    return;
  }
  Alert.alert(title, message, [
    { text: '继续填写', style: 'cancel' },
    { text: '放弃更改', style: 'destructive', onPress: close },
  ]);
}
export function ErrorText({ message }: { message: string }) {
  const styles = useScreenStyles();
  return message ? (
    <HelperText
      type="error"
      visible
      accessibilityLiveRegion="polite"
      style={styles.body}
    >
      {message}
    </HelperText>
  ) : null;
}
export function Confirm({
  visible,
  title,
  description,
  busy,
  error,
  onDismiss,
  onConfirm,
  danger = false,
  tone = 'save',
}: {
  visible: boolean;
  title: string;
  description: string;
  busy: boolean;
  error: string;
  onDismiss: () => void;
  onConfirm: () => void;
  danger?: boolean;
  tone?: ActionTone;
}) {
  const { colors } = useAppTheme();
  const styles = useScreenStyles();
  return (
    <ConfirmationDialog
      visible={visible}
      title={title}
      onDismiss={onDismiss}
      busy={busy}
    >
      <Text style={styles.body}>{description}</Text>
      <ErrorText message={error} />
      <View style={styles.actions}>
        <ActionButton
          tone="neutral"
          mode="outlined"
          disabled={busy}
          onPress={onDismiss}
        >
          取消
        </ActionButton>
        <ActionButton
          mode="contained"
          loading={busy}
          disabled={busy}
          buttonColor={danger ? colors.danger : undefined}
          tone={danger ? 'danger' : tone}
          onPress={onConfirm}
        >
          确认{danger ? '删除' : ''}
        </ActionButton>
      </View>
    </ConfirmationDialog>
  );
}
const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    body: { fontSize: 14, lineHeight: 20, color: colors.ink },
    muted: { fontSize: 12, lineHeight: 18, color: colors.muted },
    heading: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '700',
      color: colors.ink,
      flexShrink: 1,
    },
    actions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      alignItems: 'center',
    },
    row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    column: { gap: 8 },
    grow: { flex: 1, minWidth: 0 },
    form: { gap: 10 },
    list: { paddingBottom: 24 },
    listViewport: { flex: 1, minHeight: 0 },
    listHeader: { marginBottom: 8 },
    card: { flexShrink: 0 },
    number: {
      fontSize: 22,
      lineHeight: 28,
      fontWeight: '700',
      color: colors.primary,
    },
    icon: {
      width: 32,
      height: 32,
      flexShrink: 0,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 10,
      backgroundColor: colors.primaryContainer,
    },
    stat: {
      flexBasis: 0,
      flexGrow: 1,
      flexShrink: 1,
      minWidth: 104,
      padding: 10,
      gap: 4,
      borderRadius: 16,
      backgroundColor: colors.primaryContainer,
    },
    separator: { height: 8 },
  });

export function useScreenStyles() {
  const { colors } = useAppTheme();
  return useMemo(() => createStyles(colors), [colors]);
}
