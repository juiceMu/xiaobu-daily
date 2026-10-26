# 验收记录：同行券与双方联合使用

## 变更与环境

| 项目                 | 实际内容                                                                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 需求/验收标准        | 本周1次未消费打卡兑换同行券；只随另一人打卡/里程碑/收到的赠送券一对一使用；双端授权、幂等消费、断线待核对，不代写他人副本 |
| 日期、执行与独立复核 | 2026-10-23；主执行与两个实现上下文；独立 verifier 只读逐文件审查及复跑，不与作者同一上下文自批                            |
| Git                  | main，起点 f9d5433，未提交工作区变更；保留原有 .DS_Store 与 android/gradle/wrapper/gradle-wrapper.properties.bak，不修改  |
| 应用/运行时          | package.json 1.0.8；Node v24.19.0；npm 10.8.2；宿主默认Node18未用于质量命令                                               |
| 平台                 | macOS 27.0.1 / arm64；Node业务及仓库替身、Expo静态资源导出；没有浏览器UI runtime/双原生测试设备                           |
| 日期/时区            | 用户时区Asia/Shanghai；测试注入2026-10-23与15分钟/提交/到期边界，不改真实设备时钟                                         |
| 数据与身份           | Node独立合法账户、各自内存仓库、真实领域函数/同步日志；无真实业务存档写入或清空，不在报告记录完整存档/口令                |
| 覆盖                 | 新增COMP-001至016；关联CHECK-004、REWARD-001/003/006、TICKET-002/004/007、GROUP-006、LAN-005/009、STORE-004、SYNC-001/002 |

## 自动化执行

所有npm/tsx命令先将 `/Users/lin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin` 加入PATH。日志目录为本机临时目录 `/tmp/sprout-companion-20261023/`；报告中的摘要及测试断言才是保留在工程内的证据，临时日志不保证长期保留。

针对性15文件命令：

```sh
./node_modules/.bin/tsx --test tests/companion.test.ts tests/companionStore.test.ts tests/companionUi.test.ts tests/facade.test.ts tests/groupSync.test.ts tests/syncModel.test.ts tests/store.test.ts tests/gift.test.ts tests/lanProtocol.test.ts tests/lanTransport.test.ts tests/ticketLayout.test.ts tests/todayLayout.test.ts tests/homeStats.test.ts tests/confirmationDialog.test.ts tests/historicalCheckin.test.ts
```

| 阶段                                       | 实际命令                                                               | 退出码 | 实际结果                                                                    | 日志/证据                          |
| ------------------------------------------ | ---------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------- | ---------------------------------- |
| 修改前完整基线                             | npm test                                                               | 1      | 208项：204通过、4失败、0跳过                                                | baseline-test.log                  |
| 修改前类型                                 | npm run typecheck                                                      | 0      | 无类型错误                                                                  | baseline-typecheck.log             |
| 修改前静态                                 | npm run lint                                                           | 1      | 3 errors / 3 warnings                                                       | baseline-lint.log                  |
| 修改前格式                                 | npm run format:check                                                   | 1      | 257文件存在格式问题                                                         | baseline-format.log                |
| 修改前UI相关源码回归                       | tsx --test todayLayout/ticketLayout/homeStats/confirmationDialog四文件 | 0      | 12/12通过；不是UI E2E                                                       | 独立UI实现上下文实际输出           |
| 修改后针对性                               | 上述15文件tsx命令                                                      | 0      | 88/88通过、0失败、0跳过                                                     | final-targeted.log                 |
| 修改后完整测试                             | npm test                                                               | 1      | 238项：234通过、4失败、0跳过；新增30项全部通过                              | final-test.log；失败名称与基线一致 |
| 修改后类型                                 | npm run typecheck                                                      | 0      | 无类型错误                                                                  | final-typecheck.log                |
| 修改后完整静态                             | npm run lint                                                           | 1      | 同基线3 errors / 3 warnings，无新增诊断                                     | final-lint.log                     |
| 新增/改动领域、state、新增UI与测试定向静态 | eslint显式18路径（不包含两份有既有诊断的页面）                         | 0      | 0 errors；3条配置忽略warning，声明及被忽略engineCore.mjs不算获得lint覆盖    | changed-lint.log                   |
| 修改后完整格式                             | npm run format:check                                                   | 1      | 254文件存在既有格式问题，未为清零批量改无关文件                             | final-format.log                   |
| 目标文件格式化                             | prettier --write 显式变更文件；独立verifier --check 14路径             | 0      | 已改/新增目标格式有效；engineCore.mjs及engine.test.mjs沿项目ignore，不重排  | 主执行及独立verifier实际输出       |
| Web资源                                    | npm run export:web                                                     | 0      | 成功导出dist-web，5个Web bundle；非浏览器运行验收                           | export-web.log                     |
| Android资源                                | npm run export:android                                                 | 0      | 成功导出Android Hermes bundle至dist；不是APK安装/启动                       | export-android.log                 |
| iOS资源                                    | npm run export:ios                                                     | 0      | 成功导出iOS Hermes bundle至dist；不是IPA安装/启动；在Android导出后执行      | export-ios.log                     |
| 差异空白                                   | git diff --check                                                       | 0      | 无空白错误                                                                  | 主执行实际输出为空                 |
| 预览服务                                   | CI=1 npm run web                                                       | 运行中 | Metro已输出Waiting on http://localhost:8082；CI模式无热更新；未操作业务存档 | 仅开发服务就绪，不计UI通过         |

