# 真机补测：未确认同行邀请超时与 OPPO 复制入口

## 环境、基线和范围

- 2026-11-01，主代理执行；main，HEAD `95ce109eaa87d95101ce991b1514f44e49198aa8`，保留工作区全部既有修改。本轮不改产品代码、不构建安装。
- 隔离 QA 包 `com.smallsteps.checkin.qa` 1.0.25/code26。OPPO PJX110/Android16/480dpi/字体1.0，本人QA；三星SM-G9730/Android12/420dpi/字体1.3，本人QAS。设备时区Asia/Shanghai，未改系统时钟、未清数据、未操作正式包。
- 用例 COMP-011 仅覆盖主券方发起、同行方一直未确认的真实15分钟超时；不覆盖 accepted/committed、两券先到期、毫秒临界或晚到提交决定。COPY-001 仅记录下列实际完成参数，不关闭整例。
- 起始本人QA为78可用/11已用、QAS为3可用/10已用，全组81/23。使用既有永久主券「QAG · 2可里程碑奖券」和既有同行券，不为测试新增打卡或兑换。

## 同行邀请过程

- 三星从主券使用入口进入邀请同行；实际出现3个同名同行券候选，选第一项，未读取内部ticketId，不声称逐ID匹配。用途 `QADeadlineUnconfirmed` 在继续填写后验证精确21字符。发起前返回键出现放弃提示，选择继续填写后草稿保留。
- `/tmp/xiaobu-start-deadline.cjs` 发送前验证完整用途，实际退出0。`/tmp/qa25-comp-deadline-start.json` 的发起前后三星秒值均为1793524245（17:10:45）；UI显示确认截止17:25。没有点击OPPO确认同行，也没有提交最终确认。
- 发送端同步反馈为查找超时，不能写为完整同步成功；OPPO实际收到邀请。双端初始证据 `/tmp/{device}-comp-deadline-{sender,recipient}-started.xml`，真实文件分别为三星sender和OPPOrecipient。两端在后续 `comp-wait-*-current.xml` 仍显示该用途、截止和等待状态。
- 初版计时辅助因 `dumpsys window windows` 未返回当前焦点而退出1，并非邀请停止或锁屏事实。实查完整 `dumpsys window` 显示QA前台、两端showing=false后修正临时脚本，沿用原邀请及起始时间；不重发邀请。计时记录在 `/tmp/qa25-comp-deadline-wait.json`。仅定时轻点三星已核对的非交互标题位置保持前台，不点击确认或取消，不改系统设置。
- 真实计时驱动恢复后退出0，最后记录elapsed=931秒。截止后先观察、再同步：OPPO在elapsed=959秒无「确认同行」，明确显示「邀请待核对；已到期或奖券状态变化时不能确认，请同步最新结果。」，全组81/23；三星elapsed=962秒仍为等待状态、有取消邀请、本人3/10。观察驱动 `/tmp/xiaobu-deadline-observe.cjs` 两机各退出0，证据 `/tmp/{device}-deadline-expired-before-sync.{json,xml}`。这证明本次晚于截止后的UI拒绝新确认，不证明恰毫秒截止或预先打开确认框的路径。
- 随后仅三星点击一次同步同行结果，没有点击取消或重新发邀请。首次同步中UI采集出现 `could not get idle state`，工具退出1；未因此重发同步。下一次三星树已无邀请、本人仍3/10，但三个使用按钮暂时disabled，不能将忙碌中状态写为已解除全部占用。后续终态及冷启动结果单独追加。

## 超时同步终态与冷启动

| 有限参数                                | 状态 | 实际结果与证据                                                                                                                                                                                                                  |
| --------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| COMP-011 / 未确认主券超时后同步解除占用 | PASS | 三星 `comp-deadline-samsung-sync-terminal.xml` 无本次邀请，「使用奖券，QAG · 2可里程碑奖券」enabled=true，3/10未变。没有主动取消或消费。                                                                                        |
| COMP-011 / 接收端最终移除过期邀请       | PASS | OPPO `comp-deadline-oppo-passive-read3.xml` 无邀请区/该用途，全组81/23、QA78张未变，可见本人使用按钮恢复。没有核对所选同名同行券内部ID或该张券按钮，不将其扩大为逐ID解锁证明。                                                  |
| STORE-001 / OPPO冷启动                  | PASS | `node /tmp/xiaobu-member-sync-cold.cjs 7c034dd9 deadline-cold` 实际退出0；`/tmp/7c034dd9-deadline-cold-proof.json` coldLaunch=true，全组81/23，QA78/11、QAS3/10，他人无使用入口，本人可见4按钮enabled，无本次用途；最终更多页。 |
| STORE-001 / 三星冷启动                  | PASS | 同脚本三星参数实际退出0；`/tmp/R28M22J0K3D-deadline-cold-proof.json` coldLaunch=true，全组81/23，QAS3/10、QA78/11，本人3按钮enabled，他人无使用入口，无本次用途；最终更多页。                                                   |

