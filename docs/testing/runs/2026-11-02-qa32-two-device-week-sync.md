# 双 Android 真机：跨周后同步样本

- 2026-11-02，Asia/Shanghai；OPPO PJX110 / Android 16、三星 SM-G9730 / Android 12，均使用隔离 QA 包 `com.smallsteps.checkin.qa` 1.0.32/code 33。关联 LAN-001、VIEW-002、STORE-001 的有限界面样本。
- 两机在同一 Wi-Fi、同一已有 QA 小组；均显示另有两个成员副本。未清除数据或操作正式包，同步可能交换双方已有的其他待同步 QA 数据。
- 同步前：OPPO 本周 2 次、可兑换 0 张、可用 70 张；三星本周 0 次、可兑换 0 张、可用 2 张。三星小组页上的 OPPO 成员副本时间为 11 月 1 日 17:28。
- 在两台 QA 前台时，仅从三星小组页点一次同步。同步期间一次 UI 采集因 `could not get idle state` 失败，没有重复触发；之后三星界面显示“局域网同步完成”，两端小组页成员副本时间更新至 11 月 2 日 00:53。第三个成员未单独核验在线或直接参与，不能根据副本时间推断其在线。
- 三星今日页 OPPO 成员卡显示完成 2/11、早睡 1/1、运动 1/1、可用 70、本周已兑 1、已使用 11；三星 QA 强制停止后重启，再到该成员卡仍显示相同数据。实际 `adb shell monkey -p com.smallsteps.checkin.qa 1` 退出 0。
- 临时证据：`/tmp/7c034dd9-qa32-sync-oppo-{before,group-before,after}.xml`、`/tmp/R28M22J0K3D-qa32-sync-samsung-{before,group-before,after,members,cold}.xml`；采集失败日志 `/tmp/qa32-sync-samsung-during.log`。临时文件可能含 QA 资料，不保证长期保留。
- 独立 verifier 只读核对了所列界面树和失败日志，数值、时间、成功提示及采集失败信息一致；网络环境、触发次数、强停和重启过程依赖执行者记录，静态快照本身无法单独证明。
- 此为一次同步及三星成员卡冷启动样本，不证明逐条实体、事务、精确 ACK、双方所有数据或第三设备同步；未测试断网恢复、iOS、Web 或全部用例参数。没有产品代码变更，未运行全仓测试、类型检查、lint、格式检查或构建。
