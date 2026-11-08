import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
// 脚本保留为 Node 可直接执行的模块；此处测试公开预检行为。
import {
  checkReleasePrerequisites,
  resolveBuildOptions,
} from '../scripts/build-apk.mjs';

test('旧存档升级路由固定同包名且所有隔离构建选项两两互斥', () => {
  assert.deepEqual(resolveBuildOptions(['--isolated-upgrade', '--check']), {
    buildType: 'isolatedUpgrade',
    gradleTask: 'assembleIsolatedUpgrade',
    suffix: '-ISOLATED-UPGRADE',
    applicationId: 'com.smallsteps.checkin.isolatedqa',
    label: '小步升级验收',
    checkOnly: true,
  });
  assert.equal(resolveBuildOptions(['--isolated-upgrade']).checkOnly, false);
  const flags = [
    '--qa',
    '--acceptance',
    '--fresh-acceptance',
    '--scenario-acceptance',
    '--fixture',
    '--isolated-upgrade',
    '--peer-protection',
  ];
  for (const first of flags)
    for (const second of flags)
      if (first !== second)
        assert.throws(
          () => resolveBuildOptions([first, second]),
          /隔离构建选项不能同时使用/,
        );
});

test('副本保护专用入口沿用夹具ID但产物标签与文件后缀独立', () => {
  assert.deepEqual(resolveBuildOptions(['--peer-protection', '--check']), {
    buildType: 'peerProtection',
    gradleTask: 'assemblePeerProtection',
    suffix: '-PEER-PROTECTION',
    applicationId: 'com.smallsteps.checkin.fixtureqa',
    label: '小步副本验收',
    checkOnly: true,
  });
  assert.equal(resolveBuildOptions(['--peer-protection']).checkOnly, false);
});

test('场景验收产物包名及文件后缀隔离且与其他入口互斥', () => {
  const scenario = resolveBuildOptions(['--scenario-acceptance', '--check']);
  assert.equal(
    scenario.applicationId,
    'com.smallsteps.checkin.scenarioacceptanceqa',
  );
  assert.equal(scenario.gradleTask, 'assembleScenarioAcceptance');
  assert.equal(scenario.suffix, '-SCENARIO-ACCEPTANCE');
  assert.equal(scenario.checkOnly, true);
  for (const other of [
    '--qa',
    '--acceptance',
    '--fresh-acceptance',
    '--fixture',
  ]) {
    assert.throws(() => resolveBuildOptions(['--scenario-acceptance', other]));
  }
});

test('APK 构建选项隔离常规、QA 和验收产物，验收不能与QA混用', () => {
  const regular = resolveBuildOptions([]);
  const qa = resolveBuildOptions(['--qa']);
  const acceptance = resolveBuildOptions(['--acceptance', '--check']);
  const fresh = resolveBuildOptions(['--fresh-acceptance', '--check']);
  const fixture = resolveBuildOptions(['--fixture', '--check']);
  assert.deepEqual(
    [regular, qa, acceptance, fresh, fixture].map(
      ({ applicationId }) => applicationId,
    ),
    [
      'com.smallsteps.checkin',
      'com.smallsteps.checkin.qa',
      'com.smallsteps.checkin.acceptanceqa',
      'com.smallsteps.checkin.freshacceptanceqa',
      'com.smallsteps.checkin.fixtureqa',
    ],
  );
  assert.deepEqual(
    [regular, qa, acceptance, fresh, fixture].map(
      ({ gradleTask }) => gradleTask,
    ),
    [
      'assembleRelease',
      'assembleQa',
      'assembleAcceptance',
      'assembleFreshAcceptance',
      'assembleFixture',
    ],
  );
  assert.deepEqual(
    [regular, qa, acceptance, fresh, fixture].map(({ suffix }) => suffix),
    ['', '-QA', '-ACCEPTANCE', '-FRESH-ACCEPTANCE', '-FIXTURE'],
  );
  assert.equal(acceptance.checkOnly, true);
  assert.equal(regular.checkOnly, false);
  assert.throws(() => resolveBuildOptions(['--qa', '--acceptance']));
  assert.throws(() => resolveBuildOptions(['--qa', '--fixture']));
  assert.throws(() => resolveBuildOptions(['--acceptance', '--fixture']));
  assert.throws(() =>
    resolveBuildOptions(['--qa', '--acceptance', '--fixture']),
  );
  assert.equal(fixture.label, '小步夹具');
  assert.equal(fresh.label, '小步新验收');
  for (const other of ['--qa', '--acceptance', '--fixture']) {
    assert.throws(() => resolveBuildOptions(['--fresh-acceptance', other]));
  }
  assert.throws(() => resolveBuildOptions(['--unknown']));
});

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
