"use strict";
/* ---------- Admin panel: users, new logins, post moderation ---------- */
const Admin = (() => {
    const esc = Utils.escapeHTML;
    const db = () => Auth.client;
    const fmt = (iso) => iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—";
    const DAY = 86400000;
    let host = null;
    let me = null;
    let tab = "logins";
    let data = { users: [], logins: [], posts: [], requests: [], reports: [] };
    let watching = false;
    /** Only the developer can ban or dismiss; admins can read the reports. */
    const canAct = () => !!me && me.role === "developer";
    async function mount(el, user, startTab) {
        host = el;
        me = user;
        if (startTab)
            tab = startTab;
        if (!Auth.isStaff(user)) {
            el.innerHTML = `<h1 class="view-title">Admin</h1><div class="empty-state">This page is for admins only.</div>`;
            return;
        }
        el.innerHTML = `<h1 class="view-title">Admin panel</h1><div class="empty-state">Loading…</div>`;
        await reload();
    }
    /** Toast + refresh whenever someone logs in (admins only). */
    function watch(user) {
        if (watching || !Auth.isStaff(user))
            return;
        watching = true;
        me = me || user;
        refreshBadge();
        // New / handled reports: update the red number on "Admin panel" and the Reports tab.
        db().channel("admin-reports")
            .on("postgres_changes", { event: "*", schema: "public", table: "reports" }, () => {
            refreshBadge();
            if (host && host.isConnected && host.querySelector(".admin"))
                reload();
        })
            .subscribe();
        db().channel("admin-logins")
            .on("postgres_changes", { event: "INSERT", schema: "public", table: "login_events" }, (payload) => {
            const n = payload.new || {};
            if (n.user_id !== user.id)
                Utils.toast(`New login: ${n.name || n.email || "a user"}`, 4000);
            if (host && document.body.contains(host.querySelector(".admin")))
                reload();
        })
            .subscribe();
        // New / reviewed community requests: keep the Communities tab live.
        db().channel("admin-community-requests")
            .on("postgres_changes", { event: "*", schema: "public", table: "community_requests" }, () => {
            if (host && host.isConnected && host.querySelector(".admin"))
                reload();
        })
            .subscribe();
    }
    /** Red number next to "Admin panel": reports still waiting. */
    async function refreshBadge() {
        const el = document.getElementById("admin-badge");
        if (!el)
            return;
        const { count, error } = await db().from("reports").select("id", { count: "exact", head: true }).eq("status", "open");
        const n = error ? 0 : (count || 0);
        el.textContent = n > 99 ? "99+" : n;
        el.classList.toggle("hidden", n === 0);
    }
    async function reload() {
        const [u, l, p, c, rp] = await Promise.all([
            db().from("profiles").select("*").order("created_at", { ascending: false }),
            db().from("login_events").select("*").order("created_at", { ascending: false }).limit(200),
            db().from("posts").select("*").order("created_at", { ascending: false }).limit(100),
            db().from("community_requests").select("*").order("created_at", { ascending: false }).limit(200),
            db().from("reports").select("*").order("created_at", { ascending: false }).limit(200)
        ]);
        // Communities are optional: a missing table shouldn't break the rest of the panel.
        const err = u.error || l.error || p.error;
        if (err) {
            host.innerHTML = `<h1 class="view-title">Admin panel</h1><div class="empty-state">Couldn't load admin data: ${esc(err.message)}<br><br>Did you run <code>supabase/schema.sql</code>?</div>`;
            return;
        }
        data = { users: u.data, logins: l.data, posts: p.data, requests: c.error ? [] : c.data, requestsError: c.error ? c.error.message : null,
            reports: rp.error ? [] : rp.data, reportsError: rp.error ? rp.error.message : null };
        refreshBadge();
        render();
    }
    function render() {
        const now = Date.now();
        const lastLogin = {};
        data.logins.forEach((e) => { if (!lastLogin[e.user_id])
            lastLogin[e.user_id] = e.created_at; });
        const logins24 = data.logins.filter((e) => now - +new Date(e.created_at) < DAY).length;
        const admins = data.users.filter((x) => x.role === "admin" || x.role === "developer").length;
        const stat = (label, value) => `<div class="stat"><b>${value}</b><span>${label}</span></div>`;
        const pendingReqs = data.requests.filter((r) => r.status === "pending");
        const openReports = data.reports.filter((r) => r.status === "open");
        const tabs = [["logins", "New logins"], ["users", "Users"], ["posts", "Posts"], ["communities", "Communities"], ["reports", "Reports"]]
            .map(([k, n]) => {
            const count = k === "communities" ? pendingReqs.length : k === "reports" ? openReports.length : 0;
            return `<button class="tab ${tab === k ? "active" : ""}" data-tab="${k}">${n}${count ? ` <span class="nav-badge" style="margin-left:6px">${count}</span>` : ""}</button>`;
        }).join("");
        let body = "";
        if (tab === "logins") {
            body = table(["User", "Email", "Logged in"], data.logins.map((e) => {
                const fresh = now - +new Date(e.created_at) < 3600000 ? ` <span class="chip-new">NEW</span>` : "";
                return [`${esc(e.name || "—")}${fresh}`, esc(e.email), fmt(e.created_at)];
            }), "No logins recorded yet.");
        }
        else if (tab === "users") {
            body = table(["Name", "Email", "Role", "Status", "Joined", "Last login"], data.users.map((x) => [esc(x.name || "—"), esc(x.email), `<span class="role-tag ${esc(x.role)}">${esc(x.role)}</span>`,
                (x.banned_at && (!x.ban_until || new Date(x.ban_until) > new Date())) ? `<span class="status-pill bad" title="${esc(x.ban_reason || "")}">Banned</span>` : x.setup_complete === false ? `<span class="status-pill">Setting up</span>` : `<span class="status-pill ok">Active</span>`,
                fmt(x.created_at), fmt(lastLogin[x.id])]), "No users yet.");
        }
        else if (tab === "communities") {
            body = communitiesTab(pendingReqs);
        }
        else if (tab === "reports") {
            body = reportsTab(openReports);
        }
        else {
            body = table(["Author", "Post", "Posted", ""], data.posts.map((p) => [
                esc(p.author_name),
                esc((p.body || "").slice(0, 80)) + (p.media_url ? ` <span class="chip-new">${esc(p.media_type || "media")}</span>` : ""),
                fmt(p.created_at),
                `<button class="btn-link danger" data-del="${esc(p.id)}">Delete</button>`
            ]), "No posts yet.");
        }
        host.innerHTML = `
      <h1 class="view-title">Admin panel</h1>
      <div class="admin">
        <div class="stats">${stat("Total users", data.users.length)}${stat("Admins + dev", admins)}${stat("Logins (24h)", logins24)}${stat("Posts", data.posts.length)}</div>
        <div class="tabs">${tabs}</div>
        ${body}
      </div>`;
        Communities.bindReview(host, reload);
        bindReports();
        host.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => { tab = b.dataset.tab; render(); }));
        host.querySelectorAll("[data-del]").forEach((b) => b.addEventListener("click", async () => {
            if (!confirm("Delete this post?"))
                return;
            const { error } = await db().from("posts").delete().eq("id", b.dataset.del);
            if (error)
                return Utils.toast("Couldn't delete: " + error.message);
            Utils.toast("Post deleted.");
            reload();
        }));
    }
    /* ---------- Reports ---------- */
    const who = (id) => data.users.find((x) => x.id === id) || { id, name: "Deleted user", avatar: null, role: "student" };
    function reportCard(r, perUser) {
        const target = who(r.reported_id), by = who(r.reporter_id);
        const total = perUser[r.reported_id] || 1;
        const open = r.status === "open";
        const pill = r.status === "banned" ? `<span class="status-pill bad">User banned</span>`
            : r.status === "dismissed" ? `<span class="status-pill">Dismissed</span>` : "";
        const post = r.post_snapshot !== null && r.post_snapshot !== undefined ? `
      <div class="report-post"><small>Reported post</small>
        <p>${r.post_snapshot ? esc(r.post_snapshot) : '<span class="dim">(photo / video only)</span>'}</p>
        ${r.post_id ? `<a class="btn-link" href="#post-${esc(r.post_id)}" style="padding:0;color:var(--accent)">Open post</a>` : `<small class="dim">The post was deleted.</small>`}
      </div>` : "";
        const actions = !open ? `<div class="report-foot">${pill}${r.note ? `<small class="dim">${esc(r.note)}</small>` : ""}<small class="dim">${fmt(r.handled_at)}</small></div>`
            : canAct() ? `<div class="report-foot">
          <button class="btn-sm danger-fill" type="button" data-rban="${esc(r.id)}">Ban user</button>
          <button class="btn-sm ghost" type="button" data-rdismiss="${esc(r.id)}">Dismiss</button>
        </div>`
                : `<div class="report-foot"><span class="status-pill">Waiting for the developer</span></div>`;
        return `
      <div class="report-card ${open ? "open" : ""}">
        <div class="report-top">
          <a class="person-main" href="#user-${esc(target.id)}">
            ${Utils.avatar(target.name, target.avatar)}
            <div><strong>${Utils.nameWithBadge(target.name, target.role)}</strong>
              <small>${total} report${total === 1 ? "" : "s"} against this user${(target.banned_at && (!target.ban_until || new Date(target.ban_until) > new Date())) ? " · currently banned" : ""}</small></div>
          </a>
          <span class="report-reason-chip">${esc(Reports.label(r.reason))}</span>
        </div>
        <p class="report-meta">Reported by <a href="#user-${esc(by.id)}" style="color:var(--accent)">${esc(by.name)}</a> · ${fmt(r.created_at)}</p>
        ${r.details ? `<p class="report-details">${esc(r.details)}</p>` : ""}
        ${post}
        ${actions}
      </div>`;
    }
    function reportsTab(openReports) {
        if (data.reportsError) {
            return `<div class="empty-state">Couldn't load reports: ${esc(data.reportsError)}<br><br>Re-run <code>supabase/schema.sql</code> (section 23) in Supabase.</div>`;
        }
        const perUser = {};
        data.reports.forEach((r) => { perUser[r.reported_id] = (perUser[r.reported_id] || 0) + 1; });
        const done = data.reports.filter((r) => r.status !== "open").slice(0, 40);
        return `
      ${canAct() ? "" : `<p class="hint" style="margin:0 0 12px">You can read every report. Only the developer can ban a user or dismiss a report.</p>`}
      <h2 class="section-title">Waiting for review <span class="count-chip">${openReports.length}</span></h2>
      ${openReports.length ? openReports.map((r) => reportCard(r, perUser)).join("") : `<div class="empty">No open reports. 🎉</div>`}
      ${done.length ? `<h2 class="section-title">Handled</h2>${done.map((r) => reportCard(r, perUser)).join("")}` : ""}`;
    }
    function bindReports() {
        host.querySelectorAll("[data-rban]").forEach((b) => b.addEventListener("click", async () => {
            const r = data.reports.find((x) => x.id === b.dataset.rban);
            if (!r)
                return;
            const choice = await Ban.ask({ name: who(r.reported_id).name, reason: Reports.label(r.reason) });
            if (!choice)
                return;
            b.disabled = true;
            const { error } = await db().rpc("review_report", { rid: r.id, act: "ban", note: choice.reason, duration_minutes: choice.minutes });
            if (error) {
                b.disabled = false;
                return Utils.toast("Couldn't ban: " + error.message, 4000);
            }
            Utils.toast("User banned.");
            reload();
        }));
        host.querySelectorAll("[data-rdismiss]").forEach((b) => b.addEventListener("click", async () => {
            const note = prompt("Dismiss this report? Add a note for your records (optional):", "");
            if (note === null)
                return;
            b.disabled = true;
            const { error } = await db().rpc("review_report", { rid: b.dataset.rdismiss, act: "dismiss", note });
            if (error) {
                b.disabled = false;
                return Utils.toast("Couldn't dismiss: " + error.message, 4000);
            }
            Utils.toast("Report dismissed.");
            reload();
        }));
    }
    function communitiesTab(pendingReqs) {
        if (data.requestsError) {
            return `<div class="empty-state">Couldn't load community requests: ${esc(data.requestsError)}<br><br>Re-run <code>supabase/schema.sql</code> in Supabase.</div>`;
        }
        const who = (id) => data.users.find((x) => x.id === id) || { name: "Unknown", avatar: null };
        const done = data.requests.filter((r) => r.status !== "pending").slice(0, 30);
        const pill = (st) => `<span class="status-pill ${st === "approved" ? "ok" : "bad"}">${st[0].toUpperCase() + st.slice(1)}</span>`;
        return `
      <h2 class="section-title">Waiting for review <span class="count-chip">${pendingReqs.length}</span></h2>
      ${pendingReqs.length ? pendingReqs.map((r) => Communities.reviewRow(r, who(r.requester_id))).join("")
            : `<div class="empty">No requests waiting.</div>`}
      ${done.length ? `<h2 class="section-title">Recently reviewed</h2>` + done.map((r) => `
        <div class="person-row">
          <div class="person-main" style="cursor:default"><div><strong>${esc(r.name)}</strong>
            <small>${esc(who(r.requester_id).name)} · ${fmt(r.reviewed_at || r.created_at)}</small></div></div>
          <div class="person-actions">${pill(r.status)}</div>
        </div>`).join("") : ""}`;
    }
    function table(head, rows, empty) {
        if (!rows.length)
            return `<div class="empty-state">${empty}</div>`;
        return `<div class="table-wrap"><table class="grades-table admin-table">
      <thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
      <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
    }
    return { mount, watch };
})();
