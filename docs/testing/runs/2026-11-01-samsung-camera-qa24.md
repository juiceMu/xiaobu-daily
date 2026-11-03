# 验收记录：三星解锁后扫码生命周期补测

后续已构建并安装QA1.0.25，在双机各两轮中未再观察到回前台短暂重连，详见[主动暂停预览验收](./2026-11-01-camera-pause-1.0.25.md)。本文保留QA24基线，不改写旧观察。

## 变更与环境

- 2026-11-01，主代理执行；设备实际时间为 CST，未修改系统时钟。
- HEAD `95ce109eaa87d95101ce991b1514f44e49198aa8`，main；保留现有产品与测试文档改动，本轮只新增本记录，未修改产品。
- 三星 SM-G9730 / Android 12，隔离包 `com.smallsteps.checkin.qa`，实际查询为 1.0.24/code25。Node 实查 v24.22.1。
- 系统 policy 实查 `showing=false`、`inputRestricted=false`、屏幕 ON；QA 前台。只操作 QA，不清数据、不变更权限、不领取或制作券，不操作正式包。
- 关联 SCAN-003：已有授权、无权限请求期间 Home、返回前台、重新打开、显式关闭。不是全新安装或首次授权夹具。

## 实际执行

| 用例及参数                               | 状态 | 观察与证据                                                                                                                                                                                                                                                                   |
| ---------------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SCAN-003 / 三星 / 已授权打开             | PASS | 点击实际可见的打开相机扫码；XML 有扫描赠券及关闭扫码，系统 Active Camera Clients 含 QA、Camera ID 0。`/tmp/samsung-qa24-scanner-open.xml`、`/tmp/samsung-qa24-camera-open.txt`。                                                                                             |
| SCAN-003 / 三星 / 无请求 Home 后稳定释放 | PASS | Home 后完成一次 UI 读取，再查客户端为空，日志有 QA DISCONNECT。`/tmp/samsung-qa24-camera-home.txt`；重复样本 `/tmp/samsung-qa24-camera-home-repeat.txt`。不测毫秒级释放时延。                                                                                                |
| SCAN-003 / 三星 / 回前台稳定界面         | PASS | am start 带回原任务，界面为赠送与领取、打开相机扫码，无扫描弹窗；重复样本的稳定客户端为空。`/tmp/samsung-qa24-scanner-resume.xml`、`/tmp/samsung-qa24-scanner-resume-repeat.xml`、`/tmp/samsung-qa24-camera-resume-repeat.txt`。此项仅表示稳定状态，不表示过渡期间从未连接。 |
| SCAN-003 / 三星 / 手动重新打开           | PASS | 按重新读取的按钮坐标打开，XML 有关闭扫码，系统客户端重新包含 QA。`/tmp/samsung-qa24-scanner-reopen.xml`、`/tmp/samsung-qa24-camera-reopen.txt`。                                                                                                                             |
| SCAN-003 / 三星 / 显式关闭               | PASS | 点击当前关闭扫码，XML 回赠送页，系统客户端为空，日志有 DISCONNECT。`/tmp/samsung-qa24-scanner-closed.xml`、`/tmp/samsung-qa24-camera-closed.txt`。                                                                                                                           |

## 过渡期异常线索与未覆盖项

- 首轮回前台过程，系统事件日志出现 14:40:00 CONNECT、14:40:01 DISCONNECT；第二轮也出现 14:41:11 CONNECT、14:41:12 DISCONNECT。两次均发生在手动重新打开之前，不能声称回前台全程从未重连。日志时间只精确到秒，不据此推算准确持续时间。
- 已核对本地已安装 expo-camera 源码：`ExpoCameraView.kt` 的相机绑定使用 Activity 生命周期；业务 `GiftScanner.tsx` 通过 JS AppState 关闭并卸载。生命周期恢复与 JS 关闭的先后可能有关，但本轮没有原生/JS 联合时序证据，根因尚未证实。没有据稳定客户端为空抹去上述过渡期线索，也没有贸然修改依赖或产品。
- “回前台过渡期不得重连”不记 PASS，仍需带原生及 JS 时间戳的隔离诊断和回归；相机是否输出过图像、是否触发扫码回调本轮均未证明。
- 三类码实扫、坏码与重复帧、请求期间 Home/关闭、迟到权限结果、iOS/Web、OPPO 本轮同参数均 NOT_RUN，不以本次三星样本关闭整个 SCAN-003。
- 最后客户端为空，三星通过原生返回回到更多总览；`/tmp/samsung-qa24-camera-final.txt`、`/tmp/samsung-qa24-scan-final-more.xml`。未写入业务数据。

## 命令与质量检查

- ADB 查询版本、policy、am start、input、uiautomator dump/pull 及 camera 状态采集均退出 0。第一次全量 camera 输出过长，后续仅保存前 24–30 行，包含客户端及最近事件，不保存业务存档。
- `npm test`、typecheck、lint、全量 format:check、export、build 均 NOT_RUN：本轮没有产品变更；不将前轮结果冒充本轮重跑。
- 本记录格式与 diff 检查结果见本轮实际命令输出。

## 独立复核与结论

- 使用 omc-reference 遵循项目独立复核流程。独立代理 `verifier_qa24_evidence` 收到初始请求及一次补发后均反馈任务正文为空，未执行审核。不能把该回复作为页头或本轮测试的批准证据；未继续无效重发，独立复核仍待补。
- 未修改用例预期、覆盖层级或应用规则。结论为部分验证待补，非全功能通过；过渡期短暂重连单独保留待诊断。
