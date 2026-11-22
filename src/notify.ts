/* ---------- Notifications: role changes, community requests / approvals ---------- */
const Notify = (() => {
  const esc = Utils.escapeHTML;
  const db = () => Auth.client;

  let me = null;
  let items = [];
  const listeners = [];
  let onRole = () => {};
  let channel = null;

  const on = (fn) => listeners.push(fn);
  const emit = () => listeners.forEach((fn) => fn());

  async function load() {
    const { data, error } = await db().from("notifications").select("*").order("created_at", { ascending: false }).limit(40);
    if (error) { console.warn("Notifications unavailable:", error.message); items = []; }
    else items = data;
    emit();
  }

  async function markRead(id) {
    const n = items.find((x) => x.id === id);
    if (!n || n.read) return;
    n.read = true; emit();
    await db().from("notifications").update({ read: true }).eq("id", id);
  }

  async function markAllRead() {
    const ids = items.filter((x) => !x.read).map((x) => x.id);
    if (!ids.length) return;
    items.forEach((x) => { x.read = true; });
    emit();
    await db().from("notifications").update({ read: true }).in("id", ids);
  }

  /* ----- sliding notices -----
     Every new notification slides down from the top like a nav bar (see Utils.notice). Tapping it opens the link and
     marks it read; letting it slide away on its own leaves it unread in the bell. */
  // Things that were waiting while the person was away also slide in (newest 3 only, so a long absence isn't noisy).
  const IMPORTANT = new Set(["role", "community_approved", "post_comment", "comment_reply", "points_gift", "shop_order", "shop_done"]);
  const ICONS = { role: "🛡️", community_request: "📨", community_approved: "✅", community_rejected: "⚠️", community_added: "👥", post_reaction: "👍", post_comment: "💬", comment_reply: "↩️", report: "🚩", staff_login: "🟢", points_gift: "🎁", shop_order: "💎", shop_done: "✅" };
  const LABELS = { role: "Open", community_approved: "View", post_comment: "View post", comment_reply: "View post", points_gift: "Redeem", shop_order: "Orders", shop_done: "Redeem" };
  const shown = new Map();              // notification id -> its slide-in notice (so it can be pulled back)
  const orderListeners = [];
  let ordersChannel = null;

  const onOrder = (fn) => orderListeners.push(fn);

  /** A MLBB order is no longer waiting: the other admins / developer stop seeing its notification. */
  function dropOrder(orderId) {
    const gone = items.filter((n) => n.kind === "shop_order" && n.ref_id === orderId);
    if (gone.length) {
      items = items.filter((n) => !gone.includes(n));
      gone.forEach((n) => { const h = shown.get(n.id); if (h) h.close(); });
      emit();
    }
  }

  /** Staff only: follow MLBB orders live, so a delivered order disappears for everyone else straight away. */
  function watchOrders() {
    if (ordersChannel || !me || !Auth.isStaff(me)) return;
    try {
      ordersChannel = db().channel("shop-orders-watch")
        .on("postgres_changes", { event: "*", schema: "public", table: "shop_orders" }, (payload) => {
          const o = payload.new || {};
          if (o.status === "done") dropOrder(o.id);
          orderListeners.forEach((fn) => fn());
        })
        .subscribe();
    } catch { /* realtime unavailable: the lists refresh on the next visit */ }
  }

  async function stillWaiting(n) {
    if (n.kind !== "shop_order" || !n.ref_id) return true;
    const { data } = await db().from("shop_orders").select("status").eq("id", n.ref_id).maybeSingle();
    return !!data && data.status === "pending";
  }

  function slideIn(n) {
    if (shown.has(n.id)) return;
    const h = Utils.notice({
      icon: ICONS[n.kind] || "🔔", title: n.title, body: n.body, href: n.link || undefined, actionLabel: n.link ? (LABELS[n.kind] || "Open") : undefined,
      ms: 7000, key: "n-" + n.id,
      onClose: (why) => { shown.delete(n.id); if (why === "dismiss" || why === "open") markRead(n.id); }
    });
    shown.set(n.id, h);
  }

  async function init(user, { onRoleChange }: { onRoleChange?: () => void } = {}) {
    me = user;
    onRole = onRoleChange || (() => {});
    await load();
    watchOrders();

    // Anything important that arrived while the person was away. Orders that were already delivered are skipped.
    let oneComment = false;
    const waiting = items.filter((n) => !n.read && IMPORTANT.has(n.kind)).filter((n) => {   // newest first
      if (n.kind !== "post_comment" && n.kind !== "comment_reply") return true;
      if (oneComment) return false;
      return (oneComment = true);
    });
    const checks = await Promise.all(waiting.map((n) => stillWaiting(n).catch(() => true)));
    waiting.filter((_, i) => checks[i]).slice(0, 3).reverse().forEach((n, i) => setTimeout(() => slideIn(n), 500 + i * 700));

    channel = db().channel("my-notifications")
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${me.id}` },
        async (payload) => {
          const n = payload.new;
          if (!n || items.some((x) => x.id === n.id)) return;
          items.unshift(n); emit();
          if (n.kind === "role") { await onRole(); watchOrders(); }      // show / hide the Admin panel right away
          slideIn(n);
        })
      .subscribe();
  }

  return {
    init, on, onOrder, dropOrder, markRead, markAllRead,
    list: () => items,
    get unreadCount() { return items.filter((n) => !n.read).length; }
  };
})();
