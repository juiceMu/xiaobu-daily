import React from 'react';
import { View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import type { TicketStatus } from '../domain/types';
import { useAppTheme } from './ThemeProvider';

// 贴在卡片右上角。文字和图标共同说明状态，不依赖颜色。
export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  const { colors } = useAppTheme();
  if (status === 'available') return null;
  const used = status === 'used';
  const label = used ? '已使用' : '已过期';
  const foreground = used ? colors.onUsedBadge : colors.onExpiredBadge;
  return (
    <View
      testID="ticket-status-badge"
      accessible
      accessibilityLabel={label}
      style={{
        position: 'absolute',
        top: 0,
        right: 0,
        zIndex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        paddingLeft: 8,
        paddingRight: 10,
        paddingVertical: 3,
        borderBottomLeftRadius: 10,
        backgroundColor: used ? colors.usedBadge : colors.expiredBadge,
      }}
    >
      <View accessible={false} importantForAccessibility="no-hide-descendants">
        <Icon
          source={used ? 'check-circle-outline' : 'clock-alert-outline'}
          size={14}
          color={foreground}
        />
      </View>
      <Text
        style={{
          fontSize: 12,
          lineHeight: 16,
          fontWeight: '500',
          color: foreground,
        }}
      >
        {label}
      </Text>
    </View>
  );
}
