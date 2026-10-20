import React from 'react';
import { View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import type { TicketStatus } from '../domain/types';
import { useAppTheme } from './ThemeProvider';

// 文字和图标共同说明状态，不依赖颜色，也不覆盖奖券内容。
export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  const { colors } = useAppTheme();
  if (status === 'available') return null;
  const used = status === 'used';
  const label = used ? '已使用' : '已过期';
  const foreground = used ? colors.onUsedBadge : colors.onExpiredBadge;
  return (
    <View style={{ alignItems: 'flex-end' }}>
      <View
        testID="ticket-status-badge"
        accessible
        accessibilityLabel={label}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          flexWrap: 'wrap',
          alignSelf: 'flex-end',
          maxWidth: '100%',
          gap: 4,
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: 10,
          backgroundColor: used ? colors.usedBadge : colors.expiredBadge,
        }}
      >
        <View
          accessible={false}
          importantForAccessibility="no-hide-descendants"
        >
          <Icon
            source={used ? 'check-circle-outline' : 'clock-alert-outline'}
            size={14}
            color={foreground}
          />
        </View>
        <Text
          style={{
            fontSize: 12,
            lineHeight: 18,
            fontWeight: '500',
            flexShrink: 1,
            color: foreground,
          }}
        >
          {label}
        </Text>
      </View>
    </View>
  );
}
