---
name: android-native-crash-avoidance
description: >-
  避免本仓库 Android 真机闪退与交互踩雷（EditText 进页崩溃、账户页 TouchableRipple、
  selectable、Modal、键盘焦点、hover 闪烁、滚动条、安装包命名）。在新增/修改含输入框、
  弹窗、相机、相册、筛选按钮的页面，或排查闪退、hover、打包 APK 时使用。
---

# Android 真机闪退与交互踩雷

本仓库用 Expo/RN New Arch + Hermes + native-stack（`animation: 'none'`）。
下列问题已在真机出现过，改 UI 时必须遵守。

## 进页闪退（最高优先级）

**现象**：点进「赠送与领取」「账户资料」等页后立刻进程退出；Web 往往正常。
1.0.6 仍会在进「账户资料」时闪退；1.0.7 真机确认进页不再闪。

**根因**：栈切换未完成时挂上 `EditText` / 可选中文本 / 多个原生 `Modal` / Paper `TouchableRipple`，
或上一页输入框仍持有焦点，Android 抛
`IllegalArgumentException: parameter must be a descendant of this view`
（`setTextIsSelectable` / 无障碍子树竞态）。只延迟挂载、仍立刻铺一排 Paper ripple，挡不住。

### 必须遵守

1. **Android 禁止进页立刻挂原生输入**
   - 用 `AppTextInput`（已实现：Android 先显示可点按占位，点后再挂 `RNTextInput`）。
   - 新输入框不要直接用 `react-native-paper` 的 `TextInput` 或裸 `TextInput` 作为进页首屏控件。
   - Android 路径只传原生安全属性，禁止把 Paper 的 `left` / `right` / `dense` / `mode` 等塞进 `RNTextInput`。

2. **进页含输入的栈页延迟正文**
   - 使用 `useAndroidMountReady`（默认 450ms，`InteractionManager` 之后再 `requestAnimationFrame`）。
   - 控件多的账户页用 `useAndroidMountReady(600)`。已用于：`GiftsScreen`、`AccountScreen`、`SettingsScreen`、`GroupScreens`。
   - 新栈页若首屏有输入或一排可点原生控件，同样门控。延迟不能代替少挂 Paper 控件。

3. **跳进账户页前先收起键盘**
   - `MoreScreens`、`GiftsScreen` 在 `navigate('account')` 前调用 `Keyboard.dismiss()`。
   - 上一页 `EditText` 还持有焦点时推入新页，会在离页/进页时触发同一类竞态。

4. **`selectable` 在 Android 关闭**
   - `selectable={Platform.OS !== 'android'}`。
   - 可选中文本与 EditText 同类崩溃路径。
   - 2026-10-29 QA1.0.13实际长按完整赠券码不能复制；交换码须提供明确复制按钮，不能仅保留“长按复制”提示，也不能重新开启Android selectable作为修复。赠券码、回执、邀请码三入口均需覆盖。
   - SDK57本地兼容表指定 `expo-clipboard ~57.0.2`，`setStringAsync`返回 `Promise<boolean>`；只在true时反馈成功，false/异常有失败提示且不泄露码。保留页面mount门控，禁止用开启文本选择代替新原生模块构建；Web剪贴板返回不等于真实粘贴已验证。

5. **不可见时不挂 Modal**
   - `FormModal` / `ConfirmationDialog`：`if (!visible) return null`。
   - 其它 `Modal`（`TimeField`、里程碑奖励历史等）同样：`{visible ? <Modal .../> : null}`。
   - 禁止进页一次挂多个 `visible={false}` 的原生窗口。

6. **父视图 `collapsable={false}`**
   - 包住输入的容器、`AppTextInput` 根节点、延迟占位 `View`、账户页延迟后的正文根 `View` 均需设置，避免 Yoga 折叠父节点后 EditText 挂载崩溃。

7. **账户头像预设用 `Pressable`，不用 Paper `TouchableRipple`**
   - 1.0.5 换成 `TouchableRipple` 后，1.0.6 进账户页仍闪。1.0.7 改为 RN `Pressable` 后真机不再闪。
   - 进页就铺多枚带 `accessibilityRole="radio"` 的 Paper ripple，和 EditText 同类无障碍竞态。
   - 主题选择仍可用 `TouchableRipple`（设置页已验证可进）。新的一排选项优先 `Pressable`。

8. **`ScrollView` 含输入时**
   - `removeClippedSubviews={false}`（`Page`、`FormModal` 已设）。

## 交互与视觉踩雷

| 问题                                                  | 规则                                                                                               |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| hover/按压面积大于胶囊                                | 反馈底色画在内层 `contentStyle`；外层触控区透明；`rippleColor="transparent"`（Web 与需对齐的原生） |
| 筛选来回点闪烁                                        | 已选中不再叠悬停底色；悬停仅 Web；`transitionDuration: '0ms'`                                      |
| Paper `Button` 或进页一排 `TouchableRipple` + `radio` | 账户头像用 RN `Pressable`；主题选择可用 `TouchableRipple`                                          |
| 列表滚动条                                            | `showsVerticalScrollIndicator={false}` 且 `showsHorizontalScrollIndicator={false}`                 |

