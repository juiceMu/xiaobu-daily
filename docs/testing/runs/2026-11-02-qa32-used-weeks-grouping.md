# QA 1.0.32 真机验收：已使用奖券分组

- 日期：2026-11-02，Asia/Shanghai
- 版本：隔离测试包 `com.smallsteps.checkin.qa`，1.0.32，versionCode 33
- 设备：OPPO `7c034dd9`、三星 `R28M22J0K3D`
- 用例：VIEW-006（本次仅覆盖下述已使用列表场景）
- 基线：HEAD `95ce109eaa87d95101ce991b1514f44e49198aa8`；使用现有隔离 QA 数据，未清空设备数据。

## 实际观察

- 两台设备分别查看全组和单独筛选 QA、QAS 的已使用列表。全组按成员展示，成员下本周在上周之前；QA 和 QAS 单独筛选也观察到本周在上周之前。
- 全组已使用数量为 25：QA 本周 1、上周 11；QB5 上周 2；QAS 本周 1、上周 10。两设备各自的成员顺序不同。
- QAS 一张券获得于 10/30、使用于 11/2，显示在本周使用分组，支持该样本按使用周而非获得周分组。
- 采集到的可见行中未发现启用的“使用奖券”“找伙伴”“确认使用”按钮。此观察不能证明所有不可见行或领域权限。
- 三星扫码领取后可用数量为 73，OPPO 为 72；两台设备是未同步的隔离副本，不能据此声称数据一致。
- 测试结束后恢复两台设备为全组、全部成员。三星恢复为可使用筛选，证据 `/tmp/R28M22J0K3D-qa32-used-weeks-restored.xml`；OPPO 恢复步骤未成功，证据 `/tmp/7c034dd9-qa32-restore-complete.xml` 显示已使用筛选仍被选中。需后续在 OPPO 恢复筛选。

## 命令与证据

使用本地 ADB、`/tmp/xiaobu-native-ui.cjs` 和 `/tmp/xiaobu-used-weeks.cjs` 操作并采集原生界面。六次采集命令均退出码 0，逐屏 XML 路径记录在以下 JSON 中：

- `/tmp/R28M22J0K3D-qa32-used-weeks-all-proof.json`
- `/tmp/R28M22J0K3D-qa32-used-weeks-qa-proof.json`
- `/tmp/R28M22J0K3D-qa32-used-weeks-qas-proof.json`
- `/tmp/7c034dd9-qa32-used-weeks-all-proof.json`
- `/tmp/7c034dd9-qa32-used-weeks-qa-proof.json`
- `/tmp/7c034dd9-qa32-used-weeks-qas-proof.json`

采集通过重叠滑动直至连续画面签名相同，不能严格证明遍历了每个券 ID 或到达列表绝对底部。证据存于本机临时目录，可能被系统清理。

## 结论与未执行

上述样本的成员与周分组顺序符合预期；不将其扩大为 VIEW-006 所有场景通过。未逐 ID 核对所有记录，未验证不可见行操作权限、同步一致性或其他筛选组合。

后续完成日期滚动测试并返回奖券页后，重新采集 `/tmp/7c034dd9-qa32-final-ticket-state.xml`，明确显示“可使用，已选择”、可用 72、已使用 25，全部成员可见。OPPO 当前筛选已恢复。早期 tap 辅助命令保存的是点击前 XML，不能将其当成点击后的结果证据。

## 独立复核

- 独立 verifier 核对六组 JSON 和逐屏 XML，确认可见成员数量、周顺序及跨获得/使用周样本与记录吻合；可见行中未发现启用的三个消费入口，但不能外推到不可见行。
- verifier 指出初稿引用的 OPPO XML 仍为已使用选中。正文已更正，随后 verifier 核对独立采集的 final-ticket-state，确认可使用、全组、全部成员以及可用 72/已使用 25，最终恢复成立。
- verifier 未操作设备或文件，且未验证真实摄像头过程、底层数据库、设备版本、命令退出码及未清空正式数据等执行者现场过程。
