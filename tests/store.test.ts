import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checkIn,
  createInitialState as createBusinessState,
} from '../src/domain/engine';
import { commitSync, initializeSync } from '../src/domain/syncModel';
import {
  createGroup,
  joinGroup,
  leaveGroup,
  journalsForSend,
} from '../src/domain/groupSync';
import { createAppStore } from '../src/state/store';
import type { AppState } from '../src/domain/engine';
import type { StateRepository } from '../src/state/store';

const NOW = new Date(2026, 9, 19, 10);
const createInitialState = () => initializeSync(createBusinessState());
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

test('只有首次无存档时创建初始数据，之后重载保持完整记录', async () => {
  let saved: AppState | null = null;
  let saves = 0;
  const repository: StateRepository = {
    load: async () => clone(saved),
    save: async (state) => {
      saved = clone(state);
      saves += 1;
    },
  };
  const store = createAppStore(repository);
  await store.initialize();
  assert.equal(saves, 1);
  assert.equal(store.getSnapshot().state?.checkins.length, 0);
  assert.equal(
    (await store.run((state) => checkIn(state, 'task-1', NOW))).ok,
    true,
  );
  const reloaded = createAppStore(repository);
  await reloaded.initialize();
  assert.equal(saves, 2);
  assert.equal(reloaded.getSnapshot().state?.checkins.length, 1);
});

test('持久化完成之前不发布新记录，保存失败不消耗次数，可重试且不丢数据', async () => {
  let fail = true;
  const repository: StateRepository = {
    load: async () => createInitialState(),
    save: async () => {
      if (fail) throw new Error('磁盘暂时不可用');
    },
  };
  const store = createAppStore(repository);
  await store.initialize();
  const before = store.getSnapshot().state;
  const result = await store.run((state) => checkIn(state, 'task-1', NOW));
  assert.equal(result.ok, false);
  assert.match(result.message, /保存失败/);
  assert.equal(store.getSnapshot().state, before);
  assert.equal(store.getSnapshot().state?.checkins.length, 0);
  assert.equal(store.getSnapshot().busy, false);
  fail = false;
  assert.equal(
    (await store.run((state) => checkIn(state, 'task-1', NOW))).ok,
    true,
  );
  assert.equal(store.getSnapshot().state?.checkins.length, 1);
});

test('同步上锁阻止快速重复点击，后续操作使用最新已持久化状态', async () => {
  let finishSave: (() => void) | undefined;
  let saveCount = 0;
  const repository: StateRepository = {
    load: async () => createInitialState(),
    save: async () => {
      saveCount += 1;
      if (saveCount === 1)
        await new Promise<void>((resolve) => {
          finishSave = resolve;
        });
    },
  };
  const store = createAppStore(repository);
  await store.initialize();
  const first = store.run((state) => checkIn(state, 'task-1', NOW));
  assert.equal(store.getSnapshot().busy, true);
  assert.equal(store.getSnapshot().state?.checkins.length, 0);
  const duplicate = await store.run((state) => checkIn(state, 'task-1', NOW));
  assert.equal(duplicate.ok, false);
  assert.equal(saveCount, 1);
  if (!finishSave) throw new Error('保存事务尚未启动');
  finishSave();
  assert.equal((await first).ok, true);
  assert.equal(store.getSnapshot().state?.checkins.length, 1);
  assert.equal(
    (
      await store.run((state) => {
        state.tasks[0].target = 2;
        return checkIn(state, 'task-1', NOW);
      })
    ).ok,
    true,
  );
  assert.equal(store.getSnapshot().state?.checkins.length, 2);
  assert.equal(saveCount, 2);
});

test('损坏存档和读取异常不可静默重置；修复外部原因后可以明确重试', async () => {
  let loaded: unknown = { version: 9, original: '保留原始内容' };
  let saves = 0;
  const repository: StateRepository = {
    load: async () => loaded,
    save: async () => {
      saves += 1;
    },
  };
  const store = createAppStore(repository);
  await store.initialize();
  assert.equal(store.getSnapshot().state, null);
  assert.match(store.getSnapshot().error ?? '', /本地数据格式无效/);
  assert.equal(saves, 0);
  assert.equal(
    (await store.run((state) => checkIn(state, 'task-1', NOW))).ok,
    false,
  );
  loaded = createInitialState();
  await store.initialize();
  assert.ok(store.getSnapshot().state);
  assert.equal(saves, 0);
  const failing = createAppStore({
    load: async () => {
      throw new Error('读取失败');
    },
    save: repository.save,
  });
  await failing.initialize();
  assert.equal(failing.getSnapshot().state, null);
  assert.equal(failing.getSnapshot().error, '读取失败');
  assert.equal(saves, 0);
});

