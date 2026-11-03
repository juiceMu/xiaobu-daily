# 验收记录：冷进程首次扫码快速 Home 的相机重连

## 环境与范围

- 2026-11-01，主代理执行；main，HEAD `95ce109eaa87d95101ce991b1514f44e49198aa8`，保留全部既有改动。关联 SCAN-003、SCAN-001；本轮不制作/领取/使用券、不清档、不改设备时间或权限。
- OPPO PJX110/Android16/480dpi/字体1.0，三星SM-G9730/Android12/420dpi/字体1.3；设备日期11月1日、Asia/Shanghai。ADB在线且实查showing=false。仅操作 `com.smallsteps.checkin.qa` 1.0.25/code26 基线，准备1.0.26/code27候选修复；安装与结果另记。
- 根据项目原生技能及 ui-ux-pro-max 的可中断交互原则保留显式关闭、系统返回和手动重开，不修改依赖目录或靠延迟隐藏失败。已读取本地expo-camera公开pausePreview及原生创建/解绑实现；源码只能提供时序线索，不当作根因或修复充分证明。

## QA25 基线与真实缺陷

临时驱动 `/tmp/xiaobu-fast-camera.cjs` 每次先读UI定位「打开相机扫码」，点击后额外等待指定时间再Home；后台稳定1.6秒后读取系统相机客户端/QA连接事件，再回前台800ms采样并读取UI、延迟2.5秒采样。不扫描实际码，不提交业务。时间为宿主发起/返回命令时间，系统事件精度到秒，不计算镜头释放毫秒延迟。

| 设备与参数                           | 状态 | 实际证据                                                                                                                                  |
| ------------------------------------ | ---- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| OPPO / 本进程首次，额外0ms           | FAIL | `qa25-fast-camera-v2-delay-0`：tap命令结束到Home开始为0ms；后台activeQa=false，返回activeQa=true，17:34:06新增CONNECT；UI随后已无扫码层。 |
| 三星 / 本进程首次，额外0ms           | FAIL | 同前缀：命令间隔0ms；后台activeQa=false，返回activeQa=true，17:34:07新增CONNECT。                                                         |
| OPPO / 暖态额外100、500ms            | PASS | v2结果对应两参数，后台/返回/延迟采样无QA客户端，返回期间无新增QA事件。仅限该次样本。                                                      |
| 三星 / 暖态额外100、500ms            | PASS | 同上；500ms该次甚至没有新增打开事件，不把它当成功扫描或相机确已启动。                                                                     |
| OPPO / 每轮强停QA后的首次，0ms，两轮 | FAIL | `qa25-fast-camera-cold-zero-trial-{1,2}-delay-0`：两轮返回重连，后续failure-late客户端虽为空，仍保留新增CONNECT/DISCONNECT失败。          |
| 三星 / 每轮强停QA后的首次，0ms，两轮 | FAIL | 同上，两轮返回重连，稳定最终空态不能掩盖过渡期失败。                                                                                      |

证据均位于 `/tmp/{device}-` 加表内前缀；对应 `-results.json`、`-background-camera.json`、`-resumed-camera.json`、`-resumed.xml`、`-failure-late-camera.json`。两机v2及cold-zero驱动均实际退出1，不把部分PASS写为整个驱动通过。

另做暖态0ms连续三轮，驱动各退出0，但旧临时驱动证据文件同名覆盖，仅末轮树/相机快照保留，不能声称三轮都有独立证据。结果保留在 `qa25-fast-camera-warm-zero-results.json`；后续驱动已按trial编号区分。不用于关闭冷态失败。

准备阶段错误用了 `sprout-qa://gifts` 而停在更多，两机最初三个参数均因目标0个退出1，尚未点击相机；实查App.tsx嵌套路由后改为 `sprout-qa://more/gifts`。这是测试准备错误，不是产品缺陷或参数已执行证明；原始无v2后缀证据保留。

## 候选修复与自动化

