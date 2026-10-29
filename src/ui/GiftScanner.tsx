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
  const [requesting, setRequesting] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const scanned = useRef(false);
  const closedRef = useRef(false);
  const requestingRef = useRef(false);
  const permissionPausedRef = useRef(false);
  const activeRef = useRef(AppState.currentState === 'active');
  const cameraEnabledRef = useRef(true);
  const onCloseRef = useRef(onClose);
  const onScanRef = useRef(onScan);
  const requestIdRef = useRef(0);
  const [active, setActive] = useState(AppState.currentState === 'active');
  useEffect(() => {
    onCloseRef.current = onClose;
    onScanRef.current = onScan;
  }, [onClose, onScan]);
  function closeScanner() {
    if (closedRef.current) return;
    closedRef.current = true;
    requestIdRef.current += 1;
    cameraEnabledRef.current = false;
    setCameraEnabled(false);
    onCloseRef.current();
  }
  useEffect(() => {
    closedRef.current = false;
    requestingRef.current = false;
    const subscription = AppState.addEventListener('change', (status) => {
      activeRef.current = status === 'active';
      setActive(status === 'active');
      if (status === 'background') {
        cameraEnabledRef.current = false;
        setCameraEnabled(false);
        if (requestingRef.current) {
          // Android系统授权Activity也会触发background；暂挂镜头，返回后由用户明确继续。
          permissionPausedRef.current = true;
        } else if (!closedRef.current) {
          closedRef.current = true;
          requestIdRef.current += 1;
          onCloseRef.current();
        }
      }
    });
    return () => {
      closedRef.current = true;
      requestIdRef.current += 1;
      subscription.remove();
    };
  }, []);

  async function allowCamera() {
    if (requestingRef.current || closedRef.current || !activeRef.current)
      return;
    setError('');
    if (permission?.granted) {
      cameraEnabledRef.current = true;
      setCameraEnabled(true);
      return;
    }
    requestingRef.current = true;
    const requestId = ++requestIdRef.current;
    permissionPausedRef.current = false;
    cameraEnabledRef.current = false;
    setCameraEnabled(false);
    setRequesting(true);
    try {
      const result = await requestPermission();
      if (closedRef.current || requestId !== requestIdRef.current) return;
      if (!result.granted) {
        setError('未获得相机权限，请重试或在系统设置中允许，也可以粘贴券码。');
      } else {
        setError('');
        const enable = !permissionPausedRef.current && activeRef.current;
        cameraEnabledRef.current = enable;
        setCameraEnabled(enable);
      }
    } catch {
      if (!closedRef.current && requestId === requestIdRef.current)
        setError('无法请求相机权限，请重试或改用粘贴券码。');
    } finally {
      if (!closedRef.current && requestId === requestIdRef.current) {
        requestingRef.current = false;
        setRequesting(false);
      }
    }
  }
  return (
    <View style={{ gap: 8 }}>
      {permission?.granted && active && cameraEnabled && !requesting ? (
        <CameraView
          facing="back"
          style={{ height: 280, width: '100%', borderRadius: 16 }}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onMountError={() => {
            if (!closedRef.current && activeRef.current)
              setError('相机暂时无法打开，请改用粘贴券码。');
          }}
          onBarcodeScanned={({ data }) => {
            if (
              !scanned.current &&
              !closedRef.current &&
              activeRef.current &&
              cameraEnabledRef.current
            ) {
              scanned.current = true;
              onScanRef.current(data);
            }
          }}
        />
      ) : (
        <>
          <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>
            {permission?.granted
              ? '已允许使用相机，点击「开始扫码」继续。'
              : '允许使用相机后，将镜头对准对方的二维码。也可以关闭后粘贴券码。'}
          </Text>
          <ActionButton
            disabled={requesting || !active}
            loading={requesting}
            onPress={() => {
              void allowCamera();
            }}
          >
            {requesting
              ? '等待相机授权'
              : permission?.granted
                ? '开始扫码'
                : '允许使用相机'}
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
      <ActionButton tone="neutral" onPress={closeScanner}>
        关闭扫码
      </ActionButton>
    </View>
  );
}
