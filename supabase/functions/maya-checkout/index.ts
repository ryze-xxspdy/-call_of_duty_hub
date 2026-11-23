// Edge Function: maya-checkout
//   { action: "create", package_id, return_url }  -> makes a pending order + a Maya checkout, returns { redirectUrl, order_id }
//   { action: "verify", order_id }                -> asks Maya if it was paid and credits the points (once)
//   { action: "cancel", order_id }                -> marks an unpaid order as cancelled
// Deploy:  supabase functions deploy maya-checkout
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { adminClient, basic, corsHeaders, json, mayaBase, settleOrder } from "../_shared/maya.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    // Who is asking? (the browser sends the signed-in user's token)
    const auth = req.headers.get("Authorization") || "";
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: auth } }, auth: { persistSession: false },
    });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return json({ error: "Please log in again." }, 401);
    const uid = u.user.id;

    const admin = adminClient();
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");

    if (action === "create") {
      const publicKey = Deno.env.get("MAYA_PUBLIC_KEY");
      if (!publicKey) return json({ error: "Maya isn't set up yet: the MAYA_PUBLIC_KEY secret is missing." }, 500);

      const { data: prof } = await admin.from("profiles").select("name,email,banned_at").eq("id", uid).maybeSingle();
      if (!prof) return json({ error: "Profile not found." }, 400);
      if (prof.banned_at) return json({ error: "This account is banned." }, 403);

      const { data: pkg } = await admin.from("point_packages").select("*").eq("id", String(body.package_id || "")).eq("active", true).maybeSingle();
      if (!pkg) return json({ error: "That package isn't available." }, 400);

      // A little protection against spamming checkouts.
      const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { count } = await admin.from("point_purchases").select("id", { count: "exact", head: true })
        .eq("user_id", uid).eq("status", "pending").gte("created_at", since);
      if ((count || 0) >= 5) return json({ error: "Too many unpaid checkouts. Please wait a few minutes." }, 429);

      const price = Number(pkg.price_php);
      const total = pkg.points + pkg.bonus;
      const { data: order, error: oe } = await admin.from("point_purchases").insert({
        user_id: uid, package_id: pkg.id, package_title: pkg.title, points: total, amount_php: price,
      }).select("*").single();
      if (oe) return json({ error: oe.message }, 500);

      let ret: URL;
      try { ret = new URL(String(body.return_url || "")); if (!/^https?:$/.test(ret.protocol)) throw 0; }
      catch { return json({ error: "Missing return address." }, 400); }
      ret.search = "";
      const to = (kind: string) => `${ret.origin}${ret.pathname}#store-${kind}-${order.id}`;

      const [first, ...rest] = String(prof.name || "Student").trim().split(/\s+/);
      const res = await fetch(`${mayaBase()}/checkout/v1/checkouts`, {
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
          requestReferenceNumber: order.id,
          metadata: { user_id: uid, package: pkg.id },
        }),
      });
      const co = await res.json().catch(() => ({}));
      if (!res.ok || !co.redirectUrl) {
        await admin.rpc("close_purchase", { p_order: order.id, p_status: "failed" });
        return json({ error: co.message || "Maya could not start the checkout. Please try again." }, 502);
      }
      await admin.from("point_purchases").update({ maya_checkout_id: co.checkoutId }).eq("id", order.id);
      return json({ redirectUrl: co.redirectUrl, order_id: order.id });
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
