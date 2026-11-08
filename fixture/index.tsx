import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  Text,
  View,
} from 'react-native';
import { registerRootComponent } from 'expo';
import App from '../App';
import { useApp } from '../src/state/AppProvider';
import { useAndroidMountReady } from '../src/ui/useAndroidMountReady';
import { appendRankingFixture, prepareFixtureGroup } from './rankingFixture';

function FixtureControls() {
  const { busy, run } = useApp();
  const ready = useAndroidMountReady(600);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState('');
  function close() {
    setConfirm(false);
    setOpen(false);
  }
  if (!ready) return null;
  async function apply(append: boolean) {
    const result = await run(
      append ? (draft) => appendRankingFixture(draft) : prepareFixtureGroup,
    );
    setMessage(result.message);
    setConfirm(false);
  }
  const button = (label: string, onPress: () => void) => (
    <Pressable
      accessibilityRole="button"
      disabled={busy}
      onPress={onPress}
      style={{
        minHeight: 48,
        padding: 12,
        backgroundColor: '#DDE7F5',
        borderRadius: 8,
      }}
    >
      <Text style={{ color: '#172435', fontSize: 16 }}>{label}</Text>
    </Pressable>
  );
  return open ? (
    <Modal visible animationType="none" onRequestClose={close}>
      <View
        style={{
          position: 'absolute',
          top: StatusBar.currentHeight ?? 0,
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: '#FFFFFF',
        }}
        collapsable={false}
        accessibilityViewIsModal
        aria-modal
      >
        <ScrollView
          removeClippedSubviews={false}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ padding: 20, gap: 16 }}
        >
          <Text
            accessibilityRole="header"
            style={{ color: '#172435', fontSize: 22 }}
          >
            独立排行夹具
          </Text>
          <Text style={{ color: '#172435', fontSize: 16 }}>
            本包局域网收发已禁用，不改变设备网络设置。没有导入、清空或恢复功能。
            先准备空小组，返回今日查看有组无副本；再确认追加一次排行。已有业务或非专用组会拒绝。
            追加后到今日小组动态检查10/11名、单条记录、同任务ID及删除任务记录；系统大字号仍需设备设置和截图。
            跨年补卡请通过原日历选择上一年12月31日和本年1月1日，不修改系统时间。
          </Text>
          {button('准备夹具小组（无成员副本）', () => {
            void apply(false);
          })}
          {confirm ? (
            <>
              <Text style={{ color: '#172435', fontSize: 16 }}>
                确认向此空夹具组保存11位成员及本周66条记录（65条今天、1条本周一）？周一不允许添加，不会清除任何记录。
              </Text>
              {button('确认追加一次排行夹具', () => {
                void apply(true);
              })}
              {button('取消追加', () => setConfirm(false))}
            </>
          ) : (
            button('追加排行夹具…', () => setConfirm(true))
          )}
          <Text
            accessibilityLiveRegion="polite"
            style={{ color: '#172435', fontSize: 16 }}
          >
            {message}
          </Text>
          {button('返回应用', close)}
        </ScrollView>
      </View>
    </Modal>
  ) : (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="打开排行夹具控制"
      onPress={() => setOpen(true)}
      style={{
        position: 'absolute',
        top: (StatusBar.currentHeight ?? 0) + 8,
        right: 8,
        minHeight: 48,
        minWidth: 48,
        padding: 10,
        backgroundColor: '#DDE7F5',
        borderRadius: 12,
      }}
    >
      <Text style={{ color: '#172435', fontSize: 16 }}>夹具</Text>
    </Pressable>
  );
}

function FixtureApp() {
  return (
    <App lanEnabled={false}>
      <FixtureControls />
    </App>
  );
}

registerRootComponent(FixtureApp);
