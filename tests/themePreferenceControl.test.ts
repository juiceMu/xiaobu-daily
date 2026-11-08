import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import ts from 'typescript';
import { installThemePreferenceControl } from '../acceptance/themePreferenceControl';
import { createThemePreferenceRepository } from '../src/state/themePreference';

function setup() {
  let raw: string | null = null;
  let reads = 0;
  let writes = 0;
  const repository = createThemePreferenceRepository({
    getItem: async () => {
      reads += 1;
      return raw;
    },
    setItem: async (_key, value) => {
      writes += 1;
      raw = value;
    },
  });
  const control = installThemePreferenceControl(repository);
  return { repository, control, reads: () => reads, writes: () => writes };
}

test('一次保存前失败不写入，重试恢复真实持久化；读取不消耗保存控制', async () => {
  const { repository, control, writes } = setup();
  assert.equal(control.arm('save-fail'), true);
  assert.equal(control.arm('load-fail'), false);
  await repository.load();
  assert.equal(control.getSnapshot().status, 'armed');
  await assert.rejects(repository.save('mint'), /验收注入/);
  assert.equal(writes(), 0);
  assert.equal(control.getSnapshot().hits, 1);
  await repository.save('mint');
  assert.equal(await repository.load(), 'mint');
  assert.equal(writes(), 1);
  assert.equal(control.getSnapshot().saveCalls, 2);
  assert.equal(control.getSnapshot().inFlight, 0);
});

for (const finish of ['release', 'cancel'] as const) {
  test(`等待期间不保存、拒绝并发待命；${finish}后真实保存一次`, async () => {
    const { repository, control, writes } = setup();
    control.arm('save-delay');
    const pending = repository.save('mint');
    assert.equal(writes(), 0);
    assert.equal(control.getSnapshot().waitingForRelease, true);
    assert.equal(control.getSnapshot().inFlight, 1);
    assert.equal(control.arm('save-fail'), false);
    assert.equal(control[finish](), true);
    assert.equal(control.release(), false);
    assert.equal(control.arm('save-fail'), false);
    await pending;
    assert.equal(writes(), 1);
    assert.equal(control.getSnapshot().status, 'completed');
    assert.equal(control.getSnapshot().inFlight, 0);
    assert.equal(control.arm('save-fail'), true);
  });
}

test('取消待命不命中；新实例不继承内存故障，快照无主题原文', async () => {
  const { repository, control, writes } = setup();
  assert.equal(control.cancel(), false);
  assert.equal(control.arm('save-fail'), true);
  assert.equal(control.cancel(), true);
  await repository.save('mint');
  assert.equal(writes(), 1);
  assert.equal(control.getSnapshot().hits, 0);
  const restarted = setup();
  assert.equal(restarted.control.getSnapshot().mode, null);
  await restarted.repository.save('mint');
  assert.equal(restarted.writes(), 1);
  assert.doesNotMatch(JSON.stringify(control.getSnapshot()), /mint/);
});

test('下一次读取前失败不调用真实读取或保存，随后读取正常', async () => {
  const { repository, control, reads, writes } = setup();
  control.arm('load-fail');
  await assert.rejects(repository.load(), /验收注入/);
  assert.equal(reads(), 0);
  assert.equal(writes(), 0);
  assert.equal(control.getSnapshot().saveCalls, 0);
  assert.equal(control.getSnapshot().status, 'failed');
  await repository.load();
  assert.equal(reads(), 1);
  assert.equal(writes(), 0);
  assert.equal(control.getSnapshot().loadCalls, 2);
});

test('真实读写异常保持对象与this；等待释放后异常可恢复', async () => {
  const error = new Error('原始介质错误');
  let fail = true;
  const repository = {
    async load() {
      assert.equal(this, repository);
      if (fail) throw error;
      return 'mint' as const;
    },
    async save() {
      assert.equal(this, repository);
      if (fail) throw error;
    },
  };
  const control = installThemePreferenceControl(repository);
  await assert.rejects(repository.load(), (actual) => actual === error);
  control.arm('save-delay');
  const pending = repository.save();
  control.release();
  await assert.rejects(pending, (actual) => actual === error);
  assert.equal(control.getSnapshot().status, 'failed');
  assert.equal(control.getSnapshot().inFlight, 0);
  fail = false;
  await repository.save();
  assert.equal(await repository.load(), 'mint');
});

