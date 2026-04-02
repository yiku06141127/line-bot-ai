export default async function handler(req, res) {
  // 1. 基础校验：只允许 POST 请求
  if (req.method !== "POST") {
    return res.status(200).send("OK");
  }

  const events = req.body.events;

  // 2. 并行处理消息流
  try {
    // 即使只有一个事件，用 Promise.all 也是更规范的写法
    await Promise.all(events.map(event => handleEvent(event)));
  } catch (err) {
    console.error("处理事件流时发生严重错误:", err);
  }

  // 3. 必须立即给 LINE 回应 200，否则 LINE 会认为请求失败而不断重试
  return res.status(200).send("OK");
}

async function handleEvent(event) {
  // 过滤：仅处理“文字消息”
  if (event.type !== "message" || event.message.type !== "text") {
    return null;
  }

  const userMessage = event.message.text;
  const replyToken = event.replyToken;
  let replyText = "";

  try {
    // 【关键修改点】使用了 v1 稳定版接口路径
    const geminiUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

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
        // 安全设置：确保 AI 不会因为过于敏感而拒答
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
        ]
      })
    });

    const data = await geminiRes.json();

    // 在控制台打印完整的 API 返回结果，方便在 Vercel Logs 中排查
    console.log("Gemini API 返回详情:", JSON.stringify(data));

    // 严谨的解析逻辑
    if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
      replyText = data.candidates[0].content.parts[0].text;
    } else if (data.error) {
      // 捕获 API 内部错误（如 Key 错误或参数错误）
      replyText = `AI 接口报错: ${data.error.message}`;
    } else {
      replyText = "AI 暂时不知道怎么回答，换个话题试试吧！";
    }

  } catch (err) {
    console.error("请求 Gemini 失败:", err);
    replyText = "抱歉，我的网络连接出了一点点状况 🔌";
  }

  // 最后一步：将回复发回给 LINE 用户
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
    console.error("回传 LINE 失败:", err);
  }
}
