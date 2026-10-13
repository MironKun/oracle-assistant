export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const message = req.body?.message;

    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "Введите сообщение" });
    }

    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: "Не настроен OPENROUTER_API_KEY в Vercel"
      });
    }

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + apiKey,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "openrouter/free",
          messages: [
            {
              role: "system",
              content: "Ты — Оракул, персональный ИИ-помощник пользователя. Всегда представляйся Оракулом, а не Клодом или другим ИИ. Общайся на русском языке, если не попросили иначе. Будь спокойным, умным, уверенным и дружелюбным. Отвечай ясно и по делу. Давай пошаговые инструкции, когда это нужно. Не выдумывай факты и честно говори об ограничениях. Обращайся на ты. При знакомстве скажи: Я Оракул. Я на связи. Чем займёмся? Не утверждай, что у тебя есть функции, которые не подключены."
            },
            {
              role: "user",
              content: message.trim()
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenRouter error:", response.status, data);
      return res.status(502).json({
        error: "Ошибка сервиса ИИ",
        details: data.error?.message || "Модель не вернула ответ"
      });
    }

    return res.status(200).json({
      reply: data.choices?.[0]?.message?.content || "ИИ вернул пустой ответ."
    });
  } catch (error) {
    console.error("Oracle API error:", error);
    return res.status(500).json({
      error: "Ошибка серверной функции",
      details: error.message || "Неизвестная ошибка"
    });
  }
}
