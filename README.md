# AI 信号雷达 Agent — 简历项目描述（开发者视角）

## 项目简介

AI 原生的信息策展 Agent 系统。自动监控 28 个全球 AI 核心信源，通过 Claude AI 完成英中翻译、5 维评分、跨源聚类与观点提炼，最终通过微信服务号每日自动推送。从"每天刷 2 小时"变为"3 分钟读完关键信号"。

---

## 技术栈

Node.js · Claude Code Skill · OpenAI API · Cloudflare Tunnel · Windows Task Scheduler · xml2js · axios · RSS Parser

---

## 个人职责与产出

**架构设计与技术选型**
- 调研 hex2077.dev、AIHOT、PrismFlowAgent 等开源项目，拆解其「信源分级 + 交叉验证 + 深度观点」策展方法论
- 设计三层架构：信源层（本地 Feed 缓存 + 远端容灾降级）→ 策展引擎（Claude AI 翻译/评分/聚类）→ 推送层（微信 API）
- 对比 Express 5 与 Node.js 原生 http 模块，最终选择原生方案避免 XML body 解析冲突

**核心引擎开发**
- 基于 Node.js 原生 http 模块构建微信消息服务器：手写 XML 解析/构建器、SHA1 签名校验、5 秒内响应保证
- 设计 5 维度信号评分算法（新颖性 25%/影响力 30%/可执行性 15%/争议性 20%/持续性 10%）× 信源权重（T1=3.0/T4=1.5）
- 设计 Prompt 工程三版迭代：纯摘要 → 全文翻译前置 → 摘要前置 + 折叠全文，提升信息获取效率
- 实现本地 Feed 缓存 + 远程 fetchJSON 容灾降级：GitHub Raw 在国内不可达时自动切换本地文件

**网络与部署**
- 突破 Cloudflare Tunnel 的 QUIC 协议在国内丢包率 70%+ 的问题，通过 `--protocol http2` 强制降级实现稳定穿透
- 搭建 Windows Task Scheduler + Claude Code cron 双备份定时调度
- 解决 WeChat API 客服消息 48 小时限制问题：封装 `push-daily.js` 脚本处理 45015 错误码

---

## 收获

- 掌握了从 npm 包 API 到 XML 协议的 JSON 格式的人工智能研发的全栈能力
- 积累了 AI Agent 的产品设计经验：信息分层、提示词工程、信源权重算法
- 深入理解了微信服务号的接口体系和服务端核心

---

## 项目难点（面试可展开）

| 难点 | 解决方案 |
|------|----------|
| Express 5 body 解析为空 | 发现 Express 5 `express.text()` 与手动 stream 读取互斥，切原生 http 直接操作 stream |
| Cloudflare Tunnel 不稳定 | QUIC→HTTP2 协议降级，稳定性从 30% 提升至 99%+ |
| 微信推送 48 小时限制 | 封装错误码判断逻辑，45015 拒绝时自动跳过 |
| npm 包废弃链 | agent-reach deprecated → openclaw-agent-reach 404 → 转向中心化 Feed 方案 |
| 公众号自动抓取不可行 | 评估 we-mp-rss/agent-reach/RSSHub 三方案后，调整为 X/Twitter + 播客的全球化信源组合 |
