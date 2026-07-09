/**
 * AI 信号雷达 — 对话引擎 v4.1（通用版）
 * 微信指令回复 + 本地 feed 数据
 * 无 feed 数据时优雅降级，不崩溃
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

const sessions = new Map();

// ============================================================
// 数据文件路径
// ============================================================
const SKILL_DIR = process.env.FOLLOW_BUILDERS_DIR || path.join(os.homedir(), ".claude", "skills", "follow-builders");
const DATA_DIR = path.join(__dirname, "..", "data");

// 优先读 follow-builders 的实时数据，没有则读项目自带的示例数据
function loadFeed(filename) {
  const livePath = path.join(SKILL_DIR, filename);
  const fallbackPath = path.join(DATA_DIR, filename);

  for (const p of [livePath, fallbackPath]) {
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, "utf-8"));
    }
  }
  return null;
}

// ============================================================
// 建造者角色说明
// ============================================================
const BUILDER_ROLES = {
  karpathy: "前 Tesla AI 总监",
  swyx: "Latent Space 主持人",
  joshwoodward: "Google VP · Gemini App",
  thsottiaux: "OpenAI Codex 负责人",
  petergyang: "AI 教程作者",
  realmadhuguru: "前 Google Gemini PM",
  trq212: "Anthropic Claude Code",
  amasad: "Replit CEO",
  rauchg: "Vercel CEO",
  alexalbert__: "Anthropic 开发者关系",
  levie: "Box CEO",
  ryolu_: "Cursor 设计师",
  garrytan: "Y Combinator CEO",
  mattturck: "FirstMark 投资人",
  danshipper: "Every 联合创始人",
  nikunj: "AI 工程师",
  steipete: "PSPDFKit 创始人",
  adityaag: "South Park Commons",
  sama: "OpenAI CEO",
  claudeai: "Anthropic Claude 官方",
  GoogleLabs: "Google Labs",
  bcherny: "AI 研究员",
  AmandaAskell: "Anthropic 对齐研究员",
  _catwu: "AI 产品设计师",
  zarazhangrui: "Follow Builders 作者",
};

// ============================================================
// 生成本地 feed 摘要
// ============================================================
function digestFromLocalFeed() {
  const feedX = loadFeed("feed-x.json");
  const feedPod = loadFeed("feed-podcasts.json");

  // 无数据时友好提示
  if (!feedX && !feedPod) {
    return `📡 暂无数据

请先安装数据源：
  1. git clone https://github.com/zarazhangrui/follow-builders.git \\
       ~/.claude/skills/follow-builders
  2. cd ~/.claude/skills/follow-builders && git pull

或直接将 feed-x.json / feed-podcasts.json 放入项目的 data/ 目录。`;
  }

  const active = (feedX?.x || []).filter(b => b.tweets?.length > 0)
    .sort((a, b) => {
      const am = Math.max(...(a.tweets || []).map(t => t.likes || 0), 0);
      const bm = Math.max(...(b.tweets || []).map(t => t.likes || 0), 0);
      return bm - am;
    });

  const podcasts = feedPod?.podcasts || [];

  if (active.length === 0 && podcasts.length === 0) {
    return "📡 暂无新动态。稍后再试！";
  }

  const lines = [];
  lines.push("📡 AI 建造者动态");
  lines.push("");

  // 播客
  if (podcasts.length > 0) {
    const p = podcasts[0];
    lines.push(`🎙 ${p.name} — ${p.title}`);
    lines.push(`   🔗 ${p.url}`);
    lines.push("");
  }

  if (active.length > 0) {
    lines.push(`💬 ${active.length} 位建造者有新动态`);
    lines.push("");

    active.slice(0, 8).forEach((b, i) => {
      const role = BUILDER_ROLES[b.handle] || (b.bio || "").split("\n")[0];
      lines.push(`${i + 1}. ${b.name}（${role}）`);
      if (b.tweets?.[0]) {
        const preview = b.tweets[0].text.substring(0, 100);
        lines.push(`   "${preview}..."`);
      }
      lines.push("");
    });
  }

  const xCount = feedX?.x?.length || 0;
  const podCount = podcasts.length;

  lines.push("━━━━━━━━");
  lines.push("💡 发送 /ai 获取完整全文翻译+深度解读（需 Claude Code）");
  if (xCount > 0) lines.push(`📊 ${xCount} 位建造者 · ${podCount} 期播客`);

  return lines.join("\n");
}

// ============================================================
// 对话路由
// ============================================================
function getHelpMessage() {
  return `🤖 AI 信号雷达 — 指令

📡 本周信号 — 今日 AI 建造者动态
📊 信源 — 监控的信源总览
❓ 帮助 — 此菜单`;
}

function getSourceList() {
  return `📡 追踪 26 位 AI 建造者 + 6 个播客 + 2 个博客

💬 建造者：Karpathy、Sam Altman、Amanda Askell、Alex Albert、Guillermo Rauch、Amjad Masad、Aaron Levie、Swyx、Dan Shipper 等

🎙 播客：Latent Space、No Priors、Training Data、Unsupervised Learning、The MAD Podcast、AI & I

📝 博客：Anthropic Engineering、Claude Blog`;
}

async function handleMessage(text, userId) {
  const msg = text.trim();
  if (!sessions.has(userId)) sessions.set(userId, {});

  if (/本周信号|周报|信号/i.test(msg)) return digestFromLocalFeed();
  if (/信源|source/i.test(msg)) return getSourceList();
  if (/帮助|help|菜单/i.test(msg)) return getHelpMessage();
  if (/你好|hi|hello/i.test(msg)) return "嗨！👋 发送「本周信号」查看今日 AI 建造者动态。";

  return "发送「本周信号」查看今日动态\n发送「信源」查看监控列表\n发送「帮助」查看所有命令";
}

module.exports = { handleMessage };
