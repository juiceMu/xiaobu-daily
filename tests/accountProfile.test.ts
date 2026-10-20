import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import {
  createInitialState,
  ensureGiftProfile,
  updateLocalProfile,
  migrateState,
  createGift,
  receiveGift,
  exportGift,
  exportGiftReceipt,
} from '../src/domain/engine';
import {
  validProfileAvatar,
  MAX_AVATAR_BYTES,
} from '../src/domain/profileAvatar.mjs';
import { createAppStore } from '../src/state/store';
import {
  initializeSync,
  commitSync,
  getSyncBatch,
} from '../src/domain/syncModel';
import type { AppState, ProfileAvatar } from '../src/domain/types';

// Pillow实际编码的8×8 JPEG，测试文件头、像素上限与重载，不使用伪造图片。
const JPEG =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAAIAAgDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDYooorE8s//9k=';
const image: ProfileAvatar = {
  kind: 'image',
  dataUri: `data:image/jpeg;base64,${JPEG}`,
};
const preset: ProfileAvatar = { kind: 'preset', id: 'sun' };
const now = new Date(2026, 9, 20, 12);
const clone = <T>(value: T): T => structuredClone(value);

test('账户沿用旧赠券身份，旧无头像档案不补写，昵称更新保留头像且ID不可替换', () => {
  const state = createInitialState(now);
  assert.deepEqual(migrateState(state), state);
  assert.equal(
    ensureGiftProfile(state, { id: 'account-12345', name: '旧称呼' }).ok,
    true,
  );
  assert.equal(migrateState(state).giftState?.profile.avatar, undefined);
  assert.equal(
    updateLocalProfile(state, {
      id: 'account-12345',
      name: '新昵称',
      avatar: preset,
    }).ok,
    true,
  );
  const before = clone(state);
  assert.equal(
    updateLocalProfile(state, {
      id: 'different-12345',
      name: '错误',
      avatar: image,
    }).ok,
    false,
  );
  assert.deepEqual(state, before);
  assert.equal(
    ensureGiftProfile(state, { id: 'account-12345', name: '再修改' }).ok,
    true,
  );
  assert.deepEqual(state.giftState?.profile.avatar, preset);
  assert.deepEqual(migrateState(state), state);
});

test('头像仅允许白名单预设或受限JPEG，拒绝临时远程SVG伪格式超大尺寸与损坏base64', () => {
  assert.equal(validProfileAvatar(image), true);
  for (const id of ['sprout', 'sun', 'moon', 'flower'])
    assert.equal(validProfileAvatar({ kind: 'preset', id }), true);
  const large = Buffer.from(JPEG, 'base64');
  const frame = large.indexOf(Buffer.from([255, 192]));
  assert.ok(frame > 0);
  large.writeUInt16BE(513, frame + 5);
  for (const avatar of [
    null,
    {},
    { kind: 'preset', id: 'unknown' },
    { kind: 'preset', id: 'sun', uri: 'x' },
    { kind: 'image', dataUri: 'https://example.test/a.jpg' },
    { kind: 'image', dataUri: 'file:///cache/photo.jpg' },
    { kind: 'image', dataUri: 'data:image/svg+xml;base64,PHN2Zy8+' },
    { kind: 'image', dataUri: 'data:image/jpeg;base64,YWJj' },
    { kind: 'image', dataUri: 'data:image/jpeg;base64,/9j/2Q==' },
    {
      kind: 'image',
      dataUri: `data:image/jpeg;base64,${'A'.repeat(Math.ceil(MAX_AVATAR_BYTES / 3) * 4 + 4)}`,
    },
    {
      kind: 'image',
      dataUri: `data:image/jpeg;base64,${large.toString('base64')}`,
    },
    { ...image, extra: true },
  ])
    assert.equal(
      validProfileAvatar(avatar),
      false,
      JSON.stringify(avatar).slice(0, 120),
    );
  const state = createInitialState(now);
  for (const avatar of [null, { kind: 'preset', id: 'wrong' }]) {
    const before = clone(state);
    assert.equal(
      updateLocalProfile(state, {
        id: 'account-12345',
        name: '昵称',
        avatar,
      } as never).ok,
      false,
    );
    assert.deepEqual(state, before);
  }
});

