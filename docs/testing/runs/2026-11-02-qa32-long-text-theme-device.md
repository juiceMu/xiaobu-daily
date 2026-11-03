# 真机补测：长文本与主题界面

- 日期：2026-11-02；隔离 QA 包 1.0.32/code 33；三星 SM-G9730 / Android 12，OPPO PJX110 / Android 16。关联 A11Y-002、THEME-001 的有限界面样本，不代表整例通过。
- 三星开始时系统 `font_scale` 实读 1.3，原主题为暖灰米。使用已有长名称赠券，分别在暖灰米、薄荷花园、柔雾紫、蜜桃粉、极简白打开使用弹窗并取消；未确认使用。截图分别为 `/tmp/qa-a11y-long-dialog.png`、`/tmp/qa-a11y-{mint,purple,pink,white}.png`，界面树为 `/tmp/R28M22J0K3D-a11y-{long,mint,purple,pink,white}-dialog.xml`。最终设置页显示已恢复暖灰米，见 `/tmp/R28M22J0K3D-a11y-restored.xml`。
- 独立 verifier 只读核对五张截图与界面树：长券名及提示完整换行，邀请、输入、取消和确认按钮可见，未见彼此遮挡或裁切；静态证据不能证明主题切换顺序、点击命中、滚动、读屏播报、对比度合规或底层无写入。
- OPPO 原系统 `font_scale` 为 1.0；临时设为 1.3 后在今日页查看已有长任务并点击更多菜单，再关闭菜单。任务名在列表中以省略号显示，界面树保留完整名称；截图 `/tmp/qa-a11y-oppo-task.png`、`/tmp/qa-a11y-oppo-menu.png`，界面树 `/tmp/7c034dd9-a11y-oppo-long-list.xml`、`/tmp/7c034dd9-a11y-oppo-long-menu-view.xml`。补充设为 1.3 并实读确认后再次采集 `/tmp/qa-a11y-oppo-verified.png` 与 `/tmp/7c034dd9-a11y-oppo-verified-list.xml`。最终恢复 1.0 并实读确认。
- 独立 verifier 只读核对 OPPO 首组及补充截图：长名称省略显示，任务进度和三个操作图标未见重叠，菜单三项可见；弹出菜单覆盖部分背景及底栏上沿。截图不能证明完整名称视觉展示、读屏、实际命中、主题或底层行为。
- 未执行 TalkBack、iOS、Web、所有字体/主题/页面及实际打卡、归档、删除或用券；不将本样本升格为完整无障碍或主题验收。测试截图保留在对应设备和临时目录，临时证据可能被清理。未改产品代码，未运行全量测试、类型检查、lint 或构建。
