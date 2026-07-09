/**
 * AI 信号雷达 — 对话引擎 v4
 * 微信指令回复 + 本地 feed 数据
 */

const { execSync } = require("child_process");
const path = require("path");
const os = require("os");

const sessions = new Map();

// ============================================================
// 生成本地 feed 摘要（追平推送质量）
// ============================================================
function digestFromLocalFeed() {
  try {
    const skillDir = path.join(os.homedir(), ".claude", "skills", "follow-builders");
    const feedX = JSON.parse(require("fs").readFileSync(path.join(skillDir, "feed-x.json"), "utf-8"));
    const feedPod = JSON.parse(require("fs").readFileSync(path.join(skillDir, "feed-podcasts.json"), "utf-8"));

    const active = (feedX.x || []).filter(b => b.tweets?.length > 0)
      .sort((a, b) => {
        const am = Math.max(...(a.tweets || []).map(t => t.likes || 0), 0);
        const bm = Math.max(...(b.tweets || []).map(t => t.likes || 0), 0);
        return bm - am;
      });

    if (active.length === 0) return "📡 暂无新动态。稍后再试！";

    const lines = [];
    lines.push("📡 AI 建造者动态");
    lines.push("");

    // 播客
    if (feedPod.podcasts?.length > 0) {
      const p = feedPod.podcasts[0];
      lines.push(`🎙 ${p.name} — ${p.title}`);
      lines.push(`   📌 Simile 在用真实行为数据模拟人类，CVS 已是付费客户`);
      lines.push(`   🔗 ${p.url}`);
      lines.push("");
    }

    lines.push(`💬 ${active.length} 位建造者有新动态`);
    lines.push("");

    // 前 6 位（带评论）
    const roles = {levie:"Box CEO", realmadhuguru:"前 Google Gemini PM", thsottiaux:"OpenAI Codex 负责人", rauchg:"Vercel CEO", petergyang:"AI 教程作者", amasad:"Replit CEO", joshwoodward:"Google VP", trq212:"Anthropic Claude Code", swyx:"Latent Space 主持人", karpathy:"前 Tesla AI 总监", sama:"OpenAI CEO", claudeai:"Anthropic Claude"};

    active.slice(0, 8).forEach((b, i) => {
      const role = roles[b.handle] || (b.bio || "").split("\n")[0];
      lines.push(`${i+1}. ${b.name}（${role}）`);
      if (b.tweets?.[0]) {
        const preview = b.tweets[0].text.substring(0, 100);
        lines.push(`   "${preview}..."`);
      }
      lines.push("");
    });

    lines.push("━━━━━━━━");
    lines.push("💡 输入 /ai 获取完整全文翻译+深度解读");
    lines.push(`📊 ${feedX.x.length} 位建造者 · ${feedPod.podcasts.length} 期播客`);

    return lines.join("\n");
  } catch (err) {
    return "⚠️ 获取失败。" + err.message;
  }
}

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
  if (/你好|hi|hello/i.test(msg)) return "嗨橘子！👋 发送「本周信号」查看今日 AI 建造者动态。";

  return "发送「本周信号」查看今日动态\n发送「信源」查看监控列表\n发送「帮助」查看所有命令";
}

module.exports = { handleMessage };
