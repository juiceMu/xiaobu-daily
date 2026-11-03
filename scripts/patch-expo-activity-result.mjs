import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const EXPECTED_VERSION = '57.0.24';
const SOURCE_DIRECTORY =
  'android/src/main/java/expo/modules/kotlin/activityresult';
const SOURCES = {
  'AppContextActivityResultLauncher.kt': {
    original:
      'c50d1ff20cd45120efda116186078c1735fa017db0e6584ba75ae01ab77b2e25',
    patched: '67a38dd48e148e77c4af4d22ed7b2efeb14bf3e6e0700bd8079422abbe9ba957',
  },
  'AppContextActivityResultRegistry.kt': {
    original:
      'cb866b0f357f516156824fb17176272fda625cd9aa0bcc608ec3c64a3ab10508',
    patched: '60a7e5e6f2307db554eb744047b6f4532e93b70f465f467f6dc5f81ee7193542',
  },
};

const LAUNCHER_REPLACEMENTS = [
  [
    'import kotlinx.coroutines.suspendCancellableCoroutine',
    'import kotlinx.coroutines.Dispatchers\nimport kotlinx.coroutines.suspendCancellableCoroutine\nimport kotlinx.coroutines.withContext',
  ],
  [
    `  suspend fun launch(input: I): O = suspendCancellableCoroutine { continuation ->
    launch(input) { output ->
      // avoids IllegalStateException: Already resumed - a rare crash likely due to race condition in lifecycle events
      if (continuation.isActive) {
        continuation.resume(output)
      }
    }
  }`,
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
  ],
];

const REGISTRY_REPLACEMENTS = [
  [
    '        val requestCode = keyToRequestCode[key]\n          ?: throw IllegalStateException',
    '        val requestCode = keyToRequestCode[key]\n          ?: reregisterIfSafe(key, contract, fallbackCallback)\n          ?: throw IllegalStateException',
  ],
  [
    '  /**\n   * Persist the state of the registry.\n   */',
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

  /**
   * Persist the state of the registry.
   */`,
  ],
];

function digest(source) {
  return createHash('sha256').update(source).digest('hex');
}

export function patchExpoActivityResultSource(filename, source) {
  const expected = SOURCES[filename];
  if (!expected) throw new Error('未知 Expo ActivityResult 源文件');
  const hash = digest(source);
  if (hash === expected.patched) return source;
  if (hash !== expected.original) {
    throw new Error(`${filename} 源码与已审核版本不匹配`);
  }
  const replacements = filename.includes('Launcher')
    ? LAUNCHER_REPLACEMENTS
    : REGISTRY_REPLACEMENTS;
  let patched = source;
  for (const [before, after] of replacements) {
    if (patched.split(before).length !== 2) {
      throw new Error(`${filename} 补丁上下文不唯一`);
    }
    patched = patched.replace(before, after);
  }
  if (digest(patched) !== expected.patched) {
    throw new Error(`${filename} 补丁摘要不匹配`);
  }
  return patched;
}

export async function patchInstalledExpoActivityResult(root = process.cwd()) {
  const packageDir = resolve(root, 'node_modules/expo-modules-core');
  const pkg = JSON.parse(
    await readFile(resolve(packageDir, 'package.json'), 'utf8'),
  );
  if (pkg.version !== EXPECTED_VERSION) {
    throw new Error('expo-modules-core 版本不匹配，请重新审核补丁');
  }
  const entries = await Promise.all(
    Object.keys(SOURCES).map(async (filename) => {
      const path = resolve(packageDir, SOURCE_DIRECTORY, filename);
      const source = await readFile(path, 'utf8');
      return { filename, path, source };
    }),
  );
  // 全部文件验证后才开始写入，防止源码漂移时只应用一部分。
  const patched = entries.map((entry) => ({
    ...entry,
    result: patchExpoActivityResultSource(entry.filename, entry.source),
  }));
  for (const entry of patched) {
    if (entry.result !== entry.source)
      await writeFile(entry.path, entry.result);
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  patchInstalledExpoActivityResult().then(
    () => console.log('Expo ActivityResult Android 补丁已校验'),
    (error) => {
      console.error(error.message);
      process.exitCode = 1;
    },
  );
}
