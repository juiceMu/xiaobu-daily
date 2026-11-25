import React, {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';
import { View } from 'react-native';
import { Text } from 'react-native-paper';
import {
  useIsFocused,
  useNavigation,
  usePreventRemove,
  type NavigationProp,
} from '@react-navigation/native';
import { useApp } from '../state/AppProvider';
import { AppTextInput } from '../ui/AppTextInput';
import { ActionButton, Page, Panel } from '../ui/components';
import type { GiftScannerProps } from '../ui/GiftScanner';
import { useAppTheme } from '../ui/ThemeProvider';
import { radius, space } from '../ui/uiTokens';
import { GiftClaimDialogs, useGiftClaim } from './GiftClaimFlow';
import { confirmDiscard, ErrorText, useScreenStyles } from './shared';

const FRAME_SIZE = 160;
const STAGE_HEIGHT = 220;

function ScannerFrame({ children }: { children?: ReactNode }) {
  const { colors } = useAppTheme();
  return (
    <View
      style={{
        height: STAGE_HEIGHT,
        borderRadius: radius[14],
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
      <View
        aria-hidden
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: FRAME_SIZE,
          height: FRAME_SIZE,
          borderRadius: radius[14],
          borderWidth: 2,
          borderStyle: 'dashed',
          borderColor: colors.primary,
        }}
      >
        {(
          ['top-left', 'top-right', 'bottom-left', 'bottom-right'] as const
        ).map((corner) => {
          const isTop = corner.startsWith('top');
          const isLeft = corner.endsWith('left');
          return (
            <View
              key={corner}
              style={{
                position: 'absolute',
                width: space[16],
                height: space[16],
                top: isTop ? -2 : undefined,
                bottom: isTop ? undefined : -2,
                left: isLeft ? -2 : undefined,
                right: isLeft ? undefined : -2,
                borderTopWidth: isTop ? 2 : 0,
                borderBottomWidth: isTop ? 0 : 2,
                borderLeftWidth: isLeft ? 2 : 0,
                borderRightWidth: isLeft ? 0 : 2,
                borderColor: colors.primary,
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

export function ScanScreen() {
  const navigation = useNavigation<
    NavigationProp<{
      tabs: { screen: 'more'; params: { screen: 'account' } };
    }>
  >();
  const focused = useIsFocused();
  const styles = useScreenStyles();
  const { state, busy } = useApp();
  const [error, setError] = useState('');
  const [Scanner, setScanner] =
    useState<ComponentType<GiftScannerProps> | null>(null);
  const [opening, setOpening] = useState(false);
  const claim = useGiftClaim(setError);
  const ready = !!state.giftState?.profile;
  const loadRequest = useRef(0);
  usePreventRemove(busy || !!claim.code.trim(), ({ data }) => {
    if (busy) return;
    confirmDiscard('放弃未提交的内容？', '这次填写的券码尚未提交。', () => {
      navigation.dispatch(data.action);
    });
  });
  useEffect(() => {
    const unsubscribe = navigation.addListener('blur', () => {
      loadRequest.current += 1;
      setScanner(null);
      setOpening(false);
    });
    return () => {
      loadRequest.current += 1;
      unsubscribe();
    };
  }, [navigation]);

  async function openScanner() {
    if (!focused || opening || !ready || busy) return;
    const request = ++loadRequest.current;
    setError('');
    setOpening(true);
    try {
      const { GiftScanner } = await import('../ui/GiftScanner');
      if (request === loadRequest.current) setScanner(() => GiftScanner);
    } catch {
      if (request === loadRequest.current)
        setError('暂时无法打开相机，请粘贴完整券码或回执码。');
    } finally {
      if (request === loadRequest.current) setOpening(false);
    }
  }

  return (
    <Page title="扫一扫，领心意" subtitle="把镜头对准对方的二维码。">
      <Panel>
        <Text style={styles.muted}>送人时，在赠送记录里复制券码。</Text>
        <Text style={styles.muted}>
          领取时，可扫码或粘贴券码。回执也可以在此扫描记录。
        </Text>
        {Scanner && focused && ready ? (
          <Scanner
            wrapPreview={(preview) => <ScannerFrame>{preview}</ScannerFrame>}
            onScan={(value) => {
              setScanner(null);
              claim.preview(value);
            }}
            onClose={() => setScanner(null)}
          />
        ) : (
          <>
            <ScannerFrame />
            <ActionButton
              mode="contained"
              disabled={!ready || busy}
              loading={opening}
              onPress={() => void openScanner()}
            >
              打开相机
            </ActionButton>
          </>
        )}
        {!ready ? (
          <>
            <Text style={styles.muted}>
              先保存账户昵称，再领取赠券或记录回执。
            </Text>
            <ActionButton
              mode="outlined"
              onPress={() => {
                navigation.navigate('tabs', {
                  screen: 'more',
                  params: { screen: 'account' },
                });
              }}
            >
              设置账户昵称
            </ActionButton>
          </>
        ) : null}
      </Panel>
      <Panel>
        <AppTextInput
          label="也可以粘贴完整券码或回执码"
          value={claim.code}
          onChangeText={claim.changeCode}
          disabled={!ready || busy}
          multiline
        />
        <ActionButton
          mode="outlined"
          onPress={() => {
            setScanner(null);
            claim.preview();
          }}
          disabled={!ready || busy || !claim.code.trim()}
        >
          预览
        </ActionButton>
        {claim.receivedMessage && (
          <Text accessibilityLiveRegion="polite" style={styles.body}>
            {claim.receivedMessage}
          </Text>
        )}
        <ErrorText message={error} />
      </Panel>
      <GiftClaimDialogs claim={claim} error={error} />
    </Page>
  );
}
