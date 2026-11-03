# OPPO 账户资料同步提示修正验收记录

## 变更与环境

- 日期：2026-11-03，Asia/Shanghai。`main`，HEAD `95ce109eaa87d95101ce991b1514f44e49198aa8`；工作区有大量既有未提交修改，未清理或覆盖。此次修正涉及账户页、“更多”入口、`PROFILE-008`、应用说明及测试文档。
- 基线：QA32 曾在 OPPO 账户页显示“头像和昵称只保存在此设备，不会同步”，而 [OPPO 向三星同步记录](./2026-11-02-qa32-avatar-sync-reverse.md)已有跨设备头像样本；本轮 code 34 的“更多”入口仍显示“仅本机”。新要求是在两处说明本机保存、小组同步可见，账户页还说明应用不提供云账号或云备份功能。
- OPPO PJX110，Android 16；测试时尺寸覆盖 1080×2376、密度覆盖 480、系统字体倍率 1.0。Node 24.22.1、npm 10.8.2，JDK 17。
- 设备上使用独立测试包 `com.smallsteps.checkin.isolatedqa`，不导入真实存档；仅升级已存在的隔离包，未清空数据，未覆盖正式版或普通 QA 包。本次未进行资料保存或同步操作。
- 设备共享存储保留本次隔离界面截图 `/sdcard/codex-oppo-profile35-account.png`、`/sdcard/codex-oppo-profile35-more.png`；界面采集工具更新了 `/sdcard/window.xml` 临时快照。

## 自动化执行

| 阶段         | 命令或检查                                                                                                                                                                                                                                                                                                          | 结果与范围                                                                                             |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 修改前基线   | `tsx --test tests/accountProfile.test.ts tests/scannerPermission.test.ts tests/lanListener.test.ts tests/tcpNativePatch.test.mjs`                                                                                                                                                                                   | 退出 0，43 项通过；这些原有断言不覆盖本次文案问题                                                      |
| 回归测试先行 | `tsx --test --test-name-pattern='PROFILE-008' tests/accountProfile.test.ts`                                                                                                                                                                                                                                         | 补充入口及新副标题断言后、修改两处源码前退出 1；修改后退出 0，1 项通过                                 |
| 完整测试     | `npm test`                                                                                                                                                                                                                                                                                                          | 退出 0，328 通过，0 失败、0 跳过；并非设备 E2E                                                         |
| 类型检查     | `npm run typecheck`                                                                                                                                                                                                                                                                                                 | 退出 0                                                                                                 |
| 静态检查     | `npm run lint`                                                                                                                                                                                                                                                                                                      | 退出 1：未修改的 `scripts/create-app-icon.cjs` 两处 `__dirname` 错误；`TodayScreen.tsx` 两处 Hook 警告 |
| 全仓格式     | `npm run format:check`                                                                                                                                                                                                                                                                                              | 最后一次退出 1，393 个文件报告格式问题，包含 Android 构建缓存和其他已有源码；未批量修改用户文件        |
| 本次文件检查 | `npx eslint src/screens/AccountScreen.tsx src/screens/MoreScreens.tsx tests/accountProfile.test.ts`                                                                                                                                                                                                                 | 退出 0                                                                                                 |
| 本次格式检查 | `npx prettier --check src/screens/AccountScreen.tsx src/screens/MoreScreens.tsx tests/accountProfile.test.ts APP_MANUAL.md CHANGELOG.md docs/testing/TEST_CASES.md docs/testing/COVERAGE.md docs/testing/runs/2026-11-02-native-fixes-release-blocked.md docs/testing/runs/2026-11-03-oppo-profile-sync-clarity.md` | 修正本轮长行和记录格式后退出 0                                                                         |
| Android 导出 | `npm run export:android -- --output-dir /tmp/xiaobu-oppo-android-export.gZJK7L`                                                                                                                                                                                                                                     | 退出 0；资源导出不代表安装或启动                                                                       |
| iOS 导出     | `npm run export:ios -- --output-dir /tmp/xiaobu-oppo-ios-export.3qAvw0`                                                                                                                                                                                                                                             | 退出 0；资源导出不代表安装或启动                                                                       |
| 隔离测试构建 | 临时副本 `android/` 下 `./gradlew assembleQa --no-daemon -I init.aliyun.gradle`                                                                                                                                                                                                                                     | JDK 17，退出 0；该命令不是正式发布构建                                                                 |
| 正式 APK     | `npm run build:apk`                                                                                                                                                                                                                                                                                                 | NOT_RUN：共享原生候选尚未完成设备验证、正式签名尚未配置；不将 debug 签名冒充正式签名                   |

