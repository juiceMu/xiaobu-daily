# 验收记录：账户页大字体软键盘遮挡

## 变更与环境

- 缺陷/用例：INPUT-002、NAV-006、PROFILE-001/006。OPPO隔离QA 1.0.18/code19、Android 16、1080×2376、density 480、字体1.5。上一轮尚未判定遮挡；本轮23:18左右重进账户页，输入昵称草稿后确认 `mInputShown=true`，截图可见键盘约从y=1380开始，昵称与保存区域在其后；在键盘上方从y=1050向y=400滑动后，界面树仍显示昵称y=1788–1938、保存y=2130–2292，坐标未变化。原始截图出于隐私已删除；字体已恢复1.0、草稿已放弃，重进显示原昵称QA。仅该旧包样本失败，新修复尚未真机复测。
- 基线：HEAD 95ce109/main，工作区已有冷链导航修复、版本及多份设备验收记录；均保留。本次修改账户页、账户测试、INPUT-002及覆盖映射和此记录。
- 执行者executor_nav_cold；独立复核待主代理安排。2026-10-31、Asia/Shanghai；Node v24.22.1。未访问业务存档、设备、构建或安装。
- 账户原本使用普通Page滚动，未按键盘避让；Android manifest已配置adjustResize且启用edge-to-edge，现有证据不足以断言OPPO未缩小窗口的系统根因。参考同项目设置页，以导航头高度作为offset，局部使用KeyboardAvoidingView（Android height、iOS padding），不改共享Page、草稿和保存行为。

## 自动化执行

命令均位于项目根目录，PATH前缀为 `/Users/mac/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH`。

| 阶段             | 命令                                                                                                                                                                               | 退出码  | 结果                                                                                                             |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------- |
| 修改前基线       | `node --import tsx --test tests/accountProfile.test.ts tests/compactInputs.test.ts tests/borderlessScreens.test.ts`                                                                | 0       | 12通过、0失败、0跳过；未覆盖真实键盘                                                                             |
| 新增结构断言先红 | `node --import tsx --test tests/accountProfile.test.ts`                                                                                                                            | 1       | 8通过、1失败；缺少useHeaderHeight                                                                                |
| 初次修复定向     | 上述三文件定向命令                                                                                                                                                                 | 1       | 12通过、1失败；断言未允许Prettier换行，修正断言后重跑                                                            |
| 修复后定向       | 上述三文件定向命令                                                                                                                                                                 | 0       | 13通过、0失败、0跳过；新增为源码接线断言而非UI测试                                                               |
| 全量测试         | `npm test`                                                                                                                                                                         | 0       | 308通过、0失败、0跳过                                                                                            |
| 类型检查         | `npm run typecheck`                                                                                                                                                                | 0       | `tsc --noEmit`通过                                                                                               |
| lint             | `npm run lint`                                                                                                                                                                     | 1       | 既有create-app-icon.cjs两处__dirname未定义，TodayScreen两处Hook依赖警告，与本次改动无关                          |
| 全量格式         | `npm run format:check`                                                                                                                                                             | 1       | 392个文件警告，含Android既有构建产物、多个既有源文件及本次修改的两份文档；随后格式化本次两份文档，不宣称全量通过 |
| 局部格式         | `node node_modules/prettier/bin/prettier.cjs --write src/screens/AccountScreen.tsx tests/accountProfile.test.ts`；同命令针对 `docs/testing/TEST_CASES.md docs/testing/COVERAGE.md` | 0       | 仅格式化本次涉及文件                                                                                             |
| 平台资源导出     | `npm run export:android`、`npm run export:ios`、`npm run export:web`                                                                                                               | 各0     | 主代理使用Node 24执行；仅证明资源导出，不能证明安装或交互                                                        |
| 打包、安装、设备 | 未执行                                                                                                                                                                             | NOT_RUN | 主代理负责新包和真机；不能将源码断言等同设备成功                                                                 |

## 功能执行明细

| 用例                    | 参数                                       | 状态    | 证据与边界                                                                         |
| ----------------------- | ------------------------------------------ | ------- | ---------------------------------------------------------------------------------- |
| INPUT-002               | OPPO旧QA、大字体1.5、昵称键盘展开          | FAIL    | 主代理报告向上滑后昵称/保存仍在键盘下方；未直接由本执行者复核                      |
| INPUT-002               | 账户页面键盘避让接线                       | PASS    | 源码结构测试验证包裹、offset、平台行为及原昵称/保存/草稿保护仍存在；不证明实际布局 |
| INPUT-002               | 新包OPPO大字体键盘展开并点击保存；三星回归 | NOT_RUN | 待主代理实测昵称、错误及保存可滚至键盘上方、键盘收起恢复、草稿/返回行为            |
| NAV-006/PROFILE-001/006 | 自动化草稿和存储子项                       | PASS    | 账户测试通过；仅限自动化参数                                                       |
| NAV-006/PROFILE-001/006 | 新包真实UI草稿确认、相册和保存交互         | NOT_RUN | 待主代理新包复测                                                                   |
| Web/iOS                 | 键盘与页面滚动                             | NOT_RUN | 该项目未提供Web UI自动化runtime，本子任务无iOS设备；记录风险                       |

## 独立复核与结论

- 独立verifier只读复核源码、测试与记录，未发现可由静态diff确认的新代码缺陷；独立运行账户、紧凑输入、无边框三文件定向测试13通过、0失败。复核者未操作设备或重跑全量门禁、导出；指出原记录未区分上一轮未判定与本轮新增截图观察，现已补明。Android窗口避让、三星、iOS/Web、草稿和相册仍需实际回归。变更遵循ui-ux-pro-max的焦点不遮挡、大字体可滚动和保留草稿原则。
- 已维护INPUT-002及accountProfile覆盖映射；业务规则未变，应用说明无需更改。
- 当前仅代码与自动化部分验证；新包真实键盘可达性仍待检验。全量lint与format存在上述失败，不能宣称所有门禁通过。
