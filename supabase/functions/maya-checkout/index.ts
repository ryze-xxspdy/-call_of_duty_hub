// Edge Function: maya-checkout
//   { action: "ping" }                            -> wakes the function up (no login needed), so the real call is fast
//   { action: "create", package_id, return_url }  -> makes a pending order + a Maya checkout, returns { redirectUrl, order_id }
//                                                    (needs a fresh Gmail code: the browser signs in with the emailed code first)
//   { action: "verify", order_id }                -> asks Maya if it was paid and credits the points (once)
//   { action: "cancel", order_id }                -> marks an unpaid order as cancelled
// Deploy:  supabase functions deploy maya-checkout
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { adminClient, basic, corsHeaders, json, mayaBase, settleOrder } from "../_shared/maya.ts";

/** Did this signed-in session come from an emailed one-time code in the last `maxAgeSec` seconds?
 *  (The token was already checked by auth.getUser(); here we only read its "amr" = how the person signed in.) */
function emailCodeIsFresh(authHeader: string, maxAgeSec = 600): boolean {
  if ((Deno.env.get("PAYMENT_EMAIL_CODE") || "on").toLowerCase() === "off") return true;
  try {
    const part = authHeader.replace(/^Bearer\s+/i, "").split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const claims = JSON.parse(atob(part));
    const now = Date.now() / 1000;
    return (claims.amr || []).some((a: any) => ["otp", "magiclink"].includes(String(a.method)) && now - Number(a.timestamp) <= maxAgeSec);
  } catch { return false; }
}

const banMessage = (p: { ban_reason?: string | null; ban_until?: string | null }) =>
  "This account is banned." + (p.ban_reason ? ` Reason: ${p.ban_reason}.` : " No reason was given.") +
  (p.ban_until ? ` You can pay again after ${new Date(p.ban_until).toUTCString()}.` : "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");
    if (action === "ping") return json({ ok: true });          // warm-up: answers before any database work

    // Who is asking? (the browser sends the signed-in user's token)
    const auth = req.headers.get("Authorization") || "";
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } }, auth: { persistSession: false },
    });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return json({ error: "Please log in again." }, 401);
    const uid = u.user.id;

    const admin = adminClient();

    if (action === "create") {
      const publicKey = Deno.env.get("MAYA_PUBLIC_KEY");
      if (!publicKey) return json({ error: "Maya isn't set up yet: the MAYA_PUBLIC_KEY secret is missing." }, 500);

      // Cheap checks first, before any database work.
      let ret: URL;
      try { ret = new URL(String(body.return_url || "")); if (!/^https?:$/.test(ret.protocol)) throw 0; }
      catch { return json({ error: "Missing return address." }, 400); }
      ret.search = "";
      if (!emailCodeIsFresh(auth)) return json({ error: "Please confirm the code we sent to your Gmail first.", code: "code_required" }, 403);

      // The three lookups are independent, so run them together.
      const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const [profRes, pkgRes, pendRes] = await Promise.all([
        admin.from("profiles").select("name,email,banned_at,ban_reason,ban_until").eq("id", uid).maybeSingle(),
        admin.from("point_packages").select("*").eq("id", String(body.package_id || "")).eq("active", true).maybeSingle(),
        admin.from("point_purchases").select("id", { count: "exact", head: true }).eq("user_id", uid).eq("status", "pending").gte("created_at", since),
      ]);
      const prof = profRes.data, pkg = pkgRes.data;
      if (!prof) return json({ error: "Profile not found." }, 400);
      if (prof.banned_at && (!prof.ban_until || new Date(prof.ban_until) > new Date())) return json({ error: banMessage(prof), banned: true, reason: prof.ban_reason || "" }, 403);
      if (!pkg) return json({ error: "That package isn't available." }, 400);
      if ((pendRes.count || 0) >= 5) return json({ error: "Too many unpaid checkouts. Please wait a few minutes." }, 429);

      const price = Number(pkg.price_php);
      const total = pkg.points + pkg.bonus;
      const orderId = crypto.randomUUID();                       // we pick the id ourselves so Maya can be called at the same time as the insert
      const to = (kind: string) => `${ret.origin}${ret.pathname}#store-${kind}-${orderId}`;
      const [first, ...rest] = String(prof.name || "Student").trim().split(/\s+/);

      const [ins, res] = await Promise.all([
        admin.from("point_purchases").insert({ id: orderId, user_id: uid, package_id: pkg.id, package_title: pkg.title, points: total, amount_php: price }),
        fetch(`${mayaBase()}/checkout/v1/checkouts`, {
          method: "POST",
          headers: { Authorization: basic(publicKey), "Content-Type": "application/json" },
          body: JSON.stringify({
            totalAmount: { value: price, currency: "PHP" },
            buyer: { firstName: first || "Student", lastName: rest.join(" ") || "-", contact: { email: prof.email || u.user.email } },
            items: [{
              name: `${total.toLocaleString("en-US")} points (${pkg.title})`, quantity: 1,
              amount: { value: price }, totalAmount: { value: price },
            }],
            redirectUrl: { success: to("success"), failure: to("failed"), cancel: to("cancel") },
            requestReferenceNumber: orderId,
            metadata: { user_id: uid, package: pkg.id },
          }),
        }),
      ]);
      if (ins.error) return json({ error: ins.error.message }, 500);   // nothing was charged: the Maya checkout is never opened
      const co = await res.json().catch(() => ({}));
      if (!res.ok || !co.redirectUrl) {
        await admin.rpc("close_purchase", { p_order: orderId, p_status: "failed" });
        return json({ error: co.message || "Maya could not start the checkout. Please try again." }, 502);
      }
      await admin.from("point_purchases").update({ maya_checkout_id: co.checkoutId }).eq("id", orderId);
      return json({ redirectUrl: co.redirectUrl, order_id: orderId });
    }

    // verify / cancel only work on the caller's own orders
    const { data: own } = await admin.from("point_purchases").select("id,status,points").eq("id", String(body.order_id || "")).eq("user_id", uid).maybeSingle();
    if (!own) return json({ error: "Order not found." }, 404);

    if (action === "verify") return json(await settleOrder(admin, own.id));
    if (action === "cancel") {
      await admin.rpc("close_purchase", { p_order: own.id, p_status: "cancelled" });
      return json({ status: "cancelled" });
    }
    return json({ error: "Unknown action." }, 400);
  } catch (e) {
    return json({ error: (e as Error).message || "Something went wrong." }, 500);
  }
});
