import React, { useState, useSyncExternalStore } from 'react';
import {
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import App from '../App';
import { groupViewRepository } from '../src/state/groupViewStorage';
import { useAndroidMountReady } from '../src/ui/useAndroidMountReady';
import { installGroupViewFailure } from './groupViewFailure';
import { installBusinessSaveControl } from './businessSaveControl';
import { nativeRepository } from '../src/state/nativeRepository';
import { registerAcceptanceDemoPreview } from '../src/ui/demoPreviewAccess';
import { createDemoDateControl } from './demoDateControl';
import type { SaveObservation } from './saveObservation';
import type { ThemePreferenceControl } from './themePreferenceControl';

// 静态 App import 可先完成，但许可必须在首次渲染前注册。
registerAcceptanceDemoPreview();
const failure = installGroupViewFailure(groupViewRepository);
const businessSave = installBusinessSaveControl(nativeRepository);
const demoDate = createDemoDateControl();

function ControlButton({
  title,
  onPress,
  disabled = false,
}: {
  title: string;
  onPress(): void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Text style={styles.buttonText}>{title}</Text>
    </Pressable>
  );
}

function ObservationControls({
  observation,
}: {
  observation: SaveObservation;
}) {
  const snapshot = useSyncExternalStore(
    observation.subscribe,
    observation.getSnapshot,
    observation.getSnapshot,
  );
  return (
    <>
      <Text style={styles.body}>
        业务仓储调用观察：{snapshot.observing ? '观察中' : '已停止'}；调用
        {snapshot.calls} 次，成功 {snapshot.succeeded} 次，失败{' '}
        {snapshot.failed} 次，进行中
        {snapshot.inFlight}{' '}
        次。仅统计本进程仓储接口调用，不显示业务数据；不能证明其他路径未写入。
      </Text>
      <ControlButton
        title={snapshot.observing ? '结束保存观察' : '开始保存观察'}
        disabled={snapshot.inFlight > 0}
        onPress={() => {
          if (snapshot.observing) observation.stop();
          else observation.start();
        }}
      />
    </>
  );
}

function ThemePreferenceControls({
  control,
  coldStartMessage,
}: {
  control: ThemePreferenceControl;
  coldStartMessage?: string;
}) {
  const snapshot = useSyncExternalStore(
    control.subscribe,
    control.getSnapshot,
    control.getSnapshot,
  );
  const busy = snapshot.inFlight > 0 || snapshot.status === 'armed';
  return (
    <>
      <Text style={styles.body}>
        主题偏好控制（仅本进程）：返回原设置页选择其他主题。失败在真实保存前抛错；延迟将等待在本面板显式释放，释放或取消等待后仍调用真实保存。不是SQLite故障，不显示主题值或业务内容。
      </Text>
      <Text accessibilityLiveRegion="polite" style={styles.body}>
        主题控制：{snapshot.mode ?? '无'}；状态：{snapshot.status}；命中
        {snapshot.hits}次；读取接口{snapshot.loadCalls}次；保存接口
        {snapshot.saveCalls}次；进行中{snapshot.inFlight}次。
      </Text>
      <ControlButton
        title="下一次主题保存前失败"
        disabled={busy}
        onPress={() => {
          control.arm('save-fail');
        }}
      />
      <ControlButton
        title="下一次主题保存等待手动释放"
        disabled={busy}
        onPress={() => {
          control.arm('save-delay');
        }}
      />
      <ControlButton
        title="释放等待并执行真实主题保存"
        disabled={!snapshot.waitingForRelease}
        onPress={() => {
          control.release();
        }}
      />
      <ControlButton
        title={
          snapshot.waitingForRelease
            ? '取消等待并执行真实主题保存'
            : '取消待命主题控制'
        }
        disabled={snapshot.status !== 'armed' && !snapshot.waitingForRelease}
        onPress={() => {
          control.cancel();
        }}
      />
      <Text style={styles.body}>
        读取失败只允许通过场景包专用冷启动参数在首次挂载前待命；运行中不注入、不重载应用。受控读取前失败不是真实SQLite故障，实际结果须另记真机证据。
      </Text>
      {coldStartMessage ? (
        <Text style={styles.body}>{coldStartMessage}</Text>
      ) : null}
    </>
  );
}

export default function AcceptanceApp({
  lanEnabled,
  demoControls = false,
  observation,
  themePreferenceControl,
  themeColdStartMessage,
}: {
  lanEnabled?: boolean;
  demoControls?: boolean;
  observation?: SaveObservation;
  themePreferenceControl?: ThemePreferenceControl;
  themeColdStartMessage?: string;
}) {
  const ready = useAndroidMountReady(600);
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(true);
  const [left, setLeft] = useState(false);
  const themeControlSnapshot = useSyncExternalStore(
    (listener) => themePreferenceControl?.subscribe(listener) ?? (() => {}),
    () => themePreferenceControl?.getSnapshot() ?? null,
    () => themePreferenceControl?.getSnapshot() ?? null,
  );
  const themeControlBusy =
    themeControlSnapshot?.status === 'armed' ||
    themeControlSnapshot?.status === 'processing' ||
    (themeControlSnapshot?.inFlight ?? 0) > 0;
  const armed = useSyncExternalStore(
    failure.subscribe,
    failure.getSnapshot,
    failure.getSnapshot,
  );
  const business = useSyncExternalStore(
    businessSave.subscribe,
    businessSave.getSnapshot,
    businessSave.getSnapshot,
  );
  const previousWeek = useSyncExternalStore(
    demoDate.subscribe,
    demoDate.getSnapshot,
    demoDate.getSnapshot,
  );
  const businessBusy =
    business.status === 'armed' || business.status === 'processing';
  return (
    <View style={styles.root} collapsable={false}>
      <View
        style={styles.root}
        accessibilityElementsHidden={open}
        importantForAccessibility={open ? 'no-hide-descendants' : 'auto'}
      >
        <App
          lanEnabled={lanEnabled}
          demoHistoryLoader={demoControls ? demoDate.load : undefined}
        />
      </View>
      {ready && visible && !open ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="打开验收控制"
          onPress={() => {
            Keyboard.dismiss();
            setOpen(true);
          }}
          style={({ pressed }) => [
            styles.launcher,
            left ? { left: 8 } : { right: 8 },
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.buttonText}>验收</Text>
        </Pressable>
      ) : null}
      {ready && open ? (
        <Modal
          visible
          animationType="none"
          onRequestClose={() => setOpen(false)}
        >
          <View
            style={styles.overlay}
            collapsable={false}
            accessibilityViewIsModal
            aria-modal
          >
            <ScrollView
              contentContainerStyle={styles.content}
              removeClippedSubviews={false}
              showsVerticalScrollIndicator={false}
              showsHorizontalScrollIndicator={false}
            >
              <Text accessibilityRole="header" style={styles.heading}>
                独立验收控制
              </Text>
              <Text style={styles.body}>
                仅用于小步验收包。不会自动导入、重置或清除存档。原应用保持挂载。
              </Text>
              {observation ? (
                <ObservationControls observation={observation} />
              ) : null}
              {themePreferenceControl ? (
                <ThemePreferenceControls
                  control={themePreferenceControl}
                  coldStartMessage={themeColdStartMessage}
                />
              ) : null}
              {demoControls ? (
                <>
                  <Text style={styles.body}>
                    上周演示仅允许无组的初始空存档；一次性生效，取消或进程重启清除，不修改系统时间。状态：
                    {previousWeek ? '待命' : '未开启'}。
                  </Text>
                  <ControlButton
                    title={
                      previousWeek
                        ? '取消上周首次导入'
                        : '下一次首次导入使用上周'
                    }
                    onPress={previousWeek ? demoDate.cancel : demoDate.arm}
                  />
                </>
              ) : null}
              <Text style={styles.body}>
                演示数据：返回应用，在「更多 → 设置 →
                添加演示历史」显式确认，使用原有预览入口。新安装可先测试未入组空态。
              </Text>
              <Text style={styles.body}>
                成员入口失败：先在奖券页切到「只看自己」，再开启下方控制。返回今日小组动态点击成员。预期保存失败且不进入详情；再次点击可成功。
              </Text>
              <Text accessibilityLiveRegion="polite" style={styles.body}>
                {armed
                  ? '已开启：下一次看全组偏好保存将失败一次。'
                  : '受控失败未开启。'}
                {'\n'}
                仅当前进程有效，取消或重启即失效。这是仓储方法受控抛错，不是真实
                SQLite 写入故障；该开关不影响业务存储。
              </Text>
              <ControlButton
                title={armed ? '取消受控失败' : '开启下一次看全组保存失败'}
                onPress={armed ? failure.cancel : failure.arm}
              />
              <Text style={styles.body}>
                以下控制作用于下一次业务保存，可能来自兑换、演示或其他业务操作。请选择后返回应用，从原入口确认；取消或重启清除未命中控制。处理中不可重新设置；延迟8秒后调用真实保存，失败模式在调用前抛错，不是真实SQLite故障。
              </Text>
              <Text accessibilityLiveRegion="polite" style={styles.body}>
                业务保存控制：
                {business.mode === 'delay'
                  ? '延迟8秒'
                  : business.mode === 'fail'
                    ? '保存前失败'
                    : '无'}
                ；状态：
                {
                  {
                    idle: '未开启',
                    armed: '等待下一次保存',
                    processing: '处理中',
                    completed: '已完成',
                    failed: '失败',
                  }[business.status]
                }
                ；命中 {business.hits} 次。
                {business.status === 'armed'
                  ? ` 距目标保存还有 ${business.remaining} 次。`
                  : ''}
              </Text>
              <ControlButton
                title="下一次业务保存延迟8秒"
                disabled={businessBusy}
                onPress={() => {
                  businessSave.arm('delay');
                }}
              />
              <ControlButton
                title="下一次业务保存前失败"
                disabled={businessBusy}
                onPress={() => {
                  businessSave.arm('fail');
                }}
              />
              {demoControls ? (
                <ControlButton
                  title="第3次业务保存前失败"
                  disabled={businessBusy}
                  onPress={() => {
                    businessSave.arm('fail', 3);
                  }}
                />
              ) : null}
              {demoControls ? (
                <ControlButton
                  title="第4次业务保存前失败"
                  disabled={businessBusy}
                  onPress={() => {
                    businessSave.arm('fail', 4);
                  }}
                />
              ) : null}
              <ControlButton
                title="取消待命业务保存控制"
                disabled={business.status !== 'armed'}
                onPress={() => {
                  businessSave.cancel();
                }}
              />
              <ControlButton title="返回应用" onPress={() => setOpen(false)} />
              <ControlButton
                title={left ? '控制按钮移到右侧' : '控制按钮移到左侧'}
                onPress={() => setLeft((value) => !value)}
              />
              <ControlButton
                title="隐藏控制按钮（重启恢复）"
                disabled={themeControlBusy}
                onPress={() => {
                  // 不能隐藏等待保存的唯一释放入口；再次读取以覆盖旧渲染回调。
                  const current = themePreferenceControl?.getSnapshot();
                  if (
                    current?.status === 'armed' ||
                    current?.status === 'processing' ||
                    (current?.inFlight ?? 0) > 0
                  )
                    return;
                  setVisible(false);
                  setOpen(false);
                }}
              />
            </ScrollView>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  launcher: {
    position: 'absolute',
    top: (StatusBar.currentHeight ?? 0) + 8,
    minHeight: 48,
    minWidth: 48,
    padding: 10,
    borderRadius: 12,
    backgroundColor: '#DDE7F5',
    justifyContent: 'center',
  },
  overlay: {
    position: 'absolute',
    top: StatusBar.currentHeight ?? 0,
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
  },
  content: { padding: 20, paddingBottom: 48, gap: 16 },
  heading: { color: '#172435', fontSize: 22, fontWeight: '700' },
  body: { color: '#172435', fontSize: 16, lineHeight: 25 },
  button: {
    minHeight: 48,
    padding: 12,
    backgroundColor: '#DDE7F5',
    borderRadius: 8,
    justifyContent: 'center',
  },
  buttonText: { color: '#172435', fontSize: 16, textAlign: 'center' },
  pressed: { opacity: 0.65 },
});
