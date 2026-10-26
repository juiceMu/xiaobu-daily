import React from 'react';
import { View } from 'react-native';
import { Text } from 'react-native-paper';
import type { CompanionUse, Ticket } from '../domain/types';
import { useAppTheme } from './ThemeProvider';

export function CompanionHistory({
  source,
  session,
}: {
  source: Ticket['source'];
  session: CompanionUse;
}) {
  const { colors } = useAppTheme();
  const partnerName =
    source === 'companion' ? session.mainName : session.companionName;
  const partnerTicketName =
    source === 'companion'
      ? session.mainTicketName
      : session.companionTicketName;
  return (
    <View testID="companion-history" style={{ gap: 4 }}>
      <Text style={{ fontSize: 12, lineHeight: 18, color: colors.muted }}>
        同行：{partnerName}
      </Text>
      <Text
        testID="companion-history-details"
        style={{ fontSize: 12, lineHeight: 18, color: colors.muted }}
      >
        搭配：{partnerTicketName}
      </Text>
    </View>
  );
}
