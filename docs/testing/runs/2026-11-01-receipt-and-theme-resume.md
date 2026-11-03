# 验收记录：QA25 回执证据补录与三星五主题补测

## 变更与环境

- 2026-11-01，主代理 Codex；HEAD `95ce109eaa87d95101ce991b1514f44e49198aa8`，main，未提交工作区已有多项改动，全部保留。本轮仅补测试文档，不改产品代码、版本、签名或安装包。
- 两机均 ADB 在线。三星 SM-G9730 已实查 `showing=false`、`mInputRestricted=false`，QA 包 `com.smallsteps.checkin.qa` 为 1.0.25/code26；420dpi，字体缩放 1.3，设备时区 Asia/Shanghai。本轮开始时 OPPO UI 树为锁屏，仅在三星执行新增交互，未尝试绕过锁屏。
- 上一轮回执相关交互已执行但未补写正式记录，本轮只重读其本机证据，不将它们说成本轮再次双机执行。原始交换码、二维码、身份标识不写入本报告。
- 三星原主题暖灰米，奖励规则门槛 3、名称快乐自由券。仅修改未保存草稿用于主题测试，不点击保存奖励规则；最终放弃草稿并恢复暖灰米。没有清数据、退组、改系统时间或操作正式包。
- 关联用例：GIFT-008/009、COPY-001、THEME-001、NAV-006/009、STORE-001 的下列有限参数；不是整行或全平台通过。

## 回执历史证据补录

| 用例/有限参数                              | 状态 | 实际证据及边界                                                                                                                                                                                                                                                                       |
| ------------------------------------------ | ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GIFT-008 / OPPO 粘贴三星合法回执，预览取消 | PASS | `/tmp/7c034dd9-qa25-receipt-preview.xml`、`receipt-preview-cancel.xml`、`receipt-before-first-confirm.xml`、`receipt-after-cancel.xml`。预览出现记录确认，取消前后 11/1 03:59 对应发出记录没有领取方文字；另一张早已有领取方的券仍保留，不把所有记录的全局出现次数当成目标记录变化。 |
| GIFT-008 / 确认后记录与冷启动保留          | PASS | 同前缀 `receipt-registered.xml` 有成功反馈，03:59 对应发出记录新增领取方；`receipt-after-cold-scroll.xml` 冷启动仍有该领取方，输入框空、预览禁用。只证明该实际业务样本的 UI 持久化，不证明数据库全部字段或原子性。                                                                   |
| GIFT-009 / 原回执重复提交拒绝              | PASS | `/tmp/qa25-receipt-repeat-final-proof.log` 为 `actualLength:635, exactInput:true`；同前缀 `duplicate-receipt-result.xml` 提示本机已记录该赠券回执。随后冷启动原领取方仍在。本行不覆盖篡改关联、未来时间或其他发出方。                                                                |
| COPY-001 / 三星回执按钮复制后系统粘贴      | PASS | `/tmp/qa25-receipt-copy-paste-proof.log` 为源长度635、字段长度637、已知草稿前缀2、`pastedPayloadExact:true`。按后缀与实际源码逐字比对；不将带前缀字段冒充可直接提交的合法码。未覆盖另外两个复制入口或故障分支。                                                                      |

回执输入曾受输入法改写/丢字影响，未核验完整的尝试没有用于产品拒绝结论。最终重复提交在逐字比对成功之后进行。源 QR 曾由截图及 ZXing 解码，不是手机摄像头实际扫描；不能据此关闭三类码实扫用例。三星剪贴板最后由测试回执覆盖，未读取或恢复原私人剪贴板。以上码与原始 XML 仅保存在本机临时证据中，不附到报告。

## 本轮三星新增交互

设备证据前缀为 `/tmp/R28M22J0K3D-theme-`，辅助脚本 `/tmp/xiaobu-theme-qa.cjs` 和 `/tmp/xiaobu-theme-cold.cjs`，均针对实际 UI 节点定位，不直接修改应用存档。

