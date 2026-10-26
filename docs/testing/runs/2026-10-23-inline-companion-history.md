# 验收记录：同行历史直接分行展示

2026-10-23，应用1.0.8，main未提交工作区。用户496×867截图否定展开按钮造成的空白与拥挤，要求直接展示。保留前轮功能及用户改动，本轮仅CompanionHistory与应用说明、COMP-017、覆盖说明。使用Node24与独立Node测试，无真实业务数据写入。

## 实现与验证

取消展开状态和按钮，直接以12号字、18行高、4间距显示「同行：伙伴名」「搭配：完整券名」；长文本自然换行，不重复完成文案，原committed待核对提示保留。主执行修改，独立demo_final_review复核最终文件及文档。

日志位于临时目录 `/tmp/sprout-inline-history-20261023/`。

| 实际命令                                                              | 退出码 | 结果                                            |
| --------------------------------------------------------------------- | ------ | ----------------------------------------------- |
| 修改前tsx --test tests/companionUi.test.ts tests/ticketLayout.test.ts | 0      | 8/8，baseline.log                               |
| 修改后同两文件测试                                                    | 0      | 8/8，targeted.log；独立复跑也是8/8              |
| npm test                                                              | 1      | 241项237通过4失败，test.log；与上轮基线同名失败 |
| npm run typecheck                                                     | 0      | typecheck.log                                   |
| npm run lint                                                          | 1      | 原有3 errors/3 warnings，lint.log               |
| npm run format:check（格式化前）                                      | 1      | 255文件，含本轮组件1份；format.log              |
| prettier --write/--check 本轮组件及三份文档                           | 0      | 格式修正后目标全部符合；未声称重跑全量格式通过  |
| eslint src/ui/CompanionHistory.tsx                                    | 0      | 无诊断                                          |
| git diff --check                                                      | 0      | 无空白问题                                      |
| CI=1 npm run web                                                      | 运行中 | 已重启，localhost:8082就绪，供用户刷新查看      |

全量4失败为既有engine重复用券夹具、keyboardFocus按钮源码约束、milestoneCompact布局约束、rewardHistory导航约束，未删除或放松断言。lint同既有脚本及页面effect诊断。

## 用例与结论

- COMP-017代码复核PASS：两视角归属正确、无按钮/本地展开state/业务写入；文档与实现一致。
- 相关模型/源码回归PASS（8/8），不是实际UI执行。
- COMP-017真实UI、375/390窄屏、大字体及读屏BLOCKED：无项目提供的UI runtime，不用其他驱动替代。用户截图仅为修改前证据。
- 原生设备与资源导出N/A：纯展示变更，不涉及平台依赖，未额外执行。

独立复核未发现问题。代码及自动化验证完成，实际视觉效果待用户刷新查看；不声明全量门禁或UI验收通过。
