# 验收记录：选中态与控件反馈

## 变更与环境

- 2026-11-05，Codex 实施，独立 verifier 复核；`main` 基准 `f29a765`，工作区包含前序主题改动和未跟踪用户文件。
- macOS，应用 1.0.33，Node 24.22.1、npm 10.8.2。关联 THEME-006、THEME-001、A11Y-001/002。
- 新主题里程碑及奖券成员选中项增加主题色边界；成员、账户头像、原生时间字段和关闭按钮扩大触控区，补充适用的按压与禁用反馈。共享控件调整作用于九套主题，旧五套调色盘不变，但交互反馈和部分控件高度有意改变。

## 自动化

| 阶段         | 命令                                                                                                                                                               | 退出码 | 结果                                                                 |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ | -------------------------------------------------------------------- |
| 修改前基线   | `tsx --test tests/milestoneSelection.test.ts tests/milestoneCompact.test.ts tests/ticketLayout.test.ts`                                                            | 0      | 11 通过                                                              |
| 修改前基线   | `tsx --test tests/uiTheme.test.ts tests/keyboardFocus.test.ts tests/compactInputs.test.ts tests/settingsControls.test.ts tests/accountProfile.test.ts`             | 0      | 30 通过                                                              |
| 修改后专项   | 上述共享控件集合                                                                                                                                                   | 0      | 31 通过                                                              |
| 独立复核专项 | `tsx --test tests/ticketLayout.test.ts tests/milestoneCompact.test.ts`；`tsx --test tests/keyboardFocus.test.ts tests/uiTheme.test.ts tests/compactInputs.test.ts` | 0      | 分别 8、16 通过；源码和颜色检查，不等同设备交互                      |
| 全量         | `npm test`                                                                                                                                                         | 0      | 352 通过                                                             |
| 类型         | `npm run typecheck`                                                                                                                                                | 0      | 通过                                                                 |
| 格式         | `npm run format:check`                                                                                                                                             | 0      | 临时浏览器证据移出工作区后通过                                       |
| 静态检查     | `npm run lint`                                                                                                                                                     | 1      | 既有未跟踪 `testa.js` 六处 no-undef，TodayScreen 两处既有 hooks 警告 |

## 实际执行与限制

- THEME-006：用户授权的外部浏览器驱动使用独立会话和演示存档；390×844、晨光暖杏下观察里程碑和奖券选中边界，成员控件测得 48×48 CSS px；切换里程碑时 `aria-selected` 从 true 变 false、新项变 true，成员 `aria-checked` 为 true。截图保存在独立预览目录 `theme-ui-audit-evidence`；不代表九主题及其他尺寸全部通过。
- 首次 Web 检查发现状态未映射到 DOM；已显式补充 Web ARIA 并复测。图标选择和表单关闭不提供统一 disabled API，本次不声明其禁用状态通过；时间控件有禁用状态。
- Android/iOS 真实触控、读屏、时间选择和大字号 NOT_RUN；NAV-001、TASK-001、CHECK-001、REWARD-001、TICKET-002、STORE-001 实际 UI 冒烟 NOT_RUN。源码断言及 Web 单样本不代替设备验收。
- 独立 verifier 复核了主题分支、触控大小和共享控件，未发现新的明确功能回归。结论：代码和自动化验证完成，设备验收待补；全量 lint 被既有文件阻塞。
