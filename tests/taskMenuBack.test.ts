import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

// 执行 TodayScreen 真实聚焦回调与提交后的 ref 更新；原生事件分发使用替身。
const source = ts.createSourceFile(
  'TodayScreen.tsx',
  readFileSync(
    new URL('../src/screens/TodayScreen.tsx', import.meta.url),
    'utf8',
  ),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
let focusCallback: ts.Node | undefined;
let commitCallback: ts.Node | undefined;
function visit(node: ts.Node) {
  if (ts.isCallExpression(node)) {
    if (
      node.expression.getText(source) === 'useFocusEffect' &&
      node.getText(source).includes('BackHandler.addEventListener')
    ) {
      const memo = node.arguments[0];
      assert.ok(ts.isCallExpression(memo));
      focusCallback = memo.arguments[0];
    }
    if (
      node.expression.getText(source) === 'useLayoutEffect' &&
      node.getText(source).includes('menuIdRef.current = menuId')
    ) {
      commitCallback = node.arguments[0];
    }
  }
  ts.forEachChild(node, visit);
}
visit(source);
assert.ok(focusCallback && commitCallback);
const makeCallbacks = new Function(
  'Platform',
  'BackHandler',
  'menuIdRef',
  'setMenuId',
  'menuId',
  ts.transpileModule(
    `return { focus: ${focusCallback.getText(source)}, commit: ${commitCallback.getText(source)} };`,
    { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
  ).outputText,
);

function harness(platform = 'android') {
  const listeners: (() => boolean | undefined)[] = [];
  const menuIdRef = { current: null as string | null };
  let menuId: string | null = null;
  let defaultBacks = 0;
  const callbacks = () =>
    makeCallbacks(
      { OS: platform },
      {
        addEventListener(event: string, callback: () => boolean | undefined) {
          assert.equal(event, 'hardwareBackPress');
          listeners.push(callback);
          return {
            remove() {
              const index = listeners.indexOf(callback);
              if (index !== -1) listeners.splice(index, 1);
            },
          };
        },
      },
      menuIdRef,
      (next: string | null) => {
        menuId = next;
      },
      menuId,
    );
  return {
    focus: () => callbacks().focus() as (() => void) | undefined,
    commit(next = menuId) {
      menuId = next;
      callbacks().commit();
    },
    paperListener() {
      // 本地 Paper 5.15.3 的 handleDismiss 先关闭菜单但不返回 true。
      listeners.push(() => {
        menuId = null;
      });
    },
    back() {
      const consumed = [...listeners]
        .reverse()
        .some((listener) => listener() === true);
      if (!consumed) defaultBacks += 1;
      return consumed;
    },
    get menuId() {
      return menuId;
    },
    get defaultBacks() {
      return defaultBacks;
    },
    get listenerCount() {
      return listeners.length;
    },
  };
}

test('今日页菜单开启时消费返回并关闭，关闭后普通返回继续', () => {
  const h = harness();
  const blur = h.focus();
  h.commit('task-a');
  assert.equal(h.back(), true);
  assert.equal(h.menuId, null);
  assert.equal(h.defaultBacks, 0);
  h.commit();
  assert.equal(h.back(), false);
  assert.equal(h.defaultBacks, 1);
  blur?.();
});

test('同一聚焦监听读取后续打开和切换的最新菜单，Paper先关闭仍消费同次返回', () => {
  const h = harness();
  h.focus();
  assert.equal(h.back(), false);
  h.commit('task-a');
  h.commit('task-b');
  h.paperListener();
  assert.equal(h.back(), true);
  assert.equal(h.menuId, null);
  assert.equal(h.defaultBacks, 1);
  h.commit();
  assert.equal(h.back(), false);
  assert.equal(h.defaultBacks, 2);
});

test('失焦清理后不拦截返回，再聚焦恢复且清理不会残留重复监听', () => {
  const h = harness();
  h.commit('task-a');
  const blur = h.focus();
  assert.equal(h.listenerCount, 1);
  blur?.();
  assert.equal(h.listenerCount, 0);
  assert.equal(h.back(), false);
  assert.equal(h.menuId, 'task-a');
  const unmount = h.focus();
  assert.equal(h.back(), true);
  unmount?.();
  assert.equal(h.listenerCount, 0);
});

for (const platform of ['web', 'ios']) {
  test(`${platform}不注册Android返回监听，不改变菜单关闭路径`, () => {
    const h = harness(platform);
    h.commit('task-a');
    assert.equal(h.focus(), undefined);
    assert.equal(h.listenerCount, 0);
    assert.equal(h.back(), false);
    assert.equal(h.menuId, 'task-a');
  });
}
