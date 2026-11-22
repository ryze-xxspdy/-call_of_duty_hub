/* ---------- Rewards: points, XP / level and the Redeem shop ----------
   Every finished game round awards points (spent in the Redeem shop) and XP (raises your level, never spent).
   Saved per account in this browser's localStorage, like the personal bests in the Games hub.

   The shop sells two kinds of reward:
     • CODM  - the student gets a code straight away (the admin adds the codes; stock = codes left).
     • MLBB  - the student enters their Game ID, Server and IGN; admins / the developer get a notification and deliver it.
   A reward with no stock turns gray and can't be redeemed.

   Admins and the developer are always max level (100). On the Redeem page they can give themselves points,
   GIFT POINTS to anyone (points only, never levels), add rewards, add stock / codes and deliver MLBB orders.
   The shop lives in the database (supabase/schema.sql, section 25) so everyone sees the same stock. */

interface RewardItem {
  id: string;
  cost: number;                 // points
  kind: "codm" | "mlbb";
  emoji: string;
  title: string;
  blurb: string;
  stock: number;                // how many are left; 0 = out of stock (gray)
  active?: boolean;             // false = hidden from students (staff still see it)
}

interface RewardState {
  points: number;               // spendable balance
  earned: number;               // lifetime points earned by playing (never goes down)
  xp: number;                   // lifetime XP (never goes down)
  rounds: number;
  log: { t: number; game: string; pts: number; xp: number }[];
}

interface LevelInfo {
  level: number;
  title: string;
  into: number;                 // XP earned inside this level
  need: number;                 // XP this level takes
  pct: number;                  // 0-100
  max?: boolean;                // true at the top level
}

interface ShopItemInput {
  kind: "codm" | "mlbb";
  emoji: string;
  title: string;
  blurb: string;
  cost: number;
  stock?: number;               // MLBB: how many in stock
  codes?: string;               // CODM: one code per line
}

interface ShopOrder {
  id: string;
  user_id: string | null;
  user_name: string;
  item_id: string | null;
  item_title: string;
  kind: "codm" | "mlbb";
  cost: number;
  code: string | null;
  game_id: string | null;
  server: string | null;
  ign: string | null;
  status: "pending" | "done";
  created_at: string;
}

interface ShopUser { id: string; name: string; email: string; role: string; avatar?: string | null; }

/** One line of the public "Recent activity" feed on the Redeem page (no codes, Game IDs or emails). */
interface ActivityRow {
  id: string;
  kind: "redeem" | "delivered" | "gift";
  actor_id: string | null;
  actor_name: string;
  by_name: string;
  item_emoji: string;
  item_title: string;
  amount: number | null;
  created_at: string;
}

interface RedeemInfo { gameId?: string; server?: string; ign?: string; }