两机冷启动原始树与启动信息均以 `/tmp/{device}-deadline-cold-` 为前缀。只强停隔离QA并从 `sprout-qa://tickets` 冷启动，没有提取/修改SQLite，不证明底层outbox和全档逐字节不变。

同步后OPPO短暂仍显示旧过期邀请。尝试精确点击「同步同行结果」时因disabled找不到可操作目标，驱动退出1，未实际触发第二次同步；后读确认当时OPPO正忙碌。再观察时邀请已消失，三星仍3/10且主券按钮enabled。不得将此记录成两次同步成功，也不以短暂旧副本状态判定已扣券或永久残留。最终没有取得整次网络扫描成功反馈，不声称所有地址已检查完成；上述PASS只基于实际可见的业务收敛结果。

## OPPO 复制入口

通过实际入口点击复制，在赠送页原本空白的粘贴框使用 Android `KEYCODE_PASTE`，回读原生EditText，与源UI中的完整协议码逐字比较；不把协议内容写入报告，不提交预览/领取/登记/入组。辅助 `/tmp/xiaobu-copy-group-check.cjs` 仅输出长度与相等布尔值。

| 参数                         | 状态 | 结果与证据                                                                                                                                         |
| ---------------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 小组邀请码复制及粘贴完整性   | PASS | 204/204，exact=true；`/tmp/qa25-oppo-group-copy-integrity.log`。源 `comp-copy-group-source.xml`，`comp-copy-group-feedback.xml` 实见邀请码已复制。 |
| 既有赠券复制及粘贴完整性     | PASS | 321/321，exact=true；`/tmp/qa25-oppo-gift-copy-integrity.log`。源 `comp-gift-code-source.xml`，`comp-gift-copy-feedback.xml` 实见券码已复制。      |
| 既有领取回执复制及粘贴完整性 | PASS | 608/608，exact=true；`/tmp/qa25-oppo-receipt-copy-integrity.log`。源 `comp-receipt-source.xml`，`comp-receipt-feedback.xml` 实见回执码已复制。     |

三次粘贴均返回、确认放弃草稿。点击查看券码曾因页面过渡时滑动未生效而定位到0个目标，工具退出1且未点击其他位置；重读页面后再滑动并成功打开。不是产品故障，也不把整个命令序列的最终退出0当作所有子命令成功。部分早期临时UI驱动在宿主Node18运行，正式质量检查使用Node24.22.1；不将两者混写。

## 本轮质量检查

| 命令                     | 退出码  | 实际结果                                                                                                       |
| ------------------------ | ------- | -------------------------------------------------------------------------------------------------------------- |
| `npm test`，Node24.22.1  | 0       | 314/314，无失败/跳过；`/tmp/qa25-deadline-npm-test.log`，不是原生UI或SQLite故障测试。                          |
| `npm run typecheck`      | 0       | `/tmp/qa25-deadline-typecheck.log`。                                                                           |
| `npm run lint`           | 1       | 既有 `scripts/create-app-icon.cjs` 两处__dirname错误，TodayScreen两处Hook警告；`/tmp/qa25-deadline-lint.log`。 |
| `npm run format:check`   | 1       | 391文件格式告警；`/tmp/qa25-deadline-format.log`。没有全仓格式化。                                             |
| export / build / install | NOT_RUN | 无产品/平台变更，沿用已安装QA25。                                                                              |

## 独立复核与边界

按项目约定与omc-reference尝试派发独立verifier，返回任务正文为空，明确未读文件或复核。本轮没有有效独立复核，不将主代理二次检查冒充独立审核。

本轮不修改规则、用例预期或应用说明；沿用 COMP-011/COPY-001。复制覆盖系统测试剪贴板，不读取或恢复此前私人内容。摄像头实扫、复制失败/快速重复/全部关闭重开、accepted不自行释放、提交后晚到决定、真实到期券和全功能验收仍未完成。

结论：本次未确认邀请超时参数、三类码复制完整性及双机冷启动取得有限通过证据，没有发现本轮新增产品缺陷。独立复核缺失、既有lint/格式失败和其他未测项仍保留，不能声明所有功能真机通过。

收尾：本记录局部 `prettier --write`、`prettier --check` 均退出0；Node24对两机coldLaunch/81/23/无本次用途、三类复制exact和覆盖索引的只读一致性断言退出0。它不是独立复核或全仓格式通过。
