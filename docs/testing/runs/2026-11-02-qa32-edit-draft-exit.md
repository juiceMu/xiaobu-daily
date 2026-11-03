# 真机补测：任务与里程碑编辑草稿退出

- 日期：2026-11-02；OPPO PJX110 / Android 16，隔离 QA 包 1.0.32/code 33；关联 NAV-005 的有限界面样本。测试使用已有 QA 任务和目标，未保存业务修改、清档或修改产品代码。
- 任务 `QAUpper99` 基线名称、目标、图标和颜色分别为 `QAUpper99`、99、成长、浅绿。未修改即关闭表单后回到今日页，未见放弃提示。重新编辑，名称追加 `Draft`；关闭后出现放弃提示，选择“继续填写”仍显示 `QAUpper99Draft`；再次关闭并选择“放弃更改”，重进显示原名称与目标。证据：`/tmp/7c034dd9-nav-task-{baseline,clean-result,draft,prompt,continued,reopened}.xml`。
- 目标 `QAGLifecycle` 有既有记录，名称、起点、单位、方向和步长均禁用，基线图标为成长。选择阅读图标后关闭，出现放弃提示；继续填写后显示阅读，再次退出并放弃，重进显示成长。证据：`/tmp/7c034dd9-nav-goal-{baseline,prompt,continued,reopened}.xml`。
- 独立 verifier 只读核对上述界面树，确认草稿值、提示、重进值及锁定状态；静态证据不独立证明操作顺序、点击命中或底层没有写入。临时证据可能被清理。
- 追加可编辑规则方向样本：`QALargeGoal` 显示起始 0、累计解锁 0 张，规则表单中递增已选且方向控件启用。切为递减后关闭，选择“继续填写”仍显示递减；再次关闭并放弃，重进显示递增。未保存规则。证据：`/tmp/7c034dd9-nav-rule-{candidate-view,baseline,continue,continued,discard,reopened}.xml`。
- 独立 verifier 只读确认规则方向前后状态和提示；0 张不能单独证明没有任何记录，静态快照不独立证明操作顺序、点击命中或底层无写入。
- 本次不覆盖其他可编辑规则字段、其他设备、全部退出路径或完整 NAV-005。未运行全量测试、类型检查、lint 或构建。
