import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  checkIn,
  createInitialState,
  migrateState,
  redeemCompanionTicket,
  redeemTicket,
  updateTask,
} from '../src/domain/engine';
import { startCompanionUse } from '../src/domain/companion';
import {
  applyGroupJournals,
  createGroup,
  exportInvite,
  joinGroup,
  journalsForSend,
  leaveGroup,
} from '../src/domain/groupSync';
import { commitSync, initializeSync } from '../src/domain/syncModel';
import type {
  AppState,
  CompanionUse,
  PersistedAppState,
} from '../src/domain/types';
import {
  companionCandidates,
  companionStageLabel,
} from '../src/ui/companionUi';

const NOW = new Date('2026-10-23T04:00:00.000Z');
let sequence = 0;
const clock = { now: () => NOW, id: () => `ui-test-${++sequence}` };
function mutate(state: PersistedAppState, change: (draft: AppState) => void) {
  const draft = structuredClone(state);
  change(draft);
  return commitSync(state, migrateState(draft), clock);
}
function pair() {
  let a = initializeSync(createInitialState(NOW), clock);
  let b = initializeSync(createInitialState(NOW), clock);
  a = mutate(a, (draft) => {
    assert.equal(
      createGroup(draft, '界面测试组', {
        groupId: 'ui-companion',
        secret: 'ui-companion-secret',
      }).ok,
      true,
    );
  });
  b = mutate(b, (draft) => {
    assert.equal(joinGroup(draft, exportInvite(a)).ok, true);
  });
  const rewards = (state: PersistedAppState) =>
    mutate(state, (draft) => {
      assert.equal(updateTask(draft, 'task-1', { target: 4 }).ok, true);
      for (let n = 0; n < 4; n += 1)
        assert.equal(checkIn(draft, 'task-1', NOW).ok, true);
      assert.equal(redeemTicket(draft, NOW).ok, true);
      assert.equal(redeemCompanionTicket(draft, NOW).ok, true);
    });
  a = rewards(a);
  b = rewards(b);
  a = applyGroupJournals(a, journalsForSend(b), NOW.toISOString()).state;
  b = applyGroupJournals(b, journalsForSend(a), NOW.toISOString()).state;
  return { a, b };
}

test('同行候选只给出同组另一人的相反类型可用券，两端入口均成立且不变异', () => {
  const { a, b } = pair();
  const before = structuredClone(a);
  const main = a.tickets.find((ticket) => ticket.source !== 'companion')!;
  const companion = a.tickets.find((ticket) => ticket.source === 'companion')!;
  const fromMain = companionCandidates(a, main, NOW);
  assert.equal(fromMain.length, 1);
  assert.equal(fromMain[0].peer.accountId, b.sync.accountId);
  assert.equal(fromMain[0].ticket.source, 'companion');
  const fromCompanion = companionCandidates(a, companion, NOW);
  assert.equal(fromCompanion.length, 1);
  assert.notEqual(fromCompanion[0].ticket.source, 'companion');
  assert.deepEqual(a, before);
  assert.equal(
    companionCandidates({ ...a, groupLink: undefined }, main, NOW).length,
    0,
  );
  assert.equal(
    companionCandidates(a, { ...main, usedAt: NOW.toISOString() }, NOW).length,
    0,
  );
  assert.equal(
    companionCandidates(a, { ...main, expiresAt: NOW.toISOString() }, NOW)
      .length,
    0,
  );
});

test('已占用本机券与已离组伙伴不会再次出现在同行候选中', () => {
  let { a, b } = pair();
  const main = a.tickets.find((ticket) => ticket.source !== 'companion')!;
  const companion = b.tickets.find((ticket) => ticket.source === 'companion')!;
  a = mutate(a, (draft) => {
    assert.equal(
      startCompanionUse(
        draft,
        {
          ticketId: main.id,
          peerAccountId: b.sync.accountId,
          peerTicketId: companion.id,
        },
        NOW,
        'ui-invite',
      ).ok,
      true,
    );
  });
  assert.deepEqual(
    companionCandidates(
      a,
      a.tickets.find((ticket) => ticket.id === main.id)!,
      NOW,
    ),
    [],
  );
  b = mutate(b, (draft) => {
    assert.equal(leaveGroup(draft).ok, true);
  });
  a = applyGroupJournals(a, journalsForSend(b), NOW.toISOString()).state;
  const localCompanion = a.tickets.find(
    (ticket) => ticket.source === 'companion',
  )!;
  assert.deepEqual(companionCandidates(a, localCompanion, NOW), []);
});

test('同行状态文案区分待确认、已提交待核对和完成，完成优先于取消请求竞态', () => {
  const session = {
    stage: 'accepted',
    cancelRequestedAt: NOW.toISOString(),
  } as CompanionUse;
  assert.match(companionStageLabel(session), /取消.*待同步核对/);
  assert.equal(
    companionStageLabel({ ...session, stage: 'completed' }),
    '联合使用已完成',
  );
  assert.equal(
    companionStageLabel({ ...session, stage: 'cancelled' }),
    '已取消',
  );
  assert.match(
    companionStageLabel({ ...session, stage: 'committed' }),
    /主券已提交.*核对/,
  );
  assert.match(
    companionStageLabel({
      ...session,
      cancelRequestedAt: undefined,
      stage: 'committed',
    }),
    /主券已提交.*核对/,
  );
  assert.match(
    companionStageLabel({
      ...session,
      cancelRequestedAt: undefined,
      stage: 'requested',
    }),
    /等待伙伴批准/,
  );
});

test('同行界面声明：原生发送、本地保存后同步、200字草稿保护和双确认；非UI E2E', () => {
  const read = (name: string) =>
    readFileSync(new URL(`../src/ui/${name}`, import.meta.url), 'utf8');
  const dialog = read('CompanionUseDialog.tsx');
  assert.match(dialog, /Platform\.OS === 'web'/);
  assert.match(dialog, /submitting\.current/);
  assert.match(dialog, /discardDraft\(!!note \|\| !!choice/);
  assert.match(dialog, /maxLength=\{200\}/);
  assert.ok(dialog.indexOf('await run(') < dialog.indexOf('await syncGroup()'));
  assert.match(dialog, /if \(!result.ok\)/);
  assert.match(dialog, /ConfirmationDialog/);
  const invitations = read('CompanionInvitations.tsx');
  assert.match(invitations, /acceptCompanionUse\(draft, action.id\)/);
  assert.match(invitations, /cancelCompanionUse\(draft, action.id\)/);
  assert.match(invitations, /session.stage !== 'committed'/);
  assert.match(invitations, /actionLock\.current/);
  assert.match(invitations, /主券已提交且不能回滚/);
  assert.doesNotMatch(dialog + invitations, /consumeTicket\(/);
});
