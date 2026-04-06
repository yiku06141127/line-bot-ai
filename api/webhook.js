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
    // ✅ 使用 Gemini 2.0（你这个账号最稳定）
    // 使用 v1 稳定路径 + 去掉 -latest 后缀
// 注意：去掉所有后缀，只保留 gemini-1.5-flash
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
        ]
      })
    });

    const data = await geminiRes.json();

    // ✅ 正常返回
    if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
      replyText = data.candidates[0].content.parts[0].text;
    }
    // ❌ Gemini报错
else if (data.error) {
  console.error("Gemini错误:", data);
  replyText = `错误: ${JSON.stringify(data)}`;
}
    // ❌ 空返回
    else {
      replyText = "AI没有返回内容";
    }

  } catch (err) {
    console.error("请求失败:", err);
    replyText = "网络异常，请稍后再试";
  }

  // ✅ 回复 LINE
  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      replyToken: replyToken,
      messages: [
        {
          type: "text",
          text: replyText.substring(0, 500) // 防止超长
        }
      ],
    }),
  });
}
