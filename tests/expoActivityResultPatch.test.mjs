import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  patchExpoActivityResultSource,
  patchInstalledExpoActivityResult,
} from '../scripts/patch-expo-activity-result.mjs';

const SOURCE_DIRECTORY =
  'android/src/main/java/expo/modules/kotlin/activityresult';
const LAUNCHER = 'AppContextActivityResultLauncher.kt';
const REGISTRY = 'AppContextActivityResultRegistry.kt';
const packageDir = join('node_modules', 'expo-modules-core');
const installedLauncher = await readFile(
  join(packageDir, SOURCE_DIRECTORY, LAUNCHER),
  'utf8',
);
const installedRegistry = await readFile(
  join(packageDir, SOURCE_DIRECTORY, REGISTRY),
  'utf8',
);

function replaceOnce(source, before, after) {
  assert.equal(source.split(before).length, 2, '原始夹具恢复上下文不唯一');
  return source.replace(before, after);
}

// 基于已安装的合法状态恢复固定原始文件，避免测试依赖 postinstall 是否运行。
// 原始片段来自 expo-modules-core@57.0.24；该依赖的 LICENSE 为 MIT。
function recoverOriginalLauncher(installed) {
  let source = patchExpoActivityResultSource(LAUNCHER, installed);
  source = replaceOnce(
    source,
    'import kotlinx.coroutines.Dispatchers\nimport kotlinx.coroutines.suspendCancellableCoroutine\nimport kotlinx.coroutines.withContext',
    'import kotlinx.coroutines.suspendCancellableCoroutine',
  );
  source = replaceOnce(
    source,
    `  suspend fun launch(input: I): O = withContext(Dispatchers.Main.immediate) {
    suspendCancellableCoroutine { continuation ->
      launch(input) { output ->
        // 已取消的调用不能再次恢复；等待结果不会阻塞主线程。
        if (continuation.isActive) {
          continuation.resume(output)
        }
      }
    }
  }`,
    `  suspend fun launch(input: I): O = suspendCancellableCoroutine { continuation ->
    launch(input) { output ->
      // avoids IllegalStateException: Already resumed - a rare crash likely due to race condition in lifecycle events
      if (continuation.isActive) {
        continuation.resume(output)
      }
    }
  }`,
  );
  assert.equal(
    createHash('sha256').update(source).digest('hex'),
    'c50d1ff20cd45120efda116186078c1735fa017db0e6584ba75ae01ab77b2e25',
  );
  return source;
}

function recoverOriginalRegistry(installed) {
  let source = patchExpoActivityResultSource(REGISTRY, installed);
  source = replaceOnce(
    source,
    '        val requestCode = keyToRequestCode[key]\n          ?: reregisterIfSafe(key, contract, fallbackCallback)\n          ?: throw IllegalStateException',
    '        val requestCode = keyToRequestCode[key]\n          ?: throw IllegalStateException',
  );
  source = replaceOnce(
    source,
    `  // 仅恢复无在途请求和残留状态的注册，不在后台线程操作生命周期。
  private fun <I : Serializable, O> reregisterIfSafe(
    key: String,
    contract: AppContextActivityResultContract<I, O>,
    fallbackCallback: AppContextActivityResultFallbackCallback<I, O>
  ): Int? {
    if (
      Looper.myLooper() != Looper.getMainLooper() ||
      launchedKeys.contains(key) ||
      keyToLifecycleContainers.containsKey(key) ||
      pendingResults.containsKey(key)
    ) {
      return null
    }

    val current = currentActivityProvider.currentActivity as? AppCompatActivity ?: return null
    if (current.isFinishing || current.isDestroyed || current.lifecycle.currentState != Lifecycle.State.RESUMED) {
      return null
    }

    register(key, current, contract, fallbackCallback)
    return keyToRequestCode[key]
  }

`,
    '',
  );
  assert.equal(
    createHash('sha256').update(source).digest('hex'),
    'cb866b0f357f516156824fb17176272fda625cd9aa0bcc608ec3c64a3ab10508',
  );
  return source;
}

const originalLauncher = recoverOriginalLauncher(installedLauncher);
const originalRegistry = recoverOriginalRegistry(installedRegistry);

