import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { copyCode } from '../src/ui/copyCode';

test('复制保留完整原码且等待写入，仅true表示成功，空值不调用系统', async () => {
  const value = ' {"name":"测试券","code":"synthetic-copy-value"} ';
  let finish!: (result: boolean) => void;
  const written: string[] = [];
  let settled = false;
  const copying = copyCode(value, (text) => {
    written.push(text);
    return new Promise<boolean>((resolve) => {
      finish = resolve;
    });
  }).then((result) => {
    settled = true;
    return result;
  });
  await Promise.resolve();
  assert.deepEqual(written, [value]);
  assert.equal(settled, false);
  finish(true);
  assert.equal(await copying, true);
  assert.equal(
    await copyCode('  ', async () => {
      throw new Error('不应写入');
    }),
    false,
  );
});

test('系统返回false或抛异常均失败，不把原错误及凭证带入反馈', async () => {
  assert.equal(await copyCode('synthetic-code', async () => false), false);
  assert.equal(
    await copyCode('synthetic-code', async () => {
      throw new Error('synthetic-secret');
    }),
    false,
  );
});

// 抽取真实点击回调，以系统API与React状态替身检查重复点击和反馈；不是挂载UI测试。
function copyHarness() {
  const source = ts.createSourceFile(
    'CopyCodeButton.tsx',
    readFileSync(
      new URL('../src/ui/CopyCodeButton.tsx', import.meta.url),
      'utf8',
    ),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const component = source.statements.find(
    (node): node is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(node) && node.name?.text === 'CopyCodeAction',
  );
  const callback = component?.body?.statements.find(
    (node): node is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(node) && node.name?.text === 'handleCopy',
  );
  assert.ok(callback);
  const effect = component?.body?.statements.find(
    (node): node is ts.ExpressionStatement =>
      ts.isExpressionStatement(node) &&
      ts.isCallExpression(node.expression) &&
      node.expression.expression.getText(source) === 'useEffect',
  );
  assert.ok(effect && ts.isCallExpression(effect.expression));
  const updates: { copying: boolean; message: string; failed: boolean } = {
    copying: false,
    message: '',
    failed: false,
  };
  const pendingRef = { current: false };
  const requestRef = { current: 0 };
  let writes = 0;
  let finish!: (value: boolean) => void;
  const Clipboard = {
    setStringAsync: async () => {
      writes += 1;
      return new Promise<boolean>((resolve) => {
        finish = resolve;
      });
    },
  };
  const { handleCopy, effect: setup } = new Function(
    'pendingRef',
    'requestRef',
    'setCopying',
    'setMessage',
    'setFailed',
    'copyCode',
    'value',
    'label',
    'Clipboard',
    ts.transpileModule(
      `${callback.getText(source)}; return { handleCopy, effect: ${effect.expression.arguments[0].getText(source)} };`,
      {
        compilerOptions: { target: ts.ScriptTarget.ES2022 },
      },
    ).outputText,
  )(
    pendingRef,
    requestRef,
    (value: boolean) => {
      updates.copying = value;
    },
    (value: string) => {
      updates.message = value;
    },
    (value: boolean) => {
      updates.failed = value;
    },
    copyCode,
    'synthetic-private-code',
    '券码',
    Clipboard,
  ) as { handleCopy: () => Promise<void>; effect: () => () => void };
  const cleanup = setup();
  return {
    handleCopy,
    updates,
    cleanup,
    finish: (value: boolean) => finish(value),
    writes: () => writes,
  };
}

test('复制中即时禁重复，完成后才报告成功，失败可重试且反馈不含原码', async () => {
  const h = copyHarness();
  const first = h.handleCopy();
  assert.equal(h.updates.copying, true);
  await h.handleCopy();
  assert.equal(h.writes(), 1);
  assert.equal(h.updates.message, '');
  h.finish(false);
  await first;
  assert.equal(h.updates.failed, true);
  assert.equal(h.updates.copying, false);
  assert.match(h.updates.message, /未能复制券码.*重试.*二维码/);
  const retry = h.handleCopy();
  assert.equal(h.writes(), 2);
  h.finish(true);
  await retry;
  assert.equal(h.updates.failed, false);
  assert.equal(h.updates.message, '券码已复制，可以粘贴发送。');
  assert.equal(h.updates.copying, false);
  assert.doesNotMatch(h.updates.message, /synthetic-private-code/);
});

test('卸载执行真实effect清理后，迟到复制结果不再发布反馈', async () => {
  const h = copyHarness();
  const pending = h.handleCopy();
  h.cleanup();
  h.updates.message = '新界面反馈';
  h.finish(true);
  await pending;
  assert.equal(h.updates.message, '新界面反馈');
});

test('凭证key变更重建局部状态，旧请求不能结束新复制或覆盖新反馈', async () => {
  const source = readFileSync(
    new URL('../src/ui/CopyCodeButton.tsx', import.meta.url),
    'utf8',
  );
  assert.match(
    source,
    /<CopyCodeAction key=\{value\} value=\{value\} label=\{label\} \/>/,
  );
  const old = copyHarness();
  const previous = old.handleCopy();
  old.cleanup();
  const current = copyHarness();
  assert.deepEqual(current.updates, {
    copying: false,
    message: '',
    failed: false,
  });
  const pending = current.handleCopy();
  old.finish(true);
  await previous;
  assert.equal(current.updates.copying, true);
  assert.equal(current.updates.message, '');
  current.finish(true);
  await pending;
  assert.equal(current.updates.copying, false);
  assert.equal(current.updates.message, '券码已复制，可以粘贴发送。');
});

test('赠券、回执和小组邀请提供明确复制入口，并保留Android禁用文本选择', () => {
  const gifts = readFileSync(
    new URL('../src/screens/GiftsScreen.tsx', import.meta.url),
    'utf8',
  );
  const group = readFileSync(
    new URL('../src/screens/GroupScreens.tsx', import.meta.url),
    'utf8',
  );
  for (const [source, value, label] of [
    [gifts, 'exportGift(selected)', '券码'],
    [gifts, 'exportGiftReceipt(receiptQr)', '回执码'],
    [group, 'exportInvite(state)', '邀请码'],
  ]) {
    const parsed = ts.createSourceFile(
      'screen.tsx',
      source,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    let found = false;
    function visit(node: ts.Node) {
      if (
        ts.isJsxSelfClosingElement(node) &&
        node.tagName.getText(parsed) === 'CopyCodeButton'
      ) {
        const attributes = node.attributes.properties.filter(ts.isJsxAttribute);
        const code = attributes.find(
          (attribute) => attribute.name.getText(parsed) === 'value',
        )?.initializer;
        const title = attributes.find(
          (attribute) => attribute.name.getText(parsed) === 'label',
        )?.initializer;
        if (
          code &&
          ts.isJsxExpression(code) &&
          code.expression?.getText(parsed) === value &&
          title &&
          ts.isStringLiteral(title) &&
          title.text === label
        )
          found = true;
      }
      ts.forEachChild(node, visit);
    }
    visit(parsed);
    assert.ok(found, `${label}必须复制完整导出结果`);
    assert.ok(source.includes("selectable={Platform.OS !== 'android'}"));
  }
  assert.equal(gifts.includes('长按复制'), false);
});
