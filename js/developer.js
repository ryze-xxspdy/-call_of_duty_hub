/* ---------- Developer panel: create admins, manage every account ---------- */
const Developer = (() => {
  const esc = Utils.escapeHTML;
  const db = () => Auth.client;
  const fmt = (iso) => iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

  let host = null, me = null, users = [], appeals = [], appealsError = "";
  const fmtTime = (iso) => iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—";
  /** Banned right now? A timed ban that has run out no longer counts. */
  const isBanned = (u) => !!u.banned_at && (!u.ban_until || new Date(u.ban_until) > new Date());

  async function mount(el, user) {
    host = el; me = user;
    if (user.role !== "developer") {
      el.innerHTML = `<h1 class="view-title">Developer</h1><div class="empty-state">This page is for the developer account only.</div>`;
      return;
    }
    el.innerHTML = `<h1 class="view-title">Developer panel</h1><div class="empty-state">Loading…</div>`;
    await reload();
  }

  async function reload() {
    await db().rpc("lift_expired_bans");     // tidy up timed bans whose time is up (ignore errors)
    const { data, error } = await db().from("profiles").select("*").order("created_at", { ascending: false });
    if (error) {
      host.innerHTML = `<h1 class="view-title">Developer panel</h1><div class="empty-state">Couldn't load accounts: ${esc(error.message)}<br><br>Did you re-run <code>supabase/schema.sql</code>?</div>`;
      return;
    }
    users = data;
    const ap = await db().from("ban_appeals").select("*").order("created_at", { ascending: false }).limit(50);
    appeals = ap.data || []; appealsError = ap.error ? ap.error.message : "";
    render();
  }

  function render() {
    const count = (r) => users.filter((u) => u.role === r).length;
    const stat = (l, v) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`;

    const banned = users.filter(isBanned).length;
    const rows = users.map((u) => {
      const self = u.role === "developer";
      const roleCell = self
        ? `<span class="role-tag developer">developer</span>`
        : `<select class="role-select" data-role="${esc(u.id)}">
             <option value="student" ${u.role === "student" ? "selected" : ""}>Student</option>
             <option value="admin" ${u.role === "admin" ? "selected" : ""}>Admin</option>
           </select>`;
      const banBtn = self ? "" : isBanned(u)
        ? `<button class="btn-link" style="color:var(--accent)" data-unban="${esc(u.id)}" data-name="${esc(u.name || u.email)}">Unban</button>`
        : `<button class="btn-link danger" data-ban="${esc(u.id)}" data-name="${esc(u.name || u.email)}">Ban</button>`;
      const action = self ? "" : `${banBtn} <button class="btn-link danger" data-del="${esc(u.id)}" data-name="${esc(u.name || u.email)}">Delete</button>`;
      const status = isBanned(u) ? `<span class="status-pill bad" title="${esc(u.ban_reason || "")}">Banned${u.ban_until ? ` until ${esc(fmtTime(u.ban_until))}` : " · permanent"}</span>` : `<span class="status-pill ok">Active</span>`;
      return `<tr><td>${esc(u.name || "—")}</td><td>${esc(u.email)}</td><td>${roleCell}</td><td>${status}</td><td>${fmt(u.created_at)}</td><td>${action}</td></tr>`;
    }).join("");

    host.innerHTML = `
      <h1 class="view-title">Developer panel</h1>
      <div class="admin">
        <div class="stats">${stat("Accounts", users.length)}${stat("Admins", count("admin"))}${stat("Students", count("student"))}${stat("Banned", banned)}</div>

        <div class="dev-card">
          <h3>Create an admin account</h3>
          <p class="hint">Admin accounts can only be created here. Admins can moderate posts and see users and logins.</p>
          <form class="dev-form" id="admin-form" novalidate>
            <input type="text" id="adm-name" placeholder="Full name" autocomplete="off" />
            <input type="email" id="adm-email" placeholder="Email" autocomplete="off" />
            <input type="password" id="adm-pass" placeholder="Password (min 6)" autocomplete="new-password" />
            <button class="btn primary" type="submit">Create admin</button>
          </form>
          <p class="dev-msg" id="adm-msg" role="alert"></p>
        </div>

        ${appealsCard()}

        <div class="dev-card">
          <h3>All accounts</h3>
          <p class="hint">Change someone between Student and Admin, ban them for a set time or permanently (they are signed out and see a ban pop-up where they can message you), or delete their account (this also deletes their posts). Reports from users are under Admin panel → Reports.</p>
          <div class="table-wrap"><table class="grades-table admin-table">
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Joined</th><th></th></tr></thead>
            <tbody>${rows}</tbody></table></div>
        </div>
      </div>`;

    host.querySelector("#admin-form").addEventListener("submit", onCreate);

    host.querySelectorAll("[data-role]").forEach((sel) => sel.addEventListener("change", async () => {
      const { error } = await db().rpc("set_user_role", { target: sel.dataset.role, new_role: sel.value });
      if (error) { Utils.toast("Couldn't change role: " + error.message); return reload(); }
      Utils.toast("Role updated.");
      reload();
    }));

    host.querySelectorAll("[data-ban]").forEach((b) => b.addEventListener("click", async () => {
      const choice = await Ban.ask({ name: b.dataset.name });
      if (!choice) return;
      const { error } = await db().rpc("ban_user", { target: b.dataset.ban, reason: choice.reason, duration_minutes: choice.minutes });
      if (error) return Utils.toast("Couldn't ban: " + error.message, 4000);
      Utils.toast(`${b.dataset.name} was banned ${Ban.describe(choice.minutes)}.`);
      reload();
    }));

    host.querySelectorAll("[data-unban]").forEach((b) => b.addEventListener("click", async () => {
      if (!confirm(`Unban ${b.dataset.name}? They will be able to log in again.`)) return;
      const { error } = await db().rpc("unban_user", { target: b.dataset.unban });
      if (error) return Utils.toast("Couldn't unban: " + error.message, 4000);
      Utils.toast(`${b.dataset.name} was unbanned.`);
      reload();
    }));

    host.querySelectorAll("[data-appeal-unban]").forEach((b) => b.addEventListener("click", async () => {
      if (!confirm(`Unban ${b.dataset.name}? They will be able to log in again.`)) return;
      const { error } = await db().rpc("unban_user", { target: b.dataset.appealUnban });
      if (error) return Utils.toast("Couldn't unban: " + error.message, 4000);
      Utils.toast(`${b.dataset.name} was unbanned.`);
      reload();
    }));

    host.querySelectorAll("[data-appeal-close]").forEach((b) => b.addEventListener("click", async () => {
      const { error } = await db().rpc("close_ban_appeal", { aid: b.dataset.appealClose });
      if (error) return Utils.toast("Couldn't close: " + error.message, 4000);
      reload();
    }));

    host.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", async () => {
      if (!confirm(`Permanently delete ${b.dataset.name}? This also deletes their posts.`)) return;
      const { error } = await db().rpc("delete_user", { target: b.dataset.del });
      if (error) return Utils.toast("Couldn't delete: " + error.message);
      Utils.toast("Account deleted.");
      reload();
    }));
  }

  /** Messages from banned people: unban them, or close the message. */
  function appealsCard() {
    if (appealsError) {
      return `<div class="dev-card"><h3>Ban appeals</h3><p class="hint">Couldn't load appeals: ${esc(appealsError)}. Re-run <code>supabase/schema.sql</code> (section 24).</p></div>`;
    }
    const open = appeals.filter((a) => a.status === "open");
    if (!open.length) {
      return `<div class="dev-card"><h3>Ban appeals</h3><p class="hint" style="margin:0">No messages from banned users. When someone you banned writes to you from the ban pop-up, it shows here and in your Messages.</p></div>`;
    }
    const cards = open.map((a) => {
      const u = users.find((x) => x.id === a.user_id) || { id: a.user_id, name: "Unknown", email: "" };
      const still = isBanned(u);
      return `<div class="appeal-card">
        <div class="appeal-top">
          <a class="person-main" href="#user-${esc(u.id)}" style="color:inherit">
            <div><strong>${esc(u.name || u.email)}</strong><small>${esc(u.email)} · ${esc(fmtTime(a.created_at))}</small></div>
          </a>
          ${still ? `<span class="status-pill bad">${u.ban_until ? `Banned until ${esc(fmtTime(u.ban_until))}` : "Banned · permanent"}</span>` : `<span class="status-pill ok">Not banned now</span>`}
        </div>
        ${u.ban_reason ? `<small class="dim">Ban reason: ${esc(u.ban_reason)}</small>` : ""}
        <p class="appeal-msg">${esc(a.message)}</p>
        <div class="appeal-actions">
          ${still ? `<button class="btn-sm primary" type="button" data-appeal-unban="${esc(u.id)}" data-name="${esc(u.name || u.email)}">Unban</button>` : ""}
          <a class="btn-sm" href="#messages-${esc(u.id)}">Open chat</a>
          <button class="btn-sm ghost" type="button" data-appeal-close="${esc(a.id)}">Dismiss</button>
        </div>
      </div>`;
    }).join("");
    return `<div class="dev-card"><h3>Ban appeals <span class="count-chip">${open.length}</span></h3>
      <p class="hint">Messages from banned people, sent from their ban pop-up. Unban them here, or dismiss to ignore.</p>${cards}</div>`;
  }

  async function onCreate(e) {
    e.preventDefault();
    const msg = host.querySelector("#adm-msg");
    const name = host.querySelector("#adm-name").value;
    const email = host.querySelector("#adm-email").value;
    const password = host.querySelector("#adm-pass").value;
    msg.className = "dev-msg"; msg.textContent = "";

    if (name.trim().length < 2) return (msg.textContent = "Enter the admin's full name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return (msg.textContent = "Enter a valid email address.");
    if (password.length < 6) return (msg.textContent = "Password must be at least 6 characters.");

    const btn = e.submitter; if (btn) btn.disabled = true;
    try {
      await Auth.createAdmin({ name, email, password });
      Utils.toast(`Admin account created for ${email.trim()}.`, 3500);
      await reload();
    } catch (ex) {
      msg.textContent = ex.message;
      if (btn) btn.disabled = false;
    }
  }

  return { mount };
})();
