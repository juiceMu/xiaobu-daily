# OPPO 已有打卡后调低任务目标真机补测

## 环境与范围

- 2026-11-01；Codex；OPPO PJX110 / 隔离包 `com.smallsteps.checkin.qa` 1.0.23/code24。实时窗口为 QA 前台、`mInputRestricted=false`。
- 关联 `TASK-004` 的“新目标小于已有次数时不删除历史、不再允许超目标打卡”与 `STORE-001` 对应对象冷启动 UI 参数；非 F0，不读取数据库或完整存档。
- 上轮保留的独立任务 `QAUpper99` 初始目标 99、今日打卡 0 次，证据 `/tmp/oppo-edit99-base.xml`。此前确认周汇总 27 次、可兑换 2 张、可用 78 张。

## 执行证据

| 参数/步骤          | 状态 | 观察与证据                                                                                                                                                                |
| ------------------ | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 前置：两次合法打卡 | PASS | 间隔操作两次后任务显示“已打卡2次，目标99次”；撤销入口启用。`/tmp/oppo-edit99-two.xml`                                                                                     |
| 调低目标至 1       | PASS | 打开编辑任务，实读名称 `QAUpper99`、目标 `1` 后保存；显示“已打卡2次，目标1次”，原两次未被削减。`/tmp/oppo-target-reduced-form.xml`、`/tmp/oppo-target-reduced-result.xml` |
| 超目标按钮禁用     | PASS | 打卡入口为“当天已完成”、`enabled=false`；点击该实际位置后仍为 2 次。`/tmp/oppo-target-reduced-disabled.xml`                                                               |
| 冷启动保留         | PASS | force-stop QA 后重新启动并滚动，仍显示“已打卡2次，目标1次”。`/tmp/oppo-target-reduced-reload.xml`                                                                         |
| 恢复目标           | PASS | 重新进入编辑，实读 99 后保存，显示目标99、打卡2次，打卡入口重新启用。`/tmp/oppo-target-restore-form99.xml`、`/tmp/oppo-target-restored-final.xml`                         |
| 撤销本任务新增记录 | PASS | 两次打开撤销确认后确认，依次显示 1 次、0 次，目标仍为99。`/tmp/oppo-edit99-undo1.xml`、`/tmp/oppo-edit99-undo2.xml`                                                       |

## 操作异常与恢复

- 首次恢复目标时连续坐标操作未实际进入并保存编辑；重新采集页面后仍为目标1，因此没有将该尝试当作成功。之后以分步读取表单、确认字段、保存的方式完成恢复。
- 本任务撤销后汇总读到 28 次/可兑换3张/可用78张，并非基线。比较原始任务 XML 与当前中段列表，定位 `QAIconExtra` 从0变为1（`/tmp/oppo-edit99-base.xml` 与 `/tmp/oppo-edit99-final-middle.xml`），其余可比任务相同。该增量发生于测试恢复阶段的一次坐标操作，应记为测试误点，不作为产品缺陷或预期测试步骤。
- 在确认该任务原始0次、当前1次且未兑换后，打开其撤销确认并确认，实际恢复0次，证据 `/tmp/oppo-edit99-extra-clean.xml`。最终重新读取汇总，恢复27次、可兑换2张、可用78张，证据 `/tmp/oppo-edit99-recovered-summary.xml`。不声称全部数据库字节或后台同步状态均已恢复。
- 本轮没有兑换或使用奖券，不删除既有任务、不清存档。有效 ADB 操作及新采集 dump 命令退出0；不以坐标命令退出0代替业务成功证据。

## 门禁与结论

- 无产品代码变更；`npm test`、`typecheck`、`lint`、全量 `format:check`、`export:*`、构建本轮 NOT_RUN。
- 未核对底层稳定 taskId、checkin 引用、数据库条数；未覆盖同时改名/图标/颜色、失败保存或其他平台，不标完整 TASK-004 通过。
- 独立复核待补；局部格式检查依据后续实际执行结果记录。整体真机全功能目标尚未完成，保持 active。
