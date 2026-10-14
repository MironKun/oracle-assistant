"use strict";
(() => {
  "use strict";

  const $ = (s) => document.querySelector(s);

  const SUPABASE_URL = "https://wglsqfvoolkxwozvaiod.supabase.co";
  const SUPABASE_PUBLIC_KEY = "sb_publishable_iewOa0krvq-Ekcex8R3Rkg_3XdiP8ne";

  const auth = $("#auth");
  const app = $("#app");
  const form = $("#authForm");
  const authMessage = $("#authMessage");
  const submit = $("#authSubmit");

  if (!window.supabase) {
    if (authMessage) authMessage.textContent = "Не загрузилась библиотека Supabase. Обнови страницу.";
    return;
  }

  const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY);

  let user = null;
  let mode = "login";
  let messages = [];
  let notes = [];
  let activeNote = null;
  let busy = false;
let assistantStatus = "";
  const storageKey = (id) => "oracle_v1_user_" + id;

  function notice(text) {
    const el = $("#toast");
    if (!el) return;
    el.textContent = text;
    el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 2800);
  }

  function authNotice(text) {
    if (authMessage) authMessage.textContent = text || "";
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, c => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[c]);
  }

  function saveLocal() {
    if (!user) return;
    try {
      localStorage.setItem(storageKey(user.id), JSON.stringify({ messages, notes }));
    } catch (e) {
      console.error(e);
    }
  }

  function showApp() {
    auth?.classList.add("hidden");
    app?.classList.remove("hidden");
    if ($("#accountEmail")) $("#accountEmail").textContent = user?.email || "";
  }

  function showAuth() {
    app?.classList.add("hidden");
    auth?.classList.remove("hidden");
  }

 