test('头像及昵称成功持久化后重载完整，损坏头像档案拒绝而不静默重置', async () => {
  const initial = createInitialState(now);
  ensureGiftProfile(initial, { id: 'account-12345', name: '原昵称' });
  let saved: AppState = initializeSync(initial);
  const repo = {
    load: async () => clone(saved),
    save: async (next: AppState) => {
      saved = clone(next);
    },
  };
  const store = createAppStore(repo);
  await store.initialize();
  assert.equal(
    (
      await store.run((state) =>
        updateLocalProfile(state, {
          id: 'account-12345',
          name: '我的称呼',
          avatar: image,
        }),
      )
    ).ok,
    true,
  );
  const reload = createAppStore(repo);
  await reload.initialize();
  assert.deepEqual(reload.getSnapshot().state?.giftState?.profile, {
    id: 'account-12345',
    name: '我的称呼',
    avatar: image,
  });
  const before = clone(saved);
  (saved.giftState!.profile as unknown as { avatar: unknown }).avatar = {
    kind: 'image',
    dataUri: 'file:///temporary.jpg',
  };
  assert.throws(() => migrateState(saved));
  const broken = createAppStore(repo);
  await broken.initialize();
  assert.equal(broken.getSnapshot().state, null);
  assert.ok(broken.getSnapshot().error);
  assert.notDeepEqual(saved, before);
});

test('保存失败不发布头像或昵称，重试成功再更新，同步上锁阻止并发', async () => {
  const business = createInitialState(now);
  ensureGiftProfile(business, { id: 'account-12345', name: '原昵称' });
  const initial = initializeSync(business);
  let saved = clone(initial),
    fail = true;
  const draft = { id: 'account-12345', name: '待保存昵称', avatar: image };
  const store = createAppStore({
    load: async () => clone(saved),
    save: async (next) => {
      if (fail) throw new Error('磁盘已满');
      saved = clone(next);
    },
  });
  await store.initialize();
  const before = store.getSnapshot().state;
  assert.equal(
    (await store.run((state) => updateLocalProfile(state, draft))).ok,
    false,
  );
  assert.equal(store.getSnapshot().state, before);
  assert.deepEqual(saved, initial);
  assert.equal(draft.name, '待保存昵称');
  assert.deepEqual(draft.avatar, image);
  fail = false;
  const saving = store.run((state) => updateLocalProfile(state, draft));
  assert.equal(
    (
      await store.run((state) =>
        updateLocalProfile(state, { ...draft, name: '并发写' }),
      )
    ).ok,
    false,
  );
  assert.equal((await saving).ok, true);
  assert.equal(saved.giftState?.profile.name, '待保存昵称');
});