test('普通接口在途同样拒绝待命，订阅可移除', async () => {
  let resolveLoad!: (value: 'mint') => void;
  const repository = {
    load: () =>
      new Promise<'mint'>((resolve) => {
        resolveLoad = resolve;
      }),
    save: async () => {},
  };
  const control = installThemePreferenceControl(repository);
  let notifications = 0;
  const unsubscribe = control.subscribe(() => {
    notifications += 1;
  });
  const pending = repository.load();
  assert.equal(control.arm('save-delay'), false);
  assert.equal(control.cancel(), false);
  assert.equal(notifications, 1);
  unsubscribe();
  resolveLoad('mint');
  await pending;
  assert.equal(notifications, 1);
  assert.equal(control.arm('save-fail'), true);
});

test('只有scenario依赖控制实现，其余入口类型引用不构成运行时依赖', () => {
  const root = resolve(import.meta.dirname, '..');
  const controlFile = resolve(root, 'acceptance/themePreferenceControl.ts');
  for (const entry of [
    'index.ts',
    'acceptance/index.tsx',
    'acceptance/fresh.tsx',
    'fixture/index.tsx',
    'acceptance/scenario.tsx',
  ]) {
    const pending = [resolve(root, entry)];
    const visited = new Set<string>();
    while (pending.length) {
      const file = pending.pop()!;
      if (visited.has(file)) continue;
      visited.add(file);
      const source = ts.createSourceFile(
        file,
        readFileSync(file, 'utf8'),
        ts.ScriptTarget.Latest,
        true,
      );
      for (const statement of source.statements) {
        if (
          !ts.isImportDeclaration(statement) ||
          statement.importClause?.isTypeOnly ||
          !ts.isStringLiteral(statement.moduleSpecifier)
        )
          continue;
        const name = statement.moduleSpecifier.text;
        if (!name.startsWith('.')) continue;
        const target = resolve(dirname(file), name);
        const dependency = [
          target,
          `${target}.ts`,
          `${target}.tsx`,
          `${target}.mjs`,
          resolve(target, 'index.ts'),
          resolve(target, 'index.tsx'),
        ].find(
          (candidate) => existsSync(candidate) && statSync(candidate).isFile(),
        );
        assert.ok(dependency, name);
        pending.push(dependency);
      }
    }
    assert.equal(
      visited.has(controlFile),
      entry === 'acceptance/scenario.tsx',
      entry,
    );
  }
  const panel = readFileSync(
    resolve(root, 'acceptance/AcceptanceApp.tsx'),
    'utf8',
  );
  assert.equal((panel.match(/<Modal\b/g) ?? []).length, 1);
  assert.doesNotMatch(panel, /<App\s+key=/);
});

test('待命及处理中即使旧隐藏回调执行也不会丢失释放入口', async () => {
  const panel = readFileSync(
    new URL('../acceptance/AcceptanceApp.tsx', import.meta.url),
    'utf8',
  );
  const source = ts.createSourceFile(
    'panel.tsx',
    panel,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  let callback: ts.JsxExpression | undefined;
  function visit(node: ts.Node) {
    if (
      ts.isJsxSelfClosingElement(node) &&
      node.attributes.properties.some(
        (attribute) =>
          ts.isJsxAttribute(attribute) &&
          attribute.name.getText(source) === 'title' &&
          attribute.initializer &&
          ts.isStringLiteral(attribute.initializer) &&
          attribute.initializer.text === '隐藏控制按钮（重启恢复）',
      )
    ) {
      const attribute = node.attributes.properties.find(
        (attribute) =>
          ts.isJsxAttribute(attribute) &&
          attribute.name.getText(source) === 'onPress',
      );
      if (
        attribute &&
        ts.isJsxAttribute(attribute) &&
        attribute.initializer &&
        ts.isJsxExpression(attribute.initializer)
      )
        callback = attribute.initializer;
      assert.ok(
        node.attributes.properties.some(
          (attribute) =>
            ts.isJsxAttribute(attribute) &&
            attribute.name.getText(source) === 'disabled',
        ),
      );
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(callback?.expression);
  const script = ts.transpileModule(
    `const onPress = ${callback.expression.getText(source)};`,
    { compilerOptions: { target: ts.ScriptTarget.ES2022 } },
  ).outputText;
  const { repository, control } = setup();
  const updates: boolean[] = [];
  const hide = new Function(
    'themePreferenceControl',
    'setVisible',
    'setOpen',
    `${script}; return onPress;`,
  )(
    control,
    (value: boolean) => updates.push(value),
    (value: boolean) => updates.push(value),
  ) as () => void;
  control.arm('save-delay');
  hide();
  assert.deepEqual(updates, []);
  const pending = repository.save('mint');
  hide();
  assert.deepEqual(updates, []);
  control.release();
  hide();
  assert.deepEqual(updates, []);
  await pending;
  hide();
  assert.deepEqual(updates, [false, false]);
});
