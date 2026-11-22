/* ---------- Redeem page: spend game points on CODM codes and MLBB top-ups ----------
   CODM  -> the student gets a code straight away.
   MLBB  -> the student enters Game ID, Server and IGN; admins / the developer get a notification and deliver it.
   A reward with no stock turns gray.
   Admins and the developer also get an admin panel here (tabs: Orders, Gift points, Add reward, Stock) and can give themselves points.
   "Recent activity" at the bottom is PUBLIC: everyone sees who redeemed, got a delivery or received a gift (never codes, IDs or emails). */
const Redeem = (() => {
  function when(t: number | string): string {
    const ms = typeof t === "number" ? t : new Date(t).getTime();
    const s = Math.max(0, (Date.now() - ms) / 1000);
    if (s < 60) return "just now";
    if (s < 3600) return Math.floor(s / 60) + " min ago";
    if (s < 86400) return Math.floor(s / 3600) + " h ago";
    return Utils.formatShortDate(new Date(ms));
  }

  const stockText = (r: RewardItem) => r.stock <= 0 ? "Out of stock" : `${r.stock.toLocaleString()} left`;
  const kindName = (k: string) => k === "codm" ? "CODM code" : "MLBB";
  const kindHint = (k: string) => k === "codm" ? "🎯 You get a code right away" : "💎 Enter your ID, server and IGN";

  function copyText(text: string): void {
    const done = () => Utils.toast("Copied!", 1800);
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => Utils.toast("Couldn't copy. Select the code and copy it by hand.", 3200));
    else Utils.toast("Couldn't copy. Select the code and copy it by hand.", 3200);
  }

  /** Small pop-up window. `build` gets a close() function and returns the modal element. */
  function openModal(build: (close: () => void) => Node): void {
    const wrap = document.createElement("div");
    wrap.className = "modal-backdrop";
    const close = () => wrap.remove();
    wrap.appendChild(build(close));
    wrap.addEventListener("click", (e) => { if (e.target === wrap) close(); });
    document.body.appendChild(wrap);
    const first = wrap.querySelector<HTMLElement>("input, button");
    if (first) first.focus();
  }

  /** Shows the CODM code the student just got. */
  function codeModal(item: RewardItem, code: string): void {
    openModal((close) => (
      <div className="modal rd-modal" role="dialog" aria-modal="true">
        <h3>{item.emoji} {item.title}</h3>
        <p>Here is your code. It is also saved under “My redemptions” on this page.</p>
        <div className="rd-code"><code>{code}</code></div>
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={close}>Close</button>
          <button type="button" className="btn primary" onClick={() => copyText(code)}>Copy code</button>
        </div>
      </div>
    ));
  }

  /** MLBB: asks for Game ID, Server and IGN, then sends the order to the admins. */
  function mlbbModal(item: RewardItem, onDone: () => void): void {
    openModal((close) => {
      let fId: HTMLInputElement, fServer: HTMLInputElement, fIgn: HTMLInputElement, btn: HTMLButtonElement;
      const submit = async () => {
        const gameId = fId.value.trim(), server = fServer.value.trim(), ign = fIgn.value.trim();
        if (!/^\d{4,15}$/.test(gameId)) return Utils.toast("Enter your Game ID (numbers only).", 3000);
        if (!/^\d{1,6}$/.test(server)) return Utils.toast("Enter your Server (numbers only).", 3000);
        if (ign.length < 2 || ign.length > 40) return Utils.toast("Enter your in-game name (IGN).", 3000);
        btn.disabled = true;
        const res = await Rewards.redeem(item.id, { gameId, server, ign });
        if (!res.ok) { btn.disabled = false; Utils.toast(res.reason || "Couldn't redeem.", 3600); return; }
        close();
        Utils.toast(`💎 Order sent! An admin was notified and will deliver ${item.title} to ${ign}.`, 5200);
        onDone();
      };
      return (
        <div className="modal rd-modal" role="dialog" aria-modal="true">
          <h3>{item.emoji} {item.title}</h3>
          <p>{item.cost.toLocaleString()} points. Enter your Mobile Legends details exactly as they appear in the game. An admin will be notified and send it to you.</p>
          <label className="field-label" htmlFor="rd-gid">Game ID</label>
          <input id="rd-gid" type="text" inputMode="numeric" maxLength="15" placeholder="e.g. 123456789" ref={(el: HTMLInputElement) => (fId = el)} />
          <label className="field-label" htmlFor="rd-srv" style="margin-top:12px">Server</label>
          <input id="rd-srv" type="text" inputMode="numeric" maxLength="6" placeholder="e.g. 1234" ref={(el: HTMLInputElement) => (fServer = el)} />
          <label className="field-label" htmlFor="rd-ign" style="margin-top:12px">In-game name (IGN)</label>
          <input id="rd-ign" type="text" maxLength="40" placeholder="Your IGN" ref={(el: HTMLInputElement) => (fIgn = el)} />
          <div className="modal-actions">
            <button type="button" className="btn ghost" onClick={close}>Cancel</button>
            <button type="button" className="btn primary" ref={(el: HTMLButtonElement) => (btn = el)} onClick={submit}>Redeem</button>
          </div>
        </div>
      );
    });
  }

  /** Small "give myself points" bar. Used on the Redeem page and at the top of the Games page (admins / developer only). */
  function giveBar(onChange?: () => void): Node {
    if (!Rewards.isStaff()) return document.createDocumentFragment();
    let input: HTMLInputElement;
    const amount = () => Number(String(input.value).replace(/,/g, ""));
    const done = (res: { ok: boolean; reason?: string }, msg: string) => {
      if (!res.ok) { Utils.toast(res.reason || "Couldn't do that.", 3200); return; }
      Utils.toast(msg, 2600);
      if (onChange) onChange();
    };
    const chip = (n: number) => (
      <button type="button" className="btn-sm" onClick={() => done(Rewards.adminGive(n), `+${n.toLocaleString()} points added.`)}>+{n.toLocaleString()}</button>
    );
    return (
      <div className="adm-bar">
        <strong>🛡️ Your points <small>(admins only)</small></strong>
        <div className="adm-row">
          <input type="number" min="0" step="1" placeholder="Amount" ref={(el: HTMLInputElement) => (input = el)} />
          <button type="button" className="btn-sm primary" onClick={() => done(Rewards.adminGive(amount()), `+${amount().toLocaleString()} points added.`)}>Add</button>
          <button type="button" className="btn-sm" onClick={() => done(Rewards.adminSet(amount()), `Balance set to ${amount().toLocaleString()} points.`)}>Set balance</button>
          {chip(1000)}{chip(10000)}{chip(100000)}
        </div>
        <small>Only admins can see this. Admins and the developer are always Level {Rewards.MAX_LEVEL}.</small>
      </div>
    );
  }

  const roleTag = (role: string) => (role && role !== "student" ? raw(Utils.roleBadge(role)) : null);

  /** Gift points to another person. Points only: their level and XP stay exactly as they are.
   *  Two steps: 1) pick who (live search), 2) pick how many. */
  function giftCard(): Node {
    let search: HTMLInputElement, amount: HTMLInputElement, results: HTMLElement, pickStep: HTMLElement, chosenStep: HTMLElement,
        chosenBox: HTMLElement, sendBtn: HTMLButtonElement;
    let target: ShopUser | null = null;
    let timer: any, seq = 0;

    const personRow = (u: ShopUser) => (
      <span className="gp-person">
        {raw(Utils.avatar(u.name || u.email, u.avatar || null, "sm"))}
        <span className="gp-who"><b>{u.name || "(no name)"}{roleTag(u.role)}</b><small>{u.email}</small></span>
      </span>
    );

    const amountNow = () => Math.floor(Number(String(amount.value).replace(/,/g, "")));
    const paint = () => {
      pickStep.classList.toggle("hidden", !!target);
      chosenStep.classList.toggle("hidden", !target);
      if (target) mountInto(chosenBox, personRow(target));
      const n = amountNow();
      sendBtn.disabled = !target;
      sendBtn.textContent = target && Number.isFinite(n) && n > 0 ? `Send ${n.toLocaleString()} points` : "Send gift";
    };

    const doSearch = async () => {
      const q = search.value.trim(), mine = ++seq;
      if (q.length < 2) { mountInto(results, <small className="gp-hint">Type at least 2 letters of a name or email.</small>); return; }
      mountInto(results, <small className="gp-hint">Searching…</small>);
      const users = await Rewards.findUsers(q);
      if (mine !== seq) return;
      mountInto(results, users.length ? users.map((u) => (
        <button type="button" className="gp-result" onClick={() => { target = u; paint(); amount.focus(); }}>
          {personRow(u)}<span className="gp-pick">Select</span>
        </button>
      )) : <small className="gp-hint">No one found.</small>);
    };

    const send = async () => {
      if (!target) return;
      const n = amountNow();
      if (!Number.isFinite(n) || n < 1) return Utils.toast("Enter how many points to gift.", 2600);
      const who = target.name || target.email;
      if (!confirm(`Send ${n.toLocaleString()} points to ${who}?`)) return;
      sendBtn.disabled = true;
      const res = await Rewards.adminGift(target.id, n);
      if (!res.ok) { paint(); return Utils.toast(res.reason || "Couldn't send the gift.", 4200); }
      Utils.toast(`🎁 Sent ${n.toLocaleString()} points to ${who}.`, 3200);
      amount.value = ""; target = null; search.value = "";
      mountInto(results);
      paint();
    };

    const chip = (n: number) => <button type="button" className="chip-btn" onClick={() => { amount.value = String(n); paint(); }}>{n.toLocaleString()}</button>;

    const card = (
      <div className="adm-card">
        <h3>🎁 Gift points</h3>
        <p className="adm-hint">Points go straight into their balance and they get a notification. Levels and XP never change.</p>

        <div className="gp-step">
          <span className="gp-label">1 · Who gets it?</span>
          <div ref={(el: HTMLElement) => (pickStep = el)}>
            <input type="search" className="gp-search" placeholder="Search a name or email…" autoComplete="off"
              ref={(el: HTMLInputElement) => { search = el; el.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(doSearch, 260); }); }} />
            <div className="gp-results" ref={(el: HTMLElement) => (results = el)}></div>
          </div>
          <div className="gp-chosen hidden" ref={(el: HTMLElement) => (chosenStep = el)}>
            <div ref={(el: HTMLElement) => (chosenBox = el)}></div>
            <button type="button" className="btn-sm ghost" onClick={() => { target = null; paint(); search.focus(); }}>Change</button>
          </div>
        </div>

        <div className="gp-step">
          <span className="gp-label">2 · How many points?</span>
          <input type="number" min="1" step="1" className="gp-amount" placeholder="e.g. 5,000"
            ref={(el: HTMLInputElement) => { amount = el; el.addEventListener("input", paint); }} />
          <div className="gp-chips">{chip(1000)}{chip(5000)}{chip(10000)}{chip(50000)}</div>
        </div>

        <button type="button" className="btn primary gp-send" ref={(el: HTMLButtonElement) => (sendBtn = el)} onClick={send}>Send gift</button>
      </div>
    );
    mountInto(results, <small className="gp-hint">Search for the person you want to gift.</small>);
    paint();
    return card;
  }

  /* Orders: the list reloads by itself when anyone (this admin or another one) marks an order delivered. */
  let ordersReload: (() => void) | null = null;
  let ordersHost: HTMLElement | null = null;
  Notify.onOrder(() => { if (ordersReload && ordersHost && ordersHost.isConnected) ordersReload(); });

  /** MLBB orders waiting for the admin, plus the last delivered ones. */
  function ordersCard(onCount: (n: number) => void): Node {
    let box: HTMLElement;
    const load = async () => {
      const all = (await Rewards.adminOrders()).filter((o) => o.kind === "mlbb");
      if (!box || !box.isConnected) return;
      const pending = all.filter((o) => o.status === "pending").reverse();   // oldest first
      const done = all.filter((o) => o.status === "done").slice(0, 6);
      onCount(pending.length);

      const detail = (label: string, value: string | null) => <span className="ord-d"><small>{label}</small><code>{value}</code></span>;
      const row = (o: ShopOrder) => (
        <div className={"ord" + (o.status === "done" ? " done" : "")}>
          <div className="ord-top">
            <b>{o.item_title}</b>
            <span className="ord-who">{o.user_name || "Student"} · {when(o.created_at)}</span>
          </div>
          <div className="ord-info">{detail("Game ID", o.game_id)}{detail("Server", o.server)}{detail("IGN", o.ign)}</div>
          {o.status === "pending" ? (
            <div className="ord-btns">
              <button type="button" className="btn-sm" onClick={() => copyText(`${o.game_id} (${o.server}) ${o.ign}`)}>Copy details</button>
              <button type="button" className="btn-sm primary" onClick={async (e: Event) => {
                (e.currentTarget as HTMLButtonElement).disabled = true;
                const res = await Rewards.adminMarkDone(o.id);
                if (res.ok) Notify.dropOrder(o.id);
                Utils.toast(res.ok ? "Marked as delivered. The student was told." : res.reason || "Couldn't update.", 3200);
                load();
              }}>Mark delivered</button>
            </div>
          ) : <span className="ord-done">Delivered ✓</span>}
        </div>
      );
      mountInto(box,
        pending.length ? pending.map(row) : <div className="adm-empty">No MLBB orders waiting. 🎉</div>,
        done.length ? <h4 className="adm-sub">Recently delivered</h4> : null,
        done.map(row)
      );
    };
    const card = (
      <div className="adm-card">
        <h3>💎 MLBB orders</h3>
        <p className="adm-hint">Send the diamonds / item in the game, then tap <b>Mark delivered</b>. Once it is delivered the order disappears for the other admins too. CODM codes are handed out automatically, so they never show up here.</p>
        <div ref={(el: HTMLElement) => (box = el)}><small>Loading…</small></div>
      </div>
    );
    ordersReload = load;
    ordersHost = card as HTMLElement;
    load();
    return card;
  }

  /** The admin tools, one tab at a time: Orders · Gift points · Add reward · Stock. */
  let adminTab = "orders";

  function adminPanel(view: HTMLElement, reload: () => void): Node {
    const items = Rewards.shop();
    const editable = Rewards.shopEditable();
    const refresh = async () => { await Rewards.loadCatalog(); reload(); };
    const run = async (p: Promise<{ ok: boolean; reason?: string }>, okMsg: string) => {
      const res = await p;
      if (!res.ok) { Utils.toast(res.reason || "Couldn't save.", 4200); return false; }
      Utils.toast(okMsg, 2600);
      reload();
      return true;
    };

    /* ----- add a reward ----- */
    let fEmoji: HTMLInputElement, fTitle: HTMLInputElement, fBlurb: HTMLInputElement, fCost: HTMLInputElement,
        fStock: HTMLInputElement, fCodes: HTMLTextAreaElement, fKind: HTMLSelectElement, stockWrap: HTMLElement, codesWrap: HTMLElement;
    const syncKind = () => {
      stockWrap.classList.toggle("hidden", fKind.value !== "mlbb");
      codesWrap.classList.toggle("hidden", fKind.value !== "codm");
    };

    const addForm = (
      <div className="adm-card">
        <h3>➕ Add a reward</h3>
        <p className="adm-hint">It shows up in the shop for everyone straight away. <b>CODM</b>: paste the codes, one per line (the number of codes is the stock). <b>MLBB</b>: set how many you can deliver.</p>
        <div className="adm-form">
          <label className="adm-field wide"><span>Type</span>
            <select ref={(el: HTMLSelectElement) => { fKind = el; el.addEventListener("change", syncKind); }}>
              <option value="codm">CODM: student gets a code</option>
              <option value="mlbb">MLBB: student enters ID, server, IGN</option>
            </select>
          </label>
          <label className="adm-field"><span>Emoji</span><input type="text" maxLength="8" placeholder="🎁" ref={(el: HTMLInputElement) => (fEmoji = el)} /></label>
          <label className="adm-field"><span>Name</span><input type="text" maxLength="40" placeholder="e.g. 80 CP" ref={(el: HTMLInputElement) => (fTitle = el)} /></label>
          <label className="adm-field wide"><span>Short description</span><input type="text" maxLength="120" placeholder="What does the student get?" ref={(el: HTMLInputElement) => (fBlurb = el)} /></label>
          <label className="adm-field"><span>Cost (points)</span><input type="number" min="1" step="1" placeholder="e.g. 5000" ref={(el: HTMLInputElement) => (fCost = el)} /></label>
          <label className="adm-field hidden" ref={(el: HTMLElement) => (stockWrap = el)}><span>Stock (how many)</span><input type="number" min="0" step="1" placeholder="e.g. 20" ref={(el: HTMLInputElement) => (fStock = el)} /></label>
          <label className="adm-field wide" ref={(el: HTMLElement) => (codesWrap = el)}><span>CODM codes (one per line)</span><textarea rows="4" placeholder={"ABCD-1234\nEFGH-5678"} ref={(el: HTMLTextAreaElement) => (fCodes = el)}></textarea></label>
          <button type="button" className="btn primary wide" disabled={!editable} onClick={async (e: Event) => {
            const btn = e.currentTarget as HTMLButtonElement;
            const kind = fKind.value as "codm" | "mlbb";
            btn.disabled = true;
            const ok = await run(Rewards.adminSaveItem({
              kind, emoji: fEmoji.value, title: fTitle.value, blurb: fBlurb.value, cost: Number(fCost.value),
              stock: Number(String(fStock.value).trim() || 0), codes: fCodes.value
            }), `${fTitle.value.trim()} was added to the shop.`);
            if (!ok) btn.disabled = false;
          }}>Add to shop</button>
        </div>
      </div>
    );
    syncKind();

    /* ----- stock list ----- */
    const row = (r: RewardItem) => {
      let qty: HTMLInputElement, codes: HTMLTextAreaElement;
      const isCodm = r.kind === "codm";
      return (
        <div className={"adm-item" + (r.active === false ? " off" : "")}>
          <div className="adm-item-head">
            <span className="adm-name">{r.emoji} <b>{r.title}</b> <small>{r.cost.toLocaleString()} pts · {kindName(r.kind)}{r.active === false ? " · hidden" : ""}</small></span>
            <span className={"adm-stock" + (r.stock <= 0 ? " out" : "")}>{isCodm ? (r.stock <= 0 ? "No codes left" : `${r.stock.toLocaleString()} ${r.stock === 1 ? "code" : "codes"} left`) : stockText(r)}</span>
          </div>
          <div className="adm-item-ctl">
            {isCodm ? (
              <textarea rows="2" placeholder="New codes, one per line" className="adm-codes" disabled={!editable} ref={(el: HTMLTextAreaElement) => (codes = el)}></textarea>
            ) : (
              <input type="number" min="0" step="1" placeholder="Qty" ref={(el: HTMLInputElement) => (qty = el)} disabled={!editable} />
            )}
            {isCodm ? (
              <button type="button" className="btn-sm primary" disabled={!editable} onClick={async () => {
                if (!codes.value.trim()) return Utils.toast("Paste at least one code.", 2600);
                if (await run(Rewards.adminAddCodes(r.id, codes.value), `Codes added to ${r.title}.`)) codes.value = "";
              }}>+ Add codes</button>
            ) : (
              <span className="adm-btns">
                <button type="button" className="btn-sm primary" disabled={!editable} onClick={() => {
                  const n = Number(String(qty.value).trim());
                  if (!String(qty.value).trim() || !Number.isFinite(n) || n < 1) return Utils.toast("Type how many to add.", 2600);
                  run(Rewards.adminAddStock(r.id, n), `Added ${n.toLocaleString()} to ${r.title}.`);
                }}>+ Add stock</button>
                <button type="button" className="btn-sm" disabled={!editable} onClick={() => {
                  const n = Number(String(qty.value).trim());
                  if (!String(qty.value).trim() || !Number.isFinite(n) || n < 0) return Utils.toast("Type the exact stock (0 or more).", 2600);
                  run(Rewards.adminSetStock(r.id, n), `${r.title} stock set to ${n.toLocaleString()}.`);
                }}>Set</button>
              </span>
            )}
            <span className="adm-btns">
              <button type="button" className="btn-sm ghost" disabled={!editable} onClick={() => run(Rewards.adminSetActive(r.id, r.active === false), r.active === false ? `${r.title} is visible again.` : `${r.title} is hidden from students.`)}>{r.active === false ? "Show" : "Hide"}</button>
              <button type="button" className="btn-sm ghost danger" disabled={!editable} onClick={() => {
                if (!confirm(`Delete ${r.title} from the shop? ${isCodm ? "Its unused codes are deleted too. " : ""}Past orders stay in the list.`)) return;
                run(Rewards.adminDelete(r.id), `${r.title} was deleted.`);
              }}>Delete</button>
            </span>
          </div>
        </div>
      );
    };

    const stockCard = (
      <div className="adm-card">
        <h3>📦 Stock</h3>
        <p className="adm-hint">A reward with no stock turns <b>gray</b> for students. <b>CODM</b>: paste more codes, then <b>+ Add codes</b>. <b>MLBB</b>: type a number, then <b>+ Add stock</b> (on top) or <b>Set</b> (exact amount). Hidden items are only visible to admins.</p>
        <div className="adm-list">{items.length ? items.map(row) : <div className="adm-empty">No rewards yet. Add one in the “Add reward” tab.</div>}</div>
        <button type="button" className="btn-sm ghost" onClick={refresh}>Refresh stock</button>
      </div>
    );

    /* ----- tabs ----- */
    let countBadge: HTMLElement;
    const setCount = (n: number) => { if (!countBadge) return; countBadge.textContent = String(n); countBadge.classList.toggle("hidden", n === 0); };
    const TABS: [string, string][] = [["orders", "💎 Orders"], ["gift", "🎁 Gift points"], ["add", "➕ Add reward"], ["stock", "📦 Stock"]];
    const panes: Record<string, Node> = { orders: ordersCard(setCount), gift: giftCard(), add: addForm, stock: stockCard };

    const show = (id: string, root: HTMLElement) => {
      adminTab = id;
      root.querySelectorAll<HTMLElement>(".adm-tab").forEach((t) => { t.classList.toggle("on", t.dataset.tab === id); t.setAttribute("aria-selected", String(t.dataset.tab === id)); });
      root.querySelectorAll<HTMLElement>(".adm-pane").forEach((pn) => pn.classList.toggle("hidden", pn.dataset.pane !== id));
    };
    if (!panes[adminTab]) adminTab = "orders";

    const err = Rewards.shopError();
    const panel = (
      <section className="adm-panel">
        <h2 className="section-title">🛡️ Admin tools</h2>
        {giveBar(reload)}
        {!editable ? (
          <div className="adm-warn">
            The shop needs its tables in the database. Open Supabase → SQL Editor and run <code>supabase/schema.sql</code> again (section 25), then refresh.
            {err ? <small>{err}</small> : null}
          </div>
        ) : null}
        <div className="adm-tabs" role="tablist">
          {TABS.map(([id, label]) => (
            <button type="button" role="tab" className="adm-tab" data-tab={id} onClick={(e: Event) => show(id, (e.currentTarget as HTMLElement).closest(".adm-panel") as HTMLElement)}>
              {label}{id === "orders" ? <i className="adm-count hidden" ref={(el: HTMLElement) => (countBadge = el)}>0</i> : null}
            </button>
          ))}
        </div>
        {TABS.map(([id]) => <div className="adm-pane" data-pane={id}>{panes[id]}</div>)}
      </section>
    ) as HTMLElement;
    show(adminTab, panel);
    return panel;
  }

  /** "My redemptions": CODM codes stay here so students can find them again. */
  function myOrdersSection(): Node {
    let box: HTMLElement;
    Rewards.myOrders().then((list) => {
      if (!box || !box.isConnected) return;
      mountInto(box, list.length ? list.map((o) => (
        <div className="rd-row rd-order">
          <span>
            <b>{o.item_title}</b>
            {o.kind === "codm" && o.code
              ? <span className="rd-order-code"><code>{o.code}</code><button type="button" className="btn-sm" onClick={() => copyText(o.code as string)}>Copy</button></span>
              : <small className="rd-order-sub">ID {o.game_id} · Server {o.server} · IGN {o.ign}</small>}
          </span>
          <span className="rd-when">{when(o.created_at)}</span>
          <b className={o.status === "done" ? "pos" : "pend"}>{o.status === "done" ? (o.kind === "codm" ? "Code ready" : "Delivered ✓") : "Waiting for admin"}</b>
        </div>
      )) : <div className="empty-state" style="padding:24px 20px">Nothing redeemed yet.</div>);
    });
    return (
      <div>
        <h2 className="section-title" style="margin-top:26px">My redemptions</h2>
        <div className="rd-log" ref={(el: HTMLElement) => (box = el)}><div className="empty-state" style="padding:24px 20px">Loading…</div></div>
      </div>
    );
  }

  /** PUBLIC recent activity: who redeemed what, what was delivered and who got a gift. Everyone sees the same feed, live.
   *  It only holds names, item names and amounts. Never codes, Game IDs or emails. */
  let stopActivity: (() => void) | null = null;

  function activitySection(): Node {
    let box: HTMLElement;

    const line = (a: ActivityRow) => {
      const who = (
        <a className="act-name" href={a.actor_id ? `#user-${a.actor_id}` : "#redeem"}>{a.actor_name || "Someone"}</a>
      );
      const item = <span className="act-item">{a.item_emoji} {a.item_title}</span>;
      const text = a.kind === "gift"
        ? <>{who} received <b className="act-pts">{(a.amount || 0).toLocaleString()} points</b>{a.by_name ? <> from {a.by_name}</> : null}</>
        : a.kind === "delivered"
          ? <>{who}'s {item} was <b className="act-ok">delivered</b></>
          : <>{who} redeemed {item}</>;
      const p = a.actor_id ? Social.person(a.actor_id) : null;
      return (
        <div className="act-row">
          {raw(Utils.avatar(a.actor_name, p ? p.avatar : null, "sm"))}
          <span className="act-text">{text}</span>
          <span className="act-icon" aria-hidden="true">{a.kind === "gift" ? "🎁" : a.kind === "delivered" ? "✅" : "🛒"}</span>
          <span className="rd-when">{when(a.created_at)}</span>
        </div>
      );
    };

    const load = async () => {
      const rows = await Rewards.activity(25);
      if (!box || !box.isConnected) return;
      const missing = [...new Set(rows.map((r) => r.actor_id).filter((id): id is string => !!id && Social.person(id).name === "Unknown"))];
      if (missing.length) await Social.fetchProfiles(missing);
      if (!box.isConnected) return;
      mountInto(box, rows.length ? rows.map(line) : <div className="empty-state" style="padding:26px 20px">Nothing yet. Redeem a reward to be the first!</div>);
    };

    if (stopActivity) stopActivity();
    stopActivity = Rewards.watchActivity(() => {
      if (!box || !box.isConnected) { if (stopActivity) { stopActivity(); stopActivity = null; } return; }
      load();
    });
    load();

    return (
      <div>
        <h2 className="section-title" style="margin-top:26px">Recent activity <span className="count-chip">Public</span></h2>
        <p className="games-intro" style="margin:0 0 10px">Everyone can see this: redemptions, deliveries and gifts as they happen.</p>
        <div className="rd-log act-log" ref={(el: HTMLElement) => (box = el)}><div className="empty-state" style="padding:26px 20px">Loading…</div></div>
      </div>
    );
  }

  /** Your own game points (kept on this device): collapsed so the page stays clean. */
  function historySection(st: RewardState): Node {
    if (!st.log.length) return null;
    return (
      <details className="rd-mine">
        <summary>Your points history <small>({st.log.length})</small></summary>
        <div className="rd-log">
          {st.log.map((l) => (
            <div className="rd-row">
              <span>{l.game}</span>
              <span className="rd-when">{when(l.t)}</span>
              <b className={l.pts < 0 ? "neg" : "pos"}>{l.pts > 0 ? "+" : ""}{l.pts.toLocaleString()} pts</b>
            </div>
          ))}
        </div>
      </details>
    );
  }

  function draw(view: HTMLElement): void {
    const st = Rewards.get();
    const lv = Rewards.level();
    const items = Rewards.shop().filter((r) => r.active !== false);
    const costs = items.map((r) => r.cost);
    const range = costs.length ? `Rewards cost between ${Math.min(...costs).toLocaleString()} and ${Math.max(...costs).toLocaleString()} points.` : "No rewards in the shop yet.";

    const reload = () => { if (view.dataset.page === "redeem") draw(view); };

    const redeemItem = async (r: RewardItem, btn: HTMLButtonElement) => {
      if (r.kind === "mlbb") { mlbbModal(r, reload); return; }
      if (!confirm(`Redeem ${r.title} for ${r.cost.toLocaleString()} points?`)) return;
      btn.disabled = true;
      const res = await Rewards.redeem(r.id);
      if (!res.ok) { Utils.toast(res.reason || "Couldn't redeem.", 3600); reload(); return; }
      if (res.code) codeModal(r, res.code);
      reload();
    };

    const card = (r: RewardItem) => {
      const out = r.stock <= 0;
      const afford = st.points >= r.cost;
      const pct = Math.min(100, Math.floor((st.points / r.cost) * 100));
      const label = out ? "Out of stock" : afford ? "Redeem" : `${(r.cost - st.points).toLocaleString()} more pts`;
      return (
        <div className={"rd-card" + (out ? " soldout" : "")}>
          <span className="rd-emoji" aria-hidden="true">{r.emoji}</span>
          <strong>{r.title}</strong>
          <span className="rd-kind">{kindHint(r.kind)}</span>
          <span className="rd-blurb">{r.blurb}</span>
          <span className="rd-cost">{r.cost.toLocaleString()} pts</span>
          <span className={"rd-stock" + (out ? " out" : "")}>{stockText(r)}</span>
          <div className="rd-buy">
            {out ? null : <span className="rw-bar"><i style={{ width: pct + "%" }}></i></span>}
            <button type="button" className={"btn-sm" + (out ? "" : " primary")} disabled={!afford || out} onClick={(e: Event) => redeemItem(r, e.currentTarget as HTMLButtonElement)}>{label}</button>
          </div>
        </div>
      );
    };

    mountInto(view,
      <h1 className="view-title">Redeem</h1>,
      <p className="games-intro">Play games to earn points, then spend them here. CODM rewards give you a code right away. For MLBB you enter your ID, server and IGN and an admin sends it to you. {range}</p>,

      <section className="rd-top">
        <div className="rd-stat big">
          <small>Your points</small>
          <b>{st.points.toLocaleString()}</b>
          <span>{st.earned.toLocaleString()} earned in total · {st.rounds} rounds played</span>
        </div>
        <div className="rd-stat">
          <small>Level</small>
          <b>{lv.level} <em>{lv.title}</em></b>
          <span className="rw-bar"><i style={{ width: lv.pct + "%" }}></i></span>
          {lv.max
            ? <span>🏆 Max level reached ({Rewards.MAX_LEVEL})</span>
            : <span>{lv.into} / {lv.need} XP to level {lv.level + 1} · +{Rewards.levelBonus(lv.level + 1)} bonus points</span>}
        </div>
      </section>,

      Rewards.isStaff() ? adminPanel(view, reload) : null,

      <h2 className="section-title">Rewards</h2>,
      items.length ? <div className="rd-grid">{items.map(card)}</div> : <div className="empty-state" style="padding:30px 20px">No rewards in the shop yet. Check back soon.</div>,

      <p className="games-intro" style="margin:16px 0 0">Want more points? <a href="#games" className="see-all">Play a game →</a></p>,

      myOrdersSection(),

      activitySection(),

      historySection(st)
    );
  }

  /** Route entry: draw right away, then pull the newest items + stock and draw again (only if still on this page). */
  function mount(view: HTMLElement): void {
    draw(view);
    Rewards.loadCatalog().then(() => { if (view.dataset.page === "redeem") draw(view); });
  }

  return { mount, giveBar };
})();
