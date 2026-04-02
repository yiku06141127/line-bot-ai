// 建议安装 @line/bot-sdk 用于简化验签逻辑
export default async function handler(req, res) {
  // 1. 快速检查方法
  if (req.method !== "POST") {
    return res.status(200).send("OK");
  }

  // 2. 获取事件列表
  const events = req.body.events;

  // 3. 并行处理所有事件 (Promise.all)
  try {
    await Promise.all(events.map(event => handleEvent(event)));
  } catch (err) {
    console.error("处理事件时发生错误:", err);
  }

  // 4. 无论处理结果如何，立即返回 200 给 LINE
  return res.status(200).send("OK");
}

async function handleEvent(event) {
  // 仅处理文字消息
  if (event.type !== "message" || event.message.type !== "text") return null;

  const userMessage = event.message.text;
  let replyText = "";

  try {
    // 调用 Gemini API
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: userMessage }] }],
        }),
      }
    );

    const data = await geminiRes.json();

    // 更安全的取值逻辑（使用可选链 ?.）
    replyText = data.candidates?.[0]?.content?.parts?.[0]?.text || "AI 暂时没有想法 😢";
    
    // 如果是因为安全策略被拦截
    if (data.promptFeedback?.blockReason) {
      replyText = "抱歉，由于内容安全政策，我无法回答这个问题。";
    }

  } catch (err) {
    console.error("Gemini 接口故障:", err);
    replyText = "系统忙碌中，请稍后再试。";
  }

  // 回传给 LINE
  return fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      replyToken: event.replyToken,
      messages: [{ type: "text", text: replyText }],
    }),
  });
}
