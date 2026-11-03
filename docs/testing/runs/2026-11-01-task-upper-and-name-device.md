# OPPO 每日次数合法上界与任务名称边界补测

## 环境、基线与范围

- 2026-11-01；执行者 Codex；OPPO PJX110 / 隔离包 `com.smallsteps.checkin.qa`，1.0.23/code24。两机在线，实读 OPPO QA 前台且 `mInputRestricted=false`；三星 `Bouncer`、`mInputRestricted=true`、`mDreamingLockscreen=true`，三星 UI 为 BLOCKED。
- 关联 `TASK-001/002/003`、`STORE-001` 的部分 UI 参数。沿用非 F0 的隔离 QA 存档；不清数据、不改系统时间、不读取完整业务库。
- 开始时首页统计为 27 次打卡、可兑换 2 张、可用 78 张；证据 `/tmp/oppo-upper-start.xml`。

## 执行与观察

| 用例/参数                               | 状态 | 实际执行与证据                                                                                                                                                                                                                                           |
| --------------------------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TASK-003：合法上界 99                   | PASS | 新增表单实际名称 `QAUpper99`、每日次数 `99`；保存后出现“新任务已添加”，列表显示 `QAUpper99`、`0/99次`、无记录时撤销按钮禁用。`/tmp/oppo-upper-form.xml`、`/tmp/oppo-upper-count.xml`                                                                     |
| TASK-001 / STORE-001：99 任务冷启动保留 | PASS | force-stop QA 并以 monkey 启动，滚动列表后实际读取 `QAUpper99`、`0/99次` 和“目标99次”；仅证明该对象 UI 持久化，不证明整个存档字段或底层事务。`/tmp/oppo-upper-reload.xml`                                                                                |
| TASK-002：空名称                        | PASS | 新增表单默认空名称，点击保存后仍在表单，显示“任务名称请填写 1–30 个字符”。`/tmp/oppo-task-empty-name.xml`                                                                                                                                                |
| TASK-002：全空格名称                    | PASS | 实际 EditText 文本为三个空格，提交后同样出现名称错误；取消出现草稿提示，选择放弃后回今日页，统计仍为 27/2/78。`/tmp/oppo-task-spaces-input.xml`、`/tmp/oppo-task-spaces-result.xml`、`/tmp/oppo-empty-name-cancel.xml`、`/tmp/oppo-empty-name-clean.xml` |
| TASK-002：31 位输入的 UI 长度限制       | PASS | 选中名称原文本后以 ADB 输入 31 位纯数字；原生 EditText 及失焦回显均为 `123456789012345678901234567890`（30 位），未保留第 31 位。`/tmp/oppo-task-name-limit-input.xml`、`/tmp/oppo-task-name-limit-blur.xml`                                             |
| TASK-002：30 位名称保存                 | PASS | 保存上述 30 位名称后出现“新任务已添加”，列表显示完整名称和 `0/1次`。`/tmp/oppo-task-name30-saved.xml`                                                                                                                                                    |

首次字母混合的计划长名称被系统输入法改写，未以该次结果断言长度；改用纯数字并实读焦点态字段后才采信。首轮冷启动输出的即时筛选没有匹配，随后直接读取完整已保存 XML 确认对象，未因一次空输出假定数据丢失。所有有效 ADB 操作和新 dump 命令退出 0。

## 留存数据、未覆盖与门禁

- QA 中新增 `QAUpper99`（目标 99）及 30 位数字名任务（目标 1）；未打卡、兑换或消费奖券，新增任务保留用于后续测试，不删除既有任务伪造恢复。
- 追加 30 位任务冷启动：force-stop 后重启 QA，重新滚动读取，名称完整且仍为目标 1 次、已打卡 0 次。证据 `/tmp/oppo-task-name30-reload.xml`。
- 未测试 99 次打卡、1 字名称、中文/组合字符、领域直接超长拒绝；未检查底层 ID/实体数量或所有历史。不能把有限子样本写为整例或三端通过。
- 无产品代码变更；本轮 `npm test`、`typecheck`、`lint`、全量 `format:check`、`export:*`、`build:apk` 为 NOT_RUN。局部 Prettier --write/--check 及 git diff --check 已执行，退出 0；独立复核请求未取得针对本文的有效回复，仍待补，不自批准。
- 整体真机全功能目标未完成，继续 active。