## 功能执行明细

| 用例        | 参数/平台                            | 状态             | 实际结果与证据                                                                                                                                                                                                                                                                                                   |
| ----------- | ------------------------------------ | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PROFILE-008 | OPPO、隔离包 code 35、当前字体与主题 | PASS（有限样本） | “更多”入口显示“本机保存，小组同步可见”；进入账户页后显示“不提供云账户”和同步可见说明。当前屏幕下截图未见文案截断。证据：`/tmp/7c034dd9-oppo-profile35-more.xml`、`/tmp/7c034dd9-oppo-profile35-account.xml`、`/tmp/codex-oppo-profile35-more.png`、`/tmp/codex-oppo-profile35-account.png`；临时文件可能被清理。 |
| PROFILE-008 | 其他字号、屏幕、主题或其他设备       | NOT_RUN          | 不能以此 OPPO 样本推断其他配置的可读性。                                                                                                                                                                                                                                                                         |
| PROFILE-003 | 头像保存及跨设备同步                 | NOT_RUN          | 本轮只验证提示，不以源码断言或提示显示证明实际同步。                                                                                                                                                                                                                                                             |

## 包核对和缺陷边界

- 新测试包版本 `1.0.32-oppo-privacy-candidate2` / code 35，SHA-256 `80c2b27b6aa5477857b6040fcc40ef04bd1123574f8d33a15c8ca86cbc2bfbbd`。`apksigner verify --verbose --print-certs` 退出 0，v2 签名通过，证书为 Android Debug；安装 `adb install -r` 退出 0，设备包信息显示 code 35。它仅是可调试隔离包，不是正式版。
- 独立复核对照隔离基线及普通 QA/正式 APK：包名、深链和 provider 标识隔离，清单版本之外无变化，允许备份为 false。此结论仅针对包和清单，不证明网络或用户主动分享隔离；相同包名的隔离基线会被升级替换，不承诺可直接降级。
- 构建前临时副本的 Expo 启动器和 TCP 服务器候选补丁相关源文件与工作区已安装依赖的原版逐一比对一致；此 OPPO 文案测试包未应用那些候选，不能用于证明它们已修复。
- OPPO 先前两次出现“同步连接空闲超时”，现有记录缺少会话归属、时序和对端结果，不能确定根因或断言修复。独立源码分析认为提示可能来自被动入站连接，但不是已证实调用栈；未擅自修改超时阈值或协议。
- 新增工作区 Expo 与 TCP 原生候选的编译和设备验证边界见 [原生问题记录](./2026-11-02-native-fixes-release-blocked.md)；候选已接入构建流程，正式发布前仍需相应验证。

## 独立复核与结论

- 独立复核者 `tcp_review` 只读核对了源码、用例、APK 标识与签名，以及上述两处 XML 和截图；确认当前样本的文案完整可见，未连接设备。安装命令退出码及实际操作顺序由执行者记录，不是单凭截图证明。
- 已同步 `APP_MANUAL.md`、`docs/testing/TEST_CASES.md`、`docs/testing/COVERAGE.md` 和 `CHANGELOG.md`。Android 原生打包技能及更新日志已检查；当前候选及发布阻塞已记录。
- 结论：本次 OPPO 文案修正在当前设备配置上通过有限验证；同步超时根因、其他设备与字号、共享原生候选和正式签名仍未完成，不能认定所有缺陷已修复或正式版可发布。
