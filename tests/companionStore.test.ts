import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checkIn,
  createInitialState,
  redeemCompanionTicket,
  redeemTicket,
} from '../src/domain/engine';
import { acceptCompanionUse, startCompanionUse } from '../src/domain/companion';
import {
  createGroup,
  exportInvite,
  joinGroup,
  journalsForSend,
} from '../src/domain/groupSync';
import { exportAccountJournal, initializeSync } from '../src/domain/syncModel';
import { createAppStore, type AppStore } from '../src/state/store';
import {
  hasPendingCompanionUse,
  syncCompanionRounds,
} from '../src/state/companionSync';
import type { PersistedAppState } from '../src/domain/types';

const NOW = new Date('2026-10-23T10:00:00+08:00');
const SESSION_ID = 'joint-store-session';
const clone = <T>(value: T): T => structuredClone(value);

function device() {
  let saved = initializeSync(createInitialState(NOW));
  let failSave = false;
  const repository = {
    load: async () => clone(saved),
    save: async (state: PersistedAppState) => {
      if (failSave) throw new Error('测试存储失败');
      saved = clone(state);
    },
  };
  const store = createAppStore(repository);
  return {
    store,
    fail: (value: boolean) => {
      failSave = value;
    },
    reload: async () => {
      const reloaded = createAppStore(repository);
      await reloaded.initialize();
      return reloaded;
    },
  };
}

function state(store: AppStore) {
  const current = store.getSnapshot().state;
  assert.ok(current);
  return current;
}

// 与真实协议相同：先冻结双方发送快照，再分别持久化收到的日志。
async function exchange(left: AppStore, right: AppStore) {
  const leftJournal = journalsForSend(state(left));
  const rightJournal = journalsForSend(state(right));
  const releaseLeft = left.beginGroupSync();
  const releaseRight = right.beginGroupSync();
  assert.ok(releaseLeft && releaseRight);
  try {
    const leftResult = await left.applyGroupJournals(
      rightJournal,
      NOW.toISOString(),
    );
    assert.equal(leftResult.ok, true, leftResult.message);
    assert.equal(leftResult.persisted, true);
    const rightResult = await right.applyGroupJournals(
      leftJournal,
      NOW.toISOString(),
    );
    assert.equal(rightResult.ok, true, rightResult.message);
    assert.equal(rightResult.persisted, true);
  } finally {
    releaseLeft();
    releaseRight();
  }
}

async function fixture() {
  const a = device();
  const b = device();
  await a.store.initialize();
  await b.store.initialize();
  assert.equal(
    (
      await a.store.run((draft) =>
        createGroup(draft, '同行测试', {
          groupId: 'companion-store-group',
          secret: 'companion-store-secret',
        }),
      )
    ).ok,
    true,
  );
  assert.equal(
    (
      await b.store.run((draft) =>
        joinGroup(draft, exportInvite(state(a.store))),
      )
    ).ok,
    true,
  );
  assert.equal(
    (
      await a.store.run((draft) => {
        draft.settings.threshold = 1;
        draft.settings.expiryEnabled = false;
        const checked = checkIn(draft, 'task-1', NOW);
        return checked.ok ? redeemTicket(draft, NOW) : checked;
      })
    ).ok,
    true,
  );
  assert.equal(
    (
      await b.store.run((draft) => {
        draft.settings.expiryEnabled = false;
        const checked = checkIn(draft, 'task-1', NOW);
        return checked.ok ? redeemCompanionTicket(draft, NOW) : checked;
      })
    ).ok,
    true,
  );
  await exchange(a.store, b.store);
  assert.equal(
    (
      await a.store.run((draft) =>
        startCompanionUse(
          draft,
          {
            ticketId: draft.tickets[0].id,
            peerAccountId: state(b.store).sync.accountId,
            peerTicketId: state(b.store).tickets[0].id,
            note: '一起看电影',
          },
          NOW,
          SESSION_ID,
        ),
      )
    ).ok,
    true,
  );
  await exchange(a.store, b.store);
  assert.equal(
    (await b.store.run((draft) => acceptCompanionUse(draft, SESSION_ID, NOW)))
      .ok,
    true,
  );
  return { a, b };
}

