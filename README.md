# AI 信号雷达 (AI Signal Radar)

每天 3 分钟，看懂 AI 圈真正重要的事。

一个全自动的 AI 信息策展 Agent。监控 28 个全球顶级 AI 信源（X/Twitter 建造者、播客、官方博客），自动完成**抓取 → 翻译 → 评分 → 聚类 → 观点提炼**全链路，最终通过**微信服务号**每日推送精品中英双语 Digest。

---

## 它能做什么

| 功能 | 说明 |
|------|------|
| 📡 **自动监控** | 追踪 26 位 AI 建造者 + 6 个顶级播客 + 2 个官方博客 |
| 🌐 **全文翻译** | 英→中全文翻译，技术术语保留原文 |
| 🧠 **智能策展** | 5 维评分 × 信源权重，自动区分重要信号与噪声 |
| 📱 **微信推送** | 每日定时推送到微信，支持分片、重试、去重 |
| 💬 **对话交互** | 微信内发送指令，实时获取动态 |

---

## 快速开始

### 前置条件

1. [微信测试号](https://mp.weixin.qq.com/debug/cgi-bin/sandbox?t=sandbox/login) — 30 秒扫码获取
2. [follow-builders Skill](https://github.com/zarazhangrui/follow-builders) — 信源层
3. [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) — 内网穿透（可选，仅对话交互需要）

### 安装

```bash
# 1. 克隆项目
git clone https://github.com/stella999ssr-boop/ai-signal-radar.git
cd ai-signal-radar

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env，填入微信测试号的 AppID、AppSecret、Token

# 4. 安装信源层
git clone https://github.com/zarazhangrui/follow-builders.git \
  ~/.claude/skills/follow-builders
cd ~/.claude/skills/follow-builders/scripts && npm install
```

### 使用

**方式一：微信消息回复（需要启动服务器）**

```bash
# 终端 1 — 启动微信服务器
node worker/index.js

# 终端 2 — 启动内网穿透
cloudflared tunnel --url http://localhost:8787 --protocol http2
```

将隧道 URL 填入微信测试号的接口配置，即可在微信内交互。

**方式二：微信主动推送（无需服务器）**

```bash
# 手动推送一次
node scripts/push-daily.js

# Windows 定时任务（每天 8:00 自动）
schtasks /Create /SC DAILY /TN "AI_Signal_Radar" \
  /TR "cmd /c cd /d C:\path\to\ai-signal-radar && node scripts/push-daily.js" \
  /ST 08:00
```

**方式三：Claude Code 内查看（最完整）**

在 Claude Code 中输入 `/ai`，获取全文翻译 + 观点提炼的完整版 Digest。

---

## 项目结构

```
ai-signal-radar/
├── worker/                     # 微信消息服务器
│   ├── index.js                #   Node.js 原生 http — XML 解析 + SHA1 签名
│   └── reply.js                #   对话引擎 — 消息路由
├── scripts/
│   └── push-daily.js           # 微信推送 — 分片 + 重试 + 去重
├── curation/
│   └── weekly.js               # 策展引擎 — 5 维评分 + 聚类
├── config/
│   └── sources.yaml            # 信源配置 — 32 个公众号分级权重
├── prompts/
│   └── curation-prompt.md      # AI 策展 Prompt — 200 行评分维度定义
├── .env.example                # 环境变量模板
├── .github/workflows/
│   └── gitguardian.yml         # 自动脱敏扫描
└── package.json
```

## 架构

```
┌──────────────┐    ┌──────────────┐    ┌─────────────┐
│  信源层       │ →  │  AI 策展层    │ →  │  推送层      │
│  follow-      │    │  Claude      │    │  WeChat API  │
│  builders     │    │  翻译+评分    │    │  分片+重试    │
│  28 信源      │    │  +观点提炼    │    │  +去重       │
└──────────────┘    └──────────────┘    └─────────────┘
       ↓                   ↓                   ↓
  本地 Feed 缓存      5 维评分算法         微信测试号
  + 远端容灾降级      + Prompt 工程        + CF Tunnel
```

## 技术亮点

- **Express 5 → Node.js 原生 http**：发现 Express 5 的 `express.text()` 中间件与 XML 流解析互斥，切原生方案解决
- **QUIC → HTTP2 协议降级**：Cloudflare Tunnel 默认 QUIC 在国内丢包 70%+，`--protocol http2` 修复
- **WeChat API 分片推送**：参考 deliver.js 实现按换行分片 + 3 次重试，突破微信单条字数限制
- **内容去重**：参考 state-feed.json 设计 `push-state.json`，7 天自动清理，跨运行不重复推送
- **Prompt 三版迭代**：纯摘要 → 全文前置 → 摘要前置折叠，用户第一眼抓住重点

## 参考项目

- [hex2077.dev](https://hex2077.dev) — 何夕 2077 AI 信号周刊，"信息分层 + 交叉验证 + 深度观点"策展模式
- [follow-builders](https://github.com/zarazhangrui/follow-builders) — 信源层，GitHub Actions 自动生成 Feed
- [PrismFlowAgent](https://github.com/justlovemaki/PrismFlowAgent) — Fastify + LangChain + SQLite 技术栈参考
- [AIHOT](https://aihot.virxact.com) — 168 信源 + DeepSeek 评分，全自动策展

## License

MIT
