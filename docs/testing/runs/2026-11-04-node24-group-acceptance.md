# Node 24 小组动态验收记录

- 范围：今日打卡公共区域、任务区、小组排行、打卡足迹与成员入口；关联 VIEW-008 至 VIEW-014、DEMO-005。
- 环境：macOS；通过 nvm 安装 Node v24.22.2，npm v11.19.1。安装前使用 Node 18 的测试有 28 项失败，不作为 Node 24 基线。
- `npm test`：退出码 0，343 项通过；涵盖领域模型及源码结构，不等同 UI 交互验收。
- `npm run typecheck`：退出码 0。
- `npm run lint`：退出码 1；现有未跟踪文件 `testa.js` 有 6 个未定义变量错误，`TodayScreen.tsx` 有 2 个 Hook 依赖警告。
- `npm run format:check`：退出码 0。
- `curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8082/today`：退出码 0，HTTP 200；仅证明入口响应，不证明页面或交互通过。
- Web 实际交互：BLOCKED。项目未提供浏览器自动化 runtime，项目规范禁止用外部驱动替代；未操作或清理用户存档。原生设备、双设备同步、无障碍与不同屏幕实际验收未执行。
- 独立复核：检查了项目 runtime、相关源码和现有测试；发现成员卡历史周兑换数量按所选周计算，但标签固定为「本周已兑」，可能误导，待修复及实际 UI 验证。
- 结论：自动化和类型检查通过，但 lint 未通过，且缺少 UI 交互证据并有待修复问题，不能判定功能整体验收通过。
