import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checkIn,
  createInitialState,
  getWeekStats,
  migrateState,
  redeemTicket,
  redeemCompanionTicket,
  undoCheckIn,
  updateTask,
  updateSettings,
  useTicket,
  ensureGiftProfile,
  addMilestoneGoal,
  recordMilestoneValue,
  createGift,
  receiveGift,
} from '../src/domain/engine';
import {
  acceptCompanionUse,
  cancelCompanionUse,
  companionUseOffers,
  isTicketReserved,
  reconcileCompanionUses,
  startCompanionUse,
} from '../src/domain/companion';
import {
  applyGroupJournals,
  createGroup,
  exportInvite,
  joinGroup,
  journalsForSend,
  leaveGroup,
} from '../src/domain/groupSync';
import {
  commitSync,
  initializeSync,
  validateSync,
  type SyncClock,
} from '../src/domain/syncModel';
import { createAppStore } from '../src/state/store';
import type {
  ActionResult,
  AppState,
  PersistedAppState,
} from '../src/domain/types';

const NOW = new Date('2026-10-23T04:00:00.000Z');
const LATER = new Date('2026-10-23T04:01:00.000Z');
const EXPIRED = new Date('2026-10-23T04:16:00.000Z');
const clone = <T>(value: T): T => structuredClone(value);
function clock(prefix: string): SyncClock {
  let n = 0;
  return {
    now: () => NOW,
    id: () => `${prefix}-${String(++n).padStart(5, '0')}`,
  };
}
function mutate(
  state: PersistedAppState,
  action: (draft: AppState) => ActionResult,
) {
  const draft = clone(state);
  const result = action(draft);
  assert.equal(result.ok, true, result.message);
  const next = commitSync(state, migrateState(draft), clock('mutation'));
  validateSync(next);
  return next;
}
function pull(target: PersistedAppState, sender: PersistedAppState, now = NOW) {
  const merged = applyGroupJournals(
    target,
    journalsForSend(sender),
    now.toISOString(),
  ).state;
  assert.equal(reconcileCompanionUses(merged, now).ok, true);
  const next = commitSync(target, migrateState(merged), clock('merge'));
  validateSync(next);
  return next;
}
function pair(
  source: 'checkin' | 'weight' | 'gift' = 'checkin',
  options: { anonymous?: boolean; sharedTicketId?: string } = {},
) {
  const identifyTicket = (draft: AppState, result: ActionResult) => {
    if (result.ticket && options.sharedTicketId) {
      const oldId = result.ticket.id;
      result.ticket.id = options.sharedTicketId;
      draft.redemptions.find((entry) => entry.ticketId === oldId)!.ticketId =
        options.sharedTicketId;
    }
    return result;
  };
  let a = initializeSync(createInitialState(), clock('accountA'));
  let b = initializeSync(createInitialState(), clock('accountB'));
  a = mutate(a, (draft) => {
    if (!options.anonymous)
      ensureGiftProfile(draft, { id: draft.sync!.accountId, name: '测试甲' });
    createGroup(draft, '同行测试组', {
      groupId: 'companion-group',
      secret: 'companion-secret',
    });
    updateTask(draft, 'task-1', { target: 5 });
    for (let n = 0; n < 4; n += 1) checkIn(draft, 'task-1', NOW);
    return identifyTicket(draft, redeemTicket(draft, NOW));
  });
  if (source === 'weight')
    a = mutate(a, (draft) => {
      const goal = addMilestoneGoal(draft, {
        name: '阅读',
        unit: '页',
        direction: 'increase',
        startWeight: 0,
        step: 1,
      }).goal!;
      return recordMilestoneValue(draft, goal.id, 1, NOW);
    });
  b = mutate(b, (draft) => {
    if (!options.anonymous)
      ensureGiftProfile(draft, { id: draft.sync!.accountId, name: '测试乙' });
    joinGroup(draft, exportInvite(a));
    updateTask(draft, 'task-1', { target: 3 });
    for (let n = 0; n < 3; n += 1) checkIn(draft, 'task-1', NOW);
    return identifyTicket(draft, redeemCompanionTicket(draft, NOW));
  });
  if (source === 'gift') {
    b = mutate(b, (draft) =>
      createGift(
        draft,
        { name: '赠送测试券', validity: 'permanent' },
        { giftId: 'companion-gift-1', ticketId: 'companion-gift-ticket' },
        NOW,
      ),
    );
    a = mutate(a, (draft) => receiveGift(draft, b.giftState!.outgoing[0], NOW));
  }
  a = pull(a, b);
  b = pull(b, a);
  return {
    a,
    b,
    mainId: source === 'checkin' ? a.tickets[0].id : a.tickets.at(-1)!.id,
    companionId: b.tickets[0].id,
  };
}
function invite(
  a: PersistedAppState,
  b: PersistedAppState,
  mainId: string,
  companionId: string,
) {
  return mutate(a, (draft) =>
    startCompanionUse(
      draft,
      {
        ticketId: mainId,
        peerAccountId: b.sync.accountId,
        peerTicketId: companionId,
        note: ' 一起看电影 ',
      },
      NOW,
      'session-test-1',
    ),
  );
}
function complete(
  a: PersistedAppState,
  b: PersistedAppState,
  mainId: string,
  companionId: string,
) {
  a = invite(a, b, mainId, companionId);
  b = pull(b, a);
  b = mutate(b, (draft) => acceptCompanionUse(draft, 'session-test-1', NOW));
  a = pull(a, b, LATER);
  b = pull(b, a, LATER);
  a = pull(a, b, LATER);
  return { a, b };
}

