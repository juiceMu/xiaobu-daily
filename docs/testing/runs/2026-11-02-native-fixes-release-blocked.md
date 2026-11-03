# 原生问题修复与发布阻塞记录

## 环境和基线

- 2026-11-02，Asia/Shanghai；`main`，HEAD `95ce109eaa87d95101ce991b1514f44e49198aa8`。工作区已有大量未提交改动及验收记录，均保留。本记录初版之后又增加了 Expo 生命周期候选补丁及账户提示修正，均未提交。
- 当前版本 1.0.32/code 33；Node 24.22.1、npm 10.8.2。QA32 三星选图启动失败和 TCP 监听崩溃的既有设备证据见 [QA32 记录](./2026-11-01-qa32-samsung-picker-lifecycle.md)，两者触发顺序均未证实。
- 修改前针对性基线：`tsx --test tests/accountProfile.test.ts tests/scannerPermission.test.ts tests/lanListener.test.ts tests/tcpNativePatch.test.mjs`，退出码 0，43 通过；TCP 补丁单独基线 `node --test tests/tcpNativePatch.test.mjs` 退出码 0，2 通过。

## 本轮检查

| 检查                                                     | 结果                               | 范围                                                                                                                                                                              |
| -------------------------------------------------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TCP 补丁测试 `node --test tests/tcpNativePatch.test.mjs` | 退出码 0，3 通过                   | 临时夹具、结构、幂等及漂移拒绝，不执行原生运行时                                                                                                                                  |
| `npm test`                                               | 退出码 0，323 通过、0 失败、0 跳过 | TCP 改动后、文档更新前运行；不等于设备验收                                                                                                                                        |
| `npm run typecheck`                                      | 退出码 0                           | TCP 改动后、文档更新前运行                                                                                                                                                        |
| `npm run lint`                                           | 退出码 1                           | 未改动的 `scripts/create-app-icon.cjs` 两处 `__dirname` 错误；`TodayScreen.tsx` 两处 Hook 警告                                                                                    |
| `npm run format:check`                                   | 退出码 1                           | 393 个文件不符合格式，包含 Android 构建缓存和已有源码/文档；没有清理或格式化用户文件                                                                                              |
| TCP 改动文件 ESLint 和 Prettier                          | 各退出码 0                         | 仅两个补丁与测试文件                                                                                                                                                              |
| Android TCP 原生 Java 编译                               | 退出码 0                           | `/tmp/xiaobu-isolated-qa.xH3Tmq` 内应用补丁后执行 `./gradlew :react-native-tcp-socket:compileReleaseJavaWithJavac --no-daemon -I init.aliyun.gradle`，JDK 17；不是 APK 或真机测试 |
| 正式 APK / 双机原生问题回归 / 导出                       | NOT_RUN                            | 原生候选及发布签名未就绪；未安装或覆盖原有正式或普通 QA 应用                                                                                                                      |

## 缺陷及独立复核

- LAN-015：候选补丁让服务端保留 final Socket 引用，并使同一 TcpSocketServer 实例的 close 串行；独立审查仅支持其针对已记录的空引用路径，不能证明运行时修复。脚本只拒绝补丁匹配上下文的漂移，不校验整个 Java 文件。原生模块按 ID 查找的迟到重复关闭、跨实例监听释放顺序不在本补丁覆盖范围。源码测试和编译均不能代替真机。
- PROFILE-007：Expo 选图启动器可能在 Activity 生命周期中失效，暖态的准确触发原因尚未知。现已在工作区加入候选补丁及构建/postinstall 钩子，并在临时构建副本编译成功；候选未做真机验证，涉及共享 Expo 模块，不能称为已修复。冷启动及普通 Home 成功不能覆盖既有失败。仅用于 OPPO 文案验证的独立 QA 包特意排除了该补丁及 TCP 候选，不代表它们得到验证。
- 独立复核者 `tcp_review` 只读审查 TCP 源码及补丁，确认上述边界；`picker_diagnose` 只读审查 Expo 生命周期和候选风险。尚无独立真机复核。

## 发布结论

部分验证，不能发布：相册和 TCP 候选未经过设备验证，全仓 lint/格式门禁失败。当前配置仅有 debug 测试签名，不能视为商店正式签名；没有生成或安装正式版 APK。已阅读 Android 原生打包技能与更新日志；后续账户提示和独立 QA 设备验证另行记录。
