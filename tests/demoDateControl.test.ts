import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoDateControl } from '../acceptance/demoDateControl';
import { createAppStore, type StateRepository } from '../src/state/store';
import {
  hasCompanionDemoHistory,
  hasDemoHistory,
  hasGroupActivityDemoHistory,
} from '../src/domain/demoData';
import type { PersistedAppState } from '../src/domain/engine';
import { validateSync } from '../src/domain/syncModel';
import { installBusinessSaveControl } from '../acceptance/businessSaveControl';

test('隔离控制仅一次以上周导入初始存档，拒绝已有演示存档', async () => {
  const repository: StateRepository = {
    load: async () => null,
    save: async () => {},
  };
  let id = 0;
  const now = new Date();
  const previous = new Date(now);
  previous.setDate(previous.getDate() - 7);
  const store = createAppStore(repository, {
    now: () => now,
    id: () => `date-control-${++id}`,
  });
  await store.initialize();
  const control = createDemoDateControl(() => now);
  control.arm();
  assert.equal((await control.load(store)).ok, true);
  assert.equal(control.getSnapshot(), false);
  const state = store.getSnapshot().state!;
  assert.equal(hasGroupActivityDemoHistory(state, previous), true);
  assert.equal(hasGroupActivityDemoHistory(state, now), false);
  control.arm();
  assert.match((await control.load(store)).message, /仅允许初始空存档/);
  assert.equal(control.getSnapshot(), false);
  assert.equal((await control.load(store)).ok, true);
  assert.equal(
    hasGroupActivityDemoHistory(store.getSnapshot().state!, now),
    true,
  );
});

test('实际导入第3次保存失败保留前序步骤并可重试', async () => {
  let writes = 0;
  const repository: StateRepository = {
    load: async () => null,
    save: async () => {
      writes += 1;
    },
  };
  const control = installBusinessSaveControl(repository);
  let id = 0;
  const store = createAppStore(repository, {
    now: () => new Date(),
    id: () => `round-control-id-${++id}`,
  });
  await store.initialize();
  const initialWrites = writes;
  assert.equal(control.arm('fail', 3), true);
  const dateControl = createDemoDateControl();
  const failed = await dateControl.load(store);
  assert.equal(failed.ok, false);
  assert.match(failed.message, /演示补充未完成/);
  assert.equal(writes, initialWrites + 2);
  assert.equal(control.getSnapshot().hits, 1);
  assert.ok(store.getSnapshot().state!.checkins.length > 0);
  assert.equal((await dateControl.load(store)).ok, true);
});

