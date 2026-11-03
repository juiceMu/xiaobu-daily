# 验收记录：QA32 OPPO 冷启动相机与三星权限重试

## 环境和范围

- 2026-11-01，Asia/Shanghai；OPPO PJX110 Android 16、Samsung SM-G9730 Android 12，独立 QA 应用 1.0.32/code 33；未清数据、未保存相机画面或完整业务码。
- SCAN-003：OPPO 解锁后强停 QA，冷启动进入赠券页，点击扫码后分别额外等待 0、100、500 毫秒按 Home，再返回；另重复两次 0 毫秒。0 毫秒是无额外等待，不代表物理零延迟。
- SCAN-001：三星原 QA 相机权限为使用时允许；系统设置临时改为每次询问，在应用里实际请求、普通拒绝、重试、系统允许并显式启动，结束恢复为使用时允许。

## OPPO 冷启动样本

| 命令                                                                            | 退出码 | 实际结果                                                                         |
| ------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------------------- |
| `node /tmp/xiaobu-fast-camera.cjs 7c034dd9 cold 0,100,500 qa32`                 | 0      | 三轮 PASS，结果 `/tmp/7c034dd9-qa32-fast-camera-cold-results.json`。             |
| `node /tmp/xiaobu-fast-camera.cjs 7c034dd9 cold-repeat 0,0 qa32`                | 0      | 两轮 PASS，结果 `/tmp/7c034dd9-qa32-fast-camera-cold-repeat-results.json`。      |
| `node /tmp/xiaobu-fast-camera.cjs 7c034dd9 cold-verify-2217 0,100,500,0,0 qa32` | 0      | 五轮 PASS，结果 `/tmp/7c034dd9-qa32-fast-camera-cold-verify-2217-results.json`。 |

复测五轮返回及延迟采样的事件数组与后台相同，客户端均为空，返回赠券页且没有扫码层。500ms 轮在后台前实际出现 QA 连接/断开；另四轮的基线与后台事件数组一致。系统事件缓冲区长度不变时，脚本以数组长度差计算的新增数量不可靠，故这里通过数组内容核对，不使用该计数判断是否开镜。独立复核首批文件时曾读到不同内容，之后同名文件又显示另一状态，无法确认原因；首批保留但不作为最终结论，使用唯一前缀重新执行。各轮客户端/事件 JSON 与返回界面 XML 以结果文件的 evidencePrefix 定位。三星同参数及独立复核见 [三星冷启动验收](./2026-11-01-qa32-samsung-cold-camera.md)。

## 三星拒绝后再次允许

1. 系统应用权限设置选“每次使用时询问”，进入扫码后点击允许使用相机；系统弹窗选择普通“不允许”。扫码页保留并显示可重试或在系统设置中允许的错误；包管理器显示 `granted=false`、`USER_SET`，没有 `USER_FIXED`。证据 `/tmp/R28M22J0K3D-qa32-auth-denied.xml`。
2. 点击应用内“允许使用相机”后再次出现系统授权框，选“仅在使用该应用时允许”；扫码页保持并显示“已允许使用相机，点击「开始扫码」继续”。证据 `/tmp/R28M22J0K3D-qa32-auth-retry-dialog.xml`、`/tmp/R28M22J0K3D-qa32-auth-granted-wait.xml`。
3. 允许后未点击开始前，实际 `dumpsys media.camera` 客户端段为 `[]`；点击开始后实际出现 QA 包 Camera ID 0；点击关闭后客户端段再次为 `[]`。包管理器显示用户 0 的 CAMERA `granted=true`，与原权限一致。三次系统输出为执行者当场观察，未保存原始 dumpsys，不能由 XML 独立证明客户端变化。

4. 再次设为每次询问，在系统权限弹窗按 Home 并返回，扫码页保留并显示未获得权限提示；重试再次弹框，允许后显示须手动开始，随后关闭扫码。证据 `/tmp/R28M22J0K3D-qa32-auth-home-dialog.xml`、`/tmp/R28M22J0K3D-qa32-auth-home-return.xml`、`/tmp/R28M22J0K3D-qa32-auth-home-retry-dialog.xml`、`/tmp/R28M22J0K3D-qa32-auth-home-granted.xml`。最终 QA 权限恢复允许，完整客户端段 `[]` 为当场观察，未保存原始 dumpsys。

## 未覆盖与复核

- 权限请求期间关闭、三类二维码实扫、坏码/重复帧、iOS 以及更广泛时序未由本轮覆盖；不以开镜或冷启动样本证明相机解码。
- 无产品源码改动，本轮未执行全量 npm 测试、类型检查、lint、格式全仓检查或构建；独立 verifier 只读核对唯一前缀复测的完整事件数组、客户端和界面，以及权限弹窗 Home 的四份界面证据，结果与本记录一致。静态 XML 不证明 Home 按键或当场客户端状态；本报告已区分执行者观察。复核后执行 Node24 定向 Prettier 格式化及检查通过。
- 结论：OPPO 五个冷启动时序样本和三星普通拒绝后重试授权的上述有限步骤通过，不代表完整 SCAN 用例或所有功能已验收。
