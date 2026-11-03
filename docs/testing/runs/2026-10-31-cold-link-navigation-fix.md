# 验收记录：冷启动深链后更多底栏未退栈

## 变更与环境

| 项目                               | 实际内容                                                                                                                           |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 需求/缺陷及验收标准                | NAV-002/003/008：冷启动深链进入更多子页后，重按更多或切奖券再更多均回总览；取消tabPress与未保存草稿的离开确认仍有效，不用reset绕过 |
| 日期、执行者、独立复核者           | 2026-10-31，executor_nav_cold；独立复核由主代理安排verify_resume，尚未完成                                                         |
| 提交 SHA、分支、工作区 diff 范围   | 基线95ce109/main；未提交改动：App.tsx、taskNavigation测试、说明/用例/覆盖/日志/原生技能及版本元数据；保留开始时11份未跟踪验收记录  |
| 应用版本、Node/npm 版本            | 修复前1.0.17/code18；准备1.0.18/code19；Node v24.22.1；npm版本本子任务未单独核验                                                   |
| 平台、系统、设备/浏览器、屏幕/字体 | 本子任务仅macOS Node导航库回归；旧包Samsung设备失败由主代理实际执行并提供结果，设备完整信息见同轮设备记录                          |
| 时区、本地日期、边界时钟           | Asia/Shanghai，2026-10-31；未改系统时钟                                                                                            |
| 测试数据与身份                     | 路由测试只使用qa-missing-member虚构标识，不访问设备或业务存档；不改用户数据                                                        |
| 基线及关联用例                     | NAV-002、NAV-003、NAV-005、NAV-006、NAV-008；现有12项定向测试通过，但缺少父部分状态/子栈已水合的冷启动场景                         |

## 根因与最小修复

- 旧QA真机现象（由主代理观察）：force-stop QA后以VIEW冷启动成员空态，反复点更多及切奖券再更多均留在成员页；Android返回键可回总览。旧包热启动深链、首页成员卡返回不等于冷链已通过。
- 真实getStateFromPath解析应用配置可产生不含子栈key的父嵌套部分状态；StackRouter在子级水合后已有合法key。旧回调只读取TabBar的父state快照，因nested.key不存在完全不派发退栈。新增回归保留该父部分状态并提供水合子栈，修复前实际断言dispatch次数0而期望1。没有采集旧包内存状态，不把库层复现说成已抓到设备内存。
- 本地已安装官方源码核验：core/src/useOnGetState.tsx通过子级getState监听器递归合并状态；BaseNavigationContainer.tsx的getRootState调用根监听器；useNavigationHelpers.tsx的普通getState不递归子级。native-stack的自动tabPress退栈受popToTop:false抑制，不能作为当前自定义回调的兜底。
- 修复仅让TabBar读取NavigationContainer ref.getRootState()的实时水合子栈；保留既有popToTop/popTo、target/source和可取消tabPress，未引入reset、数据写入或依赖升级。新增源码接线断言；现有真实beforeRemove拦截/重试测试继续通过。
- 已内容审查CHANGELOG与项目原生打包技能，并补入已证实冷链风险；ui-ux-pro-max的导航历史/草稿保护原则用于约束修复，不重设计UI。已检查dist没有1.0.18命名产物（rg无匹配退出1），准备新版本且不覆盖旧包。

## 自动化执行

下列命令均在项目根目录执行，PATH前缀为 `/Users/mac/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH`。

