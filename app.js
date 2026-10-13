(()=> {
const $ = s => document.querySelector(s);
const KEY = “oracle_v1”;
let state = { messages: [], notes: [] };

try {
state = { …state, …JSON.parse(localStorage.getItem(KEY) || “{}”) };
} catch {}

const persist = () => {
try {
localStorage.setItem(KEY, JSON.stringify(state));
} catch {}
};

const esc = s => String(s).replace(/[&<>”’]/g, c => ({
“&”: “&”, “<”: “<”, “>”: “>”,
‘”’: “"”, “’”: “'”
}[c]));

function render() {
const box = $(”#messages”);
if (!box) return;

if (!state.messages.length) {
  box.innerHTML = '<div class="welcome"><div class="orb">О</div><h2>Чем могу помочь?</h2><p>Я — Оракул, твой личный ИИ-помощник.</p></div>';
  return;
}
box.innerHTML = state.messages.map(m =>
  '<div class="msg ' + m.role + '"><div class="sender">' +
  (m.role === "user" ? "ВЫ" : "ОРАКУЛ") +
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

async function send() {
const prompt = $(”#prompt”);
const button = $(”#send”);
const message = prompt.value.trim();

if (!message || (button && button.disabled)) return;
prompt.value = "";
add("user", message);
add("assistant", "Думаю…");
const index = state.messages.length - 1;
if (button) button.disabled = true;
try {
  const response = await fetch("https://oracle-assistant-tau.vercel.app/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message })
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Ошибка сервера: " + response.status);
  }
  state.messages[index].text = data.reply || "Получен пустой ответ.";
} catch (error) {
  state.messages[index].text =
    "Ошибка подключения: " + error.message +
    ". Проверь сервер Vercel и настройки доступа.";
} finally {
  persist();
  render();
  if (button) button.disabled = false;
}

}

const button = $(”#send”);
const prompt = $(”#prompt”);

if (button) button.onclick = send;

if (prompt) {
prompt.onkeydown = e => {
if (e.key === “Enter” && !e.shiftKey) {
e.preventDefault();
send();
}
};
}

render();
})();
