# 验收记录：日期重选后任务列表无法滚动

## 变更与环境

| 项目          | 实际内容                                                                                                                |
| ------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 需求/验收标准 | 修复同日重选、重复回今天及快速换日后列表持续回拉/无法滚动，正常换日继续保持滚动位置                                     |
| 日期/执行分工 | 2026-10-29，Asia/Shanghai；主代理唯一操作手机，executor_scroll实现，executor_qa准备版本/文档/构建；review_final独立复核 |
| 提交/工作区   | `d8babcc`基础上的未提交工作区，保留已有同步、QA构建及测试改动                                                           |
| 原始复现包    | `com.smallsteps.checkin.qa`，1.0.11/code12，既有独立测试存档，不使用用户真实应用存档                                    |
| 构建版本      | 1.0.13/code14，QA及常规两包均实际构建完成；未由本子代理安装设备                                                         |
| 构建工具      | Node24.22.1，JDK17.0.12，Android SDK36，ARM64；两包实际元数据/签名核验完成                                              |
| 设备          | OPPO PJX110，Android16/API36，1080×2376；本子代理不操作ADB                                                              |
| 关联用例      | CHECK-009，DATE-001，CHECK-005/008（日期操作影响范围）；业务写入不以本次滚动成功替代验证                                |
| 打包内容审查  | 已重新核对原生技能与CHANGELOG，新增实际复现的滚动坑及本次版本；保留旧包，不升级依赖或更换签名                           |

## 修改前基线

主代理实际在QA1.0.11重复选择10月22日后执行多次swipe，列表顶部仍不动，记录为 **CHECK-009同日重选子场景 FAIL**。这是实际设备复现，不由源码断言推导；证据：[重选后顶部锁住](./2026-10-28-lan-evidence/qa-scroll-baseline-stuck.png)。随后切换为10月23日，用相同swipe可见AReading，作为换日可恢复的对照：[换日后可滚动](./2026-10-28-lan-evidence/qa-scroll-baseline-change-day-recovers.png)。仅此对照不代表其他快速切换或重复回今天已通过。

基线源码中日期选择会设置滚动恢复ref，恢复effect依赖所选日期。同key重选不触发effect导致ref永久保留，已由新增回调/effect/onScroll抽取回归确认；初始5项中3项失败。独立审查又复现480ms恢复窗口内重选后旧timer继续回拉（补充6项时5通过1失败）；最终同时清理同日恢复ref并让timer检查恢复状态仍有效，保留null跟随今天语义及正常换日恢复。

## 自动化执行

| 阶段               | 实际命令                                                                                                                                                   | 退出码 | 结果/证据                                                                                                                    |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------- |
| 修改前已有相关基线 | `node node_modules/tsx/dist/cli.mjs --test tests/compactCalendar.test.ts tests/weekStrip.test.ts tests/historicalCheckin.test.ts`                          | 0      | 13/13；`/private/tmp/xiaobu-scroll-baseline.log`，原有断言未覆盖滚动锁                                                       |
| 新回归复现旧锁     | `node node_modules/tsx/dist/cli.mjs --test tests/dateScroll.test.ts`                                                                                       | 1      | 初始5项2通过3失败；`/private/tmp/xiaobu-scroll-repro.log`                                                                    |
| 审查追加窗口复现   | 同上                                                                                                                                                       | 1      | 新增第6项后5通过1失败，160ms重选后旧timer回拉；`/private/tmp/xiaobu-scroll-window-repro.log`                                 |
| 修改后针对性       | `node node_modules/tsx/dist/cli.mjs --test tests/dateScroll.test.ts tests/compactCalendar.test.ts tests/weekStrip.test.ts tests/historicalCheckin.test.ts` | 0      | 19/19；`/private/tmp/xiaobu-scroll-after.log`；review_final独立同命令19/19，`/private/tmp/xiaobu-review-scroll-final.log`    |
| 完整测试           | `npm test`                                                                                                                                                 | 0      | 270/270；`/tmp/xiaobu-final-1.0.13-verifier.J6Jsqq/tests.log`                                                                |
| 类型               | `npm run typecheck`                                                                                                                                        | 0      | 同目录 `typecheck.log`                                                                                                       |
| 静态检查           | `npm run lint`                                                                                                                                             | 1      | 既有3 errors/3 warnings，同目录 `lint.log`；没有宣称全量通过                                                                 |
| 全量格式           | `npm run format:check`                                                                                                                                     | 1      | 313文件，包括Android生成物/既有源文件及本报告当时写作中的格式问题，同目录 `format.log`；报告后续单独格式化不改变该次全量失败 |
| Web资源            | `npm run export:web`                                                                                                                                       | 0      | 同目录 `export-web.log`，仅资源打包                                                                                          |
| Android资源        | `npm run export:android -- --output-dir /tmp/xiaobu-final-1.0.13-verifier.J6Jsqq/export-android`                                                           | 0      | 同目录 `export-android.log`                                                                                                  |
| iOS资源            | `npm run export:ios -- --output-dir /tmp/xiaobu-final-1.0.13-verifier.J6Jsqq/export-ios`                                                                   | 0      | 同目录 `export-ios.log`                                                                                                      |
| QA构建             | `npm run build:apk -- --qa`                                                                                                                                | 0      | Gradle 1m58s；`/private/tmp/xiaobu-build-qa-1.0.13.log`；实际元数据/签名通过，详见下文                                       |
| 常规构建           | `npm run build:apk`                                                                                                                                        | 0      | Gradle 1m20s；`/private/tmp/xiaobu-build-1.0.13.log`；实际元数据/签名通过，不自动安装设备                                    |

