import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
// 脚本保留为 Node 可直接执行的模块；此处测试公开预检行为。
import { checkReleasePrerequisites } from '../scripts/build-apk.mjs';

type FixtureOptions = {
  packageVersion?: string;
  lockVersion?: string;
  lockPackageVersion?: string;
  appVersion?: string;
  gradleVersion?: string;
  appCode?: number;
  gradleCode?: number;
  changelog?: string;
  skill?: string | null;
};

async function withFixture(
  options: FixtureOptions,
  run: (root: string) => Promise<void>,
) {
  const root = await mkdtemp(join(tmpdir(), 'sprout-apk-check-'));
  const files = {
    'package.json': JSON.stringify({
      version: options.packageVersion ?? '1.2.3',
    }),
    'package-lock.json': JSON.stringify({
      version: options.lockVersion ?? '1.2.3',
      packages: { '': { version: options.lockPackageVersion ?? '1.2.3' } },
    }),
    'app.json': JSON.stringify({
      expo: {
        version: options.appVersion ?? '1.2.3',
        android: { versionCode: options.appCode ?? 6 },
      },
    }),
    'android/app/build.gradle': `versionName "${options.gradleVersion ?? '1.2.3'}"\nversionCode ${options.gradleCode ?? 6}\nbuildTypes { release { signingConfig signingConfigs.debug } }`,
    'CHANGELOG.md':
      options.changelog ??
      '# Changelog\n\n## [1.2.3] - 2026-10-23\n\n- Android `versionCode` 6\n',
    ...(options.skill === null
      ? {}
      : {
          '.cursor/skills/android-native-crash-avoidance/SKILL.md':
            options.skill ?? '# 项目打包规则\n',
        }),
  };
  try {
    await Promise.all(
      Object.entries(files).map(async ([path, contents]) => {
        const absolute = join(root, path);
        await mkdir(dirname(absolute), { recursive: true });
        await writeFile(absolute, contents);
      }),
    );
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test('APK 预检接受五处一致的版本及当前章节的 Android code', async () => {
  await withFixture({}, async (root) => {
    const result = await checkReleasePrerequisites(root);
    assert.equal(result.version, '1.2.3');
    assert.equal(result.versionCode, 6);
    assert.equal(result.signingConfig, 'debug');
  });
});

test('APK 预检拒绝任一版本副本不一致，包含锁文件两个根版本', async () => {
  for (const field of [
    'lockVersion',
    'lockPackageVersion',
    'appVersion',
    'gradleVersion',
  ]) {
    await withFixture({ [field]: '1.2.2' }, async (root) => {
      await assert.rejects(checkReleasePrerequisites(root));
    });
  }
});

test('APK 预检拒绝 Android code 不一致、非正整数', async () => {
  for (const options of [
    { appCode: 5 },
    { gradleCode: 5 },
    { appCode: 0, gradleCode: 0 },
    { appCode: 6.5 },
  ]) {
    await withFixture(options, async (root) => {
      await assert.rejects(checkReleasePrerequisites(root));
    });
  }
});

test('APK 预检不能借用其他版本章节的 Android code', async () => {
  for (const changelog of [
    '# Changelog\n## [1.2.2]\n- Android `versionCode` 6\n',
    '# Changelog\n## [1.2.3]\n- 修改功能\n## [1.2.2]\n- Android `versionCode` 6\n',
    '# Changelog\n## [1.2.3]\n- Android `versionCode` 60\n',
  ]) {
    await withFixture({ changelog }, async (root) => {
      await assert.rejects(checkReleasePrerequisites(root));
    });
  }
});

test('APK 预检拒绝技能缺失或内容为空', async () => {
  for (const skill of [null, '  \n']) {
    await withFixture({ skill }, async (root) => {
      await assert.rejects(checkReleasePrerequisites(root));
    });
  }
});