async function withFixture(run) {
  const root = await mkdtemp(join(tmpdir(), 'xiaobu-expo-result-test-'));
  const packagePath = join(root, 'node_modules/expo-modules-core');
  const sourcePath = join(packagePath, SOURCE_DIRECTORY);
  try {
    await mkdir(sourcePath, { recursive: true });
    await writeFile(
      join(packagePath, 'package.json'),
      JSON.stringify({ version: '57.0.24' }),
    );
    await writeFile(join(sourcePath, LAUNCHER), originalLauncher);
    await writeFile(join(sourcePath, REGISTRY), originalRegistry);
    await run({ root, packagePath, sourcePath });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test('ActivityResult 补丁锁定完整源码并限制重注册条件', () => {
  const launcher = patchExpoActivityResultSource(LAUNCHER, originalLauncher);
  const registry = patchExpoActivityResultSource(REGISTRY, originalRegistry);
  assert.notEqual(launcher, originalLauncher);
  assert.notEqual(registry, originalRegistry);
  assert.equal(recoverOriginalLauncher(originalLauncher), originalLauncher);
  assert.equal(recoverOriginalRegistry(originalRegistry), originalRegistry);
  assert.equal(recoverOriginalLauncher(launcher), originalLauncher);
  assert.equal(recoverOriginalRegistry(registry), originalRegistry);
  assert.match(launcher, /withContext\(Dispatchers\.Main\.immediate\)/);
  assert.match(launcher, /suspendCancellableCoroutine/);
  assert.match(launcher, /continuation\.isActive/);
  assert.match(
    registry,
    /\?: reregisterIfSafe\(key, contract, fallbackCallback\)/,
  );
  assert.match(registry, /Looper\.myLooper\(\) != Looper\.getMainLooper\(\)/);
  assert.match(registry, /launchedKeys\.contains\(key\)/);
  assert.match(registry, /keyToLifecycleContainers\.containsKey\(key\)/);
  assert.match(registry, /pendingResults\.containsKey\(key\)/);
  assert.match(registry, /current\.isFinishing \|\| current\.isDestroyed/);
  assert.match(
    registry,
    /current\.lifecycle\.currentState != Lifecycle\.State\.RESUMED/,
  );
  assert.doesNotMatch(registry, /CountDownLatch/);
  assert.equal(patchExpoActivityResultSource(LAUNCHER, launcher), launcher);
  assert.equal(patchExpoActivityResultSource(REGISTRY, registry), registry);
  assert.throws(
    () => patchExpoActivityResultSource(LAUNCHER, `${originalLauncher}\n`),
    /源码与已审核版本不匹配/,
  );
  assert.throws(
    () => patchExpoActivityResultSource(REGISTRY, `${registry}\n`),
    /源码与已审核版本不匹配/,
  );
  assert.throws(() => patchExpoActivityResultSource('other.kt', ''), /未知/);
});

test('ActivityResult 临时夹具支持幂等且版本漂移时不写入', async () => {
  await withFixture(async ({ root, packagePath, sourcePath }) => {
    await patchInstalledExpoActivityResult(root);
    const launcher = await readFile(join(sourcePath, LAUNCHER), 'utf8');
    const registry = await readFile(join(sourcePath, REGISTRY), 'utf8');
    assert.equal(
      launcher,
      patchExpoActivityResultSource(LAUNCHER, originalLauncher),
    );
    assert.equal(
      registry,
      patchExpoActivityResultSource(REGISTRY, originalRegistry),
    );
    await patchInstalledExpoActivityResult(root);
    assert.equal(await readFile(join(sourcePath, LAUNCHER), 'utf8'), launcher);
    assert.equal(await readFile(join(sourcePath, REGISTRY), 'utf8'), registry);
    await writeFile(
      join(packagePath, 'package.json'),
      JSON.stringify({ version: '57.0.25' }),
    );
    await assert.rejects(patchInstalledExpoActivityResult(root), /版本不匹配/);
    assert.equal(await readFile(join(sourcePath, LAUNCHER), 'utf8'), launcher);
    assert.equal(await readFile(join(sourcePath, REGISTRY), 'utf8'), registry);
  });
});

test('任一 Kotlin 源码漂移均在写入前拒绝另一个文件', async () => {
  for (const changed of [LAUNCHER, REGISTRY]) {
    await withFixture(async ({ root, sourcePath }) => {
      const other = changed === LAUNCHER ? REGISTRY : LAUNCHER;
      const otherBefore = await readFile(join(sourcePath, other), 'utf8');
      await writeFile(join(sourcePath, changed), 'unexpected source');
      await assert.rejects(
        patchInstalledExpoActivityResult(root),
        /源码与已审核版本不匹配/,
      );
      assert.equal(
        await readFile(join(sourcePath, changed), 'utf8'),
        'unexpected source',
      );
      assert.equal(
        await readFile(join(sourcePath, other), 'utf8'),
        otherBefore,
      );
    });
  }
});

test('单文件已打补丁的混合状态可校验并完整修复', async () => {
  for (const patchedName of [LAUNCHER, REGISTRY]) {
    await withFixture(async ({ root, sourcePath }) => {
      const initial =
        patchedName === LAUNCHER ? originalLauncher : originalRegistry;
      await writeFile(
        join(sourcePath, patchedName),
        patchExpoActivityResultSource(patchedName, initial),
      );
      await patchInstalledExpoActivityResult(root);
      assert.equal(
        await readFile(join(sourcePath, LAUNCHER), 'utf8'),
        patchExpoActivityResultSource(LAUNCHER, originalLauncher),
      );
      assert.equal(
        await readFile(join(sourcePath, REGISTRY), 'utf8'),
        patchExpoActivityResultSource(REGISTRY, originalRegistry),
      );
    });
  }
});
