# 验收记录：相机生命周期候选修复及赠券边界

## 环境与基线

- 2026-11-01，Asia/Shanghai；主代理执行，独立 verifier 复核。main，HEAD `95ce109eaa87d95101ce991b1514f44e49198aa8`，工作区包含既有未提交改动，未清除数据。
- OPPO PJX110 Android 16、三星 SM-G9730 Android 12；仅使用独立 QA 应用。关联 SCAN-001、SCAN-003、GIFT-009。
- QA1.0.28 两机冷进程首次扫码立即 Home 后返回均出现短暂相机连接，基线见 [记录](./2026-11-01-fast-camera-cold-ref.md)。本轮修改前 Node 24 `npm test` 退出 0，318/318。
- 检查 Android 打包技能与更新日志，已记录新原生候选方案；项目未升级依赖，测试签名保持不变。

## 相机候选及 QA29

- 经用户许可，固定 expo-camera 57.0.6 与源码摘要，在临时副本构建 Android 原生保护；未修改该依赖目录。构建日志实际显示编译临时副本；Gradle 正常结束后清理本次副本，异常终止可能遗留临时文件。
- QA1.0.29/code 30：`npm run build:apk -- --qa` 退出 0；APK 包名 `com.smallsteps.checkin.qa`，SHA-256 `5f0e1ca153fdabe3983c7f1c50bdd0a9f4cfd3abd02f11ee257452c33b396f3e`，证书为 Android Debug。两机 `adb install -r` 均 Success，不清档。
- 两机各执行 `node /tmp/xiaobu-fast-camera.cjs <设备> cold-zero 0,0 qa29`，均退出 0；各两轮返回期间及延迟采样无新增相机事件、无活跃 QA 客户端。命令间额外等待为 0ms，不代表物理零延迟。证据 `/tmp/{设备}-qa29-fast-camera-cold-zero-*`。
- 两机各执行 `node /tmp/xiaobu-camera-regression-qa29.cjs <设备>`，均退出 0；显式关闭、系统返回、离页三条路径均实际连接后释放相机，返回未自动重开。证据 `/tmp/{设备}-qa29-camera-regression-*`。
- 独立 verifier 核对上述 JSON 和界面证据一致。首次非 RESUMED 挂载时原生恢复事件能否可靠送达 JS、相机授权弹窗、三类二维码实扫、iOS/Web 均未验证；不能宣布全功能通过。

## 赠券边界

- 两组记录采用五主题既有 field 底色及 border 边线，保留原按钮与业务逻辑。修改前定向测试 13/13，修改后 14/14（执行者记录）；独立 verifier 运行 `tsx --test tests/uiTheme.test.ts` 退出 0，8/8。颜色数学及源码断言不是设备视觉验收。
- 五主题真实渲染、窄屏、大字号、长名称与两组按钮操作尚待验证；项目未提供 Web UI 自动化 runtime，不能以其他驱动代替。

## 检查与结论

- QA29 最终相机源码 `npm test` 退出 0，321/321；`npm run typecheck` 退出 0。`npm run lint` 退出 1，已有 `scripts/create-app-icon.cjs` 两处 `__dirname` 错误及两处 warning；`npm run format:check` 退出 1，392 文件告警，包括生成文件及本轮文件。
- QA29 相机有限样本通过，不覆盖所有生命周期和扫码。
- QA30 `npm test` 退出 0，322/322；`npm run typecheck` 退出 0；`npm run lint` 退出 1，仍为上述两处错误和两处警告；`npm run format:check` 退出 1，392 文件告警，日志 `/tmp/xiaobu-qa30-format.log`。
- QA30 `npm run build:apk -- --qa` 退出 0；实际包名 `com.smallsteps.checkin.qa`、版本 1.0.30/code 31、Android Debug 签名，SHA-256 `bd63d9ce09a2d83ffd1e0c82ff6ca576a50244dfc836a6ef06f1fa8b88132320`。两机覆盖安装均 Success，包管理器均确认版本，未清档。
- OPPO 当前主题实机截图 `/tmp/7c034dd9-qa30-gifts-records.png` 可见两组记录和长名称；用户认为浅色背景与主题不协调，视觉方案不验收，需重新调整。其他主题未逐一实测。
- 根据反馈移除额外填色，使用主题细边框，保留面板背景。独立 verifier 复核源码及五主题颜色计算，`tsx --test tests/uiTheme.test.ts` 退出 0、8/8；颜色计算不是视觉验收。
- QA31 `npm test` 退出 0、322/322；`npm run typecheck` 退出 0；`npm run lint` 退出 1，仍为上述两处错误和两处警告。首次 `format:check` 与构建并发时因生成文件消失退出 2，日志 `/tmp/xiaobu-qa31-format.log`，不能当作有效的完整格式检查。
- QA31 `npm run build:apk -- --qa` 退出 0，实际包名 `com.smallsteps.checkin.qa`、版本 1.0.31/code 32、Android Debug 签名，SHA-256 `57d11bad70c461ed9a056805113b34fcf0de86e6c280c57028b8f76e52184f5c`。两机覆盖安装均 Success，包管理器均确认版本，未清档。
- OPPO 当前主题截图 `/tmp/7c034dd9-qa31-gifts-records.png`：发出记录细边框可见，长名称换行，按钮未遮挡；收到记录部分可见。其余四主题、三星及大字号实际视觉仍未逐一验证。QA29 相机测试结果不能自动视作 QA31 重新执行。
- 用户在五种效果图中选择「轻线分隔」后，记录由完整边框改为仅行间主题分隔线，不加填色。修改前主题定向测试 `tsx --test tests/uiTheme.test.ts` 退出 0、8/8；修改后结果待补。
- 最终轻线方案在本机发出/收到列表项之间使用主题 border 色 1dp 下分隔线，首末端不画边框、不添加底色；每项垂直留白 8dp。`tsx --test tests/uiTheme.test.ts` 退出 0、8/8；`npm test` 退出 0、322/322；`npm run typecheck` 退出 0；`git diff --check` 退出 0。
- 最终样式变更尚未构建/安装新包，QA31设备截图是旧的完整边框版本，不作为轻线方案视觉证据。五主题设备视觉、窄屏/大字号仍 `NOT_RUN`；项目 Web UI runtime 未配置，不用外部驱动替代。
- 独立 verifier 复核 `GiftsScreen`、主题断言及 diff：未发现数据、排序、操作行为回归；建议的垂直留白已加入。复核不覆盖实际多主题设备渲染。
- 当前 `npm run lint` 退出 1：`scripts/create-app-icon.cjs` 两处 `__dirname` 错误及 `TodayScreen.tsx` 两条 hook warning。`npm run format:check` 退出 1、393 个文件告警（含生成物与既有源码告警）。不把全仓失败归因于本次改动，也未格式化全仓。
