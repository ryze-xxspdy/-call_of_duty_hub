/* ---------- Redeem page: spend game points on CODM codes and MLBB top-ups ----------
   CODM  -> the student gets a code straight away.
   MLBB  -> the student enters Game ID, Server and IGN; admins / the developer get a notification and deliver it.
   A reward with no stock turns gray.
   Admins and the developer also get an admin panel here: give themselves points, GIFT POINTS to anyone (points only, never levels),
   add rewards, add stock / codes and deliver MLBB orders. */
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
        <strong>🛡️ Admin: give yourself points</strong>
        <div className="adm-row">
          <input type="number" min="0" step="1" placeholder="Amount" ref={(el: HTMLInputElement) => (input = el)} />
          <button type="button" className="btn-sm primary" onClick={() => done(Rewards.adminGive(amount()), `+${amount().toLocaleString()} points added.`)}>Add</button>
          <button type="button" className="btn-sm" onClick={() => done(Rewards.adminSet(amount()), `Balance set to ${amount().toLocaleString()} points.`)}>Set balance</button>
          {chip(1000)}{chip(10000)}{chip(100000)}
        </div>
        <small>Only you can see this. Admins and the developer are always Level {Rewards.MAX_LEVEL}.</small>
      </div>
    );
  }

  /** Gift points to another person. Points only: their level and XP stay exactly as they are. */
  function giftCard(): Node {
    let search: HTMLInputElement, amount: HTMLInputElement, results: HTMLElement, picked: HTMLElement, sendBtn: HTMLButtonElement;
    let target: ShopUser | null = null;

    const paintPicked = () => {
      picked.textContent = target ? `Gifting to: ${target.name || target.email} (${target.email})` : "Search for someone, then tap their name.";
      sendBtn.disabled = !target;
    };

    const doSearch = async () => {
      const q = search.value.trim();
      if (q.length < 2) return Utils.toast("Type at least 2 letters of a name or email.", 2600);
      results.textContent = "Searching…";
      const users = await Rewards.findUsers(q);
      mountInto(results, users.length ? users.map((u) => (
        <button type="button" className={"gift-user" + (target && target.id === u.id ? " on" : "")} onClick={(e: Event) => {
          target = u;
          results.querySelectorAll(".gift-user").forEach((b) => b.classList.remove("on"));
          (e.currentTarget as HTMLElement).classList.add("on");
          paintPicked();
        }}>
          <b>{u.name || "(no name)"}</b><small>{u.email}{u.role !== "student" ? " · " + u.role : ""}</small>
        </button>
      )) : <small>No one found.</small>);
    };

    const send = async () => {
      if (!target) return;
      const n = Number(String(amount.value).replace(/,/g, ""));
      if (!Number.isFinite(n) || n < 1) return Utils.toast("Enter how many points to gift.", 2600);
      sendBtn.disabled = true;
      const who = target.name || target.email;
      const res = await Rewards.adminGift(target.id, Math.floor(n));
      sendBtn.disabled = !target;
      if (!res.ok) return Utils.toast(res.reason || "Couldn't send the gift.", 4200);
      Utils.toast(`🎁 Gifted ${Math.floor(n).toLocaleString()} points to ${who}.`, 3200);
      amount.value = "";
    };

    const chip = (n: number) => <button type="button" className="btn-sm" onClick={() => { amount.value = String(n); }}>{n.toLocaleString()}</button>;

    const card = (
      <div className="adm-card">
        <h3>🎁 Gift points</h3>
        <p className="adm-hint">Send points to anyone. They go straight into their balance and they get a notification. Only points are gifted. Their level and XP don't change.</p>
        <div className="adm-row">
          <input type="text" placeholder="Name or email" style="width:220px" ref={(el: HTMLInputElement) => { search = el; el.addEventListener("keydown", (e) => { if ((e as KeyboardEvent).key === "Enter") doSearch(); }); }} />
          <button type="button" className="btn-sm" onClick={doSearch}>Search</button>
        </div>
        <div className="gift-results" ref={(el: HTMLElement) => (results = el)}></div>
        <div className="gift-picked" ref={(el: HTMLElement) => (picked = el)}></div>
        <div className="adm-row">
          <input type="number" min="1" step="1" placeholder="Points to gift" ref={(el: HTMLInputElement) => (amount = el)} />
          {chip(1000)}{chip(5000)}{chip(10000)}
          <button type="button" className="btn-sm primary" ref={(el: HTMLButtonElement) => (sendBtn = el)} onClick={send}>Send gift</button>
        </div>
      </div>
    );
    paintPicked();
    return card;
  }

  /** MLBB orders waiting for the admin, plus the last delivered ones. */
  function ordersCard(): Node {
    let box: HTMLElement;
    const load = async () => {
      const all = (await Rewards.adminOrders()).filter((o) => o.kind === "mlbb");
      const pending = all.filter((o) => o.status === "pending").reverse();   // oldest first
      const done = all.filter((o) => o.status === "done").slice(0, 8);
      const row = (o: ShopOrder) => (
        <div className={"adm-order" + (o.status === "done" ? " done" : "")}>
          <div className="adm-order-main">
            <b>{o.item_title}</b> <small>· {o.user_name || "Student"} · {when(o.created_at)}</small>
            <div className="adm-order-info">ID <code>{o.game_id}</code> · Server <code>{o.server}</code> · IGN <code>{o.ign}</code></div>
          </div>
          {o.status === "pending" ? (
            <span className="adm-order-btns">
              <button type="button" className="btn-sm" onClick={() => copyText(`${o.game_id} (${o.server}) ${o.ign}`)}>Copy details</button>
              <button type="button" className="btn-sm primary" onClick={async (e: Event) => {
                (e.currentTarget as HTMLButtonElement).disabled = true;
                const res = await Rewards.adminMarkDone(o.id);
                Utils.toast(res.ok ? "Marked as delivered. The student was told." : res.reason || "Couldn't update.", 3200);
                load();
              }}>Mark delivered</button>
            </span>
          ) : <span className="adm-stock">Delivered ✓</span>}
        </div>
      );
      mountInto(box,
        pending.length ? pending.map(row) : <small>No MLBB orders waiting. 🎉</small>,
        done.length ? <h4 className="adm-sub">Recently delivered</h4> : null,
        done.map(row)
      );
    };
    const card = (
      <div className="adm-card">
        <h3>💎 MLBB orders</h3>
        <p className="adm-hint">You get a notification for every new order. Send the diamonds / item in the game, then tap <b>Mark delivered</b> so the student knows.</p>
        <div ref={(el: HTMLElement) => (box = el)}><small>Loading…</small></div>
        <button type="button" className="btn-sm ghost" style="margin-top:8px" onClick={load}>Refresh orders</button>
      </div>
    );
    load();
    return card;
  }

  /** The "add a reward" form, the stock list, gifts and orders. */
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
        <h3>Add a reward</h3>
        <p className="adm-hint">New rewards show up in the shop for everyone straight away. <b>CODM</b>: paste the codes, one per line (the number of codes is the stock). <b>MLBB</b>: set how many you can deliver.</p>
        <div className="adm-form">
          <select ref={(el: HTMLSelectElement) => { fKind = el; el.addEventListener("change", syncKind); }}>
            <option value="codm">CODM: student gets a code</option>
            <option value="mlbb">MLBB: student enters ID, server, IGN</option>
          </select>
          <input type="text" maxLength="8" placeholder="Emoji 🎁" ref={(el: HTMLInputElement) => (fEmoji = el)} />
          <input type="text" maxLength="40" placeholder="Name (e.g. 80 CP)" ref={(el: HTMLInputElement) => (fTitle = el)} />
          <input type="text" maxLength="120" placeholder="Short description" className="wide" ref={(el: HTMLInputElement) => (fBlurb = el)} />
          <input type="number" min="1" step="1" placeholder="Cost (points)" ref={(el: HTMLInputElement) => (fCost = el)} />
          <span ref={(el: HTMLElement) => (stockWrap = el)} className="hidden"><input type="number" min="0" step="1" placeholder="Stock (how many)" ref={(el: HTMLInputElement) => (fStock = el)} /></span>
          <span ref={(el: HTMLElement) => (codesWrap = el)} className="wide"><textarea rows="4" placeholder={"Paste CODM codes here, one per line"} ref={(el: HTMLTextAreaElement) => (fCodes = el)}></textarea></span>
          <button type="button" className="btn primary" disabled={!editable} onClick={async (e: Event) => {
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
          <span className="adm-name">{r.emoji} <b>{r.title}</b> <small>{r.cost.toLocaleString()} pts · {kindName(r.kind)}{r.active === false ? " · hidden" : ""}</small></span>
          <span className={"adm-stock" + (r.stock <= 0 ? " out" : "")}>{isCodm ? (r.stock <= 0 ? "No codes left" : `${r.stock.toLocaleString()} ${r.stock === 1 ? "code" : "codes"} left`) : stockText(r)}</span>
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
          <button type="button" className="btn-sm ghost" disabled={!editable} onClick={() => run(Rewards.adminSetActive(r.id, r.active === false), r.active === false ? `${r.title} is visible again.` : `${r.title} is hidden from students.`)}>{r.active === false ? "Show" : "Hide"}</button>
          <button type="button" className="btn-sm ghost danger" disabled={!editable} onClick={() => {
            if (!confirm(`Delete ${r.title} from the shop? ${isCodm ? "Its unused codes are deleted too. " : ""}Past orders stay in the list.`)) return;
            run(Rewards.adminDelete(r.id), `${r.title} was deleted.`);
          }}>Delete</button>
        </div>
      );
    };

    const err = Rewards.shopError();
    return (
      <section className="adm-panel">
        <h2 className="section-title">🛡️ Admin panel</h2>
        {giveBar(reload)}
        {!editable ? (
          <div className="adm-warn">
            The shop needs its tables in the database. Open Supabase → SQL Editor and run <code>supabase/schema.sql</code> again (section 25), then refresh.
            {err ? <small>{err}</small> : null}
          </div>
        ) : null}
        {giftCard()}
        {ordersCard()}
        {addForm}
        <div className="adm-card">
          <h3>Stock</h3>
          <p className="adm-hint">A reward with no stock turns <b>gray</b> for students. <b>CODM</b>: paste more codes and tap <b>+ Add codes</b>. <b>MLBB</b>: type a number, then <b>+ Add stock</b> (add on top) or <b>Set</b> (exact amount). Hidden items are only visible to admins.</p>
          <div className="adm-list">{items.length ? items.map(row) : <small>No rewards yet. Add one above.</small>}</div>
          <button type="button" className="btn-sm ghost" onClick={refresh}>Refresh stock</button>
        </div>
      </section>
    );
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

      <h2 className="section-title" style="margin-top:26px">Recent activity</h2>,
      st.log.length ? (
        <div className="rd-log">
          {st.log.map((l) => (
            <div className="rd-row">
              <span>{l.game}</span>
              <span className="rd-when">{when(l.t)}</span>
              <b className={l.pts < 0 ? "neg" : "pos"}>{l.pts > 0 ? "+" : ""}{l.pts.toLocaleString()} pts</b>
            </div>
          ))}
        </div>
      ) : <div className="empty-state" style="padding:30px 20px">Nothing yet. Finish a game round to earn your first points.</div>
    );
  }

  /** Route entry: draw right away, then pull the newest items + stock and draw again (only if still on this page). */
  function mount(view: HTMLElement): void {
    draw(view);
    Rewards.loadCatalog().then(() => { if (view.dataset.page === "redeem") draw(view); });
  }

  return { mount, giveBar };
})();
