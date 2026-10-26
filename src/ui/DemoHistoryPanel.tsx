import React, { useState } from 'react';
import { Text } from 'react-native-paper';
import { useApp } from '../state/AppProvider';
import { ActionButton, Panel } from './components';
import { useScreenStyles, Confirm, ErrorText } from '../screens/shared';

export function DemoHistoryPanel() {
  const { busy, previewDemoHistory } = useApp();
  const styles = useScreenStyles();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  async function populate() {
    if (busy || loading) return;
    setLoading(true);
    setError('');
    try {
      const result = await previewDemoHistory();
      if (result.ok) setOpen(false);
      else setError(result.message);
    } catch {
      setError('演示历史未添加，请重试。原数据已保留。');
    } finally {
      setLoading(false);
    }
  }
  return (
    <Panel style={styles.card}>
      <Text style={styles.heading}>功能效果预览</Text>
      <Text style={styles.muted}>
        追加最近四周的演示记录，涵盖打卡、成长、奖券、里程碑、归档和赠券往来。演示小组内另补可用、已使用、已过期同行券及伙伴用途；已有演示也可补齐。没有小组时创建演示小组，不向真实小组添加虚构伙伴。保留已有数据与账户。
      </Text>
      <ActionButton
        disabled={busy || loading}
        onPress={() => {
          setError('');
          setOpen(true);
        }}
      >
        添加演示历史
      </ActionButton>
      <Confirm
        visible={open}
        title="添加演示历史？"
        description="演示记录会保存到当前存档并参与统计，重复添加不重复造券，不清空原记录。没有小组时创建演示小组；真实小组不加入虚构同行伙伴。同行演示分步保存，中途失败可再次添加继续。"
        busy={busy || loading}
        error={error}
        onDismiss={() => {
          if (!busy && !loading) setOpen(false);
        }}
        onConfirm={() => {
          void populate();
        }}
      />
      <ErrorText message={!open ? error : ''} />
    </Panel>
  );
}
