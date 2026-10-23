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

| 问题 | 规则 |
|------|------|
| hover/按压面积大于胶囊 | 反馈底色画在内层 `contentStyle`；外层触控区透明；`rippleColor="transparent"`（Web 与需对齐的原生） |
| 筛选来回点闪烁 | 已选中不再叠悬停底色；悬停仅 Web；`transitionDuration: '0ms'` |
| Paper `Button` 或进页一排 `TouchableRipple` + `radio` | 账户头像用 RN `Pressable`；主题选择可用 `TouchableRipple` |
| 列表滚动条 | `showsVerticalScrollIndicator={false}` 且 `showsHorizontalScrollIndicator={false}` |

重型原生能力（相机 `GiftScanner`、二维码 `GiftQrCode`）**用到时再 `import()`**。
`AccountScreen` 的 `expo-image-picker` / `expo-image-manipulator` 保持静态 import：`pickAvatar` 的源码测试依赖这些绑定，且 1.0.7 未改 import 即已止住进页闪退。不要为“延后加载”改成动态 import。

## 账户/大图

脏检查不要对整份头像 `JSON.stringify`（大 data URI 每帧序列化易卡死/OOM）。按 `kind` / `id` / `dataUri` 字段比对。
相册头像 `Image` 设置 `resizeMethod="resize"`，避免进页按原图像素解码。

## 已证伪（不要再当修复）

- 只加 `useAndroidMountReady(300)`、Android 点按后再挂 `EditText`、关掉 `selectable`、去掉不可见 `Modal`：1.0.6 仍进账户页闪退。
- 去掉 Android `nativeID`：测试要求保留 `nativeID={labelId}`，且不是 1.0.7 的有效改动。

## 打包与版本

- 升 `app.json` `version`、`android.versionCode`、`android/app/build.gradle` 的 `versionName`/`versionCode`、`package.json` `version`。
- 本地构建：`JAVA_HOME`=OpenJDK 17，`ANDROID_HOME`=commandlinetools；国内网络用  
  `./android/gradlew -p android assembleRelease --no-daemon -I "$PWD/android/init.aliyun.gradle"`，再拷到 `dist/小步日常-{version}-{YYYYMMDD}.apk`。
- 同步 `CHANGELOG.md`。`dist/` 在 `.gitignore`，安装包不入库，只推源码与说明。
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
