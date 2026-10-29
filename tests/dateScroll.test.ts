import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { dateKey } from '../src/domain/engine';

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
const screen = source.statements.find(
  (node): node is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(node) && node.name?.text === 'TodayScreen',
);
assert.ok(screen?.body);
const change = screen.body.statements.find(
  (node): node is ts.FunctionDeclaration =>
    ts.isFunctionDeclaration(node) && node.name?.text === 'changePickedDate',
);
const effect = screen.body.statements.find(
  (node): node is ts.ExpressionStatement =>
    ts.isExpressionStatement(node) &&
    ts.isCallExpression(node.expression) &&
    node.expression.expression.getText(source) === 'useEffect' &&
    node.expression.arguments[1]?.getText(source) === '[selectedDate]',
);
assert.ok(change && effect && ts.isCallExpression(effect.expression));
let onScroll: ts.ArrowFunction | undefined;
function visit(node: ts.Node) {
  if (
    ts.isJsxAttribute(node) &&
    node.name.getText(source) === 'onScroll' &&
    node.initializer &&
    ts.isJsxExpression(node.initializer) &&
    node.initializer.expression &&
    ts.isArrowFunction(node.initializer.expression)
  ) {
    onScroll = node.initializer.expression;
  }
  ts.forEachChild(node, visit);
}
visit(screen);
assert.ok(onScroll);
const factorySource = ts.transpileModule(
  `return { change: ${change.getText(source)}, effect: ${effect.expression.arguments[0].getText(source)}, onScroll: ${onScroll.getText(source)} };`,
  { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
).outputText;
const makeCallbacks = new Function(
  'selectedDate',
  'now',
  'restoreScrollRef',
  'scrollOffsetRef',
  'webListScroller',
  'Platform',
  'setPickedDate',
  'dateKey',
  'applyListScroll',
  'setTimeout',
  'clearTimeout',
  factorySource,
);

// 执行真实日期回调、日期effect与FlatList滚动回调；不挂载React或原生列表。
function harness(initial: string | null = null) {
  const now = new Date(2026, 9, 29, 12);
  let pickedDate = initial;
  let pendingPickedDate = initial;
  let renderedDate = pickedDate ?? dateKey(now);
  let offset = 0;
  let timerId = 0;
  let clock = 0;
  const timers = new Map<number, { at: number; callback: () => void }>();
  const restoreScrollRef = { current: null as number | null };
  const scrollOffsetRef = { current: 0 };
  const applied: number[] = [];
  let cleanup: (() => void) | undefined;
  const render = () =>
    makeCallbacks(
      renderedDate,
      now,
      restoreScrollRef,
      scrollOffsetRef,
      () => null,
      { OS: 'android' },
      (next: string | null) => {
        pendingPickedDate = next;
      },
      dateKey,
      (next: number) => {
        offset = next;
        applied.push(next);
      },
      (callback: () => void, delay: number) => {
        const id = ++timerId;
        timers.set(id, { at: clock + delay, callback });
        return id;
      },
      (id: number) => timers.delete(id),
    ) as {
      change(next: string | null): void;
      effect(): (() => void) | undefined;
      onScroll(event: { nativeEvent: { contentOffset: { y: number } } }): void;
    };
  let callbacks = render();
  cleanup = callbacks.effect();
  const commit = () => {
    pickedDate = pendingPickedDate;
    const nextDate = pickedDate ?? dateKey(now);
    const changed = !Object.is(renderedDate, nextDate);
    if (changed) cleanup?.();
    renderedDate = nextDate;
    callbacks = render();
    if (changed) cleanup = callbacks.effect();
  };
  return {
    change(next: string | null) {
      callbacks.change(next);
    },
    commit,
    scroll(next: number) {
      offset = next;
      callbacks.onScroll({ nativeEvent: { contentOffset: { y: next } } });
      return offset;
    },
    advance(duration: number) {
      const until = clock + duration;
      while (true) {
        const next = [...timers.entries()]
          .filter(([, timer]) => timer.at <= until)
          .sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        clock = next[1].at;
        timers.delete(next[0]);
        next[1].callback();
      }
      clock = until;
    },
    get pending() {
      return restoreScrollRef.current;
    },
    get pickedDate() {
      return pickedDate;
    },
    get offset() {
      return offset;
    },
    applied,
  };
}

test('重复点选历史同一天不遗留滚动恢复锁', () => {
  const screen = harness('2026-10-22');
  assert.equal(screen.scroll(240), 240);
  screen.change('2026-10-22');
  screen.commit();
  screen.advance(600);
  assert.equal(screen.pending, null);
  assert.equal(screen.scroll(820), 820);
});

test('今天字符串与跟随今天null互换不锁滚动，并保留跟随语义', () => {
  const screen = harness();
  screen.scroll(180);
  screen.change('2026-10-29');
  screen.commit();
  assert.equal(screen.pickedDate, '2026-10-29');
  assert.equal(screen.pending, null);
  assert.equal(screen.scroll(420), 420);
  screen.change(null);
  screen.commit();
  assert.equal(screen.pickedDate, null);
  assert.equal(screen.pending, null);
  screen.change(null);
  screen.commit();
  assert.equal(screen.scroll(640), 640);
});

test('跨日期保留原位置，恢复窗口结束后可自由滚动', () => {
  const screen = harness('2026-10-22');
  screen.scroll(260);
  screen.change('2026-10-23');
  screen.commit();
  assert.equal(screen.pending, 260);
  assert.equal(screen.scroll(0), 260);
  screen.advance(480);
  assert.equal(screen.pending, null);
  assert.equal(screen.scroll(700), 700);
});

test('快速切日期清理旧计时器，不提前释放新恢复或继续回拉', () => {
  const screen = harness('2026-10-22');
  screen.scroll(310);
  screen.change('2026-10-23');
  screen.commit();
  screen.advance(160);
  screen.change('2026-10-24');
  screen.commit();
  screen.advance(320);
  assert.equal(screen.pending, 310);
  screen.advance(160);
  assert.equal(screen.pending, null);
  assert.equal(screen.scroll(910), 910);
  screen.advance(1000);
  assert.equal(screen.offset, 910);
});

test('同一渲染批次切走又切回不遗留无effect可释放的恢复锁', () => {
  const screen = harness('2026-10-22');
  screen.scroll(210);
  screen.change('2026-10-23');
  screen.change('2026-10-22');
  screen.commit();
  screen.advance(600);
  assert.equal(screen.pending, null);
  assert.equal(screen.scroll(760), 760);
});

test('恢复窗口内重选同日后自由滚动，旧计时器不能再回拉', () => {
  const screen = harness('2026-10-22');
  screen.scroll(280);
  screen.change('2026-10-23');
  screen.commit();
  screen.advance(160);
  screen.change('2026-10-23');
  screen.commit();
  assert.equal(screen.pending, null);
  assert.equal(screen.scroll(800), 800);
  screen.advance(1000);
  assert.equal(screen.offset, 800);
});
