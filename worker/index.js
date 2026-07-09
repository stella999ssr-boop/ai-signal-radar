/**
 * AI 信号雷达 — WeChat Worker v2（简化版）
 */

const http = require("http");
const crypto = require("crypto");
const { parseString } = require("xml2js");
const { handleMessage } = require("./reply");

const TOKEN = process.env.WX_TOKEN || "YOUR_WX_TOKEN";
const PORT = process.env.PORT || 8787;

// ============================================================
// XML 解析和构建（纯函数，不依赖 Express）
// ============================================================
function parseXMLBody(body) {
  return new Promise((resolve, reject) => {
    parseString(body, { explicitArray: true }, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

function buildTextReply(toUser, fromUser, content) {
  return `<xml>
<ToUserName><![CDATA[${toUser}]]></ToUserName>
<FromUserName><![CDATA[${fromUser}]]></FromUserName>
<CreateTime>${Math.floor(Date.now() / 1000)}</CreateTime>
<MsgType><![CDATA[text]]></MsgType>
<Content><![CDATA[${content}]]></Content>
</xml>`;
}

function getWelcomeMessage() {
  return `👋 欢迎关注「AI 信号雷达」

我是橘子专属的 AI 资讯策展 Agent，监控 8 个精选中文 AI 公众号。

你可以这样跟我对话：
• 「本周信号」— 查看最新 AI 信号周报
• 「深入 XX」— 展开某个话题的深度解读
• 「信源」— 查看监控的公众号列表
• 「帮助」— 查看所有命令`;
}

// ============================================================
// 微信签名验证
// ============================================================
function verifySignature(signature, timestamp, nonce) {
  const arr = [TOKEN, timestamp, nonce].sort();
  const str = arr.join("");
  const sha1 = crypto.createHash("sha1").update(str).digest("hex");
  return sha1 === signature;
}

// ============================================================
// HTTP Server（不用 Express，直接用原生 http）
// ============================================================
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // ---- 日志 ----
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${pathname}`);

  // ---- 健康检查 ----
  if (pathname === "/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true, at: new Date().toISOString() }));
  }

  // ---- GET /wechat — 服务器验证 ----
  if (pathname === "/wechat" && req.method === "GET") {
    const sig = url.searchParams.get("signature");
    const ts = url.searchParams.get("timestamp");
    const nonce = url.searchParams.get("nonce");
    const echostr = url.searchParams.get("echostr");

    console.log(`[验证] signature=${sig} timestamp=${ts} nonce=${nonce}`);

    if (verifySignature(sig, ts, nonce)) {
      console.log("[验证] ✅ 成功，返回 echostr");
      res.writeHead(200);
      return res.end(echostr);
    } else {
      console.log("[验证] ❌ 签名不匹配");
      res.writeHead(403);
      return res.end("signature mismatch");
    }
  }

  // ---- POST /wechat — 接收消息 ----
  if (pathname === "/wechat" && req.method === "POST") {
    let rawBody = "";

    req.on("data", (chunk) => {
      rawBody += chunk.toString();
    });

    req.on("end", async () => {
      console.log("[消息] 收到 POST body:", rawBody.substring(0, 300));

      try {
        const parsed = await parseXMLBody(rawBody);
        const msg = parsed.xml;

        const msgType = msg.MsgType[0];
        const fromUser = msg.FromUserName[0];
        const toUser = msg.ToUserName[0];

        console.log(`[消息] 类型: ${msgType}, 来自: ${fromUser}`);

        let replyContent = "";

        if (msgType === "event" && msg.Event[0] === "subscribe") {
          replyContent = getWelcomeMessage();
        } else if (msgType === "text") {
          const userText = msg.Content[0];
          console.log(`[消息] 内容: "${userText}"`);
          replyContent = await handleMessage(userText, fromUser);
        } else {
          replyContent = "目前只支持文字消息，发送「帮助」查看可用指令。";
        }

        const replyXml = buildTextReply(fromUser, toUser, replyContent);
        console.log(`[回复] ${replyContent.substring(0, 100)}...`);

        res.writeHead(200, { "Content-Type": "application/xml; charset=utf-8" });
        return res.end(replyXml);
      } catch (err) {
        console.error("[错误] XML 解析失败:", err.message);
        res.writeHead(200);
        return res.end("success");
      }
    });

    return; // 等 data/end 事件异步处理
  }

  // ---- 404 ----
  res.writeHead(404);
  res.end("Not Found");
});

server.listen(PORT, () => {
  console.log(`🚀 AI 信号雷达 v2 已启动，端口 ${PORT}`);
  console.log(`📍 微信回调: http://你的域名/wechat`);
});
