import React, { useRef, type ReactNode } from 'react';
import {
  I18nManager,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { useAppTheme } from './ThemeProvider';
import { useKeyboardFocus } from './useKeyboardFocus';

export function HistoryTabs<T extends string>({
  options,
  value,
  onChange,
  label = '查看方式',
  testID,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label?: string;
  testID?: string;
}) {
  const { colors } = useAppTheme();
  const elements = useRef(new Map<T, View>());
  const isWeb = Platform.OS === 'web';
  function handleKeyDown(event: React.KeyboardEvent, index: number) {
    let next: number;
    switch (event.key) {
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = options.length - 1;
        break;
      case 'ArrowLeft':
      case 'ArrowRight': {
        const forward = (event.key === 'ArrowRight') !== I18nManager.isRTL;
        const step = forward ? 1 : -1;
        next = (index + step + options.length) % options.length;
        break;
      }
      default:
        return;
    }
    event.preventDefault();
    const option = options[next];
    if (!option) return;
    onChange(option.value);
    elements.current.get(option.value)?.focus();
  }

  return (
    <View
      testID={testID}
      accessibilityRole="tablist"
      accessibilityLabel={label}
      style={[styles.tabs, { borderBottomColor: colors.border }]}
    >
      {options.map((option, index) => (
        <HistoryTab
          key={option.value}
          label={option.label}
          selected={option.value === value}
          onPress={() => onChange(option.value)}
          testID={testID ? `${testID}-${option.value}` : undefined}
          ref={
            isWeb
              ? (element) => {
                  if (element) elements.current.set(option.value, element);
                  else elements.current.delete(option.value);
                }
              : undefined
          }
          onKeyDown={isWeb ? (event) => handleKeyDown(event, index) : undefined}
        />
      ))}
    </View>
  );
}

function HistoryTab({
  label,
  selected,
  onPress,
  onKeyDown,
  ref,
  testID,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  onKeyDown?: (event: React.KeyboardEvent) => void;
  ref?: React.Ref<View>;
  testID?: string;
}) {
  const { colors } = useAppTheme();
  const focus = useKeyboardFocus();
  // RN Web 支持 onKeyDown，原生 Pressable 的公共类型未声明此事件。
  const webProps = onKeyDown
    ? { onKeyDown, tabIndex: selected ? (0 as const) : (-1 as const) }
    : {};
  return (
    <Pressable
      {...webProps}
      ref={ref}
      testID={testID}
      accessibilityRole="tab"
      aria-selected={selected}
      accessibilityState={{ selected }}
      onPress={onPress}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      style={[
        styles.tab,
        focus.focusVisible && {
          outlineColor: colors.primary,
          outlineOffset: -2,
          outlineStyle: 'solid',
          outlineWidth: 2,
        },
      ]}
    >
      <Text
        style={[
          styles.tabLabel,
          {
            color: selected ? colors.ink : colors.muted,
            fontWeight: selected ? '700' : '400',
          },
        ]}
      >
        {label}
      </Text>
      {selected ? (
        <View style={[styles.indicator, { borderColor: colors.primary }]} />
      ) : null}
    </Pressable>
  );
}

export function HistoryPanel({
  children,
  label,
  fill = false,
}: {
  children: ReactNode;
  label: string;
  fill?: boolean;
}) {
  return (
    <View
      style={fill ? styles.fill : undefined}
      {...(Platform.OS === 'web'
        ? { role: 'tabpanel' as const, 'aria-label': label }
        : {})}
    >
      {children}
    </View>
  );
}

export function HistoryPeriodArrow({
  direction,
  label,
  onPress,
  testID,
}: {
  direction: 'left' | 'right';
  label: string;
  onPress?: () => void;
  testID?: string;
}) {
  const { colors } = useAppTheme();
  const focus = useKeyboardFocus();
  if (!onPress) return <View style={styles.arrow} />;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      style={[
        styles.arrow,
        focus.focusVisible && {
          outlineColor: colors.primary,
          outlineOffset: -2,
          outlineStyle: 'solid',
          outlineWidth: 2,
        },
      ]}
    >
      <Icon
        source={direction === 'left' ? 'chevron-left' : 'chevron-right'}
        size={22}
        color={colors.primary}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, minHeight: 0 },
  tabs: { flexDirection: 'row', borderBottomWidth: 1 },
  tab: {
    flex: 1,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  tabLabel: { textAlign: 'center', fontSize: 14, lineHeight: 20 },
  indicator: {
    position: 'absolute',
    bottom: 0,
    width: 48,
    borderBottomWidth: 2,
    borderRadius: 1,
  },
  arrow: {
    width: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
});
