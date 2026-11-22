/* ---------- Global chat: one public room for every signed-in account ----------
   Everybody can read it and write in it, live. You can delete your own messages; admins / the developer can delete any.
   The sidebar link shows how many new messages arrived since you last had the chat open.
   Needs supabase/schema.sql section 26 (table global_messages). */
const GlobalChat = (() => {
  const esc = Utils.escapeHTML;
  const db = () => Auth.client;
  const PAGE = 100;          // messages loaded at first / per "earlier messages" press
  const KEEP = 400;          // messages kept in memory

  let me: any = null;
  let msgs: any[] = [];
  let hasMore = false;
  let problem = "";          // set when the table isn't there yet (schema not re-run)
  let channel: any = null;
  let unread = 0;
  let host: HTMLElement | null = null;       // the page currently showing the chat
  let paint: ((stick?: boolean, keepPlace?: boolean) => void) | null = null;
  const listeners: (() => void)[] = [];

  const on = (fn: () => void) => listeners.push(fn);
  const emit = () => listeners.forEach((fn) => fn());

  const seenKey = () => `confesshub.globalchat.seen.${me.id}`;
  const viewing = () => !!host && host.isConnected && location.hash === "#global-chat";

  function markSeen() {
    try { localStorage.setItem(seenKey(), new Date().toISOString()); } catch { /* storage blocked */ }
    if (unread) { unread = 0; emit(); }
  }

  const clock = (iso: string) => Utils.formatTime(new Date(iso));
  function dayLabel(iso: string): string {
    const d = new Date(iso), diff = Utils.daysBetween(d, new Date());
    return diff === 0 ? "Today" : diff === 1 ? "Yesterday" : Utils.formatLongDate(d);
  }

  async function needProfiles(list: any[]) {
    const ids = [...new Set(list.map((m) => m.user_id))].filter((id) => Social.person(id).name === "Unknown");
    if (ids.length) await Social.fetchProfiles(ids);
  }

  function friendly(message: string): string {
    if (/schema cache|relation|does not exist/i.test(message)) return "Re-run supabase/schema.sql in Supabase (section 26) to turn on the global chat.";
    if (/banned/i.test(message)) return "Your account has been banned.";
    if (/too fast|slow down/i.test(message)) return "Slow down a little. You are sending messages too fast.";
    return message;
  }

  /* ---------- data ---------- */
  async function load() {
    const { data, error } = await db().from("global_messages").select("*").order("created_at", { ascending: false }).limit(PAGE);
    if (error) { problem = friendly(error.message); msgs = []; hasMore = false; return; }
    problem = "";
    msgs = data.slice().reverse();
    hasMore = data.length === PAGE;
    await needProfiles(msgs);
  }

  async function countUnread() {
    let since: string | null = null;
    try { since = localStorage.getItem(seenKey()); } catch { /* storage blocked */ }
    if (!since) { markSeen(); return; }                  // first time ever: start counting from now
    const { count, error } = await db().from("global_messages").select("id", { count: "exact", head: true })
      .gt("created_at", since).neq("user_id", me.id);
    unread = error ? 0 : count || 0;
    emit();
  }

  async function incoming(m: any) {
    if (!m || msgs.some((x) => x.id === m.id)) return;
    msgs.push(m);
    if (msgs.length > KEEP) msgs = msgs.slice(-KEEP);
    await needProfiles([m]);
    if (viewing()) { if (paint) paint(false); markSeen(); }
    else if (m.user_id !== me.id) { unread++; emit(); }
  }

  function removed(id: string) {
    if (!msgs.some((m) => m.id === id)) return;
    msgs = msgs.filter((m) => m.id !== id);
    if (viewing() && paint) paint(false);
  }

  /** Starts the live connection. Call once after sign-in. */
  async function init(user: any) {
    me = user;
    await load();
    await countUnread();
    if (channel) return;
    channel = db().channel("global-chat")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "global_messages" }, (p: any) => incoming(p.new))
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "global_messages" }, (p: any) => removed(p.old && p.old.id))
      .subscribe();
  }

  async function send(body: string): Promise<string | null> {
    const text = body.trim();
    if (!text) return null;
    const { data, error } = await db().from("global_messages").insert({ user_id: me.id, body: text }).select().single();
    if (error) return friendly(error.message);
    await incoming(data);
    return null;
  }

  async function remove(id: string, mine: boolean) {
    if (!mine && !confirm("Delete this message for everyone?")) return;
    const before = msgs;
    msgs = msgs.filter((m) => m.id !== id);
    if (paint) paint(false);
    const { error } = await db().from("global_messages").delete().eq("id", id);
    if (error) { msgs = before; if (paint) paint(false); Utils.toast("Couldn't delete: " + friendly(error.message), 4000); }
  }

  async function loadEarlier(btn: HTMLButtonElement) {
    if (!msgs.length) return;
    btn.disabled = true;
    const { data, error } = await db().from("global_messages").select("*")
      .lt("created_at", msgs[0].created_at).order("created_at", { ascending: false }).limit(PAGE);
    if (error) { btn.disabled = false; Utils.toast("Couldn't load earlier messages.", 3000); return; }
    hasMore = data.length === PAGE;
    const older = data.slice().reverse();
    await needProfiles(older);
    msgs = [...older, ...msgs];
    if (paint) paint(false, true);
  }

  /* ---------- page ---------- */
  function row(m: any, prev: any | null): string {
    const mine = m.user_id === me.id;
    const p = Social.person(m.user_id);
    const newDay = !prev || Utils.daysBetween(new Date(prev.created_at), new Date(m.created_at)) !== 0;
    const grouped = !!prev && !newDay && prev.user_id === m.user_id && +new Date(m.created_at) - +new Date(prev.created_at) < 4 * 60000;
    const canDelete = mine || Auth.isStaff(me);
    return `${newDay ? `<div class="gc-day"><span>${esc(dayLabel(m.created_at))}</span></div>` : ""}
      <div class="gc-msg ${mine ? "mine" : ""} ${grouped ? "grouped" : ""}" data-id="${esc(m.id)}">
        ${mine ? "" : `<a class="gc-av" href="#user-${esc(m.user_id)}" aria-label="${esc(p.name)}">${grouped ? "" : Utils.avatar(p.name, p.avatar, "sm")}</a>`}
        <div class="gc-col">
          ${grouped ? "" : `<div class="gc-meta">${mine ? "" : `<a href="#user-${esc(m.user_id)}"><strong>${Utils.nameWithBadge(p.name, p.role)}</strong></a>`}<small>${clock(m.created_at)}</small></div>`}
          <div class="gc-line">
            <div class="gc-bubble"><p>${esc(m.body)}</p></div>
            ${canDelete ? `<button type="button" class="gc-del" data-del="${esc(m.id)}" data-mine="${mine ? 1 : 0}" title="Delete message" aria-label="Delete message">🗑</button>` : ""}
          </div>
        </div>
      </div>`;
  }

  function mount(view: HTMLElement, user: any) {
    me = user;
    host = view;
    view.innerHTML = `
      <h1 class="view-title">Global chat</h1>
      <div class="chat-pane gchat">
        <div class="chat-head gc-head">
          <span class="gc-globe" aria-hidden="true">🌍</span>
          <div><strong>Global chat</strong><small>Open to everyone with an account. Be kind.</small></div>
        </div>
        <div class="chat-log gc-log" id="gc-log"></div>
        <button type="button" class="gc-new hidden" id="gc-new">↓ New messages</button>
        <form class="chat-form" id="gc-form" autocomplete="off">
          <input class="text-input" id="gc-input" maxlength="500" placeholder="Say something to everyone…" enterkeyhint="send" />
          <button class="btn primary" type="submit">Send</button>
        </form>
      </div>`;

    const log = view.querySelector<HTMLElement>("#gc-log")!;
    const pill = view.querySelector<HTMLElement>("#gc-new")!;
    const form = view.querySelector<HTMLFormElement>("#gc-form")!;
    const input = view.querySelector<HTMLInputElement>("#gc-input")!;
    const nearBottom = () => log.scrollHeight - log.scrollTop - log.clientHeight < 90;

    paint = (stick = true, keepPlace = false) => {
      if (!view.isConnected) return;
      const wasBottom = nearBottom(), oldH = log.scrollHeight, oldTop = log.scrollTop;
      if (problem) { log.innerHTML = `<div class="empty">${esc(problem)}</div>`; return; }
      const more = hasMore ? `<button type="button" class="btn-sm ghost gc-more" id="gc-more">Load earlier messages</button>` : "";
      log.innerHTML = msgs.length
        ? more + msgs.map((m, i) => row(m, i ? msgs[i - 1] : null)).join("")
        : `<div class="empty">No messages yet. Say hello to everyone! 👋</div>`;
      if (keepPlace) log.scrollTop = oldTop + (log.scrollHeight - oldH);
      else if (stick || wasBottom) log.scrollTop = log.scrollHeight;
      else { log.scrollTop = oldTop; pill.classList.remove("hidden"); }
      if (nearBottom()) pill.classList.add("hidden");
    };

    log.addEventListener("scroll", () => { if (nearBottom()) pill.classList.add("hidden"); });
    pill.addEventListener("click", () => { log.scrollTop = log.scrollHeight; pill.classList.add("hidden"); });
    log.addEventListener("click", (e) => {
      const t = e.target as Element;
      const del = t.closest<HTMLElement>("[data-del]");
      if (del) { remove(del.dataset.del!, del.dataset.mine === "1"); return; }
      const more = t.closest<HTMLButtonElement>("#gc-more");
      if (more) loadEarlier(more);
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text) return;
      input.value = "";
      const err = await send(text);
      if (err) { input.value = text; Utils.toast(err, 4000); return; }
      if (paint) paint(true);
      input.focus();
    });

    paint(true);
    markSeen();
    // Refresh from the database when the page opens (the live feed may have missed something while the tab slept).
    load().then(() => needProfiles(msgs)).then(() => { if (host === view && view.isConnected && paint) { paint(false); markSeen(); } });
    if (!window.matchMedia("(hover: none)").matches) input.focus();
  }

  return { init, on, mount, get unreadCount() { return unread; } };
})();
