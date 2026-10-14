
export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      reply: "Используй POST-запрос."
    });
  }

  const body = req.body || {};
  const message = String(body.message || "").trim();

  if (!message) {
    return res.status(400).json({
      reply: "Напиши, что нужно сделать."
    });
  }

  const q = message.toLowerCase();
  const now = new Date();

  // Команды, которые не требуют ИИ или интернета
  if (/^(привет|здравствуй|здравствуйте|доброе утро|добрый день|добрый вечер)[!. ]*$/i.test(q)) {
    return res.status(200).json({
      mode: "offline",
      reply: "На связи! Я работаю в автономном режиме. Могу отвечать на простые команды и искать справочную информацию в интернете."
    });
  }

  if (q.includes("который час") || q === "время" || q.includes("текущее время")) {
    return res.status(200).json({
      mode: "offline",
      reply: "Время на сервере: " +
        now.toLocaleTimeString("ru-RU", { timeZone: "Europe/Prague" }) +
        ". Часовой пояс: Прага."
    });
  }

  if (q.includes("какое сегодня число") || q === "дата" || q.includes("сегодняшняя дата")) {
    return res.status(200).json({
      mode: "offline",
      reply: "Сегодня " +
        now.toLocaleDateString("ru-RU", {
          timeZone: "Europe/Prague",
          day: "numeric",
          month: "long",
          year: "numeric"
        }) + "."
    });
  }

  if (q === "помощь" || q === "что ты умеешь" || q === "команды") {
    return res.status(200).json({
      mode: "offline",
      reply: "Автономный режим пока умеет: приветствовать, показывать дату и время, искать справочную информацию в интернете. Свободное рассуждение и сложные задачи требуют ИИ."
    });
  }

  // Убираем типичные команды поиска перед запросом
  const searchQuery = message
    .replace(/^(найди в интернете|найди в сети|поищи в интернете|поищи|найди|поиск|что такое|кто такой|кто такая|расскажи о)\s*/i, "")
    .trim();

  if (!searchQuery) {
    return res.status(200).json({
      mode: "offline",
      reply: "Напиши тему для поиска, например: «Найди в интернете историю Праги»."
    });
  }

  // Общедоступный поиск по энциклопедии Wikipedia
  try {
    const url =
      "https://ru.wikipedia.org/w/api.php?action=query&list=search&srsearch=" +
      encodeURIComponent(searchQuery) +
      "&utf8=1&format=json&srlimit=5";

    const response = await fetch(url, {
      headers: { "User-Agent": "OracleAssistant/1.0" },
      signal: AbortSignal.timeout(8000)
    });

    if (!response.ok) {
      throw new Error("Search service unavailable");
    }

    const data = await response.json();
    const results = data?.query?.search || [];

    if (!results.length) {
      return res.status(200).json({
        mode: "offline",
        reply: "В доступной энциклопедии ничего не найдено по запросу «" +
          searchQuery + "». Попробуй сформулировать запрос иначе."
      });
    }

    const items = results.map((item) => {
      const snippet = String(item.snippet || "")
        .replace(/<[^>]*>/g, "")
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&amp;/g, "&");

      return {
        title: item.title,
        snippet,
        url: "https://ru.wikipedia.org/wiki/" +
          encodeURIComponent(item.title.replace(/ /g, "_"))
      };
    });

    const reply = "Нашёл материалы по запросу «" +
      searchQuery + "»:\n\n" +
      items.map((item, index) =>
        (index + 1) + ". " + item.title + "\n" +
        item.snippet + "\n" + item.url
      ).join("\n\n") +
      "\n\nЭто результаты поиска, а не проверенный ответ ИИ.";

    return res.status(200).json({
      mode: "offline",
      reply,
      sources: items
    });
  } catch (error) {
    return res.status(200).json({
      mode: "offline",
      reply: "Автономный режим работает, но поиск сейчас недоступен. Проверь интернет и попробуй позже. Простые команды продолжают работать."
    });
  }
}
