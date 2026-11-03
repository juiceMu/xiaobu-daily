# OPPO 独立库损坏 JSON 真机样本

- 平台：OPPO `7c034dd9`，隔离可调试包 `com.smallsteps.checkin.isolatedqa`，1.0.32/code 33；构建、签名、安装及限制见 [独立包记录](./2026-11-02-isolated-qa-bootstrap.md)。不访问或修改正式包、原 QA 包的数据。
- 范围：STORE-003 的六个损坏数据样本及 STORE-005 的坏 JSON 读取样本；非全例通过。隔离包首次启动后显示零打卡及初始任务；本测试不导入真实数据。
- 前置：强制停止独立包，在其私有 `files/SQLite` 目录复制原库作为备份。目录列表未见 WAL/SHM；独立备份复制到临时文件后 `PRAGMA integrity_check` 为 `ok`、`app_state` 有 1 行。使用本机 SQLite 将该复制库的单行 `payload` 改为无效 JSON `{broken`，变更 1 行、完整性仍为 `ok`，再仅覆盖独立包对应库。测试备份及副本不纳入版本库。
- 启动后 OPPO 出现“暂时无法读取本地数据”、保留原始数据提示及重新加载入口；点击重新加载后仍显示解析错误，见 `/tmp/7c034dd9-isolated-corrupt-json-error.xml`、`/tmp/7c034dd9-isolated-corrupt-json-after-retry.xml`。
- 再强制停止独立包，复制其当前库做检查：`SELECT count(*), sum(payload = '{broken') FROM app_state` 返回 `1|1`，完整性检查 `ok`。因此该样本中实际坏原文在启动及一次重试后未被覆盖；此结论不依赖错误页的文案。
- 将独立包私有备份复制回原路径，冷启动后恢复到零打卡、零券及初始任务首页，见 `/tmp/7c034dd9-isolated-corrupt-json-restored.xml`。这是恢复备份后冷启动，不是运行中修复后点击重新加载。
- 补充空串和 JSON `null`：分别从相同隔离备份生成独立 SQLite 副本，更新单行后注入、启动、点击重新加载、强停并复制测试库检查；两个样本都出现读取错误，点击重载退出码 0，重试后仍是错误页，分别查询得到单行和原值匹配 `1|1`、SQLite 完整性 `ok`。每次恢复备份并启动后首页显示零打卡、零券和初始任务。界面证据分别为 `/tmp/7c034dd9-isolated-empty-error.xml`、`/tmp/7c034dd9-isolated-empty-after-retry.xml`、`/tmp/7c034dd9-isolated-empty-restored.xml`，及对应 `null` 文件；测试库为 `/tmp/xiaobu-isolated-empty-after.db`、`/tmp/xiaobu-isolated-null-after.db`。
- 另分别注入 `storageVersion=999`、`sync.schemaVersion=999` 和移除 `sync` 字段：三个样本首次及重试后均显示读取错误，重载点击退出 0；每个实际读取回的 `payload` 与注入前相同，均有 1 行且 SQLite 完整性 `ok`。每次恢复备份并启动后首页可见。证据标识分别为 `storage-version`、`schema-version`、`missing-sync`：界面文件 `/tmp/7c034dd9-isolated-{标识}-{error,after-retry,restored}.xml`，输入和重试后的独立库 `/tmp/xiaobu-isolated-{标识}.db`、`/tmp/xiaobu-isolated-{标识}-after.db`。这里比较的是完整 payload 是否相同，不输出其内容。
- 独立复核确认六种样本的界面文件及测试库支持有限结论；设备复制时序、点击、强停及恢复依赖执行者命令记录，不能由静态文件独立证明。SQLite 完整性 `ok` 不代表业务完整或事务中断通过。
- 未验证读取异常、实时修复重载、业务数据逐项恢复、保存失败或提交中断；未测三星/iOS/Web。临时证据可能被清理；未运行全量测试、类型检查、lint、全量格式检查或构建。