- 原先对象ref可能在effect清理前清空；改为稳定回调ref，解绑时暂停捕获的旧实例，迟到ref在已关闭/后台/不允许预览时立即暂停。保留原AppState/显式关闭/卸载兜底、异常捕获和权限流程。不能仅据此断言expo原生异步初始化竞态已消除。
- `tests/scannerPermission.test.ts` 替身仍执行真实组件函数；补充先解绑ref再清理、后台关闭后迟到ref两项；校正替身避免每次观察render都伪造新相机实例。不是挂载React或真实镜头测试。
- 修改前原15项实际通过；追加两项后退出1、两个新增参数失败，`/tmp/qa26-ref-regression-red.log`。初版新实现遇到替身每render新实例导致暂停计数失败，保留 `/tmp/qa26-ref-regression-green.log`；校正替身后17/17通过、退出0，`/tmp/qa26-ref-regression-green2.log`。
- 已核对原生技能与CHANGELOG：记录冷/暖进程差异、真实命令时间、解绑及迟到ref风险，不把QA25稳定通过升格成快速时序通过。版本五处同步1.0.26/code27，包名、依赖及签名不变，旧包保留。APP_MANUAL规则不变，无需修改。

## 独立复核与未完成项

按omc-reference再次派发verifier及executor，两者均返回任务正文为空、未读取或执行。主代理完成以上测试与候选改动，没有有效独立复核，不自批准。

QA26构建、实际APK核验、安装和真机回归尚待实际结果追加。摄像头三类码实扫、请求期间Home/关闭、迟到权限、iOS/Web和全功能仍未完成。当前存在QA25双机冷首次快速Home的明确失败，不能声明所有功能通过或本缺陷已解决。

## QA26产物拒绝与最终候选QA27

- QA26全仓lint新增 `react-hooks/refs` 错误：JSX读取cameraAttachment.current。保留 `/tmp/qa26-lint.log`，未把它归为既有失败。改为useCallback并补替身稳定回调模拟；最终针对性17/17通过、退出0，`/tmp/qa26-ref-regression-final.log`。局部eslint退出0。
- QA26构建实际成功（1m14s，523任务），产物 `dist/小步日常-QA-1.0.26-20261101.apk`，SHA256 `351d0216c1fed67bd5ec85eaaba7d88a0108a9353964504111b4c8e12f52ff18`。但构建期间修正lint，实际source map确认found=true、sourceMatchesCurrent=false、hasUseCallback=false。因此该产物保留、不安装，不冒称最终修复包。
- 随后源码冻结，五处元数据递增为1.0.27/code28，CHANGELOG明确候选历史与拒绝原因，重新用默认build:apk入口构建。没有覆盖旧产物或更换签名。最终候选检查结果如下。

| 命令                        | 退出码 | 结果                                                                                                             |
| --------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------- |
| QA26 `npm test`             | 0      | 316/316；`/tmp/qa26-test.log`，是较早实现检查，不能替代最终源码。                                                |
| QA26 `npm run typecheck`    | 0      | `/tmp/qa26-typecheck.log`。                                                                                      |
| QA26 `npm run lint`         | 1      | 既有2错误/2警告外，新增1个refs错误；随后已修正。                                                                 |
| QA26 `npm run format:check` | 1      | 391文件告警；`/tmp/qa26-format.log`。                                                                            |
| QA27 `npm test`             | 0      | 最终源码316/316、无失败/跳过；`/tmp/qa27-test.log`。                                                             |
| QA27 `npm run typecheck`    | 0      | `/tmp/qa27-typecheck.log`。                                                                                      |
| QA27 `npm run lint`         | 1      | 仅既有create-app-icon.cjs两处__dirname错误、TodayScreen两Hook警告；无GiftScanner新增错误；`/tmp/qa27-lint.log`。 |

本轮独立复核缺口仍存在，以上主代理执行不是独立批准。QA27真机结果未取得前，冷首次快速Home缺陷保持未关闭。

## QA27 实际产物与安装