| 阶段                            | 实际命令                                                                                                                                                                                                                                                                 | 退出码  | 通过/失败/跳过数量 | 日志路径或摘要                                                                          |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- | ------------------ | --------------------------------------------------------------------------------------- |
| 环境                            | `node --version`                                                                                                                                                                                                                                                         | 0       | N/A                | v24.22.1                                                                                |
| 修改前基线                      | `node --import tsx --test tests/taskNavigation.test.ts tests/deepLink.test.ts`                                                                                                                                                                                           | 0       | 12/0/0             | 原有用例通过                                                                            |
| 新增回归先红                    | 同一定向命令，产品代码未修复                                                                                                                                                                                                                                             | 1       | 12/1/0             | 冷链部分父状态场景dispatch次数0 !== 1；其余通过                                         |
| 修复后第一次定向                | 同一定向命令                                                                                                                                                                                                                                                             | 0       | 13/0/0             | 冷链退栈、取消tabPress与beforeRemove通过                                                |
| 类型首次检查                    | `npm run typecheck`                                                                                                                                                                                                                                                      | 2       | N/A                | 新测试将通用PartialState直接传StackRouter，TS2345；已显式标记测试子栈type:'stack'后修正 |
| 类型复测                        | `npm run typecheck`                                                                                                                                                                                                                                                      | 0       | N/A                | tsc --noEmit无错误                                                                      |
| 修改文件格式化                  | `node node_modules/prettier/bin/prettier.cjs --write App.tsx tests/taskNavigation.test.ts APP_MANUAL.md CHANGELOG.md docs/testing/TEST_CASES.md docs/testing/COVERAGE.md .cursor/skills/android-native-crash-avoidance/SKILL.md package.json package-lock.json app.json` | 0       | N/A                | 只格式化本子任务修改文件；不是全量format:check                                          |
| 格式化后定向复测                | `node --import tsx --test tests/taskNavigation.test.ts tests/deepLink.test.ts`                                                                                                                                                                                           | 0       | 13/0/0             | 无失败、取消或跳过                                                                      |
| 完整测试/类型/lint/format:check | 主代理集中执行，见后续补充                                                                                                                                                                                                                                               | NOT_RUN | NOT_RUN            | 本子任务不重复全量门禁                                                                  |
| export、APK构建、安装及真机     | 主代理后续执行                                                                                                                                                                                                                                                           | NOT_RUN | NOT_RUN            | 本子任务未操作设备、未构建安装、未提交git                                               |

## 功能执行明细

| 用例 ID                     | 参数/平台/数据                                     | 状态    | 实际结果与证据                                                                         | 缺陷或阻塞原因         |
| --------------------------- | -------------------------------------------------- | ------- | -------------------------------------------------------------------------------------- | ---------------------- |
| NAV-008（库层）             | 冷链父部分状态无key、子栈已水合；qa-missing-member | PASS    | 真实解析器/StackRouter执行实际App回调，定向栈键，退栈到唯一index，成员参数保持到退栈前 | 不是页面E2E            |
| NAV-002（库层）             | 正常子栈、取消tabPress                             | PASS    | 更多正常退栈且不追加总览；取消不navigate或dispatch                                     | 真机另测               |
| NAV-005/006/008（库层）     | 正常/非总览根栈及被保护路由                        | PASS    | 实际shouldPreventRemove阻止退栈，模拟确认后重放原action才返回总览                      | 不等同原生确认弹窗点击 |
| NAV-003（解析层）           | 正式/QA/开发协议，非法协议路径、缺成员参数         | PASS    | 既有5项深链测试继续通过                                                                | 不等同系统派发         |
| NAV-002/003/008（新包设备） | 1.0.18/code19；冷/热深链、同tab/跨tab、Android返回 | NOT_RUN | 主代理需新QA包实际复测，不能复用1.0.17成功结果                                         | 待构建安装             |
| NAV-005/006（新包设备）     | 设置/账户等草稿继续编辑与放弃                      | NOT_RUN | 主代理需新包分别操作确认取消/确认                                                      | 待设备复测             |

## 缺陷与未覆盖项

| 编号                   | 优先级 | 复现/期望/实际                                             | 关联用例        | 基线已有或本次引入 | 修复及复测结果             |
| ---------------------- | ------ | ---------------------------------------------------------- | --------------- | ------------------ | -------------------------- |
| NAV-COLD-MORE-20261031 | P1     | 冷启动深链成员空态后更多不回总览；期望同tab及跨tab均可退栈 | NAV-002/003/008 | 1.0.17既有缺陷     | 库层先红后绿；新包真机未测 |

