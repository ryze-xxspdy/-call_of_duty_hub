"use strict";
const Store = (() => {
    let me = null;
    let root = null;
    let token = 0; // changes every time the page is (re)drawn, so late answers from an old draw are ignored
    let rewardsHooked = false;
    const peso = (n) => "₱" + Number(n).toLocaleString("en-PH", { minimumFractionDigits: Number(n) % 1 ? 2 : 0, maximumFractionDigits: 2 });
    const num = (n) => Number(n).toLocaleString("en-US");
    const db = () => Auth.client;
    function when(t) {
        const s = Math.max(0, (Date.now() - new Date(t).getTime()) / 1000);
        if (s < 60)
            return "just now";
        if (s < 3600)
            return Math.floor(s / 60) + " min ago";
        if (s < 86400)
            return Math.floor(s / 3600) + " h ago";
        return Utils.formatShortDate(new Date(t));
    }
    /** Calls the maya-checkout Edge Function and turns any failure into a readable message. */
    async function call(body) {
        const { data, error } = await db().functions.invoke("maya-checkout", { body });
        if (error) {
            let msg = "";
            try {
                const j = await error.context.json();
                msg = j && j.error;
            }
            catch { /* not JSON */ }
            if (!msg)
                msg = /not found|404|Failed to send/i.test(String(error.message))
                    ? "The payment service isn't set up yet. The developer needs to deploy the Maya Edge Functions (see README)."
                    : error.message;
            if (/account is banned/i.test(msg) && me)
                Auth.checkBanned(me.id).then((b) => { if (b)
                    location.replace("index.html"); }); // signs them out and shows the ban pop-up with the reason
            throw new Error(msg);
        }
        if (data && data.error)
            throw new Error(data.error);
        return data;
    }
    function modal(build) {
        const wrap = document.createElement("div");
        wrap.className = "modal-backdrop";
        const close = () => wrap.remove();
        wrap.appendChild(build(close));
        wrap.addEventListener("click", (e) => { if (e.target === wrap)
            close(); });
        document.body.appendChild(wrap);
    }
    /** Pay window: summary -> Gmail code -> Maya. */
    function confirmPay(pack) {
        modal((close) => {
            const total = pack.points + pack.bonus;
            const email = (me && me.email) || "";
            const hidden = email.replace(/^(.{2}).*(@.*)$/, "$1•••$2");
            let box;
            let cooldown = null;
            const summary = (h("div", { className: "st-sum" },
                h("div", null,
                    h("span", null, "Points"),
                    h("b", null, num(pack.points))),
                pack.bonus > 0 ? h("div", null,
                    h("span", null, "Bonus"),
                    h("b", { className: "st-plus" },
                        "+",
                        num(pack.bonus))) : null,
                h("div", { className: "st-total" },
                    h("span", null, "Total points"),
                    h("b", null, num(total))),
                h("div", { className: "st-total" },
                    h("span", null, "You pay"),
                    h("b", null, peso(pack.price_php)))));
            /* step 1: summary + "Pay" (sends the code) */
            const stepSummary = (note = "") => {
                let btn, err;
                const go = async () => {
                    btn.disabled = true;
                    btn.textContent = "Sending code…";
                    err.textContent = "";
                    try {
                        await Auth.sendPaymentCode(email);
                        stepCode();
                    }
                    catch (ex) {
                        err.textContent = ex.message;
                        btn.disabled = false;
                        btn.textContent = "Pay with Maya";
                    }
                };
                mountInto(box, h("h3", null,
                    pack.emoji,
                    " ",
                    pack.title,
                    " pack"), h("p", null,
                    "To keep your account safe we'll send a 6-digit code to ",
                    h("b", null, hidden || "your Gmail"),
                    " before you pay. Your points are added automatically once Maya confirms the payment."), summary, h("p", { className: "st-err", role: "alert", ref: (el) => (err = el) }, note), h("div", { className: "modal-actions" },
                    h("button", { type: "button", className: "btn ghost", onClick: close }, "Cancel"),
                    h("button", { type: "button", className: "btn primary st-maya-btn", ref: (el) => (btn = el), onClick: go }, "Pay with Maya")));
            };
            /* step 2: type the code, then straight to Maya */
            const stepCode = () => {
                let input, btn, err, resend;
                const startCooldown = () => {
                    let left = 60;
                    resend.disabled = true;
                    resend.textContent = `Send again (${left}s)`;
                    clearInterval(cooldown);
                    cooldown = setInterval(() => {
                        if (!resend.isConnected)
                            return clearInterval(cooldown);
                        left--;
                        if (left <= 0) {
                            clearInterval(cooldown);
                            resend.disabled = false;
                            resend.textContent = "Send again";
                        }
                        else
                            resend.textContent = `Send again (${left}s)`;
                    }, 1000);
                };
                let busy = false;
                const submit = async () => {
                    const code = input.value.replace(/\D/g, "");
                    if (busy || code.length < 6) {
                        if (code.length < 6)
                            err.textContent = "Type the 6-digit code from your Gmail.";
                        return;
                    }
                    busy = true;
                    btn.disabled = true;
                    btn.textContent = "Checking…";
                    err.textContent = "";
                    try {
                        await Auth.confirmPaymentCode(email, code);
                        btn.textContent = "Opening Maya…";
                        const res = await call({ action: "create", package_id: pack.id, return_url: location.origin + location.pathname });
                        location.href = res.redirectUrl;
                    }
                    catch (ex) {
                        err.textContent = ex.message;
                        busy = false;
                        btn.disabled = false;
                        btn.textContent = "Verify & pay";
                        if (/wrong|expired/i.test(ex.message)) {
                            input.value = "";
                            input.focus();
                        }
                    }
                };
                mountInto(box, h("h3", null, "Enter your Gmail code"), h("p", null,
                    "We sent a 6-digit code to ",
                    h("b", null, hidden || "your Gmail"),
                    ". It can take a few seconds to arrive. Check Spam too."), h("input", { type: "text", className: "st-code", inputmode: "numeric", autocomplete: "one-time-code", maxlength: "6", placeholder: "\u2022\u2022\u2022\u2022\u2022\u2022", "aria-label": "6-digit code", ref: (el) => (input = el), onInput: () => { input.value = input.value.replace(/\D/g, "").slice(0, 6); if (input.value.length === 6)
                        submit(); }, onKeydown: (e) => { if (e.key === "Enter")
                        submit(); } }), h("p", { className: "st-err", role: "alert", ref: (el) => (err = el) }), h("div", { className: "modal-actions" },
                    h("button", { type: "button", className: "btn ghost", ref: (el) => (resend = el), onClick: async () => {
                            err.textContent = "";
                            try {
                                await Auth.sendPaymentCode(email);
                                startCooldown();
                                err.textContent = "New code sent.";
                                err.classList.add("ok");
                            }
                            catch (ex) {
                                err.classList.remove("ok");
                                err.textContent = ex.message;
                            }
                        } }, "Send again"),
                    h("button", { type: "button", className: "btn primary st-maya-btn", ref: (el) => (btn = el), onClick: submit }, "Verify & pay")));
                startCooldown();
                input.focus();
            };
            const win = h("div", { className: "modal st-modal", role: "dialog", "aria-modal": "true", ref: (el) => (box = el) });
            stepSummary();
            return win;
        });
    }
    /** "Thank you for buying" window after a successful payment. */
    function thankYou(pts, orderId) {
        modal((close) => (h("div", { className: "modal st-modal st-thanks", role: "dialog", "aria-modal": "true" },
            h("div", { className: "st-thanks-icon", "aria-hidden": "true" }, "\u2713"),
            h("h3", null, "Thank you for buying!"),
            h("p", null,
                "Your payment went through and ",
                h("b", null,
                    num(pts),
                    " points"),
                " are now in your balance. Enjoy, and good luck with your studies!"),
            h("p", { className: "st-order-no" },
                "Order #",
                orderId.slice(0, 8).toUpperCase()),
            h("div", { className: "modal-actions" },
                h("button", { type: "button", className: "btn ghost", onClick: close }, "Close"),
                h("a", { className: "btn primary", href: "#redeem", onClick: close }, "Spend points")))));
    }
    /* ---------- page ---------- */
    function packCard(p) {
        const total = p.points + p.bonus;
        return (h("article", { className: "st-pack" + (p.badge ? " has-badge" : "") },
            p.badge ? h("span", { className: "st-badge" }, p.badge) : null,
            h("div", { className: "st-emoji", "aria-hidden": "true" }, p.emoji),
            h("h3", null, p.title),
            h("div", { className: "st-pts" },
                h("b", null, num(total)),
                h("span", null, "points")),
            h("p", { className: "st-bonus" }, p.bonus > 0 ? `${num(p.points)} + ${num(p.bonus)} bonus` : " "),
            h("button", { type: "button", className: "btn primary st-buy", onClick: () => confirmPay(p) },
                h("span", null, peso(p.price_php)),
                h("i", null, "Pay with Maya"))));
    }
    const STATUS = { paid: "Paid", pending: "Waiting", failed: "Failed", cancelled: "Cancelled" };
    function orderRow(o) {
        return (h("li", { className: "st-row" },
            h("div", { className: "st-row-main" },
                h("b", null, o.package_title),
                h("small", null, when(o.created_at))),
            h("div", { className: "st-row-pts" },
                o.status === "paid" ? "+" : "",
                num(o.points),
                " pts"),
            h("div", { className: "st-row-amt" }, peso(o.amount_php)),
            h("span", { className: "st-pill " + o.status }, STATUS[o.status] || o.status)));
    }
    async function paintHistory(list, mine) {
        const { data, error } = await db().from("point_purchases").select("*").eq("user_id", me.id).order("created_at", { ascending: false }).limit(15);
        if (mine !== token)
            return;
        if (error || !data || !data.length) {
            mountInto(list, h("li", { className: "st-empty" }, error ? "Purchases will show up here once the store is set up." : "No purchases yet. Your first one will show up here."));
            return;
        }
        mountInto(list, data.map(orderRow));
    }
    function paintBalance(el) {
        const r = Rewards.get();
        el.innerHTML = `<span>Your balance</span><b>⭐ ${num(r.points)}</b><small>points · Level ${Rewards.level().level}</small>`;
    }
    /** Banner shown after coming back from Maya. */
    function banner(kind, text, sub = "") {
        const icon = kind === "checking" ? h("span", { className: "st-spin" }) : kind === "paid" ? h("span", { className: "st-check" }, "\u2713") : h("span", { className: "st-x" }, kind === "pending" ? "…" : "!");
        return (h("div", { className: "st-banner " + kind, role: "status" },
            h("div", { className: "st-banner-icon" }, icon),
            h("div", null,
                h("b", null, text),
                sub ? h("p", null, sub) : null)));
    }
    /** Back from Maya: verify the payment with the server (a few tries, the webhook may be a moment behind). */
    async function handleReturn(kind, orderId, slot, refresh, mine) {
        history.replaceState(null, "", "#store"); // so a refresh doesn't run this again
        if (kind === "cancel") {
            try {
                await call({ action: "cancel", order_id: orderId });
            }
            catch { /* ignore */ }
            mountInto(slot, banner("cancelled", "Payment cancelled", "No money was taken. You can try again any time."));
            return refresh();
        }
        mountInto(slot, banner("checking", "Confirming your payment with Maya…", "This only takes a moment."));
        let status = "pending", pts = 0;
        for (let i = 0; i < 15 && mine === token; i++) {
            try {
                const r = await call({ action: "verify", order_id: orderId });
                status = r.status;
                pts = r.points || 0;
                if (status !== "pending")
                    break;
            }
            catch (ex) {
                mountInto(slot, banner("failed", "We couldn't confirm the payment yet", ex.message));
                return refresh();
            }
            await new Promise((r) => setTimeout(r, i < 3 ? 700 : 1500)); // check quickly at first: the payment is usually already confirmed
        }
        if (mine !== token)
            return;
        if (status === "paid") {
            await Rewards.claimGifts(); // puts the new points in the balance right now
            mountInto(slot, banner("paid", `Thank you for buying! ${num(pts)} points added.`, "They're in your balance. Spend them in Redeem."));
            Utils.toast(`🎉 Thank you! +${num(pts)} points added`, 4000);
            thankYou(pts, orderId);
        }
        else if (status === "failed" || kind === "failed") {
            mountInto(slot, banner("failed", "The payment didn't go through", "No points were added. You can try again."));
        }
        else {
            mountInto(slot, banner("pending", "Still waiting for Maya", "If you paid, your points will appear within a few minutes. This page updates by itself."));
        }
        refresh();
    }
    async function mount(view, user, hash = "store") {
        me = user;
        root = view;
        const mine = ++token;
        let slot, packs, hist, bal;
        mountInto(view, h("div", { className: "page-head st-head" },
            h("div", null,
                h("h1", { className: "greeting" }, "Points store"),
                h("p", { className: "page-sub" },
                    "Buy points with money, then spend them in ",
                    h("a", { href: "#redeem", className: "link-accent" }, "Redeem"),
                    ".")),
            h("div", { className: "st-balance", ref: (el) => (bal = el) })), h("div", { ref: (el) => (slot = el) }), h("section", { className: "st-packs", ref: (el) => (packs = el) },
            h("p", { className: "st-empty" }, "Loading packs\u2026")), h("div", { className: "st-pay-note" },
            h("span", { className: "st-maya-tag" }, "Maya"),
            h("p", null,
                "Payments are handled by ",
                h("b", null, "Maya (PayMaya)"),
                ". We never see your wallet or card details. Prices are in Philippine pesos.")), h("section", { className: "st-history" },
            h("h2", { className: "section-title" }, "Your purchases"),
            h("ul", { className: "st-list", ref: (el) => (hist = el) })));
        paintBalance(bal);
        if (!/^store-(success|failed|cancel)-/i.test(hash))
            call({ action: "ping" }).catch(() => { }); // wakes the payment function up so "Pay" is quick
        if (!rewardsHooked) {
            rewardsHooked = true;
            Rewards.on(() => { const b = root && root.querySelector(".st-balance"); if (b && location.hash.startsWith("#store"))
                paintBalance(b); });
        }
        const refresh = () => { if (mine === token)
            paintHistory(hist, mine); };
        const { data, error } = await db().from("point_packages").select("*").eq("active", true).order("sort");
        if (mine !== token)
            return;
        if (error) {
            mountInto(packs, h("p", { className: "st-empty" },
                "The store isn't set up yet. The developer needs to re-run ",
                h("code", null, "supabase/schema.sql"),
                " (section 27)."));
        }
        else if (!data || !data.length) {
            mountInto(packs, h("p", { className: "st-empty" }, "No packs are on sale right now. Please check back soon."));
        }
        else {
            mountInto(packs, data.map((p) => packCard(p)));
        }
        refresh();
        const m = /^store-(success|failed|cancel)-([0-9a-f-]{36})$/i.exec(hash);
        if (m)
            await handleReturn(m[1].toLowerCase(), m[2], slot, refresh, mine);
    }
    return { mount };
})();
