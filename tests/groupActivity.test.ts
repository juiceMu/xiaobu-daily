import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/domain/engine';
import {
  getGroupActivity,
  rankingProgress,
  timelineDateLabel,
} from '../src/domain/groupActivity';

test('排行进度按最高次数计算，零值及边界保持有效范围', () => {
  assert.equal(rankingProgress(0, 0), 0);
  assert.equal(rankingProgress(0, 12), 0);
  assert.equal(rankingProgress(6, 12), 0.5);
  assert.equal(rankingProgress(12, 12), 1);
  assert.equal(rankingProgress(20, 12), 1);
});

test('日期分组使用实际今天并覆盖跨年昨天和历史日期', () => {
  const now = new Date(2026, 0, 1, 10);
  assert.equal(timelineDateLabel('2026-01-01', now), '今天 · 1月1日');
  assert.equal(timelineDateLabel('2025-12-31', now), '昨天 · 12月31日');
  assert.equal(timelineDateLabel('2025-12-30', now), '2025年12月30日');
  assert.equal(timelineDateLabel('2026-01-02', now), '1月2日');
});

test('每日序号按成员和任务隔离，倒序列表与分页保留正序次数，补卡使用所属日', () => {
  const now = new Date('2026-11-04T12:00:00');
  const own = createInitialState(now);
  const other = createInitialState(now);
  const makeEntry = (
    id: string,
    taskId: string,
    date: string,
    createdAt: string,
  ) => ({
    id,
    taskId,
    date,
    createdAt,
    week: '2026-11-02',
  });
  own.checkins = [
    makeEntry('later', 'same-task', '2026-11-03', '2026-11-04T10:00:00.000Z'),
    makeEntry(
      'other-task',
      'different-task',
      '2026-11-03',
      '2026-11-03T11:00:00.000Z',
    ),
    makeEntry('first', 'same-task', '2026-11-03', '2026-11-03T09:00:00.000Z'),
    makeEntry(
      'next-day',
      'same-task',
      '2026-11-04',
      '2026-11-04T08:00:00.000Z',
    ),
  ];
  other.checkins = [
    makeEntry('first', 'same-task', '2026-11-03', '2026-11-03T09:00:00.000Z'),
  ];
  const original = JSON.stringify(own.checkins);
  const peers = [
    {
      accountId: 'peer',
      name: '同名成员',
      syncedAt: now.toISOString(),
      left: false,
      app: other,
    },
  ];
  const result = getGroupActivity(own, peers, now);
  assert.deepEqual(
    result.timeline.map(({ accountId, id, sequence }) => [
      accountId,
      id,
      sequence,
    ]),
    [
      ['self', 'next-day', 1],
      ['self', 'later', 2],
      ['self', 'other-task', 1],
      ['peer', 'first', 1],
      ['self', 'first', 1],
    ],
  );
  assert.equal(result.timeline.slice(0, 2)[1].sequence, 2);
  assert.equal(
    result.timeline.find(({ id }) => id === 'later')?.date,
    '2026-11-03',
  );
  assert.equal(JSON.stringify(own.checkins), original);
  own.checkins.splice(2, 1);
  assert.equal(
    getGroupActivity(own, peers, now).timeline.find(({ id }) => id === 'later')
      ?.sequence,
    1,
  );
});

test('小组周排行与时间轴按所属周统计当前有效记录和同步快照', () => {
  const now = new Date('2026-10-21T12:00:00');
  const own = createInitialState(now);
  const other = createInitialState(now);
  const departed = createInitialState(now);
  own.tasks = [
    {
      id: 'task',
      name: '旧任务',
      icon: 'sprout',
      color: 'green',
      target: 3,
      archived: false,
      deleted: true,
    },
  ];
  other.tasks = [
    {
      id: 'task',
      name: '阅读',
      icon: 'sprout',
      color: 'green',
      target: 3,
      archived: false,
    },
  ];
  own.checkins = [
    {
      id: 'same',
      taskId: 'task',
      date: '2026-10-20',
      week: '2026-10-19',
      createdAt: '2026-10-28T10:00:00.000Z',
    },
    {
      id: 'old',
      taskId: 'task',
      date: '2026-10-18',
      week: '2026-10-12',
      createdAt: '2026-10-20T10:00:00.000Z',
    },
  ];
  other.checkins = [
    {
      id: 'same',
      taskId: 'task',
      date: '2026-10-21',
      week: '2026-10-19',
      createdAt: '2026-10-21T09:00:00.000Z',
    },
    {
      id: 'newer',
      taskId: 'task',
      date: '2026-10-21',
      week: '2026-10-19',
      createdAt: '2026-10-21T10:00:00.000Z',
    },
  ];
  departed.checkins = [...other.checkins];
  const peers = [
    {
      accountId: 'peer',
      name: '我',
      syncedAt: '2026-10-21T11:00:00.000Z',
      left: false,
      app: other,
    },
    {
      accountId: 'left',
      name: '已离开',
      syncedAt: '2026-10-21T11:00:00.000Z',
      left: true,
      app: departed,
    },
  ];
  const result = getGroupActivity(own, peers, now);
  assert.deepEqual(
    result.rankings.map(({ accountId, count, rank }) => [
      accountId,
      count,
      rank,
    ]),
    [
      ['peer', 2, 1],
      ['self', 1, 2],
    ],
  );
  assert.equal(result.total, 3);
  assert.deepEqual(
    result.timeline.map(({ accountId, id }) => [accountId, id]),
    [
      ['peer', 'newer'],
      ['peer', 'same'],
      ['self', 'same'],
    ],
  );
  assert.equal(result.timeline[2].taskName, '旧任务');
  assert.equal(result.timeline[2].createdAt, '2026-10-28T10:00:00.000Z');
  assert.equal(result.rankings[0].syncedAt, peers[0].syncedAt);
  other.checkins.pop();
  const afterUndo = getGroupActivity(own, peers, now);
  assert.equal(afterUndo.total, 2);
  assert.deepEqual(
    afterUndo.rankings.map((entry) => entry.rank),
    [1, 1],
  );
  assert.equal(
    getGroupActivity(own, peers, new Date('2026-10-15T12:00:00')).total,
    1,
  );
});
