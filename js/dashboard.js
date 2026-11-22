"use strict";
/* ---------- Dashboard ---------- */
(async function () {
    const user = await Auth.requireAuth();
    if (!user)
        return;
    // Brand-new account? It must finish its profile (username, photo, banner, bio, optional phone) first.
    if (Onboarding.needed(user))
        await Onboarding.run(user);
    const $ = (s, r = document) => r.querySelector(s);
    const $$ = (s, r = document) => [...r.querySelectorAll(s)];
    const esc = Utils.escapeHTML;
    /* ---------- boot ---------- */
    init();
    async function init() {
        watchBan();
        setupChrome();
        await Social.init(user, { onMeChange: paintMe });
        Communities.init(user);
        Messages.on(updateBadges);
        Messages.init(user);
        Notify.on(() => { renderNotifications(); updateBadges(); });
        Announce.on(() => {
            renderNotifications();
            updateBadges();
            if (location.hash === "#announcements" && $("#ann-list"))
                paintAnnList();
        });
        Social.on("relations", () => { renderFriendsNav(); renderNotifications(); updateBadges(); paintRequests(); });
        Social.on("presence", () => renderFriendsNav());
        renderFriendsNav();
        renderNotifications();
        updateBadges();
        applyRole();
        window.addEventListener("hashchange", route);
        route();
        // Starts last so an "you're now an admin" pop-up appears over a fully drawn page.
        await Notify.init(user, { onRoleChange: refreshRole });
        await Announce.init(user);
    }
    /** If the developer bans this account while it is open, sign out right away (checked every 30 s and on focus). */
    function watchBan() {
        const check = () => Auth.checkBanned(user.id).then((banned) => { if (banned)
            window.location.replace("index.html"); });
        setInterval(check, 30000);
        window.addEventListener("focus", check);
        Auth.client.auth.onAuthStateChange((event) => { if (event === "SIGNED_OUT")
            window.location.replace("index.html"); });
    }
    /** Show / hide the Admin + Developer links for the current role. */
    function applyRole() {
        $("#nav-admin").classList.toggle("hidden", !Auth.isStaff(user));
        $("#nav-developer").classList.toggle("hidden", user.role !== "developer");
        if (Auth.isStaff(user))
            Admin.watch(user);
    }
    /** The developer just changed this account's role: reload it and update the page without a refresh. */
    async function refreshRole() {
        const fresh = await Auth.currentUser();
        if (!fresh || fresh.role === user.role)
            return;
        Object.assign(user, fresh); // same object Social / Feed / Communities hold
        applyRole();
        paintMe();
        route();
    }
    /* ---------- chrome: sidebar, theme, menus ---------- */
    function setupChrome() {
        paintMe();
        const app = $("#app");
        if (window.innerWidth <= 1099)
            app.classList.add("collapsed");
        $("#menu-btn").addEventListener("click", () => app.classList.toggle("collapsed"));
        $("#scrim").addEventListener("click", () => app.classList.add("collapsed"));
        // mobile bottom nav: "More" opens the full sidebar menu
        $("#bn-more").addEventListener("click", () => app.classList.toggle("collapsed"));
        $("#theme-btn").addEventListener("click", () => {
            const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
            document.documentElement.setAttribute("data-theme", next);
            try {
                localStorage.setItem("studyhub.theme", next);
            }
            catch { }
        });
        $("#notif-btn").addEventListener("click", (e) => { e.stopPropagation(); $("#notif-panel").classList.toggle("hidden"); $("#user-menu").classList.add("hidden"); });
        $("#avatar-btn").addEventListener("click", (e) => { e.stopPropagation(); $("#user-menu").classList.toggle("hidden"); $("#notif-panel").classList.add("hidden"); });
        document.addEventListener("click", (e) => {
            if (!e.target.closest(".notif-wrap"))
                $("#notif-panel").classList.add("hidden");
            if (!e.target.closest(".user-wrap"))
                $("#user-menu").classList.add("hidden");
        });
        $("#logout-btn").addEventListener("click", Auth.logout);
        $("#notif-panel").addEventListener("click", async (e) => {
            e.stopPropagation(); // the panel re-renders mid-click; don't let the outside-click handler close it
            const fb = e.target.closest("[data-friend]");
            if (fb) {
                fb.disabled = true;
                await Social.respond(fb.dataset.id, fb.dataset.friend === "accept");
                return;
            }
            if (e.target.closest("#notif-readall")) {
                Notify.markAllRead();
                Announce.markAllSeen();
                return;
            }
            const link = e.target.closest("a");
            if (link) {
                if (link.dataset.nid)
                    Notify.markRead(link.dataset.nid);
                $("#notif-panel").classList.add("hidden");
            }
        });
        $("#user-menu").addEventListener("click", (e) => { if (e.target.closest("a"))
            $("#user-menu").classList.add("hidden"); });
        $("#chat-btn").addEventListener("click", () => { location.hash = "#messages"; });
        [["classes-toggle", "classes-subnav"], ["library-toggle", "library-subnav"]].forEach(([btn, panel]) => {
            $("#" + btn).addEventListener("click", () => {
                const b = $("#" + btn);
                const open = b.getAttribute("aria-expanded") === "true";
                b.setAttribute("aria-expanded", !open);
                $("#" + panel).classList.toggle("hidden", open);
            });
        });
    }
    /** Top-right avatar + menu text (re-run after the profile is edited). */
    function paintMe() {
        const avatar = $("#avatar-btn");
        avatar.innerHTML = user.avatar ? `<img src="${esc(user.avatar)}" alt="" />` : esc(Utils.initials(user.name));
        $("#menu-name").innerHTML = Utils.nameWithBadge(user.name, user.role);
        $("#menu-email").textContent = user.email;
    }
    function renderFriendsNav() {
        const list = Social.friends();
        mountInto($("#classes-subnav"), list.length
            ? list.map((f) => h("a", { className: "subnav-item friend-link", href: `#user-${f.id}` },
                h("i", { className: "dot" + (Social.isOnline(f.id) ? " on" : "") }),
                f.name))
            : h("span", { className: "subnav-item dim" }, "No friends yet"));
    }
    const NOTIF_ICON = { staff_login: "🟢", role: "🛡️", community_request: "📨", community_approved: "✅", community_rejected: "⚠️", community_added: "👥", post_reaction: "👍", post_comment: "💬", comment_reply: "↩️", report: "🚩" };
    function renderNotifications() {
        const reqs = Social.incoming().map(({ p }) => (h("div", { className: "notif-item notif-friend" },
            h("div", { className: "notif-row" },
                raw(Utils.avatar(p.name, p.avatar, "sm")),
                h("div", null,
                    h("strong", null,
                        p.name,
                        " sent you a friend request"),
                    h("small", null, "Add them as a friend?"))),
            h("div", { className: "notif-actions" },
                h("button", { className: "btn-sm primary", "data-friend": "accept", "data-id": p.id }, "Add friend"),
                h("button", { className: "btn-sm ghost", "data-friend": "decline", "data-id": p.id }, "Decline")))));
        const mine = Notify.list().map((n) => (h("a", { className: "notif-item notif-sys" + (n.read ? "" : " unread"), href: n.link || "#dashboard", "data-nid": n.id, style: "display:block" },
            h("div", { className: "notif-row" },
                h("span", { className: "notif-emoji" }, NOTIF_ICON[n.kind] || "🔔"),
                h("div", null,
                    h("strong", null, n.title),
                    h("span", { className: "notif-body" }, n.body),
                    h("small", null,
                        timeAgo(n.created_at),
                        n.kind === "role" || n.kind === "staff_login" || n.kind.startsWith("community_") ? " · Admin / Developer" : ""))))));
        const anns = Announce.list().slice(0, 5).map((a) => (h("a", { className: "notif-item notif-sys" + (Announce.isNew(a) ? " unread" : ""), href: "#announcements", style: "display:block" },
            h("div", { className: "notif-row" },
                h("span", { className: "notif-emoji" }, "\uD83D\uDCE2"),
                h("div", null,
                    h("strong", null, a.title),
                    h("small", null,
                        a.author_name || "Admin",
                        " \u00B7 ",
                        timeAgo(a.created_at),
                        " \u00B7 Announcement"))))));
        const all = [...reqs, ...mine, ...anns];
        mountInto($("#notif-panel"), (Notify.unreadCount || Announce.newCount) ? (h("div", { className: "notif-head" },
            h("span", null, "Notifications"),
            h("button", { className: "btn-link", id: "notif-readall", type: "button" }, "Mark all as read"))) : null, all.length ? all : h("div", { className: "empty" }, "You're all caught up."));
    }
    function timeAgo(iso) {
        const s = Math.max(0, (Date.now() - +new Date(iso)) / 1000);
        if (s < 60)
            return "just now";
        if (s < 3600)
            return Math.floor(s / 60) + " min ago";
        if (s < 86400)
            return Math.floor(s / 3600) + " h ago";
        return Utils.formatShortDate(new Date(iso));
    }
    function updateBadges() {
        const pending = Social.pendingCount;
        const total = pending + Notify.unreadCount + Announce.newCount; // real counts only
        const nb = $("#notif-badge");
        nb.textContent = total > 99 ? "99+" : total;
        nb.classList.toggle("hidden", total === 0);
        const rb = $("#req-badge");
        rb.textContent = pending;
        rb.classList.toggle("hidden", pending === 0);
        const mb = $("#msg-badge"), mn = Messages.unreadCount;
        mb.textContent = mn > 99 ? "99+" : mn;
        mb.classList.toggle("hidden", mn === 0);
        const nm = $("#nav-msg-badge");
        nm.textContent = mn;
        nm.classList.toggle("hidden", mn === 0);
        const bm = $("#bn-msg-badge");
        bm.textContent = mn > 99 ? "99+" : mn;
        bm.classList.toggle("hidden", mn === 0);
        const br = $("#bn-req-badge");
        br.textContent = pending;
        br.classList.toggle("hidden", pending === 0);
        const cb = $("#com-badge");
        const n = Notify.list().filter((x) => !x.read && x.kind === "community_request").length;
        cb.textContent = n;
        cb.classList.toggle("hidden", n === 0);
    }
    /* ---------- routing ---------- */
    function route() {
        const hash = (location.hash || "#dashboard").slice(1);
        if (hash === "calendar") {
            location.replace("#games");
            return;
        } // the Calendar page was replaced by Games
        const view = hash.startsWith("games") ? "games" : hash.startsWith("user-") ? "user" : hash.startsWith("community-") ? "community" : hash.startsWith("post-") || hash.startsWith("postr-") ? "post" : hash.startsWith("messages") ? "messages" : hash.startsWith("admin") ? "admin" : hash;
        const navView = view === "community" ? "communities" : view;
        $("#view").dataset.page = view;
        $$(".nav-item[data-view], .subnav-item[data-view]").forEach((a) => a.classList.toggle("active", a.dataset.view === navView));
        $$(".bn-item[data-view]").forEach((a) => a.classList.toggle("active", a.dataset.view === navView));
        if (view !== "games")
            Games.stop(); // stops timers / key listeners of a game we just left
        const views = {
            dashboard: renderDashboard,
            games: () => Games.mount($("#view"), user, hash),
            announcements: renderAnnouncements,
            admin: () => Admin.mount($("#view"), user, hash === "admin-reports" ? "reports" : null),
            developer: () => Developer.mount($("#view"), user),
            contact: () => Contact.mount($("#view"), user),
            attachments: () => Attachments.mount($("#view"), user),
            messages: () => Messages.mount($("#view"), hash.startsWith("messages-") ? hash.replace("messages-", "") : null),
            communities: () => Communities.mount($("#view")),
            community: () => Communities.mountDetail($("#view"), hash.replace("community-", "")),
            post: () => Feed.mountPost($("#view"), user, hash.replace(/^postr?-/, ""), hash.startsWith("post-")),
            profile: () => Social.mountEdit($("#view")),
            requests: () => Social.mountRequests($("#view")),
            users: () => Social.mountUsers($("#view")),
            user: () => Social.mountUser($("#view"), hash.replace("user-", ""))
        };
        (views[view] || renderEmpty.bind(null, hash))();
        if (window.innerWidth <= 1099)
            $("#app").classList.add("collapsed");
    }
    /* ---------- views ---------- */
    function renderDashboard() {
        const role = user.role || "student";
        const first = (user.name || "").split(" ")[0];
        mountInto($("#view"), h("div", { className: "page-head" },
            h("div", null,
                h("h1", { className: "greeting" },
                    Utils.greeting(),
                    ", ",
                    first),
                h("p", { className: "today" }, Utils.formatLongDate(new Date()))),
            h("span", { className: "portal-tag" },
                "CONFESSHUB \u00B7 ",
                h("b", { className: role }, role === "student" ? "Student" : role))), h("section", { className: "hero" },
            h("div", { className: "hero-text" },
                h("h2", null, "Say what's on your mind"),
                h("p", null, "Post to the feed, chat with classmates, and keep up with announcements. Find people or join a community to get started.")),
            h("div", { className: "controls" },
                h("a", { className: "btn-ctl", href: "#users" },
                    h("svg", { viewBox: "0 0 24 24" },
                        h("circle", { cx: "11", cy: "11", r: "6.5" }),
                        h("path", { d: "M20 20l-4.2-4.2" })),
                    "Find"),
                h("button", { className: "btn-ctl join", type: "button", id: "join-btn", onClick: () => Communities.openJoin() },
                    h("svg", { viewBox: "0 0 24 24" },
                        h("path", { d: "M10 17l5-5-5-5M15 12H3M15 4h4a2 2 0 012 2v12a2 2 0 01-2 2h-4" })),
                    "Join"))), h("div", { className: "grid-2" },
            h("section", { className: "feed-col" },
                h("h2", { className: "section-title" }, "Posts"),
                h("div", { id: "feed" })),
            h("aside", { className: "active-panel" },
                h("div", { id: "req-card" }),
                h("h2", { className: "section-title" },
                    "Active now ",
                    h("span", { className: "count-chip", id: "active-count" }, "1")),
                h("div", { className: "active-list", id: "active-list" }))));
        Feed.mount($("#feed"), user);
        Social.mountActive($("#active-list"), $("#active-count"));
        paintRequests();
    }
    /** Right column: incoming friend requests with Confirm / Delete. */
    function paintRequests() {
        const el = $("#req-card");
        if (!el || !el.isConnected)
            return;
        const list = Social.incoming();
        if (!list.length) {
            mountInto(el);
            return;
        }
        mountInto(el, h("div", { className: "side-card" },
            h("div", { className: "side-card-head" },
                h("h2", { className: "section-title" }, "Friend requests"),
                h("a", { href: "#requests", className: "see-all" }, "See all")),
            list.slice(0, 3).map(({ p }) => (h("div", { className: "req-row" },
                h("a", { href: `#user-${p.id}` }, raw(Utils.avatar(p.name, p.avatar, "lg"))),
                h("div", { className: "req-main" },
                    h("a", { href: `#user-${p.id}`, className: "req-name" }, p.name),
                    h("div", { className: "req-btns" },
                        h("button", { className: "btn-sm primary", onClick: (e) => respond(e, p.id, true) }, "Confirm"),
                        h("button", { className: "btn-sm", onClick: (e) => respond(e, p.id, false) }, "Delete"))))))));
    }
    async function respond(e, id, accept) {
        e.currentTarget.disabled = true;
        await Social.respond(id, accept);
    }
    const annNames = new Set(); // user ids whose names we already asked for (announcement recipient lists)
    function renderAnnouncements() {
        const staff = Auth.isStaff(user);
        mountInto($("#view"), h("h1", { className: "view-title" }, "Announcements"), staff ? (h("div", { className: "dev-card ann-compose" },
            h("h3", null, "New announcement"),
            h("p", { className: "hint", style: "margin-top:0" }, "Send it to everyone, or pick exactly who should get it. They get a pop-up that shows once and stops after 24 hours."),
            h("form", { id: "ann-form", noValidate: true },
                h("input", { className: "text-input", id: "ann-title-in", type: "text", maxLength: 120, placeholder: "Title", autoComplete: "off" }),
                h("textarea", { className: "text-input", id: "ann-body-in", rows: 3, maxLength: 2000, placeholder: "Message (optional)", style: "margin-top:10px" }),
                h("div", { className: "aud-box" },
                    h("span", { className: "field-label" }, "Send to"),
                    h("div", { className: "aud-toggle", role: "radiogroup", "aria-label": "Who receives this announcement" },
                        h("label", { className: "aud-opt" },
                            h("input", { type: "radio", name: "aud", value: "all", checked: true }),
                            " ",
                            h("span", null, "Everyone")),
                        h("label", { className: "aud-opt" },
                            h("input", { type: "radio", name: "aud", value: "some" }),
                            " ",
                            h("span", null, "Specific people"))),
                    h("div", { id: "aud-picker", className: "aud-picker hidden" },
                        h("input", { className: "text-input", id: "aud-q", type: "search", maxLength: 40, placeholder: "Search a username to add\u2026", autoComplete: "off" }),
                        h("div", { id: "aud-results", className: "aud-results" }),
                        h("div", { id: "aud-chips", className: "aud-chips" }))),
                h("div", { className: "composer-bar" },
                    h("span", { className: "dev-msg", id: "ann-msg", role: "alert" }),
                    h("button", { className: "btn primary", type: "submit" }, "Post announcement"))))) : null, h("div", { id: "ann-list" }));
        if (staff)
            setupAnnForm();
        paintAnnList();
        Announce.markAllSeen(); // opening the page counts as seeing them
    }
    /** Compose form: Everyone / Specific people picker + submit. */
    function setupAnnForm() {
        const picked = new Map(); // id -> profile
        const MAX = 100;
        let timer, searchToken = 0;
        const mode = () => $("#ann-form").elements.aud.value;
        const drawChips = () => {
            mountInto($("#aud-chips"), picked.size
                ? [...picked.values()].map((p) => (h("span", { className: "aud-chip" },
                    raw(Utils.avatar(p.name, p.avatar, "sm")),
                    h("span", null, p.name),
                    h("button", { type: "button", "data-rm": p.id, "aria-label": `Remove ${p.name}` }, "\u00D7"))))
                : h("small", { className: "dim" }, "Nobody picked yet."));
        };
        const drawResults = (list) => {
            mountInto($("#aud-results"), list.length ? list.map((p) => (h("button", { type: "button", className: "aud-result" + (picked.has(p.id) ? " on" : ""), "data-add": p.id },
                raw(Utils.avatar(p.name, p.avatar, "sm")),
                h("span", { className: "aud-name" }, raw(Utils.nameWithBadge(p.name, p.role))),
                h("span", { className: "aud-state" }, picked.has(p.id) ? "Added ✓" : "Add")))) : h("div", { className: "empty" }, "No users found."));
            list.forEach((p) => annResults.set(p.id, p));
        };
        const annResults = new Map();
        let lastList = [];
        const search = async () => {
            const q = $("#aud-q").value.trim(), t = ++searchToken;
            let query = Auth.client.from("public_profiles").select("id,name,avatar,bio,role,created_at").neq("id", user.id).limit(8);
            query = q ? query.ilike("name", `%${q}%`).order("name") : query.order("created_at", { ascending: false });
            const { data, error } = await query;
            if (t !== searchToken)
                return;
            if (error) {
                mountInto($("#aud-results"), h("div", { className: "empty" },
                    "Couldn't search: ",
                    error.message));
                return;
            }
            lastList = data;
            drawResults(lastList);
        };
        $$('input[name="aud"]').forEach((r) => r.addEventListener("change", () => {
            const some = mode() === "some";
            $("#aud-picker").classList.toggle("hidden", !some);
            if (some && !lastList.length)
                search();
        }));
        $("#aud-q").addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(search, 250); });
        $("#aud-results").addEventListener("click", (e) => {
            const b = e.target.closest("[data-add]");
            if (!b)
                return;
            const id = b.dataset.add;
            if (picked.has(id))
                picked.delete(id);
            else if (picked.size >= MAX)
                return Utils.toast(`You can pick up to ${MAX} people. Choose Everyone instead.`);
            else
                picked.set(id, annResults.get(id));
            drawResults(lastList);
            drawChips();
        });
        $("#aud-chips").addEventListener("click", (e) => {
            const b = e.target.closest("[data-rm]");
            if (!b)
                return;
            picked.delete(b.dataset.rm);
            drawResults(lastList);
            drawChips();
        });
        drawChips();
        $("#ann-form").addEventListener("submit", async (e) => {
            e.preventDefault();
            const title = $("#ann-title-in").value, body = $("#ann-body-in").value, msg = $("#ann-msg");
            msg.textContent = "";
            if (!title.trim())
                return (msg.textContent = "Add a title.");
            const some = mode() === "some";
            if (some && !picked.size)
                return (msg.textContent = "Pick at least one person, or choose Everyone.");
            const btn = e.submitter;
            if (btn)
                btn.disabled = true;
            try {
                await Announce.post({ title, body, audience: some ? [...picked.keys()] : null });
                $("#ann-title-in").value = "";
                $("#ann-body-in").value = "";
                Utils.toast(some ? `Announcement sent to ${picked.size} ${picked.size === 1 ? "person" : "people"}.` : "Announcement posted. Everyone will see a pop-up.", 3500);
                if (some) {
                    picked.clear();
                    drawChips();
                    drawResults(lastList);
                }
            }
            catch (ex) {
                msg.textContent = ex.message.includes("announcements") ? "Couldn't post. Did you re-run supabase/schema.sql?" : ex.message;
            }
            if (btn)
                btn.disabled = false;
        });
    }
    /** "To: Everyone" / "To: Ann, Bo +3" for staff, "Sent to you" for the people who got it. */
    function audienceTag(a) {
        if (!Announce.isPrivate(a))
            return Auth.isStaff(user) ? h("span", { className: "aud-tag" }, "To: Everyone") : null;
        if (!Auth.isStaff(user) || (a.author_id !== user.id && user.role !== "developer"))
            return h("span", { className: "aud-tag you" }, "Sent to you");
        const names = a.audience.slice(0, 3).map((id) => Social.person(id).name);
        const more = a.audience.length - names.length;
        return h("span", { className: "aud-tag" },
            "To: ",
            names.join(", "),
            more > 0 ? ` +${more} more` : "");
    }
    function paintAnnList() {
        const list = $("#ann-list");
        if (!list)
            return;
        const rows = Announce.list();
        if (!rows.length) {
            mountInto(list, h("div", { className: "empty-state" }, "No announcements yet."));
            return;
        }
        // Names for the "To: …" line (only the first few recipients of each announcement are shown).
        const need = [...new Set(rows.flatMap((a) => (Announce.isPrivate(a) ? a.audience.slice(0, 3) : [])))].filter((id) => !annNames.has(id));
        if (need.length && Auth.isStaff(user)) {
            need.forEach((id) => annNames.add(id));
            Social.fetchProfiles(need).then(() => { if ($("#ann-list") === list)
                paintAnnList(); });
        }
        mountInto(list, rows.map((a) => {
            const canDelete = user.role === "developer" || a.author_id === user.id;
            return (h("div", { className: "list-card" },
                h("h4", null,
                    a.title,
                    Announce.isFresh(a) ? h("span", null,
                        " ",
                        h("span", { className: "chip-new" }, "NEW")) : null),
                h("small", null,
                    a.author_name || "Admin",
                    " ",
                    h("span", { className: "role-tag " + a.author_role }, a.author_role),
                    " \u00B7 ",
                    Utils.formatLongDate(new Date(a.created_at)),
                    " ",
                    audienceTag(a)),
                a.body ? h("p", { className: "ann-text" }, a.body) : null,
                canDelete ? h("button", { className: "btn-link danger", type: "button", style: "margin-top:8px;padding:0", onClick: () => removeAnnouncement(a.id) }, "Delete") : null));
        }));
    }
    async function removeAnnouncement(id) {
        if (!confirm("Delete this announcement for everyone?"))
            return;
        try {
            await Announce.remove(id);
            Utils.toast("Announcement deleted.");
        }
        catch (ex) {
            Utils.toast("Couldn't delete: " + ex.message);
        }
    }
    function renderEmpty(name) {
        const label = name ? name.charAt(0).toUpperCase() + name.slice(1) : "This page";
        mountInto($("#view"), h("h1", { className: "view-title" }, label), h("div", { className: "empty-state" },
            label,
            " is coming soon."));
    }
})();
