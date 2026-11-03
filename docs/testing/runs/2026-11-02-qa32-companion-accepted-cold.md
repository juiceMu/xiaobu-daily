# QA 1.0.32 同行券确认后冷启动

- 用例：COMP-009，部分路径；Android 真机 OPPO 和三星，隔离 QA 包 `com.smallsteps.checkin.qa`。
- 操作：三星发起邀请后停止 QA 进程；OPPO 确认同行，再停止并重启 OPPO QA 进程，重新进入我的奖券。随后 OPPO 请求取消，重新启动三星并在 OPPO 同步。
- 观察：OPPO 重启前后均显示“已确认同行 · 结果待同步核对”，同行券按钮不可用。取消请求后显示“已请求取消 · 结果待同步核对”。同步结束后 OPPO 同行券按钮恢复可用。
- 三星重新连接后，主券使用按钮在重启 QA 应用后恢复可用，但列表仍显示“已请求取消 · 结果待同步核对”。因此双方界面状态完全一致及取消清理不计通过；尚需继续观察和核查。
- 后续补测：双方保持应用前台，在三星小组页点击同步；两次界面抓取因 `could not get idle state` 失败，第三次显示“局域网同步完成”。回到三星奖券列表后，原待核对提示消失，主券使用按钮仍启用；OPPO 此前的同行券按钮已启用。证据：`/tmp/R28M22J0K3D-qa32-cancel-followup.xml`、`/tmp/R28M22J0K3D-qa32-followup-group-view.xml`、`/tmp/R28M22J0K3D-qa32-followup-sync-result3.xml`、`/tmp/R28M22J0K3D-qa32-followup-final.xml`。这支持同步后界面刷新，不证明数据库或协议事务完成。
- 独立 verifier 核对了后续同步前后的三星及此前 OPPO 快照，指出不能证明精确券 ID、实际使用成功和事务完成。之后再次抓取 OPPO：`/tmp/7c034dd9-qa32-followup-oppo-final.xml` 显示同行券按钮启用且无待核对提示；该后续快照未由 verifier 复核。
- 后续操作入口补测：三星点击同名主券的使用按钮，打开“使用这张奖券？”确认框；OPPO 点击同行券，打开“找伙伴一起用”，其中列出同名主券作为候选。两端均点击取消退出，未确认使用或发送新邀请。证据：`/tmp/R28M22J0K3D-qa32-cancel-main-dialog.xml`、`/tmp/7c034dd9-qa32-cancel-companion-dialog.xml`。这仅证明操作入口和候选显示，不能证明实际再次消费成功或底层券 ID。
- 独立 verifier 只读核对上述两个弹窗及先前入口快照，认可入口可打开的有限结论；取消顺序、未提交和未写入不能仅由弹窗快照证明，须依赖执行者记录。
- 证据：临时目录 `/tmp/7c034dd9-qa32-accepted-cold-before2.xml`、`/tmp/7c034dd9-qa32-accepted-cold-after.xml`、`/tmp/7c034dd9-qa32-accepted-cold-cancel-pending2.xml`、`/tmp/7c034dd9-qa32-reconnected-oppo.xml`、`/tmp/R28M22J0K3D-qa32-accepted-cold-sender.xml`、`/tmp/R28M22J0K3D-qa32-reconnected-cold-result.xml`。临时文件可能被系统清理。
- 边界：这是界面证据，未直接验证 SQLite 中券 ID、事务提交阶段或协议状态；不能推断完整 COMP-009 通过。未测试 iOS、真实扫码和其他未覆盖路径。
- 操作命令：`adb shell am force-stop com.smallsteps.checkin.qa` 和 `adb shell monkey -p com.smallsteps.checkin.qa 1` 用于重启测试包，三星本轮命令退出码均为 0；使用项目测试辅助脚本采集界面。未清空数据或操作正式包。
- 独立 verifier 已只读核对上述关键 XML：支持 OPPO 状态和按钮的界面观察及三星残留提示；快照本身不能证明重启顺序、券 ID、数据库状态或协议完成。
- 本记录仅记录真机测试，未进行功能变更；未运行完整测试、类型检查、lint、打包。记录的 Prettier 检查退出码为 0。
