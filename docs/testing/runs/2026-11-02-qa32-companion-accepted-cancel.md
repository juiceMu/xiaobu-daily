# QA 1.0.32 同行确认后请求取消：双机验收

- 日期：2026-11-02；Android QA 包 `com.smallsteps.checkin.qa`，1.0.32（33）。
- 设备：OPPO（同行券方）、三星（主券方）；使用既有 QA 测试数据，未清除数据。
- 关联用例：COMP-008、COMP-009、COMP-013 的确认后取消及同步路径；本次仅覆盖下述实际观察，不代表用例全部通过。

## 实际观察

1. 三星以测试主券发出同行邀请，OPPO 显示邀请；强制停止三星 QA 后，OPPO 确认同行，显示“已确认同行 · 结果待同步核对”。证据：`/tmp/7c034dd9-qa32-accepted-state2.xml`。
2. OPPO 请求取消后显示“已请求取消 · 结果待同步核对”，同屏对应同行券的“找伙伴一起使用”按钮为 `enabled=false`。界面提示需与主券方同步核对后才能解除占用。证据：`/tmp/7c034dd9-qa32-accepted-cancelled-state.xml`。
3. 重新启动三星 QA，OPPO 点击同步。三星页面显示测试主券的使用按钮 `enabled=true`，但 OPPO 仍显示请求取消待核对、同行券按钮不可用。证据：`/tmp/R28M22J0K3D-qa32-accepted-samsung-final2.xml`、`/tmp/7c034dd9-qa32-accepted-final3.xml`。
4. OPPO 再次点击同步。执行过程中 UI 自动化采集多次返回 `could not get idle state`；此前地址查找超时提示见 `/tmp/7c034dd9-qa32-accepted-cancelled-state.xml`。随后 OPPO 的待核对提示消失，同行券的按钮显示 `enabled=true`，见 `/tmp/7c034dd9-qa32-accepted-final5.xml`。三星主券此前也显示可使用；这是界面恢复的证据，不单独证明数据库或协议内部状态。

## 执行边界

- 三星 QA 强制停止及通过 `adb shell monkey -p com.smallsteps.checkin.qa 1` 重启均执行成功；同步按钮点击成功。点击已消失的超时提示按钮时，脚本因目标数为 0 退出，未执行点击。
- UI XML 只证明对应采集时刻的界面状态，不证明服务端或 SQLite 的内部状态，也不证明同名券的唯一身份。
- 未进行二维码实扫、故障注入、iOS 验收；未运行全量测试、类型检查、lint 或格式全量检查。本记录不是产品功能变更。
- 独立复核确认中间状态及最终恢复界面证据与记录一致；强停、重启、点击次数及采集错误属于执行过程观察，不能仅凭 XML 独立证明。临时证据在 `/tmp`，可能随系统清理消失。
