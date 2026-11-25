import React from 'react';
import { Platform, Pressable, View } from 'react-native';
import { useAppTheme } from './ThemeProvider';
import { utilityColors } from './themeCatalog';
import { control, radius, space } from './uiTokens';
import { useKeyboardFocus } from './useKeyboardFocus';

export type CompactSwitchProps = {
  value: boolean;
  disabled?: boolean;
  onValueChange: (value: boolean) => void;
  accessibilityLabel: string;
};

export function CompactSwitch({
  value,
  disabled,
  onValueChange,
  accessibilityLabel,
}: CompactSwitchProps) {
  const { colors, theme } = useAppTheme();
  const focus = useKeyboardFocus();
  const track = disabled
    ? theme.colors.surfaceDisabled
    : value
      ? colors.primary
      : colors.border;
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      aria-checked={value}
      aria-disabled={disabled}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      onFocus={focus.onFocus}
      onBlur={focus.onBlur}
      style={{
        width: control[44],
        height: control[44],
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius.full,
        ...(Platform.OS === 'web'
          ? {
              outlineStyle: 'solid',
              outlineWidth: focus.focusVisible ? 2 : 0,
              outlineColor: colors.primary,
              outlineOffset: 2,
            }
          : null),
      }}
    >
      {({ pressed }) => (
        <View
          style={{
            width: 38,
            height: 22,
            borderWidth: 0,
            borderRadius: radius.full,
            backgroundColor: track,
            paddingHorizontal: space[2],
            alignItems: value ? 'flex-end' : 'flex-start',
            justifyContent: 'center',
            ...(pressed && !disabled ? { opacity: 0.82 } : null),
          }}
        >
          {disabled ? (
            <View
              style={{
                position: 'absolute',
                inset: 0,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: radius.full,
              }}
            />
          ) : null}
          <View
            style={{
              width: 18,
              height: 18,
              borderRadius: radius.full,
              backgroundColor: utilityColors.onSolid,
            }}
          />
        </View>
      )}
    </Pressable>
  );
}
