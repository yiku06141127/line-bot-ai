export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("OK");
  }

  const events = req.body.events;

  for (const event of events) {
    if (event.type === "message" && event.message.type === "text") {
      const userMessage = event.message.text;

      let replyText = "";

      try {
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              contents: [
                {
                  role: "user",
                  parts: [
                    {
                      text: userMessage,
                    },
                  ],
                },
              ],
            }),
          }
        );

        const data = await geminiRes.json();

        console.log("Gemini返回:", JSON.stringify(data));

        replyText =
          data.candidates &&
          data.candidates[0] &&
          data.candidates[0].content &&
          data.candidates[0].content.parts &&
          data.candidates[0].content.parts[0].text
            ? data.candidates[0].content.parts[0].text
            : "AI没有返回内容 😢";
      } catch (err) {
        console.log("错误:", err);
        replyText = "AI调用失败 ❌";
      }

      await fetch("https://api.line.me/v2/bot/message/reply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
        },
        body: JSON.stringify({
          replyToken: event.replyToken,
          messages: [
            {
              type: "text",
              text: replyText,
            },
          ],
        }),
      });
    }
  }

  res.status(200).send("OK");
}
