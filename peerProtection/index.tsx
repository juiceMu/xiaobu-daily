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
import { registerAcceptanceDemoPreview } from '../src/ui/demoPreviewAccess';
import { hasDemoHistory } from '../src/domain/demoData';
import { peerBoards } from '../src/domain/groupSync';
import {
  createProtectionBaseline,
  prepareProtectionPeer,
  PROTECTION_PEER_ID,
} from './preparePeer';

registerAcceptanceDemoPreview();

function ProtectionControls() {
  const { state, run, busy } = useApp();
  const ready = useAndroidMountReady(600);
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState('');
  const [baseline] = useState(createProtectionBaseline);
  const [captured, setCaptured] = useState(false);
  if (!ready) return null;
  const close = () => {
    setConfirm(false);
    setOpen(false);
  };
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
  const imported = peerBoards(state).find(
    (peer) => peer.accountId === PROTECTION_PEER_ID,
  );
  const comparison = captured ? baseline.compare(state) : null;
  return open ? (
    <Modal visible animationType="none" onRequestClose={close}>
      <View
        accessibilityViewIsModal
        aria-modal
        collapsable={false}
        style={{
          position: 'absolute',
          top: StatusBar.currentHeight ?? 0,
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: '#FFFFFF',
        }}
      >
        <ScrollView
          removeClippedSubviews={false}
          contentContainerStyle={{ padding: 20, gap: 16 }}
        >
          <Text
            accessibilityRole="header"
            style={{ color: '#172435', fontSize: 22 }}
          >
            已有副本保护验收
          </Text>
          <Text style={{ color: '#172435', fontSize: 16 }}>
            本专用包覆盖既有夹具存档；不清空、不离组、不导入外部存档。局域网收发禁用，离线合法日志追加不是WiFi同步。没有自动数据生成。先通过原资料页设置本机昵称/头像、原目标页建立非空目标，保留已有业务；准备后从原「更多→设置→添加演示历史」确认。基线逐项比较原业务实体、资料与成员副本，允许新增个人演示及赠收记录；不代表零保存或零outbox。每进程只记录一次，演示后拒绝重捕，重启失效。
          </Text>
          <Text style={{ color: '#172435', fontSize: 16 }}>
            本机任务 {state.tasks.length} / 打卡 {state.checkins.length} / 券{' '}
            {state.tickets.length} / 目标 {state.milestoneGoals.length}
            ；成员副本 {state.groupPeers?.length ?? 0}；新成员打卡{' '}
            {imported?.app.checkins.length ?? 0} / 券{' '}
            {imported?.app.tickets.length ?? 0}；个人演示{' '}
            {hasDemoHistory(state) ? '已存在' : '未存在'}；同步序号{' '}
            {state.sync?.sequence ?? 0} / 待发操作{' '}
            {state.sync?.outbox.length ?? 0}
          </Text>
          {button('记录当前基线（仅本进程）', () => {
            const ok = baseline.capture(state);
            if (ok) setCaptured(true);
            setMessage(
              ok
                ? '已记录脱敏比较基线；不写入存档，重启失效'
                : '需先完成11成员含券准备且无个人演示，或本进程已记录；未覆盖原基线',
            );
          })}
          <Text style={{ color: '#172435', fontSize: 16 }}>
            {comparison
              ? '基线比较：原成员副本 ' +
                (comparison.peers ? '保留' : '不一致/前置不足') +
                '；原本机实体 ' +
                (comparison.local ? '保留' : '不一致') +
                '；组身份 ' +
                (comparison.group ? '保留' : '不一致')
              : '尚未记录基线；重启后需重新记录，不能恢复前次比较。'}
          </Text>
          {confirm ? (
            <>
              <Text style={{ color: '#172435', fontSize: 16 }}>
                确认只追加1名离线测试成员：自定义资料和任务、3次打卡、1张永久可用券？已有10名副本及本机业务不替换。重复或不满足专用夹具前置会拒绝。
              </Text>
              {button('确认追加1名合法测试成员', () => {
                void run((draft) => prepareProtectionPeer(draft)).then(
                  (result) => {
                    setMessage(result.message);
                    setConfirm(false);
                  },
                );
              })}
              {button('取消追加', () => setConfirm(false))}
            </>
          ) : (
            button('准备已有券成员…', () => setConfirm(true))
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
      accessibilityLabel="打开副本保护验收"
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
      <Text style={{ color: '#172435', fontSize: 16 }}>副本验收</Text>
    </Pressable>
  );
}

function PeerProtectionApp() {
  return (
    <App lanEnabled={false}>
      <ProtectionControls />
    </App>
  );
}

registerRootComponent(PeerProtectionApp);
