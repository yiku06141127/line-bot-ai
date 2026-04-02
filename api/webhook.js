export default async function handler(req, res) {
  // 1. 只处理 POST 请求
  if (req.method !== "POST") {
    return res.status(200).send("OK");
  }

  const events = req.body.events;

  // 2. 并行执行所有消息处理
  try {
    // 使用 Promise.all 让所有消息同时处理，提高响应速度
    await Promise.all(events.map(event => handleEvent(event)));
  } catch (err) {
    console.error("处理事件流时发生严重错误:", err);
  }

  // 3. 必须立即给 LINE 回应 200，否则 LINE 会一直重发请求
  return res.status(200).send("OK");
}

async function handleEvent(event) {
  // 过滤：只处理“文字消息”
  if (event.type !== "message" || event.message.type !== "text") {
    return null;
  }

  const userMessage = event.message.text;
  const replyToken = event.replyToken;
  let replyText = "";

  try {
    // 调用 Gemini API
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: userMessage }]
            }
          ],
          // 添加安全设置，防止 AI 因为敏感度太高而不说话
          safetySettings: [
            { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
            { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
          ]
        })
      }
    );

    const data = await geminiRes.json();

    // 【重要】打印日志，如果还是“没有想法”，请去 Vercel Logs 看这里的输出
    console.log("Gemini API 返回详情:", JSON.stringify(data));

    // 解析逻辑：逐层检查数据是否存在
    if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
      replyText = data.candidates[0].content.parts[0].text;
    } else if (data.error) {
      // 如果 API 报错（如 Key 无效或超限）
      replyText = `API 报错了: ${data.error.message}`;
    } else {
      // 兜底回复
      replyText = "AI 暂时无法回答这个问题，请换个问法。";
    }

  } catch (err) {
    console.error("请求 Gemini 失败:", err);
    replyText = "抱歉，我的大脑断线了 🧠⚡️";
  }

  // 将结果发回给 LINE
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
