import React, { useEffect, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Text } from 'react-native-paper';
import { ActionButton } from './components';
import { useAppTheme } from './ThemeProvider';

export type GiftScannerProps = {
  onScan: (value: string) => void;
  onClose: () => void;
};
export function GiftScanner({ onScan, onClose }: GiftScannerProps) {
  const { colors } = useAppTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState('');
  const scanned = useRef(false);
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      setActive(status === 'active');
      if (status === 'background') onClose();
    });
    return () => subscription.remove();
  }, [onClose]);
  return (
    <View style={{ gap: 8 }}>
      {permission?.granted && active ? (
        <CameraView
          facing="back"
          style={{ height: 280, width: '100%', borderRadius: 16 }}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onMountError={() => setError('相机暂时无法打开，请改用粘贴券码。')}
          onBarcodeScanned={({ data }) => {
            if (!scanned.current) {
              scanned.current = true;
              onScan(data);
            }
          }}
        />
      ) : (
        <>
          <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>
            允许使用相机后，将镜头对准对方的二维码。也可以关闭后粘贴券码。
          </Text>
          <ActionButton
            onPress={() => {
              void requestPermission()
                .then((result) => {
                  if (!result.granted)
                    setError(
                      '未获得相机权限，请在系统设置中允许，或粘贴券码。',
                    );
                })
                .catch(() => setError('无法请求相机权限，请改用粘贴券码。'));
            }}
          >
            允许使用相机
          </ActionButton>
        </>
      )}
      {!!error && (
        <Text
          accessibilityRole="alert"
          style={{ color: colors.danger, fontSize: 12, lineHeight: 18 }}
        >
          {error}
        </Text>
      )}
      <ActionButton tone="neutral" onPress={onClose}>
        关闭扫码
      </ActionButton>
    </View>
  );
}
