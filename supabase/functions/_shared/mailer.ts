// Sends email through your own Gmail account (SMTP). Supabase's built-in mailer is NOT used.
// Secrets (set with `supabase secrets set`):
//   GMAIL_USER          the Gmail address that sends the mail, e.g. studyhub.mail@gmail.com
//   GMAIL_APP_PASSWORD  a Google "App password" (Google Account > Security > 2-Step Verification > App passwords). NOT your normal password.
//   MAIL_FROM_NAME      (optional) name shown to the reader, default "StudyHub"
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

export async function sendMail(to: string, subject: string, text: string, html: string): Promise<void> {
  const user = Deno.env.get("GMAIL_USER");
  const pass = (Deno.env.get("GMAIL_APP_PASSWORD") || "").replace(/\s+/g, "");
  if (!user || !pass) throw new Error("Email isn't set up yet: the GMAIL_USER and GMAIL_APP_PASSWORD secrets are missing.");
  const client = new SMTPClient({
    connection: { hostname: "smtp.gmail.com", port: 465, tls: true, auth: { username: user, password: pass } },
  });
  try {
    await client.send({ from: `${Deno.env.get("MAIL_FROM_NAME") || "StudyHub"} <${user}>`, to, subject, content: text, html });
  } catch (e) {
    console.error("Gmail send failed:", (e as Error).message);
    throw new Error("We couldn't send the email right now. Please try again in a minute.");
  } finally {
    try { await client.close(); } catch { /* already closed */ }
  }
}

/** A simple, clean message that shows a big one-time code. */
export async function sendCodeMail(to: string, heading: string, intro: string, code: string): Promise<void> {
  const text = `${heading}\n\n${intro}\n\nYour code: ${code}\n\nIt works for 10 minutes. If you didn't ask for it, you can ignore this email.`;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:420px;margin:auto;padding:24px;color:#1b2430">
    <h2 style="margin:0 0 8px">${esc(heading)}</h2>
    <p style="margin:0 0 18px;line-height:1.5">${esc(intro)}</p>
    <div style="font-size:34px;font-weight:700;letter-spacing:10px;text-align:center;padding:14px;border-radius:8px;background:#f2f4f8">${esc(code)}</div>
    <p style="margin:18px 0 0;font-size:12.5px;color:#667">This code works for 10 minutes. If you didn't ask for it, you can ignore this email.</p>
  </div>`;
  await sendMail(to, `${code} is your StudyHub code`, text, html);
}
