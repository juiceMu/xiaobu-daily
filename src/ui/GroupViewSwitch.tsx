import React from 'react';
import { Pressable, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useApp } from '../state/AppProvider';
import { useAppTheme } from './ThemeProvider';
import { useGroupView } from './GroupViewProvider';

export function GroupViewSwitch() {
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
        const selected = mode === value;
        return (
          <Pressable
            key={value}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled: busy }}
            accessibilityLabel={label}
            disabled={busy}
            onPress={() => {
              void setMode(value);
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
