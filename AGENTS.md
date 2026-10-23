# 项目测试与验收约定

使用中文回复，保留用户已有改动。修改功能前阅读 [应用说明](./APP_MANUAL.md)、[测试流程](./docs/testing/README.md)、[用例库](./docs/testing/TEST_CASES.md) 和 [覆盖映射](./docs/testing/COVERAGE.md)。

- 新增功能、修改规则、修复缺陷时，同步维护稳定编号的测试用例、自动化覆盖映射和必要的应用说明；先记录基线，再验证改动。
- 按影响范围执行针对性测试，并运行 `npm test`、`npm run typecheck`、`npm run lint`、`npm run format:check`；涉及打包/平台依赖时追加相关 `export:*`。使用 Node 24，命令以 package.json 为准。
- 每次功能变更按 [模板](./docs/testing/ACCEPTANCE_TEMPLATE.md) 在 `docs/testing/runs/` 保存实际验收记录。记录命令、退出码、用例编号、平台、证据、基线失败与未执行项。
- 由独立 verifier/code-reviewer 复核用例、diff 和证据。只对实际执行且观察到结果的检查声明通过；源码结构断言不等于 UI E2E，存储替身不等于真机 SQLite，资源导出不等于安装启动成功。
- Web UI 自动化只能使用项目提供的 runtime，不使用外部 computer-use 或其他驱动替代；runtime 不可用时记录阻塞。同一次 runtime 遇到异常时，尽量继续探查其他可达用例。
- 测试使用独立存档或设备，不清空用户数据、不放松断言掩盖失败、不将邀请码/口令或完整业务存档写入报告。
