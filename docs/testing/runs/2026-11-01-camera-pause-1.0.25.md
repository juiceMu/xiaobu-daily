# 验收记录：原生扫码主动暂停预览 QA1.0.25

## 变更与环境

| 项目             | 实际内容                                                                                                                                                                         |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 需求/验收标准    | 测试发现缺陷需修复；扫码无权限请求时Home后释放，回前台不自动重连；手动重开、显式关闭及系统返回仍可用                                                                             |
| 日期、执行与复核 | 2026-11-01；主代理执行；独立代理正文传输异常，尚无有效本轮独立复核                                                                                                               |
| 提交/工作区      | main，HEAD `95ce109eaa87d95101ce991b1514f44e49198aa8`；保留已有页头、账户、导航、文档等未提交改动；本轮追加GiftScanner及其测试、版本/日志/用例/覆盖/项目技能与记录；未提交或推送 |
| 平台             | OPPO PJX110 Android16、三星 SM-G9730 Android12，均已解锁；隔离QA `com.smallsteps.checkin.qa`，升级为1.0.25/code26                                                                |
| 工具             | Node24.22.1；Android Studio JBR25.0.4、SDK `/Users/mac/Library/Android/sdk`；命令级环境覆盖，不改全局配置                                                                        |
| 日期与数据       | 设备CST、11月1日，未改系统时间；已有独立QA身份/存档与相机授权；不清数据、不制作/领取/消费券，不操作正式包                                                                        |
| 影响范围         | SCAN-003生命周期；SCAN-001权限编排及迟到结果回归。非F0；不声明全部扫码或业务通过                                                                                                 |

## 基线与实现

- 基线见[三星QA24](./2026-11-01-samsung-camera-qa24.md)：稳定客户端为空，但两次回前台均出现额外CONNECT/DISCONNECT。保留旧失败线索，不以新结果覆盖历史。
- 本地已安装官方库源码/注释实查：CameraView公开`pausePreview(): Promise<void>`；Android实现设置previewPaused并unbindAll；相机原本bindToLifecycle当前Activity。React Native AppState由原生生命周期发异步事件，故仅React setState卸载不能作为原生恢复期间不会再连接的证据。这个机制支持修复方向，不能单凭源码证明全部时序根因。
- GiftScanner增加CameraView ref，在background、显式关闭和清理时尝试pausePreview，仍执行原有关闭/卸载。捕获同步异常和Promise拒绝，不让暂停失败阻止退出；没有镜头时不发命令。保留权限请求暂挂、显式继续、迟到结果保护及动态import，不改依赖或node_modules。
- 使用ui-ux-pro-max保留原生关闭/返回入口及权限反馈；按项目原生技能核对相机生命周期和打包边界。官方网页查询服务返回HTTP500，未获得网页内容；API依据为已安装库的实际实现、类型与注释，不凭记忆编造。
- 已逐项核对CHANGELOG与项目原生技能，追加本次真实踩坑及验证规则；APP_MANUAL原有后台释放/显式继续规则不变，无需另改说明。版本五处根版本与Android构建号同步，不改包名或签名。

## 自动化与质量检查

| 阶段/命令                                           | 退出码  | 实际结果                                                                                                                                         |
| --------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 修改前 `tsx --test tests/scannerPermission.test.ts` | 0       | 10/10；不覆盖原生暂停命令                                                                                                                        |
| 仅追加回归后，同命令                                | 1       | 15项中11通过、4失败，均因期望原生暂停而实际计数0                                                                                                 |
| 实现后，同命令                                      | 0       | 15/15；包含未挂镜头不暂停、下一次渲染前发命令、关闭/清理时暂停成功/拒绝/同步抛错                                                                 |
| `npm run typecheck`                                 | 0       | tsc无错误                                                                                                                                        |
| `npm test`                                          | 0       | 314/314；`/tmp/qa25-npm-test.log`                                                                                                                |
| `npm run lint`                                      | 1       | 既有create-app-icon.cjs两处__dirname错误；TodayScreen两条applyListScroll依赖warning。GiftScanner未新增报告                                       |
| `npm run format:check`                              | 1       | 391文件告警，含已有源码/报告及Android生成文件；`/tmp/qa25-format.log`；未全局格式化或忽略规避                                                    |
| 定向Prettier检查                                    | 0       | GiftScanner、scannerPermission测试、CHANGELOG、package/lock/app及真实成员测试记录通过；不代替全量检查                                            |
| `npm run export:ios -- --output-dir dist-ios-qa25`  | 0       | 资源导出成功；`/tmp/qa25-export-ios.log`。新生成目录随后移到`/tmp/xiaobu-qa25-export.eh31TU/ios`，避免把未忽略输出混入工程；未删除旧包或用户文件 |
| `npm run build:apk -- --qa`                         | 0       | BUILD SUCCESSFUL in1m47s，523tasks、50executed/473up-to-date；`/tmp/qa25-build.log`，含Android bundle构建                                        |
| 单独export:android / export:web                     | NOT_RUN | Android由实际QA构建执行bundle；Web有专用未改的scanner实现，未运行浏览器runtime。资源或构建不能替代设备交互                                       |