未验证iOS/Web交互、新包系统派发和真实草稿弹窗。本记录不能用于声称“全部功能真机通过”。旧包设备结果与本子任务Node结果分别记录。

## 独立复核与结论

- 交接前局部格式检查：`node node_modules/prettier/bin/prettier.cjs --check App.tsx tests/taskNavigation.test.ts APP_MANUAL.md CHANGELOG.md docs/testing/TEST_CASES.md docs/testing/COVERAGE.md .cursor/skills/android-native-crash-avoidance/SKILL.md package.json package-lock.json app.json docs/testing/runs/2026-10-31-cold-link-navigation-fix.md` 退出0；`git diff --check` 退出0。此检查不代替全量format:check。
- 独立复核尚待verify_resume审查diff、回归与真实设备证据，本执行者不自批。
- 已更新TEST_CASES NAV-008、COVERAGE taskNavigation行、APP_MANUAL更多返回行为、CHANGELOG1.0.18与项目原生技能冷链风险。
- 当前结论：部分验证待补。代码定向回归13/13通过、类型检查通过；全量门禁、新包构建安装、设备与独立复核由主代理接续。

## 主代理接续：质量与构建

- Node24.22.1；JAVA_HOME使用已存在临时Zulu17.0.21.0.3目录，java -version退出0；ANDROID_HOME为已存在/Users/mac/Library/Android/sdk，含36平台/buildtools、NDK27.1及CMake3.22.1和已有许可。没有安装系统运行时或接受新许可。系统java_home不能发现该临时JDK，不代表本地没有可用JDK。
- 本轮实际npm test退出0，307通过/0失败/0跳过；npm run typecheck退出0。原始日志目录/private/tmp/xiaobu-cold-nav-quality.y4TNHy。
- npm run lint退出1：图标脚本2个__dirname no-undef错误，TodayScreen2个applyListScroll依赖警告，与同日1.0.17既有记录相同位置；未以此声称全门禁通过。npm run format:check退出1，391文件，包含构建产物及既有源码；未为了通过重写无关文件。
- npm run build:apk -- --qa --check退出0，确认1.0.18/code19、独立QA包及debug测试签名配置。打包技能和CHANGELOG内容已由执行代理及主代理审查，新增冷链状态风险已记录，不升级外部技能/依赖。
- 新QA构建与三端export已启动，终态待记录。export使用独立/private/tmp/xiaobu-cold-nav-export.YtDSZz各平台子目录，不覆盖dist旧APK。
- verify_resume独立代码复核11个已跟踪改动及修复记录，核实本地官方容器/Router/移除保护实现；独立定向13/13、typecheck、修改文件Prettier及git diff --check均退出0。未发现确定高/中严重度新增问题，准予继续设备验证而非宣称已真机修复。未操作手机；OCR委托CLI不可用退出127，未安装工具，改为完整diff及官方源码/独立测试审阅。
- 主代理实际export:android、export:ios均退出0；只是资源导出，不等于Android/iOS原生安装或交互通过。Web与QA构建仍进行中。

## 新包产物与双机回归（主代理接续）

