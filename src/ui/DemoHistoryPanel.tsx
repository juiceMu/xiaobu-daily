import React, { useState } from 'react';
import { Text } from 'react-native-paper';
import { useApp } from '../state/AppProvider';
import { ActionButton, Panel } from './components';
import { useScreenStyles, Confirm, ErrorText } from '../screens/shared';

export function DemoHistoryPanel() {
  const { busy, run } = useApp();
  const styles = useScreenStyles();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  async function populate() {
    if (busy || loading) return;
    setLoading(true);
    setError('');
    try {
      const { seedDemoHistory } = await import('../domain/demoData');
      const result = await run((draft) => seedDemoHistory(draft, new Date()));
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
        追加最近四周的演示记录，涵盖打卡、成长、奖券、里程碑、归档和赠券往来。没有小组时会创建演示小组和两位成员，到今日或奖券打开「看全组」即可查看。保留已有数据与账户。
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
        description="演示内容带有‘演示’标识。只追加一份，不会清空原记录。没有小组时会加入演示小组和两位成员。"
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