test('同行兑换只花本周1次并共享普通券余额，已消费次数不可撤销；历史周拒绝', () => {
  const state = createInitialState();
  updateTask(state, 'task-1', { target: 4 });
  for (let n = 0; n < 4; n += 1) checkIn(state, 'task-1', NOW);
  const ticket = redeemCompanionTicket(state, NOW).ticket!;
  assert.equal(ticket.source, 'companion');
  assert.equal(ticket.name, '同行券');
  assert.equal(state.redemptions[0].cost, 1);
  assert.equal(getWeekStats(state, NOW).available, 3);
  assert.equal(redeemTicket(state, NOW).ok, true);
  assert.equal(undoCheckIn(state, 'task-1', NOW).ok, false);
  assert.equal(redeemCompanionTicket(state, NOW).ok, false);
  const before = clone(state);
  assert.equal(redeemCompanionTicket(state, NOW, '2026-10-16').ok, false);
  assert.deepEqual(state, before);
  assert.deepEqual(migrateState(state), state);
});

test('同行券沿用兑换时有效期规则，永久开关和后续设置不追改已有券', () => {
  const state = createInitialState();
  updateTask(state, 'task-1', { target: 9 });
  for (let n = 0; n < 8; n += 1) checkIn(state, 'task-1', NOW);
  const companion = redeemCompanionTicket(state, NOW).ticket!;
  const main = redeemTicket(state, NOW).ticket!;
  assert.ok(companion.expiresAt);
  assert.equal(companion.expiresAt, main.expiresAt);
  const originalExpiry = companion.expiresAt;
  assert.equal(updateSettings(state, { expiryEnabled: false }).ok, true);
  const permanent = redeemCompanionTicket(state, NOW).ticket!;
  assert.equal(permanent.expiresAt, null);
  assert.equal(
    updateSettings(state, {
      expiryEnabled: true,
      expiryDay: 7,
      expiryTime: '18:30',
    }).ok,
    true,
  );
  const updated = redeemCompanionTicket(state, NOW).ticket!;
  assert.notEqual(updated.expiresAt, originalExpiry);
  assert.equal(companion.expiresAt, originalExpiry);
  assert.equal(main.expiresAt, originalExpiry);
  assert.equal(permanent.expiresAt, null);
  assert.deepEqual(migrateState(state), state);
});

test('同行共同用途允许恰好200个字符并在两端保留同一文本', () => {
  let { a, b, mainId, companionId } = pair();
  const note = '行'.repeat(200);
  a = mutate(a, (draft) =>
    startCompanionUse(
      draft,
      {
        ticketId: mainId,
        peerAccountId: b.sync.accountId,
        peerTicketId: companionId,
        note,
      },
      NOW,
      'note-boundary-session',
    ),
  );
  b = pull(b, a);
  b = mutate(b, (draft) =>
    acceptCompanionUse(draft, 'note-boundary-session', NOW),
  );
  a = pull(a, b, LATER);
  b = pull(b, a, LATER);
  a = pull(a, b, LATER);
  for (const state of [a, b]) {
    assert.equal(state.tickets[0].usageNote, note);
    assert.equal(state.tickets[0].companionUses![0].note, note);
    assert.equal(state.tickets[0].companionUses![0].stage, 'completed');
  }
});

