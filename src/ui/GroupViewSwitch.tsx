import React from 'react';
import { Pressable, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useApp } from '../state/AppProvider';
import { useAppTheme } from './ThemeProvider';
import { useGroupView } from './GroupViewProvider';
import { control, font, radius, space } from './uiTokens';
import { useKeyboardFocus } from './useKeyboardFocus';
import type { GroupViewMode } from '../state/groupView';

export function GroupViewSwitch({
  displayMode,
  onChangeMode,
  disabled = false,
  textOnly = false,
}: {
  displayMode?: GroupViewMode;
  onChangeMode?: (mode: GroupViewMode) => Promise<boolean>;
  disabled?: boolean;
  textOnly?: boolean;
} = {}) {
  const { state } = useApp();
  const { mode, busy, setMode } = useGroupView();
  const { colors } = useAppTheme();
  const focus = useKeyboardFocus();
  const [focusedValue, setFocusedValue] = React.useState<GroupViewMode>();
  if (!state.groupLink) return null;
  return (
    <View
      accessibilityRole="radiogroup"
      style={{ flexDirection: 'row', gap: 8 }}
    >
      {(
        [
          ['self', '只看自己'],
          ['group', '看全组'],
        ] as const
      ).map(([value, label]) => {
        const selected = (displayMode ?? mode) === value;
        return (
          <Pressable
            key={value}
            accessibilityRole="radio"
            accessibilityState={{
              checked: selected,
              selected,
              disabled: busy || disabled,
            }}
            aria-checked={selected}
            aria-disabled={busy || disabled}
            accessibilityLabel={label}
            disabled={busy || disabled}
            onFocus={() => {
              focus.onFocus();
              setFocusedValue(value);
            }}
            onBlur={() => {
              focus.onBlur();
              setFocusedValue(undefined);
            }}
            onPress={() => {
              void (onChangeMode ?? setMode)(value);
            }}
            style={{
              minWidth: 48,
              minHeight: 48,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 18,
              outlineWidth:
                !busy &&
                !disabled &&
                focus.focusVisible &&
                focusedValue === value
                  ? 2
                  : 0,
              outlineColor: colors.primary,
              outlineOffset: 2,
              outlineStyle: 'solid',
            }}
          >
            <View
              style={[
                {
                  minHeight: 30,
                  paddingHorizontal: 8,
                  borderRadius: 18,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor:
                    selected && !busy && !disabled
                      ? colors.primaryContainer
                      : 'transparent',
                },
                textOnly && {
                  minHeight: control[26],
                  paddingHorizontal: space[6],
                  flexDirection: 'row',
                  gap: space[4],
                  backgroundColor: 'transparent',
                },
              ]}
            >
              {textOnly && selected && !busy && !disabled ? (
                <View
                  aria-hidden
                  style={{
                    width: space[5],
                    height: space[5],
                    borderRadius: radius.full,
                    backgroundColor: colors.primary,
                  }}
                />
              ) : null}
              <Text
                style={{
                  fontSize: textOnly ? font[11] : font[12],
                  lineHeight: font[18],
                  color: disabled || busy ? colors.muted : colors.ink,
                  fontWeight: selected && textOnly ? '500' : '400',
                }}
              >
                {label}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
