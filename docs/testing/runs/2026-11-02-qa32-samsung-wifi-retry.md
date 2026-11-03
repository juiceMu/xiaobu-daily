# 三星断开 Wi-Fi 后同步重试

- 2026-11-02，Asia/Shanghai；三星 SM-G9730 / Android 12、OPPO PJX110 / Android 16，隔离 QA 1.0.32/code 33。LAN-002 的三星无 Wi-Fi 和恢复样本；基线与成员数据见 [双机跨周同步](./2026-11-02-qa32-two-device-week-sync.md)。
- 执行者先确认三星连接原 Wi-Fi，并使用 `adb shell svc wifi disable`，退出 0；`dumpsys wifi` 随后显示 Wi-Fi disabled。三星小组页点击一次同步后明确显示“未检测到可用 WiFi IPv4 地址；蜂窝网络和 IPv6 暂不支持小组同步”，未显示成功。
- 恢复时 `adb shell svc wifi enable` 返回 0，但随后 `cmd wifi status` 仍为 disabled。打开系统 WLAN 设置，按文字定位开关的脚本因可点击目标为 0 而失败；根据设置页开关边界点击后，`cmd wifi status` 显示 enabled 且连接原 Wi-Fi。没有修改保存的网络配置。
- 返回键实际进入系统相机权限设置页，第一次重试脚本找不到同步按钮，未触发同步，也未更改权限。重新打开 QA 小组页后再次点击同步一次；同步期间一次 UI dump 因无法进入 idle 失败，没有再重复触发。终态显示“局域网同步完成”，OPPO 副本时间由 00:53 更新至 01:01。
- 三星重试后 OPPO 成员卡仍显示完成 2/11、早睡 1/1、运动 1/1、可用 70、本周已兑 1、已使用 11。此为可见内容，不证明整个存档或事务无变化。
- 临时证据：`/tmp/R28M22J0K3D-qa32-wifi-{off-observe,settings,app-return,retry-terminal,retry-members}.xml`；失败日志 `/tmp/qa32-wifi-settings-enable.log`、`/tmp/qa32-wifi-retry.log`、`/tmp/qa32-wifi-retry-actual-result.log`。网络状态命令及点击过程为执行者当场观察，未留完整原始命令日志；临时文件可能包含 QA 资料且不保证长期保留。
- 独立 verifier 只读复核了所列界面树及失败日志，提示、成员数据和工具失败一致；网络切换、权限页、点击次数及未更改权限依赖执行者观察，留存快照不能独立证明。
- 未覆盖 IPv6-only、VPN、跨子网、同步进行中断网、iOS 或全部 LAN-002；未读取底层同步记录。无产品代码变更，未运行全仓测试、类型检查、lint、格式检查或构建。