替身测试执行真实组件函数但不挂载React；人工装入ref用于验证命令编排，不证明真实卸载阶段ref时序、相机占用或预览。暂停失败尚无真机可控注入。

## 产物、安装与启动

- APK：`dist/小步日常-QA-1.0.25-20261101.apk`，旧版本保留。
- SHA256：`30f26112855780f92ef54ba9f2be969b7f1e3df24f407c628ba92c337c77d1bf`。
- aapt实际核对：包名`com.smallsteps.checkin.qa`、versionName1.0.25/code26、min24/target36。
- apksigner verify退出0，CN=Android Debug，证书SHA256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`。仍为内部测试签名，非商店正式签名。
- 两机`adb install -r`均Success/退出0；分别dumpsys确认1.0.25/code26，QA赠送页深链冷启动Status:ok。保留QA数据，不覆盖正式包。

## 真机执行明细

以下各行分别在两台手机实际执行；不是将一机结果扩展到另一机。每次点击前读取当前UI，确认目标enabled/clickable；UI稳定后同时读取系统客户端及最近事件。

| 用例/参数                           | OPPO | 三星 | 证据与实际结果                                                                                                                                                     |
| ----------------------------------- | ---- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| SCAN-003 / 已授权打开               | PASS | PASS | `/tmp/{device}-qa25-scanner-open.xml`有关闭扫码，`camera-open.txt`的Active Camera Clients含QA                                                                      |
| SCAN-003 / Home后释放，第一轮       | PASS | PASS | `camera-home.txt`客户端为空；回前台`scanner-resume.xml`为打开相机扫码、无关闭扫码；`camera-resume.txt`无返回后额外CONNECT                                          |
| SCAN-003 / 重开后Home再返回，第二轮 | PASS | PASS | `scanner-repeat-open.xml`有关闭扫码；`camera-repeat-home.txt`和`camera-repeat-resume.txt`均空；最近事件仍只有手动打开的CONNECT及后台DISCONNECT，无恢复期间额外重连 |
| SCAN-003 / 手动再开并显式关闭       | PASS | PASS | `camera-close-open.txt`先确认QA活跃；`scanner-closed.xml`回赠送页、无关闭扫码，`camera-closed.txt`客户端为空                                                       |
| SCAN-003 / 再开后系统Back           | PASS | PASS | `back-open.xml`先确认扫码UI；`scanner-native-back.xml`回赠送页、无扫码弹窗，`camera-native-back.txt`客户端为空                                                     |

证据前缀：OPPO为`/tmp/7c034dd9-qa25-`，三星为`/tmp/R28M22J0K3D-qa25-`；表内camera文件均接在该前缀之后。原始XML和camera日志保存在本机，未保存交换码或业务库。

- 第一轮两机手动CONNECT均14:54:46、后台DISCONNECT均14:55:04；回前台后没有新增QA CONNECT。
- 第二轮两机手动CONNECT均14:55:35；OPPO后台DISCONNECT14:55:38、三星14:55:39；回前台后未新增CONNECT。日志精度到秒，不据此计算释放毫秒数。
- Node只读断言已检查第二轮稳定客户端为空及最近事件顺序；另检查两机关闭/Back后界面有打开相机扫码、无关闭扫码，系统客户端为空，退出0。这是现场日志检查，不是项目E2E自动化层级升级。
- 收尾分别点击更多，新UI树均含账户资料及里程碑，系统相机客户端为空；证据`/tmp/{device}-qa25-final-more.xml`、`/tmp/{device}-qa25-camera-final.txt`，Node只读断言退出0。所有本轮构建、安装与设备操作会话均已结束。

## 缺陷与未覆盖项

- QA24回前台短暂重连在QA25本次两机各两轮未再出现；只能关闭已执行参数，不能保证所有设备/调度/快速操作时序均已覆盖。
- 极快打开即Home、权限请求中Home/关闭、系统无法暂停预览、迟到原生创建完成、三类真实码/坏码/重复帧仍需原生补测；不能用15项替身替代。
- 新包未做赠送领取/回执、小组邀请及TASK/CHECK/REWARD/TICKET全部写入冒烟；本轮没有消费业务。其他全量目标缺口继续按覆盖审计及后续记录保留。
- iOS仅资源导出，未安装设备；Web UI runtime未运行，均不声明真机通过。页头间距上轮证据不自动升级为新包全功能重测。

## 独立复核与结论

- executor_camera_pause收到任务后反馈正文为空，未执行；主代理完成代码和验证。此前独立verifier初始及补发均有相同通道问题，尚无本轮有效独立批准，不自批准、不虚构审核。
- 已维护SCAN-003原编号下的事件日志检查步骤、COVERAGE替身层级及项目技能；未放松断言或用最终空态掩盖过渡事件。
- 结论：原生扫码主动暂停修改、自动化及本次双机生命周期参数已取得证据；独立复核和未覆盖边界待补，全部功能目标未完成。