重型原生能力（相机 `GiftScanner`、二维码 `GiftQrCode`）**用到时再 `import()`**。
`AccountScreen` 的 `expo-image-picker` / `expo-image-manipulator` 保持静态 import：`pickAvatar` 的源码测试依赖这些绑定，且 1.0.7 未改 import 即已止住进页闪退。不要为“延后加载”改成动态 import。

## 扫码授权与AppState（2026-10-29 真机复现）

QA1.0.14首次拒绝/随后允许相机权限后扫码Modal都关闭，系统granted=true但Active Camera Clients为空。RN0.86的Android background包含另一个Activity及系统临时Activity，不能把权限请求期间每次background直接当作用户关闭扫码。请求期间保留容器/拒绝反馈但卸载镜头；AppState不能区分Home和系统Activity，所以暂挂后回active并获准也应让用户明确点「开始扫码」，不自动开镜头；无请求时background仍关闭扫码。不要仅靠CameraView.active属性保证Android释放，该版本属性只标iOS。useCameraPermissions请求Promise返回PermissionResponse（granted/status/canAskAgain），错误需捕获、关闭/卸载后迟到结果不应重开相机。新包验证实际预览与资源释放，不能只查权限或用回调替身宣称相机通过。

## 日期选择与列表滚动（2026-10-29 真机复现）

主代理在隔离QA1.0.11上重复选择10月22日后，多次swipe观察到列表顶部不动。回调/effect抽取回归确认：同key重选会设置恢复ref但不触发依赖所选日期的effect，导致恢复状态持续回拉。有效日期相同应清理恢复ref，同时保留null跟随今天语义；480ms恢复窗口内重选后，旧timer也须检查恢复状态仍有效才回拉。维护日期切换保位置时，必须回归同日重选、重复回今天及快速换日；修复后须新QA包实测，回调替身不能代替真实FlatList手势。

## 账户/大图

脏检查不要对整份头像 `JSON.stringify`（大 data URI 每帧序列化易卡死/OOM）。按 `kind` / `id` / `dataUri` 字段比对。
相册头像 `Image` 设置 `resizeMethod="resize"`，避免进页按原图像素解码。

## 已证伪（不要再当修复）

- 只加 `useAndroidMountReady(300)`、Android 点按后再挂 `EditText`、关掉 `selectable`、去掉不可见 `Modal`：1.0.6 仍进账户页闪退。
- 去掉 Android `nativeID`：测试要求保留 `nativeID={labelId}`，且不是 1.0.7 的有效改动。

## 打包与版本

### QA深链双层配置（2026-10-29 真机复现）

- QA1.0.15已由系统接收 `sprout-qa://more/account`，冷热启动仍停原页/今日；正式 `sprout://` 可进入账户、成长、赠券、小组。Expo `Linking.createURL` 从Expo配置解析协议，不会自动读取Gradle QA的 `appScheme` 占位。导航 `prefixes` 必须显式兼容QA协议，同时保留开发和正式前缀；不要改全局Expo scheme或给正式Manifest额外注册QA协议。官方导航库路径解析回归不代替新APK冷热启动与返回键真机验证。

### TCP 原生连接清理（2026-10-28 真机故障）

- `react-native-tcp-socket@6.4.3` 在 socket 注册前失败后，JS 错误处理仍会调用 destroy；原生 end 的缺失 ID 查询可抛 `No socket with id` 杀进程，JS try/catch 无法拦住。`scripts/patch-tcp-socket.mjs` 在 postinstall 与打包入口保证 end 对缺失 client 安全返回；依赖版本或补丁上下文变化必须显式复核，不静默跳过。
- 不对整个网段一次排入24路连接：原生执行器只有2线程，会延迟销毁、关闭和后续连接。探测须限制并发及预算，并等待已开始任务清理。
- 通过已读取的 WiFi IPv4 `localAddress` 绑定连接，不对每个探测使用 `interface: 'wifi'` 触发共享 currentNetwork 与 requestNetwork 线程风险。
- 以上根因有旧版真机崩溃日志；新版本是否止住崩溃及是否完成双机同步，分别以新 APK 设备证据确认。
- 监听的单飞范围须覆盖整个异步生命周期（读取WiFi、listen、publish、unpublish），不能只锁读取WiFi。1.0.11实际系统NSD记录出现同名重复发布；同IP网络通知应合并且不重建监听，切IP须先撤销旧广告。stop不能取消已提交到原生的publish，须待其返回名称后撤销，并处理迟到listen回调/连接。撤销失败须保留服务名供重试，不先清空名称再发布第二条广告；原生错误处理已关闭的server不重复close。回调替身仅验证编排，服务残留修复与双机成功须分别真机复测。
- 单飞还须跨 `startLanListener` 实例：快速前后台会旧stop紧接新start，新实例须通过共享lease等待旧监听与广告清理完成，不能仅各实例内部串行。`getInput()`可因本地保存busy临时返回null，不能据此撤销同IP服务；组状态/前后台由Provider生命周期决定，忙碌时新入站连接单独拒绝即可。