- 前文“待执行/进行中”为当时交接状态，以本节后续实际结果为准；不回写旧包失败为通过。三端export最终均退出0，QA构建退出0，BUILD SUCCESSFUL，未覆盖旧包。
- APK：dist/小步日常-QA-1.0.18-20261031.apk；aapt核实com.smallsteps.checkin.qa、1.0.18/code19、minSdk24/targetSdk36。SHA-256为abc6ed5172fc4a99d6dc0cd2d6100aabdf84d8becbf3913ae23cb3fd4830c154；apksigner verify --print-certs退出0，Android Debug测试证书SHA-256为fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c，与旧QA一致。
- verify_resume独立实查新旧APK签名验证均退出0、版本/摘要一致；Manifest allowBackup=false、sprout-qa深链；旧1.0.17仍保留。其初次apksigner因Java PATH退出1，改用既有JDK直接执行JAR后成功，未修改系统配置。此复核不等于安装/交互验证。
- OPPO PJX110 Android16与Samsung SM-G9730 Android12分别adb install -r新QA，均Success/退出0；没有卸载、清数据、修改常规包或换签名。两台dumpsys package均1.0.18/code19，trust均deviceLocked=0。
- 两台分别force-stop QA后，以am start -W -a android.intent.action.VIEW -d sprout-qa://more/member/qa-missing-member -p com.smallsteps.checkin.qa启动，均Status ok、LaunchState COLD。界面树为成员记录/现在只看自己空态；重按更多后均出现“留一点空间，给自己”及账户/小组等总览入口。
- 两台再次分别force-stop并冷链同一路径，确认成员空态后点我的奖券，实际读取奖券筛选；再点更多均回总览。旧包已复现的同tab与跨tab冷链退栈失败在这两个新包参数上未再出现。仅此具体场景PASS，不标NAV整例或全部功能通过。
- 上述使用原生ADB/uiautomator临时XML，读取后删除，不采集存档/邀请码/身份编号；UI文字与导航观察不是像素视觉/内部状态或数据库完整性验证。后续草稿与数据保留回归仍在继续。
- 两台设置原值均门槛3、快乐自由券、周一00:00；仅将星期点为周二草稿，不保存。点更多均出现“放弃未保存的设置？”，选继续填写后页面和周二草稿保留。随后切我的奖券再点更多，均再次出现同一确认；选放弃更改才回总览。重进设置并滚动，周一已选/周二未选，门槛3、券名原值仍在；OPPO另读到00:00。此为NAV-006/008两个具体设备设置样本PASS，非全部表单覆盖。三星重进页一次滚动后已见周控件；OPPO需追加滚动才读到，未把初次未见判成丢数据。
- 两台逐一对account/growth/settings/gifts/group/archived/milestones执行QA force-stop、系统VIEW冷启动，各次均Status ok及LaunchState COLD。每页实际读取其标题/副标题，再重按更多均出现总览标题；两条七页面命令链最终退出0。此前成员空态为第八种更多子页样本；不含真实成员参数、全部跨tab组合或其他平台。
- 账户页一次UI输出出现本机身份编号（不含口令或完整交换码），报告不保留该值；临时辅助脚本随后将所有包含“身份编号”的文案统一隐藏，覆盖“本机身份编号”变体。该辅助脚本不打入应用。
- 两台账户当前头像小芽，点暖阳仅生成草稿；更多均弹“放弃未保存的账户资料？”。原先误用“继续编辑”定位退出1，弹窗未消失，不是产品失败；按实际“继续填写”后，暖阳草稿仍选中。再更多并放弃更改，均回总览；重进均恢复小芽。此账户同tab取消/确认样本通过；当时跨tab账户草稿尚未执行，后续仅补三星参数，OPPO未补，不复用设置结果。
- 两台QA再次force-stop/monkey启动后，首页本周统计OPPO6次/可兑0/可用3、三星11次/可兑0/可用4，与升级前UI基线一致。OPPO早睡/运动仍在、未见此前删除任务；未遍历全部存档或核对底层ID/事务。

## 新包追加未测输入参数

