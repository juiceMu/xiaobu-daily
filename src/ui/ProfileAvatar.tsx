import React from 'react';
import { Image, View } from 'react-native';
import { Icon } from 'react-native-paper';
import type {
  AvatarPreset,
  ProfileAvatar as AvatarValue,
} from '../domain/types';
import { useAppTheme } from './ThemeProvider';

export const avatarOptions: { id: AvatarPreset; name: string; icon: string }[] =
  [
    { id: 'sprout', name: '小芽', icon: 'sprout-outline' },
    { id: 'sun', name: '暖阳', icon: 'white-balance-sunny' },
    { id: 'moon', name: '月亮', icon: 'moon-waning-crescent' },
    { id: 'flower', name: '小花', icon: 'flower-outline' },
  ];
export const defaultAvatar: AvatarValue = { kind: 'preset', id: 'sprout' };
export function ProfileAvatar({
  avatar = defaultAvatar,
  size = 48,
}: {
  avatar?: AvatarValue;
  size?: number;
}) {
  const { colors } = useAppTheme();
  return avatar.kind === 'image' ? (
    <Image
      source={{ uri: avatar.dataUri }}
      accessibilityLabel="本机账户头像"
      style={{ width: size, height: size, borderRadius: size / 2 }}
    />
  ) : (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.primaryContainer,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon
        source={
          avatarOptions.find((item) => item.id === avatar.id)?.icon ??
          'sprout-outline'
        }
        size={size / 2}
        color={colors.primary}
      />
    </View>
  );
}
