import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createAppStore } from '../src/state/store';
import {
  addMilestoneGoal,
  ensureGiftProfile,
  type PersistedAppState,
} from '../src/domain/engine';
import { peerBoards } from '../src/domain/groupSync';
import { validateSync } from '../src/domain/syncModel';
import {
  appendRankingFixture,
  prepareFixtureGroup,
} from '../fixture/rankingFixture';
import { loadDemoHistory } from '../src/state/demoHistory';
import {
  createProtectionBaseline,
  prepareProtectionPeer,
  PROTECTION_PEER_ID,
} from '../peerProtection/preparePeer';

const now = new Date('2026-11-06T12:00:00+08:00');
async function setup() {
  let saved: PersistedAppState | null = null;
  let fail = false;
  let saves = 0;
  let id = 0;
  const repository = {
    load: async () => (saved ? structuredClone(saved) : null),
    save: async (state: PersistedAppState) => {
      if (fail) throw new Error('受控保存失败');
      saves += 1;
      saved = structuredClone(state);
    },
  };
  const clock = { now: () => now, id: () => 'protection-local-' + ++id };
  const store = createAppStore(repository, clock);
  await store.initialize();
  assert.equal((await store.run(prepareFixtureGroup)).ok, true);
  assert.equal(
    (await store.run((draft) => appendRankingFixture(draft, now))).ok,
    true,
  );
  assert.equal(
    (
      await store.run((draft) =>
        ensureGiftProfile(draft, {
          id: draft.sync!.accountId,
          name: '保留的本机资料',
        }),
      )
    ).ok,
    true,
  );
  assert.equal(
    (
      await store.run((draft) =>
        addMilestoneGoal(draft, {
          name: '已有目标',
          unit: '页',
          direction: 'increase',
          startWeight: 0,
          step: 10,
        }),
      )
    ).ok,
    true,
  );
  return {
    store,
    reload: () => createAppStore(repository, clock),
    get saves() {
      return saves;
    },
    setFail(value: boolean) {
      fail = value;
    },
  };
}

test('合法追加带券成员且保留既有全部业务与10名副本，重复拒绝，重载后原演示保留基线', async () => {
  const h = await setup();
  const before = structuredClone(h.store.getSnapshot().state!);
  const baseline = createProtectionBaseline();
  assert.equal(baseline.compare(before), null);
  assert.equal(baseline.capture(before), false);
  const saves = h.saves;
  assert.equal(
    (await h.store.run((draft) => prepareProtectionPeer(draft, now))).ok,
    true,
  );
  assert.equal(h.saves, saves + 1);
  const after = h.store.getSnapshot().state!;
  validateSync(after);
  assert.deepEqual({ ...after, groupPeers: before.groupPeers }, before);
  assert.deepEqual(after.groupPeers!.slice(0, 10), before.groupPeers);
  const peer = peerBoards(after).find(
    (entry) => entry.accountId === PROTECTION_PEER_ID,
  )!;
  assert.equal(peer.left, false);
  assert.equal(peer.app.giftState?.profile.name, '副本保护测试成员');
  assert.equal(
    peer.app.tasks.find((task) => task.id === 'task-1')?.name,
    '副本保护已有任务',
  );
  assert.equal(peer.app.checkins.length, 3);
  assert.equal(peer.app.tickets.length, 1);
  assert.equal(peer.app.redemptions.length, 1);
  assert.equal(peer.app.tickets[0].expiresAt, null);
  assert.equal(peer.app.tickets[0].usedAt, null);
  assert.equal(baseline.capture(after), true);
  assert.equal(baseline.capture(after), false);
  assert.equal(
    (await h.store.run((draft) => prepareProtectionPeer(draft, now))).ok,
    false,
  );
  assert.equal(h.saves, saves + 1);
  assert.deepEqual(h.store.getSnapshot().state, after);
  const reloaded = h.reload();
  await reloaded.initialize();
  assert.deepEqual(reloaded.getSnapshot().state, after);
  assert.equal(h.saves, saves + 1);
  assert.equal((await loadDemoHistory(reloaded, now)).ok, true);
  assert.deepEqual(baseline.compare(reloaded.getSnapshot().state!), {
    peers: true,
    local: true,
    group: true,
  });
  assert.deepEqual(reloaded.getSnapshot().state!.groupPeers, after.groupPeers);
  const completed = structuredClone(reloaded.getSnapshot().state!);
  assert.equal(createProtectionBaseline().capture(completed), false);
  const completedSaves = h.saves;
  assert.equal((await loadDemoHistory(reloaded, now)).ok, true);
  assert.equal(h.saves, completedSaves);
  assert.deepEqual(reloaded.getSnapshot().state, completed);
  const changed = structuredClone(completed);
  changed.checkins[0].date = '2026-11-05';
  assert.equal(baseline.compare(changed)!.local, false);
  changed.groupPeers = [];
  assert.equal(baseline.compare(changed)!.peers, false);
  const duplicate = structuredClone(completed);
  duplicate.checkins.push(structuredClone(duplicate.checkins[0]));
  assert.equal(baseline.compare(duplicate)!.local, false);
  const extraPeer = structuredClone(completed);
  extraPeer.groupPeers!.push(structuredClone(extraPeer.groupPeers![0]));
  assert.equal(baseline.compare(extraPeer)!.peers, false);
  assert.equal(createProtectionBaseline().compare(completed), null);
});

