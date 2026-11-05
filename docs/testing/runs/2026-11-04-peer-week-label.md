# 成员兑换周标签验收

- 范围：VIEW-002；当前周显示「本周已兑」，历史周显示「所选周已兑」，数值规则不变。
- 环境：macOS、Node v24.22.2。修改前 `npx tsx --test tests/todayLayout.test.ts tests/groupActivityLayout.test.ts` 退出码 0，10 项通过。
- 修改后 `npm test` 退出码 0，343 项通过；`npm run typecheck` 退出码 0。
- 格式化后 `npm run format:check` 退出码 0。
- `npm run lint` 退出码 1：已有未跟踪文件 `testa.js` 有 6 个未定义变量错误，`TodayScreen.tsx` 有 2 个 Hook 依赖警告。
- 独立复核未发现标签逻辑问题；源码结构测试不能代替实际界面验收。
- Web 实际切周交互未执行：项目未提供允许的 UI 自动化 runtime；原生设备未验收。
