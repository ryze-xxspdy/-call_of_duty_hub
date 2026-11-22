"use strict";
/* ---------- Redeem page: spend game points on CODM codes and MLBB top-ups ----------
   CODM  -> the student gets a code straight away.
   MLBB  -> the student enters Game ID, Server and IGN; admins / the developer get a notification and deliver it.
   A reward with no stock turns gray.
   Admins and the developer also get an admin panel here: give themselves points, GIFT POINTS to anyone (points only, never levels),
   add rewards, add stock / codes and deliver MLBB orders. */
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
            h("strong", null, "\uD83D\uDEE1\uFE0F Admin: give yourself points"),
            h("div", { className: "adm-row" },
                h("input", { type: "number", min: "0", step: "1", placeholder: "Amount", ref: (el) => (input = el) }),
                h("button", { type: "button", className: "btn-sm primary", onClick: () => done(Rewards.adminGive(amount()), `+${amount().toLocaleString()} points added.`) }, "Add"),
                h("button", { type: "button", className: "btn-sm", onClick: () => done(Rewards.adminSet(amount()), `Balance set to ${amount().toLocaleString()} points.`) }, "Set balance"),
                chip(1000),
                chip(10000),
                chip(100000)),
            h("small", null,
                "Only you can see this. Admins and the developer are always Level ",
                Rewards.MAX_LEVEL,
                ".")));
    }
    /** Gift points to another person. Points only: their level and XP stay exactly as they are. */
    function giftCard() {
        let search, amount, results, picked, sendBtn;
        let target = null;
        const paintPicked = () => {
            picked.textContent = target ? `Gifting to: ${target.name || target.email} (${target.email})` : "Search for someone, then tap their name.";
            sendBtn.disabled = !target;
        };
        const doSearch = async () => {
            const q = search.value.trim();
            if (q.length < 2)
                return Utils.toast("Type at least 2 letters of a name or email.", 2600);
            results.textContent = "Searching…";
            const users = await Rewards.findUsers(q);
            mountInto(results, users.length ? users.map((u) => (h("button", { type: "button", className: "gift-user" + (target && target.id === u.id ? " on" : ""), onClick: (e) => {
                    target = u;
                    results.querySelectorAll(".gift-user").forEach((b) => b.classList.remove("on"));
                    e.currentTarget.classList.add("on");
                    paintPicked();
                } },
                h("b", null, u.name || "(no name)"),
                h("small", null,
                    u.email,
                    u.role !== "student" ? " · " + u.role : "")))) : h("small", null, "No one found."));
        };
        const send = async () => {
            if (!target)
                return;
            const n = Number(String(amount.value).replace(/,/g, ""));
            if (!Number.isFinite(n) || n < 1)
                return Utils.toast("Enter how many points to gift.", 2600);
            sendBtn.disabled = true;
            const who = target.name || target.email;
            const res = await Rewards.adminGift(target.id, Math.floor(n));
            sendBtn.disabled = !target;
            if (!res.ok)
                return Utils.toast(res.reason || "Couldn't send the gift.", 4200);
            Utils.toast(`🎁 Gifted ${Math.floor(n).toLocaleString()} points to ${who}.`, 3200);
            amount.value = "";
        };
        const chip = (n) => h("button", { type: "button", className: "btn-sm", onClick: () => { amount.value = String(n); } }, n.toLocaleString());
        const card = (h("div", { className: "adm-card" },
            h("h3", null, "\uD83C\uDF81 Gift points"),
            h("p", { className: "adm-hint" }, "Send points to anyone. They go straight into their balance and they get a notification. Only points are gifted. Their level and XP don't change."),
            h("div", { className: "adm-row" },
                h("input", { type: "text", placeholder: "Name or email", style: "width:220px", ref: (el) => { search = el; el.addEventListener("keydown", (e) => { if (e.key === "Enter")
                        doSearch(); }); } }),
                h("button", { type: "button", className: "btn-sm", onClick: doSearch }, "Search")),
            h("div", { className: "gift-results", ref: (el) => (results = el) }),
            h("div", { className: "gift-picked", ref: (el) => (picked = el) }),
            h("div", { className: "adm-row" },
                h("input", { type: "number", min: "1", step: "1", placeholder: "Points to gift", ref: (el) => (amount = el) }),
                chip(1000),
                chip(5000),
                chip(10000),
                h("button", { type: "button", className: "btn-sm primary", ref: (el) => (sendBtn = el), onClick: send }, "Send gift"))));
        paintPicked();
        return card;
    }
    /** MLBB orders waiting for the admin, plus the last delivered ones. */
    function ordersCard() {
        let box;
        const load = async () => {
            const all = (await Rewards.adminOrders()).filter((o) => o.kind === "mlbb");
            const pending = all.filter((o) => o.status === "pending").reverse(); // oldest first
            const done = all.filter((o) => o.status === "done").slice(0, 8);
            const row = (o) => (h("div", { className: "adm-order" + (o.status === "done" ? " done" : "") },
                h("div", { className: "adm-order-main" },
                    h("b", null, o.item_title),
                    " ",
                    h("small", null,
                        "\u00B7 ",
                        o.user_name || "Student",
                        " \u00B7 ",
                        when(o.created_at)),
                    h("div", { className: "adm-order-info" },
                        "ID ",
                        h("code", null, o.game_id),
                        " \u00B7 Server ",
                        h("code", null, o.server),
                        " \u00B7 IGN ",
                        h("code", null, o.ign))),
                o.status === "pending" ? (h("span", { className: "adm-order-btns" },
                    h("button", { type: "button", className: "btn-sm", onClick: () => copyText(`${o.game_id} (${o.server}) ${o.ign}`) }, "Copy details"),
                    h("button", { type: "button", className: "btn-sm primary", onClick: async (e) => {
                            e.currentTarget.disabled = true;
                            const res = await Rewards.adminMarkDone(o.id);
                            Utils.toast(res.ok ? "Marked as delivered. The student was told." : res.reason || "Couldn't update.", 3200);
                            load();
                        } }, "Mark delivered"))) : h("span", { className: "adm-stock" }, "Delivered \u2713")));
            mountInto(box, pending.length ? pending.map(row) : h("small", null, "No MLBB orders waiting. \uD83C\uDF89"), done.length ? h("h4", { className: "adm-sub" }, "Recently delivered") : null, done.map(row));
        };
        const card = (h("div", { className: "adm-card" },
            h("h3", null, "\uD83D\uDC8E MLBB orders"),
            h("p", { className: "adm-hint" },
                "You get a notification for every new order. Send the diamonds / item in the game, then tap ",
                h("b", null, "Mark delivered"),
                " so the student knows."),
            h("div", { ref: (el) => (box = el) },
                h("small", null, "Loading\u2026")),
            h("button", { type: "button", className: "btn-sm ghost", style: "margin-top:8px", onClick: load }, "Refresh orders")));
        load();
        return card;
    }
    /** The "add a reward" form, the stock list, gifts and orders. */
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
            h("h3", null, "Add a reward"),
            h("p", { className: "adm-hint" },
                "New rewards show up in the shop for everyone straight away. ",
                h("b", null, "CODM"),
                ": paste the codes, one per line (the number of codes is the stock). ",
                h("b", null, "MLBB"),
                ": set how many you can deliver."),
            h("div", { className: "adm-form" },
                h("select", { ref: (el) => { fKind = el; el.addEventListener("change", syncKind); } },
                    h("option", { value: "codm" }, "CODM: student gets a code"),
                    h("option", { value: "mlbb" }, "MLBB: student enters ID, server, IGN")),
                h("input", { type: "text", maxLength: "8", placeholder: "Emoji \uD83C\uDF81", ref: (el) => (fEmoji = el) }),
                h("input", { type: "text", maxLength: "40", placeholder: "Name (e.g. 80 CP)", ref: (el) => (fTitle = el) }),
                h("input", { type: "text", maxLength: "120", placeholder: "Short description", className: "wide", ref: (el) => (fBlurb = el) }),
                h("input", { type: "number", min: "1", step: "1", placeholder: "Cost (points)", ref: (el) => (fCost = el) }),
                h("span", { ref: (el) => (stockWrap = el), className: "hidden" },
                    h("input", { type: "number", min: "0", step: "1", placeholder: "Stock (how many)", ref: (el) => (fStock = el) })),
                h("span", { ref: (el) => (codesWrap = el), className: "wide" },
                    h("textarea", { rows: "4", placeholder: "Paste CODM codes here, one per line", ref: (el) => (fCodes = el) })),
                h("button", { type: "button", className: "btn primary", disabled: !editable, onClick: async (e) => {
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
                h("span", { className: "adm-stock" + (r.stock <= 0 ? " out" : "") }, isCodm ? (r.stock <= 0 ? "No codes left" : `${r.stock.toLocaleString()} ${r.stock === 1 ? "code" : "codes"} left`) : stockText(r)),
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
                h("button", { type: "button", className: "btn-sm ghost", disabled: !editable, onClick: () => run(Rewards.adminSetActive(r.id, r.active === false), r.active === false ? `${r.title} is visible again.` : `${r.title} is hidden from students.`) }, r.active === false ? "Show" : "Hide"),
                h("button", { type: "button", className: "btn-sm ghost danger", disabled: !editable, onClick: () => {
                        if (!confirm(`Delete ${r.title} from the shop? ${isCodm ? "Its unused codes are deleted too. " : ""}Past orders stay in the list.`))
                            return;
                        run(Rewards.adminDelete(r.id), `${r.title} was deleted.`);
                    } }, "Delete")));
        };
        const err = Rewards.shopError();
        return (h("section", { className: "adm-panel" },
            h("h2", { className: "section-title" }, "\uD83D\uDEE1\uFE0F Admin panel"),
            giveBar(reload),
            !editable ? (h("div", { className: "adm-warn" },
                "The shop needs its tables in the database. Open Supabase \u2192 SQL Editor and run ",
                h("code", null, "supabase/schema.sql"),
                " again (section 25), then refresh.",
                err ? h("small", null, err) : null)) : null,
            giftCard(),
            ordersCard(),
            addForm,
            h("div", { className: "adm-card" },
                h("h3", null, "Stock"),
                h("p", { className: "adm-hint" },
                    "A reward with no stock turns ",
                    h("b", null, "gray"),
                    " for students. ",
                    h("b", null, "CODM"),
                    ": paste more codes and tap ",
                    h("b", null, "+ Add codes"),
                    ". ",
                    h("b", null, "MLBB"),
                    ": type a number, then ",
                    h("b", null, "+ Add stock"),
                    " (add on top) or ",
                    h("b", null, "Set"),
                    " (exact amount). Hidden items are only visible to admins."),
                h("div", { className: "adm-list" }, items.length ? items.map(row) : h("small", null, "No rewards yet. Add one above.")),
                h("button", { type: "button", className: "btn-sm ghost", onClick: refresh }, "Refresh stock"))));
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
            h("a", { href: "#games", className: "see-all" }, "Play a game \u2192")), myOrdersSection(), h("h2", { className: "section-title", style: "margin-top:26px" }, "Recent activity"), st.log.length ? (h("div", { className: "rd-log" }, st.log.map((l) => (h("div", { className: "rd-row" },
            h("span", null, l.game),
            h("span", { className: "rd-when" }, when(l.t)),
            h("b", { className: l.pts < 0 ? "neg" : "pos" },
                l.pts > 0 ? "+" : "",
                l.pts.toLocaleString(),
                " pts")))))) : h("div", { className: "empty-state", style: "padding:30px 20px" }, "Nothing yet. Finish a game round to earn your first points."));
    }
    /** Route entry: draw right away, then pull the newest items + stock and draw again (only if still on this page). */
    function mount(view) {
        draw(view);
        Rewards.loadCatalog().then(() => { if (view.dataset.page === "redeem")
            draw(view); });
    }
    return { mount, giveBar };
})();
