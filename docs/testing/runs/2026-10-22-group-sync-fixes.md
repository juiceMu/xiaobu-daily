# 小组同步缺陷修复验收

日期：2026-10-22。范围：离组传播、组名一致性、同步互斥、局域网监听与传输保护、原生依赖。

## 执行计划

1. 记录基线，保留已有未提交改动。
2. 修复领域状态与收发互斥，补回归测试。
3. 分离监听/扫描，增加会话认证加密及连接边界测试。
4. 完整检查、独立复核，并记录原生设备与 UI 未验证项。

## 修改前基线

- Node v24.19.0，`npm test` 退出码 1：185 项中 181 通过、4 失败。
- 既有失败：engine 中过期券夹具、keyboardFocus 源码断言、milestoneCompact 导航源码断言、rewardHistory 导航源码断言；与首次基线相同。
- 本次不清除用户数据、不撤回已有改动，不将静态导出视为真机同步通过。

## 修改后结果

本轮复核环境：Node v20.20.2（修改前基线记录来自 Node v24.19.0）。

- `npm run typecheck`：PASS，退出码 0。
- 相关定向测试（`groupSync`、`store`、`lanProtocol`、`lanTransport`、`lanDiscovery`）：PASS，29/29，包含离组凭据只有收到对端持久化确认后才清除。
- `npm test`：退出码 1，205 项中 201 通过、4 失败。失败仍是修改前基线中的同 4 项：engine 过期券测试夹具异常、keyboardFocus 源码断言、milestoneCompact 导航源码断言、rewardHistory 导航源码断言；本次没有新增失败。
- `npx expo install --check`：PASS，Expo 57 依赖兼容；将 `expo` 对齐至 `~57.0.31`，`expo-network` 使用 57 系列版本。
- 相关源文件 ESLint：PASS；相关文件 Prettier：PASS；`git diff --check`：PASS。
- `npm run export:web`、`npm run export:android`、`npm run export:ios`：均 PASS。它们仅证明 JavaScript/资源能打包，不证明原生 Zeroconf/TCP 模块已安装或能在真机发现。

## 未执行与已知限制

- Android/iOS 原生重建及双机 mDNS/TCP、权限弹窗、大头像传输：NOT_RUN，需包含新增原生依赖的安装包和两台设备。
- Web UI 自动化：NOT_RUN；当前仓库没有可用项目内 E2E runtime，按规范不使用外部浏览器驱动替代。
- 两端同时主动扫描时仍有交叉 TCP 会话竞争，忙碌重试可恢复常见情况，但没有形式化保证。
- 离线共享邀请码没有全局吊销权威；共享组口令也不能提供每账户独立签名，持有组密钥的成员不能被密码学地区分为其他账户。这些是架构限制，不宣称已修复。
- 离组墓碑只随本人日志直接发送，不转发已知的第三方成员日志；未与离组成员直接交换的设备可能继续保留旧副本。
- 无可用 mDNS peer 时保留同前三段 IPv4 `/24` 回退，因此 mDNS 失效或网络屏蔽组播时仍有旧扫描边界。
