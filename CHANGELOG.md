# Changelog

## [1.0.8] - 2026-10-23

### Added

- 小组：创建、改名、邀请码/二维码加入与离开（「更多 → 小组」）
- 原生局域网手动同步：同一 WiFi 下 mDNS 发现 + TCP 口令挑战与加密交换打卡/奖券日志
- 组内查看：本机可切换「只看自己 / 看全组」；他人数据为上次同步的只读副本
- Android 身份模块 `modules/sprout-identity`（Keystore 存 P-256；尚未替换旧存档 `accountId`，真机身份验收未完成）

### Changed

- Android `versionCode` 9，安装包：`dist/小步日常-1.0.8-20261023.apk`
- 依赖：`react-native-zeroconf`、`@noble/ciphers`；`expo-network` 对齐 Expo 57

## [1.0.7] - 2026-10-21

### Fixed

- 真机确认：1.0.6 点进「设置头像和昵称」仍会在进入账户页后闪退；本版覆盖安装后进页不再闪退
- 账户头像预设由 Paper `TouchableRipple` 改为 RN `Pressable`，避免进页一排 ripple/radio 触发无障碍子树竞态
- 账户页正文延迟改为 600ms，且在交互结束后再等一帧；从「更多」「赠送与领取」进入前先收起键盘
- 相册头像按视图尺寸解码（`resizeMethod="resize"`）

### Changed

- Android `versionCode` 8，安装包：`dist/小步日常-1.0.7-20261021.apk`

## [1.0.6] - 2026-10-21

### Fixed

- 时间选择、里程碑奖励历史：不可见时不挂 Modal
- Android 原生输入不再透传 Paper 的 left/right 等属性
- 账户脏检查改为按字段比对，避免大图每帧 JSON.stringify

### Changed

- Android `versionCode` 7，安装包名示例：`小步日常-1.0.6-20261021.apk`

## [1.0.5] - 2026-10-21

### Fixed

- Android 输入改为点按后再挂载原生输入，进页不再立刻创建 EditText
- 确认框与表单弹窗不可见时不挂原生 Modal
- 账户头像预设改为 TouchableRipple，避免 Paper Button 的 radio 角色

### Changed

- Android `versionCode` 6，安装包名示例：`小步日常-1.0.5-20261021.apk`

## [1.0.4] - 2026-10-21

### Changed

- 页面与列表隐藏滚动条
- Android `versionCode` 5，安装包名示例：`小步日常-1.0.4-20261021.apk`

## [1.0.3] - 2026-10-21

### Fixed

- 赠送与领取、账户资料、设置：Android 进页后再挂载输入等内容，减轻栈切换时 EditText 闪退
- Android 关闭可选中文本（`selectable`），避免与输入框同类原生崩溃
- 输入框延后挂载统一为共享就绪钩子，并去掉 Android 上的 labelledBy 关联

### Changed

- Android `versionCode` 4，安装包名示例：`小步日常-1.0.3-20261021.apk`

## [1.0.2] - 2026-10-21

### Fixed

- 按压/悬停反馈收进控件可视圆角内，不再铺满更大的点击区（奖券筛选等）
- 统一按钮、图标按钮、里程碑胶囊、更多入口等反馈层：透明 ripple，底色只画在内层
- 筛选等已选按钮不再叠悬停底色，悬停仅网页生效，去掉底色过渡，避免来回切换闪烁

### Changed

- Android `versionCode` 3，安装包名示例：`小步日常-1.0.2-20261021.apk`

## [1.0.1] - 2026-10-20

### Added

- 任务支持删除（与归档分离）：删除后不进归档列表、不可恢复；历史打卡仍计入周统计
- 新装初始任务仅「早睡」「运动」

### Fixed

- 进入「赠送与领取」「设置头像和昵称」等含输入框页面时 Android 闪退：输入框延后挂载，避免页面切换未完成就创建 EditText
- 赠送页相机与二维码改为用到再加载，降低进页即加载原生模块的风险

### Changed

- 成长记录不再列出已删除任务（次数仍计入周统计）
- 应用手册同步删除/归档说明与月历年月切换说明
- 自适应图标生成：前景收进安全区，避免圆形/圆角遮罩裁切
- Android `versionCode` 2，安装包名示例：`小步日常-1.0.1-20261020.apk`

## [1.0.0] - 2026-10-20

- 小步日常首版发布
