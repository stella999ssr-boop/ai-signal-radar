/**
 * AI 信号雷达 — 推送脚本 v2.1（通用版）
 * 从 follow-builders 抄的：分片推送 + 内容去重 + 配置化
 * 无 feed 数据时优雅降级
 */

const axios = require("axios");
const fs = require("fs");
const path = require("path");
const os = require("os");

// ============================================================
// 配置化（抄 Config Schema）
// ============================================================
const CONFIG_PATH = path.join(__dirname, "..", "config", "push-config.json");

const DEFAULT_CONFIG = {
  wechat: {
    appId: process.env.WX_APPID || "YOUR_WX_APPID",
    appSecret: process.env.WX_APPSECRET || "YOUR_WX_APPSECRET",
  },
  digest: {
    maxBuilders: 8,
    tweetPreviewChars: 120,
    pushChunkSize: 1800,  // 微信客服消息上限 ~2048
  },
  feed: {
    skillDir: process.env.FOLLOW_BUILDERS_DIR || path.join(os.homedir(), ".claude", "skills", "follow-builders"),
  },
};

function loadConfig() {
  if (!fs.existsSync(CONFIG_PATH)) {
    const dir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2));
    return DEFAULT_CONFIG;
  }
  return { ...DEFAULT_CONFIG, ...JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8")) };
}

// ============================================================
// 数据文件加载（带降级）
// ============================================================
const DATA_DIR = path.join(__dirname, "..", "data");

function loadFeedJSON(filename, skillDir) {
  // 优先读 follow-builders 实时数据
  const livePath = path.join(skillDir, filename);
  if (fs.existsSync(livePath)) {
    return JSON.parse(fs.readFileSync(livePath, "utf-8"));
  }
  // 降级：读项目自带示例数据
  const fallbackPath = path.join(DATA_DIR, filename);
  if (fs.existsSync(fallbackPath)) {
    console.log(`[推送 v2] ⚠️ 使用项目自带示例数据（${filename}），可能不是最新内容`);
    return JSON.parse(fs.readFileSync(fallbackPath, "utf-8"));
  }
  return null;
}

// ============================================================
// 内容去重（抄 state-feed.json）
// ============================================================
const STATE_PATH = path.join(__dirname, "..", "data", "push-state.json");

function loadState() {
  if (!fs.existsSync(STATE_PATH)) return { seenPodcasts: {}, seenTweets: {}, lastPushes: [] };
  return JSON.parse(fs.readFileSync(STATE_PATH, "utf-8"));
}

function saveState(state) {
  const dir = path.dirname(STATE_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  // 7 天自动清理
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  for (const [id, ts] of Object.entries(state.seenTweets)) {
    if (ts < cutoff) delete state.seenTweets[id];
  }
  for (const [id, ts] of Object.entries(state.seenPodcasts)) {
    if (ts < cutoff) delete state.seenPodcasts[id];
  }

  // 只保留最近 30 条推送历史
  state.lastPushes = (state.lastPushes || []).slice(-30);

  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2));
}

function isNewTweet(state, tweetId) {
  return !state.seenTweets[tweetId];
}

function markTweetSeen(state, tweetId) {
  state.seenTweets[tweetId] = Date.now();
}

function isNewPodcast(state, guid) {
  return !state.seenPodcasts[guid];
}

function markPodcastSeen(state, guid) {
  state.seenPodcasts[guid] = Date.now();
}

// ============================================================
// 分片推送（抄 deliver.js）
// ============================================================
async function sendChunked(accessToken, openid, text, chunkSize) {
  const chunks = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= chunkSize) {
      chunks.push(remaining);
      break;
    }
    let splitAt = remaining.lastIndexOf("\n", chunkSize);
    if (splitAt < chunkSize * 0.5) splitAt = chunkSize;
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt);
  }

  const results = [];
  for (let i = 0; i < chunks.length; i++) {
    const prefix = chunks.length > 1 ? `(${i + 1}/${chunks.length})\n` : "";
    const content = prefix + chunks[i];

    // 3 次重试（抄 X API 重试机制）
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const r = await axios.post(
          `https://api.weixin.qq.com/cgi-bin/message/custom/send?access_token=${accessToken}`,
          { touser: openid, msgtype: "text", text: { content } },
          { timeout: 5000 }
        );
        results.push({ chunk: i + 1, ok: r.data.errcode === 0, msg: r.data.errmsg });
        break;
      } catch (err) {
        if (attempt === 2) {
          results.push({ chunk: i + 1, ok: false, msg: err.message });
        }
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    // 分片间隔
    if (chunks.length > 1) await new Promise((r) => setTimeout(r, 500));
  }

  return results;
}

// ============================================================
// 生成 Digest
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

