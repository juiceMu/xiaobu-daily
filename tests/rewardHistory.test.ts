import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  groupUsedTickets,
  usedTicketRows,
  unlockedRewards,
} from '../src/ui/rewardHistory';
import {
  createInitialState,
  addMilestoneGoal,
  recordMilestoneValue,
} from '../src/domain/engine';
import type { Ticket } from '../src/domain/types';
import ts from 'typescript';

function ticket(
  id: string,
  usedAt: string | null,
  source?: 'checkin' | 'weight',
): Ticket {
  return {
    id,
    usedAt,
    source,
    name: id,
    createdAt: '2025-01-01T00:00:00Z',
    week: '2024-12-30',
    expiresAt: null,
    usageNote: '保留用途备注',
  };
}
test('使用日期本地周分组覆盖跨月跨年，周和券均按使用时间倒序且不修改原数组', () => {
  const local = (year: number, month: number, day: number, hour = 12) =>
    new Date(year, month - 1, day, hour).toISOString();
  const old = ticket('old', local(2025, 12, 28), 'checkin');
  const monday = ticket('monday', local(2025, 12, 29), 'weight');
  const sunday = ticket('sunday', local(2026, 1, 4), 'checkin');
  const latest = ticket('latest', local(2026, 1, 5), 'weight');
  const input = [old, latest, monday, sunday, ticket('unused', null)];
  const before = JSON.stringify(input);
  const groups = groupUsedTickets(input);
  assert.deepEqual(
    groups.map((group) => group.key),
    ['2026-01-05', '2025-12-29', '2025-12-22'],
  );
  assert.equal(groups[1].title, '2025-12-29 — 2026-01-04');
  assert.deepEqual(
    groups[1].tickets.map((item) => item.id),
    ['sunday', 'monday'],
  );
  assert.equal(groups[1].tickets[0].usageNote, '保留用途备注');
  assert.equal(JSON.stringify(input), before);
});
test('使用日期采用本地时区午夜周边界，而不是ISO UTC日期或获得时间', () => {
  const justBefore = new Date(2026, 9, 18, 23, 59, 59).toISOString();
  const justAfter = new Date(2026, 9, 19, 0, 0, 0).toISOString();
  const groups = groupUsedTickets([
    ticket('before', justBefore),
    ticket('after', justAfter),
  ]);
  assert.deepEqual(
    groups.map((group) => group.key),
    ['2026-10-19', '2026-10-12'],
  );
  assert.deepEqual(
    groups.map((group) => group.tickets[0].id),
    ['after', 'before'],
  );
  const rows = usedTicketRows([
    ticket('before', justBefore),
    ticket('after', justAfter),
  ]);
  assert.deepEqual(
    rows.map((row) => row.type),
    ['week', 'ticket', 'week', 'ticket'],
  );
  assert.equal(rows[0].type === 'week' && rows[0].count, 1);
});
test('里程碑奖励只取已解锁刻度，回涨和重复记录不生成虚假的奖励行', () => {
  const state = createInitialState();
  const result = addMilestoneGoal(state, {
    name: '体重',
    unit: '斤',
    direction: 'decrease',
    startWeight: 138.4,
    step: 1,
  });
  assert.ok(result.goal);
  const goal = result.goal;
  recordMilestoneValue(state, goal.id, 136.4);
  recordMilestoneValue(state, goal.id, 140);
  recordMilestoneValue(state, goal.id, 136.4);
  assert.equal(goal.entries.length, 3);
  assert.deepEqual(unlockedRewards(goal), [136.4, 137.4]);
  assert.deepEqual(goal.unlockedMilestones, [137.4, 136.4]);
  assert.equal(
    state.tickets.filter((item) => item.goalId === goal.id).length,
    2,
  );
});
test('奖励展示入口使用正常导航，界面不将普通记录当作奖励清单', () => {
  const source = readFileSync(
    new URL('../src/screens/MilestonesScreen.tsx', import.meta.url),
    'utf8',
  );
  assert.ok(source.includes('已解锁的永久奖励'));
  const parsed = ts.createSourceFile(
    'MilestonesScreen.tsx',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const handlers: ts.Expression[] = [];
  function visit(node: ts.Node) {
    if (
      ts.isJsxAttribute(node) &&
      node.name.getText(parsed) === 'onPress' &&
      node.initializer &&
      ts.isJsxExpression(node.initializer) &&
      node.initializer.expression
    ) {
      const expression = node.initializer.expression;
      if (
        ts.isArrowFunction(expression) &&
        ts.isCallExpression(expression.body) &&
        ts.isPropertyAccessExpression(expression.body.expression) &&
        expression.body.expression.expression.getText(parsed) ===
          'navigation' &&
        expression.body.expression.name.text === 'navigate'
      )
        handlers.push(expression);
    }
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  assert.equal(handlers.length, 1);
  const calls: unknown[][] = [];
  const timestamp = 123456789;
  const handler = new Function(
    'navigation',
    'Date',
    `return (${handlers[0].getText(parsed)});`,
  )(
    { navigate: (...args: unknown[]) => calls.push(args) },
    { now: () => timestamp },
  );
  assert.deepEqual(calls, []);
  handler();
  assert.deepEqual(calls, [
    ['tickets', { intent: 'own-available', at: timestamp }],
  ]);
  assert.ok(source.includes('unlockedRewards(goal)'));
  assert.equal(source.includes('goal.entries].reverse()'), false);
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  assert.equal(app.includes('自定义里程碑'), false);
});

test('手机导航采用紧凑标题底栏，里程碑和奖券输入统一由共享控件提供14dp字体', () => {
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  assert.ok(
    app.includes(
      '64 + Math.max(0, Math.min(fontScale, 1.5) - 1) * 32 + bottomInset',
    ),
  );
  assert.ok(app.includes('headerTitleStyle: { fontSize: 16 }'));
  assert.ok(app.includes('color={color} size={22}'));
  for (const path of [
    '../src/screens/MilestonesScreen.tsx',
    '../src/screens/TicketsScreen.tsx',
  ]) {
    const text = readFileSync(new URL(path, import.meta.url), 'utf8');
    const source = ts.createSourceFile(
      path,
      text,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    let count = 0;
    function visit(node: ts.Node) {
      if (
        (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) &&
        node.tagName.getText(source) === 'TextInput'
      ) {
        count += 1;
        assert.ok(
          node.attributes.properties.some(
            (property) =>
              ts.isJsxAttribute(property) &&
              property.name.getText(source) === 'dense',
          ),
        );
        const content = node.attributes.properties.find(
          (property): property is ts.JsxAttribute =>
            ts.isJsxAttribute(property) &&
            property.name.getText(source) === 'contentStyle',
        );
        assert.equal(
          content?.getText(source).includes('fontSize: 16') ?? false,
          false,
        );
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
    assert.ok(count > 0);
    assert.equal(text.includes('padding: 20'), false);
    assert.equal(text.includes('size={24}'), false);
  }
  const sharedInput = readFileSync(
    new URL('../src/ui/AppTextInput.tsx', import.meta.url),
    'utf8',
  );
  assert.ok(sharedInput.includes('fontSize: 14, lineHeight: 20'));
});
