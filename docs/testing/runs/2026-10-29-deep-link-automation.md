# 验收记录：QA深链自动化与资源门禁

## 变更与环境

- 2026-10-29，Asia/Shanghai；executor_qa实现，review_final独立只读复核。主代理独占ADB及Gradle，设备证据另见[真机记录](./2026-10-29-deep-link-device.md)。
- 基于main、HEAD `d8babcc` 的已有脏工作区，保留此前同步、日期滚动、复制、相机等修改，未commit。应用1.0.15/code16升至1.0.16/code17，Node24.22.1、npm10.8.2，macOS本地Node测试及三端资源导出。
- NAV-003：仅新增JS导航 `sprout-qa://` 前缀，保留开发/正式前缀；原生正式/QA注册隔离不变。同步维护用例库、覆盖映射、应用说明、CHANGELOG及Android技能。已内容审查技能与日志，记录QA原生协议与JS前缀必须双层匹配；无依赖/签名变更。
- Expo本地 `createURL.ts` / `Schemes.ts` 从Expo配置取scheme，不读Gradle QA占位；React Navigation真实 `extractPathFromURL` / `getStateFromPath` 参与本次回归。JS兼容QA不为正式包注册额外系统协议。

## 自动化执行

所有日志保存于 [deep-link-evidence](./2026-10-29-deep-link-evidence/)。下面退出码均来自本次启动命令及最终session返回，未以日志尾部代替进程终态。

| 阶段                     | 实际命令                                                                                        | 退出码 | 结果/证据文件                                                   |
| ------------------------ | ----------------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------- |
| 修改前已有导航基线       | `node node_modules/tsx/dist/cli.mjs --test tests/taskNavigation.test.ts`                        | 0      | 5/5，xiaobu-linking-baseline.log                                |
| 新增缺陷回归，旧产品代码 | `node node_modules/tsx/dist/cli.mjs --test tests/deepLink.test.ts`                              | 1      | 4/5，仅QA协议账户解析undefined，xiaobu-linking-new-baseline.log |
| 修改后针对回归           | `node node_modules/tsx/dist/cli.mjs --test tests/deepLink.test.ts tests/taskNavigation.test.ts` | 0      | 10/10，xiaobu-linking-targeted.log                              |
| 完整测试                 | `npm test`                                                                                      | 0      | 291/291，test.log                                               |
| 类型                     | `npm run typecheck`                                                                             | 0      | typecheck.log                                                   |
| 静态检查                 | `npm run lint`                                                                                  | 1      | 既有3errors/3warnings，lint.log                                 |
| 完整格式                 | `npm run format:check`                                                                          | 1      | 既有312文件style；无ENOENT，format.log                          |
| Web资源                  | `npm run export:web -- --output-dir /private/tmp/xiaobu-linking-1.0.16.T2vP9F/web`              | 0      | export-web.log                                                  |
| Android资源              | `npm run export:android -- --output-dir /private/tmp/xiaobu-linking-1.0.16.T2vP9F/android`      | 0      | export-android.log                                              |
| iOS资源                  | `npm run export:ios -- --output-dir /private/tmp/xiaobu-linking-1.0.16.T2vP9F/ios`              | 0      | export-ios.log                                                  |
| 打包结构预检             | `npm run build:apk -- --check`                                                                  | 0      | precheck.log；不执行Gradle、不代替内容审查                      |

lint为create-app-icon.cjs两处no-undef、TicketsScreen set-state-in-effect及缺依赖、TodayScreen两处缺依赖，和1.0.15既有基线一致。format仍为303个Android生成文件及9个既有源文件；未为使门禁变绿而改无关实现或放松断言。

## 功能结果及未覆盖

| 用例          | 参数/层级                                       | 状态    | 观察                                                                                   |
| ------------- | ----------------------------------------------- | ------- | -------------------------------------------------------------------------------------- |
| NAV-003       | 正式/QA/开发前缀，抽取真实配置+官方库           | PASS    | account/growth/gifts/group状态对应，更多index为返回入口；today/tickets及member参数正确 |
| NAV-003       | 未知/相似协议、未知路径、缺失member参数，官方库 | PASS    | 返回undefined，不匹配路由                                                              |
| NAV-003       | 原生协议隔离，配置约束                          | PASS    | app.json保留sprout，Gradle正式sprout、QA sprout-qa，Manifest仅占位协议                 |
| NAV-003       | 新包冷热启动、返回键、成员页面授权              | NOT_RUN | 此执行者未操作设备，由主代理在独立真机记录补充                                         |
| NAV-003       | Web/iOS实际页面交互                             | NOT_RUN | 未使用项目runtime，资源导出不代表页面/E2E通过                                          |
| BUILD-002/003 | 新APK构建/元数据/签名/安装                      | NOT_RUN | 此执行者未运行Gradle或ADB，主代理单独执行                                              |

新测试不挂载React、不执行系统VIEW派发或页面guard，member参数解析不证明成员授权通过。仅声明代码与导航库自动化、资源门禁结果；真机功能结论以对应记录及独立复核为准。