## 功能执行明细

下表PASS只代表注明的D/S层，不能提升为相同编号的UI/DEV验收通过。可重复的实际断言见三个新增测试文件。

| 用例                      | 参数/平台/数据                                       | 状态    | 实际结果与证据                                                                   | 未覆盖边界                                              |
| ------------------------- | ---------------------------------------------------- | ------- | -------------------------------------------------------------------------------- | ------------------------------------------------------- |
| COMP-001/002              | D，Node独立存档；本周余额/历史周/撤销                | PASS    | cost=1共享spent、普通兑换剩余成本、余额不足及历史周拒绝、撤销不低于消费          | 页面确认取消未执行                                      |
| COMP-003                  | D，开启/关闭到期、随后修改规则                       | PASS    | 同时刻与普通券到期一致，永久为null，不追改旧同行券                               | 原生设置操作未执行                                      |
| COMP-004                  | D，checkin/weight/gift主券分别执行                   | PASS    | 三来源均经双端授权一次消费，自己副本不代写；提交后晚到仍履约                     | 真实双机未执行                                          |
| COMP-005                  | D/S，自己/同类/未知/非法备注/同ticketId跨账户        | PASS    | 非法拒绝且不变异；同ID不同owner完整闭环与重放不串账                              | 全组页面点击未执行                                      |
| COMP-006                  | D/S，主券邀请，空/trim/200字共同用途                 | PASS    | 看到邀请未接受不扣券；accepted后主券提交，副券沿用提交时间；两端完成             | React实际弹窗/输入未挂载                                |
| COMP-007                  | D，同行方requested→主券invited→同行方accepted        | PASS    | 未经主券本机批准不能扣主券；双方完成一次                                         | 真实邀请提示待测                                        |
| COMP-008                  | D，取消、accepted请求取消、提交取消交错；标签模型    | PASS    | accepted取消保持锁；主券取消后解锁；主券已提交优先；completed不误显示取消待核对  | 明确拒绝、重复请求与双机点击交错待测                    |
| COMP-009                  | S，双内存仓库，主券提交后重建两端store               | PASS    | 重载保留committed/accepted，同一笔三轮恢复，不重复消费或新增无变化事务           | 真SQLite及真实杀进程待测                                |
| COMP-010                  | S，收到accepted时仓库save抛错                        | PASS    | 远端副本、本机提交/扣券、同步事务整体保留旧快照，persisted=false；恢复后成功一次 | 原生磁盘/网络故障待测                                   |
| COMP-011                  | D，超过15分钟未提交、已提交后晚到                    | PASS    | 未提交过期取消；accepted不单方面释放；合法已提交结果按原时间履约                 | 恰好15分钟及两券实际到期边界未执行；真实时钟/前后台待测 |
| COMP-012                  | D/S，坏会话/改绑定/删会话/回退/无peer证明            | PASS    | 迁移/历史日志/提交阶段证明拒绝坏数据                                             | 不承诺共享组口令下的独立成员签名                        |
| COMP-013                  | D/S，锁券单用/离组、终态一方先离组                   | PASS    | 未决阻止离组；取消与完成的离组日志仍可供另一端核对                               | 设备永失无服务器可强解锁                                |
| COMP-014                  | D，正常昵称及无昵称，完成/离组/重载                  | PASS    | 双方券名/昵称/用途保留，无昵称快照为“成员”；UI有历史声明                         | 历史真实排版待测                                        |
| COMP-015                  | 候选模型与UI源码                                     | PASS    | 候选排除离组/过期/占用、双入口/摘要/平台禁用/历史源码契约                        | 这不是UI执行通过                                        |
| COMP-015                  | UI，375/390宽、大字体、Web禁用/确认/草稿             | BLOCKED | 未找到项目提供的浏览器UI runtime，无替代驱动操作                                 | 需项目runtime及页面证据                                 |
| COMP-016                  | S，固定发送快照、无会话、失败/身份变化、本机日志回传 | PASS    | 三轮收敛、普通一轮、失败抛出；精确本机旧前缀可ACK，伪造回传不ACK                 | Provider挂载及真实网络待测                              |
| COMP-004/006至013/016     | DEV，Android/Android、iOS/iOS、混合双机              | NOT_RUN | 仅打包和Node替身，不声称安装/启动/真实WiFi同步通过                               | 缺两台测试设备及原生隔离存档                            |
| 关联LAN/STORE/VIEW/UI用例 | DEV/UI，权限、mDNS/TCP、SQLite、前后台               | NOT_RUN | 自动化影响回归中的纯函数/替身/源码层已执行，不能取代设备层                       | 需实际设备及runtime                                     |

