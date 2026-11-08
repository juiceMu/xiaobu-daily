import test from 'node:test';
import assert from 'node:assert/strict';
import type { BackHandlerStatic, HardwareBackPressEvent } from 'react-native';
import { listenForControlBack } from '../acceptance/controlBack';

test('验收浮层仅打开时消费返回，关闭或卸载清理后原应用继续处理', () => {
  const listeners: ((
    event: HardwareBackPressEvent,
  ) => boolean | null | undefined)[] = [];
  const handler: Pick<BackHandlerStatic, 'addEventListener'> = {
    addEventListener(event, callback) {
      assert.equal(event, 'hardwareBackPress');
      listeners.push(callback);
      return {
        remove() {
          const index = listeners.indexOf(callback);
          if (index >= 0) listeners.splice(index, 1);
        },
      };
    },
  };
  let appBacks = 0;
  let closes = 0;
  const pressBack = () => {
    const event = { type: 'hardwareBackPress', timeStamp: 0 };
    for (const listener of [...listeners].reverse()) {
      if (listener(event)) return;
    }
    appBacks += 1;
  };
  assert.equal(
    listenForControlBack(false, handler, () => closes++),
    undefined,
  );
  assert.equal(listeners.length, 0);
  pressBack();
  assert.equal(appBacks, 1);

  const cleanup = listenForControlBack(true, handler, () => closes++);
  assert.equal(listeners.length, 1);
  pressBack();
  assert.equal(closes, 1);
  assert.equal(appBacks, 1);
  cleanup?.();
  assert.equal(listeners.length, 0);
  pressBack();
  assert.equal(appBacks, 2);
  assert.equal(closes, 1);

  const nextCleanup = listenForControlBack(true, handler, () => closes++);
  nextCleanup?.();
  nextCleanup?.();
  assert.equal(listeners.length, 0);
});
