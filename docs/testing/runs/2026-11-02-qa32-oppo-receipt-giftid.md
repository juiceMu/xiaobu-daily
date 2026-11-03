# 验收记录：OPPO 回执赠券编号不匹配

- 2026-11-02，OPPO PJX110 / Android 16，隔离 QA 1.0.32/code 33，关联 GIFT-009。三星未在线；不清档、不公开业务回执或身份。
- 基于此前已记录的 QA 回执，在内存中将回执外层及内嵌赠券的 `giftId` 一致改为新的合成编号，保持其他字段不变；`/tmp/7c034dd9-qa32-receipt-giftid-input.xml` 与该变体结构比较一致。原始回执及重复拒绝证据见 [历史记录](./2026-11-01-receipt-and-theme-resume.md)。
- 点击预览后，`/tmp/7c034dd9-qa32-receipt-giftid-previewed.xml` 显示回执确认；点击确认后，`/tmp/7c034dd9-qa32-receipt-giftid-result.xml` 显示“回执与赠券不匹配”，确认框保留，未显示成功。随后取消并放弃草稿，命令退出 0。
- 重新进入列表，`/tmp/7c034dd9-qa32-receipt-giftid-original-after.xml` 的原目标发出记录仍显示已有回执；仅证明可见状态，不证明底层字段或数据库未变。本次只覆盖 OPPO 的一种编号变异，未覆盖其他关联组合、其他平台或完整 GIFT-009；未运行全量自动化门禁。临时界面树可能含 QA 资料，不应公开。

## 追加：奖券编号不匹配

- 基于同一 QA 回执，在内存中将外层及内嵌赠券的 `ticketId` 一致改为新的合成编号，其他字段不变；`/tmp/7c034dd9-qa32-receipt-ticketid-input.xml` 与该变体结构比较一致。
- `/tmp/7c034dd9-qa32-receipt-ticketid-previewed.xml` 显示回执确认；点击确认后 `/tmp/7c034dd9-qa32-receipt-ticketid-result.xml` 显示“回执与赠券不匹配”，确认框保留且未显示成功。取消并放弃草稿后重新进入列表，`/tmp/7c034dd9-qa32-receipt-ticketid-original-after.xml` 的原目标记录仍显示已有回执。
- 此为单次 OPPO 界面样本，不证明数据库未变、其他关联组合或其他平台通过。

## 追加：同赠券不同领取方冲突

- 基于同一未指定接收方的 QA 回执，仅在内存中将领取方改为合成身份，其他字段不变；`/tmp/7c034dd9-qa32-receipt-conflict-input.xml` 与变体结构比较一致。`/tmp/7c034dd9-qa32-receipt-conflict-previewed.xml` 显示测试领取方及确认框。
- 点击确认后，`/tmp/7c034dd9-qa32-receipt-conflict-result.xml` 显示“本机已记录该赠券回执”，确认框保留且未显示成功。取消并放弃草稿后重新进入列表，`/tmp/7c034dd9-qa32-receipt-conflict-original-after.xml` 的目标记录仍显示原领取方，不显示测试领取方。
- 这是 OPPO 上单次回执冲突拒绝和原领取方可见状态，不证明底层记录全部字段、原子性或其他平台；未公开原回执或身份。
