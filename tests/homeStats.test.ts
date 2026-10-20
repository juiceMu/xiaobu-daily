import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import {
  createInitialState,
  getTicketStatus,
  MILESTONE_ICONS,
} from '../src/domain/engine';
import type { AppState, Ticket } from '../src/domain/types';

const today = readFileSync(
  new URL('../src/screens/TodayScreen.tsx', import.meta.url),
  'utf8',
);
function findNode<T extends ts.Node>(
  source: ts.SourceFile,
  predicate: (node: ts.Node) => node is T,
) {
  const results: T[] = [];
  const visit = (node: ts.Node) => {
    if (predicate(node)) results.push(node);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return results;
}

test('首页实际可用券表达式合计全部来源，排除已用到期券，按真实now且不受历史日期影响', () => {
  const parsed = ts.createSourceFile(
    'TodayScreen.tsx',
    today,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const variable = findNode(parsed, ts.isVariableDeclaration).find(
    (node) => node.name.getText(parsed) === 'availableTickets',
  );
  assert.ok(variable?.initializer);
  const expression = variable.initializer.getText(parsed);
  assert.doesNotMatch(expression, /selectedNow|selectedDate|pickedDate|source/);
  const evaluate = new Function(
    'state',
    'now',
    'getTicketStatus',
    'selectedNow',
    `${ts.transpile(`const result = ${expression};`, { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None })}\nreturn result;`,
  ) as (
    state: AppState,
    now: Date,
    status: typeof getTicketStatus,
    selectedNow: Date,
  ) => number;
  const now = new Date('2026-10-20T12:00:00.000Z');
  const later = new Date(now.getTime() + 60000).toISOString();
  const previous = new Date(now.getTime() - 60000).toISOString();
  const state = createInitialState(now);
  const ticket = (
    id: string,
    source: Ticket['source'],
    expiresAt: string | null,
    usedAt: string | null,
  ): Ticket => ({
    id,
    name: id,
    source,
    createdAt: previous,
    week: '2026-10-19',
    expiresAt,
    usedAt,
  });
  state.tickets = [
    ticket('weekly-1', 'checkin', later, null),
    ticket('goal-1', 'weight', later, null),
    ticket('gift-1', 'gift', later, null),
    ticket('permanent-1', undefined, null, null),
    ticket('used-1', 'checkin', later, previous),
    ticket('used-2', 'gift', previous, previous),
    ticket('expires-now', 'checkin', now.toISOString(), null),
    ticket('expired-1', 'weight', previous, null),
  ];
  const before = structuredClone(state);
  for (const history of [new Date(2020, 0, 1), now, new Date(2026, 9, 19)])
    assert.equal(evaluate(state, now, getTicketStatus, history), 4);
  assert.equal(
    evaluate(state, new Date(later), getTicketStatus, new Date(2020, 0, 1)),
    1,
  );
  assert.deepEqual(state, before);
});

test('首页三统计卡共享可收缩零最小宽布局，保留现有周统计与兑换语义', () => {
  const parsed = ts.createSourceFile(
    'TodayScreen.tsx',
    today,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const card = findNode(parsed, ts.isVariableDeclaration).find(
    (node) => node.name.getText(parsed) === 'summaryCardStyle',
  );
  assert.ok(
    card?.initializer && ts.isObjectLiteralExpression(card.initializer),
  );
  const properties = card.initializer.properties.filter(
    ts.isPropertyAssignment,
  );
  assert.equal(
    properties
      .find((node) => node.name.getText(parsed) === 'minWidth')
      ?.initializer.getText(parsed),
    '0',
  );
  assert.equal(
    properties
      .find((node) => node.name.getText(parsed) === 'padding')
      ?.initializer.getText(parsed),
    '8',
  );
  const summaryViews = findNode(parsed, ts.isJsxOpeningElement).filter(
    (node) =>
      node.tagName.getText(parsed) === 'View' &&
      node.attributes.getText(parsed).includes('summaryCardStyle'),
  );
  assert.equal(summaryViews.length, 3);
  assert.ok(today.includes('可用奖券'));
  assert.ok(today.includes("historicalWeek ? '所选周打卡' : '本周打卡'"));
  assert.ok(today.includes("historicalWeek ? '历史已兑换' : '可兑换'"));
  assert.doesNotMatch(today, /allowFontScaling=\{false\}/);
});

test('任务与里程碑提供48个不重复的精选图标', () => {
  assert.equal(MILESTONE_ICONS.length, 48);
  assert.equal(new Set(MILESTONE_ICONS).size, 48);
});
