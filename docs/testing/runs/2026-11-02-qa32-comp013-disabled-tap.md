# 真机补测：已确认同行券的禁用入口

- 日期：2026-11-02；三星 SM-G9730 与 OPPO PJX110，隔离 QA 包 1.0.32；关联 COMP-013，仅为界面样本。
- 三星使用既有里程碑主券向 OPPO 同行券发送邀请；OPPO 收到后，三星执行 `adb shell am force-stop com.smallsteps.checkin.qa`，退出码 0。OPPO 确认同行，显示“已确认同行 · 结果待同步核对”。
- OPPO 滚动到同行券，可见“找伙伴一起用”入口禁用；在其有效矩形内执行 `adb shell input tap 860 1280`，退出码 0，点击前后界面树逐字节相同，没有出现另配对话框。证据：`/tmp/7c034dd9-comp-oppo-accepted2.xml`、`/tmp/7c034dd9-comp-oppo-locked-before.xml`、`/tmp/7c034dd9-comp-oppo-locked-after.xml`。
- OPPO 请求并确认取消；三星以 `adb shell monkey -p com.smallsteps.checkin.qa 1` 重启，退出码 0。尝试采集并点击同步时工具报 `could not get idle state`，该次点击没有执行；随后 OPPO 同行券入口显示启用，三星主券使用入口显示启用。证据：`/tmp/7c034dd9-comp-oppo-final2.xml`、`/tmp/R28M22J0K3D-comp-samsung-final-list.xml`。OPPO 最终入口大部分在屏幕裁切范围外，只能确认节点启用。
- 独立 verifier 只读确认占用状态、禁用节点、点击前后界面树相同和最终节点启用；静态证据不能证明点击命中、操作顺序、精确券 ID 或底层无写入。
- 未尝试底层直接单用或另配、离组、先离组再同步及数据库状态；不能判定整个 COMP-013 通过。没有清档或修改产品代码；未运行全量测试、类型检查、lint 或构建。临时证据可能被清理。