test('非法前置和第11名身份冲突均拒绝且无变异，保存失败原子回滚可重试', async () => {
  const h = await setup();
  const before = structuredClone(h.store.getSnapshot().state!);
  const variants = [
    (state: PersistedAppState) => {
      state.giftState = undefined;
    },
    (state: PersistedAppState) => {
      state.weight.startWeight = null;
    },
    (state: PersistedAppState) => {
      state.groupLink!.secret = '其他口令';
    },
    (state: PersistedAppState) => {
      state.groupOwned!.id = '其他组';
    },
    (state: PersistedAppState) => {
      state.pendingGroupDeparture = { ...state.groupLink! };
    },
    (state: PersistedAppState) => {
      state.groupLink!.name = '其他组';
    },
    (state: PersistedAppState) => {
      state.groupLink!.groupId = 'demo-group-0001';
    },
    (state: PersistedAppState) => {
      state.groupPeers!.pop();
    },
    (state: PersistedAppState) => {
      state.groupPeers![0].deviceId = '其他设备';
    },
    (state: PersistedAppState) => {
      state.groupPeers![0].accountId = PROTECTION_PEER_ID;
    },
  ];
  for (const mutate of variants) {
    const state = structuredClone(before);
    mutate(state);
    const raw = structuredClone(state);
    assert.equal(prepareProtectionPeer(state, now).ok, false);
    assert.deepEqual(state, raw);
  }
  assert.equal(
    prepareProtectionPeer(structuredClone(before), new Date('invalid')).ok,
    false,
  );
  const demoHarness = await setup();
  const demoStore = demoHarness.store;
  assert.equal((await loadDemoHistory(demoStore, now)).ok, true);
  const demoState = structuredClone(demoStore.getSnapshot().state!);
  const demoBefore = structuredClone(demoState);
  assert.equal(prepareProtectionPeer(demoState, now).ok, false);
  assert.deepEqual(demoState, demoBefore);
  const saves = h.saves;
  h.setFail(true);
  assert.match(
    (await h.store.run((draft) => prepareProtectionPeer(draft, now))).message,
    /受控保存失败/,
  );
  assert.equal(h.saves, saves);
  assert.deepEqual(h.store.getSnapshot().state, before);
  const reloaded = h.reload();
  await reloaded.initialize();
  assert.deepEqual(reloaded.getSnapshot().state, before);
  h.setFail(false);
  assert.equal(
    (await reloaded.run((draft) => prepareProtectionPeer(draft, now))).ok,
    true,
  );
  validateSync(reloaded.getSnapshot().state!);
});

test('专用原生入口仅显式确认追加，production禁LAN且普通fixture不开放预览', () => {
  const read = (path: string) =>
    readFileSync(new URL('../' + path, import.meta.url), 'utf8');
  const entry = read('peerProtection/index.tsx');
  assert.match(entry, /registerAcceptanceDemoPreview\(\)/);
  assert.match(entry, /<App lanEnabled=\{false\}>/);
  assert.match(entry, /useAndroidMountReady\(600\)/);
  assert.match(entry, /open \? \(?\s*<Modal/);
  assert.match(entry, /minHeight: 48/);
  assert.match(entry, /确认追加1名合法测试成员/);
  assert.doesNotMatch(entry, /useEffect|loadDemoHistory|AcceptanceApp/);
  assert.doesNotMatch(
    read('fixture/index.tsx'),
    /registerAcceptanceDemoPreview|peerProtection/,
  );
  assert.match(
    read('android/app/build.gradle'),
    /createBundlePeerProtectionJsAndAssets[\s\S]*?peerProtection\/index.tsx[\s\S]*?devEnabled.set\(false\)/,
  );
  assert.match(
    read('android/app/src/peerProtection/AndroidManifest.xml'),
    /allowBackup="false"/,
  );
});