test('改昵称不改历史券和回执快照，头像不进入新旧赠券与回执payload', () => {
  const sender = createInitialState(now),
    recipient = createInitialState(now);
  updateLocalProfile(sender, {
    id: 'sender-12345',
    name: '旧昵称',
    avatar: image,
  });
  updateLocalProfile(recipient, {
    id: 'receiver-12345',
    name: '收券人',
    avatar: image,
  });
  const first = createGift(
    sender,
    { name: '甜点券', validity: 'permanent' },
    { giftId: 'gift-123456', ticketId: 'ticket-123456' },
    now,
  ).gift!;
  const received = receiveGift(recipient, first, now);
  assert.ok(received.receipt);
  const oldReceipt = clone(received.receipt);
  updateLocalProfile(sender, {
    id: 'sender-12345',
    name: '新昵称',
    avatar: preset,
  });
  updateLocalProfile(recipient, {
    id: 'receiver-12345',
    name: '新收券人',
    avatar: preset,
  });
  const next = createGift(
    sender,
    { name: '奶茶券', validity: 'permanent' },
    { giftId: 'gift-234567', ticketId: 'ticket-234567' },
    now,
  ).gift!;
  assert.deepEqual(first.issuer, { id: 'sender-12345', name: '旧昵称' });
  assert.equal(next.issuer.name, '新昵称');
  assert.equal(recipient.tickets[0].senderName, '旧昵称');
  assert.deepEqual(received.receipt, oldReceipt);
  for (const payload of [
    exportGift(first),
    exportGift(next),
    exportGiftReceipt(oldReceipt),
  ])
    assert.doesNotMatch(payload, /avatar|dataUri|base64/);
  const contaminated = clone(oldReceipt) as unknown as {
    recipient: Record<string, unknown>;
    gift: { issuer: Record<string, unknown> };
  };
  contaminated.recipient.avatar = image;
  contaminated.gift.issuer.avatar = image;
  assert.doesNotMatch(
    exportGiftReceipt(contaminated as never),
    /avatar|base64/,
  );
  assert.deepEqual(migrateState(sender), sender);
  assert.deepEqual(migrateState(recipient), recipient);
});

test('账户UI仅用系统相册并保留取消和失败草稿，不在聚焦主题刷新时重置；统一资料导航', () => {
  const screen = readFileSync(
    new URL('../src/screens/AccountScreen.tsx', import.meta.url),
    'utf8',
  );
  const gifts = readFileSync(
    new URL('../src/screens/GiftsScreen.tsx', import.meta.url),
    'utf8',
  );
  const more = readFileSync(
    new URL('../src/screens/MoreScreens.tsx', import.meta.url),
    'utf8',
  );
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  assert.match(screen, /launchImageLibraryAsync/);
  assert.ok(screen.includes("mediaTypes: ['images']"));
  assert.doesNotMatch(
    screen,
    /launchCameraAsync|requestMediaLibraryPermissions|requestCameraPermissions|useFocusEffect/,
  );
  assert.ok(
    screen.indexOf('if (result.canceled) return') <
      screen.indexOf('setAvatar(next)'),
  );
  assert.ok(screen.includes('usePreventRemove(dirty || busy || picking'));
  assert.ok(screen.includes('if (result.ok) {'));
  assert.ok(screen.includes('setName(name.trim())'));
  assert.match(screen, /format: SaveFormat.JPEG/);
  assert.match(screen, /base64: true/);
  assert.match(screen, /accessibilityRole="radio"/);
  assert.doesNotMatch(screen, /check-mark|check-circle/);
  assert.ok(more.includes("onNavigate('account')"));
  assert.match(app, /account: 'account'/);
  assert.ok(app.includes('component={AccountScreen}'));
  assert.ok(gifts.includes("navigation.navigate('account')"));
  assert.doesNotMatch(gifts, /ensureGiftProfile|setName/);
});

test('同步操作头像只含附件ref，未确认旧头像快照仍可读取且每份图片仅一个上传附件', () => {
  const state = initializeSync(createInitialState(now));
  const draft = clone(state);
  updateLocalProfile(draft, {
    id: state.sync.accountId,
    name: '昵称',
    avatar: image,
  });
  const next = commitSync(state, draft);
  const before = getSyncBatch(next, next.sync.accountId);
  assert.equal(Object.keys(before.attachments).length, 1);
  assert.equal(
    Object.values(before.attachments)[0],
    image.kind === 'image' ? image.dataUri : '',
  );
  assert.doesNotMatch(JSON.stringify(before.transactions), /base64|data:image/);
  const edited = clone(next);
  updateLocalProfile(edited, {
    id: next.sync.accountId,
    name: '新昵称',
    avatar: preset,
  });
  const changed = commitSync(next, edited);
  const batch = getSyncBatch(changed, changed.sync.accountId);
  assert.equal(Object.keys(batch.attachments).length, 1);
  assert.deepEqual(
    batch.transactions.slice(0, before.transactions.length),
    before.transactions,
  );
  const sameImage = clone(changed);
  updateLocalProfile(sameImage, {
    id: changed.sync.accountId,
    name: '第三昵称',
    avatar: image,
  });
  const deduplicated = commitSync(changed, sameImage);
  assert.equal(Object.keys(deduplicated.sync.attachments).length, 1);
});

