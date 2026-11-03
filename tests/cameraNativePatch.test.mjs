import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  patchCameraSource,
  prepareCameraAndroid,
} from '../scripts/prepare-camera-android.mjs';

const sourcePath =
  'android/src/main/java/expo/modules/camera/ExpoCameraView.kt';
const original = await readFile(
  join('node_modules/expo-camera', sourcePath),
  'utf8',
);

test('SCAN-003: 固定源码的生命周期补丁及漂移拒绝', () => {
  const patched = patchCameraSource(original);
  assert.match(patched, /Lifecycle.Event.ON_PAUSE/);
  assert.match(patched, /Lifecycle.Event.ON_RESUME && previewPaused/);
  assert.match(patched, /!cameraDestroyed && previewPaused/);
  assert.match(patched, /generation != cameraGeneration/);
  assert.match(patched, /removeObserver\(cameraLifecycleObserver\)/);
  assert.throws(
    () => patchCameraSource(original + '\n'),
    /源码与已审核版本不匹配/,
  );
  assert.throws(() => patchCameraSource(patched), /源码与已审核版本不匹配/);
});

test('SCAN-003: 构建副本重复生成不修改依赖并拒绝错误版本', async () => {
  const root = await mkdtemp(join(tmpdir(), 'xiaobu-camera-test-'));
  const packageDir = join(root, 'node_modules/expo-camera');
  await mkdir(join(packageDir, 'android/src/main/java/expo/modules/camera'), {
    recursive: true,
  });
  await writeFile(
    join(packageDir, 'package.json'),
    JSON.stringify({ version: '57.0.6' }),
  );
  await writeFile(join(packageDir, sourcePath), original);
  const first = await prepareCameraAndroid(root);
  const second = await prepareCameraAndroid(root);
  assert.notEqual(first, second);
  assert.equal(
    await readFile(join(first, sourcePath.replace('android/', '')), 'utf8'),
    patchCameraSource(original),
  );
  assert.equal(
    await readFile(join(second, sourcePath.replace('android/', '')), 'utf8'),
    patchCameraSource(original),
  );
  assert.equal(await readFile(join(packageDir, sourcePath), 'utf8'), original);
  await writeFile(
    join(packageDir, 'package.json'),
    JSON.stringify({ version: '57.0.7' }),
  );
  await assert.rejects(prepareCameraAndroid(root), /版本不匹配/);
});
