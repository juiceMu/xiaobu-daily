# 真机补测：三星大字体键盘展开时保存账户

- 日期：2026-11-02；三星 SM-G9730 / Android 12，隔离 QA 包 `com.smallsteps.checkin.qa`，实查 1.0.32/code 33；关联 INPUT-002 的账户资料有限参数。
- 原系统字体缩放实读 1.3，临时设置为 1.5 后再次实读为 1.5。账户页基线昵称为 `QAS`，保存按钮禁用，见 `/tmp/R28M22J0K3D-input15-baseline.xml`。
- 输入临时昵称 `QASKeyTest`，`dumpsys input_method` 在滑动前后均显示 `mInputShown=true`。在键盘保持展开时滚动，界面树显示昵称输入框和启用的保存按钮，见 `/tmp/R28M22J0K3D-input15-before-save.xml`；实际点击保存后页面显示临时昵称、“账户资料已保存到本机。”以及禁用的保存按钮，见 `/tmp/R28M22J0K3D-input15-save-result.xml`。
- 随后将昵称改回 `QAS` 并保存，返回更多页显示 `QAS`，见 `/tmp/R28M22J0K3D-input15-restore-draft.xml`、`/tmp/R28M22J0K3D-input15-restored-view.xml`。系统字号恢复 1.3 并实读确认。未清档、修改正式包或产品代码。
- 独立 verifier 只读复核上述界面树，确认昵称、保存按钮状态、成功提示及恢复后的显示。界面树仅含 QA 包节点，不能独立证明键盘可见或没有视觉遮挡，也不能独立证明点击顺序、字号倍率、底层存储或冷启动持久化；键盘和倍率依赖执行时系统命令输出。
- 本次未保存截图、未验证其他表单/平台或完整 INPUT-002，临时界面树可能被清理。未运行全量测试、类型检查、lint 或构建。
