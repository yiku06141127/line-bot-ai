export default async function handler(req, res) {
  // 1. 基础校验
  if (req.method !== "POST") return res.status(200).send("OK");

  const events = req.body.events;

  // 2. 并行处理消息
  try {
    await Promise.all(events.map(event => handleEvent(event)));
  } catch (err) {
    console.error("处理事件出错:", err);
  }

  // 3. 必须返回 200 给 LINE
  return res.status(200).send("OK");
}

async function handleEvent(event) {
  // 只处理文字消息
  if (event.type !== "message" || event.message.type !== "text") return null;

  const userMessage = event.message.text;
  const replyToken = event.replyToken;
  let replyText = "";

  try {
    /**
     * 【核心修正点】
     * 使用 v1beta 路径 + gemini-1.5-flash-latest 后缀
     * 这种组合兼容性最强，能解决 "model not found" 的报错
     */
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${process.env.GEMINI_API_KEY}`;

    const geminiRes = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: userMessage }]
          }
        ],
        // 降低安全过滤，防止 AI 拒答
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
        ]
      })
    });

    const data = await geminiRes.json();

    // 严谨的数据解析
    if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
      replyText = data.candidates[0].content.parts[0].text;
    } else if (data.error) {
      // 如果 Google 还是报错，把错误详细信息发回 LINE 方便调试
      replyText = `Gemini 报错: ${data.error.message}`;
    } else {
      replyText = "AI 暂时没有生成内容，请再试一次。";
    }

  } catch (err) {
    console.error("请求失败:", err);
    replyText = "抱歉，连接 AI 失败了 🔌";
  }

  // 回传给 LINE
  try {
    await fetch("https://api.line.me/v2/bot/message/reply", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        replyToken: replyToken,
        messages: [{ type: "text", text: replyText }],
      }),
    });
  } catch (err) {
    console.error("LINE 回传失败:", err);
  }
}
