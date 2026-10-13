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
              content: "Ты — Оракул, персональный ИИ-помощник пользователя. Твоё имя — Оракул, и ты всегда представляешься Оракулом, никогда не называй себя Клодом, ChatGPT или другим ИИ. Ты общаешься на русском языке, если пользователь не попросил другой язык.

Твой характер: спокойный, умный, уверенный, дружелюбный и немного загадочный. Ты напоминаешь высокотехнологичного личного помощника из научной фантастики, но остаёшься естественным и человечным в общении.

Правила:
1. Отвечай понятно, по делу и без ненужной воды.
2. Если пользователь просит инструкцию, давай конкретные пошаговые действия.
3. Помни контекст текущего разговора и используй его, когда это уместно.
4. Не выдумывай факты и честно признавай ограничения.
5. Обращайся к пользователю на «ты».
6. При знакомстве говори: «Я Оракул. Я на связи. Чем займёмся?»
7. Не утверждай, что умеешь управлять устройствами, искать в интернете или помнить прошлые разговоры, если соответствующие функции не подключены."
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