精确边界补测：COMP-011在恰好15分钟、主券先到期、同行券先到期三种情况下的联用执行断言均为 **NOT_RUN**；COMP-008的明确拒绝及重复请求执行断言也为 **NOT_RUN**。规格与源码检查不计为这些场景已执行。

## 基线失败与剩余风险

| 项目                                                              | 优先级/归属                      | 实际情况                                                                                        | 处理                                                                         |
| ----------------------------------------------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| engine.test.mjs“重复及过期奖券不能通过填写新备注消费或覆盖原备注” | 既有测试夹具失败，相关TICKET-004 | 修改前后均在第二张券undefined.id处TypeError；用例在默认每日上限下第二次打卡不足，未生成第二张券 | 未放松断言或改无关基线；新同行领域/重复与重放专测通过，但此基线仍待维护      |
| keyboardFocus.test.ts outlined按钮源码断言                        | 既有                             | 修改前后同名失败                                                                                | 未为本功能改共享按钮样式或断言                                               |
| milestoneCompact.test.ts 永久奖励行源码断言                       | 既有                             | 修改前后同名失败                                                                                | 未修改该里程碑布局                                                           |
| rewardHistory.test.ts 导航字符串断言                              | 既有                             | 修改前后同名失败                                                                                | 未修改该导航契约                                                             |
| 全量lint                                                          | 既有                             | 两处__dirname no-undef、TicketsScreen原有effect错误及3个hook警告；本次未增加                    | 不能宣称完整lint通过                                                         |
| 全量format                                                        | 既有                             | 254文件，含既有Android构建产物及无关源码/文档；基线257                                          | 仅格式化本次目标，不批量改用户文件                                           |
| 跨设备一致性                                                      | 产品限制                         | 每台设备本地原子保存，不是跨设备原子事务；断线阶段可能一端已提交另一端待核对                    | 持久化决定、锁券及重放恢复；双方新版同组原生前台WiFi，结果未齐不显示双端完成 |
| 永久失联                                                          | 产品限制                         | accepted后不能用超时安全判定主券是否已提交                                                      | 保持锁，恢复原主券设备/存档后核对；没有服务器强制解锁                        |

本次独立复核发现并修复两项P2：取消请求后最终completed标签优先级错误；无昵称快照“我”在对方历史产生歧义。均已增加断言并通过复跑。

## 独立复核与结论

- 独立verifier审查24个相关文件，逐项覆盖领域/存储/编排/UI/声明/测试/四份文档；两个用户无关文件明确排除，不修改。只读审查与作者实现分离。
- verifier实际执行六文件针对性测试52/52、typecheck退出0、目标格式检查退出0；新增实现与测试ESLint无错误，声明文件配置忽略不作覆盖声明。
- verifier核对全量日志与基线同名失败，未发现新增P0/P1或中高严重度阻断缺陷。验收记录的平台导出退出码由主执行实际观察补齐，不归为verifier真机证据。
- 用例库新增COMP-001至016；覆盖表增加三个测试文件；应用说明和数据架构记录流程、边界、兼容性及永久失联限制。
- 结论：**代码与自动化复核完成，功能验收部分验证待补**。不声明全量质量门禁、真实UI E2E或双原生设备验收通过；发布前须补设备矩阵及修复/确认既有基线失败。
