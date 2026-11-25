import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { Text } from 'react-native-paper';
import * as Clipboard from 'expo-clipboard';
import { ActionButton } from './components';
import { copyCode } from './copyCode';
import { useAppTheme } from './ThemeProvider';

type CopyCodeButtonProps = {
  value: string;
  label: string;
  compactHeight?: boolean;
  outlined?: boolean;
};

export function CopyCodeButton(props: CopyCodeButtonProps) {
  // 凭证变更时重建局部状态，避免用effect同步更新状态。
  return <CopyCodeAction key={props.value} {...props} />;
}

function CopyCodeAction({
  value,
  label,
  compactHeight,
  outlined,
}: CopyCodeButtonProps) {
  const { colors } = useAppTheme();
  const [copying, setCopying] = useState(false);
  const [message, setMessage] = useState('');
  const [failed, setFailed] = useState(false);
  const pendingRef = useRef(false);
  const requestRef = useRef(0);
  useEffect(() => {
    return () => {
      requestRef.current += 1;
    };
  }, []);

  async function handleCopy() {
    if (pendingRef.current) return;
    pendingRef.current = true;
    const request = requestRef.current;
    setCopying(true);
    setMessage('');
    const copied = await copyCode(value, Clipboard.setStringAsync);
    // 关闭弹窗或更换凭证后，不显示上一次异步操作的结果。
    if (request !== requestRef.current) return;
    pendingRef.current = false;
    setCopying(false);
    setFailed(!copied);
    setMessage(
      copied
        ? `${label}已复制，可以粘贴发送。`
        : `未能复制${label}，请重试或改用二维码。`,
    );
  }

  return (
    <View style={{ gap: 8 }}>
      <ActionButton
        mode={outlined ? 'outlined' : 'contained-tonal'}
        tone={outlined ? 'neutral' : undefined}
        icon="content-copy"
        accessibilityLabel={`复制${label}`}
        disabled={copying || !value.trim()}
        loading={copying}
        contentStyle={compactHeight ? undefined : { minHeight: 48 }}
        onPress={() => {
          void handleCopy();
        }}
      >
        {copying ? '复制中' : `复制${label}`}
      </ActionButton>
      {message ? (
        <Text
          accessibilityLiveRegion="polite"
          style={{ color: failed ? colors.danger : colors.muted }}
        >
          {message}
        </Text>
      ) : null}
    </View>
  );
}
