# QA 1.0.32 头像同步重试

- 设备：三星 SM-G9730 与 OPPO PJX110，隔离 QA 包 `com.smallsteps.checkin.qa` 1.0.32；关联 PROFILE-003、VIEW-002 的有限重试。
- 三星原头像为“小芽”。将本机已有合成夹具推送至三星下载目录的独立测试文件 `qa-profile003-retry-20261102.png`，通过系统选择器选取并保存；界面显示已选择相册图片和本机保存成功。测试文件仍保留在设备下载目录。
- 三星发起小组同步，OPPO 显示“同步连接空闲超时”；三星界面采集两次因未进入空闲而失败，未取得该次同步终态。之后停止并重启三星 QA，选择原“小芽”并保存，界面确认当前头像及保存成功。
- 恢复后再次从三星发起同步，三星显示“局域网同步完成”，OPPO 所见三星成员副本时间更新至 09:18。未核对 OPPO 上该成员头像的实际图像，不能证明图片是否传输、超时是否导致同步失败，或恢复是否传播到副本。
- 证据：`/tmp/R28M22J0K3D-qa32-avatar-retry-result.xml`、`/tmp/R28M22J0K3D-qa32-avatar-retry-chosen.xml`、`/tmp/R28M22J0K3D-qa32-avatar-retry-back.xml`、`/tmp/7c034dd9-qa32-avatar-retry-oppo-members.xml`、`/tmp/R28M22J0K3D-qa32-avatar-retry-restore-confirm.xml`、`/tmp/R28M22J0K3D-qa32-avatar-retry-restore-terminal2.xml`、`/tmp/7c034dd9-qa32-avatar-retry-restore-oppo.xml`。临时证据可能被系统清理；操作顺序依赖执行记录。
- 独立 verifier 只读核对选图、保存、超时和本机恢复的界面快照，确认上述证据边界；没有验证图片字节、接收端头像或同步事务。完整用例仍未验收。
- 本轮未修改产品代码，未运行全量自动化质量检查。