for (const source of ['checkin', 'weight', 'gift'] as const)
  test(`同行联合使用支持${source}主券，双方分别授权且仅消费自己券`, () => {
    const fixture = pair(source);
    const { mainId, companionId } = fixture;
    let { a, b } = fixture;
    const peerBefore = clone(a.groupPeers);
    a = invite(a, b, mainId, companionId);
    assert.deepEqual(a.groupPeers, peerBefore);
    assert.equal(
      a.tickets.find((ticket) => ticket.id === mainId)!.usedAt,
      null,
    );
    assert.equal(useTicket(clone(a), mainId, NOW).ok, false);
    b = pull(b, a);
    assert.equal(companionUseOffers(b, NOW)[0].canAccept, true);
    assert.equal(b.tickets[0].usedAt, null);
    b = mutate(b, (draft) => acceptCompanionUse(draft, 'session-test-1', NOW));
    assert.equal(b.tickets[0].usedAt, null);
    assert.equal(isTicketReserved(b.tickets[0]), true);
    a = pull(a, b, LATER);
    const main = a.tickets.find((ticket) => ticket.id === mainId)!;
    assert.equal(main.companionUses![0].stage, 'committed');
    assert.equal(main.usedAt, LATER.toISOString());
    assert.equal(main.usageNote, '一起看电影');
    b = pull(b, a, EXPIRED);
    assert.equal(b.tickets[0].usedAt, main.usedAt);
    assert.equal(b.tickets[0].companionUses![0].stage, 'completed');
    a = pull(a, b, EXPIRED);
    assert.equal(
      a.tickets.find((ticket) => ticket.id === mainId)!.companionUses![0].stage,
      'completed',
    );
    assert.equal(
      isTicketReserved(a.tickets.find((ticket) => ticket.id === mainId)!),
      false,
    );
    const replay = pull(a, b, EXPIRED);
    assert.equal(replay.sync.sequence, a.sync.sequence);
    assert.deepEqual(replay.tickets, a.tickets);
  });

test('同行券不能单用、自用、同行搭同行，非法入参拒绝且不变异', () => {
  const { a, b, mainId, companionId } = pair();
  for (const [owner, input] of [
    [
      b,
      {
        ticketId: companionId,
        peerAccountId: b.sync.accountId,
        peerTicketId: companionId,
      },
    ],
    [
      a,
      {
        ticketId: mainId,
        peerAccountId: b.sync.accountId,
        peerTicketId: 'missing',
      },
    ],
    [
      a,
      {
        ticketId: mainId,
        peerAccountId: b.sync.accountId,
        peerTicketId: companionId,
        note: 'x'.repeat(201),
      },
    ],
  ] as const) {
    const state = clone(owner);
    assert.equal(startCompanionUse(state, input, NOW).ok, false);
    assert.deepEqual(state, owner);
  }
  assert.equal(useTicket(b, companionId, NOW).ok, false);
  assert.equal(
    startCompanionUse(
      b,
      {
        ticketId: companionId,
        peerAccountId: a.sync.accountId,
        peerTicketId: mainId,
      },
      new Date('bad'),
    ).ok,
    false,
  );
});

test('不同账户的同行券不能互相搭配，主券不能互相搭配', () => {
  let { a, b, mainId, companionId } = pair();
  a = mutate(a, (draft) => redeemCompanionTicket(draft, NOW));
  b = mutate(b, (draft) => {
    draft.settings.threshold = 1;
    return redeemTicket(draft, NOW);
  });
  a = pull(a, b);
  b = pull(b, a);
  const before = clone(a);
  assert.equal(
    startCompanionUse(
      a,
      {
        ticketId: a.tickets.at(-1)!.id,
        peerAccountId: b.sync.accountId,
        peerTicketId: companionId,
      },
      NOW,
    ).ok,
    false,
  );
  assert.equal(
    startCompanionUse(
      a,
      {
        ticketId: mainId,
        peerAccountId: b.sync.accountId,
        peerTicketId: b.tickets.at(-1)!.id,
      },
      NOW,
    ).ok,
    false,
  );
  assert.deepEqual(a, before);
});