新增6项测试抽取真实changePickedDate/effect/onScroll，使用状态与timer替身，不挂载React，不证明真实FlatList手势。上述270项及全量检查由test_engineer实际执行并报告退出码，executor_qa已读取对应日志核对；没有将既有同步测试结果代替本次滚动验证。

构建、基线/复现/针对性/独立测试以及test_engineer的7份完整检查日志均已复制留存于 `docs/testing/runs/2026-10-29-date-scroll-evidence/`，保留原文件名。报告及本次修改文档后续执行局部Prettier与 `git diff --check` 均退出0，不改变上表全量format:check失败结论。

## 功能执行明细

| 用例/平台/参数                                 | 状态             | 实际证据或边界                                                                                             |
| ---------------------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------- |
| CHECK-009 / Android / QA1.0.11重复选择10/22    | FAIL             | 主代理多次swipe后顶部不动，修改前真实复现                                                                  |
| CHECK-009 / Android / QA1.0.13同日重选         | PASS             | 上一周默认选10/22，再点10/22，向上滑动后AReading可见，见下方截图                                           |
| CHECK-009 / Android / QA1.0.13回今天及重选今天 | PASS（样本范围） | 启动默认今天再点今天可滚动；历史周回今天后再点今天、随后快切日期也可滚动；没有点击禁用的回今天按钮         |
| CHECK-009 / Android / QA1.0.13快速换日         | PASS（样本范围） | 10/27→10/28→10/27→再次10/27，连续ADB tap后向上滑动，已选10/27且AReading可见；不声称精确控制了160ms窗口     |
| CHECK-009 / Android / 正常换日保位置           | PASS             | 非顶部10/27→10/28，日期按钮bounds均为[348,643][468,841]，已选文字均为[84,865][996,919]；随后可继续滑到底部 |
| CHECK-009 / Web、iOS                           | NOT_RUN          | 资源导出及替身测试不等于交互通过                                                                           |

## 缺陷与未覆盖项

本次未清空、卸载或复制任何真实用户数据。代码根因及修复已独立复核，真实新包验证不得用抽取测试替代。跨平台手势、键盘、大字体及后台恢复按实际执行结果分别记录。

## 独立复核与结论

新增稳定用例CHECK-009，APP_MANUAL、COVERAGE、原生技能与CHANGELOG已同步。review_final已独立19/19通过并批准进入构建，无删除或放松测试断言。真实新包上述Android样本已复测通过；Web/iOS交互仍未执行，双手机成功同步仍缺第二台设备。