test('实际选图回调取消失败超限均保留草稿，成功只保存data URI并释放临时资源', async () => {
  const source = readFileSync(
    new URL('../src/screens/AccountScreen.tsx', import.meta.url),
    'utf8',
  );
  const parsed = ts.createSourceFile(
    'AccountScreen.tsx',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  let callback: ts.FunctionDeclaration | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === 'pickAvatar')
      callback = node;
    ts.forEachChild(node, visit);
  };
  visit(parsed);
  assert.ok(callback);
  const compiled = ts.transpile(callback.getText(parsed), {
    target: ts.ScriptTarget.ES2022,
  });
  for (const scenario of [
    'cancel',
    'reject',
    'large',
    'render-fail',
    'oversize-output',
    'success',
  ]) {
    let selected: ProfileAvatar = preset;
    let setCount = 0,
      picking = false,
      error = '',
      released = 0;
    const revoked: string[] = [];
    const pickingRef = { current: false };
    const context = {
      crop: () => context,
      resize: () => context,
      release: () => {
        released++;
      },
      renderAsync: async () => {
        if (scenario === 'render-fail') throw new Error('解码失败');
        return {
          uri: 'blob:rendered',
          release: () => {
            released++;
          },
          saveAsync: async () => ({
            uri: 'blob:output',
            base64: scenario === 'oversize-output' ? 'A'.repeat(300000) : JPEG,
          }),
        };
      },
    };
    const deps = {
      busy: false,
      pickingRef,
      setPicking: (next: boolean) => {
        picking = next;
      },
      setError: (next: string) => {
        error = next;
      },
      setAvatar: (next: ProfileAvatar) => {
        selected = next;
        setCount++;
      },
      setSaved: () => {},
      Platform: { OS: 'web' },
      URL: { revokeObjectURL: (uri: string) => revoked.push(uri) },
      SaveFormat: { JPEG: 'jpeg' },
      ImageManipulator: { manipulate: () => context },
      validProfileAvatar,
      ImagePicker: {
        launchImageLibraryAsync: async () => {
          if (scenario === 'reject') throw new Error('选择失败');
          if (scenario === 'cancel') return { canceled: true };
          return {
            canceled: false,
            assets: [
              {
                uri: 'blob:selected',
                mimeType: 'image/jpeg',
                width: 800,
                height: 600,
                fileSize: scenario === 'large' ? 11 * 1024 * 1024 : 1024,
              },
            ],
          };
        },
      },
    };
    const execute = new Function(
      'deps',
      `with (deps) { ${compiled}; return pickAvatar; }`,
    )(deps) as () => Promise<void>;
    await execute();
    assert.equal(picking, false, scenario);
    assert.equal(pickingRef.current, false, scenario);
    if (scenario === 'success') {
      assert.deepEqual(selected, image);
      assert.equal(setCount, 1);
      assert.equal(released, 2);
      assert.deepEqual(revoked, [
        'blob:selected',
        'blob:rendered',
        'blob:output',
      ]);
      assert.equal(error, '');
    } else {
      assert.deepEqual(selected, preset, scenario);
      assert.equal(setCount, 0, scenario);
      assert.equal(!!error, scenario !== 'cancel', scenario);
    }
    // 回调根本不包含setName，取消和失败都不能覆盖昵称草稿。
    assert.doesNotMatch(compiled, /setName/);
  }
});
