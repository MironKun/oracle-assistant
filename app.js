(() => {
  const $ = s => document.querySelector(s);
  const KEY = "oracle_v1";
  let state = { messages: [], notes: [] };

  try {
    state = { ...state, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
    if (!Array.isArray(state.messages)) state.messages = [];
    if (!Array.isArray(state.notes)) state.notes = [];
  } catch {}

  const persist = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {}
  };

  const esc = s => String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
  }[c]));

  function render() {
    const box = $("#messages");
    if (!box) return;

    if (!state.messages.length) {
      box.innerHTML = '<div class="welcome"><div class="orb">О</div><h2>Чем могу помочь?</h2><p>Я — Оракул, твой личный ИИ-помощник.</p></div>';
      return;
    }

    box.innerHTML = state.messages.map(m =>
      '<div class="msg ' + (m.role === "user" ? "user" : "assistant") +
      '"><div class="sender">' + (m.role === "user" ? "ВЫ" : "ОРАКУЛ") +
      '</div>' + esc(m.text) + '</div>'
    ).join("");

    box.scrollTop = box.scrollHeight;
  }

  function add(role, text) {
    state.messages.push({ role, text, at: new Date().toISOString() });
    state.messages = state.messages.slice(-300);
    persist();
    render();
  }

  function handleMemoryCommand(message) {
    const lower = message.toLowerCase();

    if (lower.startsWith("запомни:") || lower.startsWith("запомни ")) {
      const note = message.slice(message.indexOf(":") >= 0
        ? message.indexOf(":") + 1
        : "запомни".length).trim();

      if (!note) {
        add("assistant", "Напиши, что именно запомнить. Например: «Запомни: я делаю проект Оракул».");
        return true;
      }

      state.notes.push({ text: note, at: new Date().toISOString() });
      state.notes = state.notes.slice(-100);
      persist();
      add("assistant", "Запомнил: " + note);
      return true;
    }

    if (lower === "покажи память" || lower === "что ты помнишь") {
      add("assistant", state.notes.length
        ? "Вот что я сохранил:\n\n" + state.notes.map((n, i) => (i + 1) + ". " + n.text).join("\n")
        : "Пока память пуста. Напиши: «Запомни: ...»");
      return true;
    }

    if (lower === "очисти память" || lower === "забудь всё") {
      state.notes = [];
      persist();
      add("assistant", "Локальная память очищена.");
      return true;
    }

    return false;
  }

  async function send() {
    const prompt = $("#prompt");
    const button = $("#send");
    if (!prompt) return;

    const message = prompt.value.trim();
    if (!message || (button && button.disabled)) return;

    prompt.value = "";
    add("user", message);

    if (handleMemoryCommand(message)) return;

    add("assistant", "Думаю…");
    const index = state.messages.length - 1;
    if (button) button.disabled = true;

    try {
      const history = state.messages
        .slice(0, -1)
        .filter(m => m.text !== "Думаю…")
        .slice(-20)
        .map(m => ({
          role: m.role === "user" ? "user" : "assistant",
          content: m.text
        }));

      const response = await fetch(
        "https://oracle-assistant-tau.vercel.app/api/chat",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message,
            memory: state.notes.map(n => n.text),
            history
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.details || data.error || "Ошибка сервера: " + response.status);
      }

      state.messages[index].text = data.reply || "ИИ вернул пустой ответ.";
    } catch (error) {
      state.messages[index].text = "Ошибка: " + error.message;
    } finally {
      persist();
      render();
      if (button) button.disabled = false;
    }
  }

  const button = $("#send");
  const prompt = $("#prompt");

  if (button) button.onclick = send;

  if (prompt) {
    prompt.onkeydown = e => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    };
  }

  render();
})();
