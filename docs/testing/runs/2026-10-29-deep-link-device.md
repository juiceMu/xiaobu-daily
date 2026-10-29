# 验收记录：Android QA深链入口

## 基线

OPPO PJX110/Android16，唯一ADB设备7c034dd9，QA与正式均1.0.15/code16。仅主代理操作设备，正式应用只导航不写业务；QA开始本周12次/可用14张，门槛3、周日23:59到期。NAV-003协议隔离及冷/热启动子参数。

| 参数                                | 状态 | 实际观察                                                                                                         |
| ----------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------- |
| QA热启动 `sprout-qa://more/account` | FAIL | QA已保存设置页无草稿，am start VIEW指定QA包退出0，系统反馈投递当前Activity；连续两次dump仍设置页，没有进入账户。 |
| QA冷启动同URL                       | FAIL | force-stop QA再通过VIEW启动，连续两次dump仍今日打卡，没有进入账户。                                              |
| 正式 `sprout://more/account`        | PASS | 仅导航到正式账户页，dump实际显示账户资料、我的头像；未修改资料或业务。                                           |

实际设备命令退出0不代表导航成功。采证仅筛选标题，不保存身份编号/业务码或正式账户截图。源码App.tsx只配置Linking.createURL与sprout前缀，app.json仍为sprout，Android QA协议为sprout-qa。review_final独立读取当前expo-linking实现，确认createURL从Expo配置解析scheme、不读取Gradle占位；实际执行React Navigation官方extractPathFromURL，旧配置对QA地址返回null，添加QA前缀后返回more/account，正式地址均正常。源码与解析证据解释真机基线，但不代替新包回归。

正式1.0.15还通过VIEW逐项导航growth、gifts、group，实际标题分别成长记录、赠送与领取、小组；只导航不写用户业务。命令session91605已poll取得exit0。未单独证明各入口冷启动和返回总览。

## 修复及复测

修复为仅在`App.tsx`的React Navigation `prefixes`追加`sprout-qa://`；保留`Linking.createURL('/')`及正式`sprout://`。原生Manifest及Gradle协议注册未扩大。Node24自动化、版本、日志和独立复核见[自动化验收](./2026-10-29-deep-link-automation.md)。

QA新包`dist/小步日常-QA-1.0.16-20261029.apk` SHA-256 `45624e5ef7e3021bba9062abfbc75650dfadfbf4b4e0121333ccad3b21cc77ec`；aapt核验包名`com.smallsteps.checkin.qa`、1.0.16/code17、ARM64、min24/target36、名称小步日常测试；apksigner证书SHA-256 `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`（Android Debug测试签名）。Manifest实际scheme=`sprout-qa`、allowBackup=false，FileProvider authorities全在qa包名空间。`adb install -r`成功，设备dumpsys核对code17/version1.0.16。

| 用例参数                    | 状态 | 真机结果                                                                                                     |
| --------------------------- | ---- | ------------------------------------------------------------------------------------------------------------ |
| QA热启动账户/成长/赠券/小组 | PASS | 分别从更多总览发送VIEW深链，dump标题对应“账户资料/成长记录/赠送与领取/小组”；逐个Android返回键回到更多总览。 |
| QA冷启动账户/成长/赠券/小组 | PASS | 每个路径前`am force-stop` QA，再发同协议VIEW；四页面标题均正确，返回键均回更多总览。                         |

长序列adb session61575和93244实际poll取得终态exit0。页面标题及返回总览依据每个操作后新的uiautomator dump；launch的“delivered to running instance”只描述热投递，不能代替页面断言。测试只导航隔离QA，没有写QA或正式业务。正式1.0.15 baseline的账户、成长、赠券、小组也逐一通过sprout://打开；未逐项核对正式包的返回总览。新版常规1.0.16 APK已实际核验元数据/签名/Manifest，但没有安装，未宣称其新版原生端实测。

QA1.0.16升级后首页仍显示12次、0张可兑、14张可用，已保存门槛仍显示3；深链及安装升级没有写QA业务。crash buffer没有本次应用包异常；只出现10/29 04:22的系统`init` crash_dump helper失败记录，不归因应用崩溃。该轮当时未复测未知/相似协议及member越权/缺参，后续无组/缺参及系统协议解析子参数见追加节。仍未覆盖iOS/Web实际UI、项目浏览器runtime或真实成员页面授权。最终正式APK`dist/小步日常-1.0.16-20261029.apk` SHA-256 `4f5cc52b8fc7d53f06e68ce47a3263e319423ed390763bc1614fa4d1a9e0ce75`，包名com.smallsteps.checkin、code17、scheme sprout、allowBackup=true；没有覆盖安装或修改正式应用存档。

独立review_final复核源码diff及10/10路由回归通过；新增两APK实际原生协议/签名隔离核验已由主代理执行。reviewer实际重算两APK摘要并检查291/291日志及报告范围通过；指出正式包返回总览声明未逐项证实，已更正。真机热/冷页面行为由主代理操作和过滤dump实证，reviewer未操作ADB。1.0.16新增深链缺陷已修复并完成有限QA设备验收；双机同步及其余未测边界仍不能因此视为整体验收完成。

## 追加：未入组成员空态、非法路径与系统协议隔离

同一QA1.0.16/code17，实际设备解锁，无groupLink且只看自己；正式应用仍1.0.15，不写业务。NAV-003以下热启动子参数实际执行：

- `sprout-qa://more/member/qa-missing-member`打开成员记录，只显示“现在只看自己”和“在小组里选择看全组后，才能打开其他成员的记录。”，无任务/奖券/本机统计。Android返回回到更多总览。
- 在更多总览分别打开`sprout-qa://more/member`（缺accountId）和`sprout-qa://more/not-a-page`，每次新dump仍有总览设置入口，没有误开成员页。无白屏或业务写入。
- 实际系统`cmd package resolve-activity --brief`对“正式协议+指定QA包”“QA协议+指定正式包”“相似协议sprout-qa-other+指定QA包”均返回`No activity found`。这是系统路由解析结果，不等同逐项派发应用或模拟选择器操作。

有效命令退出0，结果按实际dump及系统解析返回判断，未保存身份编号或业务码。没有测试有组/全组模式下未知成员、已有合法副本、离组残留、其他真实身份权限或冷启动非法路径，不能把无组空态当完整VIEW权限通过。无产品代码变更或构建，不重复产品门禁；本轮未发现新缺陷。review_final独立只读复核范围与证据说明通过，未ADB或修改文件；按其建议标明前轮未测范围的时间，避免与追加结果冲突。文档Prettier及git diff --check退出0。