test('实际第4次保存失败保留三步合法存档，重载重试完成且再次重复零写入', async () => {
  let saved: PersistedAppState | null = null;
  const writes: PersistedAppState[] = [];
  const repository: StateRepository = {
    load: async () => (saved ? structuredClone(saved) : null),
    save: async (state) => {
      validateSync(state);
      saved = structuredClone(state);
      writes.push(structuredClone(state));
    },
  };
  const control = installBusinessSaveControl(repository);
  let id = 0;
  const clock = {
    now: () => new Date(),
    id: () => `fourth-control-id-${++id}`,
  };
  const store = createAppStore(repository, clock);
  await store.initialize();
  const initialWrites = writes.length;
  assert.equal(control.arm('fail', 4), true);
  const dateControl = createDemoDateControl();
  const failed = await dateControl.load(store);
  assert.equal(failed.ok, false);
  assert.equal(
    failed.message,
    '演示补充未完成，已保存步骤保留，请再次添加继续：保存失败，未更改数据：验收注入：本次业务保存失败',
  );
  assert.equal(store.getSnapshot().error, '验收注入：本次业务保存失败');
  assert.equal(control.getSnapshot().status, 'failed');
  assert.equal(control.getSnapshot().hits, 1);
  assert.equal(writes.length, initialWrites + 3);
  const [personal, activity, accepted] = writes.slice(initialWrites);
  assert.equal(hasDemoHistory(personal), true);
  assert.equal(hasGroupActivityDemoHistory(personal), false);
  assert.equal(hasGroupActivityDemoHistory(activity), true);
  assert.equal(hasCompanionDemoHistory(accepted), false);
  assert.deepEqual(
    accepted.tasks.slice(0, activity.tasks.length),
    activity.tasks,
  );
  assert.deepEqual(
    accepted.checkins.slice(0, activity.checkins.length),
    activity.checkins,
  );
  assert.deepEqual(
    accepted.tickets.slice(0, activity.tickets.length),
    activity.tickets,
  );
  assert.deepEqual(
    accepted.redemptions.slice(0, activity.redemptions.length),
    activity.redemptions,
  );
  const acceptedUse = accepted.tickets
    .flatMap((ticket) => ticket.companionUses ?? [])
    .find((use) => use.stage === 'accepted');
  assert.ok(acceptedUse);
  assert.ok(accepted.sync.outbox.length > activity.sync.outbox.length);
  assert.deepEqual(store.getSnapshot().state, accepted);
  assert.deepEqual(saved, accepted);

  const reloaded = createAppStore(repository, clock);
  await reloaded.initialize();
  assert.equal(reloaded.getSnapshot().error, null);
  assert.equal(writes.length, initialWrites + 3);
  assert.deepEqual(reloaded.getSnapshot().state, accepted);
  assert.equal((await dateControl.load(reloaded)).ok, true);
  assert.equal(writes.length, initialWrites + 4);
  const completed = reloaded.getSnapshot().state!;
  validateSync(completed);
  assert.equal(hasCompanionDemoHistory(completed), true);
  assert.deepEqual(completed.tasks, accepted.tasks);
  assert.deepEqual(completed.checkins, accepted.checkins);
  assert.deepEqual(completed.redemptions, accepted.redemptions);
  assert.deepEqual(completed.groupLink, accepted.groupLink);
  assert.deepEqual(completed.groupOwned, accepted.groupOwned);
  assert.deepEqual(completed.settings, accepted.settings);
  assert.deepEqual(completed.giftState, accepted.giftState);
  assert.deepEqual(completed.weight, accepted.weight);
  assert.deepEqual(completed.milestoneGoals, accepted.milestoneGoals);
  assert.deepEqual(
    completed.tickets.map((ticket) => ticket.id),
    accepted.tickets.map((ticket) => ticket.id),
  );
  const completedUse = completed.tickets
    .flatMap((ticket) => ticket.companionUses ?? [])
    .find((use) => use.id === acceptedUse.id);
  assert.equal(completedUse?.stage, 'completed');
  assert.deepEqual(
    completed.sync.outbox.slice(0, accepted.sync.outbox.length),
    accepted.sync.outbox,
  );
  assert.ok(completed.sync.outbox.length > accepted.sync.outbox.length);

  const finalReload = createAppStore(repository, clock);
  await finalReload.initialize();
  assert.deepEqual(finalReload.getSnapshot().state, completed);
  const beforeRepeat = writes.length;
  for (let repeat = 0; repeat < 2; repeat += 1) {
    assert.equal((await dateControl.load(finalReload)).ok, true);
    assert.equal(writes.length, beforeRepeat);
    assert.deepEqual(finalReload.getSnapshot().state, completed);
    assert.deepEqual(
      finalReload.getSnapshot().state!.sync.outbox,
      completed.sync.outbox,
    );
  }
});

test('上周控制拒绝已有目标、资料、副本及同步历史，不执行写入', async () => {
  let writes = 0;
  let id = 0;
  const repository: StateRepository = {
    load: async () => null,
    save: async () => {
      writes += 1;
    },
  };
  const store = createAppStore(repository, {
    now: () => new Date(),
    id: () => `guard-control-id-${++id}`,
  });
  await store.initialize();
  const initial = store.getSnapshot();
  assert.ok(initial.state);
  const variants = [
    { ...initial.state, weight: { ...initial.state.weight, enabled: true } },
    {
      ...initial.state,
      groupPeers: [
        {
          accountId: 'peer',
          deviceId: 'device',
          operations: [],
          attachments: {},
          syncedAt: new Date().toISOString(),
        },
      ],
    },
    { ...initial.state, sync: { ...initial.state.sync!, sequence: 7 } },
  ];
  const count = writes;
  for (const state of variants) {
    const control = createDemoDateControl();
    control.arm();
    const fake = { ...store, getSnapshot: () => ({ ...initial, state }) };
    assert.match((await control.load(fake)).message, /仅允许初始空存档/);
  }
  assert.equal(writes, count);
});
