# 验收记录：相机权限弹窗意外关闭扫码页

## 环境与范围

- 设备：OPPO PJX110，Android16/API36，1080×2376，ADB只接入7c034dd9。
- 基线：隔离QA1.0.14/code15，真实QA存档3次/7张可用券；正式应用不修改权限或数据。
- 用户目标：真机验证其他功能并修复实际缺陷。
- 影响用例：SCAN-001拒绝/再次授权，SCAN-003关闭与后台释放；合法二维码实扫另需独立设备或测试码，本次不以相机启动代替解码/领取成功。
- 主代理唯一操作ADB；不拍摄、录制、保存相机帧，不保存完整券码/邀请码。

## 真机修改前基线

1. `dumpsys package com.smallsteps.checkin.qa`实际CAMERA granted=false、无USER_SET。打开赠券扫码，点击允许使用相机，系统弹出权限框。
2. 点击“不允许”，返回后扫码Modal已经消失，只有打开相机扫码入口；没有展示组件定义的未获得权限错误。权限false、USER_SET。见[拒绝后自动退出扫码](./2026-10-28-lan-evidence/qa-camera-denied-1.0.14.png)。
3. 再打开扫码、再次请求权限，系统仍可请求。点击“使用时允许”，返回后扫码Modal同样消失；权限实际granted=true，但media.camera的Active Camera Clients为空，未启动预览。见[授权后仍自动退出扫码](./2026-10-28-lan-evidence/qa-camera-grant-closed-1.0.14.png)。此截图没有相机帧。
4. 在权限已允许状态再点一次打开相机扫码，实际Active Camera Clients有com.smallsteps.checkin.qa、PID9658、Camera ID0，页面有关闭扫码按钮。说明可再次进入，不能据首次权限流程失败认定相机模块完全不可用。
5. 点击关闭扫码后，Active Camera Clients恢复空。没有保存预览画面。

上述input tap、uiautomator dump、dumpsys有效命令均退出0；页面和系统权限/相机活动同时核对，不用点击命令成功代替业务结果。

## 修复验收范围

核实官方AppState/权限API、源码根因，补有意义的恢复与后台竞态回归；保持实际后台退出相机、关闭后晚权限结果不能重开镜头。实现独立通过后构建新QA/常规包，复测拒绝、重新允许、真实后台与返回、关闭后相机释放。全部结果按实际补记，不用替身代替设备。

## 官方API与生命周期核验

