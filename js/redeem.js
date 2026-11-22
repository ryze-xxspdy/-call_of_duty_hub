"use strict";
/* ---------- Redeem page: spend game points on CODM codes and MLBB top-ups ----------
   CODM  -> the student gets a code straight away.
   MLBB  -> the student enters Game ID, Server and IGN; admins / the developer get a notification and deliver it.
   A reward with no stock turns gray.
   Admins and the developer also get an admin panel here (tabs: Orders, Gift points, Add reward, Stock) and can give themselves points.
   "Recent activity" at the bottom is PUBLIC: everyone sees who redeemed, got a delivery or received a gift (never codes, IDs or emails). */
const Redeem = (() => {
    function when(t) {
        const ms = typeof t === "number" ? t : new Date(t).getTime();
        const s = Math.max(0, (Date.now() - ms) / 1000);
        if (s < 60)
            return "just now";
        if (s < 3600)
            return Math.floor(s / 60) + " min ago";
        if (s < 86400)
            return Math.floor(s / 3600) + " h ago";
        return Utils.formatShortDate(new Date(ms));
    }
    const stockText = (r) => r.stock <= 0 ? "Out of stock" : `${r.stock.toLocaleString()} left`;
    const kindName = (k) => k === "codm" ? "CODM code" : "MLBB";
    const kindHint = (k) => k === "codm" ? "🎯 You get a code right away" : "💎 Enter your ID, server and IGN";
    function copyText(text) {
        const done = () => Utils.toast("Copied!", 1800);
        if (navigator.clipboard && navigator.clipboard.writeText)
            navigator.clipboard.writeText(text).then(done, () => Utils.toast("Couldn't copy. Select the code and copy it by hand.", 3200));
        else
            Utils.toast("Couldn't copy. Select the code and copy it by hand.", 3200);
    }
    /** Small pop-up window. `build` gets a close() function and returns the modal element. */
    function openModal(build) {
        const wrap = document.createElement("div");
        wrap.className = "modal-backdrop";
        const close = () => wrap.remove();
        wrap.appendChild(build(close));
        wrap.addEventListener("click", (e) => { if (e.target === wrap)
            close(); });
        document.body.appendChild(wrap);
        const first = wrap.querySelector("input, button");
        if (first)
            first.focus();
    }
    /** Shows the CODM code the student just got. */
    function codeModal(item, code) {
        openModal((close) => (h("div", { className: "modal rd-modal", role: "dialog", "aria-modal": "true" },
            h("h3", null,
                item.emoji,
                " ",
                item.title),
            h("p", null, "Here is your code. It is also saved under \u201CMy redemptions\u201D on this page."),
            h("div", { className: "rd-code" },
                h("code", null, code)),
            h("div", { className: "modal-actions" },
                h("button", { type: "button", className: "btn ghost", onClick: close }, "Close"),
                h("button", { type: "button", className: "btn primary", onClick: () => copyText(code) }, "Copy code")))));
    }
    /** MLBB: asks for Game ID, Server and IGN, then sends the order to the admins. */
    function mlbbModal(item, onDone) {
        openModal((close) => {
            let fId, fServer, fIgn, btn;
            const submit = async () => {
                const gameId = fId.value.trim(), server = fServer.value.trim(), ign = fIgn.value.trim();
                if (!/^\d{4,15}$/.test(gameId))
                    return Utils.toast("Enter your Game ID (numbers only).", 3000);
                if (!/^\d{1,6}$/.test(server))
                    return Utils.toast("Enter your Server (numbers only).", 3000);
                if (ign.length < 2 || ign.length > 40)
                    return Utils.toast("Enter your in-game name (IGN).", 3000);
                btn.disabled = true;
                const res = await Rewards.redeem(item.id, { gameId, server, ign });
                if (!res.ok) {
                    btn.disabled = false;
                    Utils.toast(res.reason || "Couldn't redeem.", 3600);
                    return;
                }
                close();
                Utils.toast(`💎 Order sent! An admin was notified and will deliver ${item.title} to ${ign}.`, 5200);
                onDone();
            };
            return (h("div", { className: "modal rd-modal", role: "dialog", "aria-modal": "true" },
                h("h3", null,
                    item.emoji,
                    " ",
                    item.title),
                h("p", null,
                    item.cost.toLocaleString(),
                    " points. Enter your Mobile Legends details exactly as they appear in the game. An admin will be notified and send it to you."),
                h("label", { className: "field-label", htmlFor: "rd-gid" }, "Game ID"),
                h("input", { id: "rd-gid", type: "text", inputMode: "numeric", maxLength: "15", placeholder: "e.g. 123456789", ref: (el) => (fId = el) }),
                h("label", { className: "field-label", htmlFor: "rd-srv", style: "margin-top:12px" }, "Server"),
                h("input", { id: "rd-srv", type: "text", inputMode: "numeric", maxLength: "6", placeholder: "e.g. 1234", ref: (el) => (fServer = el) }),
                h("label", { className: "field-label", htmlFor: "rd-ign", style: "margin-top:12px" }, "In-game name (IGN)"),
                h("input", { id: "rd-ign", type: "text", maxLength: "40", placeholder: "Your IGN", ref: (el) => (fIgn = el) }),
                h("div", { className: "modal-actions" },
                    h("button", { type: "button", className: "btn ghost", onClick: close }, "Cancel"),
                    h("button", { type: "button", className: "btn primary", ref: (el) => (btn = el), onClick: submit }, "Redeem"))));
        });
    }
    /** Small "give myself points" bar. Used on the Redeem page and at the top of the Games page (admins / developer only). */
    function giveBar(onChange) {
        if (!Rewards.isStaff())
            return document.createDocumentFragment();
        let input;
        const amount = () => Number(String(input.value).replace(/,/g, ""));
        const done = (res, msg) => {
            if (!res.ok) {
                Utils.toast(res.reason || "Couldn't do that.", 3200);
                return;
            }
            Utils.toast(msg, 2600);
            if (onChange)
                onChange();
        };
        const chip = (n) => (h("button", { type: "button", className: "btn-sm", onClick: () => done(Rewards.adminGive(n), `+${n.toLocaleString()} points added.`) },
            "+",
            n.toLocaleString()));
        return (h("div", { className: "adm-bar" },
            h("strong", null,
                "\uD83D\uDEE1\uFE0F Your points ",
                h("small", null, "(admins only)")),
            h("div", { className: "adm-row" },
                h("input", { type: "number", min: "0", step: "1", placeholder: "Amount", ref: (el) => (input = el) }),
                h("button", { type: "button", className: "btn-sm primary", onClick: () => done(Rewards.adminGive(amount()), `+${amount().toLocaleString()} points added.`) }, "Add"),
                h("button", { type: "button", className: "btn-sm", onClick: () => done(Rewards.adminSet(amount()), `Balance set to ${amount().toLocaleString()} points.`) }, "Set balance"),
                chip(1000),
                chip(10000),
                chip(100000)),
            h("small", null,
                "Only admins can see this. Admins and the developer are always Level ",
                Rewards.MAX_LEVEL,
                ".")));
    }
    const roleTag = (role) => (role && role !== "student" ? raw(Utils.roleBadge(role)) : null);
    /** Gift points to another person. Points only: their level and XP stay exactly as they are.
     *  Two steps: 1) pick who (live search), 2) pick how many. */
    function giftCard() {
        let search, amount, results, pickStep, chosenStep, chosenBox, sendBtn;
        let target = null;
        let timer, seq = 0;
        const personRow = (u) => (h("span", { className: "gp-person" },
            raw(Utils.avatar(u.name || u.email, u.avatar || null, "sm")),
            h("span", { className: "gp-who" },
                h("b", null,
                    u.name || "(no name)",
                    roleTag(u.role)),
                h("small", null, u.email))));
        const amountNow = () => Math.floor(Number(String(amount.value).replace(/,/g, "")));
        const paint = () => {
            pickStep.classList.toggle("hidden", !!target);
            chosenStep.classList.toggle("hidden", !target);
            if (target)
                mountInto(chosenBox, personRow(target));
            const n = amountNow();
            sendBtn.disabled = !target;
            sendBtn.textContent = target && Number.isFinite(n) && n > 0 ? `Send ${n.toLocaleString()} points` : "Send gift";
        };
        const doSearch = async () => {
            const q = search.value.trim(), mine = ++seq;
            if (q.length < 2) {
                mountInto(results, h("small", { className: "gp-hint" }, "Type at least 2 letters of a name or email."));
                return;
            }
            mountInto(results, h("small", { className: "gp-hint" }, "Searching\u2026"));
            const users = await Rewards.findUsers(q);
            if (mine !== seq)
                return;
            mountInto(results, users.length ? users.map((u) => (h("button", { type: "button", className: "gp-result", onClick: () => { target = u; paint(); amount.focus(); } },
                personRow(u),
                h("span", { className: "gp-pick" }, "Select")))) : h("small", { className: "gp-hint" }, "No one found."));
        };
        const send = async () => {
            if (!target)
                return;
            const n = amountNow();
            if (!Number.isFinite(n) || n < 1)
                return Utils.toast("Enter how many points to gift.", 2600);
            const who = target.name || target.email;
            if (!confirm(`Send ${n.toLocaleString()} points to ${who}?`))
                return;
            sendBtn.disabled = true;
            const res = await Rewards.adminGift(target.id, n);
            if (!res.ok) {
                paint();
                return Utils.toast(res.reason || "Couldn't send the gift.", 4200);
            }
            Utils.toast(`🎁 Sent ${n.toLocaleString()} points to ${who}.`, 3200);
            amount.value = "";
            target = null;
            search.value = "";
            mountInto(results);
            paint();
        };
        const chip = (n) => h("button", { type: "button", className: "chip-btn", onClick: () => { amount.value = String(n); paint(); } }, n.toLocaleString());
        const card = (h("div", { className: "adm-card" },
            h("h3", null, "\uD83C\uDF81 Gift points"),
            h("p", { className: "adm-hint" }, "Points go straight into their balance and they get a notification. Levels and XP never change."),
            h("div", { className: "gp-step" },
                h("span", { className: "gp-label" }, "1 \u00B7 Who gets it?"),
                h("div", { ref: (el) => (pickStep = el) },
                    h("input", { type: "search", className: "gp-search", placeholder: "Search a name or email\u2026", autoComplete: "off", ref: (el) => { search = el; el.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(doSearch, 260); }); } }),
                    h("div", { className: "gp-results", ref: (el) => (results = el) })),
                h("div", { className: "gp-chosen hidden", ref: (el) => (chosenStep = el) },
                    h("div", { ref: (el) => (chosenBox = el) }),
                    h("button", { type: "button", className: "btn-sm ghost", onClick: () => { target = null; paint(); search.focus(); } }, "Change"))),
            h("div", { className: "gp-step" },
                h("span", { className: "gp-label" }, "2 \u00B7 How many points?"),
                h("input", { type: "number", min: "1", step: "1", className: "gp-amount", placeholder: "e.g. 5,000", ref: (el) => { amount = el; el.addEventListener("input", paint); } }),
                h("div", { className: "gp-chips" },
                    chip(1000),
                    chip(5000),
                    chip(10000),
                    chip(50000))),
            h("button", { type: "button", className: "btn primary gp-send", ref: (el) => (sendBtn = el), onClick: send }, "Send gift")));
        mountInto(results, h("small", { className: "gp-hint" }, "Search for the person you want to gift."));
        paint();
        return card;
    }
    /* Orders: the list reloads by itself when anyone (this admin or another one) marks an order delivered. */
    let ordersReload = null;
    let ordersHost = null;
    Notify.onOrder(() => { if (ordersReload && ordersHost && ordersHost.isConnected)
        ordersReload(); });
    /** MLBB orders waiting for the admin, plus the last delivered ones. */
    function ordersCard(onCount) {
        let box;
        const load = async () => {
            const all = (await Rewards.adminOrders()).filter((o) => o.kind === "mlbb");
            if (!box || !box.isConnected)
                return;
            const pending = all.filter((o) => o.status === "pending").reverse(); // oldest first
            const done = all.filter((o) => o.status === "done").slice(0, 6);
            onCount(pending.length);
            const detail = (label, value) => h("span", { className: "ord-d" },
                h("small", null, label),
                h("code", null, value));
            const row = (o) => (h("div", { className: "ord" + (o.status === "done" ? " done" : "") },
                h("div", { className: "ord-top" },
                    h("b", null, o.item_title),
                    h("span", { className: "ord-who" },
                        o.user_name || "Student",
                        " \u00B7 ",
                        when(o.created_at))),
                h("div", { className: "ord-info" },
                    detail("Game ID", o.game_id),
                    detail("Server", o.server),
                    detail("IGN", o.ign)),
                o.status === "pending" ? (h("div", { className: "ord-btns" },
                    h("button", { type: "button", className: "btn-sm", onClick: () => copyText(`${o.game_id} (${o.server}) ${o.ign}`) }, "Copy details"),
                    h("button", { type: "button", className: "btn-sm primary", onClick: async (e) => {
                            e.currentTarget.disabled = true;
                            const res = await Rewards.adminMarkDone(o.id);
                            if (res.ok)
                                Notify.dropOrder(o.id);
                            Utils.toast(res.ok ? "Marked as delivered. The student was told." : res.reason || "Couldn't update.", 3200);
                            load();
                        } }, "Mark delivered"))) : h("span", { className: "ord-done" }, "Delivered \u2713")));
            mountInto(box, pending.length ? pending.map(row) : h("div", { className: "adm-empty" }, "No MLBB orders waiting. \uD83C\uDF89"), done.length ? h("h4", { className: "adm-sub" }, "Recently delivered") : null, done.map(row));
        };
        const card = (h("div", { className: "adm-card" },
            h("h3", null, "\uD83D\uDC8E MLBB orders"),
            h("p", { className: "adm-hint" },
                "Send the diamonds / item in the game, then tap ",
                h("b", null, "Mark delivered"),
                ". Once it is delivered the order disappears for the other admins too. CODM codes are handed out automatically, so they never show up here."),
            h("div", { ref: (el) => (box = el) },
                h("small", null, "Loading\u2026"))));
        ordersReload = load;
        ordersHost = card;
        load();
        return card;
    }
    /** The admin tools, one tab at a time: Orders · Gift points · Add reward · Stock. */
    let adminTab = "orders";
    function adminPanel(view, reload) {
        const items = Rewards.shop();
        const editable = Rewards.shopEditable();
        const refresh = async () => { await Rewards.loadCatalog(); reload(); };
        const run = async (p, okMsg) => {
            const res = await p;
            if (!res.ok) {
                Utils.toast(res.reason || "Couldn't save.", 4200);
                return false;
            }
            Utils.toast(okMsg, 2600);
            reload();
            return true;
        };
        /* ----- add a reward ----- */
        let fEmoji, fTitle, fBlurb, fCost, fStock, fCodes, fKind, stockWrap, codesWrap;
        const syncKind = () => {
            stockWrap.classList.toggle("hidden", fKind.value !== "mlbb");
            codesWrap.classList.toggle("hidden", fKind.value !== "codm");
        };
        const addForm = (h("div", { className: "adm-card" },
            h("h3", null, "\u2795 Add a reward"),
            h("p", { className: "adm-hint" },
                "It shows up in the shop for everyone straight away. ",
                h("b", null, "CODM"),
                ": paste the codes, one per line (the number of codes is the stock). ",
                h("b", null, "MLBB"),
                ": set how many you can deliver."),
            h("div", { className: "adm-form" },
                h("label", { className: "adm-field wide" },
                    h("span", null, "Type"),
                    h("select", { ref: (el) => { fKind = el; el.addEventListener("change", syncKind); } },
                        h("option", { value: "codm" }, "CODM: student gets a code"),
                        h("option", { value: "mlbb" }, "MLBB: student enters ID, server, IGN"))),
                h("label", { className: "adm-field" },
                    h("span", null, "Emoji"),
                    h("input", { type: "text", maxLength: "8", placeholder: "\uD83C\uDF81", ref: (el) => (fEmoji = el) })),
                h("label", { className: "adm-field" },
                    h("span", null, "Name"),
                    h("input", { type: "text", maxLength: "40", placeholder: "e.g. 80 CP", ref: (el) => (fTitle = el) })),
                h("label", { className: "adm-field wide" },
                    h("span", null, "Short description"),
                    h("input", { type: "text", maxLength: "120", placeholder: "What does the student get?", ref: (el) => (fBlurb = el) })),
                h("label", { className: "adm-field" },
                    h("span", null, "Cost (points)"),
                    h("input", { type: "number", min: "1", step: "1", placeholder: "e.g. 5000", ref: (el) => (fCost = el) })),
                h("label", { className: "adm-field hidden", ref: (el) => (stockWrap = el) },
                    h("span", null, "Stock (how many)"),
                    h("input", { type: "number", min: "0", step: "1", placeholder: "e.g. 20", ref: (el) => (fStock = el) })),
                h("label", { className: "adm-field wide", ref: (el) => (codesWrap = el) },
                    h("span", null, "CODM codes (one per line)"),
                    h("textarea", { rows: "4", placeholder: "ABCD-1234\nEFGH-5678", ref: (el) => (fCodes = el) })),
                h("button", { type: "button", className: "btn primary wide", disabled: !editable, onClick: async (e) => {
                        const btn = e.currentTarget;
                        const kind = fKind.value;
                        btn.disabled = true;
                        const ok = await run(Rewards.adminSaveItem({
                            kind, emoji: fEmoji.value, title: fTitle.value, blurb: fBlurb.value, cost: Number(fCost.value),
                            stock: Number(String(fStock.value).trim() || 0), codes: fCodes.value
                        }), `${fTitle.value.trim()} was added to the shop.`);
                        if (!ok)
                            btn.disabled = false;
                    } }, "Add to shop"))));
        syncKind();
        /* ----- stock list ----- */
        const row = (r) => {
            let qty, codes;
            const isCodm = r.kind === "codm";
            return (h("div", { className: "adm-item" + (r.active === false ? " off" : "") },
                h("div", { className: "adm-item-head" },
                    h("span", { className: "adm-name" },
                        r.emoji,
                        " ",
                        h("b", null, r.title),
                        " ",
                        h("small", null,
                            r.cost.toLocaleString(),
                            " pts \u00B7 ",
                            kindName(r.kind),
                            r.active === false ? " · hidden" : "")),
                    h("span", { className: "adm-stock" + (r.stock <= 0 ? " out" : "") }, isCodm ? (r.stock <= 0 ? "No codes left" : `${r.stock.toLocaleString()} ${r.stock === 1 ? "code" : "codes"} left`) : stockText(r))),
                h("div", { className: "adm-item-ctl" },
                    isCodm ? (h("textarea", { rows: "2", placeholder: "New codes, one per line", className: "adm-codes", disabled: !editable, ref: (el) => (codes = el) })) : (h("input", { type: "number", min: "0", step: "1", placeholder: "Qty", ref: (el) => (qty = el), disabled: !editable })),
                    isCodm ? (h("button", { type: "button", className: "btn-sm primary", disabled: !editable, onClick: async () => {
                            if (!codes.value.trim())
                                return Utils.toast("Paste at least one code.", 2600);
                            if (await run(Rewards.adminAddCodes(r.id, codes.value), `Codes added to ${r.title}.`))
                                codes.value = "";
                        } }, "+ Add codes")) : (h("span", { className: "adm-btns" },
                        h("button", { type: "button", className: "btn-sm primary", disabled: !editable, onClick: () => {
                                const n = Number(String(qty.value).trim());
                                if (!String(qty.value).trim() || !Number.isFinite(n) || n < 1)
                                    return Utils.toast("Type how many to add.", 2600);
                                run(Rewards.adminAddStock(r.id, n), `Added ${n.toLocaleString()} to ${r.title}.`);
                            } }, "+ Add stock"),
                        h("button", { type: "button", className: "btn-sm", disabled: !editable, onClick: () => {
                                const n = Number(String(qty.value).trim());
                                if (!String(qty.value).trim() || !Number.isFinite(n) || n < 0)
                                    return Utils.toast("Type the exact stock (0 or more).", 2600);
                                run(Rewards.adminSetStock(r.id, n), `${r.title} stock set to ${n.toLocaleString()}.`);
                            } }, "Set"))),
                    h("span", { className: "adm-btns" },
                        h("button", { type: "button", className: "btn-sm ghost", disabled: !editable, onClick: () => run(Rewards.adminSetActive(r.id, r.active === false), r.active === false ? `${r.title} is visible again.` : `${r.title} is hidden from students.`) }, r.active === false ? "Show" : "Hide"),
                        h("button", { type: "button", className: "btn-sm ghost danger", disabled: !editable, onClick: () => {
                                if (!confirm(`Delete ${r.title} from the shop? ${isCodm ? "Its unused codes are deleted too. " : ""}Past orders stay in the list.`))
                                    return;
                                run(Rewards.adminDelete(r.id), `${r.title} was deleted.`);
                            } }, "Delete")))));
        };
        const stockCard = (h("div", { className: "adm-card" },
            h("h3", null, "\uD83D\uDCE6 Stock"),
            h("p", { className: "adm-hint" },
                "A reward with no stock turns ",
                h("b", null, "gray"),
                " for students. ",
                h("b", null, "CODM"),
                ": paste more codes, then ",
                h("b", null, "+ Add codes"),
                ". ",
                h("b", null, "MLBB"),
                ": type a number, then ",
                h("b", null, "+ Add stock"),
                " (on top) or ",
                h("b", null, "Set"),
                " (exact amount). Hidden items are only visible to admins."),
            h("div", { className: "adm-list" }, items.length ? items.map(row) : h("div", { className: "adm-empty" }, "No rewards yet. Add one in the \u201CAdd reward\u201D tab.")),
            h("button", { type: "button", className: "btn-sm ghost", onClick: refresh }, "Refresh stock")));
        /* ----- tabs ----- */
        let countBadge;
        const setCount = (n) => { if (!countBadge)
            return; countBadge.textContent = String(n); countBadge.classList.toggle("hidden", n === 0); };
        const TABS = [["orders", "💎 Orders"], ["gift", "🎁 Gift points"], ["add", "➕ Add reward"], ["stock", "📦 Stock"]];
        const panes = { orders: ordersCard(setCount), gift: giftCard(), add: addForm, stock: stockCard };
        const show = (id, root) => {
            adminTab = id;
            root.querySelectorAll(".adm-tab").forEach((t) => { t.classList.toggle("on", t.dataset.tab === id); t.setAttribute("aria-selected", String(t.dataset.tab === id)); });
            root.querySelectorAll(".adm-pane").forEach((pn) => pn.classList.toggle("hidden", pn.dataset.pane !== id));
        };
        if (!panes[adminTab])
            adminTab = "orders";
        const err = Rewards.shopError();
        const panel = (h("section", { className: "adm-panel" },
            h("h2", { className: "section-title" }, "\uD83D\uDEE1\uFE0F Admin tools"),
            giveBar(reload),
            !editable ? (h("div", { className: "adm-warn" },
                "The shop needs its tables in the database. Open Supabase \u2192 SQL Editor and run ",
                h("code", null, "supabase/schema.sql"),
                " again (section 25), then refresh.",
                err ? h("small", null, err) : null)) : null,
            h("div", { className: "adm-tabs", role: "tablist" }, TABS.map(([id, label]) => (h("button", { type: "button", role: "tab", className: "adm-tab", "data-tab": id, onClick: (e) => show(id, e.currentTarget.closest(".adm-panel")) },
                label,
                id === "orders" ? h("i", { className: "adm-count hidden", ref: (el) => (countBadge = el) }, "0") : null)))),
            TABS.map(([id]) => h("div", { className: "adm-pane", "data-pane": id }, panes[id]))));
        show(adminTab, panel);
        return panel;
    }
    /** "My redemptions": CODM codes stay here so students can find them again. */
    function myOrdersSection() {
        let box;
        Rewards.myOrders().then((list) => {
            if (!box || !box.isConnected)
                return;
            mountInto(box, list.length ? list.map((o) => (h("div", { className: "rd-row rd-order" },
                h("span", null,
                    h("b", null, o.item_title),
                    o.kind === "codm" && o.code
                        ? h("span", { className: "rd-order-code" },
                            h("code", null, o.code),
                            h("button", { type: "button", className: "btn-sm", onClick: () => copyText(o.code) }, "Copy"))
                        : h("small", { className: "rd-order-sub" },
                            "ID ",
                            o.game_id,
                            " \u00B7 Server ",
                            o.server,
                            " \u00B7 IGN ",
                            o.ign)),
                h("span", { className: "rd-when" }, when(o.created_at)),
                h("b", { className: o.status === "done" ? "pos" : "pend" }, o.status === "done" ? (o.kind === "codm" ? "Code ready" : "Delivered ✓") : "Waiting for admin")))) : h("div", { className: "empty-state", style: "padding:24px 20px" }, "Nothing redeemed yet."));
        });
        return (h("div", null,
            h("h2", { className: "section-title", style: "margin-top:26px" }, "My redemptions"),
            h("div", { className: "rd-log", ref: (el) => (box = el) },
                h("div", { className: "empty-state", style: "padding:24px 20px" }, "Loading\u2026"))));
    }
    /** PUBLIC recent activity: who redeemed what, what was delivered and who got a gift. Everyone sees the same feed, live.
     *  It only holds names, item names and amounts. Never codes, Game IDs or emails. */
    let stopActivity = null;
    function activitySection() {
        let box;
        const line = (a) => {
            const who = (h("a", { className: "act-name", href: a.actor_id ? `#user-${a.actor_id}` : "#redeem" }, a.actor_name || "Someone"));
            const item = h("span", { className: "act-item" },
                a.item_emoji,
                " ",
                a.item_title);
            const text = a.kind === "gift"
                ? h(Fragment, null,
                    who,
                    " received ",
                    h("b", { className: "act-pts" },
                        (a.amount || 0).toLocaleString(),
                        " points"),
                    a.by_name ? h(Fragment, null,
                        " from ",
                        a.by_name) : null)
                : a.kind === "delivered"
                    ? h(Fragment, null,
                        who,
                        "'s ",
                        item,
                        " was ",
                        h("b", { className: "act-ok" }, "delivered"))
                    : h(Fragment, null,
                        who,
                        " redeemed ",
                        item);
            const p = a.actor_id ? Social.person(a.actor_id) : null;
            return (h("div", { className: "act-row" },
                raw(Utils.avatar(a.actor_name, p ? p.avatar : null, "sm")),
                h("span", { className: "act-text" }, text),
                h("span", { className: "act-icon", "aria-hidden": "true" }, a.kind === "gift" ? "🎁" : a.kind === "delivered" ? "✅" : "🛒"),
                h("span", { className: "rd-when" }, when(a.created_at))));
        };
        const load = async () => {
            const rows = await Rewards.activity(25);
            if (!box || !box.isConnected)
                return;
            const missing = [...new Set(rows.map((r) => r.actor_id).filter((id) => !!id && Social.person(id).name === "Unknown"))];
            if (missing.length)
                await Social.fetchProfiles(missing);
            if (!box.isConnected)
                return;
            mountInto(box, rows.length ? rows.map(line) : h("div", { className: "empty-state", style: "padding:26px 20px" }, "Nothing yet. Redeem a reward to be the first!"));
        };
        if (stopActivity)
            stopActivity();
        stopActivity = Rewards.watchActivity(() => {
            if (!box || !box.isConnected) {
                if (stopActivity) {
                    stopActivity();
                    stopActivity = null;
                }
                return;
            }
            load();
        });
        load();
        return (h("div", null,
            h("h2", { className: "section-title", style: "margin-top:26px" },
                "Recent activity ",
                h("span", { className: "count-chip" }, "Public")),
            h("p", { className: "games-intro", style: "margin:0 0 10px" }, "Everyone can see this: redemptions, deliveries and gifts as they happen."),
            h("div", { className: "rd-log act-log", ref: (el) => (box = el) },
                h("div", { className: "empty-state", style: "padding:26px 20px" }, "Loading\u2026"))));
    }
    /** Your own game points (kept on this device): collapsed so the page stays clean. */
    function historySection(st) {
        if (!st.log.length)
            return null;
        return (h("details", { className: "rd-mine" },
            h("summary", null,
                "Your points history ",
                h("small", null,
                    "(",
                    st.log.length,
                    ")")),
            h("div", { className: "rd-log" }, st.log.map((l) => (h("div", { className: "rd-row" },
                h("span", null, l.game),
                h("span", { className: "rd-when" }, when(l.t)),
                h("b", { className: l.pts < 0 ? "neg" : "pos" },
                    l.pts > 0 ? "+" : "",
                    l.pts.toLocaleString(),
                    " pts")))))));
    }
    function draw(view) {
        const st = Rewards.get();
        const lv = Rewards.level();
        const items = Rewards.shop().filter((r) => r.active !== false);
        const costs = items.map((r) => r.cost);
        const range = costs.length ? `Rewards cost between ${Math.min(...costs).toLocaleString()} and ${Math.max(...costs).toLocaleString()} points.` : "No rewards in the shop yet.";
        const reload = () => { if (view.dataset.page === "redeem")
            draw(view); };
        const redeemItem = async (r, btn) => {
            if (r.kind === "mlbb") {
                mlbbModal(r, reload);
                return;
            }
            if (!confirm(`Redeem ${r.title} for ${r.cost.toLocaleString()} points?`))
                return;
            btn.disabled = true;
            const res = await Rewards.redeem(r.id);
            if (!res.ok) {
                Utils.toast(res.reason || "Couldn't redeem.", 3600);
                reload();
                return;
            }
            if (res.code)
                codeModal(r, res.code);
            reload();
        };
        const card = (r) => {
            const out = r.stock <= 0;
            const afford = st.points >= r.cost;
            const pct = Math.min(100, Math.floor((st.points / r.cost) * 100));
            const label = out ? "Out of stock" : afford ? "Redeem" : `${(r.cost - st.points).toLocaleString()} more pts`;
            return (h("div", { className: "rd-card" + (out ? " soldout" : "") },
                h("span", { className: "rd-emoji", "aria-hidden": "true" }, r.emoji),
                h("strong", null, r.title),
                h("span", { className: "rd-kind" }, kindHint(r.kind)),
                h("span", { className: "rd-blurb" }, r.blurb),
                h("span", { className: "rd-cost" },
                    r.cost.toLocaleString(),
                    " pts"),
                h("span", { className: "rd-stock" + (out ? " out" : "") }, stockText(r)),
                h("div", { className: "rd-buy" },
                    out ? null : h("span", { className: "rw-bar" },
                        h("i", { style: { width: pct + "%" } })),
                    h("button", { type: "button", className: "btn-sm" + (out ? "" : " primary"), disabled: !afford || out, onClick: (e) => redeemItem(r, e.currentTarget) }, label))));
        };
        mountInto(view, h("h1", { className: "view-title" }, "Redeem"), h("p", { className: "games-intro" },
            "Play games to earn points, then spend them here. CODM rewards give you a code right away. For MLBB you enter your ID, server and IGN and an admin sends it to you. ",
            range), h("section", { className: "rd-top" },
            h("div", { className: "rd-stat big" },
                h("small", null, "Your points"),
                h("b", null, st.points.toLocaleString()),
                h("span", null,
                    st.earned.toLocaleString(),
                    " earned in total \u00B7 ",
                    st.rounds,
                    " rounds played")),
            h("div", { className: "rd-stat" },
                h("small", null, "Level"),
                h("b", null,
                    lv.level,
                    " ",
                    h("em", null, lv.title)),
                h("span", { className: "rw-bar" },
                    h("i", { style: { width: lv.pct + "%" } })),
                lv.max
                    ? h("span", null,
                        "\uD83C\uDFC6 Max level reached (",
                        Rewards.MAX_LEVEL,
                        ")")
                    : h("span", null,
                        lv.into,
                        " / ",
                        lv.need,
                        " XP to level ",
                        lv.level + 1,
                        " \u00B7 +",
                        Rewards.levelBonus(lv.level + 1),
                        " bonus points"))), Rewards.isStaff() ? adminPanel(view, reload) : null, h("h2", { className: "section-title" }, "Rewards"), items.length ? h("div", { className: "rd-grid" }, items.map(card)) : h("div", { className: "empty-state", style: "padding:30px 20px" }, "No rewards in the shop yet. Check back soon."), h("p", { className: "games-intro", style: "margin:16px 0 0" },
            "Want more points? ",
            h("a", { href: "#games", className: "see-all" }, "Play a game \u2192")), myOrdersSection(), activitySection(), historySection(st));
    }
    /** Route entry: draw right away, then pull the newest items + stock and draw again (only if still on this page). */
    function mount(view) {
        draw(view);
        Rewards.loadCatalog().then(() => { if (view.dataset.page === "redeem")
            draw(view); });
    }
    return { mount, giveBar };
})();
