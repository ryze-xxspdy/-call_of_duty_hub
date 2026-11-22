"use strict";
/* ---------- Contact staff: message the developer or any admin ----------
   Lists every Developer / Admin account with a quick message box.
   The message lands in their normal Messages inbox, so they can reply there.
   (schema.sql section 18 lets anyone message staff, and lets staff reply to anyone.)
*/
const Contact = (() => {
    const db = () => Auth.client;
    const ROLE_NOTE = {
        developer: "Bugs, account problems, feature ideas",
        admin: "Reports, posts, communities and moderation"
    };
    let token = 0;
    async function mount(el, me) {
        const mine = ++token;
        let box;
        mountInto(el, h("div", { className: "page-intro" },
            h("h1", { className: "view-title" }, "Contact staff"),
            h("p", { className: "sub" }, "Need help or want to report something? Send a message to the developer or an admin. They reply in your Messages.")), h("div", { id: "contact-list", ref: (n) => (box = n) },
            h("div", { className: "empty" }, "Loading\u2026")));
        const { data, error } = await db().from("public_profiles")
            .select("id,name,avatar,banner,bio,role,created_at").in("role", ["developer", "admin"]).neq("id", me.id);
        if (mine !== token)
            return;
        if (error) {
            mountInto(box, h("div", { className: "empty-state" },
                h("h3", null, "Couldn't load staff"),
                h("p", null, error.message)));
            return;
        }
        const staff = (data || []).slice().sort((a, b) => (a.role === "developer" ? 0 : 1) - (b.role === "developer" ? 0 : 1) || a.name.localeCompare(b.name));
        if (!staff.length) {
            mountInto(box, h("div", { className: "empty-state" }, "There is nobody else on the staff team yet."));
            return;
        }
        mountInto(box, h("div", { className: "contact-grid" }, staff.map(card)));
        const paintOnline = () => {
            if (mine !== token || !box.isConnected)
                return false;
            box.querySelectorAll("[data-online]").forEach((n) => {
                mountInto(n, Social.isOnline(n.dataset.online) ? h("span", { className: "online-text" }, "\u25CF Online now") : "Offline");
            });
        };
        paintOnline();
        Social.on("presence", paintOnline);
        Social.fetchProfiles(staff.map((p) => p.id)); // so the Messages inbox can show their names
    }
    async function send(e, to) {
        e.preventDefault();
        const form = e.currentTarget;
        const input = form.querySelector("textarea");
        const btn = form.querySelector("button");
        const text = input.value.trim();
        if (!text) {
            input.focus();
            return;
        }
        btn.disabled = true;
        btn.textContent = "Sending…";
        try {
            await Messages.send(to, text);
            input.value = "";
            Utils.toast("Message sent. Replies will show up in Messages.", 3500);
        }
        catch (ex) {
            Utils.toast(ex.message, 5000);
        }
        finally {
            btn.disabled = false;
            btn.textContent = "Send message";
        }
    }
    function card(p) {
        const label = p.role === "developer" ? "Developer" : "Admin";
        return (h("article", { className: "contact-card" },
            raw(Utils.banner(p.banner, "slim")),
            h("div", { className: "contact-body" },
                h("a", { className: "contact-who", href: `#user-${p.id}` },
                    raw(Utils.avatar(p.name, p.avatar, "lg")),
                    h("div", null,
                        h("strong", null, raw(Utils.nameWithBadge(p.name, p.role))),
                        h("small", { "data-online": p.id }))),
                h("p", { className: "contact-note" },
                    h("b", null, label),
                    " \u00B7 ",
                    ROLE_NOTE[p.role] || ""),
                p.bio ? h("p", { className: "contact-bio" }, p.bio) : null,
                h("form", { className: "contact-form", "data-to": p.id, onSubmit: (e) => send(e, p.id) },
                    h("textarea", { className: "text-input", rows: 3, maxLength: 1000, placeholder: `Write a message to ${p.name}…`, "aria-label": `Message to ${p.name}` }),
                    h("div", { className: "contact-actions" },
                        h("a", { className: "btn-sm ghost", href: `#messages-${p.id}` }, "Open chat"),
                        h("button", { className: "btn-sm primary", type: "submit" }, "Send message"))))));
    }
    return { mount };
})();
