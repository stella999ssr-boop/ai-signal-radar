/**
 * AI 信号雷达 — 策展引擎
 * 评分 → 聚类 → 周报生成
 */

const fs = require("fs");
const path = require("path");

// ============================================================
// 文章池管理
// ============================================================
const DATA_DIR = path.join(__dirname, "..", "data");
const ARTICLES_FILE = path.join(DATA_DIR, "articles.json");

function loadArticles() {
  if (!fs.existsSync(ARTICLES_FILE)) return [];
  return JSON.parse(fs.readFileSync(ARTICLES_FILE, "utf-8"));
}

function saveArticles(articles) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(ARTICLES_FILE, JSON.stringify(articles, null, 2), "utf-8");
}

/**
 * 去重：计算两篇文章标题的相似度（简单的 Jaccard 相似度）
 */
function titleSimilarity(a, b) {
  const setA = new Set(a.split(""));
  const setB = new Set(b.split(""));
  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
}

/**
 * 添加文章到文章池，自动去重
 */
function addArticles(newArticles) {
  const pool = loadArticles();
  let added = 0;

  for (const article of newArticles) {
    const isDuplicate = pool.some(
      (existing) => titleSimilarity(existing.title, article.title) > 0.75
    );
    if (!isDuplicate) {
      pool.push({ ...article, fetchedAt: new Date().toISOString() });
      added++;
    }
  }

  saveArticles(pool);
  return { total: pool.length, added };
}

// ============================================================
// AI 评分引擎
// ============================================================
const SCORING_CONFIG = {
  dimensions: {
    novelty: { weight: 0.25 },
    impact: { weight: 0.3 },
    actionability: { weight: 0.15 },
    controversy: { weight: 0.2 },
    persistence: { weight: 0.1 },
  },
  tierWeights: {
    T1: 3.0, T2: 2.5, T3: 2.0, T4: 1.5,
  },
  thresholds: {
    alert: 80,  // ≥80 且跨源≥3 → 警报
    daily: 60,  // ≥60 → 日报精选
  },
  crossSourceMin: 3,
};

/**
 * 计算信号分 = 五维度加权分 × 信源权重
 * MVP 阶段使用启发式评分（后续接入 AI）
 */
function scoreArticle(article) {
  // 启发式评分（替代 AI，用于 MVP 快速验证）
  const heuristics = {
    novelty: scoreNovelty(article),
    impact: scoreImpact(article),
    actionability: scoreActionability(article),
    controversy: scoreControversy(article),
    persistence: scorePersistence(article),
  };

  const dims = SCORING_CONFIG.dimensions;
  let weightedScore = 0;
  for (const [dim, config] of Object.entries(dims)) {
    weightedScore += heuristics[dim] * config.weight * 20; // 转 0-5 → 0-100
  }

  const tierWeight = SCORING_CONFIG.tierWeights[article.sourceTier] || 1.5;
  const finalScore = Math.round(weightedScore * (tierWeight / 2.5)); // 归一化

  return {
    ...article,
    scores: heuristics,
    weightedScore,
    tierWeight,
    finalScore,
  };
}

// ---- 启发式评分函数（MVP 阶段）----

function scoreNovelty(article) {
  // 基于关键词判断新颖性
  const hotKeywords = /首次|发布|开源|突破|封禁|安全|攻击|越狱|新模型|GPT|Claude|Gemini|Llama/i;
  const matchCount = (article.title + article.summary).match(hotKeywords)?.length || 0;
  return Math.min(5, 2 + matchCount * 0.5);
}

function scoreImpact(article) {
  const highImpact = /格局|行业|万亿|收购|上市|裁员|政策|禁止|管制|所有|全部/i;
  return highImpact.test(article.title + article.summary) ? 4 : 2.5;
}

function scoreActionability(article) {
  const actionable = /工具|教程|开源|API|实操|部署|配置|安装|使用/i;
  const matchCount = (article.title + article.summary).match(actionable)?.length || 0;
  return Math.min(5, 2 + matchCount * 0.5);
}