| 用例/参数                          | 状态 | 实际结果与证据                                                                                                                                                                          |
| ---------------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| THEME-001 / 暖灰米草稿保留         | PASS | 名称增加 QATheme 后选择暖灰米，`warm-selected.xml` 显示该主题，`warm-draft.xml` 的实际 EditText 保留完整草稿；这是同主题点击参数。                                                      |
| THEME-001 / 薄荷花园草稿保留       | PASS | `mint-selected.xml`、`mint-draft.xml`：主题切换且实际 EditText 草稿不丢。                                                                                                               |
| THEME-001 / 柔雾紫草稿保留         | PASS | `purple-selected.xml`、`purple-draft.xml`：同上。                                                                                                                                       |
| THEME-001 / 蜜桃粉草稿保留         | PASS | `pink-selected.xml`、`pink-draft.xml`：同上。                                                                                                                                           |
| THEME-001 / 极简白草稿保留         | PASS | `white-selected.xml`、`white-draft.xml`：同上。                                                                                                                                         |
| NAV-006 / 返回先继续再放弃         | PASS | `discard-confirm.xml` 实际出现放弃提示；`continue-draft.xml` 的 EditText 仍是完整草稿；再次返回并点放弃。未保存草稿在后续每次冷启动均未出现。                                           |
| THEME-001 / 极简白冷启动           | PASS | `cold-white-startup.xml` 显示极简白；`cold-white-rules.xml` 仍为原奖励名和门槛，未保存草稿消失。                                                                                        |
| THEME-001 / 薄荷花园冷启动         | PASS | `cold-mint-startup.xml`、`cold-mint-rules.xml`：所选主题保留，原奖励名和门槛不变。                                                                                                      |
| THEME-001 / 柔雾紫冷启动           | PASS | `cold-purple-startup.xml`、`cold-purple-rules.xml`：同上。                                                                                                                              |
| THEME-001 / 蜜桃粉冷启动           | PASS | `cold-pink-startup.xml`、`cold-pink-rules.xml`：同上。                                                                                                                                  |
| THEME-001 / 暖灰米冷启动、恢复基线 | PASS | `cold-warm-startup.xml`、`cold-warm-rules.xml`：恢复原主题且奖励名/门槛不变。随后原生返回，`finish-more.xml` 为更多总览。                                                               |
| NAV-009 / QA25 三星设置页间距      | PASS | `cold-warm.png` 原图，暗色列箭头54–93、标题首字112起，空隙18px÷2.625≈6.86dp，低于8dp；原生返回节点 `[0,112][147,259]` 为56dp。实际点击回到更多。只补三星设置页，不扩展到全部页面/OPPO。 |

冷启动每次先 `adb shell am force-stop com.smallsteps.checkin.qa`，再 `adb shell am start -W -a android.intent.action.VIEW -d sprout-qa://more/settings com.smallsteps.checkin.qa`。脚本每轮独立读取主题与实际原奖励字段断言，五轮均完成、脚本退出0。曾误用缺少 more 层级的 `sprout-qa://settings`，实际打开今日页，随后通过更多→设置确认极简白保留；此错误测试地址不判为产品导航缺陷。

设置页截图 `/tmp/R28M22J0K3D-theme-cold-{white,mint,purple,pink,warm}.png` 已查看五列缩略拼图 `/tmp/qa25-five-theme-cold-sheet.png`：所选圆点、页面色与底栏色随主题变化；极简白还查看了原尺寸图。未做全部字形/混色的对比度测量，不把缩略图视为可读性全验收。UI/UX 技能用于保留原生返回触控区和区分视觉/交互证据，未因此改代码或设计令牌。

## 命令与质量检查

| 命令/阶段                           | 退出码  | 实际结果                                                                                                                    |
| ----------------------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------- |
| 第一阶段主题草稿设备辅助脚本        | 0       | 五主题各自 current 与 draftIntact 均 true；辅助脚本由宿主 Node18 执行，不冒充 Node24 产品测试。                             |
| 第二阶段主题冷启动脚本，Node24.22.1 | 0       | 五主题各自 coldRetained、nameUnchanged、thresholdUnchanged、noDraft 均 true。                                               |
| `npm test`，Node24.22.1             | 0       | 314/314，零失败/跳过；`/tmp/qa25-resumed-npm-test.log`。Node 测试不是原生 UI E2E。                                          |
| `npm run typecheck`，Node24.22.1    | 0       | tsc 无错误，本轮实际运行观察。                                                                                              |
| `npm run lint`，Node24.22.1         | 1       | 与 QA25 原记录一致：create-app-icon.cjs 两处 __dirname 错误，TodayScreen 两条 Hook 依赖警告；`/tmp/qa25-resumed-lint.log`。 |
| `npm run format:check`，Node24.22.1 | 1       | 391文件告警，含既有源码、报告和Android生成文件；`/tmp/qa25-resumed-format.log`。本报告加入前执行，新增报告定向格式另核。    |
| APK构建/安装、export 各平台         | NOT_RUN | 本轮未改产品或平台依赖，仅在已装 QA25 测试；不复用上轮构建输出当作本轮执行。                                                |

草稿测试脚本尚未收尾时，曾误并发启动另一次 UIAutomator dump，后者返回 ADB137；等待原脚本实际退出0后串行重试，正常取得放弃提示。此为测试驱动并发干扰，不认作产品崩溃；此后单设备交互串行执行。

## 缺口、独立复核与结论

