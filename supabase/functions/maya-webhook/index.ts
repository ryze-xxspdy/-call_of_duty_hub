// Edge Function: maya-webhook
// Maya calls this when a checkout is paid / fails. The payload is NOT trusted: we only read the order id from it,
// then ask Maya directly (with the secret key) what really happened.
// Deploy WITHOUT jwt checking (Maya isn't a signed-in user):
//   supabase functions deploy maya-webhook --no-verify-jwt
// Then register  https://<project-ref>.supabase.co/functions/v1/maya-webhook  in the Maya Manager (Webhooks):
//   CHECKOUT_SUCCESS, CHECKOUT_FAILURE, CHECKOUT_DROPOUT
import { adminClient, json, settleOrder } from "../_shared/maya.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: true });
  try {
    const body = await req.json().catch(() => ({}));
    const ref = String(body.requestReferenceNumber || "");
    if (!UUID.test(ref)) return json({ ok: true });
    const result = await settleOrder(adminClient(), ref);
    return json({ ok: true, status: result.status });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);   // Maya retries on non-2xx
  }
});
