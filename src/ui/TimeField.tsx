import React, { useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { Icon, Text, TouchableRipple } from 'react-native-paper';
import { ActionButton } from './components';
import { useAppTheme } from './ThemeProvider';
import type { AppColors } from './themeCatalog';
import { formatTime, isValidTime, type TimeFieldProps } from './timeFieldModel';

export function TimeField({
  label,
  value,
  onChange,
  disabled,
}: TimeFieldProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [visible, setVisible] = useState(false);
  const [hour, setHour] = useState(0);
  const [minute, setMinute] = useState(0);
  function open() {
    if (disabled) return;
    const parts = (isValidTime(value) ? value : '00:00').split(':').map(Number);
    setHour(parts[0]);
    setMinute(parts[1]);
    setVisible(true);
  }
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TouchableRipple
        disabled={disabled}
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={label + '，' + value + '，点击选择时间'}
        style={styles.trigger}
      >
        <View style={styles.triggerContent}>
          <Text style={styles.value}>{value}</Text>
          <Icon source="clock-outline" size={18} color={colors.primary} />
        </View>
      </TouchableRipple>
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
            <Text style={styles.preview}>{formatTime(hour, minute)}</Text>
            <View style={styles.columns}>
              {(['小时', '分钟'] as const).map((unit, column) => (
                <View key={unit} style={styles.column}>
                  <Text style={styles.label}>{unit}</Text>
                  <ScrollView
                    style={styles.options}
                    contentContainerStyle={{ gap: 4 }}
                    showsVerticalScrollIndicator
                  >
                    {Array.from(
                      { length: column === 0 ? 24 : 60 },
                      (_, index) => (
                        <ActionButton
                          key={index}
                          mode={
                            (column === 0 ? hour : minute) === index
                              ? 'contained-tonal'
                              : 'text'
                          }
                          accessibilityLabel={
                            index + (column === 0 ? '时' : '分')
                          }
                          accessibilityState={{
                            selected: (column === 0 ? hour : minute) === index,
                          }}
                          onPress={() =>
                            column === 0 ? setHour(index) : setMinute(index)
                          }
                        >
                          {String(index).padStart(2, '0')}
                        </ActionButton>
                      ),
                    )}
                  </ScrollView>
                </View>
              ))}
            </View>
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
                  onChange(formatTime(hour, minute));
                  setVisible(false);
                }}
              >
                确认时间
              </ActionButton>
            </View>
          </View>
        </View>
      </Modal>
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
    columns: { flexDirection: 'row', gap: 16, flexShrink: 1, minHeight: 0 },
    column: { flex: 1, gap: 8 },
    options: { maxHeight: 240 },
    actions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      flexWrap: 'wrap',
      gap: 8,
    },
  });
