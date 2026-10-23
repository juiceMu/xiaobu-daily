import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import {
  checkIn,
  createInitialState,
  ensureGiftProfile,
  migrateState,
} from '../src/domain/engine';
import {
  exportAccountJournal,
  initializeSync,
  journalState,
  validateSync,
  type SyncClock,
} from '../src/domain/syncModel';
import {
  applyGroupJournals,
  createGroup,
  exportInvite,
  joinGroup,
  leaveGroup,
  journalsForSend,
  peerBoards,
  renameGroup,
} from '../src/domain/groupSync';
import { hmacHex } from '../src/domain/hmac';
import type { AppState, PersistedAppState } from '../src/domain/types';
import { commitSync } from '../src/domain/syncModel';

const NOW = new Date('2026-10-20T12:00:00.000Z');
const clone = <T>(value: T): T => structuredClone(value);
function clock(prefix: string): SyncClock {
  let sequence = 0;
  return {
    now: () => NOW,
    id: () => `${prefix}-${String(++sequence).padStart(4, '0')}`,
  };
}
function saved(prefix: string) {
  return initializeSync(createInitialState(NOW), clock(prefix));
}
function change(
  state: PersistedAppState,
  mutation: (draft: AppState) => unknown,
  provider: SyncClock = clock('tick'),
) {
  const draft = clone(state);
  mutation(draft);
  return commitSync(state, migrateState(draft), provider);
}

test('口令摘要与标准 HMAC 一致', () => {
  const secret = 'group-secret-1';
  const message = 'group-id-0001\naccount-a-0001\nnonce-1';
  assert.equal(
    hmacHex(secret, message),
    createHmac('sha256', secret).update(message).digest('hex'),
  );
});

test('创建小组只增加自己的小组和成员事务，加入不交换记录', () => {
  let owner = saved('owner');
  owner = change(owner, (draft) =>
    createGroup(draft, '我们家', {
      groupId: 'group-id-0001',
      secret: 'group-secret-1',
    }),
  );
  validateSync(owner);
  assert.equal(owner.groupOwned?.name, '我们家');
  assert.ok(owner.sync.entities['groups:group-id-0001']);
  assert.ok(
    owner.sync.entities[`memberships:group-id-0001/${owner.sync.accountId}`],
  );
  assert.equal(
    JSON.parse(owner.sync.entities['groups:group-id-0001'].payload).secret,
    undefined,
  );
  const round = journalState(exportAccountJournal(owner));
  assert.equal(round.sync.accountId, owner.sync.accountId);
  assert.equal(round.tasks.length, owner.tasks.length);
  let member = saved('member');
  member = change(member, (draft) => joinGroup(draft, exportInvite(owner)));
  assert.equal(member.groupOwned, undefined);
  assert.equal(member.groupPeers, undefined);
  assert.equal(member.tasks.length, 2);
  assert.equal(
    member.sync.outbox.some((op) => op.entity.entityType === 'groups'),
    false,
  );
});

test('同步写入只读副本，不进入自己的待发队列，分叉保留原副本', () => {
  let owner = saved('ownerb');
  owner = change(owner, (draft) => {
    ensureGiftProfile(draft, { id: draft.sync!.accountId, name: '小林' });
  });
  owner = change(owner, (draft) =>
    createGroup(draft, '我们家', {
      groupId: 'group-id-0002',
      secret: 'group-secret-2',
    }),
  );
  owner = change(owner, (draft) => checkIn(draft, 'task-1', NOW));
  let member = saved('memberb');
  member = change(member, (draft) => joinGroup(draft, exportInvite(owner)));
  const before = clone(member);
  const syncedAt = '2026-10-21T01:00:00.000Z';
  const applied = applyGroupJournals(member, journalsForSend(owner), syncedAt);
  validateSync(applied.state);
  assert.equal(applied.state.sync.outbox.length, member.sync.outbox.length);
  assert.equal(applied.state.tasks.length, member.tasks.length);
  const peer = applied.state.groupPeers?.[0];
  assert.ok(peer);
  assert.equal(peer?.syncedAt, syncedAt);
  const remote = journalState(peer!);
  assert.equal(remote.giftState?.profile.name, '小林');
  const memberWithPeer = { ...member, groupPeers: [peer!] };
  const sent = journalsForSend(memberWithPeer);
  assert.equal(sent.length, 2);
  assert.equal(sent[0].accountId, member.sync.accountId);
  assert.equal(sent[1].accountId, owner.sync.accountId);
  assert.equal(
    remote.checkins.filter((entry) => entry.taskId === 'task-1').length,
    1,
  );
  const forked = clone(journalsForSend(owner)[0]);
  forked.operations[0] = clone(forked.operations[0]);
  forked.operations[0].entity = clone(forked.operations[0].entity);
  forked.operations[0].entity.payload =
    forked.operations[0].entity.payload.replace('早睡', '晚睡');
  const kept = applyGroupJournals(applied.state, [forked], syncedAt);
  assert.equal(
    kept.state.groupPeers?.[0].operations[0].entity.payload.includes('早睡'),
    true,
  );
  assert.match(kept.message, /无法合并/);
  assert.equal(before.groupPeers, undefined);
});

