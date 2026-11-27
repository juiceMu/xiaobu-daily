import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Icon, Text } from 'react-native-paper';
import { softThemeRoles } from './themeCatalog';

export function ScannerWarning({
  description,
  children,
}: {
  description: string;
  children?: ReactNode;
}) {
  return (
    <View
      style={{
        gap: 8,
        padding: 12,
        borderRadius: 8,
        backgroundColor: softThemeRoles.warningSoft,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
        <View aria-hidden>
          <Icon
            source="alert-outline"
            size={16}
            color={softThemeRoles.warning}
          />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text
            accessibilityRole="alert"
            style={{
              fontSize: 13,
              fontWeight: '500',
              color: softThemeRoles.warning,
            }}
          >
            无法打开相机
          </Text>
          <Text
            style={{
              fontSize: 12,
              lineHeight: 18,
              color: softThemeRoles.warning,
            }}
          >
            {description}
          </Text>
        </View>
      </View>
      {children}
    </View>
  );
}
