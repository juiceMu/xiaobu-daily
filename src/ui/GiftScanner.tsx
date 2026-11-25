import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AppState, Linking, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Text } from 'react-native-paper';
import { ActionButton } from './components';
import { useAppTheme } from './ThemeProvider';

export type GiftScannerProps = {
  onScan: (value: string) => void;
  onClose: () => void;
  wrapPreview?: (preview?: ReactNode) => ReactNode;
};
export function GiftScanner({
  onScan,
  onClose,
  wrapPreview,
}: GiftScannerProps) {
  const { colors } = useAppTheme();
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  const [error, setError] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(
    AppState.currentState === 'active',
  );
  const cameraRef = useRef<CameraView | null>(null);
  const scanned = useRef(false);
  const closedRef = useRef(false);
  const requestingRef = useRef(false);
  const openingSettingsRef = useRef(false);
  const permissionPausedRef = useRef(false);
  const activeRef = useRef(AppState.currentState === 'active');
  const cameraEnabledRef = useRef(AppState.currentState === 'active');
  const onCloseRef = useRef(onClose);
  const onScanRef = useRef(onScan);
  const requestIdRef = useRef(0);
  const [active, setActive] = useState(AppState.currentState === 'active');
  const [cameraVersion, setCameraVersion] = useState(0);
  const cameraVersionRef = useRef(0);
  useEffect(() => {
    onCloseRef.current = onClose;
    onScanRef.current = onScan;
  }, [onClose, onScan]);
  const pauseCameraPreview = useCallback(async (camera = cameraRef.current) => {
    try {
      // 原生生命周期可能先于React卸载恢复；先解绑预览，仍继续关闭和卸载。
      await camera?.pausePreview();
    } catch {
      // 镜头可能已被系统或卸载释放，暂停失败不阻止退出扫码。
    }
  }, []);
  const cameraAttachment = useCallback(
    (camera: CameraView | null) => {
      const previous = cameraRef.current;
      cameraRef.current = camera;
      // React先清空ref再运行effect清理，必须在解绑时保留旧实例并暂停。
      if (previous && previous !== camera) void pauseCameraPreview(previous);
      // 原生实例可能晚于后台/关闭事件交付，不能重新变成活跃镜头。
      if (
        camera &&
        (closedRef.current || !activeRef.current || !cameraEnabledRef.current)
      ) {
        void pauseCameraPreview(camera);
      }
    },
    [pauseCameraPreview],
  );
  function closeScanner() {
    if (closedRef.current) return;
    closedRef.current = true;
    requestIdRef.current += 1;
    cameraEnabledRef.current = false;
    void pauseCameraPreview();
    setCameraEnabled(false);
    onCloseRef.current();
  }
  useEffect(() => {
    closedRef.current = false;
    requestingRef.current = false;
    const handleAppStateChange = (status: string) => {
      activeRef.current = status === 'active';
      setActive(status === 'active');
      if (status === 'active' && openingSettingsRef.current) {
        openingSettingsRef.current = false;
        void getPermission().then(
          (next) => {
            if (next.granted && !closedRef.current) setError('');
          },
          () => {
            if (!closedRef.current)
              setError('无法读取相机权限，请重试或粘贴券码。');
          },
        );
      }
      if (status === 'background') {
        cameraEnabledRef.current = false;
        void pauseCameraPreview();
        setCameraEnabled(false);
        if (requestingRef.current) {
          // Android系统授权Activity也会触发background；暂挂镜头，返回后由用户明确继续。
          permissionPausedRef.current = true;
        } else if (!openingSettingsRef.current && !closedRef.current) {
          closedRef.current = true;
          requestIdRef.current += 1;
          onCloseRef.current();
        }
      }
    };
    const subscription = AppState.addEventListener(
      'change',
      handleAppStateChange,
    );
    // 动态import和首次effect之间可能已经退后台，不能只等下一次事件。
    if (AppState.currentState !== 'active') {
      handleAppStateChange(AppState.currentState);
    }
    return () => {
      closedRef.current = true;
      requestIdRef.current += 1;
      cameraEnabledRef.current = false;
      void pauseCameraPreview();
      subscription.remove();
    };
  }, [getPermission, pauseCameraPreview]);

  async function allowCamera() {
    if (requestingRef.current || closedRef.current || !activeRef.current)
      return;
    setError('');
    if (permission?.granted) {
      cameraVersionRef.current += 1;
      setCameraVersion(cameraVersionRef.current);
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
  async function openCameraSettings() {
    if (openingSettingsRef.current || closedRef.current) return;
    openingSettingsRef.current = true;
    try {
      await Linking.openSettings();
    } catch {
      openingSettingsRef.current = false;
      if (!closedRef.current)
        setError('无法打开设置。请在系统设置中找到小步日常，并允许使用相机。');
    }
  }

  const cameraVisible =
    permission?.granted && active && cameraEnabled && !requesting;
  const camera = cameraVisible ? (
    <CameraView
      ref={cameraAttachment}
      facing="back"
      style={{ height: wrapPreview ? '100%' : 280, width: '100%' }}
      barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      onMountError={() => {
        if (
          !closedRef.current &&
          cameraEnabledRef.current &&
          cameraVersion === cameraVersionRef.current
        ) {
          cameraEnabledRef.current = false;
          setCameraEnabled(false);
          setError('相机暂时无法打开，请重试或改用粘贴券码。');
        }
      }}
      onBarcodeScanned={({ data }) => {
        if (
          !scanned.current &&
          !closedRef.current &&
          activeRef.current &&
          cameraVersion === cameraVersionRef.current &&
          cameraEnabledRef.current
        ) {
          scanned.current = true;
          if (wrapPreview) {
            cameraEnabledRef.current = false;
            void pauseCameraPreview();
            setCameraEnabled(false);
          }
          onScanRef.current(data);
        }
      }}
    />
  ) : null;
  return (
    <View style={{ gap: 8 }}>
      {wrapPreview ? wrapPreview(camera) : camera}
      {!cameraVisible && (
        <>
          <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>
            {permission?.granted
              ? '已允许使用相机，点击「开始扫码」继续。'
              : '允许使用相机后，将镜头对准对方的二维码。也可以关闭后粘贴券码。'}
          </Text>
          <ActionButton
            disabled={
              requesting ||
              !active ||
              (permission?.canAskAgain === false && !permission.granted)
            }
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
      {wrapPreview && permission && !permission.granted && (
        <ActionButton
          mode="text"
          tone="neutral"
          disabled={requesting || !active}
          onPress={() => void openCameraSettings()}
        >
          去系统设置开启相机
        </ActionButton>
      )}
      <ActionButton tone="neutral" onPress={closeScanner}>
        关闭扫码
      </ActionButton>
    </View>
  );
}
