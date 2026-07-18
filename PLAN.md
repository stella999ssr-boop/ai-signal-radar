# AI 信号雷达 — 产品计划书

## 背景与问题

AI 信息消费领域存在一个"三难"困境：

**信息过载，信号稀缺。** 每天数百条 AI 相关推送涌入，但真正值得读的一手信源不超过 30 个。当前的主流方案——RSS 聚合、热搜榜单、公众号搬运——都在解决"更多"的问题，而不是"更准"的问题。

**语言壁垒拉高了消费门槛。** 一线 AI 建造者以英文输出为主——Karpathy 的推文、Latent Space 的播客、Anthropic 的工程博客——中文读者需要自行翻译、筛选、判断优先级。这不是技术问题，是注意力分配问题：用户真正缺的不是翻译工具，而是一个帮他们做判断的人。

**获取路径碎片化，缺乏被动消费场景。** 推文在 X，播客在 YouTube，博客在各家官网。每种渠道都要求用户主动打开、主动刷新。但「跟上 AI 前沿」不是一个需要用户专门留时间做的任务——它应该像看天气预报一样，自然融入日常。

## 产品目标

让用户每天花 3 分钟，在微信里读完一条消息，就能知道 AI 圈今天发生了什么。

不做聚合器、不做热搜、不做"AI 新闻"。做一份有判断力的日报。

## 设计原则

1. **跟踪建造者，而非网红。** 只看实际在做 AI 的人的第一手输出。信源质量比数量重要一百倍。
2. **微信是唯一入口。** 不做 Web，不做 App。用户已经在刷微信了，多一条消息的成本为零。
3. **AI 做减法，不做加法。** 30 条推文扔给用户不是产品的终点——帮用户筛到 5 条值得看的，每条配上判断，才是。
4. **被动推送 + 主动查询。** 每天定时推送是默认行为，用户也可以随时查询。两种模式共用同一套链路。

## 信源体系

追踪 33 个全球 AI 信源，由 [follow-builders](https://github.com/zarazhangrui/follow-builders) 维护：

- **25 位 X/Twitter 建造者**：Karpathy（前 Tesla AI 总监）、Sam Altman（OpenAI CEO）、Amjad Masad（Replit CEO）、Guillermo Rauch（Vercel CEO）、Aaron Levie（Box CEO）、Garry Tan（YC CEO）、Josh Woodward（Google VP · Gemini）、Thibault Sottiaux（OpenAI Codex）、Madhu Guru（前 Google Gemini PM）、Thariq（Anthropic Claude Code）、Alex Albert（Anthropic 开发者关系）、Amanda Askell（Anthropic 对齐研究）、Swyx（Latent Space）、Matt Turck（FirstMark VC）、Dan Shipper（Every CEO）、Ryo Lu（Cursor 设计师）、Peter Yang（AI 教程作者）等
- **6 个播客**：Latent Space、No Priors、Training Data、Unsupervised Learning、The MAD Podcast、AI & I
- **2 个官方博客**：Anthropic Engineering Blog、Claude Blog

不抓微信公众号。早期曾计划做 32 个公众号的抓取，经技术评估后确认不可行且不符合"跟踪建造者"原则，已放弃。

## 产品链路

整个系统围绕一个核心流程设计——**用户每天打开微信，花 3 分钟读完一条消息，就能跟上 AI 前沿。**

### 第一步：数据采集（自动化，用户无感）

每天定时从 33 个信源拉取最新内容（推文、播客转录、博客全文），存入本地缓存。内容去重基于唯一 ID，7 天自动清理历史记录，保证推送不重复。

### 第二步：AI 策展（判断性工作，不是翻译工作）

AI 做三件事：

1. **翻译**：英文→中文，技术术语保留原文（如 "RLHF""KV Cache"），保证行业读者不丢信息
2. **评分与筛选**：按新颖性（25%）、影响力（30%）、可执行性（15%）、争议性（20%）、持续性（10%）五个维度打分，筛掉噪声
3. **输出判断**：每条信号配一句话判断——"这条为什么值得注意"——而不是纯摘要

最终格式：一句话重点前置 + 全文翻译折叠。用户第一眼只看到结论，感兴趣再展开。这个折叠设计不是技术选择，是对阅读行为的观察：好的策展是在帮用户决策「要不要读」，而不是帮用户读书。

### 第三步：微信分发（零门槛触达）

选择微信服务号作为唯一入口的原因：

- 不需要用户安装新 App
- 不需要用户记住打开网页
- 微信已经在用户的日常场景里，多一条消息的行为成本为零

推送从 Claude Code 通过 `/ai` 命令生成策展内容，由 Node.js 脚本读取本地 feed 文件，调用微信客服消息 API 推送到所有关注者。

### 第四步：按需查询（被动 + 主动双模式）

除了每日定时推送，用户可以在微信内发送「本周信号」主动获取当日动态。两种模式共用同一套数据和推送逻辑。

## 架构设计

```
信源层（follow-builders）
    ↓ feed JSON 文件（本地缓存 + 容灾降级）
AI 策展层（Claude Code）
    ↓ 翻译 + 评分 + 判断
分发层（Node.js + 微信 API）
    ↓ 分片推送 + 3 次重试 + 7 天去重
用户（微信聊天框）
```

## 技术选型与关键决策

| 决策 | 选择 | 原因 |
|------|------|------|
| 微信服务端 | Node.js 原生 http 模块 | 发现 Express 5 的 `express.text()` 中间件与 XML 流解析互斥，切原生方案 |
| 内网穿透 | Cloudflare Tunnel | 免费，无需注册，相比 ngrok/localtunnel 更稳定 |
| CF Tunnel 协议 | HTTP2（非默认 QUIC） | QUIC 协议（UDP）在国内丢包超 70%，`--protocol http2` 修复 |
| 推送分片 | 按换行符在 1800 字符处分片 | 微信客服消息上限 ~2048 字节，保留余量避免截断 |
| 内容去重 | 本地 JSON 状态文件 + 7 天 TTL | 参考 follow-builders 的 state-feed.json 设计，跨运行不重复 |
| Prompt 迭代 | 三版：纯摘要→全文前置→摘要前置折叠 | 每版基于真实阅读反馈调整，非一次性设计 |

## 迭代历程

| 版本 | 时间 | 核心变化 |
|------|------|----------|
| v1 | 2026-06 | 搭建微信服务器 + Cloudflare Tunnel 内网穿透，跑通微信回复链路 |
| v2 | 2026-06 | 引入 follow-builders 信源，实现 `/ai` 命令生成中文 Digest |
| v3 | 2026-06 | 实现推送脚本 `push-daily.js`，支持定时 + 分片 + 去重 |
| v4 | 2026-07 | 通用化改造：去个性化、自带示例数据、优雅降级、开源准备 |
| v4.1 | 2026-07 | README 完善 + 截图 + 简历化描述 + 计划文档 |

## 后续方向

- 多用户管理（当前仅支持单测试号）
- 服务号认证（突破 48 小时推送限制）
- 历史信号检索（"上周 Karpathy 说了什么"）
- 信号趋势分析（"本周热议话题 Top 3"）

## 参考与致谢

- [follow-builders](https://github.com/zarazhangrui/follow-builders) — 信源层，"Follow Builders, Not Influencers"
- [hex2077.dev](https://hex2077.dev) — 何夕 2077，"信息分层 + 交叉验证 + 深度观点"策展模式
- [AIHOT](https://aihot.virxact.com) — 169 信源 + DeepSeek 评分，全自动策展参考
