import { utilityColors } from './themeCatalog';
import { useAppTheme } from './ThemeProvider';
import React, { useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import { Text } from 'react-native-paper';
import QRCode from 'react-native-qrcode-svg';

export type GiftQrCodeProps = {
  value: string;
  accessibilityLabel?: string;
  errorMessage?: string;
};

// 扫码区固定黑白与留白，不使用浅色主题降低二维码辨识度。
export function GiftQrCode({
  value,
  accessibilityLabel = '赠券二维码，请让对方扫码',
  errorMessage = '二维码暂时无法显示，请使用下方完整券码。',
}: GiftQrCodeProps) {
  const { colors } = useAppTheme();
  const [error, setError] = useState(false);
  const { width } = useWindowDimensions();
  const [availableWidth, setAvailableWidth] = useState(width - 64);
  return (
    <View
      accessible={!error}
      accessibilityRole={error ? undefined : 'image'}
      accessibilityLabel={error ? undefined : accessibilityLabel}
      onLayout={(event) => setAvailableWidth(event.nativeEvent.layout.width)}
      style={{
        alignSelf: 'center',
        alignItems: 'center',
        width: '100%',
        maxWidth: 324,
        padding: 16,
        backgroundColor: utilityColors.qrSurface,
        borderRadius: 12,
      }}
    >
      {error ? (
        <Text
          accessibilityLiveRegion="polite"
          style={{ color: colors.danger, fontSize: 12, lineHeight: 18 }}
        >
          {errorMessage}
        </Text>
      ) : (
        <QRCode
          value={value}
          size={Math.max(1, Math.min(260, availableWidth - 64))}
          quietZone={16}
          color={utilityColors.qrInk}
          backgroundColor={utilityColors.qrSurface}
          ecl="M"
          onError={() => setError(true)}
        />
      )}
    </View>
  );
}
