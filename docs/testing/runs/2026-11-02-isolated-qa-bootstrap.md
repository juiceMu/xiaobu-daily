# 独立测试包与新建小组真机记录

- 日期：2026-11-02。用户授权构建并安装独立测试包；保留两机正式包和原 QA 包，不导入真实数据。
- 构建源：当前工作区的临时独立副本 `/tmp/xiaobu-isolated-qa.xH3Tmq`，不是原 QA32 APK 的字节等同构建。副本仅调整包名、显示名、深链和可调试标志；测试包不用于发布。
- 包名 `com.smallsteps.checkin.isolatedqa`，版本 1.0.32/code 33，SHA-256 `7ecc585e8c8a753919897d26684b6ad255133da54ed6420f1f4b306dc6432c3d`。APK v2 签名验证通过，Android Debug 证书 SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`。清单显示禁备份、可调试，深链及六个 provider 使用独立标识，内置 JS bundle。
- Node 24 预检退出 0。构建期间先因复制遗漏依赖 `dist`、再因 JDK 25 的原生工具警告、调试变体链接及调试标志 lint 失败；补全副本依赖、使用本机 JDK 17、保留 release 原生配置并仅在副本定向豁免 `HardcodedDebugMode` 后，`npm run build:apk -- --qa` 退出 0。该豁免增加调试访问风险，仅允许隔离数据。
- 安装前独立 verifier 检查 APK 清单、摘要、签名、bundle 和两机旧包 provider；确认目标包当时不存在，未声称运行时隔离或网络隔离已验证。
- 三星 `R28M22J0K3D` 安装命令退出 0。OPPO `7c034dd9` 首次安装返回 `-99`，解锁后重试，按系统提示深度扫描并继续安装，系统界面显示安装完成；两机包列表均显示正式、原 QA 和独立包共存。未清除任何包或存档。
- 两机首次启动独立包均显示零打卡、零可兑换、零奖券及初始任务；界面证据分别为 `/tmp/R28M22J0K3D-isolated-samsung-launch.xml` 和 `/tmp/7c034dd9-isolated-oppo-launch.xml`。两机 `run-as` 分别看到独立包的 `files/SQLite/sprout-native-sync-v1.db`。未提取或比较正式、原 QA 业务存档，也未验证身份值或初始事务。
- GROUP-001 有限样本：三星首次进入小组显示创建/加入界面；创建隔离组 `ISOQA` 后显示本机成员、无其他成员记录；强制停止独立包并冷启动后仍显示该组及本机成员。证据：`/tmp/R28M22J0K3D-isolated-samsung-group-f0.xml`、`/tmp/R28M22J0K3D-isolated-group-created.xml`、`/tmp/R28M22J0K3D-isolated-samsung-group-cold.xml`。临时界面证据含测试邀请码，不纳入报告且可能被系统清理。
- 未执行：双机加入、同步、离组、底层组 ID/secret 与事务核对，损坏数据库及提交中断；不将上述样本视为 STORE-002 或 GROUP-001 整例通过。未运行全量测试、类型检查、lint、全量格式检查或导出；构建内 Android lint 不代替这些检查。
- 独立复核确认上述三个小组界面文件支持有限 UI 结论，APK 摘要和配置与记录一致；点击顺序、冷启动命令、安装退出码、SQLite 路径和未清档依赖执行者当时的命令记录及观察，不能由静态截图独立证明。
