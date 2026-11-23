// Edge Function: auth-mail  -- account emails sent through YOUR Gmail (not Supabase's mailer).
//   { action: "signup",        name, email, password }   creates the account (unverified) and emails a 6-digit code
//   { action: "resend",        email }                    emails a new verification code
//   { action: "verify",        email, code }              confirms the email, so the person can log in
//   { action: "reset_request", email }                    emails a password-reset code
//   { action: "reset_confirm", email, code, password }    sets the new password
//   { action: "create_admin",  name, email, password }    developer only (needs the developer's login token); account is pre-verified
// Deploy:  supabase functions deploy auth-mail --no-verify-jwt
// Secrets: GMAIL_USER, GMAIL_APP_PASSWORD   (see _shared/mailer.ts)
// In Supabase keep Authentication > Providers > Email > "Confirm email" ON: it is what blocks login until the code is entered.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { adminClient, corsHeaders, json } from "../_shared/maya.ts";
import { sendCodeMail } from "../_shared/mailer.ts";

const MINUTES = 10, COOLDOWN_SEC = 60, MAX_TRIES = 5;
const validEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 254;

async function hashFor(purpose: string, email: string, code: string): Promise<string> {
  const secret = Deno.env.get("AUTH_MAIL_SECRET") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${purpose}|${email}|${code}|${secret}`));
  return Array.from(new Uint8Array(buf), (x) => x.toString(16).padStart(2, "0")).join("");
}

const newCode = () => String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0");

type Admin = ReturnType<typeof adminClient>;

/** Makes a fresh code for (email, purpose), stores only its hash, and emails it. Throws a friendly error on cooldown. */
async function issueCode(admin: Admin, email: string, purpose: "signup" | "reset") {
  const { data: prev } = await admin.from("email_codes").select("sent_at").eq("email", email).eq("purpose", purpose).maybeSingle();
  if (prev && Date.now() - new Date(prev.sent_at).getTime() < COOLDOWN_SEC * 1000)
    throw new Error("Please wait a minute before asking for another email.");
  const code = newCode();
  const { error } = await admin.from("email_codes").upsert({
    email, purpose, code_hash: await hashFor(purpose, email, code), attempts: 0,
    expires_at: new Date(Date.now() + MINUTES * 60000).toISOString(), sent_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
  if (purpose === "signup") await sendCodeMail(email, "Verify your email", "Enter this code on the StudyHub sign-up page to finish creating your account.", code);
  else await sendCodeMail(email, "Reset your password", "Enter this code on the StudyHub login page to choose a new password.", code);
}

/** Checks a typed code. Wrong guesses are counted; after 5 the code is burned. */
async function checkCode(admin: Admin, email: string, purpose: string, code: string) {
  const bad = "That code is wrong or has expired. Check it or ask for a new one.";
  const { data: row } = await admin.from("email_codes").select("*").eq("email", email).eq("purpose", purpose).maybeSingle();
  if (!row || new Date(row.expires_at) < new Date() || row.attempts >= MAX_TRIES) throw new Error(bad);
  if (row.code_hash !== await hashFor(purpose, email, code)) {
    await admin.from("email_codes").update({ attempts: row.attempts + 1 }).eq("email", email).eq("purpose", purpose);
    throw new Error(bad);
  }
  await admin.from("email_codes").delete().eq("email", email).eq("purpose", purpose);
}

async function userByEmail(admin: Admin, email: string) {
  const { data: prof } = await admin.from("profiles").select("id").eq("email", email).maybeSingle();
  if (!prof) return null;
  const { data } = await admin.auth.admin.getUserById(prof.id);
  return data?.user || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");
    const email = String(body.email || "").trim().toLowerCase();
    const admin = adminClient();

    if (action === "signup" || action === "create_admin") {
      const name = String(body.name || "").trim();
      const password = String(body.password || "");
      if (name.length < 2 || name.length > 60) return json({ error: "Please enter the full name." }, 400);
      if (!validEmail(email)) return json({ error: "Please enter a valid email address." }, 400);
      if (password.length < 6) return json({ error: "Password must be at least 6 characters." }, 400);

      if (action === "create_admin") {
        const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
          global: { headers: { Authorization: req.headers.get("Authorization") || "" } }, auth: { persistSession: false },
        });
        const { data: me } = await userClient.auth.getUser();
        if (!me?.user) return json({ error: "Please log in again." }, 401);
        const { data: prof } = await admin.from("profiles").select("role").eq("id", me.user.id).maybeSingle();
        if (prof?.role !== "developer") return json({ error: "Only the developer can create admin accounts." }, 403);
      }

      const { data, error } = await admin.auth.admin.createUser({
        email, password, email_confirm: action === "create_admin", user_metadata: { name },
      });
      if (error) {
        if (/already|registered|exists/i.test(error.message)) return json({ error: "An account with that email already exists. Please log in instead." }, 409);
        return json({ error: error.message }, 400);
      }
      if (action === "create_admin") return json({ id: data.user.id });
      try { await issueCode(admin, email, "signup"); }
      catch (e) {
        await admin.auth.admin.deleteUser(data.user.id);          // no email went out: don't leave a stuck, unverifiable account behind
        throw e;
      }
      return json({ ok: true });
    }

    if (!validEmail(email)) return json({ error: "Please enter a valid email address." }, 400);

    if (action === "resend") {
      const user = await userByEmail(admin, email);
      if (user && !user.email_confirmed_at) await issueCode(admin, email, "signup");
      return json({ ok: true });                                  // same answer either way: don't reveal who has an account
    }

    if (action === "verify") {
      const code = String(body.code || "").replace(/\D/g, "");
      await checkCode(admin, email, "signup", code);
      const user = await userByEmail(admin, email);
      if (!user) return json({ error: "Account not found." }, 404);
      const { error } = await admin.auth.admin.updateUserById(user.id, { email_confirm: true });
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    if (action === "reset_request") {
      const user = await userByEmail(admin, email);
      if (user) await issueCode(admin, email, "reset");
      return json({ ok: true });
    }

    if (action === "reset_confirm") {
      const password = String(body.password || "");
      if (password.length < 6) return json({ error: "Password must be at least 6 characters." }, 400);
      await checkCode(admin, email, "reset", String(body.code || "").replace(/\D/g, ""));
      const user = await userByEmail(admin, email);
      if (!user) return json({ error: "Account not found." }, 404);
      const { error } = await admin.auth.admin.updateUserById(user.id, { password, email_confirm: true });
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true });
    }

    return json({ error: "Unknown action." }, 400);
  } catch (e) {
    return json({ error: (e as Error).message || "Something went wrong." }, 400);
  }
});