test('同行方主动申请只能请求主券授权，不能替伙伴消费', () => {
  let { a, b, mainId, companionId } = pair();
  b = mutate(b, (draft) =>
    startCompanionUse(
      draft,
      {
        ticketId: companionId,
        peerAccountId: a.sync.accountId,
        peerTicketId: mainId,
      },
      NOW,
      'session-request',
    ),
  );
  a = pull(a, b);
  assert.equal(a.tickets[0].usedAt, null);
  a = mutate(a, (draft) => acceptCompanionUse(draft, 'session-request', NOW));
  b = pull(b, a);
  assert.equal(b.tickets[0].companionUses![0].stage, 'requested');
  assert.equal(a.tickets[0].usedAt, null);
  b = mutate(b, (draft) => acceptCompanionUse(draft, 'session-request', NOW));
  a = pull(a, b, LATER);
  b = pull(b, a, LATER);
  a = pull(a, b, LATER);
  assert.equal(a.tickets[0].usedAt, b.tickets[0].usedAt);
  assert.equal(a.tickets[0].companionUses![0].stage, 'completed');
});

test('accepted后请求取消不得解锁或离组；主券取消决策同步后双方不扣券', () => {
  let { a, b, mainId, companionId } = pair();
  a = invite(a, b, mainId, companionId);
  b = pull(b, a);
  b = mutate(b, (draft) => acceptCompanionUse(draft, 'session-test-1', NOW));
  b = mutate(b, (draft) => cancelCompanionUse(draft, 'session-test-1', LATER));
  assert.equal(b.tickets[0].companionUses![0].stage, 'accepted');
  assert.equal(isTicketReserved(b.tickets[0]), true);
  assert.equal(leaveGroup(clone(b)).ok, false);
  a = pull(a, b, LATER);
  assert.equal(a.tickets[0].companionUses![0].stage, 'cancelled');
  b = pull(b, a, LATER);
  assert.equal(b.tickets[0].companionUses![0].stage, 'cancelled');
  assert.equal(a.tickets[0].usedAt, null);
  assert.equal(b.tickets[0].usedAt, null);
  assert.equal(leaveGroup(clone(b)).ok, true);
});

test('取消与提交竞态以主券已经提交为准，副券请求取消不能撤销已用券', () => {
  let { a, b, mainId, companionId } = pair();
  a = invite(a, b, mainId, companionId);
  b = pull(b, a);
  b = mutate(b, (draft) => acceptCompanionUse(draft, 'session-test-1', NOW));
  a = pull(a, b, LATER);
  b = mutate(b, (draft) => cancelCompanionUse(draft, 'session-test-1', LATER));
  a = pull(a, b, LATER);
  assert.equal(a.tickets[0].companionUses![0].stage, 'committed');
  b = pull(b, a, LATER);
  assert.equal(b.tickets[0].companionUses![0].stage, 'completed');
  assert.ok(b.tickets[0].usedAt);
});

test('过期未提交邀请取消；已accepted离线保持锁直到主券取消传回', () => {
  let { a, b, mainId, companionId } = pair();
  a = invite(a, b, mainId, companionId);
  b = pull(b, a);
  b = mutate(b, (draft) => acceptCompanionUse(draft, 'session-test-1', NOW));
  b = mutate(b, (draft) => reconcileCompanionUses(draft, EXPIRED));
  assert.equal(b.tickets[0].companionUses![0].stage, 'accepted');
  a = pull(a, b, EXPIRED);
  assert.equal(a.tickets[0].companionUses![0].stage, 'cancelled');
  b = pull(b, a, EXPIRED);
  assert.equal(b.tickets[0].usedAt, null);
  assert.equal(isTicketReserved(b.tickets[0]), false);
});

test('取消方先离组的日志仍传递取消决定，不把副券永久锁在accepted', () => {
  let { a, b, mainId, companionId } = pair();
  a = invite(a, b, mainId, companionId);
  b = pull(b, a);
  b = mutate(b, (draft) => acceptCompanionUse(draft, 'session-test-1', NOW));
  a = mutate(a, (draft) => cancelCompanionUse(draft, 'session-test-1', LATER));
  a = mutate(a, leaveGroup);
  b = pull(b, a, LATER);
  assert.equal(b.tickets[0].companionUses![0].stage, 'cancelled');
  assert.equal(b.tickets[0].usedAt, null);
  assert.equal(isTicketReserved(b.tickets[0]), false);
});

