/* ---------- Points store: buy points with money (Maya / PayMaya only) ----------
   1. The student picks a pack and presses "Pay with Maya".
   2. The `maya-checkout` Edge Function makes an unpaid order + a Maya checkout and we send the browser to Maya's page.
   3. Maya sends the student back to  #store-success-<order>  (or -failed / -cancel).
   4. We ask the Edge Function to verify the payment with Maya (the browser is never trusted), it credits the points once
      (as a "Points Store" gift), and Rewards.claimGifts() puts them in the balance right away.
   The Maya webhook (`maya-webhook`) does the same in the background, so points still arrive if the student closes the tab. */
interface PointPack { id: string; title: string; emoji: string; points: number; bonus: number; price_php: number; badge: string; sort: number; }
interface PointOrder { id: string; package_title: string; points: number; amount_php: number; status: "pending" | "paid" | "failed" | "cancelled"; created_at: string; paid_at: string | null; }

const Store = (() => {
  let me: any = null;
  let root: Element | null = null;
  let token = 0;                       // changes every time the page is (re)drawn, so late answers from an old draw are ignored
  let rewardsHooked = false;

  const peso = (n: number) => "₱" + Number(n).toLocaleString("en-PH", { minimumFractionDigits: Number(n) % 1 ? 2 : 0, maximumFractionDigits: 2 });
  const num = (n: number) => Number(n).toLocaleString("en-US");
  const db = () => Auth.client;

  function when(t: string): string {
    const s = Math.max(0, (Date.now() - new Date(t).getTime()) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return Math.floor(s / 60) + " min ago";
    if (s < 86400) return Math.floor(s / 3600) + " h ago";
    return Utils.formatShortDate(new Date(t));
  }

  /** Calls the maya-checkout Edge Function and turns any failure into a readable message. */
  async function call(body: Record<string, any>): Promise<any> {
    const { data, error } = await db().functions.invoke("maya-checkout", { body });
    if (error) {
      let msg = "";
      try { const j = await error.context.json(); msg = j && j.error; } catch { /* not JSON */ }
      if (!msg) msg = /not found|404|Failed to send/i.test(String(error.message))
        ? "The payment service isn't set up yet. The developer needs to deploy the Maya Edge Functions (see README)."
        : error.message;
      throw new Error(msg);
    }
    if (data && data.error) throw new Error(data.error);
    return data;
  }

  function modal(build: (close: () => void) => Node): void {
    const wrap = document.createElement("div");
    wrap.className = "modal-backdrop";
    const close = () => wrap.remove();
    wrap.appendChild(build(close));
    wrap.addEventListener("click", (e) => { if (e.target === wrap) close(); });
    document.body.appendChild(wrap);
  }

  /** "Are you sure?" window, then off to Maya. */
  function confirmPay(pack: PointPack): void {
    modal((close) => {
      let btn: HTMLButtonElement, err: HTMLElement;
      const go = async () => {
        btn.disabled = true; btn.textContent = "Opening Maya…"; err.textContent = "";
        try {
          const res = await call({ action: "create", package_id: pack.id, return_url: location.origin + location.pathname });
          location.href = res.redirectUrl;
        } catch (ex) {
          err.textContent = ex.message;
          btn.disabled = false; btn.textContent = "Pay with Maya";
        }
      };
      return (
        <div className="modal st-modal" role="dialog" aria-modal="true">
          <h3>{pack.emoji} {pack.title} pack</h3>
          <p>You'll pay on Maya's secure checkout page. Your points are added automatically once the payment goes through.</p>
          <div className="st-sum">
            <div><span>Points</span><b>{num(pack.points)}</b></div>
            {pack.bonus > 0 ? <div><span>Bonus</span><b className="st-plus">+{num(pack.bonus)}</b></div> : null}
            <div className="st-total"><span>Total points</span><b>{num(pack.points + pack.bonus)}</b></div>
            <div className="st-total"><span>You pay</span><b>{peso(pack.price_php)}</b></div>
          </div>
          <p className="st-err" role="alert" ref={(el: HTMLElement) => (err = el)}></p>
          <div className="modal-actions">
            <button type="button" className="btn ghost" onClick={close}>Cancel</button>
            <button type="button" className="btn primary st-maya-btn" ref={(el: HTMLButtonElement) => (btn = el)} onClick={go}>Pay with Maya</button>
          </div>
        </div>
      );
    });
  }

  /* ---------- page ---------- */
  function packCard(p: PointPack) {
    const total = p.points + p.bonus;
    return (
      <article className={"st-pack" + (p.badge ? " has-badge" : "")}>
        {p.badge ? <span className="st-badge">{p.badge}</span> : null}
        <div className="st-emoji" aria-hidden="true">{p.emoji}</div>
        <h3>{p.title}</h3>
        <div className="st-pts"><b>{num(total)}</b><span>points</span></div>
        <p className="st-bonus">{p.bonus > 0 ? `${num(p.points)} + ${num(p.bonus)} bonus` : " "}</p>
        <button type="button" className="btn primary st-buy" onClick={() => confirmPay(p)}>
          <span>{peso(p.price_php)}</span><i>Pay with Maya</i>
        </button>
      </article>
    );
  }

  const STATUS: Record<string, string> = { paid: "Paid", pending: "Waiting", failed: "Failed", cancelled: "Cancelled" };

  function orderRow(o: PointOrder) {
    return (
      <li className="st-row">
        <div className="st-row-main"><b>{o.package_title}</b><small>{when(o.created_at)}</small></div>
        <div className="st-row-pts">{o.status === "paid" ? "+" : ""}{num(o.points)} pts</div>
        <div className="st-row-amt">{peso(o.amount_php)}</div>
        <span className={"st-pill " + o.status}>{STATUS[o.status] || o.status}</span>
      </li>
    );
  }

  async function paintHistory(list: Element, mine: number) {
    const { data, error } = await db().from("point_purchases").select("*").eq("user_id", me.id).order("created_at", { ascending: false }).limit(15);
    if (mine !== token) return;
    if (error || !data || !data.length) {
      mountInto(list, <li className="st-empty">{error ? "Purchases will show up here once the store is set up." : "No purchases yet. Your first one will show up here."}</li>);
      return;
    }
    mountInto(list, data.map(orderRow));
  }

  function paintBalance(el: Element) {
    const r = Rewards.get();
    el.innerHTML = `<span>Your balance</span><b>⭐ ${num(r.points)}</b><small>points · Level ${Rewards.level().level}</small>`;
  }

  /** Banner shown after coming back from Maya. */
  function banner(kind: "checking" | "paid" | "failed" | "cancelled" | "pending", text: string, sub = "") {
    const icon = kind === "checking" ? <span className="st-spin" /> : kind === "paid" ? <span className="st-check">✓</span> : <span className="st-x">{kind === "pending" ? "…" : "!"}</span>;
    return (
      <div className={"st-banner " + kind} role="status">
        <div className="st-banner-icon">{icon}</div>
        <div><b>{text}</b>{sub ? <p>{sub}</p> : null}</div>
      </div>
    );
  }

  /** Back from Maya: verify the payment with the server (a few tries, the webhook may be a moment behind). */
  async function handleReturn(kind: string, orderId: string, slot: Element, refresh: () => void, mine: number) {
    history.replaceState(null, "", "#store");            // so a refresh doesn't run this again
    if (kind === "cancel") {
      try { await call({ action: "cancel", order_id: orderId }); } catch { /* ignore */ }
      mountInto(slot, banner("cancelled", "Payment cancelled", "No money was taken. You can try again any time."));
      return refresh();
    }
    mountInto(slot, banner("checking", "Confirming your payment with Maya…", "This only takes a moment."));
    let status = "pending", pts = 0;
    for (let i = 0; i < 6 && mine === token; i++) {
      try {
        const r = await call({ action: "verify", order_id: orderId });
        status = r.status; pts = r.points || 0;
        if (status !== "pending") break;
      } catch (ex) {
        mountInto(slot, banner("failed", "We couldn't confirm the payment yet", ex.message));
        return refresh();
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
    if (mine !== token) return;
    if (status === "paid") {
      await Rewards.claimGifts();                         // puts the new points in the balance right now
      mountInto(slot, banner("paid", `Payment received! ${num(pts)} points added.`, "They're in your balance. Spend them in Redeem."));
      Utils.toast(`🎉 +${num(pts)} points added!`, 4000);
    } else if (status === "failed" || kind === "failed") {
      mountInto(slot, banner("failed", "The payment didn't go through", "No points were added. You can try again."));
    } else {
      mountInto(slot, banner("pending", "Still waiting for Maya", "If you paid, your points will appear within a few minutes. This page updates by itself."));
    }
    refresh();
  }

  async function mount(view: Element, user: any, hash = "store") {
    me = user; root = view;
    const mine = ++token;

    let slot!: HTMLElement, packs!: HTMLElement, hist!: HTMLElement, bal!: HTMLElement;
    mountInto(view,
      <div className="page-head st-head">
        <div>
          <h1 className="greeting">Points store</h1>
          <p className="page-sub">Buy points with money, then spend them in <a href="#redeem" className="link-accent">Redeem</a>.</p>
        </div>
        <div className="st-balance" ref={(el: HTMLElement) => (bal = el)}></div>
      </div>,
      <div ref={(el: HTMLElement) => (slot = el)}></div>,
      <section className="st-packs" ref={(el: HTMLElement) => (packs = el)}>
        <p className="st-empty">Loading packs…</p>
      </section>,
      <div className="st-pay-note">
        <span className="st-maya-tag">Maya</span>
        <p>Payments are handled by <b>Maya (PayMaya)</b>. We never see your wallet or card details. Prices are in Philippine pesos.</p>
      </div>,
      <section className="st-history">
        <h2 className="section-title">Your purchases</h2>
        <ul className="st-list" ref={(el: HTMLElement) => (hist = el)}></ul>
      </section>
    );

    paintBalance(bal);
    if (!rewardsHooked) { rewardsHooked = true; Rewards.on(() => { const b = root && root.querySelector(".st-balance"); if (b && location.hash.startsWith("#store")) paintBalance(b); }); }

    const refresh = () => { if (mine === token) paintHistory(hist, mine); };

    const { data, error } = await db().from("point_packages").select("*").eq("active", true).order("sort");
    if (mine !== token) return;
    if (error) {
      mountInto(packs, <p className="st-empty">The store isn't set up yet. The developer needs to re-run <code>supabase/schema.sql</code> (section 27).</p>);
    } else if (!data || !data.length) {
      mountInto(packs, <p className="st-empty">No packs are on sale right now. Please check back soon.</p>);
    } else {
      mountInto(packs, data.map((p: PointPack) => packCard(p)));
    }
    refresh();

    const m = /^store-(success|failed|cancel)-([0-9a-f-]{36})$/i.exec(hash);
    if (m) await handleReturn(m[1].toLowerCase(), m[2], slot, refresh, mine);
  }

  return { mount };
})();