test('COMP-006/009：双方独立存储经三轮新快照完成联合使用，重载和重放不重复消费', async () => {
  const { a, b } = await fixture();
  const rounds = await syncCompanionRounds(
    () => state(b.store),
    async () => exchange(a.store, b.store),
  );
  assert.equal(rounds, 3);
  for (const store of [a.store, b.store]) {
    const ticket = state(store).tickets[0];
    assert.equal(ticket.usedAt, NOW.toISOString());
    assert.equal(ticket.usageNote, '一起看电影');
    assert.equal(ticket.companionUses?.[0].stage, 'completed');
    assert.equal(hasPendingCompanionUse(state(store)), false);
  }
  const beforeA = clone(state(a.store).sync);
  const beforeB = clone(state(b.store).sync);
  await exchange(a.store, b.store);
  assert.deepEqual(state(a.store).sync, beforeA);
  assert.deepEqual(state(b.store).sync, beforeB);
  const reloadedA = await a.reload();
  const reloadedB = await b.reload();
  assert.deepEqual(state(reloadedA).tickets, state(a.store).tickets);
  assert.deepEqual(state(reloadedB).tickets, state(b.store).tickets);
});

test('COMP-009/010：主券已提交但回执前断线，双方重启后继续核对同一笔', async () => {
  const { a, b } = await fixture();
  await exchange(a.store, b.store);
  assert.equal(state(a.store).tickets[0].companionUses?.[0].stage, 'committed');
  assert.equal(state(b.store).tickets[0].usedAt, null);
  const aReloaded = await a.reload();
  const bReloaded = await b.reload();
  assert.equal(hasPendingCompanionUse(state(aReloaded)), true);
  assert.equal(hasPendingCompanionUse(state(bReloaded)), true);
  await syncCompanionRounds(
    () => state(aReloaded),
    async () => exchange(aReloaded, bReloaded),
  );
  assert.equal(
    state(aReloaded).tickets[0].companionUses?.[0].stage,
    'completed',
  );
  assert.equal(
    state(bReloaded).tickets[0].companionUses?.[0].stage,
    'completed',
  );
  assert.equal(
    state(aReloaded).tickets[0].usedAt,
    state(bReloaded).tickets[0].usedAt,
  );
});

test('COMP-010：同步保存失败时副本、提交决定和本机扣券全部保留旧快照，可原样重试', async () => {
  const { a, b } = await fixture();
  const before = clone(state(a.store));
  a.fail(true);
  const release = a.store.beginGroupSync();
  assert.ok(release);
  const rejected = await a.store.applyGroupJournals(
    journalsForSend(state(b.store)),
    NOW.toISOString(),
  );
  assert.equal(rejected.ok, false);
  assert.equal(rejected.persisted, false);
  assert.deepEqual(state(a.store), before);
  assert.equal(a.store.getSnapshot().busy, true);
  release();
  a.fail(false);
  await syncCompanionRounds(
    () => state(b.store),
    async () => exchange(a.store, b.store),
  );
  assert.equal(state(a.store).tickets[0].companionUses?.[0].stage, 'completed');
  assert.equal(state(b.store).tickets[0].companionUses?.[0].stage, 'completed');
});

test('普通同步只交换一轮；中途小组变化后不再发送旧身份；连接失败原样抛出', async () => {
  const current = initializeSync(createInitialState(NOW));
  assert.equal(
    createGroup(current, '轮次测试', {
      groupId: 'rounds-test-group',
      secret: 'rounds-test-secret',
    }).ok,
    true,
  );
  let calls = 0;
  assert.equal(
    await syncCompanionRounds(
      () => current,
      async () => {
        calls += 1;
      },
    ),
    1,
  );
  assert.equal(calls, 1);
  await assert.rejects(
    syncCompanionRounds(
      () => current,
      async () => {
        throw new Error('连接中断');
      },
    ),
    /连接中断/,
  );
  let reads = 0;
  await assert.rejects(
    syncCompanionRounds(
      () => {
        reads += 1;
        return reads === 1 ? current : null;
      },
      async () => {
        assert.fail('不应发送');
      },
    ),
    /身份已变化/,
  );
});

test('本机日志回传只确认已保存的精确前缀，伪造或超前回传不产生持久化ACK', async () => {
  const a = device();
  await a.store.initialize();
  assert.equal(
    (
      await a.store.run((draft) =>
        createGroup(draft, '前缀测试', {
          groupId: 'echo-prefix-group',
          secret: 'echo-prefix-secret',
        }),
      )
    ).ok,
    true,
  );
  const own = exportAccountJournal(state(a.store));
  const before = clone(state(a.store));
  const exact = await a.store.applyGroupJournals([own], NOW.toISOString());
  assert.equal(exact.ok, true);
  assert.equal(exact.persisted, true);
  const fake = clone(own);
  fake.operations[0].operationId += '-forged';
  const rejected = await a.store.applyGroupJournals([fake], NOW.toISOString());
  assert.equal(rejected.persisted, false);
  assert.deepEqual(state(a.store).sync, before.sync);
});
