# 真机补测：取消后再次联合使用

- 用例：COMP-004、COMP-008/009 的部分界面路径；OPPO 和三星，隔离 QA 包 1.0.32。前置和取消恢复见 [冷启动记录](./2026-11-02-qa32-companion-accepted-cold.md)。
- 基线：两机列表均显示可用 73、已使用 23；OPPO 同行券和三星 `QAG · 2可里程碑奖券` 可操作。
- OPPO 在同行选择框选择该主券并发出请求；三星收到同名券组合，确认授权；OPPO 收到授权后确认同行。选择目标文字的首次自动点击因其不是可点击节点而退出码 1，随后按实际选项区域点击并核对选中状态。
- 同步期间多次界面抓取返回 `could not get idle state`；三星一度显示“主券已提交 · 等待对方核对”，不将中间状态视为完成。后续两机界面均显示可用 71、已使用 25，待处理邀请消失。
- OPPO 已使用列表显示同行券、伙伴 QAS 和搭配的主券；三星已使用列表显示该主券、伙伴 QA 和搭配同行券，两项均显示 11/2 03:36。本轮实际使用两张隔离 QA 券，没有清空存档或操作正式包。
- 证据：`/tmp/7c034dd9-qa32-reuse-selected.xml`、`/tmp/R28M22J0K3D-qa32-reuse-samsung-offer2.xml`、`/tmp/R28M22J0K3D-qa32-reuse-after-authorize3.xml`、`/tmp/7c034dd9-qa32-reuse-oppo-authorized.xml`、`/tmp/R28M22J0K3D-qa32-reuse-samsung-final.xml`、`/tmp/R28M22J0K3D-qa32-reuse-samsung-settled3.xml`、`/tmp/7c034dd9-qa32-reuse-oppo-used-list.xml`、`/tmp/R28M22J0K3D-qa32-reuse-samsung-used-list.xml`。临时证据可能被清理。
- 边界：这是取消后重新发起并完成的双机界面样本；名称与时间不能证明精确券 ID、SQLite 事务、恰好一次消费或协议 ACK，不能关闭完整 COMP-009 及其他未测参数。未做冷启动、故障注入、iOS 或真实扫码；未运行全仓测试、类型检查、lint 或构建。
- 独立 verifier 只读核对关键 XML，支持两端显示联合使用及互为搭配的有限结论；同名不证明此次与取消前为同一底层券 ID，操作顺序依赖执行者记录，也不能证明原子性或持久化。本文 Prettier 检查退出码 0。

## 后续冷启动回读

- 分别在两机执行 `adb shell am force-stop com.smallsteps.checkin.qa`、`adb shell monkey -p com.smallsteps.checkin.qa 1`，四条命令退出码均为 0，再进入奖券已使用列表。
- 两机重启后均显示可用 71、已使用 25。OPPO 同行券及三星主券仍显示 11/2 03:36 的使用时间、对应同行人和搭配券，与此前界面一致。证据：`/tmp/7c034dd9-qa32-reuse-cold-oppo-result.xml`、`/tmp/R28M22J0K3D-qa32-reuse-cold-samsung-result.xml`。
- 独立 verifier 只读比较两端重启前后快照，确认可见使用时间、同行及搭配字段一致；静态快照本身不能证明强停重启过程、精确 ID 或全部历史一致。仅证明观察对象的冷启动界面回读，不证明事务原子性、整个存档或其他故障恢复；未修改产品代码，也未运行全仓质量门禁。
