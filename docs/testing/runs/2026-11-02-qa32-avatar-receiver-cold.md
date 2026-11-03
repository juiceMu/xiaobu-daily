# 真机补测：接收端图片头像冷启动

- 日期：2026-11-02；三星 SM-G9730、OPPO PJX110，隔离 QA 包 `com.smallsteps.checkin.qa` 1.0.32；关联 PROFILE-003、VIEW-002。测试前三星头像为“小芽”。
- 三星选择设备已有合成图片并保存，发起同步；三星界面显示“局域网同步完成”，OPPO QAS 成员卡显示四色测试图，副本时间 21:28。证据：`/tmp/R28M22J0K3D-qa-resume-sync-final2.xml`、`/tmp/7c034dd9-qa-resume-oppo-cards2.xml`、`/tmp/qa-resume-avatar-before.png`。
- 对 OPPO 执行 `adb shell am force-stop com.smallsteps.checkin.qa`，随后执行 `adb shell monkey -p com.smallsteps.checkin.qa 1`，两条命令退出码均为 0。重启后成员卡仍显示四色图，副本时间仍为 21:28。证据：`/tmp/7c034dd9-qa-resume-oppo-cold.xml`、`/tmp/qa-resume-avatar-cold.png`。
- 测试后三星选择并保存“小芽”，再次发起同步；OPPO QAS 卡片显示小芽图标，副本时间 21:32，见 `/tmp/7c034dd9-qa-resume-oppo-restore.xml`。同步过程中三星两次界面树采集报 `could not get idle state`；未据此判定内部同步流程成功或失败。
- 独立 verifier 只读对照两张截图与界面树，确认 QAS 卡片的四色象限、中心十字、标记及副本时间一致，三星同步结果包含完成提示。静态证据不能独立证明操作顺序、文件身份、附件字节或其他实体同步完整。
- 追加横图样本：三星选取设备已有合成横图 `qa-profile003-landscape-20261031-1830.png`，保存并同步。OPPO QAS 成员卡显示蓝、青、紫、黄四区和中心标记，副本时间 21:36；证据为 `/tmp/R28M22J0K3D-land-search-result2.xml`、`/tmp/7c034dd9-land-oppo-result3.xml`、`/tmp/qa-resume-landscape.png`。随后三星保存“小芽”并同步，OPPO 卡片恢复小芽图标、副本时间 21:38，见 `/tmp/7c034dd9-land-restore-oppo2.xml`。
- 独立 verifier 只读对照截图和此前合成横图夹具，确认颜色及中心标记与夹具中央裁剪区域视觉一致；截图不能证明输入文件身份、附件字节、操作顺序或全部横图通过。
- 本次仅覆盖三星到 OPPO 的图片头像接收后冷启动和横图显示各一次视觉样本，不代表完整 PROFILE-003 或 VIEW-002 通过；附件字节及其他平台仍未覆盖。测试截图保留在 OPPO 设备存储及临时目录，临时证据可能被清理。未修改产品代码，未运行全量测试、类型检查、lint 或构建。