test('同行方完成后先离组，主券仍读取离组日志中的完成回执', () => {
  let { a, b, mainId, companionId } = pair();
  a = invite(a, b, mainId, companionId);
  b = pull(b, a);
  b = mutate(b, (draft) => acceptCompanionUse(draft, 'session-test-1', NOW));
  a = pull(a, b, LATER);
  b = pull(b, a, LATER);
  assert.equal(a.tickets[0].companionUses![0].stage, 'committed');
  b = mutate(b, leaveGroup);
  a = pull(a, b, LATER);
  assert.equal(a.tickets[0].companionUses![0].stage, 'completed');
  assert.equal(leaveGroup(clone(a)).ok, true);
});

test('未获得对端授权证据不能伪造commit、解除accepted锁或提前完成副券', () => {
  let { a, b, mainId, companionId } = pair();
  a = invite(a, b, mainId, companionId);
  b = pull(b, a);
  const fakeCommit = clone(a);
  fakeCommit.tickets[0].companionUses![0].stage = 'committed';
  fakeCommit.tickets[0].companionUses![0].committedAt = NOW.toISOString();
  fakeCommit.tickets[0].usedAt = NOW.toISOString();
  fakeCommit.tickets[0].usageNote = '一起看电影';
  assert.throws(() =>
    commitSync(a, migrateState(fakeCommit), clock('fake-commit')),
  );
  b = mutate(b, (draft) => acceptCompanionUse(draft, 'session-test-1', NOW));
  const fakeCancel = clone(b);
  fakeCancel.tickets[0].companionUses![0].stage = 'cancelled';
  assert.throws(() =>
    commitSync(b, migrateState(fakeCancel), clock('fake-cancel')),
  );
  const fakeComplete = clone(b);
  fakeComplete.tickets[0].companionUses![0].stage = 'completed';
  fakeComplete.tickets[0].companionUses![0].committedAt = NOW.toISOString();
  fakeComplete.tickets[0].usedAt = NOW.toISOString();
  fakeComplete.tickets[0].usageNote = '一起看电影';
  assert.throws(() =>
    commitSync(b, migrateState(fakeComplete), clock('fake-complete')),
  );
});

test('完成历史保留伙伴及两券名称，离组清副本仍可重载且不可旧券补挂', () => {
  const fixture = pair();
  let { a, b } = complete(
    fixture.a,
    fixture.b,
    fixture.mainId,
    fixture.companionId,
  );
  assert.equal(a.tickets[0].companionUses![0].companionName, '测试乙');
  assert.equal(
    b.tickets[0].companionUses![0].mainTicketName,
    a.tickets[0].name,
  );
  const before = clone(a);
  assert.equal(
    startCompanionUse(
      a,
      {
        ticketId: fixture.mainId,
        peerAccountId: b.sync.accountId,
        peerTicketId: fixture.companionId,
      },
      NOW,
    ).ok,
    false,
  );
  assert.deepEqual(a, before);
  a = mutate(a, leaveGroup);
  b = mutate(b, leaveGroup);
  assert.ok(migrateState(a).tickets[0].companionUses![0].companionName);
  assert.equal(b.groupPeers, undefined);
});

test('无昵称账户的双方历史使用中性成员快照，不把伙伴记录为我', () => {
  const fixture = pair('checkin', { anonymous: true });
  let { a, b } = complete(
    fixture.a,
    fixture.b,
    fixture.mainId,
    fixture.companionId,
  );
  a = mutate(a, leaveGroup);
  b = mutate(b, leaveGroup);
  for (const state of [a, b]) {
    const session = migrateState(state).tickets[0].companionUses![0];
    assert.equal(session.mainName, '成员');
    assert.equal(session.companionName, '成员');
    assert.equal(session.stage, 'completed');
    assert.equal(state.groupPeers, undefined);
  }
});

