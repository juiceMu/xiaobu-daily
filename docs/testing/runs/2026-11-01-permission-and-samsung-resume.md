# OPPO 权限拒绝与三星解锁后页头补测

## 环境与数据边界

- 2026-11-01；Codex；双 Android 隔离包 `com.smallsteps.checkin.qa` 1.0.23/code24。无产品代码修改、不清数据、不确认领券。
- 三星解锁消息后实查：`mInputRestricted=false`、`mDreamingLockscreen=false`，焦点为 Launcher；随后 QA 冷启动成功。原锁屏报告为历史事实，不再作为当前设备阻塞。

## GIFT-007 输入传输阻塞

- 读取当前 `giftCore.mjs`，以实际 `createInitialState/ensureGiftProfile/createGift/exportGift` 生成纯解析测试夹具，`parseGift` 基线通过；仅 Node 内存，不写手机存档。计划输入版本单字段变异，不确认领取。
- 实读 OPPO 原生 EditText 后发现当前搜狗输入法已改写完整 JSON 的多个字段，因此没有点击预览，也没有将其记为错误版本拒绝通过。shell clipboard 不提供实现，系统只列出搜狗输入法；未安装其他键盘、未读取私人剪贴板。
- 已选中并清空输入，实见“预览并领取” `enabled=false`；证据 `/tmp/oppo-gift-matrix-clean.xml`。完整单字段校验仍 BLOCKED 于可重复的原文输入方式，不据此认定产品缺陷。测试码不写报告。

## SCAN-001：系统拒绝后反馈（非全新安装首次拒绝）

- OPPO 原权限 `CAMERA granted=true`。ADB `pm revoke` 被设备以 `REVOKE_RUNTIME_PERMISSIONS` 安全异常拒绝，未将该操作算成功；改用系统“应用详情→小步日常测试→权限管理→摄像头→不允许”，实际读到 `granted=false`。
- 返回 QA 打开扫码，页面提示“允许使用相机后…也可以关闭后粘贴券码”，点击“允许使用相机”后实际出现系统权限弹窗，包含“使用时允许/仅本次使用时允许/不允许”；证据 `/tmp/oppo-scan-ungranted.xml`、`/tmp/oppo-scan-permission-request.xml`。
- 在真实系统弹窗点击“不允许”后，应用留在“扫描赠券”，明确显示“未获得相机权限，请重试或在系统设置中允许，也可以粘贴券码。”，且关闭扫码按钮可用；证据 `/tmp/oppo-camera-deny-result.xml`。本拒绝反馈子参数 PASS，不证明新安装初次拒绝、迟到权限结果或相机实际扫描通过。
- 点击关闭扫码后，在同一 QA 权限设置恢复“使用时允许”，最终 `dumpsys package` 确认 `CAMERA granted=true`，QA 回到前台。未改其他应用或权限；恢复授权不等于已验证镜头重新启动。

## NAV-009：三星真实解锁后发现严格间距门槛仍未满足

| 参数                     | 状态 | 结果                                                                                                                                                                                                                                                                                                                  |
| ------------------------ | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 设置页冷链打开、原生返回 | PASS | 页面“设置”；原生返回 bounds `[0,112][147,259]`，按420dpi为56dp；点击 `(73,185)` 后更多总览出现小组/里程碑/设置。`/tmp/samsung-header-qa23.xml`、`/tmp/samsung-header-back-qa23.xml`                                                                                                                                   |
| 赠送与领取入口/返回      | PASS | 标题完整、同样返回 bounds，实际返回总览。`/tmp/samsung-qa23-gifts.xml`                                                                                                                                                                                                                                                |
| 账户资料入口/返回        | PASS | 标题完整、同样返回 bounds，点击后新 dump 显示总览。`/tmp/samsung-qa23-account.xml`、`/tmp/samsung-account-return-qa23.xml`                                                                                                                                                                                            |
| 设置页可见间距不超过8dp  | FAIL | 截图 `/tmp/samsung-header-qa23.png` 为1080x2280；用已安装 pngjs 读取像素，在 x20—239/y155—224 中统计每列至少2个 RGB 各小于150像素，暗色连续列为 `[54,93]`（箭头）、`[117,164]`、`[173,216]`（标题）。箭头右缘至标题起点有约23个空白像素，420dpi折算约8.8dp，超过8dp门槛。节点 bounds 不是字形边界，不用于替代此测量。 |

后续：不放松 NAV-009 标准；需继续收紧 Android 标题位移，并构建新 QA 包双机复测。此次没有修改产品或将旧包重复声明通过。

## 门禁与结论

- 本轮 `npm test/typecheck/lint/format:check/export/build` 均 NOT_RUN（仅设备测试、只读夹具生成及新增记录）。文档局部格式检查单列；独立复核待补。
- 进展为一个真实权限拒绝反馈子参数、三星三个子页返回，以及发现严格间距门槛未满足；GIFT-007 原文输入仍需解决，其他未测功能保持待测，整体目标不完成。
