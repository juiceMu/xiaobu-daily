import React, { useMemo, useState } from 'react';
import { Modal, Platform, StyleSheet, View } from 'react-native';
import DateTimePicker, {
  DateTimePickerAndroid,
} from '@react-native-community/datetimepicker';
import { Icon, Text, TouchableRipple } from 'react-native-paper';
import { ActionButton } from './components';
import { useAppTheme } from './ThemeProvider';
import type { AppColors } from './themeCatalog';
import { formatTime, isValidTime, type TimeFieldProps } from './timeFieldModel';

function parseTimeValue(value: string): Date {
  const parts = (isValidTime(value) ? value : '00:00').split(':').map(Number);
  const date = new Date();
  date.setHours(parts[0], parts[1], 0, 0);
  return date;
}

export function TimeField({
  label,
  value,
  onChange,
  disabled,
}: TimeFieldProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [visible, setVisible] = useState(false);
  const [draft, setDraft] = useState(() => parseTimeValue(value));

  function open() {
    if (disabled) return;
    const next = parseTimeValue(value);
    setDraft(next);
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: next,
        mode: 'time',
        is24Hour: true,
        onValueChange: (_event, selected) => {
          onChange(formatTime(selected.getHours(), selected.getMinutes()));
        },
      });
      return;
    }
    setVisible(true);
  }

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TouchableRipple
        disabled={disabled}
        onPress={open}
        rippleColor="transparent"
        accessibilityRole="button"
        accessibilityLabel={label + '，' + value + '，点击选择时间'}
        style={styles.trigger}
      >
        <View style={styles.triggerContent}>
          <Text style={styles.value}>{value}</Text>
          <Icon source="clock-outline" size={18} color={colors.primary} />
        </View>
      </TouchableRipple>
      {Platform.OS === 'ios' && visible ? (
        <Modal
          visible={visible}
          transparent
          animationType="none"
          onRequestClose={() => setVisible(false)}
        >
          <View style={styles.scrim}>
            <View style={styles.dialog} accessibilityViewIsModal>
              <Text accessibilityRole="header" style={styles.title}>
                选择{label}
              </Text>
              <Text style={styles.preview}>
                {formatTime(draft.getHours(), draft.getMinutes())}
              </Text>
              <DateTimePicker
                value={draft}
                mode="time"
                display="spinner"
                is24Hour
                locale="zh-CN"
                onValueChange={(_event, selected) => setDraft(selected)}
              />
              <View style={styles.actions}>
                <ActionButton
                  tone="neutral"
                  mode="text"
                  onPress={() => setVisible(false)}
                >
                  取消
                </ActionButton>
                <ActionButton
                  tone="save"
                  mode="contained"
                  disabled={disabled}
                  onPress={() => {
                    onChange(
                      formatTime(draft.getHours(), draft.getMinutes()),
                    );
                    setVisible(false);
                  }}
                >
                  确认时间
                </ActionButton>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const createStyles = (colors: AppColors) =>
  StyleSheet.create({
    field: { gap: 6 },
    label: { fontSize: 12, lineHeight: 18, color: colors.muted },
    trigger: {
      minHeight: 44,
      borderWidth: 0,
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: colors.field,
    },
    triggerContent: {
      minHeight: 44,
      paddingHorizontal: 12,
      paddingVertical: 12,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    value: { fontSize: 14, lineHeight: 20, color: colors.ink },
    scrim: {
      flex: 1,
      backgroundColor: 'rgba(20, 36, 48, 0.4)',
      justifyContent: 'center',
      padding: 16,
    },
    dialog: {
      alignSelf: 'center',
      width: '100%',
      maxWidth: 360,
      maxHeight: '85%',
      backgroundColor: colors.surface,
      borderRadius: 20,
      padding: 16,
      gap: 8,
    },
    title: {
      fontSize: 16,
      lineHeight: 22,
      fontWeight: '600',
      color: colors.ink,
    },
    preview: {
      fontSize: 22,
      lineHeight: 28,
      color: colors.primary,
      textAlign: 'center',
    },
    actions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      flexWrap: 'wrap',
      gap: 8,
    },
  });
