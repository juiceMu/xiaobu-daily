# QA 1.0.32 图片头像跨设备显示

- 设备：三星 SM-G9730 与 OPPO PJX110，隔离 QA 包 `com.smallsteps.checkin.qa` 1.0.32。关联 PROFILE-003、VIEW-002，仅覆盖一次三星到 OPPO 的图片头像显示样本。
- 基线：三星本机头像为“小芽”，OPPO 首页 QAS 成员卡显示预设图标，副本时间为 09:18。
- 三星通过系统选择器选择既有合成竖图 `qa-profile003-retry-20261102.png` 并保存，再发起小组同步。三星显示“局域网同步完成”；OPPO 的 QAS 卡片副本时间更新为 09:21，头像变为图片。截图显示四色象限、中心十字及黑白标记，与测试夹具中央裁剪区域视觉相符。
- 测试后三星重新选择并保存“小芽”，再次同步显示完成；OPPO 的 QAS 卡片恢复预设“小芽”图标，副本时间显示 09:23。测试图片文件及截图仍分别保留在三星和 OPPO 的设备存储中。
- 证据：`/tmp/R28M22J0K3D-avatar-proof-result.xml`、`/tmp/R28M22J0K3D-avatar-proof-back2.xml`、`/tmp/R28M22J0K3D-avatar-proof-sync-result3.xml`、`/tmp/7c034dd9-avatar-proof-oppo-cards.xml`、`/tmp/7c034dd9-avatar-proof-oppo-after-terminal.xml`、`/tmp/qa-avatar-proof-oppo.png`、`/tmp/R28M22J0K3D-avatar-proof-restore-terminal2.xml`、`/tmp/7c034dd9-avatar-proof-restore-oppo-terminal.xml`。临时证据可能被清理，截图包含 QA 数据；操作顺序依赖执行记录。
- 独立 verifier 只读比较截图、原夹具和界面树，确认视觉特征、同步完成提示和副本时间更新。截图不能证明文件身份或附件字节完全一致，也不能证明全部数据同步。
- 未验证附件字节、JPEG 尺寸、重启后图片持久化、横图及其他平台；不能将整个 PROFILE-003 或 VIEW-002 判为通过。本轮未修改产品代码，未运行全量自动化质量检查。
