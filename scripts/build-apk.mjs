import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { copyFile, mkdir, readFile, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { patchInstalledTcpSocket } from './patch-tcp-socket.mjs';

const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKILL_PATH = '.cursor/skills/android-native-crash-avoidance/SKILL.md';

// 这里只校验可机械判断的条件，技能与更新日志的语义审查仍由执行者完成。
export async function checkReleasePrerequisites(projectRoot = PROJECT_ROOT) {
  const readText = (path) => readFile(join(projectRoot, path), 'utf8');
  const [packageText, lockText, appText, gradleText, changelog, skill] =
    await Promise.all(
      [
        'package.json',
        'package-lock.json',
        'app.json',
        'android/app/build.gradle',
        'CHANGELOG.md',
        SKILL_PATH,
      ].map(readText),
    );
  const pkg = JSON.parse(packageText);
  const lock = JSON.parse(lockText);
  const app = JSON.parse(appText).expo;
  const gradleVersion = gradleText.match(
    /^\s*versionName\s+["']([^"']+)["']/m,
  )?.[1];
  const gradleCode = Number(
    gradleText.match(/^\s*versionCode\s+(\d+)\s*$/m)?.[1],
  );
  const versions = [
    pkg.version,
    lock.version,
    lock.packages?.['']?.version,
    app?.version,
    gradleVersion,
  ];
  if (
    typeof pkg.version !== 'string' ||
    !/^\d+\.\d+\.\d+$/.test(pkg.version) ||
    versions.some((version) => version !== pkg.version)
  ) {
    throw new Error(`版本不一致：${JSON.stringify(versions)}`);
  }
  if (
    !Number.isSafeInteger(app?.android?.versionCode) ||
    app.android.versionCode < 1 ||
    app.android.versionCode !== gradleCode
  ) {
    throw new Error('app.json 与 Android Gradle 的 versionCode 无效或不一致');
  }
  const escapedVersion = pkg.version.replaceAll('.', '\\.');
  const releaseEntry = changelog.match(
    new RegExp(
      `^## \\[${escapedVersion}\\][^\\n]*\\n([\\s\\S]*?)(?=^## |$(?![\\s\\S]))`,
      'm',
    ),
  )?.[1];
  if (
    !releaseEntry ||
    !new RegExp(`versionCode[\x60\\s:*]*${gradleCode}\\b`).test(releaseEntry)
  ) {
    throw new Error('CHANGELOG.md 缺少当前版本章节或对应 Android versionCode');
  }
  if (!skill.trim()) throw new Error(`打包技能为空：${SKILL_PATH}`);
  const signingConfig = gradleText.match(
    /release\s*\{[\s\S]*?signingConfig\s+signingConfigs\.(\w+)/,
  )?.[1];
  if (!signingConfig)
    throw new Error('未识别 release 签名配置，请人工确认后调整打包脚本');
  return {
    version: pkg.version,
    versionCode: gradleCode,
    signingConfig,
    skillPath: join(projectRoot, SKILL_PATH),
  };
}

async function main() {
  if (Number(process.versions.node.split('.')[0]) !== 24) {
    throw new Error('打包要求 Node 24，请先切换 Node 版本');
  }
  const args = process.argv.slice(2);
  if (args.some((arg) => !['--check', '--qa'].includes(arg))) {
    throw new Error('仅支持 --check（只读预检）和 --qa（隔离测试包）');
  }
  const isQa = args.includes('--qa');
  const buildType = isQa ? 'qa' : 'release';
  const gradleTask = isQa ? 'assembleQa' : 'assembleRelease';
  console.log(
    '打包前必须审查项目技能和 CHANGELOG.md，需要时及时更新；预检不代替内容审查。',
  );
  const release = await checkReleasePrerequisites();
  console.log(
    `元数据预检通过：${release.version}，Android versionCode ${release.versionCode}`,
  );
  console.log(`技能：${release.skillPath}`);
  console.log(
    isQa
      ? '隔离测试包：com.smallsteps.checkin.qa，小步日常测试，独立存档；不替换用户应用。'
      : '常规安装包：com.smallsteps.checkin。',
  );
  console.log(
    release.signingConfig === 'debug'
      ? '签名配置：debug 测试签名，仅适合内部安装测试，不是商店正式签名。'
      : `签名配置：${release.signingConfig}（证书性质须在产物验证阶段确认）`,
  );
  if (args.includes('--check')) return;

  await patchInstalledTcpSocket();

  const gradlew = join(PROJECT_ROOT, 'android/gradlew');
  const initScript = join(PROJECT_ROOT, 'android/init.aliyun.gradle');
  await Promise.all([stat(gradlew), stat(initScript)]);
  const env = {
    ...process.env,
    JAVA_HOME:
      process.env.JAVA_HOME ||
      '/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home',
    ANDROID_HOME:
      process.env.ANDROID_HOME ||
      process.env.ANDROID_SDK_ROOT ||
      '/opt/homebrew/share/android-commandlinetools',
  };
  const exitCode = await new Promise((resolveExit, reject) => {
    const build = spawn(
      gradlew,
      ['-p', 'android', gradleTask, '--no-daemon', '-I', initScript],
      { cwd: PROJECT_ROOT, env, stdio: 'inherit' },
    );
    build.once('error', reject);
    build.once('exit', (code, signal) => {
      if (signal) reject(new Error(`Gradle 被信号中断：${signal}`));
      else resolveExit(code ?? 1);
    });
  });
  if (exitCode !== 0)
    throw new Error(`Gradle 构建失败，退出码 ${exitCode}，不复制旧安装包`);

  const source = join(
    PROJECT_ROOT,
    `android/app/build/outputs/apk/${buildType}/app-${buildType}.apk`,
  );
  if (!(await stat(source)).isFile())
    throw new Error(`构建结束但没有生成 ${buildType} APK`);
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const destination = join(
    PROJECT_ROOT,
    'dist',
    `小步日常${isQa ? '-QA' : ''}-${release.version}-${date}.apk`,
  );
  await mkdir(dirname(destination), { recursive: true });
  // 排他创建，不覆盖已交付的同名 APK，也不清理历史产物。
  await copyFile(source, destination, constants.COPYFILE_EXCL);
  const sha256 = createHash('sha256')
    .update(await readFile(destination))
    .digest('hex');
  console.log(`安装包：${destination}`);
  console.log(`SHA-256：${sha256}`);
  console.log(
    '请继续实际检查 APK 的版本、包名和签名；构建成功不等于安装启动或真机验收通过。',
  );
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
