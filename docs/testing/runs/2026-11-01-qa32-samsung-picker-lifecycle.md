# 验收记录：QA32 三星头像选图器异常

## 环境与前置

- 2026-11-01，Asia/Shanghai；Samsung SM-G9730 / Android 12，QA 1.0.32/code 33，字体 1.3。关联 PROFILE-002、INPUT-002。没有清档、选取照片、保存账户资料或改正式包。
- 本轮开始前同一 QA 进程曾经历系统相机权限“每次询问”、弹窗 Home、返回、授权及关闭扫码，随后做过账户页字体草稿测试；具体触发条件尚不确定，不能仅凭先后判断因果。

## 真机结果

| 参数                                 | 状态             | 实际观察与证据                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------ | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 暖态账户页、预设头像草稿后点相册     | FAIL             | 选另一预设作为未保存草稿，连续两次点击“从相册选择”，未观察到系统选图器，账户页出现 `ExponentImagePicker.launchImageLibraryAsync` 被拒绝及 `IllegalStateException`，指向未注册的 `ActivityResultLauncher`。滚动后可见错误，证据 `/tmp/R28M22J0K3D-qa32-samsung-picker-error.xml`；草稿之前/之后分别 `/tmp/R28M22J0K3D-qa32-samsung-picker-before.xml`、`/tmp/R28M22J0K3D-qa32-samsung-picker-draft.xml`。不将具体原因归结为权限流程或头像草稿。 |
| 放弃头像草稿                         | PASS（有限样本） | 返回后出现放弃提示，选择放弃，再进入账户页恢复原预设头像；证据 `/tmp/R28M22J0K3D-qa32-samsung-picker-discard-dialog.xml`、`/tmp/R28M22J0K3D-qa32-samsung-picker-reopened.xml`。没有保存业务数据。                                                                                                                                                                                                                                              |
| QA 冷启动后打开选图器、返回取消      | PASS（对照样本） | 强停 QA 后冷启动、进入账户页并点击相册，`dumpsys activity activities` 的 resumed Activity 为 Android DocumentsUI `PickActivity`，实际界面树 `/tmp/R28M22J0K3D-qa32-samsung-picker-cold-current.xml`；系统返回后原预设头像保留，见 `qa32-samsung-picker-cold-cancel.xml`。未选择照片。                                                                                                                                                          |
| 普通 Home 返回后打开选图器、返回取消 | PASS（对照样本） | 账户页 Home、回前台后点击相册，实际 resumed Activity 同为 DocumentsUI `PickActivity`；系统返回后原预设头像保留，见 `/tmp/R28M22J0K3D-qa32-samsung-picker-home-cancel.xml`。系统 Activity 输出未保存原始日志，作为执行者观察。                                                                                                                                                                                                                  |

## 结论与限制

- 暖态两次出现可见启动器未注册错误，属于真实失败；冷启动和一次普通 Home 对照成功不能抹去失败。异常触发条件、其他设备与权限生命周期交互尚未定位，不宣称修复或整例通过。
- 独立 verifier 确认错误文本、选择草稿前后、放弃提示、重新进入的原头像以及冷启动系统选图界面；两次点击过程及冷启动时 resumed Activity 精确类名来自执行者当场观察，未留原始系统 Activity 输出。错误界面未显示头像，不能单凭该界面证明错误后草稿保留。
- 无产品代码变更，未重新构建或运行全量门禁；UI XML 保存在临时目录，可能包含 QA 身份信息，不复制业务码或完整存档至本记录。

## 追加：配置切换后的独立崩溃

- 在账户页临时将三星系统字体比例从 1.3 切为 1.5 并恢复 1.3 后，界面处于系统桌面。执行者随即读取 `adb -s R28M22J0K3D logcat -b crash -d -t 160`，见 2026-11-01 22:33:09 QA 进程 `FATAL EXCEPTION: pool-11-thread-1`，`java.lang.NullPointerException`，堆栈为 `com.asterinet.react.tcpsocket.TcpSocketServer$TcpListenTask.run(TcpSocketServer.java:121)`，空引用来自 `java.net.ServerSocket.isClosed()`。
- 这是本轮观察到的实际 QA 进程崩溃，属于 LAN 原生监听相关待定位异常，不能认定字体切换是唯一触发条件或与选图错误有因果关系；没有复现竞态，也没有修复。原始 logcat 本轮未另存文件，此段为当场观察摘录；独立 verifier 只读系统崩溃缓冲区，确认进程、时间、异常及堆栈与本记录一致。后续诊断仍需保留原始证据。

## 追加：OPPO 选图取消对照

- OPPO PJX110 / Android 16，QA 1.0.32，当前进程进入账户页后点击“从相册选择”，执行者观察 resumed Activity 为系统照片选择器；界面树 `/tmp/7c034dd9-qa32-oppo-picker-system.xml` 显示系统选图页及取消入口。没有读取或选择照片。
- 点击取消返回账户页，前后界面树 `/tmp/7c034dd9-qa32-oppo-picker-before.xml`、`/tmp/7c034dd9-qa32-oppo-picker-after.xml` 显示相同原预设头像。该单次正常样本不证明 OPPO 所有生命周期均无三星所见异常；具体 Activity 状态输出未单独留存。
