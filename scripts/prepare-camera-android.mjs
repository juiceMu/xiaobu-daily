import { createHash } from 'node:crypto';
import { cp, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const EXPECTED_VERSION = '57.0.6';
const EXPECTED_SHA256 =
  '614172f7567dcf2e71699db61b910d4a1b8e3d9c3dfb0b0beb085f8dbb4dbd10';
const SOURCE_PATH = 'src/main/java/expo/modules/camera/ExpoCameraView.kt';

export function patchCameraSource(source) {
  if (createHash('sha256').update(source).digest('hex') !== EXPECTED_SHA256) {
    throw new Error('expo-camera 源码与已审核版本不匹配，请重新审核补丁');
  }
  const replacements = [
    [
      'import androidx.core.graphics.drawable.toDrawable',
      'import androidx.core.graphics.drawable.toDrawable\nimport androidx.lifecycle.Lifecycle\nimport androidx.lifecycle.LifecycleEventObserver',
    ],
    [
      '  private var previewPaused = false',
      `  private var previewPaused = currentActivity.lifecycle.currentState != Lifecycle.State.RESUMED
  private var cameraGeneration = 0
  private var cameraDestroyed = false
  private val cameraLifecycleObserver = LifecycleEventObserver { _, event ->
    if (event == Lifecycle.Event.ON_PAUSE) {
      pausePreview()
    } else if (event == Lifecycle.Event.ON_RESUME && previewPaused) {
      // 不自动恢复；通知界面卸载旧视图并允许用户显式重试。
      post {
        if (!cameraDestroyed && previewPaused) {
          onMountError(CameraMountErrorEvent("Camera preview paused; retry explicitly"))
        }
      }
    }
  }`,
    ],
    [
      '      configureAndBindCamera()',
      '      configureAndBindCamera(cameraGeneration)',
    ],
    [
      '  private suspend fun configureAndBindCamera() {\n    val cameraProvider = ProcessCameraProvider.awaitInstance(context)',
      `  private suspend fun configureAndBindCamera(generation: Int) {
    val cameraProvider = ProcessCameraProvider.awaitInstance(context)
    // 等待 provider 期间可能已暂停或销毁，不得绑定迟到的相机。
    if (previewPaused || generation != cameraGeneration) {
      return
    }
    if (currentActivity.lifecycle.currentState != Lifecycle.State.RESUMED) {
      pausePreview()
      return
    }`,
    ],
    [
      '    previewPaused = true\n    cameraProvider?.unbindAll()',
      '    previewPaused = true\n    cameraGeneration += 1\n    cameraProvider?.unbindAll()',
    ],
    [
      '  init {\n    orientationEventListener.enable()',
      '  init {\n    currentActivity.lifecycle.addObserver(cameraLifecycleObserver)\n    orientationEventListener.enable()',
    ],
    [
      '  fun cleanupCamera() {\n    orientationEventListener.disable()',
      '  fun cleanupCamera() {\n    cameraDestroyed = true\n    pausePreview()\n    currentActivity.lifecycle.removeObserver(cameraLifecycleObserver)\n    orientationEventListener.disable()',
    ],
  ];
  for (const [before, after] of replacements) {
    if (source.split(before).length !== 2)
      throw new Error('相机补丁上下文不唯一');
    source = source.replace(before, after);
  }
  return source;
}

export async function prepareCameraAndroid(root = process.cwd()) {
  const packageDir = resolve(root, 'node_modules/expo-camera');
  const pkg = JSON.parse(
    await readFile(join(packageDir, 'package.json'), 'utf8'),
  );
  if (pkg.version !== EXPECTED_VERSION)
    throw new Error('expo-camera 版本不匹配，请重新审核补丁');
  const androidDir = join(packageDir, 'android');
  const patched = patchCameraSource(
    await readFile(join(androidDir, SOURCE_PATH), 'utf8'),
  );
  const output = await mkdtemp(join(tmpdir(), 'xiaobu-camera-android-'));
  await cp(androidDir, output, { recursive: true });
  await writeFile(join(output, SOURCE_PATH), patched);
  return output;
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  prepareCameraAndroid(resolve(dirnameFromScript(), '..')).then(
    (directory) => console.log(directory),
    (error) => {
      console.error(error.message);
      process.exitCode = 1;
    },
  );
}

function dirnameFromScript() {
  return fileURLToPath(new URL('.', import.meta.url));
}