test('失败业务操作与抛出异常都不会写入或更改可见数据', async () => {
  let saves = 0;
  const store = createAppStore({
    load: async () => createInitialState(),
    save: async () => {
      saves += 1;
    },
  });
  await store.initialize();
  const before = JSON.stringify(store.getSnapshot().state);
  assert.equal(
    (
      await store.run((state) => {
        state.tasks[0].name = '不会保存';
        return { ok: false, message: '拒绝' };
      })
    ).ok,
    false,
  );
  assert.equal(
    (
      await store.run(() => {
        throw new Error('中断');
      })
    ).ok,
    false,
  );
  assert.equal(JSON.stringify(store.getSnapshot().state), before);
  assert.equal(saves, 0);
});

test('已认证的小组会话锁住本地写入，但允许事务内持久化收到的副本', async () => {
  const change = (
    source: ReturnType<typeof createInitialState>,
    mutation: (draft: AppState) => { ok: boolean; message: string },
  ) => {
    const draft = clone(source);
    const result = mutation(draft);
    assert.equal(result.ok, true, result.message);
    return commitSync(source, draft);
  };
  let owner = change(createInitialState(), (draft) =>
    createGroup(draft, '互斥测试', {
      groupId: 'store-sync-group',
      secret: 'store-sync-secret',
    }),
  );
  const member = change(createInitialState(), (draft) =>
    joinGroup(
      draft,
      JSON.stringify({
        version: 1,
        kind: 'sprout-group',
        groupId: owner.groupLink!.groupId,
        name: owner.groupLink!.name,
        secret: owner.groupLink!.secret,
      }),
    ),
  );
  let saved = clone(member);
  const store = createAppStore({
    load: async () => clone(saved),
    save: async (state) => {
      saved = clone(state);
    },
  });
  await store.initialize();

  const release = store.beginGroupSync();
  assert.ok(release);
  assert.equal(store.getSnapshot().busy, true);
  assert.equal(
    (await store.run((draft) => checkIn(draft, 'task-1', NOW))).ok,
    false,
  );

  const received = await store.applyGroupJournals(
    journalsForSend(owner),
    NOW.toISOString(),
  );
  assert.equal(received.ok, true, received.message);
  assert.equal(received.persisted, true);
  assert.equal(store.getSnapshot().busy, true);
  assert.equal(store.getSnapshot().state?.groupPeers?.length, 1);

  const forked = clone(journalsForSend(owner)[0]);
  forked.operations[0].entity.payload =
    forked.operations[0].entity.payload.replace('早睡', '晚睡');
  const rejectedFork = await store.applyGroupJournals(
    [forked],
    NOW.toISOString(),
  );
  assert.equal(rejectedFork.ok, true);
  assert.equal(rejectedFork.persisted, false);

  release();
  assert.equal(store.getSnapshot().busy, false);
});

test('离组凭据仅在对端确认保存本机日志后清除', async () => {
  let saved = createInitialState();
  const store = createAppStore({
    load: async () => clone(saved),
    save: async (state) => {
      saved = clone(state);
    },
  });
  await store.initialize();
  assert.equal(
    (
      await store.run((state) =>
        createGroup(state, '离组确认测试', {
          groupId: 'departure-ack-group',
          secret: 'departure-ack-secret',
        }),
      )
    ).ok,
    true,
  );
  assert.equal((await store.run(leaveGroup)).ok, true);
  const sent = journalsForSend(store.getSnapshot().state!)[0];

  const unconfirmed = await store.completeGroupDeparture(sent, false);
  assert.equal(unconfirmed.ok, false);
  assert.ok(store.getSnapshot().state?.pendingGroupDeparture);

  const confirmed = await store.completeGroupDeparture(sent, true);
  assert.equal(confirmed.ok, true, confirmed.message);
  assert.equal(store.getSnapshot().state?.pendingGroupDeparture, undefined);
});
