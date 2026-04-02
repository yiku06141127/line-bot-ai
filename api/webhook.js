export default async function handler(req, res) {
  if (req.method === "POST") {
    const body = req.body;

    console.log("LINE webhook:", JSON.stringify(body));

    const events = body.events || [];

    for (const event of events) {
      if (event.type === "message") {
        const replyToken = event.replyToken;
        const userMessage = event.message.text;

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
                text: `你说的是：${userMessage}`,
              },
            ],
          }),
        });
      }
    }

    return res.status(200).json({ status: "ok" });
  }

  return res.status(405).end();
}
