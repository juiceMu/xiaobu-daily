# OPPO 任务每日次数非法输入真机补测

## 环境与边界

- 2026-11-01；执行者 Codex；Android OPPO PJX110，序列号 `7c034dd9`；隔离包 `com.smallsteps.checkin.qa`，本轮使用刚安装的 1.0.23/code24。
- 本轮开始读取两机窗口：OPPO `mInputRestricted=false`、QA 在前台；三星 `mInputRestricted=true`、`mCurrentFocus=Bouncer`、`mDreamingLockscreen=true`，三星 UI 为 BLOCKED。
- 先 force-stop 并冷启动 OPPO QA，今日页为 11 月 1 日，当前周 10/26—11/1；统计为打卡 27 次、可兑换 2 张、可用 78 张。未清存档或改变系统时钟。
- 用例 `TASK-003`、`NAV-005` 的有限 UI 参数；沿用现有隔离存档，非 F0。未检查数据库实体数量、事务或底层无写入，不宣称完整用例通过。

## 实际执行

使用 Android SDK 提供的 ADB 操作和新采集的 UIAutomator XML；每项确认实际字段文本后提交。表单任务名实际为 `AInvalidMatrix`（输入法未保留计划输入的首字符，因此仅以实见值记录）。

| 参数     | 状态 | 观察与证据                                                                                                                                                                       |
| -------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `-1`     | PASS | 原生 EditText 实为 `-1`；提交后仍在新增小任务页，显示“请输入 1–99 的整数”。`/tmp/oppo-target-negative.xml`、`/tmp/oppo-negative-result.xml`                                      |
| `1.2`    | PASS | EditText 实为 `1.2`；提交后保留小数、不截断，显示相同整数错误。`/tmp/oppo-task-decimal-input.xml`、`/tmp/oppo-task-decimal-result.xml`                                           |
| 空值     | PASS | EditText 文本为空；提交后显示“点按填写”及整数错误，未离开表单。`/tmp/oppo-task-empty-input.xml`、`/tmp/oppo-task-empty-result.xml`                                               |
| `1e2`    | PASS | 失焦及提交后字段仍是 `1e2`，显示整数错误，未按 100 或 1 保存。`/tmp/oppo-task-exponent-input.xml`、`/tmp/oppo-task-exponent-result.xml`                                          |
| `0x10`   | PASS | 提交后字段保留 `0x10`，显示整数错误。`/tmp/oppo-task-hex-result.xml`                                                                                                             |
| `abc`    | PASS | 提交后字段保留 `abc`，显示整数错误与“每日次数请填写 1–99 的整数”。`/tmp/oppo-task-abc-result.xml`                                                                                |
| 取消草稿 | PASS | 点击当前可见取消按钮，出现“放弃未保存的内容？/继续填写/放弃更改”；点击放弃后回到今日页，仍为 27 次、2 张、78 张。`/tmp/oppo-task-discard.xml`、`/tmp/oppo-task-matrix-clean.xml` |

早期一次输入后按 Android 返回触发草稿确认，选择继续填写后才建立并确认目标输入；此尝试不计为非法输入提交证据。保存错误出现后底部控件位置下移，最初取消点击未生效，重新采集当前 bounds 后成功点击；不以无变化点击推断产品缺陷。有效设备操作及 dump 命令退出 0。

## 门禁、未覆盖与结论

- 本轮无产品代码变更或新包构建；`npm test`、`typecheck`、`lint`、全量 `format:check`、`export:*`、`build:apk` 均 NOT_RUN，不复用上一轮门禁当本轮结果。
- 未执行 99 合法上界保存、每组 F0 恢复、完整任务列表及数据库无新增核验、其他平台；此前 0/100 样本见历史记录，不冒充本轮重测。
- 局部文档格式检查及独立复核结果须以实际执行为准。当前结论为上述 OPPO UI 子样本通过，整体真机全功能目标未完成，继续保持 active。