- 本地已安装 `expo-camera57.0.6`、Expo57.0.31、RN0.86.3；没有新增或升级依赖。
- `node_modules/expo-camera/src/index.ts:37`以getCameraPermissionsAsync/requestCameraPermissionsAsync创建useCameraPermissions；`build/index.d.ts:24`精确返回三元组 `[PermissionResponse | null, () => Promise<PermissionResponse>, () => Promise<PermissionResponse>]`。
- `node_modules/expo-modules-core/src/PermissionsHook.ts:34`默认get=true/request=false；`:53`请求await后，仅mounted时发布status，仍返回同一PermissionResponse，异常可reject。卸载扫码容器会阻止hook更新已卸载组件，权限Promise成功不代表CameraView已挂载。
- `node_modules/expo-modules-core/src/PermissionsInterface.ts:24`定义status/expires/granted/canAskAgain；canAskAgain=false应引导系统设置，不能承诺反复点击会再弹系统框。
- Android实际 `node_modules/expo-camera/android/src/main/java/expo/modules/camera/CameraViewModule.kt:82`委托Permissions manager发起请求，`:98`查询权限。
- [RN0.86官方AppState文档](https://reactnative.dev/docs/0.86/appstate)完整curl获取退出0，明确Android background包含另一个Activity及临时系统Activity，即使由本应用/系统启动；本地 `node_modules/react-native/Libraries/AppState/AppState.js:22`相同契约，`ReactAndroid/src/main/java/com/facebook/react/modules/appstate/AppStateModule.kt:46`在onHostPause直接发background。
- 本地 `node_modules/expo-camera/src/Camera.types.ts:392`的active属性只标iOS；Android后台资源释放不能仅依靠此属性，应条件卸载CameraView。Expo57官方camera页面收到部分HTML后20秒超时(exit28)，API依据为完整本地源码，没有声称整页完整读取。

以上引用已提供executor_scroll。旧GiftScanner对每个background直接onClose会卸载扫码容器，原代码控制流与基线回归确认它导致权限框结束后无反馈/无相机；修复后仍需用新包验证实际授权与相机资源生命周期。

实现契约由主代理明确：请求期间出现background统一暂挂镜头并保留Modal，不能仅靠AppState区分Home与权限Activity。授予返回active后显示「已允许使用相机，点击开始扫码」，需再次点击才开镜头；拒绝留页提示。没有请求时background仍关闭，显式关闭始终有效；不能将文档写成授权后自动开相机。

## 版本与验收准备

1.0.15/code16元数据、CHANGELOG、APP_MANUAL、SCAN-001/003权限与生命周期子参数、COVERAGE和原生技能已同步。已核对技能/日志内容新增实际复现的授权误关坑，不更改已证实selectable、mount门控和相机延迟加载规则。

针对性与完整门禁、独立复核、构建及新包设备结果分层记录于下文；不因权限API查证完成声明原生修复通过。已有真机baseline原样保留，完整业务码和相机帧不入报告。

## 独立构建前复核（review_final）

- 已独立审查冻结后的原生GiftScanner和scannerPermission测试。本地RN的AppState契约及Expo权限hook确认原根因；Web独立实现未改。父onClose/onScan通过refs更新，监听生命周期effect依赖为[]，不随父inline回调重建；关闭/卸载递增请求token，try/catch/finally均验证当前token与关闭状态，旧结果不能更新或解锁新界面。
- Node24实际运行 `node node_modules/tsx/dist/cli.mjs --test tests/scannerPermission.test.ts tests/gift.test.ts tests/giftQr.test.ts tests/keyboardFocus.test.ts`，退出0，19/19通过。其中10项扫码替身执行真实组件函数，按依赖比较执行effect的setup/cleanup，覆盖权限结果先到/active先到、拒绝重试、异常、授权期间后台、关闭/卸载后晚结果、父回调重建监听不重装、旧扫码事件向最新回调仅交付一次。
- 此测试替身不挂载React/CameraView、不证明实际系统授权或镜头释放；源码回归不替代新包设备验证。`git diff --check`退出0，当前无阻断性问题，允许进入构建与真机复测。复核者未操作ADB、未改产品代码。

## 实现与针对性执行

executor_scroll冻结 `src/ui/GiftScanner.tsx` 与新增 `tests/scannerPermission.test.ts`。请求期间AppState变更只暂挂相机并记录需要显式继续，拒绝/异常留页反馈，grant在经过background后不自动开镜头；无请求background或显式关闭结束。ref管理单飞、最新回调与卸载标记，拒绝迟到结果和旧帧，保留Web扫码实现。

| 阶段       | 实际命令                                                                                                                                        | 退出码 | 结果/证据                                                                                                                                       |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 相关基线   | `node node_modules/tsx/dist/cli.mjs --test tests/gift.test.ts tests/giftQr.test.ts tests/keyboardFocus.test.ts`                                 | 0      | 9/9；`/private/tmp/xiaobu-scanner-baseline.log`，不覆盖原生授权弹窗                                                                             |
| 旧版复现   | `XIAOBU_SCANNER_BASELINE=1 node node_modules/tsx/dist/cli.mjs --test tests/scannerPermission.test.ts`（临时夹具模式）                           | 1      | 从git HEAD读取旧GiftScanner执行，实际关闭次数1与预期0不符；`/private/tmp/xiaobu-scanner-repro.log`；临时读取旧代码选项已移除，正式测试不依赖git |
| 修改后相关 | `node node_modules/tsx/dist/cli.mjs --test tests/scannerPermission.test.ts tests/gift.test.ts tests/giftQr.test.ts tests/keyboardFocus.test.ts` | 0      | 19/19（新增10项）；`/private/tmp/xiaobu-scanner-final.log`                                                                                      |
| 类型       | `npm run typecheck`                                                                                                                             | 0      | executor_scroll实际执行并报告完成                                                                                                               |
| 局部lint   | `npx eslint src/ui/GiftScanner.tsx tests/scannerPermission.test.ts`                                                                             | 0      | 无warning/error，不等于全量lint通过                                                                                                             |
| 局部格式   | `npx prettier --check src/ui/GiftScanner.tsx tests/scannerPermission.test.ts`                                                                   | 0      | 两文件格式通过，不等于全量format通过                                                                                                            |

初次旧版抽取夹具曾因export解析失败，属于测试夹具错误，不作为产品缺陷证据；修复抽取后才观察到上表1!==0的真实控制流回归。新增10项执行真实组件函数，注入hooks/AppState/权限Promise替身，覆盖授权结果与active事件两种先后、拒绝重试、异常/单飞、Home显式继续、正常后台、关闭/卸载后迟到结果、回调变化与重复帧。该机制不是React挂载或UI E2E，不能证明真实相机资源及三类二维码已通过。

review_final已独立执行19/19并完成diff检查，允许进入构建；本子代理没有操作ADB。

## 完整门禁与构建

test_engineer实际执行以下命令并报告退出码，executor_qa已读取日志核对。日志目录 `/tmp/xiaobu-final-1.0.15-verifier.kCpoj4/`；资源导出不代表系统权限、原生相机或iOS/Web实际UI已通过。

| 检查        | 实际命令                                                                                         | 退出码 | 实际结果/日志                                                                                                                                |
| ----------- | ------------------------------------------------------------------------------------------------ | ------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 全量测试    | `npm test`                                                                                       | 0      | 286/286，`tests.log`                                                                                                                         |
| 类型        | `npm run typecheck`                                                                              | 0      | `typecheck.log`                                                                                                                              |
| 全量lint    | `npm run lint`                                                                                   | 1      | 既有3 errors/3 warnings、无新增，`lint.log`                                                                                                  |
| 局部格式    | `prettier --check src/ui/GiftScanner.tsx tests/scannerPermission.test.ts`                        | 0      | `format-local.log`，不是全量format通过                                                                                                       |
| Web资源     | `npm run export:web -- --output-dir /tmp/xiaobu-final-1.0.15-verifier.kCpoj4/export-web`         | 0      | `export-web.log`                                                                                                                             |
| Android资源 | `npm run export:android -- --output-dir /tmp/xiaobu-final-1.0.15-verifier.kCpoj4/export-android` | 0      | `export-android.log`                                                                                                                         |
| iOS资源     | `npm run export:ios -- --output-dir /tmp/xiaobu-final-1.0.15-verifier.kCpoj4/export-ios`         | 0      | `export-ios.log`                                                                                                                             |
| QA包        | `npm run build:apk -- --qa`                                                                      | 0      | Gradle2m6s，`/private/tmp/xiaobu-build-qa-1.0.15.log`                                                                                        |
| 常规包      | `npm run build:apk`                                                                              | 0      | Gradle1m19s，`/private/tmp/xiaobu-build-1.0.15.log`                                                                                          |
| 完整格式    | `npm run format:check`                                                                           | 1      | 两包结束后稳定重跑，312文件style、无error/ENOENT；`camera-permission-evidence/format-stable.log`；既有Android生成物及9源文件问题，未宣称通过 |

QA产物 `dist/小步日常-QA-1.0.15-20261029.apk`，SHA256 `99d6e557c0460b0fba621777661b208decd06b05d510ff7df8c38e6f975da528`；aapt实际核验 `com.smallsteps.checkin.qa`、小步日常测试、1.0.15/code16、ARM64、min24/target36。apksigner实际退出0，证书仍为既有Android Debug测试证书，SHA256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`。Manifest禁用备份及 `sprout-qa` 深链保留，不是商店正式签名。

## 1.0.15 真机结果（主代理执行）

- QA1.0.15通过 `adb install -r` 安装，未清数据。拒绝系统相机权限后，扫码Modal保持显示，出现“未获得相机权限，请重试或在系统设置中允许，也可以粘贴券码”，且“关闭扫码”仍可用；截图为 `2026-10-28-lan-evidence/qa-camera-denied-1.0.15.png`。系统随后将权限标为 `USER_FIXED`，应用内再次点击授权不会伪造成功结果。
- 通过OPPO系统设置将QA相机改为“使用时允许”，`dumpsys package`确认 `CAMERA granted=true`；真实 `dumpsys media.camera`确认 `Client Package Name: com.smallsteps.checkin.qa`、Camera ID0。点击关闭扫码后确认 `Active Camera Clients: []`。
- 相机运行时按Home并等待4秒，确认 `Active Camera Clients: []`；回到应用未自动重新打开扫码页。QA存档仍为本周3次、7张可用券，未新增业务数据；未保存预览帧或完整业务码。
- 正式1.0.15通过 `adb install -r` 覆盖安装并启动，`versionName=1.0.15`，正式应用相机权限仍为false，页面保留本周2次、0张可用券。旧crash buffer仅有10月28日既有两条记录，本次未出现新的正式包崩溃。

QA安装启动与DEV不由构建成功替代。旧包继续保留，无卸载或清数据。

常规产物 `dist/小步日常-1.0.15-20261029.apk`，SHA256 `49d04ffca223ef46c29a2388cfa9570548cd2384dbca14d30ff1913cbe562f0c`；实际aapt核验 `com.smallsteps.checkin`、小步日常、1.0.15/code16、ARM64、min24/target36；apksigner退出0，证书仍为既有Android Debug测试证书。Manifest保留 `sprout`、`allowBackup=true`，QA隔离配置未影响常规包。

旧1.0.14常规SHA256仍为 `9074d4b058889776286fdec4cbd665a2ee071671866971ec4be4d5e738dcd2eb`，旧QA1.0.14仍为 `b12cc61178642735aa1c9508a73a27133ea1020f88dbbc70653012362c598d36`，未覆盖旧产物。两包核验均实际执行且退出0。基线、回归、门禁、构建日志已复制至 `docs/testing/runs/2026-10-29-camera-permission-evidence/`；该目录内容不含完整业务码、权限口令或相机帧。

review_final已独立19/19及diff检查通过，允许构建；executor_qa未操作ADB。双机同步仍未实测，当前ADB仅连接一台设备。

## 追加：系统授权后明确开始的完整单机路径

同一QA1.0.15与设备，开始时实际CAMERA=false、USER_SET、无USER_FIXED；正式应用未操作权限。此前设置中重新选择不允许留下的状态可继续弹系统框，本次没有用pm grant替代实际用户授权。

1. 从赠送与领取打开扫码并点击允许，实际弹出系统“使用时允许/仅本次使用时允许/不允许”框。
2. 在系统框点“使用时允许”后，实际权限granted=true，扫码页保持，显示“已允许使用相机，点击「开始扫码」继续。”，开始及关闭按钮可用，没有旧拒绝错误。此时系统Active Camera Clients为空，未自动开镜头。此为SCAN-001允许参数的新增DEV证据，不再仅依赖设置授权或替身。
3. 此时保存无预览的截图 `2026-10-28-lan-evidence/qa-camera-granted-wait-start-1.0.15.png`；随后明确点开始，实际相机客户端为com.smallsteps.checkin.qa、PID20129、Camera ID0。未保存镜头画面。
4. 点关闭扫码，实际Active Camera Clients为空并回到“打开相机扫码”入口。
5. 在已授予状态重新打开，系统客户端再次出现；按Home等待4秒后为空。重新回前台仍是赠券页的打开扫码入口、没有关闭扫码按钮，Active Camera Clients仍空，未自动重开。最后重复dump及相机状态命令实际退出0。

以上补齐SCAN-001直接系统允许→显式开始、SCAN-003关闭/后台/前台恢复的单机路径，未识别或领取另一身份二维码，不替代扫码解码成功或双机交换。最终保留QA相机允许，正式应用权限未更改（结束时再次dumpsys确认正式包CAMERA=false）；本轮无业务写入、无代码变更、未重新构建或重跑产品门禁。

review_final独立只读复核新增截图与报告通过：截图仅显示授权后待开始界面，无预览帧、业务码或旧错误，生命周期系统状态及全过程依据主代理实际dump，不由静态截图独立证明。复核者未ADB或改文件，未扩大为实扫/领取或双机通过。报告Prettier和git diff --check实际退出0。