function renderMessages() {
  const box = $("#messages");
  if (!box) return;

  if (!messages.length && !assistantStatus) {
    box.innerHTML =
      '<div class="welcome"><div class="orb">О</div><h2>Чем могу помочь?</h2><p>Я — Оракул, твой личный ИИ-помощник.</p></div>';
    return;
  }

  box.innerHTML = messages.map(m =>
    '<div class="msg ' + (m.role === "user" ? "user" : "assistant") +
    '"><div class="sender">' + (m.role === "user" ? "ВЫ" : "ОРАКУЛ") +
    "</div>" + escapeHTML(m.text) + "</div>"
  ).join("");

  if (assistantStatus) {
    box.insertAdjacentHTML(
      "beforeend",
      '<div class="oracle-status" role="status" aria-live="polite">' +
        '<span class="oracle-dots"><i></i><i></i><i></i></span>' +
        '<span>' + escapeHTML(assistantStatus) + '</span>' +
      '</div>'
    );
  }

  box.scrollTop = box.scrollHeight;
}

    }

    box.innerHTML = messages.map(m =>
      '<div class="msg ' + (m.role === "user" ? "user" : "assistant") +
      '"><div class="sender">' + (m.role === "user" ? "ВЫ" : "ОРАКУЛ") +
      "</div>" + escapeHTML(m.text) + "</div>"
    ).join("");

    box.scrollTop = box.scrollHeight;
  }

  function addMessage(role, text) {
    messages.push({ role, text, at: new Date().toISOString() });
    messages = messages.slice(-300);
    saveLocal();
    renderMessages();
  }

  function renderNotes() {
    const box = $("#notes");
    if (!box) return;

    const q = ($("#search")?.value || "").toLowerCase();
    const filtered = notes.filter(n =>
      (n.title || "").toLowerCase().includes(q) ||
      (n.text || "").toLowerCase().includes(q)
    );

    if (!filtered.length) {
      box.innerHTML = '<p class="empty">Заметок пока нет.</p>';
      return;
    }

    box.innerHTML = filtered.map(n =>
      '<article class="note" data-note-id="' + escapeHTML(n.id) + '">' +
      "<strong>" + escapeHTML(n.title || "Без названия") + "</strong>" +
      "<p>" + escapeHTML((n.text || "").slice(0, 220)) + "</p></article>"
    ).join("");

    box.querySelectorAll("[data-note-id]").forEach(el => {
      el.addEventListener("click", () => openNote(el.dataset.noteId));
    });
  }

  async function cloudMessage(role, content, at = new Date().toISOString()) {
    if (!user) return;
    const { error } = await db.from("oracle_messages").insert({
      user_id: user.id, role, content, created_at: at
    });
    if (error) throw error;
  }

  async function cloudNote(note) {
    if (!user) throw new Error("Нет активной сессии.");
    const { data, error } = await db.from("oracle_memory").insert({
      user_id: user.id,
      title: note.title || "",
      note: note.text,
      created_at: note.at || new Date().toISOString()
    }).select("id,title,note,created_at").single();

    if (error) throw error;
    note.id = String(data.id);
    note.cloudId = data.id;
  }

  async function loadCloud() {
    const [nr, mr] = await Promise.all([
      db.from("oracle_memory").select("id,title,note,created_at")
        .eq("user_id", user.id).order("created_at", { ascending: true }).limit(100),
      db.from("oracle_messages").select("id,role,content,created_at")
        .eq("user_id", user.id).order("created_at", { ascending: true }).limit(300)
    ]);

    if (nr.error) throw nr.error;
    if (mr.error) throw mr.error;

    const cloudNotes = (nr.data || []).map(n => ({
      id: String(n.id), cloudId: n.id, title: n.title || "",
      text: n.note, at: n.created_at
    }));

    const cloudMessages = (mr.data || []).map(m => ({
      id: String(m.id), role: m.role, text: m.content, at: m.created_at
    }));

    if (cloudNotes.length) notes = cloudNotes;
    if (cloudMessages.length) messages = cloudMessages;

    saveLocal();
    renderMessages();
    renderNotes();

    if ($("#syncStatus")) {
      $("#syncStatus").textContent = "Облачная синхронизация включена";
    }
  }

  function loadUser(u) {
    if (!u) return;
    user = u;
    messages = [];
    notes = [];

    try {
      const raw = localStorage.getItem(storageKey(u.id)) ||
                  localStorage.getItem("oracle_v1");
      if (raw) {
        const saved = JSON.parse(raw);
        messages = Array.isArray(saved.messages) ? saved.messages : [];
        notes = Array.isArray(saved.notes) ? saved.notes : [];
      }
    } catch (e) {
      console.warn("Local data load failed:", e);
    }

    showApp();
    renderMessages();
    renderNotes();

    if ($("#syncStatus")) $("#syncStatus").textContent = "Загружаем облачные данные…";

    loadCloud().catch(e => {
      console.error("Cloud load failed:", e);
      if ($("#syncStatus")) $("#syncStatus").textContent = "Облако недоступно · локальные данные";
      notice("Ошибка облака: " + e.message);
    });
  }

  async function send() {
    const input = $("#prompt");
    const button = $("#send");
    if (!input || !user || busy) return;

    const message = input.value.trim();
    if (!message) return;

    input.value = "";
busy = true;
assistantStatus = "Оракул думает…";
if (button) button.disabled = true;

addMessage("user", message);
    const lower = message.toLowerCase();

    try {
      if (lower.startsWith("запомни:") || lower.startsWith("запомни ")) {
        const colon = message.indexOf(":");
        const text = message.slice(colon >= 0 ? colon + 1 : 7).trim();

        if (!text) {
          addMessage("assistant", "Напиши, что запомнить: «Запомни: мой проект — Оракул».");
          return;
        }

        const note = { id: crypto.randomUUID(), title: "", text, at: new Date().toISOString() };
        notes.push(note);
        saveLocal();
        renderNotes();

        try {
          await cloudNote(note);
          notice("Запись сохранена в облако.");
        } catch (e) {
          notice("Запись осталась на устройстве: " + e.message);
        }

        addMessage("assistant", "Запомнил: " + text);
        try {
          await cloudMessage("user", message);
          await cloudMessage("assistant", "Запомнил: " + text);
        } catch (e) {
          console.warn(e);
        }
        return;
      }

      if (lower === "покажи память" || lower === "что ты помнишь") {
        const reply = notes.length
          ? notes.map((n, i) => (i + 1) + ". " + n.text).join("\n")
          : "Пока память пуста. Напиши: «Запомни: ...»";
        addMessage("assistant", reply);
        return;
      }

      const { data: sessionData, error: sessionError } = await db.auth.getSession();
      if (sessionError) throw sessionError;

      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Сессия закончилась. Войди заново.");

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + token
        },
        body: JSON.stringify({ message })
      });

      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error("Сервер вернул неверный ответ. Проверь Vercel.");
      }

      if (!response.ok) {
        throw new Error(data.details || data.error || ("Ошибка сервера " + response.status));
      }

      const reply = data.reply || "ИИ вернул пустой ответ.";
      addMessage("assistant", reply);

      try {
        await cloudMessage("user", message);
        await cloudMessage("assistant", reply);
      } catch (e) {
        console.warn("History sync failed:", e);
        notice("Ответ получен, но история не синхронизирована.");
      }
    } catch (e) {
      addMessage("assistant", "Ошибка: " + (e.message || "Неизвестная ошибка"));
    } finally {
      busy = false;
      if (button) button.disabled = false;
    }
  }

  function openNote(id) {
    const n = notes.find(x => String(x.id) === String(id));
    if (!n) return;
    activeNote = String(id);
    if ($("#ntitle")) $("#ntitle").value = n.title || "";
    if ($("#nbody")) $("#nbody").value = n.text || "";
    $("#editor")?.classList.remove("hidden");
  }

  function closeEditor() {
    activeNote = null;
    if ($("#ntitle")) $("#ntitle").value = "";
    if ($("#nbody")) $("#nbody").value = "";
    $("#editor")?.classList.add("hidden");
  }

  $("#loginTab")?.addEventListener("click", () => {
    mode = "login";
    $("#loginTab")?.classList.add("active");
    $("#registerTab")?.classList.remove("active");
    if (submit) submit.textContent = "Войти";
    authNotice("");
  });

  $("#registerTab")?.addEventListener("click", () => {
    mode = "register";
    $("#registerTab")?.classList.add("active");
    $("#loginTab")?.classList.remove("active");
    if (submit) submit.textContent = "Создать аккаунт";
    authNotice("");
  });

  form?.addEventListener("submit", async event => {
    event.preventDefault();
    const email = ($("#authEmail")?.value || "").trim();
    const password = $("#authPassword")?.value || "";

    if (!email || !password) {
      authNotice("Введи почту и пароль.");
      return;
    }

    if (submit) submit.disabled = true;
    authNotice("Подключаемся…");

    try {
      if (mode === "register") {
        const { data, error } = await db.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin }
        });
        if (error) throw error;

        if (data.session && data.user) {
          loadUser(data.user);
          authNotice("");
        } else {
          authNotice("Проверь почту и подтверди регистрацию, затем войди.");
        }
      } else {
        const { data, error } = await db.auth.signInWithPassword({ email, password });
        if (error) throw error;
        loadUser(data.user);
        authNotice("");
        notice("Вход выполнен.");
      }
    } catch (e) {
      authNotice(e.message || "Не удалось войти.");
    } finally {
      if (submit) submit.disabled = false;
    }
  });

  $("#logout")?.addEventListener("click", async () => {
    const { error } = await db.auth.signOut();
    if (error) {
      notice("Не удалось выйти: " + error.message);
      return;
    }
    user = null;
    messages = [];
    notes = [];
    showAuth();
  });

  $("#send")?.addEventListener("click", send);
  $("#prompt")?.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });

  document.querySelectorAll(".nav").forEach(b => {
    b.addEventListener("click", () => {
      const view = b.dataset.view;
      $("#chat")?.classList.toggle("hidden", view !== "chat");
      $("#library")?.classList.toggle("hidden", view !== "library");
      document.querySelectorAll(".nav").forEach(x => x.classList.toggle("active", x === b));
      if ($("#heading")) $("#heading").textContent = view === "chat" ? "Диалог" : "Библиотека";
      $("#sidebar")?.classList.remove("open");
    });
  });

  $("#menu")?.addEventListener("click", () => $("#sidebar")?.classList.toggle("open"));
  $("#newnote")?.addEventListener("click", () => {
    closeEditor();
    $("#editor")?.classList.remove("hidden");
    $("#ntitle")?.focus();
  });
  $("#cancel")?.addEventListener("click", closeEditor);
  $("#search")?.addEventListener("input", renderNotes);

  $("#save")?.addEventListener("click", async () => {
    const title = ($("#ntitle")?.value || "").trim();
    const text = ($("#nbody")?.value || "").trim();
    if (!text) {
      notice("Добавь текст заметки.");
      return;
    }

    try {
      if (activeNote) {
        const n = notes.find(x => String(x.id) === activeNote);
        if (!n) throw new Error("Заметка не найдена.");
        n.title = title;
        n.text = text;
        const id = n.cloudId || (/^\d+$/.test(String(n.id)) ? Number(n.id) : null);
        if (id !== null) {
          const { error } = await db.from("oracle_memory").update({ title, note: text })
            .eq("id", id).eq("user_id", user.id);
          if (error) throw error;
        } else {
          await cloudNote(n);
        }
      } else {
        const n = { id: crypto.randomUUID(), title, text, at: new Date().toISOString() };
        notes.unshift(n);
        try { await cloudNote(n); } catch (e) { console.warn(e); }
      }
      saveLocal();
      renderNotes();
      closeEditor();
      notice("Заметка сохранена.");
    } catch (e) {
      notice("Ошибка сохранения: " + e.message);
    }
  });

  $("#del")?.addEventListener("click", async () => {
    if (!activeNote) return closeEditor();
    const n = notes.find(x => String(x.id) === activeNote);
    try {
      const id = n?.cloudId || (/^\d+$/.test(String(n?.id)) ? Number(n.id) : null);
      if (id !== null && id !== undefined) {
        const { error } = await db.from("oracle_memory").delete()
          .eq("id", id).eq("user_id", user.id);
        if (error) throw error;
      }
      notes = notes.filter(x => String(x.id) !== activeNote);
      saveLocal();
      renderNotes();
      closeEditor();
      notice("Заметка удалена.");
    } catch (e) {
      notice("Не удалось удалить: " + e.message);
    }
  });

  $("#export")?.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify({ messages, notes }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "oracle-backup.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  $("#import")?.addEventListener("change", async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!Array.isArray(data.messages) || !Array.isArray(data.notes)) {
        throw new Error("Неверный формат файла.");
      }
      messages = data.messages.slice(-300);
      notes = data.notes.slice(-100);
      saveLocal();
      renderMessages();
      renderNotes();
      notice("Импорт завершён.");
    } catch (e) {
      notice("Ошибка импорта: " + e.message);
    } finally {
      event.target.value = "";
    }
  });

  async function init() {
    showAuth();
    authNotice("Проверяем сессию…");

    try {
      const { data, error } = await db.auth.getSession();
      if (error) throw error;
      if (data.session?.user) {
        loadUser(data.session.user);
        authNotice("");
      } else {
        authNotice("");
      }
    } catch (e) {
      authNotice("Ошибка Supabase: " + e.message);
    }

    db.auth.onAuthStateChange((event, session) => {
      if (session?.user && (!user || user.id !== session.user.id)) {
        loadUser(session.user);
      } else if (!session && user) {
        user = null;
        messages = [];
        notes = [];
        showAuth();
      }
    });
  }

  init();
  
/* Мобильное меню Оракула */
const oracleMenuButton = document.querySelector("#menu");
const oracleSidebarBackdrop = document.querySelector("#sidebarBackdrop");

if (oracleMenuButton && !oracleMenuButton.dataset.menuReady) {
  oracleMenuButton.dataset.menuReady = "true";

  oracleMenuButton.addEventListener("click", () => {
    document.body.classList.toggle("menu-open");
  });
}

if (oracleSidebarBackdrop && !oracleSidebarBackdrop.dataset.menuReady) {
  oracleSidebarBackdrop.dataset.menuReady = "true";

  oracleSidebarBackdrop.addEventListener("click", () => {
    document.body.classList.remove("menu-open");
  });
}

document.querySelectorAll(".nav").forEach((button) => {
  button.addEventListener("click", () => {
    document.body.classList.remove("menu-open");
  });
});

})();
