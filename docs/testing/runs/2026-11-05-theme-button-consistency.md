# 验收记录：主题按钮一致性

## 变更与环境

- 2026-11-05，Codex 实施，独立 reviewer 复核；`main` 基准 `f29a765`，工作区包含此前未提交的主题改动与用户文件。
- 应用 1.0.33，macOS，Node 24.22.1，npm 10.8.2；自动测试使用替身，不读取或清空用户存档。
- 关联 THEME-005、REWARD-008、A11Y-004 及任务操作；四套新主题奖励按钮跟随主题，旧五套保持奖励色；任务三按钮统一视觉圆形尺寸并保留触控范围。

## 自动化执行

| 阶段     | 命令                                                                                       | 退出码 | 结果                                                                             |
| -------- | ------------------------------------------------------------------------------------------ | ------ | -------------------------------------------------------------------------------- |
| 基线     | `tsx --test tests/todayLayout.test.ts tests/uiTheme.test.ts tests/compactCalendar.test.ts` | 0      | 19 通过                                                                          |
| 专项     | 同上追加 `tests/taskNavigation.test.ts`                                                    | 0      | 30 通过                                                                          |
| 独立复核 | `tsx --test tests/taskNavigation.test.ts tests/uiTheme.test.ts tests/todayLayout.test.ts`  | 0      | 26 通过                                                                          |
| 全量     | `npm test`                                                                                 | 0      | 350 通过                                                                         |
| 类型     | `npm run typecheck`                                                                        | 0      | 通过                                                                             |
| 格式     | `npm run format:check`                                                                     | 0      | 通过                                                                             |
| 静态检查 | `npm run lint`                                                                             | 1      | 既有未跟踪 `testa.js` 六处 no-undef；TodayScreen 两处 hooks 警告，与前次记录一致 |

## 执行明细与结论

- THEME-005、REWARD-008、A11Y-004：源码、颜色数学和抽取测试通过；并非实际 UI 交互验证。
- Web UI 自动化 BLOCKED：项目未提供浏览器自动化 runtime；未使用外部驱动。Android/iOS 设备及九主题实际视觉、触控和焦点 NOT_RUN。
- NAV-001、TASK-001、CHECK-001、REWARD-001、TICKET-002、STORE-001 的实际 UI 冒烟 NOT_RUN，缺少隔离测试环境。
- 独立 reviewer 检查奖励色映射、禁用优先级、三按钮尺寸、按压对比与测试，未发现明确功能回归。代码与自动化部分验证完成，实际页面及设备验收待补。
