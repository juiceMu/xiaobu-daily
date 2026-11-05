# 验收记录：今日打卡小组动态

## 变更与环境

| 项目                     | 实际内容                                                                                                                           |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| 需求及验收标准           | C 方案：保留原有打卡功能，增加分区、所选周成员排行与有效打卡时间轴                                                                 |
| 日期、执行者、独立复核者 | 2026-11-04；Codex；独立 verifier 子代理                                                                                            |
| 提交、分支及范围         | `a913936`，`main`；本次改动未提交。原有未跟踪 `.DS_Store`、`android/gradle/wrapper/gradle-wrapper.properties.bak`、`testa.js` 保留 |
| 版本、工具               | 应用 1.0.33，Node 24.22.1，npm 10.8.2，macOS                                                                                       |
| 时区及数据               | Asia/Tokyo；自动化使用测试夹具，不操作用户业务存档                                                                                 |
| 基线                     | 修改前 `homeStats`、`groupSync`、`todayLayout` 14 项通过；关联 VIEW-002、VIEW-008 至 VIEW-010                                      |

## 自动化执行

| 阶段           | 命令                                                                                         | 退出码 | 结果                                                                |
| -------------- | -------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------- |
| 基线           | `tsx --test tests/homeStats.test.ts tests/groupSync.test.ts tests/todayLayout.test.ts`       | 0      | 14 通过                                                             |
| 独立针对性复核 | `tsx --test` 对 groupActivity、groupActivityLayout、historicalCheckin、homeStats、dateScroll | 0      | 21 通过；结构断言不是 UI E2E                                        |
| 全量           | `npm test`                                                                                   | 0      | 333 通过，0 失败，0 跳过                                            |
| 类型           | `npm run typecheck`                                                                          | 0      | 通过                                                                |
| 静态检查       | `npm run lint`                                                                               | 1      | 原有未跟踪 `testa.js` 六处 no-undef；TodayScreen 两条既有 Hook 警告 |
| 格式           | `npm run format:check`                                                                       | 0      | 通过，新增本记录前执行                                              |
| Web 导出       | `npm run export:web`                                                                         | 0      | 资源导出成功                                                        |
| Android 导出   | `npm run export:android`                                                                     | 0      | 资源导出成功，不等于安装或启动                                      |
| iOS 导出       | `npm run export:ios`                                                                         | 0      | 资源导出成功，不等于安装或启动                                      |

初次类型、lint 和 Web 导出因本地缺少锁文件中的 `expo-clipboard` 失败。补装 57.0.2 后重跑，清单与锁文件未修改；安装同时调整了本地 `node_modules` 中其他包。

## 功能执行明细

| 用例                                                            | 参数/平台                 | 状态    | 证据或阻塞原因                                                                 |
| --------------------------------------------------------------- | ------------------------- | ------- | ------------------------------------------------------------------------------ |
| VIEW-009                                                        | Node 领域夹具             | PASS    | 排行、补卡、撤销、历史周、离组和删除任务由 `groupActivity.test.ts` 验证        |
| VIEW-008、VIEW-010                                              | Node 源码结构             | PASS    | `groupActivityLayout.test.ts` 验证分区、空态、切周和分页结构；不是实际 UI 操作 |
| VIEW-008 至 VIEW-010                                            | Web、Android、iOS 实际 UI | NOT_RUN | 未执行项目 runtime 或设备交互；结构断言不能代替视觉、点击、滚动和读屏          |
| GROUP-003、LAN-001、VIEW-002/005                                | 双设备同步                | NOT_RUN | 未使用隔离双设备，不能据模型测试宣称真实同步通过                               |
| NAV-001、TASK-001、CHECK-001、REWARD-001、TICKET-002、STORE-001 | 实际 UI 冒烟              | NOT_RUN | 未执行隔离 UI 冒烟                                                             |

## 独立复核与结论

独立 verifier 审阅了数据模型、页面、差异和针对性测试；修正了偏好读取失败提示和时间轴无界渲染，未发现新的阻断问题。真实 UI、大字号、无障碍、长列表及双设备同步仍待验收。用例、覆盖映射及应用说明已更新。本次结论为部分验证待补，不宣称真机验收通过。

最终复核指出，动态分区切周时隐藏的原任务列表仍执行滚动位置恢复；切回后位置是否保持，以及隐藏内容是否从原生读屏和 Web 焦点中排除，均需实际 UI 与无障碍验证。独立重跑 `groupActivityLayout` 和 `dateScroll` 共 10 项通过，但无法证明上述设备行为。