- TASK-003/OPPO：新增任务草稿QABoundary18，默认成长图标/浅绿，目标先0再100。每次实际读到对应数值；点击保存后均仍为新增小任务，显示“请输入1–99的整数”和“每日次数请填写1–99的整数”，名称与非法数值保留。关闭并放弃，滚动完整任务区仅早睡/运动，未出现QABoundary18；无成功保存或业务新增操作。UI具体非法参数PASS，不含真实数据库计数/其他参数。
- 上述首次用Android返回尝试隐藏键盘实际触发表单草稿确认，后续目标标签定位退出1；选择继续填写后按字段输入并以任务图标移开焦点才继续。按真实回显QABoundary18/0/100记录，未把定位失败当作产品缺陷。
- PROFILE-002/Samsung：已存昵称QAS，清除3字符后昵称为空，滚动到保存资料按钮enabled=false；没有绕过禁用强行保存。再输入3空格，临时XML仅汇总该EditText length=3、onlyWhitespace=true，不输出内容；取消键盘并切奖券再更多，触发账户草稿离开确认。选继续填写后滚动仍看到保存资料enabled=false。故只证明空/空格的UI禁用，不宣称执行了领域保存拒绝或数据库无写入。
- 三星上述跨tab账户弹窗选继续填写后保留页面；再更多选放弃才回总览，重进并补滚动读到昵称QAS与小芽头像，未保存非法昵称。
- GOAL-002/OPPO：新目标草稿QAGBoundary18、起点0、递增、差值1；计量单位150，实际回显150后点保存目标，仍新建表单并出现“单位不能是纯数字，请填写斤、页、元等；数值请填在起始数值中”。改单位u，差值先0再0.01，各次读到真实数值后点保存，均仍新建表单并显示“解锁差值请输入0.1–1000000，最多一位小数”。仅这些UI参数通过，非全部合法/非法小数边界。
- GIFT-003/Samsung：原默认心意券字段首次替换后实际残留3空格加字符5，按钮enabled=true；没有点制作，未把此错误输入当全空格通过。按实际4字符删除后再输入3空格，读到纯3空格且制作赠券enabled=false；不强点禁用按钮、不生成赠券，更多触发放弃确认并放弃。此只证明空格UI禁用，不等同领域制作拒绝或本机发出DB计数核验。
- OPPO上述GOAL非法草稿最终关闭并放弃，页面回到既有QAGLifecycle及新增入口，没有QAGBoundary18；未创建目标、记录或奖券。三星账户非法草稿放弃后，补滚动明确读到QAS，保存资料disabled。

## 同步与独立收尾

- 新包两台前台小组页，仅OPPO点击同步；立即取树因could not get idle state/ParseError退出1，不能据此判断同步失败。18:19:52重新读取成功：OPPO“局域网同步完成”、同步按钮enabled=true、QAS副本18:19；三星QA副本也更新18:19。没有再次点同步或重放业务操作。
- 三星首页同步后的QA成员卡仍可用3/本周已兑6/已使用6；从QA的记录进入详情看到这一周6次、早睡0/1和运动0/1，再更多回总览。未知成员空态冷链与真实成员卡是不同参数，分别记录。
- OPPO切看全组后，QAS成员卡为可用4/本周已兑5/已使用6；打开QAS详情为这一周11次、早睡0/1、运动0/1、QAL1/3、QAT3/3，再更多成功回总览。两台最终均停总览，无未保存表单。此为VIEW/NAV正常UI样本，不包含底层修订或所有任务记录对照；OPPO查看模式此次实际改为看全组。
- verify_resume独立只读审阅修复diff、验收记录与CHANGELOG，未发现确定新增代码问题或整例通过夸大；修改文件/修复记录Prettier及git diff --check退出0。其未操作设备，不能独立重建点击、同步、数据保留或证明存档完整；已采纳历史节点/草稿收尾建议。
- 本轮发现的NAV-COLD-MORE-20261031在新包双Android所列样本已复测通过；完整NAV各参数、iOS/Web交互、实际读屏、存储故障及未决同步等仍未完成。全功能目标保持active，不将307项Node测试或资源导出作为真机全通过依据。
- 主代理最终对全部本次修改的TS/JSON/Markdown文件及本记录执行Prettier --check退出0、git diff --check退出0；不包含Gradle格式化工具，不等于全量format:check通过。未提交或推送代码。