新包设备执行后，review_final再次独立查看基线及7张新截图、重算两APK摘要、核对270项测试和三端导出日志及冻结diff，复核通过，未发现新阻断。此结论只覆盖所列Android样本与实现/证据；双机LAN-001仍BLOCKED，不代表整体同步验收完成。

## 新包真机执行（主代理）

2026-10-29约00:35—00:42，ADB只连接7c034dd9。QA与常规包均以 `adb install -r <对应APK>` 覆盖安装，实际输出Success、退出0，未卸载或清数据。QA保留AReading在10/28的3/3历史记录、3张可用券及薄荷主题；主应用 `dumpsys package` 实际为1.0.13/code14，首页仍2次、0张券。

滚动操作使用 `adb shell input tap` 和 `adb shell input swipe`，每个结果以 `uiautomator dump` 的日期、任务和bounds核对。正常换日前以150像素/1000ms短swipe滚至非顶部，换日后位置完全相同，继续滑动可见AReading。截图位于 `2026-10-28-lan-evidence/`：

- [默认今天重选后可滚动](./2026-10-28-lan-evidence/qa-scroll-today-1.0.13.png)
- [历史同日重选后可滚动](./2026-10-28-lan-evidence/qa-scroll-same-day-1.0.13.png)
- [连续切日后可滚动](./2026-10-28-lan-evidence/qa-scroll-rapid-dates-1.0.13.png)
- [正常换日前](./2026-10-28-lan-evidence/qa-scroll-offset-before-1.0.13.png)、[正常换日后](./2026-10-28-lan-evidence/qa-scroll-offset-after-1.0.13.png)

常规包点击同步后返回首页，兑换按钮有文字、没有ProgressBar；本来仅2次打卡，兑换按规则禁用，没有为测试改动真实账目。回小组页实际显示“查找超时，尚未完成全部地址检查；请确认双方同一WiFi、保持前台后重试”。PID始终24202，crash buffer只有10/28旧包两次No socket异常，没有本次新增崩溃。NSD Active clients中只有一条Small Steps Sync广告（ID20）。证据：[同步期间首页](./2026-10-28-lan-evidence/home-sync-active-1.0.13.png)、[脱敏超时结果](./2026-10-28-lan-evidence/group-timeout-1.0.13.png)。

另执行一次Home→前台恢复：后台NSD Active clients无广告，恢复后只有一条广告（ID23），PID仍24202，页面dump成功。`git diff --check`实际退出0。

一次同步动画期间 `uiautomator dump` 实际报 `ERROR: could not get idle state.`（工具进程退出0，内容为失败），该次dump不作进度证据；返回首页及超时后重新dump均成功。不将单机超时当作双机成功，也不以旧截图冒充新包结果。

## 构建产物与签名

- QA：`dist/小步日常-QA-1.0.13-20261029.apk`；实际包名 `com.smallsteps.checkin.qa`、名称「小步日常测试」、1.0.13/code14、ARM64、min24/target36；Manifest核验禁备份及 `sprout-qa` 深链。
- QA SHA256：`673b6f774801d4bc433cbf64e36ec33d1a41a6cd133add97a76521c9764f6004`。
- QA的 `aapt dump badging`、`apksigner verify --print-certs`、`aapt dump xmltree`均退出0，现有Android Debug证书SHA256为 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`；仅内部测试签名。
- 常规包：`dist/小步日常-1.0.13-20261029.apk`；实际包名 `com.smallsteps.checkin`、名称「小步日常」、1.0.13/code14、ARM64、min24/target36；SHA256 `1c1b6d48342f607491c5a5e6d53a71d80601c0e608f9a2f747f88cb7cf0d3817`。
- 常规包的 `aapt dump badging`、`apksigner verify --print-certs`、`aapt dump xmltree`均退出0，签名证书与QA及已有常规包一致；保留原 `sprout` 深链、常规FileProvider authorities和 `allowBackup=true`，QA隔离配置未影响常规包。
- 旧1.0.12常规包SHA256仍为 `b4113e72fc7a47fc729e8cb0d7a6f5879edd9c0bf170d4a54c020beb2cdad642`，旧QA1.0.11仍为 `ef166a22319fe9345bb7566de855be172f5f0330ad468f5f169af44da1b60704`，产物未覆盖。