function scoreControversy(article) {
  const controversial = /争议|争议|批评|质疑|封禁|禁止|漏洞|攻击|欺骗|幻觉|造假/i;
  return controversial.test(article.title + article.summary) ? 4 : 2;
}

function scorePersistence(article) {
  const persistent = /趋势|时代|转折|拐点|格局|范式|元年|变革/i;
  return persistent.test(article.title + article.summary) ? 4 : 2;
}

// ============================================================
// 聚类：按话题合并相同事件
// ============================================================
function clusterByTopic(articles) {
  // MVP 简化版：按共享关键词聚类
  const clusters = [];

  for (const article of articles) {
    let matched = false;
    for (const cluster of clusters) {
      const similarity = titleSimilarity(article.title, cluster.articles[0].title);
      if (similarity > 0.4) {
        cluster.articles.push(article);
        matched = true;
        break;
      }
    }
    if (!matched) {
      clusters.push({ articles: [article] });
    }
  }

  // 为每个簇计算综合得分（取最高分 + 跨源加分）
  return clusters.map((cluster) => {
    const topArticle = cluster.articles.sort((a, b) => b.finalScore - a.finalScore)[0];
    const crossSourceBonus = Math.min(cluster.articles.length - 1, 5) * 5;
    return {
      topic: topArticle.title,
      articles: cluster.articles,
      sourceCount: cluster.articles.length,
      topScore: topArticle.finalScore,
      finalScore: topArticle.finalScore + crossSourceBonus,
      isAlert: topArticle.finalScore + crossSourceBonus >= 80 && cluster.articles.length >= 3,
    };
  }).sort((a, b) => b.finalScore - a.finalScore);
}

// ============================================================
// 周报生成
// ============================================================
function generateWeeklyReport(weekNumber = 25) {
  const articles = loadArticles();
  if (articles.length === 0) {
    return "本周还没有抓取到文章，请先运行 fetch 任务。";
  }

  // 筛选最近 7 天的文章
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentArticles = articles.filter(
    (a) => new Date(a.fetchedAt).getTime() > oneWeekAgo
  );

  // 评分
  const scored = recentArticles.map(scoreArticle);
  // 聚类
  const clusters = clusterByTopic(scored);

  // 选出焦点（Top 3 聚类）
  const focusSignals = clusters.slice(0, 3);
  const otherSignals = clusters.slice(3, 8);

  // 生成周报
  const lines = [];

  lines.push(`📠 AI 信号周报 · 2026 W${weekNumber}`);
  lines.push("");
  lines.push("🎯 本周焦点");
  lines.push("");

  focusSignals.forEach((signal, i) => {
    const mainArticle = signal.articles[0];
    const sourceNames = signal.articles.map((a) => a.sourceName).join("、");
    lines.push(`${i + 1}️⃣ ${mainArticle.title}`);
    lines.push(`   信源：${sourceNames}（${signal.sourceCount}源）`);
    lines.push(`   ${mainArticle.summary || "暂无摘要"}`);
    lines.push(`   💡 解读：${mainArticle.insight || "深度解读生成中..."}`);
    lines.push("");
  });

  lines.push("📡 其他信号");
  if (otherSignals.length === 0) {
    lines.push("暂无其他值得关注的信号。");
  } else {
    otherSignals.forEach((signal) => {
      const mainArticle = signal.articles[0];
      lines.push(`• ${mainArticle.title} — ${mainArticle.sourceName}`);
    });
  }

  lines.push("");
  lines.push("━━━━━━━━━━");
  lines.push(`📊 本周统计：抓取 ${articles.length} 篇 → 精选 ${clusters.length} 个信号 → ${focusSignals.length} 个焦点`);
  lines.push("⏰ 下期周报：周日 10:00 自动推送");

  return lines.join("\n");
}

// ============================================================
// 导出
// ============================================================
module.exports = {
  loadArticles,
  saveArticles,
  addArticles,
  scoreArticle,
  clusterByTopic,
  generateWeeklyReport,
};