- **每次打安装包都先检查本技能与 `CHANGELOG.md` 是否需要更新**：对照上次包之后的实际代码、故障证据和用户要求；有新增原生风险、打包步骤、默认动作或用户可见变更就更新对应内容。无需修改时在验收记录注明检查结果，不为凑更新杜撰规则，也不擅自在线升级外部技能。
- 此技能位于项目 `.cursor/skills/android-native-crash-avoidance/SKILL.md`，不是仅Cursor可用；Codex等执行者按根 `AGENTS.md` 默认读取。维护技能时保持已证实真机规则，不把Node替身或资源导出说成设备证据。
- 升 `app.json` `version`、`android.versionCode`、`android/app/build.gradle` 的 `versionName`/`versionCode`、`package.json` 及 `package-lock.json` 两个根 `version`，不改依赖版本来凑一致。
- 默认入口：`npm run build:apk`；只验证元数据时用 `npm run build:apk -- --check`。脚本检查版本一致、当前更新日志及技能文件存在，**不能自动判断技能与更新日志的内容是否完整**，上面的人工/代理审查仍必做。
- 已交付APK存放在 `dist/`；执行Expo资源导出时显式指定独立输出目录，不能让默认输出目录覆盖或清理现有交付物。资源导出仍不等于设备验收。
- 同机写操作回归使用 `npm run build:apk -- --qa`：独立包名 `com.smallsteps.checkin.qa`、应用名「小步日常测试」、深链 `sprout-qa`、独立存储且禁止系统备份；不导入真实存档/邀请码。QA沿用release业务和测试签名，交付物带 `-QA`，不能拿常规应用做新增/删除/消费测试；QA构建成功仍需实际核对APK及独立安装启动。
- 本地构建：`JAVA_HOME`=OpenJDK 17，`ANDROID_HOME`=commandlinetools；国内网络用  
  `./android/gradlew -p android assembleRelease --no-daemon -I "$PWD/android/init.aliyun.gradle"`，再拷到 `dist/小步日常-{version}-{YYYYMMDD}.apk`。
- 沿用已配置签名，不擅自更换密钥。当前release配置使用debug测试签名；此类包适合内部覆盖测试，不应宣称商店正式签名。打包后实际核对APK版本、包名、签名与SHA-256，不覆盖旧交付物。
- 同步 `CHANGELOG.md`。`dist/` 在 `.gitignore`，安装包不入库；用户只要求打包不代表授权commit、push或商店发布。
- 新增原生依赖（如 `react-native-tcp-socket` / `react-native-zeroconf` / `modules/sprout-identity`）必须打**新 APK**；仅热更 JS 不会带上原生模块。
- 真机闪退必须以**新 APK 覆盖安装**验证；本机无设备时不得声称已验证。局域网同步同理，不得在未装新包时声称 mDNS/TCP 可用。

## 改动自检清单

新增或修改屏幕时勾选：

- [ ] 首屏是否有输入？Android 是否走 `AppTextInput` 点按再挂载 / `useAndroidMountReady`？
- [ ] 是否有 `selectable`？Android 是否关闭？
- [ ] 是否有 `Modal`？不可见是否不挂载？
- [ ] 进页是否有一排 Paper `TouchableRipple`？账户类选项用 `Pressable`
- [ ] 跳转到含输入/多控件的栈页前是否 `Keyboard.dismiss()`？
- [ ] 列表/滚动是否隐藏指示条？
- [ ] 相机/二维码是否动态 import？相册选图不要改成动态 import
- [ ] 含输入的 `ScrollView` 是否 `removeClippedSubviews={false}`？

## 关键文件

- `src/ui/AppTextInput.tsx` — Android 点按再挂载
- `src/ui/useAndroidMountReady.ts` — 进页延迟（默认 450ms + rAF）
- `src/ui/ProfileAvatar.tsx` — 相册图 `resizeMethod="resize"`
- `src/ui/components.tsx` — `Page`/`FormModal`/`ActionButton`
- `src/ui/ConfirmationDialog.tsx`
- `src/screens/AccountScreen.tsx` — 600ms 门控、`Pressable` 头像预设
- `src/screens/GiftsScreen.tsx` / `MoreScreens.tsx` — 进账户前 `Keyboard.dismiss()`
- `src/screens/GroupScreens.tsx` — 600ms 门控 + `AppTextInput`；`selectable` 在 Android 关闭

## 残余风险（勿当已消灭）

- 用户点输入框后仍会创建 EditText（页面已稳定，风险低很多）。
- 打开相机扫码、系统相册仍走原生模块，可能单独失败，应有错误文案，不应拖垮进页。
