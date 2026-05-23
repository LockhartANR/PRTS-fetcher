# PRTS Fetcher

> 从 [PRTS.wiki](https://prts.wiki) 爬取明日方舟干员数据

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](package.json)

PRTS Fetcher 从社区维护的明日方舟 Wiki [PRTS.wiki](https://prts.wiki) 爬取所有干员的结构化数据，包括：

- **干员名**（中英文）
- **稀有度**（1–6 星）
- **职业**与**分支**（子职业）
- **位置**（近战位 / 远程位）
- **招募标签**（位置、职业、词缀）
- **头像图片 URL**
- **画师**
- **所属阵营**

输出为干净的 JSON 文件，可直接用于下游开发。

---

## 安装

```bash
git clone https://github.com/<your-org>/prts-fetcher.git
cd prts-fetcher
npm install
```

**运行环境：** Node.js >= 18

## 使用方法

```bash
# 爬取全部干员（仅元数据）
npm start

# 爬取全部干员并下载头像
node src/index.js --avatars

# 测试模式（仅前 10 名干员）
npm test

# 指定数量 + 下载头像
node src/index.js --limit=100 --avatars

# 查看帮助
node src/index.js --help
```

### 环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| `CHAR_ID_URL` | *(自动)* | 覆盖 charId JS 文件的 URL（wiki 更新数据快照时使用） |

## 输出

成功运行后，`output/` 目录下会生成以下内容：

### `output/operators.json`

```json
[
  {
    "id": "amiya",
    "name": "阿米娅",
    "nameEn": "Amiya",
    "rarity": 5,
    "class": "术师",
    "branch": "中坚术师",
    "position": "远程位",
    "tags": ["远程位", "术师", "输出"],
    "avatar": "https://media.prts.wiki/...",
    "groupId": "罗德岛",
    "painter": "唯@W"
  }
]
```

### `output/tags.json`

```json
[
  { "tag": "输出", "count": 229 },
  { "tag": "近战位", "count": 216 }
]
```

### `output/avatars/`（需启用 `--avatars`）

头像图片以 `{id}.png` 命名保存，例如 `output/avatars/amiya.png`、`output/avatars/texas.png`。

## 工作原理

1. **获取干员列表** — 解析 wiki 的 `charId.js` 元数据文件，获取所有干员的名称和 ID。
2. **获取页面** — 并发请求每个干员的 wiki 页面（可配置并发数，内置限速）。
3. **解析页面** — 提取页面 JavaScript 中嵌入的 `char_info` JSON 数据，并通过 MediaWiki 的 MD5 文件名哈希计算头像 URL。
4. **转换与输出** — 标准化数据、处理重复 ID、统计标签出现次数，写入 JSON 文件。
5. **下载头像**（可选，`--avatars`） — 从 PRTS 媒体服务器下载头像图片到 `output/avatars/`。

## 配置

限速、重试策略和输出路径可在 [`src/config.js`](src/config.js) 中调整：

| 配置项 | 默认值 | 说明 |
|---|---|---|
| `CONCURRENCY` | 3 | 最大并发请求数 |
| `DELAY_MS` | 200 | 请求间隔（毫秒） |
| `RETRIES` | 3 | 失败最大重试次数 |
| `RETRY_DELAY_MS` | 2000 | 重试初始等待（指数退避） |
| `TIMEOUT_MS` | 15000 | 单次请求超时（毫秒） |

## 免责声明

本工具爬取 PRTS.wiki 上公开的数据，仅供学习研究使用。请注意：

- 尊重 wiki 的服务器资源，必要时调低 `CONCURRENCY` 或调高 `DELAY_MS`。
- 请勿用于大规模、高频的激进爬取。
- 数据归 PRTS.wiki 及其贡献者所有，使用时请注明出处。

PRTS Fetcher 与 PRTS.wiki、鹰角网络、悠星网络无任何关联。

## 许可证

[MIT](LICENSE)
