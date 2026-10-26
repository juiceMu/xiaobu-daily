# 项目测试与验收约定

使用中文回复，保留用户已有改动。修改功能前阅读 [应用说明](./APP_MANUAL.md)、[测试流程](./docs/testing/README.md)、[用例库](./docs/testing/TEST_CASES.md) 和 [覆盖映射](./docs/testing/COVERAGE.md)。

- 新增功能、修改规则、修复缺陷时，同步维护稳定编号的测试用例、自动化覆盖映射和必要的应用说明；先记录基线，再验证改动。
- 按影响范围执行针对性测试，并运行 `npm test`、`npm run typecheck`、`npm run lint`、`npm run format:check`；涉及打包/平台依赖时追加相关 `export:*`。使用 Node 24，命令以 package.json 为准。
- 每次功能变更按 [模板](./docs/testing/ACCEPTANCE_TEMPLATE.md) 在 `docs/testing/runs/` 保存实际验收记录。记录命令、退出码、用例编号、平台、证据、基线失败与未执行项。
- 由独立 verifier/code-reviewer 复核用例、diff 和证据。只对实际执行且观察到结果的检查声明通过；源码结构断言不等于 UI E2E，存储替身不等于真机 SQLite，资源导出不等于安装启动成功。
- Web UI 自动化只能使用项目提供的 runtime，不使用外部 computer-use 或其他驱动替代；runtime 不可用时记录阻塞。同一次 runtime 遇到异常时，尽量继续探查其他可达用例。
- 测试使用独立存档或设备，不清空用户数据、不放松断言掩盖失败、不将邀请码/口令或完整业务存档写入报告。

## 安装包默认流程

每次用户要求打安装包/APK/发布测试包时，默认先执行以下检查，不需要用户重复提醒：

1. 阅读并核对项目技能 [Android 原生与打包技能](./.cursor/skills/android-native-crash-avoidance/SKILL.md) 与 `CHANGELOG.md`，对照上次包以来的实际变更，判断是否有新增规则、踩坑、流程或用户可见变更需要记录。有则及时更新；没有则在验收记录注明已检查、无需修改。不是每次强行改技能，也不默认升级外部技能或依赖。
2. 同步核对 `package.json`、锁文件根版本、`app.json`、Android `versionName/versionCode` 与更新日志；有新功能的包递增版本及构建号，不覆盖旧安装包。
3. 按测试规范运行并如实记录质量检查，区分既有失败、当前失败和未执行项。使用 `npm run build:apk` 进行版本/日志/技能预检与构建；脚本只能检查结构，不能代替第1步的内容审查。
4. 检查实际APK版本、包名、签名和摘要，保存验收记录并独立复核。明确测试签名与未实测边界；构建成功不等于已安装或真机功能通过。不擅自安装设备、上传商店或更换签名。
