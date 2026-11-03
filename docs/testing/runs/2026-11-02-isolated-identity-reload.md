# 双 Android 隔离身份冷启动样本

- 日期：2026-11-02；OPPO `7c034dd9`、三星 `R28M22J0K3D`，均为独立调试包 `com.smallsteps.checkin.isolatedqa` 1.0.32/code 33。包来源、安装和风险见 [独立包记录](./2026-11-02-isolated-qa-bootstrap.md)。未读取正式包或原 QA 包存档。
- STORE-002 有限样本：OPPO 已初始化且仍无组；三星已创建隔离组 `ISOQA`。两机独立包强制停止后检查各自 SQLite 目录均未见 WAL/SHM；读取独立测试库作为冷启动前样本，启动两机独立包并观察首页，再强制停止、读取冷启动后样本。
- 比较两个设备的 `app_state` 单行同步字段：两机各自 accountId 和 deviceId 冷启动前后一致，均符合 UUID 外观；两机 accountId 不同、deviceId 不同。各自 `sequence`、outbox 数量和任务数量前后均相同。比较脚本只输出布尔结论，不在本记录写入身份值或完整存档。
- 两机首页证据分别为 `/tmp/7c034dd9-isolated-identity-oppo-loaded.xml`、`/tmp/R28M22J0K3D-isolated-identity-samsung-loaded.xml`；四个仅含隔离测试数据的 SQLite 快照与比较脚本位于 `/tmp/xiaobu-isolated-identity.p69TNL/`，临时证据可能被系统清理。
- 此样本未记录首次初始化之前的身份或初始事务，不能证明无重复初始化事务、随机数安全性、完整业务实体不变或所有平台通过。三星已有组，不能当作 F0；未测试 iOS/Web。未运行全量测试、类型检查、lint 或构建。