test('跨账户相同ticketId独立确认并完成联合使用，不串写或重复消费', () => {
  const fixture = pair('checkin', {
    sharedTicketId: 'same-account-scoped-ticket',
  });
  assert.equal(fixture.mainId, fixture.companionId);
  assert.notEqual(fixture.a.sync.accountId, fixture.b.sync.accountId);
  const { a, b } = complete(
    fixture.a,
    fixture.b,
    fixture.mainId,
    fixture.companionId,
  );
  for (const state of [a, b]) {
    assert.equal(state.tickets.length, 1);
    assert.equal(state.tickets[0].usedAt, LATER.toISOString());
    assert.equal(state.tickets[0].companionUses![0].stage, 'completed');
    assert.equal(state.redemptions.length, 1);
    assert.equal(state.redemptions[0].ticketId, fixture.mainId);
    validateSync(state);
  }
  assert.equal(a.redemptions[0].cost, 3);
  assert.equal(b.redemptions[0].cost, 1);
  assert.equal(a.tickets[0].source, undefined);
  assert.equal(b.tickets[0].source, 'companion');
  const replay = pull(a, b, LATER);
  assert.deepEqual(replay.tickets, a.tickets);
  assert.deepEqual(replay.redemptions, a.redemptions);
  assert.equal(replay.sync.sequence, a.sync.sequence);
});

test('迁移拒绝会话串账户、重复会话、错误提交时刻/券备注及同行券伪造消费', () => {
  const fixture = pair();
  const finished = complete(
    fixture.a,
    fixture.b,
    fixture.mainId,
    fixture.companionId,
  );
  for (const change of [
    (state: AppState) => {
      state.tickets[0].companionUses![0].companionAccountId =
        state.sync!.accountId;
    },
    (state: AppState) => {
      state.tickets[0].companionUses![0].mainTicketId = 'wrong-ticket';
    },
    (state: AppState) => {
      state.tickets[0].companionUses!.push(
        clone(state.tickets[0].companionUses![0]),
      );
    },
    (state: AppState) => {
      state.tickets[0].companionUses![0].committedAt = '2026-10-24T04:00:00Z';
    },
    (state: AppState) => {
      state.tickets[0].usageNote = '篡改备注';
    },
  ]) {
    const state = clone(finished.a);
    change(state);
    assert.throws(() => migrateState(state), /本地数据格式无效/);
  }
  const companion = clone(fixture.b);
  companion.tickets[0].usedAt = NOW.toISOString();
  assert.throws(() => migrateState(companion), /本地数据格式无效/);
});

test('同步日志拒绝删除会话/改绑定/已完成回退，不能用合法外形绕过历史', () => {
  const fixture = pair();
  const { a } = complete(
    fixture.a,
    fixture.b,
    fixture.mainId,
    fixture.companionId,
  );
  for (const change of [
    (draft: AppState) => {
      delete draft.tickets[0].companionUses;
    },
    (draft: AppState) => {
      draft.tickets[0].companionUses![0].companionName = '伪造伙伴';
    },
    (draft: AppState) => {
      draft.tickets[0].companionUses![0].stage = 'committed';
    },
  ]) {
    const draft = clone(a);
    change(draft);
    assert.throws(() => commitSync(a, migrateState(draft), clock('tamper')));
  }
});

test('联合提交保存失败不发布决定，重试幂等恢复，不提前消费对方副本', async () => {
  let { a, b, mainId, companionId } = pair();
  a = invite(a, b, mainId, companionId);
  b = pull(b, a);
  b = mutate(b, (draft) => acceptCompanionUse(draft, 'session-test-1', NOW));
  let disk = clone(a);
  let rejectSave = true;
  const store = createAppStore(
    {
      load: async () => clone(disk),
      save: async (state) => {
        if (rejectSave) throw new Error('测试保存失败');
        disk = clone(state);
      },
    },
    clock('store-clock'),
  );
  await store.initialize();
  assert.equal(
    (await store.applyGroupJournals(journalsForSend(b), LATER.toISOString()))
      .ok,
    false,
  );
  assert.equal(store.getSnapshot().state!.tickets[0].usedAt, null);
  assert.equal(disk.tickets[0].usedAt, null);
  rejectSave = false;
  assert.equal(
    (await store.applyGroupJournals(journalsForSend(b), LATER.toISOString()))
      .ok,
    true,
  );
  assert.equal(
    store.getSnapshot().state!.tickets[0].usedAt,
    LATER.toISOString(),
  );
  const reloaded = createAppStore(
    {
      load: async () => clone(disk),
      save: async (state) => {
        disk = clone(state);
      },
    },
    clock('reload-clock'),
  );
  await reloaded.initialize();
  const before = clone(reloaded.getSnapshot().state!.tickets);
  assert.equal(
    (await reloaded.applyGroupJournals(journalsForSend(b), LATER.toISOString()))
      .ok,
    true,
  );
  assert.deepEqual(reloaded.getSnapshot().state!.tickets, before);
});
