# PRTS Fetcher 运维

> 跨项目共用的事实（机器、域名、nginx、备份、推送凭据）见 arknights-recruit 仓库的
> [`docs/ops/shared-infrastructure.md`](https://github.com/LockhartANR/arknights-recruit/blob/main/docs/ops/shared-infrastructure.md)。

| 项 | 值 |
|---|---|
| GitHub | `LockhartANR/PRTS-fetcher` |
| 运行位置 | **仅本地开发机**，不部署在服务器上 |
| 技术栈 | Node.js ≥ 18，axios + cheerio + p-limit |
| 数据源 | [PRTS.wiki](https://prts.wiki)（社区维护的明日方舟 Wiki） |
| 产物 | `output/operators.json`、`output/tags.json`、`output/avatars/*.png` |

本项目是**上游数据源**，不是对外服务。它产出干员数据，经 GitHub 中转后由
arknights-recruit 消费。

## 数据流向

```
PRTS.wiki
   │  node src/index.js --avatars        （在本项目运行）
   ▼
prts-fetcher/output/{operators.json, avatars/*.png}
   │  git push                            （推到 LockhartANR/PRTS-fetcher）
   ▼
GitHub raw / zip
   │  node sync-operators.js              （在 arknights-recruit 运行）
   ▼
arknights-recruit/client/public/{operators.json, operators/*.png}
   │  vite build                          （经 update.sh）
   ▼
线上 /operators/*.png  ←  前端经 /api/operators 读取 operators.json
```

**这条链路依赖 GitHub 推送通道**：本地抓取后必须推到 GitHub，应用侧才拉得到。
推送不通时整条链路停在第一步。

## 运行

```bash
npm install
npm start                          # 抓取全部干员（仅元数据）
node src/index.js --avatars        # 抓取并下载头像
npm test                           # 测试模式，只前 10 名
node src/index.js --limit=100 --avatars
node src/index.js --help
```

限速、重试与输出路径在 `src/config.js`：

| 配置项 | 默认 | 说明 |
|---|---|---|
| `CONCURRENCY` | 3 | 最大并发请求数 |
| `DELAY_MS` | 200 | 请求间隔（毫秒） |
| `RETRIES` | 3 | 失败最大重试次数 |
| `RETRY_DELAY_MS` | 2000 | 重试初始等待（指数退避） |
| `TIMEOUT_MS` | 15000 | 单次请求超时 |

对 wiki 请保持克制。免责声明见 `README.md`。

## 与应用的对应关系（已对账，2026-10-10）

**数据是一致的**，但两个文件的字节数不同，容易误判为脱节：

| | 大小 |
|---|---|
| `prts-fetcher/output/operators.json`（源） | 177,466 B |
| `arknights-recruit/client/public/operators.json`（部署） | 154,956 B |

差异**完全由 `sync-operators.js` 的两处有意处理造成**，不是数据缺失：

1. 它把每个干员的 `avatar` 字段改写成站内路径：
   `https://media.prts.wiki/b/b7/%E5%A4%B4%E5%83%8F_12F.png` → `/operators/12f.png`
   （源文件的 URL 更长，改写后变短）
2. 它用 `JSON.stringify(operators, null, 2)` 重新序列化，源文件的格式差异被重新排版

对账方法（结论：两边 **431 条、id 集合零差异、字段逐一相同**）：

```powershell
$enc=[System.Text.UTF8Encoding]::new($false)
$src=[System.IO.File]::ReadAllText('..\prts-fetcher\output\operators.json',$enc)|ConvertFrom-Json
$dst=[System.IO.File]::ReadAllText('client\public\operators.json',$enc)|ConvertFrom-Json
Compare-Object ($src.id) ($dst.id)      # 应为空
```

## 输出内容说明

- `output/operators.json` —— 431 条干员（id、中英文名、稀有度、职业、分支、位置、
  招募标签、头像 URL、画师、所属阵营）。
- `output/avatars/*.png` —— 431 张头像（启用 `--avatars` 时生成）。
- `output/tags.json` —— 27 个标签及其出现次数。

> ⚠️ **`tags.json` 目前没有任何消费方。** `sync-operators.js` 只同步
> `operators.json` 与头像，应用侧也没有任何代码引用它（前端经 `/api/operators`
> 拿数据，由 `server/routes/operators.js` 读取 `client/public/operators.json`）。
> 它是 fetcher 的副产品，不是缺失的部署步骤 —— 曾据此误判过一次，特此记录。

## 验证

```bash
# 语法与入口可用性
node --check src/index.js

# 小规模真实运行（不下载头像）
node src/index.js --limit 10

# 产物基本校验
node -e "
const o=require('./output/operators.json');
console.log('operators:', o.length);
console.log('unique ids:', new Set(o.map(x=>x.id)).size);
const missing=o.filter(x=>!x.id||!x.name||!x.rarity);
console.log('incomplete entries:', missing.length);
"
```

## 已知缺口

1. **只在本地运行，没有自动化**。抓取是手工触发，没有 CI、没有定时任务。
   数据陈旧与否只能靠人工比对（见上面的对账方法）。
2. **无测试**。`npm test` 只是带 `--limit 10` 跑一次真实抓取，不是单元测试。
3. **页面解析依赖 wiki 结构**。`src/pageParser.js` 解析的是页面 JavaScript 里内嵌的
   `char_info` JSON；wiki 改版会静默产出空或错误数据，需要重新核对。
   `CHAR_ID_URL` 环境变量用于覆盖 `charId.js` 的地址。
4. `output/avatars/` 有 431 张 PNG，纳入版本控制后仓库体积会随头像增长。