function digestFromFeed(config) {
  const feedX = loadFeedJSON("feed-x.json", config.feed.skillDir);
  const feedPod = loadFeedJSON("feed-podcasts.json", config.feed.skillDir);

  // 无数据：友好提示
  if (!feedX && !feedPod) {
    console.log("[推送 v2] ⚠️ 未找到 feed 数据");
    console.log("[推送 v2] 请先安装数据源：");
    console.log("  git clone https://github.com/zarazhangrui/follow-builders.git ~/.claude/skills/follow-builders");
    console.log("  cd ~/.claude/skills/follow-builders && git pull");
    return { text: null, state: null };
  }

  const state = loadState();

  const active = (feedX?.x || [])
    .filter((b) => b.tweets?.length > 0)
    .sort((a, b) => {
      const am = Math.max(...(a.tweets || []).map((t) => t.likes || 0), 0);
      const bm = Math.max(...(b.tweets || []).map((t) => t.likes || 0), 0);
      return bm - am;
    });

  // 去重：过滤已推送的播客
  const newPodcast = feedPod?.podcasts?.find((p) => isNewPodcast(state, p.guid));

  // 去重：只展示有新推文的建造者
  const newBuilders = active.filter((b) =>
    b.tweets.some((t) => isNewTweet(state, t.id))
  );

  if (newBuilders.length === 0 && !newPodcast) return { text: null, state };

  const lines = [];
  const now = new Date();
  const dateStr = now.toLocaleDateString("zh-CN", {
    month: "long", day: "numeric", weekday: "long",
  });
  lines.push(`📡 AI 建造者动态 · ${dateStr} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`);
  lines.push("");

  // 播客
  if (newPodcast) {
    lines.push(`🎙 ${newPodcast.name} — ${newPodcast.title}`);
    lines.push(`   🔗 ${newPodcast.url}`);
    lines.push("");
    markPodcastSeen(state, newPodcast.guid);
  }

  // 建造者
  const showBuilders = newBuilders.slice(0, config.digest.maxBuilders);
  if (showBuilders.length > 0) {
    lines.push(`💬 ${showBuilders.length} 位建造者有新动态`);
    if (newBuilders.length > config.digest.maxBuilders) {
      lines.push(`   （共 ${newBuilders.length} 位，显示前 ${config.digest.maxBuilders} 位）`);
    }
    lines.push("");

    showBuilders.forEach((b, i) => {
      const role = BUILDER_ROLES[b.handle] || (b.bio || "").split("\n")[0];
      const newTweets = b.tweets.filter((t) => isNewTweet(state, t.id));
      lines.push(`${i + 1}. ${b.name}（${role}）${newTweets.length > 1 ? ` — ${newTweets.length}条` : ""}`);

      // 显示最新推文预览
      const topT = newTweets[0];
      if (topT) {
        const preview = topT.text.substring(0, config.digest.tweetPreviewChars);
        lines.push(`   "${preview}..."`);
        lines.push(`   ❤️ ${topT.likes || 0} | 🔗 ${topT.url}`);
      }
      lines.push("");

      // 标记所有新推文
      newTweets.forEach((t) => markTweetSeen(state, t.id));
    });
  }

  const xCount = feedX?.x?.length || 0;
  const podCount = feedPod?.podcasts?.length || 0;

  lines.push("━━━━━━━━");
  lines.push(`📊 ${xCount} 位建造者 · ${podCount} 期播客 · ${state.lastPushes.length + 1} 轮推送`);

  return { text: lines.join("\n"), state };
}

// ============================================================
// 主流程
// ============================================================
async function main() {
  console.log("[推送 v2] 开始...");

  // 1. 加载配置
  const config = loadConfig();
  console.log("[推送 v2] 配置已加载");

  // 2. 生成 Digest（带去重）
  let digest, state;
  try {
    const result = digestFromFeed(config);
    digest = result.text;
    state = result.state;
  } catch (err) {
    console.error("[推送 v2] Digest 生成失败:", err.message);
    return;
  }

  if (!digest) {
    console.log("[推送 v2] 无新内容，跳过推送");
    return;
  }

  if (!state) {
    console.log("[推送 v2] 无可用数据源，跳过推送");
    console.log("[推送 v2] 💡 提示：安装 follow-builders 后可获取实时数据");
    return;
  }

  console.log("[推送 v2] Digest 已生成，长度:", digest.length);

  // 3. 获取微信 access_token
  let accessToken;
  try {
    const t = await axios.get(
      `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${config.wechat.appId}&secret=${config.wechat.appSecret}`,
      { timeout: 10000 }
    );
    accessToken = t.data.access_token;
    if (!accessToken) throw new Error(JSON.stringify(t.data));
  } catch (err) {
    console.error("[推送 v2] 获取 access_token 失败:", err.message);
    return;
  }

  // 4. 获取关注者
  let followers;
  try {
    const u = await axios.get(`https://api.weixin.qq.com/cgi-bin/user/get?access_token=${accessToken}`);
    followers = u.data.data?.openid || [];
  } catch (err) {
    console.error("[推送 v2] 获取关注者失败:", err.message);
    return;
  }

  if (followers.length === 0) {
    console.log("[推送 v2] 无关注者");
    return;
  }

  // 5. 分片推送 + 重试
  for (const openid of followers) {
    const results = await sendChunked(accessToken, openid, digest, config.digest.pushChunkSize);
    const ok = results.filter((r) => r.ok).length;
    const fail = results.filter((r) => !r.ok).length;
    console.log(`[推送 v2] ${openid}: ${ok}/${results.length} 成功${fail > 0 ? ` ${fail} 失败` : ""}`);

    // 记录 45015（48h 限制）并告警
    const limitHit = results.find((r) => r.msg?.includes("out of time limit"));
    if (limitHit) {
      console.log("[推送 v2] ⚠️ 48小时未互动，推送被拒");
    }
  }

  // 6. 保存去重状态
  state.lastPushes.push({
    time: new Date().toISOString(),
    digestLength: digest.length,
    followers: followers.length,
    contentStart: digest.substring(0, 100),
  });
  saveState(state);

  console.log("[推送 v2] ✅ 完成");
}

main().catch(console.error);
