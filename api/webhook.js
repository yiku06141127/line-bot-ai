export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(200).send("OK");
  const events = req.body.events;
  try {
    await Promise.all(events.map(event => handleEvent(event)));
  } catch (err) { console.error(err); }
  return res.status(200).send("OK");
}

async function handleEvent(event) {
  if (event.type !== "message" || event.message.type !== "text") return null;

  const userMessage = event.message.text;
  let replyText = "";

  try {
    // 尝试最经典的路径：v1beta + gemini-pro
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`;

    const geminiRes = await fetch(geminiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: userMessage }] }]
      })
    });

    const data = await geminiRes.json();

    if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
      replyText = data.candidates[0].content.parts[0].text;
    } else {
      // 如果报错，直接把整个 JSON 发回 LINE，我们看看 Google 到底返回了什么
      replyText = `调试信息: ${JSON.stringify(data)}`;
    }
  } catch (err) {
    replyText = "连接失败";
  }

  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      replyToken: event.replyToken,
      messages: [{ type: "text", text: replyText.substring(0, 500) }], // 防止消息太长
    }),
  });
}
