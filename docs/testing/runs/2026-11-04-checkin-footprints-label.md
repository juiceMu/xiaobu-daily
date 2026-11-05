# 打卡足迹标题验收记录

- 范围：小组动态标题由「打卡时间轴」改为「打卡足迹」，不改变记录规则。
- 用例：VIEW-013；平台：macOS，Node v18.20.5。项目要求 Node 24，本次环境未满足。
- 基线：未在修改前运行检查，无法确认失败是否为基线问题。
- `npx tsx --test tests/groupActivityLayout.test.ts`：退出码 0，5 项通过；仅源码结构检查，非 UI 验收。
- `npm test`：退出码 1，343 项中 315 项通过、28 项失败；其中可见失败提示本机安全编号服务不可用。
- `npm run typecheck`：退出码 0。
- `npm run lint`：退出码 1，未跟踪文件 `testa.js` 有 6 个未定义变量错误；`TodayScreen.tsx` 有 2 个 Hook 依赖警告。
- `npm run format:check`：退出码 0。
- 未执行：Node 24 环境复验、实际页面交互与独立复核。
