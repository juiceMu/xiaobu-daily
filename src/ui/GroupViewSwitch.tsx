import React from 'react';
import { Pressable, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useApp } from '../state/AppProvider';
import { useAppTheme } from './ThemeProvider';
import { useGroupView } from './GroupViewProvider';
import type { GroupViewMode } from '../state/groupView';

export function GroupViewSwitch({
  displayMode,
  onChangeMode,
  disabled = false,
}: {
  displayMode?: GroupViewMode;
  onChangeMode?: (mode: GroupViewMode) => Promise<boolean>;
  disabled?: boolean;
} = {}) {
  const { state } = useApp();
  const { mode, busy, setMode } = useGroupView();
  const { colors } = useAppTheme();
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
            accessibilityState={{ selected, disabled: busy || disabled }}
            accessibilityLabel={label}
            disabled={busy || disabled}
            onPress={() => {
              void (onChangeMode ?? setMode)(value);
            }}
            style={{ borderRadius: 18 }}
          >
            <View
              style={{
                minHeight: 30,
                paddingHorizontal: 8,
                borderRadius: 18,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: selected
                  ? colors.primaryContainer
                  : 'transparent',
              }}
            >
              <Text style={{ fontSize: 12, lineHeight: 18, color: colors.ink }}>
                {label}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