const Rewards = (() => {
  const MAX_LEVEL = 100;
  const MAX_POINTS = 1_000_000_000;

  /** The shop everyone sees. Filled from the database. */
  let catalog: RewardItem[] = [];
  let catalogError = "";
  let catalogFromDb = false;

  const TITLES: [number, string][] = [[1, "Newcomer"], [5, "Learner"], [10, "Scholar"], [20, "Expert"], [30, "Master"], [50, "Legend"], [100, "Max level"]];

  /** XP needed to go from `level` to `level + 1`. */
  const need = (level: number) => 100 + (level - 1) * 50;

  /** Bonus points for reaching a new level. */
  const levelBonus = (level: number) => level * 50;

  /* ----- who is using it ----- */
  let uid = "";
  let staff = false;                     // admins and the developer
  const isStaffRole = (role: string | undefined) => role === "admin" || role === "developer";

  function levelOf(xp: number): LevelInfo {
    const titleFor = (lv: number) => [...TITLES].reverse().find(([l]) => lv >= l)![1];
    // Admins and the developer always sit at the top level.
    if (staff) return { level: MAX_LEVEL, title: titleFor(MAX_LEVEL), into: 1, need: 1, pct: 100, max: true };
    let level = 1, left = xp;
    while (level < MAX_LEVEL && left >= need(level)) { left -= need(level); level++; }
    if (level >= MAX_LEVEL) return { level: MAX_LEVEL, title: titleFor(MAX_LEVEL), into: 1, need: 1, pct: 100, max: true };
    return { level, title: titleFor(level), into: left, need: need(level), pct: Math.round((left / need(level)) * 100) };
  }

  /* ----- storage ----- */
  let state: RewardState = blank();
  const listeners: (() => void)[] = [];

  function blank(): RewardState {
    return { points: 0, earned: 0, xp: 0, rounds: 0, log: [] };
  }
  const key = () => `confesshub.rewards.${uid}`;

  function load(): RewardState {
    try {
      const raw = localStorage.getItem(key());
      if (!raw) return blank();
      const p = JSON.parse(raw);
      const s = blank();
      const num = (v: any) => (Number.isFinite(v) && v > 0 ? Math.min(MAX_POINTS, Math.floor(v)) : 0);
      s.points = num(p.points); s.earned = num(p.earned); s.xp = num(p.xp); s.rounds = num(p.rounds);
      s.log = Array.isArray(p.log) ? p.log.slice(0, 15) : [];
      return s;
    } catch { return blank(); }
  }

  function save() {
    try { localStorage.setItem(key(), JSON.stringify(state)); } catch { /* storage blocked: progress just isn't kept */ }
  }

  function emit() { listeners.forEach((fn) => fn()); }

  function pushLog(game: string, pts: number, xp: number) {
    state.log.unshift({ t: Date.now(), game, pts, xp });
    state.log.length = Math.min(state.log.length, 15);
  }

  /* ----- the shop (database) ----- */
  const db = () => Auth.client;

  function toItem(r: any): RewardItem {
    return {
      id: r.id, kind: r.kind, emoji: r.emoji, title: r.title, blurb: r.blurb || "", cost: Number(r.cost),
      stock: Math.max(0, Number(r.stock) || 0), active: r.active !== false
    };
  }

  /** Fetch the shop (items + stock). Safe to call any time. */
  async function loadCatalog(): Promise<void> {
    try {
      const { data, error } = await db().from("shop_items").select("*").order("cost", { ascending: true });
      if (error) throw error;
      catalog = (data || []).map(toItem);
      catalogFromDb = true;
      catalogError = "";
    } catch (e: any) {
      catalog = [];
      catalogFromDb = false;
      catalogError = (e && e.message) || "The shop table isn't set up yet.";
    }
    emit();
  }

  /* ----- public API ----- */
  function init(user: { id: string; role?: string }) {
    uid = user.id;
    staff = isStaffRole(user.role);
    state = load();
    emit();
    loadCatalog();
    claimGifts();
    watchGifts();
  }

  /** The account's role changed (admin made / removed): update the level and the admin tools. */
  function setRole(role: string | undefined) {
    staff = isStaffRole(role);
    emit();
  }

  /** Give points for a finished round. XP is a fraction of the points. Returns what was earned. */
  function award(gameId: string, gameTitle: string, rawPoints: number): { pts: number; xp: number; levelUp: number; bonus: number } {
    const pts = Math.max(0, Math.min(5000, Math.round(rawPoints)));
    if (!uid || pts <= 0) return { pts: 0, xp: 0, levelUp: 0, bonus: 0 };
    const xp = Math.max(5, Math.ceil(pts / 4));
    const before = levelOf(state.xp).level;
    state.xp += xp;
    const after = levelOf(state.xp).level;
    let bonus = 0;
    for (let l = before + 1; l <= after; l++) bonus += levelBonus(l);
    state.points = Math.min(MAX_POINTS, state.points + pts + bonus);
    state.earned = Math.min(MAX_POINTS, state.earned + pts + bonus);
    state.rounds++;
    pushLog(gameTitle, pts + bonus, xp);
    save();
    emit();
    return { pts, xp, levelUp: after > before ? after : 0, bonus };
  }

  /** Spend points on a shop item. The database checks the stock (so two people can't take the last one) and
   *  hands back the CODM code, or sends the MLBB order to the admins. */
  async function redeem(id: string, info: RedeemInfo = {}): Promise<{ ok: boolean; reason?: string; code?: string; pending?: boolean }> {
    const item = catalog.find((r) => r.id === id);
    if (!item || item.active === false) return { ok: false, reason: "That reward doesn't exist." };
    if (item.stock <= 0) return { ok: false, reason: "Sorry, this reward is out of stock." };
    if (state.points < item.cost) return { ok: false, reason: `You need ${(item.cost - state.points).toLocaleString()} more points.` };
    if (!catalogFromDb) return { ok: false, reason: "The shop isn't set up yet." };

    const { data, error } = await db().rpc("shop_buy", {
      p_item: id, p_game_id: info.gameId || null, p_server: info.server || null, p_ign: info.ign || null
    });
    if (error) { await loadCatalog(); return { ok: false, reason: error.message }; }
    item.stock = data && typeof data.stock === "number" ? Math.max(0, data.stock) : Math.max(0, item.stock - 1);

    state.points -= item.cost;
    pushLog("Redeemed " + item.title, -item.cost, 0);
    save();
    emit();
    return { ok: true, code: (data && data.code) || undefined, pending: item.kind === "mlbb" };
  }

  /** The signed-in person's own redemptions (CODM codes stay here so they can be found again). */
  async function myOrders(): Promise<ShopOrder[]> {
    if (!uid) return [];
    const { data, error } = await db().from("shop_orders").select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(30);
    return error ? [] : (data || []);
  }

  /* ----- point gifts (admin -> anyone). Points only: level / XP never change. ----- */
  let giftChannel: any = null;

  /** Add every gift sent to this account to the balance. Each gift is handed out once by the database. */
  async function claimGifts(): Promise<number> {
    if (!uid) return 0;
    try {
      const { data, error } = await db().rpc("claim_gifts");
      if (error || !Array.isArray(data) || !data.length) return 0;
      let total = 0;
      data.forEach((g: any) => {
        const n = Math.max(0, Math.floor(Number(g.gift_amount) || 0));
        total += n;
        pushLog("🎁 Gift from " + (g.gift_from || "an admin"), n, 0);
      });
      state.points = Math.min(MAX_POINTS, state.points + total);
      save();
      emit();
      return total;
    } catch { return 0; }
  }

  /** A gift that arrives while the app is open lands in the balance right away. */
  function watchGifts() {
    try {
      if (giftChannel) db().removeChannel(giftChannel);
      giftChannel = db().channel("my-point-gifts")
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "point_gifts", filter: `to_user=eq.${uid}` }, () => { claimGifts(); })
        .subscribe();
    } catch { /* realtime unavailable: gifts are collected the next time the app opens */ }
  }

  /* ----- admin / developer tools ----- */
  const denied = { ok: false, reason: "Only admins and the developer can do this." };
  const clampPoints = (n: number) => Math.max(0, Math.min(MAX_POINTS, Math.floor(n)));

  /** Add points to your own balance. */
  function adminGive(amount: number): { ok: boolean; reason?: string } {
    if (!staff) return denied;
    if (!Number.isFinite(amount) || amount === 0) return { ok: false, reason: "Enter how many points to give." };
    const before = state.points;
    state.points = clampPoints(state.points + amount);
    pushLog("Admin grant", state.points - before, 0);
    save(); emit();
    return { ok: true };
  }

  /** Set your own balance to an exact number. */
  function adminSet(amount: number): { ok: boolean; reason?: string } {
    if (!staff) return denied;
    if (!Number.isFinite(amount) || amount < 0) return { ok: false, reason: "Enter a number of 0 or more." };
    const before = state.points;
    state.points = clampPoints(amount);
    pushLog("Admin set balance", state.points - before, 0);
    save(); emit();
    return { ok: true };
  }

  async function adminCall(fn: string, args: Record<string, any>): Promise<{ ok: boolean; reason?: string; data?: any }> {
    if (!staff) return denied;
    if (!catalogFromDb) return { ok: false, reason: "Shop editing isn't set up yet. Re-run supabase/schema.sql (section 25) in Supabase." };
    const { data, error } = await db().rpc(fn, args);
    if (error) return { ok: false, reason: error.message };
    await loadCatalog();
    return { ok: true, data };
  }

  /** Add a new reward. CODM: `codes` (one per line) becomes the stock. MLBB: `stock` is a number. */
  const adminSaveItem = (it: ShopItemInput) => adminCall("shop_add_item", {
    p_kind: it.kind, p_emoji: it.emoji, p_title: it.title, p_blurb: it.blurb, p_cost: Math.floor(it.cost),
    p_stock: it.kind === "mlbb" ? Math.floor(it.stock || 0) : 0, p_codes: it.kind === "codm" ? it.codes || "" : null
  });
  /** MLBB: set the exact stock. */
  const adminSetStock = (id: string, stock: number) => adminCall("shop_set_stock", { p_id: id, p_stock: Math.floor(stock) });
  /** MLBB: put more in stock. */
  const adminAddStock = (id: string, amount: number) => adminCall("shop_add_stock", { p_id: id, p_amount: Math.floor(amount) });
  /** CODM: add more codes (one per line). */
  const adminAddCodes = (id: string, codes: string) => adminCall("shop_add_codes", { p_id: id, p_codes: codes });
  const adminSetActive = (id: string, active: boolean) => adminCall("shop_set_active", { p_id: id, p_active: active });
  const adminDelete = (id: string) => adminCall("shop_delete_item", { p_id: id });

  /** Every redemption (newest first). Used for the MLBB orders list. */
  async function adminOrders(): Promise<ShopOrder[]> {
    if (!staff) return [];
    const { data, error } = await db().from("shop_orders").select("*").order("created_at", { ascending: false }).limit(60);
    return error ? [] : (data || []);
  }

  /** The MLBB top-up was sent: tells the student. */
  async function adminMarkDone(orderId: string): Promise<{ ok: boolean; reason?: string }> {
    if (!staff) return denied;
    const { error } = await db().rpc("shop_order_done", { p_id: orderId });
    return error ? { ok: false, reason: error.message } : { ok: true };
  }

  /** Look people up by name or email, to gift them points. */
  async function findUsers(q: string): Promise<ShopUser[]> {
    if (!staff) return [];
    const term = q.replace(/[%,()*\\]/g, " ").trim();
    if (term.length < 2) return [];
    const { data, error } = await db().from("profiles").select("id,name,email,role,avatar")
      .or(`name.ilike.%${term}%,email.ilike.%${term}%`).order("name").limit(8);
    return error ? [] : (data || []);
  }

  /** Gift points to someone else's balance. Points only: their level and XP stay as they are. */
  async function adminGift(userId: string, amount: number): Promise<{ ok: boolean; reason?: string }> {
    if (!staff) return denied;
    if (!Number.isFinite(amount) || amount < 1) return { ok: false, reason: "Enter how many points to gift." };
    const { error } = await db().rpc("gift_points", { p_user: userId, p_amount: Math.floor(amount) });
    return error ? { ok: false, reason: error.message } : { ok: true };
  }


  /* ----- public recent activity (everyone can see it) ----- */
  async function activity(limit = 25): Promise<ActivityRow[]> {
    const { data, error } = await db().from("shop_activity").select("*").order("created_at", { ascending: false }).limit(limit);
    return error ? [] : (data || []);
  }

  /** Calls `fn` whenever someone redeems, gets a delivery or a gift. Returns a function that stops listening. */
  function watchActivity(fn: () => void): () => void {
    let ch: any = null;
    try {
      ch = db().channel("shop-activity-" + Math.random().toString(36).slice(2, 8))
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "shop_activity" }, fn)
        .subscribe();
    } catch { /* realtime unavailable: the feed refreshes when the page is opened */ }
    return () => { try { if (ch) db().removeChannel(ch); } catch { /* ignore */ } };
  }

  return {
    MAX_LEVEL, activity, watchActivity, init, setRole, award, redeem, myOrders, claimGifts, levelOf, levelBonus, loadCatalog,
    adminGive, adminSet, adminSaveItem, adminSetStock, adminAddStock, adminAddCodes, adminSetActive, adminDelete,
    adminOrders, adminMarkDone, findUsers, adminGift,
    shop: () => catalog.filter((r) => r.active !== false || staff),
    shopError: () => catalogError,
    shopEditable: () => catalogFromDb,
    isStaff: () => staff,
    get: () => state,
    level: () => levelOf(state.xp),
    on: (fn: () => void) => { listeners.push(fn); }
  };
})();
