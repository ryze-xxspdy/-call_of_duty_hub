// Shared helpers for the Maya (PayMaya) Checkout Edge Functions.
// Secrets (set with `supabase secrets set`): MAYA_PUBLIC_KEY, MAYA_SECRET_KEY, MAYA_ENV ("sandbox" | "production").
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

export const mayaBase = () =>
  (Deno.env.get("MAYA_ENV") || "sandbox").toLowerCase() === "production"
    ? "https://pg.maya.ph"
    : "https://pg-sandbox.paymaya.com";

/** Maya uses HTTP Basic auth with the key as the username and an empty password. */
export const basic = (key: string) => "Basic " + btoa(key + ":");

export const adminClient = () =>
  createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

/**
 * Ask Maya (with the SECRET key, never trusting what the browser or a webhook says) what happened to an order's checkout,
 * then credit / close the order. Safe to call many times: credit_purchase() only pays out once.
 * Returns the order's status afterwards.
 */
export async function settleOrder(admin: ReturnType<typeof adminClient>, orderId: string): Promise<{ status: string; points?: number }> {
  const { data: order } = await admin.from("point_purchases").select("*").eq("id", orderId).maybeSingle();
  if (!order) return { status: "missing" };
  if (order.status !== "pending") return { status: order.status, points: order.points };
  if (!order.maya_checkout_id) return { status: "pending" };

  const secret = Deno.env.get("MAYA_SECRET_KEY");
  if (!secret) throw new Error("MAYA_SECRET_KEY is not set.");
  const res = await fetch(`${mayaBase()}/checkout/v1/checkouts/${order.maya_checkout_id}`, {
    headers: { Authorization: basic(secret), Accept: "application/json" },
  });
  if (!res.ok) return { status: "pending" };            // Maya unreachable: try again later
  const co = await res.json();

  const ref = String(co.requestReferenceNumber || "");
  const paidAmount = Number(co.totalAmount?.value);
  const sameOrder = ref === order.id;
  const sameAmount = !Number.isFinite(paidAmount) || Math.abs(paidAmount - Number(order.amount_php)) < 0.01;

  if (co.paymentStatus === "PAYMENT_SUCCESS" && sameOrder && sameAmount) {
    const { error } = await admin.rpc("credit_purchase", { p_order: order.id });
    if (error) throw new Error(error.message);
    return { status: "paid", points: order.points };
  }
  if (["PAYMENT_FAILED", "PAYMENT_EXPIRED", "AUTH_FAILED"].includes(co.paymentStatus)) {
    await admin.rpc("close_purchase", { p_order: order.id, p_status: "failed" });
    return { status: "failed" };
  }
  return { status: "pending" };
}
