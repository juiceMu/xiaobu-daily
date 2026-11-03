# 双机同行邀请占用与取消

- 2026-11-02，OPPO PJX110 / Android 16 和三星 SM-G9730 / Android 12，隔离 QA 1.0.32/code 33；COMP-013 的未确认邀请 UI 样本。
- OPPO 原本本周 2 次、可兑换 0、可用 70。对 QA 测试任务 `QATarget99` 新增一次打卡后为 3 次、可兑换 1；确认兑换同行券，弹窗提示消耗本周 1 次，兑换后可兑换 0、可用 71。新增测试打卡与同行券保留。
- OPPO 小组页点击同步后显示“局域网同步完成”。三星以已有 `QAG · 2可里程碑奖券` 为主券，选择 QA 同行券并发送空用途邀请。第一次用候选文字定位未找到可点击节点，未选中；改用实际选项控件后发送。
- 三星显示“已授权主券使用 · 等待伙伴确认”；主券卡没有单独使用入口，相邻另一张主券仍有使用入口。未在 OPPO 点击确认。三星确认取消邀请后，该主券的使用按钮重新显示且 enabled=true；OPPO 当前可用列表显示同行券“找伙伴”入口，未见待处理邀请。
- 临时证据：`/tmp/7c034dd9-qa32-comp-oppo-{top,check-view,redeem-dialog,redeemed,sync-terminal,final}.xml`、`/tmp/R28M22J0K3D-qa32-comp-samsung-{candidates,invite-view,pending3,locked,cancel-dialog,after-top}.xml`。部分同步期间 dump 未进入 idle，后续重新采集；临时文件可能含 QA 资料，不保证长期保留。
- 独立 verifier 只读核对所列快照，数量、候选、待确认提示和取消后入口一致；所列快照未显示打卡任务名，任务及操作顺序依赖执行者记录。
- 此为未确认、取消的界面样本；未测试另配、离组、accepted/committed、精确券 ID 或数据库状态，不能据此关闭整个 COMP-013。静态快照不能独立证明操作顺序及未点击确认。未修改产品代码，未运行全仓测试或构建。