- THEME-001 全部子页/弹窗、全部业务语义、其他平台、F0默认主题未在本轮全覆盖；THEME-002 真实焦点/对比度、THEME-003 失败/延迟/读取异常仍待测。当前只关闭表中设备参数，不将 THEME 整族标为通过。
- GIFT-009 篡改与未来时间、COPY-001 其他入口、真实扫码、存储故障/恢复与同步阶段故障仍未闭环；整体全功能目标继续 active。
- 已尝试独立 verifier：回执任务初次及补发均返回正文为空，另一个无历史 verifier 仍反馈未收到具体任务；无有效独立复核结果，不自批准。证据事实不等于验收门禁全部完成。
- 本轮未发现新增产品缺陷；保留全仓 lint/格式既有失败。只新增本记录并添加覆盖索引链接，未改变用例预期或应用规则。
- 结论：本轮三星五主题草稿、五主题冷启动和设置页头有限参数取得实际设备证据；上一轮合法回执闭环与重复拦截完成证据补录。仍是部分验证待补，不能声明所有功能真机通过。

## 后续新增：三星另外两个复制入口

- COPY-001 / 邀请码完整复制子参数 PASS：小组页实际点击复制邀请码两次，均出现成功反馈；原码为204字符，系统 KEYCODE_PASTE 在空白赠券粘贴框内粘贴，逐字比较为204字符且 exact=true。证据 `/tmp/qa25-group-copy-integrity.log`、`/tmp/R28M22J0K3D-copy-group-{first,second}-feedback.xml`。
- COPY-001 / 赠券码完整复制子参数 PASS：使用已有发出券，不制作新券，打开查看券码并实际复制两次；第一次明确成功反馈。源与粘贴结果均295字符且 exact=true；证据 `/tmp/qa25-gift-copy-integrity.log`、`/tmp/R28M22J0K3D-copy-gift-display-source.xml`、`copy-gift-first-feedback.xml`。
- 两次仅借空白粘贴框核对内容，均未点击预览/确认/入组；返回后明确放弃未保存内容，最终 `copy-gift-clean-more.xml` 为更多总览。没有使用复制结果重复领取或记录回执。三星剪贴板最终为测试赠券码，覆盖了上文较早的测试回执。
- 原 XML 对含双引号的属性使用单引号包裹，初版临时比较脚本仅识别双引号因而未找到原码，退出1且未操作设备；改为双/单引号均可解析后实际粘贴比较成功。属于测试证据解析修正，不是产品缺陷或原码错误。
- 此后三星三种入口均有内容完整性样本，但忙碌/卸载/故障、全部关闭重开/Android不可选与其他设备参数仍不因此通过，不能将 COPY-001 整行关闭。
- 新增文档定向 `prettier --write`、`prettier --check` 已实际退出0；不替代全仓391文件格式告警。

## 用户解锁后新增：OPPO 五主题补测

- 用户告知 OPPO 已解锁后，实查 showing=false、interactiveState=AWAKE、mInputRestricted=false，QA1.0.25/code26。PJX110，物理560dpi/override480dpi，字体缩放1.0；原主题极简白、原门槛1、原奖励名快乐自由券。没有将三星的门槛3套到OPPO。
- THEME-001 / 五主题草稿保留分别 PASS：`/tmp/7c034dd9-theme-{warm,mint,purple,pink,white}-{selected,draft}.xml`，每种选择后实际主题文字正确，EditText 均保留完整的快乐自由券QATheme。`/tmp/xiaobu-theme-qa.cjs 7c034dd9` 使用Node24，实际退出0。
- NAV-006 / OPPO返回继续填写与放弃分别 PASS：`/tmp/7c034dd9-oppo-theme-continue.xml` 包含真实放弃提示，`oppo-theme-continue-draft.xml` 实际 EditText 保留完整草稿；随后再次返回点放弃，不保存奖励规则。
- THEME-001 / OPPO五主题冷启动分别 PASS：`/tmp/7c034dd9-theme-cold-{mint,purple,pink,warm,white}-startup.xml` 和各自 `-rules.xml`。`node /tmp/xiaobu-theme-cold.cjs 7c034dd9 1` 实际退出0，五轮均核对主题保留、原门槛1/原名称未变、未保存草稿未出现。最终恢复原极简白，`/tmp/7c034dd9-oppo-theme-final-more.xml` 为原生返回后的更多页。
- 五主题截图已查看拼图 `/tmp/qa25-oppo-five-theme-cold-sheet.png`，颜色与底栏切换可见；仍不宣称全部页面/弹窗、读屏/对比度/故障分支通过。该补测不需要新构建或安装。
- NAV-009 / QA25 OPPO设置页 PASS：`/tmp/7c034dd9-theme-cold-white.png` 原始像素箭头61–107、标题首列128，空隙20px÷3≈6.67dp；返回触控 `[0,120][168,288]` 为56dp，实际返回更多。与本轮三星设置页证据合计只关闭两机设置页参数，非全部子页。
- 辅助驱动曾在三星赠券页尚未滚到目标时未找到查看券码，未点击错误对象；继续读取当前UI并滚到唯一目标后正常执行，不把驱动零匹配记产品缺陷。OPPO补测操作均在其解锁确认之后进行。
- 本轮后续无新增产品缺陷；独立复核通道仍无有效任务接收结果，全功能目标不完成。
