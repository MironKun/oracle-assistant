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

  async function cloudInsertMessage(role, content, at = new Date().toISOString()) {
    if (!currentUser) return;

    const { error } = await client.from("oracle_messages").insert({
      user_id: currentUser.id,
      role,
      content,
      created_at: at
    });

    if (error) throw error;
  }

  async function cloudInsertNote(note) {
    if (!currentUser) throw new Error("Нет активного пользователя.");

    const { data, error } = await client.from("oracle_memory").insert({
      user_id: currentUser.id,
      title: note.title || "",
      note: note.text,
      created_at: note.at || new Date().toISOString()
    }).select("id,title,note,created_at").single();

    if (error) throw error;

    note.id = String(data.id);
    note.cloudId = data.id;
    note.at = data.created_at;

    return data;
  }

  async function cloudUpdateNote(note) {
    if (!currentUser) throw new Error("Нет активного пользователя.");

    const id = note.cloudId ||
      (/^\d+$/.test(String(note.id)) ? Number(note.id) : null);

    if (id === null) {
      await cloudInsertNote(note);
      return;
    }

    const { error } = await client.from("oracle_memory")
      .update({
        title: note.title || "",
        note: note.text
      })
      .eq("id", id)
      .eq("user_id", currentUser.id);

    if (error) throw error;

    note.cloudId = id;
  }

  async function cloudDeleteNote(note) {
    if (!currentUser || !note) return;

    const id = note.cloudId ||
      (/^\d+$/.test(String(note.id)) ? Number(note.id) : null);

    if (id === null) return;

    const { error } = await client.from("oracle_memory")
      .delete()
      .eq("id", id)
      .eq("user_id", currentUser.id);

    if (error) throw error;
  }

  async function loadCloudData(user) {
    const [notesResult, messagesResult] = await Promise.all([
      client.from("oracle_memory")
        .select("id,title,note,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(100),

      client.from("oracle_messages")
        .select("id,role,content,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .limit(300)
    ]);

    if (notesResult.error) throw notesResult.error;
    if (messagesResult.error) throw messagesResult.error;

    const cloudNotes = (notesResult.data || []).map((n) => ({
      id: String(n.id),
      cloudId: n.id,
      title: n.title || "",
      text: n