test('离开小组后不再保留别人的副本，自己的账还在', () => {
  let owner = saved('ownerc');
  owner = change(owner, (draft) =>
    createGroup(draft, '我们家', {
      groupId: 'group-id-0003',
      secret: 'group-secret-3',
    }),
  );
  let member = saved('memberc');
  member = change(member, (draft) => joinGroup(draft, exportInvite(owner)));
  const applied = applyGroupJournals(
    member,
    journalsForSend(owner),
    '2026-10-21T02:00:00.000Z',
  );
  const left = change(applied.state, (draft) => leaveGroup(draft));
  assert.equal(left.groupLink, undefined);
  assert.equal(left.groupPeers, undefined);
  assert.deepEqual(left.pendingGroupDeparture, applied.state.groupLink);
  assert.equal(left.tasks.length, 2);
  assert.equal(
    left.sync.entities[`memberships:group-id-0003/${left.sync.accountId}`]
      .deletedAt === null,
    false,
  );
  const rejoined = joinGroup(left, exportInvite(owner));
  assert.equal(rejoined.ok, false);
});

test('离开通知保留可重试凭据，只发送本人墓碑且不夹带其他成员日志', () => {
  let owner = change(saved('depart-owner'), (draft) =>
    createGroup(draft, '离组测试', {
      groupId: 'departure-group',
      secret: 'departure-secret',
    }),
  );
  let member = change(saved('depart-member'), (draft) =>
    joinGroup(draft, exportInvite(owner)),
  );
  let observer = change(saved('depart-observer'), (draft) =>
    joinGroup(draft, exportInvite(owner)),
  );
  owner = applyGroupJournals(
    owner,
    journalsForSend(member),
    NOW.toISOString(),
  ).state;
  member = applyGroupJournals(
    member,
    journalsForSend(owner),
    NOW.toISOString(),
  ).state;
  const before = clone(member);
  const left = change(member, leaveGroup);
  const reloaded = migrateState(clone(left));
  validateSync(reloaded);
  const journals = journalsForSend(reloaded);
  assert.equal(journals.length, 1);
  assert.equal(journals[0].accountId, member.sync.accountId);
  assert.equal(left.tasks.length, before.tasks.length);
  assert.deepEqual(left.tickets, before.tickets);
  assert.deepEqual(journalsForSend(left), journals);
  owner = applyGroupJournals(owner, journals, NOW.toISOString()).state;
  assert.equal(peerBoards(owner)[0].left, true);
  assert.equal(
    peerBoards(observer).some(
      (peer) => peer.accountId === member.sync.accountId,
    ),
    false,
  );
  assert.deepEqual(left.pendingGroupDeparture, before.groupLink);
  assert.equal(
    createGroup(clone(left), '新小组', {
      groupId: 'next-group-0001',
      secret: 'next-secret-0001',
    }).ok,
    false,
  );
});

test('离组凭据拒绝同时入组、缺少墓碑、错误小组和额外字段', () => {
  const owner = change(saved('pending-owner'), (draft) =>
    createGroup(draft, '凭据校验', {
      groupId: 'pending-group',
      secret: 'pending-secret',
    }),
  );
  const left = change(owner, leaveGroup);
  const variants: AppState[] = [];
  variants.push({
    ...clone(owner),
    pendingGroupDeparture: clone(owner.groupLink!),
  });
  variants.push({
    ...clone(left),
    pendingGroupDeparture: {
      ...left.pendingGroupDeparture!,
      groupId: 'wrong-group-0001',
    },
  });
  variants.push({
    ...clone(owner),
    groupLink: undefined,
    pendingGroupDeparture: clone(owner.groupLink!),
  });
  variants.push({
    ...clone(left),
    pendingGroupDeparture: { ...left.pendingGroupDeparture!, extra: true },
  } as AppState);
  for (const variant of variants) assert.throws(() => validateSync(variant));
});

test('较短、相同和任意顺序的创建者日志均保留最新组名和记录', () => {
  let owner = change(saved('name-owner'), (draft) =>
    createGroup(draft, '旧组名', {
      groupId: 'rename-group',
      secret: 'rename-secret',
    }),
  );
  const member = change(saved('name-member'), (draft) =>
    joinGroup(draft, exportInvite(owner)),
  );
  const oldJournal = journalsForSend(owner)[0];
  owner = change(owner, (draft) => renameGroup(draft, '新组名'));
  const newJournal = journalsForSend(owner)[0];
  const latest = applyGroupJournals(
    member,
    [newJournal],
    NOW.toISOString(),
  ).state;
  assert.equal(member.groupLink?.ownerAccountId, owner.sync.accountId);
  for (const journals of [
    [oldJournal],
    [newJournal],
    [oldJournal, newJournal],
    [newJournal, oldJournal],
  ]) {
    const result = applyGroupJournals(
      latest,
      journals,
      NOW.toISOString(),
    ).state;
    assert.equal(result.groupLink?.name, '新组名');
    assert.deepEqual(result.groupPeers?.[0].operations, newJournal.operations);
    assert.deepEqual(result.sync, latest.sync);
  }
  for (const journals of [
    [oldJournal, newJournal],
    [newJournal, oldJournal],
  ]) {
    const result = applyGroupJournals(
      member,
      journals,
      NOW.toISOString(),
    ).state;
    assert.equal(result.groupLink?.name, '新组名');
    assert.deepEqual(result.groupPeers?.[0].operations, newJournal.operations);
  }
  const impostor = change(saved('name-impostor'), (draft) =>
    createGroup(draft, '伪造名称', {
      groupId: 'rename-group',
      secret: 'rename-secret',
    }),
  );
  const withImpostor = applyGroupJournals(
    latest,
    [journalsForSend(impostor)[0]],
    NOW.toISOString(),
  ).state;
  assert.equal(withImpostor.groupLink?.name, '新组名');
  assert.equal(withImpostor.groupLink?.ownerAccountId, owner.sync.accountId);
});
