import { utilityColors } from './themeCatalog';
import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Text } from 'react-native-paper';
import { ActionButton } from './components';
import { ScannerWarning } from './ScannerWarning';
import { useAppTheme } from './ThemeProvider';
import type { GiftScannerProps } from './GiftScanner';

export function GiftScanner({
  onScan,
  onClose,
  wrapPreview,
}: GiftScannerProps) {
  const { colors } = useAppTheme();
  const video = useRef<HTMLVideoElement>(null);
  const onScanRef = useRef(onScan);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onScanRef.current = onScan;
    onCloseRef.current = onClose;
  }, [onScan, onClose]);
  const [error, setError] = useState('');
  const [allowed, setAllowed] = useState(!wrapPreview);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    let completed = false;
    let controls: { stop: () => void } | undefined;
    const element = video.current;
    function release() {
      controls?.stop();
      const stream = element?.srcObject;
      if (typeof MediaStream !== 'undefined' && stream instanceof MediaStream)
        stream.getTracks().forEach((track) => track.stop());
      if (element) element.srcObject = null;
    }
    async function start() {
      if (!window.isSecureContext) {
        setError(
          '当前地址不能使用相机。请用 HTTPS 或本机 localhost 打开，也可以关闭后粘贴券码。',
        );
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('当前浏览器无法使用相机，可以关闭后粘贴券码。');
        return;
      }
      try {
        const { BrowserQRCodeReader } = await import('@zxing/browser');
        if (cancelled || !element) return;
        const reader = new BrowserQRCodeReader();
        const running = await reader.decodeFromConstraints(
          { audio: false, video: { facingMode: { ideal: 'environment' } } },
          element,
          (result, _error, liveControls) => {
            if (cancelled || completed || !result) return;
            completed = true;
            liveControls.stop();
            release();
            onScanRef.current(result.getText());
          },
        );
        controls = running;
        // 权限弹窗可能在离开页面后才结束，晚到的相机也必须关闭。
        if (cancelled || completed) release();
      } catch (cause) {
        release();
        if (cancelled) return;
        const reason = cause instanceof Error ? cause.name : '';
        if (reason === 'NotFoundError') {
          setError('没有找到可用相机，可以关闭后粘贴券码。');
        } else if (reason === 'NotAllowedError') {
          setError('请在浏览器的站点设置中允许使用相机，然后重试。');
        } else {
          setError('相机暂时无法使用，请重试或关闭后粘贴券码。');
        }
      }
    }
    function pauseWhenHidden() {
      if (document.hidden) {
        cancelled = true;
        release();
        setError('相机已暂停，返回后可重试或改用粘贴券码。');
        onCloseRef.current();
      }
    }
    document.addEventListener('visibilitychange', pauseWhenHidden);
    void start();
    return () => {
      cancelled = true;
      release();
      document.removeEventListener('visibilitychange', pauseWhenHidden);
    };
  }, [allowed, retry]);
  const showWarning = !!wrapPreview && !!error;
  const camera =
    allowed && !showWarning ? (
      <video
        ref={video}
        muted
        autoPlay
        playsInline
        aria-label="扫码相机预览"
        style={{
          width: '100%',
          height: wrapPreview ? '100%' : 280,
          objectFit: 'cover',
          borderRadius: 16,
          background: utilityColors.cameraSurface,
        }}
      />
    ) : null;
  return (
    <View style={{ gap: 8 }}>
      {wrapPreview ? !showWarning && wrapPreview(camera) : camera}
      {!allowed && (
        <ActionButton mode="contained" onPress={() => setAllowed(true)}>
          允许使用相机
        </ActionButton>
      )}
      {!showWarning && (
        <Text style={{ fontSize: 12, lineHeight: 18, color: colors.muted }}>
          将镜头对准赠券二维码。无法扫码时，可关闭并粘贴完整券码。
        </Text>
      )}
      {showWarning && <ScannerWarning description={error} />}
      {!!error && (
        <>
          {!showWarning && (
            <Text
              accessibilityRole="alert"
              style={{ fontSize: 12, lineHeight: 18, color: colors.danger }}
            >
              {error}
            </Text>
          )}
          <ActionButton
            mode={showWarning ? 'contained' : 'text'}
            onPress={() => {
              setError('');
              setRetry((value) => value + 1);
            }}
          >
            重试相机
          </ActionButton>
        </>
      )}
      <ActionButton tone="neutral" onPress={onClose}>
        关闭扫码
      </ActionButton>
    </View>
  );
}