- `npm run build:apk -- --qa`，Node24/JBR25/Android SDK本机路径，实际退出0：BUILD SUCCESSFUL in1m42s，523任务、50执行。日志 `/tmp/qa27-build.log`；Android bundle及source map实际读取后，GiftScanner sourcesContent与当前源码逐字一致，断言退出0。不是只凭文件日期判断。
- 产物 `dist/小步日常-QA-1.0.27-20261101.apk`，SHA256 `4ace80f841b82eef90d70503f171ffba0d8338fcbb82a8b2963f28a45aa7ce59`。aapt实际确认com.smallsteps.checkin.qa、1.0.27/code28、min24/target36。apksigner verify退出0，CN=Android Debug、证书SHA256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`；内部测试签名，不是商店签名。
- 两机 `adb install -r` 均Success/退出0，dumpsys各确认1.0.27/code28，QA存档保留。后续冷启动均使用正确赠送页深链并取得可操作扫码入口。
- `npm run export:ios -- --output-dir <独立临时目录>` 实际退出0，输出 `/tmp/xiaobu-qa27-ios.p9jetc`；日志 `/tmp/qa27-export-ios.log`。仅资源导出，不是iOS安装或镜头验证。Android资源由实际APK构建执行，未另跑export:android；Web专用scanner未改，未运行缺失的Web UI runtime或export:web。
- QA27 `npm run format:check` 退出1、392文件告警，`/tmp/qa27-format.log`；比前轮多的运行记录当时未局部格式化，不能将全部392都说成既有告警。随后产品修改文件、版本文件、CHANGELOG和本记录的局部Prettier检查退出0，不替代全仓格式通过。

## QA27 冷首次快速 Home 结果：候选修复不足

两机各执行 `node /tmp/xiaobu-fast-camera.cjs <device> cold-zero 0,0 qa27`，驱动实际均退出1：每轮强停隔离QA后首次打开扫码，命令间额外等待0ms，两轮都在后台无QA镜头、回前台activeQa=true且新增CONNECT，延迟再采样虽已空仍记FAIL。

| 设备 | 两轮参数结论 | 事件证据（系统秒精度）                                            |
| ---- | ------------ | ----------------------------------------------------------------- |
| OPPO | FAIL / FAIL  | 返回新增CONNECT为17:47:41、17:47:58，随后17:47:42、17:47:59断开。 |
| 三星 | FAIL / FAIL  | 返回新增CONNECT为17:47:42、17:47:58，随后17:47:43、17:47:59断开。 |

真实结果与每轮相机/界面证据以 `/tmp/{device}-qa27-fast-camera-cold-zero-` 为前缀，文件包括results.json与trial-1/2-delay-0的background/resumed/failure-late-camera.json。没有重解释为通过、放松断言或把最终空态覆盖失败。稳定回调ref补强有替身依据，但新包证明它不足以消除本次原生快速竞态；缺陷仍开放，需要继续定位，不能宣布修复完成。

QA27随后每轮冷启动额外等待100/500ms，两机驱动各退出0，后台/返回/延迟采样无QA镜头、返回事件无变化；证据 `qa27-fast-camera-cold-delays-trial-{1,2}-delay-{100,500}`。部分样本没有新增CONNECT，故仅证明快速取消路径本次未自动开启，不是相机成功预览或真实扫码证明，不能覆盖立即Home失败。

## QA28：首次挂载状态与漏事件补强

- 继续检查首次动态加载窗口：GiftScanner原来初始cameraEnabled=true，且只订阅后续change，不能处理首次render前已后台或render到effect间漏事件。以此作为修复假设，不宣称仅凭源码已证明唯一原生根因。
- 新增这两个具体替身参数，修改前 `/tmp/qa28-mount-red.log` 退出1，两新增项closed实际0、期望1；实现后 `/tmp/qa28-mount-green.log` 退出0、19/19。初始预览允许值改为实际AppState；订阅后立即核对当前状态，后台时沿用关闭流程。原权限请求期间的暂挂、拒绝反馈、显式继续与ref兜底保留。
- 版本五处一致1.0.28/code29；按项目技能复核日志/流程并补充首次挂载漏事件风险，未升级依赖、修改node_modules或正式包。代码冻结后再构建，QA25/26/27包都保留。

| 最终源码命令           | 退出码 | 实际结果                                                    |
| ---------------------- | ------ | ----------------------------------------------------------- |
| `npm test`             | 0      | 318/318，无失败/跳过，`/tmp/qa28-test.log`。                |
| `npm run typecheck`    | 0      | `/tmp/qa28-typecheck.log`。                                 |
| 定向eslint             | 0      | GiftScanner及scannerPermission测试。                        |
| `npm run lint`         | 1      | 既有2错误/2警告，无本轮新增扫码错误，`/tmp/qa28-lint.log`。 |
| `npm run format:check` | 1      | 391文件告警，`/tmp/qa28-format.log`；未全仓格式化。         |

QA28实机参数以随后追加的结果为准；此前QA27失败不被删除或改写。

## QA28 产物、安装与最终失败证据

- `npm run build:apk -- --qa`实际退出0、1m23s、523任务，`/tmp/qa28-build.log`。产物 `dist/小步日常-QA-1.0.28-20261101.apk`；SHA256 `3d87c739f0253e47df410acc7813e05a4060672466bfe3c2794d43ab4c85521e`。实际source map的GiftScanner与当前源码逐字相同，断言退出0。
- aapt实际1.0.28/code29、包名com.smallsteps.checkin.qa、min24/target36；apksigner verify退出0，沿用CN=Android Debug及前述相同证书摘要。两机install -r各Success/退出0，dumpsys均确认1.0.28/code29，非正式包。
- iOS资源导出实际退出0、`/tmp/qa28-export-ios.log`，独立输出 `/tmp/xiaobu-qa28-ios.Z0Zovp`；不是iOS安装/扫码通过。Android由APK构建执行bundle；Web runtime、独立export:android/export:web未执行。
- 两机各执行相同冷首次 `cold-zero 0,0 qa28`，驱动各退出1，每台两轮仍FAIL。OPPO返回新增CONNECT17:55:01/17:55:19，三星17:55:02/17:55:19；后续分别17:55:02/20、17:55:03/20断开。每轮背景无QA镜头，返回activeQa=true；延迟最终空态仍不改变失败。
- QA28证据前缀 `/tmp/{device}-qa28-fast-camera-cold-zero-`，含results.json及每轮独立相机JSON/返回UI。初始AppState与订阅后核对补强也不足以消除本缺陷，不能宣布已修复。没有删除失败、延长0ms等待或以暖态替代冷态。

## 后续修复范围与结论

目前已验证的事实是QA25/27/28在同一双机冷首次快速Home步骤均重连。已安装expo-camera Android源码存在异步取得ProcessCameraProvider后绑定Activity的路径，pausePreview设置previewPaused并unbindAll；这提示需要进一步评估原生创建/暂停窗口，但不是已证明唯一根因。

项目原生技能明确禁止直接修改node_modules；本轮未改依赖、未擅自升级。下一步如需原生依赖补丁，应先取得用户明确许可，再采用固定版本/上下文校验、可复现构建的项目维护方案，并保留同一双机失败基线。不能靠连续JS试补构建将问题宣称关闭。

全功能目标仍未完成：本缺陷开放、独立复核不可用、全仓lint/格式既有问题及其他未测功能均保留。此次有实际缺陷发现、分型、失败候选排除及新增防护回归，但最终验收结论为**不通过，待继续修复**。

收尾实际执行：两机 `xiaobu-member-sync-cold.cjs <device> qa28-post-camera-cold` 各退出0、coldLaunch=true，检查全组81可用/23已用、QA78/11、QAS3/10不变，本人按钮enabled、他人无使用入口，并回更多页；证据 `/tmp/{device}-qa28-post-camera-cold-proof.json` 及相同前缀XML。仅证明所列UI片段，不证明整库或outbox逐字节不变。随后两机系统Active Camera Clients均为[]，没有后台遗留镜头。全部构建、安装、驱动与导出会话均已终态；修改文件及本记录局部Prettier检查退出0，不是独立批准或全仓通过。
