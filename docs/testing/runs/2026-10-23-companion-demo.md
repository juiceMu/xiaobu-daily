# 验收记录：同行券三状态演示数据

## 变更与环境

- 需求：显式开发预览追加可用、已使用、已过期各一张同行券；已使用含伙伴、主券和用途，已有演示可增量补齐，不覆盖用户记录。
- 2026-10-23；主执行、demo_executor实现与独立demo_final_review只读复核。main起点f9d5433，工作区包含上轮未提交同行功能；本轮限demoData、demoHistory、AppProvider预览回调、DemoHistoryPanel、demoData测试及说明/用例/覆盖文档。保留两份原有无关未跟踪文件。
- 应用1.0.8；Node24.19.0，PATH使用测试规范的本机Node24目录；macOS宿主，Node内存仓库隔离数据。时间注入2026-10-20中午，沿本地日历回溯七天，不改设备时钟。
- 关联DEMO-001至004、COMP-014、STORE-004、SYNC-001。两次真实事务形成accepted与completed，不放松同步验证。第二步失败保留第一步，可重载重试；不声称整体一次原子提交。虚构伙伴仅演示小组生成，不加入真实组。

## 自动化执行

日志目录 `/tmp/sprout-companion-demo-20261023/`，临时日志不保证长期保留。以下均实际执行。

| 阶段       | 命令                                                                                                                                 | 退出码   | 结果与证据                                            |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------- | ----------------------------------------------------- |
| 修改前全量 | npm test                                                                                                                             | 1        | 238项234通过4失败；baseline-test.log                  |
| 修改前类型 | npm run typecheck                                                                                                                    | 0        | baseline-typecheck.log                                |
| 修改前静态 | npm run lint                                                                                                                         | 1        | 3 errors/3 warnings；baseline-lint.log                |
| 修改前格式 | npm run format:check                                                                                                                 | 1        | 254文件；baseline-format.log                          |
| 修改后定向 | tsx --test tests/demoData.test.ts tests/companion.test.ts tests/companionStore.test.ts tests/companionUi.test.ts tests/store.test.ts | 0        | 45/45；targeted.log                                   |
| 修改后全量 | npm test                                                                                                                             | 1        | 241项237通过4失败，与基线同名失败；final-test.log     |
| 修改后类型 | npm run typecheck                                                                                                                    | 0        | final-typecheck.log                                   |
| 修改后静态 | npm run lint                                                                                                                         | 1        | 同基线3 errors/3 warnings；final-lint.log             |
| 修改后格式 | npm run format:check                                                                                                                 | 1        | 同基线254文件；final-format.log                       |
| Web资源    | npm run export:web                                                                                                                   | 0        | 导出dist-web；export-web.log；不代表UI执行            |
| 独立复跑   | tsx --test tests/demoData.test.ts                                                                                                    | 0        | demo_final_review观察8/8通过                          |
| 差异空白   | git diff --check                                                                                                                     | 0        | 无空白错误                                            |
| 开发服务   | CI=1 npm run web；curl -I --max-time 5预览地址                                                                                       | 运行中/0 | localhost:8082服务就绪，预览深链HTTP200；非浏览器交互 |

## 功能执行明细

| 用例                              | 平台/数据         | 状态    | 证据与边界                                                                         |
| --------------------------------- | ----------------- | ------- | ---------------------------------------------------------------------------------- |
| DEMO-004三状态及历史              | D/S，Node隔离存档 | PASS    | 本机三张同行券分别available/used/expired；伙伴、里程碑主券、共同用途与完成阶段断言 |
| DEMO-004旧演示与重复              | D/S，已有基础演示 | PASS    | 共用预览流程增量补齐，重复调用整档不变；validateSync通过                           |
| DEMO-004原数据/真实组             | D/S，两组独立存档 | PASS    | 原券、设置及当前周可兑换余额不变；真实组组信息不变且不加假成员                     |
| DEMO-004两步失败恢复              | S，保存失败替身   | PASS    | 第二步失败保留第一步；隔日重载按原时间完成，不重复消费                             |
| DEMO-004设置点击/URL挂载/卡片视觉 | UI，Web及原生     | BLOCKED | 无项目提供的UI runtime，未替代使用其他驱动；Node测试不是UI E2E                     |
| 同行演示周一/周日与过期设置组合   | D/UI              | NOT_RUN | 现有同行演示断言固定注入周二；不以基础演示周一测试代替                             |
| 真机存储/双机/安装启动            | DEV               | NOT_RUN | 本轮仅开发样例，不构成真实网络/SQLite/设备证据；未改平台依赖，未追加原生资源导出   |

## 缺陷与未覆盖项

全量仍有既有engine.test.mjs重复用券夹具失败、keyboardFocus.test.ts按钮源码断言、milestoneCompact.test.ts布局源码断言、rewardHistory.test.ts导航字符串断言；与修改前同名。lint仍为原有__dirname及页面effect问题，format仍254既有文件。没有删除或放松断言消除失败。

演示记录实际保存并参与统计/outbox；不是可随意清除的临时mock。已有真实组仅保留基础样例，不注入同行假伙伴；完整预览应使用独立浏览器配置的演示存档，不要求用户退出真实组或清数据。

## 独立复核与结论

demo_final_review独立只读审核本轮实现，实际复跑演示测试8/8，未发现阻断问题；指出真实UI及周一/周日到期组合尚未验证。APP_MANUAL、DEMO-004与覆盖映射已维护。

结论：代码及演示数据自动化验证完成，UI效果验收待用户查看；不声明全量门禁或真实双机验收通过。
