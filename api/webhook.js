export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(200).send("OK");

  const events = req.body.events;

  try {
    await Promise.all(events.map(event => handleEvent(event)));
  } catch (err) {
    console.error("处理错误:", err);
  }

  return res.status(200).send("OK");
}

async function handleEvent(event) {
  if (event.type !== "message" || event.message.type !== "text") return null;

  const userMessage = event.message.text;
  const replyToken = event.replyToken;
  let replyText = "";

  try {
    /**
     * 【核心修正】
     * 1. 路径改为 v1beta (Flash模型目前在beta路径最稳定)
     * 2. 模型名确保为 gemini-1.5-flash
     */
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

    const geminiRes = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: userMessage }]
          }
        ]
      })
    });

    const data = await geminiRes.json();

    // 调试用：如果依然报错，会把具体的 JSON 结构打出来
    if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
      replyText = data.candidates[0].content.parts[0].text;
    } else if (data.error) {
      replyText = `Gemini报错(${data.error.code}): ${data.error.message}`;
    } else {
      replyText = "AI 暂时没有返回有效内容。";
    }

  } catch (err) {
    replyText = "网络连接异常，请稍后再试。";
  }

  // 回传给 LINE
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
}
