
(() => {
  const $ = (selector) => document.querySelector(selector);

  const SUPABASE_URL = "https://wglsqfvoolkxwozvaiod.supabase.co";
  const SUPABASE_PUBLIC_KEY = "sb_publishable_iewOa0krvq-Ekcex8R3Rkg_3XdiP8ne";

  const authScreen = $("#auth");
  const appScreen = $("#app");
  const authForm = $("#authForm");
  const authMessage = $("#authMessage");
  const authSubmit = $("#authSubmit");
  const loginTab = $("#loginTab");
  const registerTab = $("#registerTab");

  if (!window.supabase) {
    if (authMessage) authMessage.textContent =
      "Не загрузилась библиотека Supabase. Обнови страницу.";
    return;
  }

  if (!SUPABASE_PUBLIC_KEY ||
      SUPABASE_PUBLIC_KEY === "ВСТАВЬ_СВОЙ_PUBLIC_KEY") {
    if (authMessage) authMessage.textContent =
      "Добавь публичный ключ Supabase в app.js.";
    return;
  }

  const client = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLIC_KEY
  );

  let authMode = "login";
  let currentUser = null;
  let state = { messages: [], notes: [] };
  let activeNoteId = null;
  let toastTimer;

  const storageKey = (userId) => "oracle_v1_user_" + userId;

  function toast(message) {
    const el = $("#toast");
    if (!el) return;
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2500);
  }

  function setAuthMessage(message) {
    if (authMessage) authMessage.textContent = message;
  }

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function persist() {
    if (!currentUser) return;
    try {
      localStorage.setItem(
        storageKey(currentUser.id),
        JSON.stringify(state)
      );
    } catch {
      toast("Не удалось сохранить данные на этом устройстве.");
    }
  }

  function loadLocalData(user) {
    currentUser = user;
    state = { messages: [], notes: [] };

    try {
      const saved = localStorage.getItem(storageKey(user.id));
      if (saved) {
        const parsed = JSON.parse(saved);
        state.messages = Array.isArray(parsed.messages)
          ? parsed.messages : [];
        state.notes = Array.isArray(parsed.notes)
          ? parsed.notes : [];
      } else {
        // Перенос прежних локальных данных в профиль первого входа.
        const old = localStorage.getItem("oracle_v1");
        if (old) {
          const parsed = JSON.parse(old);
          state.messages = Array.isArray(parsed.messages)
            ? parsed.messages : [];
          state.notes = Array.isArray(parsed.notes)
            ? parsed.notes : [];
          persist();
        }
      }
    } catch {
      state = { messages: [], notes: [] };
    }

    render();
    renderNotes();
    showApp();
  }

  function showApp() {
    if (authScreen) authScreen.classList.add("hidden");
    if (appScreen) appScreen.classList.remove("hidden");

    const email = $("#accountEmail");
    if (email) email.textContent = currentUser?.email || "";

    const sync = $("#syncStatus");
    if (sync) sync.textContent = "Вход выполнен · локальное хранение";
  }

  function showAuth() {
    if (appScreen) appScreen.classList.add("hidden");
    if (authScreen) authScreen.classList.remove("hidden");
  }

  function render() {
    const box = $("#messages");
    if (!box) return;

    if (!state.messages.length) {
      box.innerHTML =
        '<div class="welcome"><div class="orb">О</div>' +
        '<h2>Чем могу помочь?</h2>' +
        '<p>Я — Оракул, твой личный ИИ-помощник.</p></div>';
      return;
    }

    box.innerHTML = state.messages.map((message) =>
      '<div class="msg ' +
      (message.role === "user" ? "user" : "assistant") +
      '"><div class="sender">' +
      (message.role === "user" ? "ВЫ" : "ОРАКУЛ") +
      "</div>" + escapeHTML(message.text) + "</div>"
    ).join("");

    box.scrollTop = box.scrollHeight;
  }

  function addMessage(role, text) {
    state.messages.push({
      role,
      text,
      at: new Date().toISOString()
    });
    state.messages = state.messages.slice(-300);
    persist();
    render();
  }

  function handleMemoryCommand(message) {
    const lower = message.toLowerCase();

    if (lower.startsWith("запомни:") || lower.startsWith("запомни ")) {
      const colon = message.indexOf(":");
      const note = message.slice(
        colon >= 0 ? colon + 1 : "запомни".length
      ).trim();

      if (!note) {
        addMessage("assistant",
          "Напиши, что запомнить. Например: «Запомни: я делаю проект Оракул».");
        return true;
      }

      state.notes.push({
        id: crypto.randomUUID(),
        text: note,
        at: new Date().toISOString()
      });
      state.notes = state.notes.slice(-100);
      persist();
      renderNotes();
      addMessage("assistant", "Запомнил: " + note);
      return true;
    }

    if (lower === "покажи память" || lower === "что ты помнишь") {
      addMessage("assistant", state.notes.length
        ? "Вот что я сохранил:\n\n" +
          state.notes.map((n, i) => (i + 1) + ". " + n.text).join("\n")
        : "Пока память пуста. Напиши: «Запомни: ...»");
      return true;
    }

    if (lower === "очисти память" || lower === "забудь всё") {
      state.notes = [];
      persist();
      renderNotes();
      addMessage("assistant", "Локальная память очищена.");
      return true;
    }

    return false;
  }

  async function send() {
    const prompt = $("#prompt");
    const button = $("#send");
    if (!prompt || !currentUser) return;

    const message = prompt.value.trim();
    if (!message || button?.disabled) return;

    prompt.value = "";
    addMessage("user", message);

    if (handleMemoryCommand(message)) return;

    state.messages.push({
      role: "assistant",
      text: "Думаю…",
      at: new Date().toISOString()
    });
    const index = state.messages.length - 1;
    persist();
    render();

    if (button) button.disabled = true;

    try {
      const history = state.messages
        .slice(0, -1)
        .filter((m) => m.text !== "Думаю…")
        .slice(-20)
        .map((m) => ({
          role: m.role === "user" ? "user" : "assistant",
          content: m.text
        }));

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          memory: state.notes.map((n) => n.text),
          history
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.details || data.error || "Ошибка сервера: " + response.status
        );
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

  function renderNotes() {
    const box = $("#notes");
    if (!box) return;

    const query = ($("#search")?.value || "").toLowerCase();
    const notes = state.notes.filter((note) =>
      (note.title || "").toLowerCase().includes(query) ||
      note.text.toLowerCase().includes(query)
    );

    if (!notes.length) {
      box.innerHTML = '<p class="empty">Заметок пока нет.</p>';
      return;
    }

    box.innerHTML = notes.map((note) =>
      '<article class="note" data-note-id="' + escapeHTML(note.id) + '">' +
      '<strong>' + escapeHTML(note.title || "Без названия") + '</strong>' +
      '<p>' + escapeHTML(note.text.slice(0, 220)) + '</p>' +
      '<small>' + escapeHTML(
        note.at ? new Date(note.at).toLocaleDateString() : ""
      ) + '</small></article>'
    ).join("");

    box.querySelectorAll("[data-note-id]").forEach((el) => {
      el.addEventListener("click", () => openNote(el.dataset.noteId));
    });
  }

  function openNote(id) {
    const note = state.notes.find((item) => item.id === id);
    if (!note) return;

    activeNoteId = id;
    $("#ntitle").value = note.title || "";
    $("#nbody").value = note.text || "";
    $("#editor").classList.remove("hidden");
  }

  function closeEditor() {
    activeNoteId = null;
    $("#ntitle").value = "";
    $("#nbody").value = "";
    $("#editor").classList.add("hidden");
  }

  function switchView(view) {
    ["chat", "library"].forEach((name) => {
      $("#" + name)?.classList.toggle("hidden", name !== view);
    });

    document.querySelectorAll(".nav").forEach((button) => {
      button.classList.toggle("active", button.dataset.view === view);
    });

    $("#heading").textContent = view === "chat" ? "Диалог" : "Библиотека";
    $("#sidebar")?.classList.remove("open");
  }

  loginTab?.addEventListener("click", () => {
    authMode = "login";
    loginTab.classList.add("active");
    registerTab?.classList.remove("active");
    $("#authPassword")?.setAttribute("autocomplete", "current-password");
    if (authSubmit) authSubmit.textContent = "Войти";
    setAuthMessage("");
  });

  registerTab?.addEventListener("click", () => {
    authMode = "register";
    registerTab.classList.add("active");
    loginTab?.classList.remove("active");
    $("#authPassword")?.setAttribute("autocomplete", "new-password");
    if (authSubmit) authSubmit.textContent = "Создать аккаунт";
    setAuthMessage("");
  });

  authForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = $("#authEmail").value.trim();
    const password = $("#authPassword").value;

    if (authSubmit) authSubmit.disabled = true;
    setAuthMessage("Подключаемся…");

    try {
      if (authMode === "register") {
        const { data, error } = await client.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin
          }
        });

        if (error) throw error;

        if (data.session) {
          loadLocalData(data.user);
          setAuthMessage("");
          toast("Аккаунт создан.");
        } else {
          setAuthMessage(
            "Регистрация отправлена. Проверь почту и подтверди адрес, затем войди."
          );
        }
      } else {
        const { data, error } = await client.auth.signInWithPassword({
          email,
          password
        });

        if (error) throw error;

        loadLocalData(data.user);
        setAuthMessage("");
        toast("Вход выполнен.");
      }
    } catch (error) {
      setAuthMessage(error.message || "Не удалось выполнить вход.");
    } finally {
      if (authSubmit) authSubmit.disabled = false;
    }
  });

  $("#logout")?.addEventListener("click", async () => {
    const { error } = await client.auth.signOut();
    if (error) {
      toast("Не удалось выйти: " + error.message);
      return;
    }

    currentUser = null;
    state = { messages: [], notes: [] };
    showAuth();
    setAuthMessage("Ты вышел из аккаунта.");
  });

  $("#send")?.addEventListener("click", send);

  $("#prompt")?.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  });

  document.querySelectorAll(".nav").forEach((button) => {
    button.addEventListener("click", () => switchView(button.dataset.view));
  });

  $("#menu")?.addEventListener("click", () => {
    $("#sidebar")?.classList.toggle("open");
  });

  $("#newnote")?.addEventListener("click", () => {
    closeEditor();
    $("#editor").classList.remove("hidden");
    $("#ntitle").focus();
  });

  $("#cancel")?.addEventListener("click", closeEditor);

  $("#save")?.addEventListener("click", () => {
    const title = $("#ntitle").value.trim();
    const text = $("#nbody").value.trim();

    if (!text) {
      toast("Добавь текст заметки.");
      return;
    }

    if (activeNoteId) {
      const note = state.notes.find((item) => item.id === activeNoteId);
      if (note) {
        note.title = title;
        note.text = text;
        note.at = new Date().toISOString();
      }
    } else {
      state.notes.unshift({
        id: crypto.randomUUID(),
        title,
        text,
        at: new Date().toISOString()
      });
    }

    persist();
    renderNotes();
    closeEditor();
    toast("Заметка сохранена на этом устройстве.");
  });

  $("#del")?.addEventListener("click", () => {
    if (!activeNoteId) {
      closeEditor();
      return;
    }

    state.notes = state.notes.filter((note) => note.id !== activeNoteId);
    persist();
    renderNotes();
    closeEditor();
    toast("Заметка удалена.");
  });

  $("#search")?.addEventListener("input", renderNotes);

  $("#export")?.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "oracle-backup.json";
    a.click();
    URL.revokeObjectURL(url);
  });

  $("#import")?.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const imported = JSON.parse(await file.text());
      if (!Array.isArray(imported.messages) ||
          !Array.isArray(imported.notes)) {
        throw new Error("Неверный формат файла.");
      }

      state = {
        messages: imported.messages.slice(-300),
        notes: imported.notes.slice(-100)
      };
      persist();
      render();
      renderNotes();
      toast("Данные импортированы на это устройство.");
    } catch (error) {
      toast("Ошибка импорта: " + error.message);
    } finally {
      event.target.value = "";
    }
  });

  async function init() {
    showAuth();
    setAuthMessage("Проверяем сессию…");

    const { data, error } = await client.auth.getSession();

    if (error) {
      setAuthMessage("Ошибка Supabase: " + error.message);
      return;
    }

    if (data.session?.user) {
      loadLocalData(data.session.user);
      setAuthMessage("");
    } else {
      setAuthMessage("");
    }

    client.auth.onAuthStateChange((event, session) => {
      if (session?.user && !currentUser) {
        loadLocalData(session.user);
      } else if (!session && currentUser) {
        currentUser = null;
        state = { messages: [], notes: [] };
        showAuth();
      }
    });
  }

  init();
})();
