# 验收记录：精简同行历史卡片

## 变更与环境

- 需求：用户在496×867页面截图指出同行伙伴、完整券名与完成状态同一行信息过多。默认改为「与某某同行」，完整伙伴券名按需展开，不再重复完成状态；保留committed待核对提示。
- 日期2026-10-23，应用1.0.8，main未提交工作区；保留前轮同行功能/演示及用户已有改动。本轮产品范围仅TicketsScreen与CompanionHistory，不改业务数据。主执行、compact_history_executor实现，demo_final_review独立只读复核。
- Node24，本机规范PATH；Node源码/模型回归。截图为用户提供的修改前证据，不作为修改后视觉通过证据。无项目UI runtime，不用其他驱动替代。
- 关联COMP-014/015/017与TICKET-006。ui-ux-pro-max指导默认摘要、次级信息渐进展示和保留可访问展开入口；无新依赖及平台变动。

## 自动化执行

日志目录 `/tmp/sprout-compact-history-20261023/` 为本机临时证据。测试均实际执行，不新增复述展示实现的单测。

| 阶段       | 命令                                                                 | 退出码   | 结果                                          |
| ---------- | -------------------------------------------------------------------- | -------- | --------------------------------------------- |
| 修改前定向 | tsx --test tests/companionUi.test.ts tests/ticketLayout.test.ts      | 0        | 8/8，baseline-targeted.log                    |
| 修改前全量 | npm test                                                             | 1        | 241项237通过4失败，baseline-test.log          |
| 修改后定向 | 同上两文件                                                           | 0        | 8/8，final-targeted.log                       |
| 修改后全量 | npm test                                                             | 1        | 241项237通过4失败，与基线同名，final-test.log |
| 类型       | npm run typecheck                                                    | 0        | final-typecheck.log                           |
| 全量静态   | npm run lint                                                         | 1        | 原有3 errors/3 warnings，final-lint.log       |
| 全量格式   | npm run format:check                                                 | 1        | 原有254文件，final-format.log                 |
| 目标格式   | prettier --check 两产品文件及本轮三份文档/记录                       | 0        | 主执行实际输出                                |
| 差异空白   | git diff --check                                                     | 0        | 无空白问题                                    |
| 独立复跑   | 两文件定向测试、npm run typecheck                                    | 0        | verifier观察8/8、类型无错                     |
| 开发服务   | CI=1 npm run web；curl -I --max-time 5 http://localhost:8082/tickets | 运行中/0 | 重启加载新代码；HTTP200，不代表UI交互         |

## 功能执行明细

| 用例                             | 层与参数                                       | 状态    | 实际证据/边界                                                 |
| -------------------------------- | ---------------------------------------------- | ------- | ------------------------------------------------------------- |
| COMP-014/015、TICKET-006相关回归 | 模型及源码约束                                 | PASS    | 定向8/8；不等于实际页面点击                                   |
| COMP-017代码复核                 | 主券/同行券、completed/committed               | PASS    | 独立审查方向、展开语义、自然换行、不写业务、列表key；未见缺陷 |
| COMP-017 UI                      | 375/390/496宽、长名、大字、键盘/读屏、展开收起 | BLOCKED | 无项目UI runtime，未执行修改后视觉/交互验证                   |
| 原生安装与跨平台资源导出         | DEV/资源                                       | N/A     | 本轮纯显示，不涉及入口打包配置或平台依赖；未额外执行          |

## 缺陷与未覆盖项

全量4个既有失败仍是engine.test.mjs重复用券夹具、keyboardFocus.test.ts按钮源码约束、milestoneCompact.test.ts布局约束及rewardHistory.test.ts导航字符串约束；未删除或放松断言。lint仍为既有脚本__dirname及页面effect诊断；format仍254文件，未批量改无关文件。

展开按钮使用共享ActionButton及expanded语义，长昵称/券名允许自然换行；真实点击、窄屏排版、字体缩放、读屏焦点未执行。状态与名称快照不变，不将视觉精简扩展为业务修改。

## 独立复核与结论

独立demo_final_review只读复核两产品文件、COMP-017与覆盖说明，实际定向8/8及typecheck通过，未发现缺陷。应用说明、稳定用例与覆盖边界已同步。

代码及自动化回归完成，实际UI效果待查看；不声明完整质量门禁或UI E2E通过。
