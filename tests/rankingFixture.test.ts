import assert from 'node:assert/strict';
import test from 'node:test';
import { createAppStore } from '../src/state/store';
import {
  checkIn,
  createInitialState,
  migrateState,
  updateTask,
  type PersistedAppState,
} from '../src/domain/engine';
import {
  appendRankingFixture,
  prepareFixtureGroup,
} from '../fixture/rankingFixture';
import { getGroupActivity } from '../src/domain/groupActivity';
import { createGroup, peerBoards } from '../src/domain/groupSync';
import { validateSync } from '../src/domain/syncModel';

const now = new Date('2026-11-06T12:00:00+08:00');
async function setup() {
  let saved: PersistedAppState | null = null;
  let fail = false;
  let saves = 0;
  let nextId = 0;
  const store = createAppStore(
    {
      async load() {
        return saved;
      },
      async save(value) {
        if (fail) throw new Error('受控保存失败');
        saves += 1;
        saved = structuredClone(value);
      },
    },
    { now: () => now, id: () => `fixture-local-id-${++nextId}` },
  );
  await store.initialize();
  return {
    store,
    get saved() {
      return saved;
    },
    get saves() {
      return saves;
    },
    setFail(value: boolean) {
      fail = value;
    },
  };
}

test('空组与排行分步显式保存，11至1名次、相同任务ID、单条删除记录合法持久化', async () => {
  const h = await setup();
  assert.equal((await h.store.run(prepareFixtureGroup)).ok, true);
  assert.equal(peerBoards(h.store.getSnapshot().state!).length, 0);
  assert.equal(
    (await h.store.run((draft) => appendRankingFixture(draft, now))).ok,
    true,
  );
  const state = h.store.getSnapshot().state!;
  validateSync(state);
  const activity = getGroupActivity(state, peerBoards(state), now);
  assert.deepEqual(
    activity.rankings.map((member) => member.rank),
    Array.from({ length: 11 }, (_, i) => i + 1),
  );
  assert.deepEqual(
    activity.rankings.map((member) => member.count),
    Array.from({ length: 11 }, (_, i) => 11 - i),
  );
  assert.equal(activity.total, 66);
  assert.equal(activity.timeline.length, 66);
  const dateCounts = new Map<string, number>();
  for (const entry of activity.timeline)
    dateCounts.set(entry.date, (dateCounts.get(entry.date) ?? 0) + 1);
  assert.deepEqual(
    [...dateCounts.values()].sort((a, b) => a - b),
    [1, 65],
  );
  assert.ok(activity.timeline.every((entry) => entry.sequence >= 1));
  const peers = peerBoards(state);
  assert.equal(peers.length, 10);
  assert.ok(
    peers.every(
      (peer) =>
        !peer.left &&
        peer.app.checkins.every((entry) => entry.taskId === 'task-1'),
    ),
  );
  const last = peers.find(
    (peer) => peer.accountId === activity.rankings[10].accountId,
  )!;
  assert.equal(last.app.checkins.length, 1);
  assert.equal(
    last.app.tasks.find((task) => task.id === 'task-1')?.deleted,
    true,
  );
  assert.equal(
    activity.timeline.find((entry) => entry.accountId === last.accountId)
      ?.sequence,
    1,
  );
  assert.deepEqual(h.saved, state);
  const before = structuredClone(state);
  const saves = h.saves;
  assert.equal(
    (await h.store.run((draft) => appendRankingFixture(draft, now))).ok,
    false,
  );
  assert.equal((await h.store.run(prepareFixtureGroup)).ok, false);
  assert.deepEqual(h.store.getSnapshot().state, before);
  assert.equal(h.saves, saves);
  // 后续跨年补卡仍走真实领域入口，不把两天所属日期改成当前操作日。
  for (const day of ['2025-12-31', '2026-01-01']) {
    assert.equal(
      (await h.store.run((draft) => checkIn(draft, 'task-1', now, day))).ok,
      true,
    );
  }
  assert.deepEqual(
    h.store
      .getSnapshot()
      .state!.checkins.slice(-2)
      .map((entry) => entry.date),
    ['2025-12-31', '2026-01-01'],
  );
});

test('非夹具组、已有业务或改动后恢复的业务拒绝且零变异', async () => {
  for (const dirty of [
    'group',
    'checkin',
    'task',
    'reverted',
    'invalid-time',
    'monday',
  ]) {
    const h = await setup();
    if (dirty === 'group')
      await h.store.run((draft) =>
        createGroup(draft, '其他组', {
          groupId: 'other-group-id',
          secret: 'other-group-secret',
        }),
      );
    else {
      await h.store.run(prepareFixtureGroup);
      if (dirty === 'checkin')
        await h.store.run((draft) => checkIn(draft, 'task-1', now));
      if (dirty === 'task' || dirty === 'reverted')
        await h.store.run((draft) =>
          updateTask(draft, 'task-1', { target: 2 }),
        );
      if (dirty === 'reverted')
        await h.store.run((draft) =>
          updateTask(draft, 'task-1', { target: 1 }),
        );
    }
    const before = structuredClone(h.store.getSnapshot().state);
    const saves = h.saves;
    assert.equal(
      (
        await h.store.run((draft) =>
          appendRankingFixture(
            draft,
            dirty === 'invalid-time'
              ? new Date(NaN)
              : dirty === 'monday'
                ? new Date('2026-11-02T12:00:00+08:00')
                : now,
          ),
        )
      ).ok,
      false,
      dirty,
    );
    assert.deepEqual(h.store.getSnapshot().state, before, dirty);
    assert.equal(h.saves, saves, dirty);
  }
  const plain = createInitialState();
  const before = migrateState(plain);
  assert.equal(prepareFixtureGroup(plain).ok, false);
  assert.deepEqual(plain, before);
});

test('任一步保存失败保留旧快照，恢复后可重试且不重建身份', async () => {
  const h = await setup();
  for (const step of [
    prepareFixtureGroup,
    (draft: Parameters<typeof prepareFixtureGroup>[0]) =>
      appendRankingFixture(draft, now),
  ]) {
    const before = structuredClone(h.store.getSnapshot().state);
    h.setFail(true);
    assert.equal((await h.store.run(step)).ok, false);
    assert.deepEqual(h.store.getSnapshot().state, before);
    assert.deepEqual(h.saved, before);
    h.setFail(false);
    assert.equal((await h.store.run(step)).ok, true);
    assert.equal(h.saved!.sync.accountId, before!.sync.accountId);
  }
});
