# 爱发电工具集

爱发电赞助者订单查询 & QQ 群自动审批机器人。

---

## 系统依赖

### NapCat（必需）

**NapCat** 是 QQ 机器人底层框架，本项目通过 NapCat 的 OneBot v11 WebSocket 接口监听和处理加群请求。

- 下载：[NapCat GitHub Releases](https://github.com/NapNeko/NapCat/releases)
- NapCat 需要**先启动并登录 QQ 账号**，才可启动本审批机器人
- NapCat 的 OneBot v11 WebSocket 配置详见下方说明

---

## 快速开始

```bash
cd afdian-qq-bot

:: 复制并填写配置
copy config.example.json config.json

:: 启动菜单
start.bat
```

也可以直接传参：

```bash
start.bat check <订单号>
start.bat bot <群号>
```

---

## 目录结构

```
afdian-qq-bot/
├── README.md               # 本文档
├── package.json             # 项目配置
├── start.bat                # 统一启动脚本（菜单 / 命令行）
├── config.example.json      # 配置模板
├── config.json              # 你的配置（需创建）
├── history.json             # 审批记录（自动生成）
│
├── src/                     # 整合版源码（推荐使用）
│   ├── ifdian.js            # 爱发电 API 核心模块
│   ├── cli.js               # 订单查询命令行
│   └── bot.js               # QQ 群审批机器人
│
├── cli/                     # 独立 CLI 工具（原 afdian-tool）
│   ├── ifdian.js
│   ├── cli.js
│   ├── config.json
│   └── package.json
│
├── robot/                   # 独立机器人（原 qq-bot）
│   ├── bot.js
│   ├── config.json
│   ├── history.json
│   └── package.json
│
└── node_modules/            # 依赖（npm install 自动安装）
```

> `src/` 是整合版，由 `start.bat` 统一管理。
> `cli/` 和 `robot/` 是迁移过来的独立版本，可以直接 `node cli/cli.js` 或 `node robot/bot.js` 单独运行。

---

## 配置

复制 `config.example.json` 为 `config.json`，填入：

| 字段 | 说明 | 获取位置 |
|------|------|----------|
| `ifdian.user_id` | 爱发电开发者 ID | [https://afdian.net/dashboard/dev](https://afdian.net/dashboard/dev) |
| `ifdian.token` | 爱发电 API Token | 同上 |
| `napcat.wsUrl` | NapCat WebSocket 地址 | 默认 `ws://localhost:3001` |

```json
{
  "ifdian": {
    "user_id": "47db5ff000fd11ecbc4752540025c377",
    "token": "Bjbw7Y9CAfKWkmexgatHps5UvduM8G6r"
  },
  "napcat": {
    "wsUrl": "ws://localhost:3001"
  }
}
```

---

## start.bat 启动脚本

| 命令 | 说明 |
|------|------|
| `start.bat` | 交互式菜单 |
| `start.bat check <订单号>` | 查询订单 |
| `start.bat bot <群号>` | 启动审批机器人 |
| `start.bat help` | 帮助 |

首次启动自动 `npm install`。

---

## 1. 订单查询

```bash
start.bat check 20260712140309100485413171
```

或直接用 node：

```bash
node src/cli.js <订单号> -c config.json
```

### 模块 API

```javascript
import { queryOrder } from './src/ifdian.js';

const result = await queryOrder(user_id, token, orderNo);
// result.exists  → true / false
// result.order   → 订单对象或 null
// result.raw    → API 原始响应
```

---

## 2. QQ 群审批机器人

监听加群请求，自动验证爱发电订单号并按规则审批。

### NapCat 配置

NapCat 需已登录并开启 OneBot v11 WebSocket：

```json
// config/onebot11_<QQ号>.json
{
  "network": {
    "websocketServers": [
      { "enable": true, "port": 3001, "token": "" }
    ]
  }
}
```

配置后重启 NapCat，日志显示：`WebSocket 服务器已启动: ws://0.0.0.0:3001`

WebUI 管理面板：[http://localhost:6099](http://localhost:6099)

### 启动

```bash
start.bat bot 123456789
```

### 首次启动

若 `history.json` 不存在，自动从爱发电拉取所有历史订单号写入记录，防止重复使用。

### 审批规则

| 条件 | 处理 |
|------|------|
| 该 QQ 已有审批记录 | 跳过，等人工 |
| 留言无数字串 | 拒绝：请填写订单号 |
| 订单存在且未用过 | **通过** |
| 订单存在但已用过 | 拒绝：已被使用 |
| 订单不存在 | 拒绝：不存在 |
| API 异常 | 拒绝：验证失败请重试 |

订单号提取：从留言中取第一串 ≥10 位的连续数字。

### 历史记录

```json
{
  "orderNo": "20260712140309100485413171",
  "userId": 12345678,
  "comment": "20260712140309100485413171",
  "timestamp": 1720960000000,
  "action": "approved"
}
```

| action | 含义 |
|--------|------|
| `approved` | 审批通过 |
| `rejected_used` | 单号已用 |
| `rejected_notfound` | 单号不存在 |
| `rejected_noid` | 未填单号 |
| `ignored_manual` | 用户已有记录，转人工 |
| `error` | API 异常 |
| `preloaded` | 启动时预加载的历史订单 |

---

## 调试

控制台会打印原始留言、提取结果和 API 响应：

```
原始留言: "20260712140309100485413171"
从留言中提取到订单号: 20260712140309100485413171
→ API 响应 ec=200, list=1 条
```

重置记录：删除 `history.json` 后重启。

---

## 常见问题

**NapCat WebSocket 连不上？**

检查 `config/onebot11_<QQ号>.json` 中 `websocketServers` 是否配置，NapCat 是否重启。

**显示"配置错误"？**

确认 `config.json` 在项目根目录且已填写正确的 `user_id` 和 `token`。

**如何重置已标记的单号？**

删 `history.json` 重启，自动重新拉取全量订单。

---

## 依赖

| 环境 | 版本 |
|------|------|
| Node.js | 18+ |
| npm 包 `ws` | 自动安装 |

---

*最后更新: 2026-07-14*

