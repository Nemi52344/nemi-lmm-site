// Emails every new row in public.submissions to the team inbox.
//
// Triggered by a Supabase Database Webhook on INSERT — no Netlify, no site
// backend. Supabase calls this function, this function sends the mail.
//
// Secrets (set with `supabase secrets set KEY=value`):
//   NOTIFY_TO         where to send        (default info@nemilmm.com)
//   MAIL_FROM         sender identity      (default NEMI <info@nemi-ai.com>)
//                     NOTE: the FROM domain must be verified in Resend.
//                     nemi-ai.com is; nemilmm.com is not (yet).
//   RESEND_API_KEY    use Resend to send   ── set ONE of these two ──
//   SMTP_HOST/PORT/USER/PASS               use your own mailbox's SMTP instead
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically and are
// used only to sign a short-lived download link for the attachment.

import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { buildHtml, buildSubject } from "./email.ts";

const env = (k: string, d = "") => Deno.env.get(k) ?? d;
const NOTIFY_TO = env("NOTIFY_TO", "info@nemilmm.com");
const MAIL_FROM = env("MAIL_FROM", "NEMI <info@nemi-ai.com>");
const BUCKET = env("ATTACHMENT_BUCKET", "applications");

/** Short-lived download link for the stored attachment (7 days). */
async function signedUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const url = env("SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  try {
    const r = await fetch(`${url}/storage/v1/object/sign/${BUCKET}/${path}`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ expiresIn: 60 * 60 * 24 * 7 }),
    });
    if (!r.ok) return null;
    const j = await r.json();
    return j?.signedURL ? `${url}/storage/v1${j.signedURL}` : null;
  } catch {
    return null;
  }
}


async function sendViaResend(subject: string, html: string, replyTo: string) {
  const key = env("RESEND_API_KEY");
  if (!key) return false;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: MAIL_FROM,
      to: [NOTIFY_TO],
      reply_to: replyTo || undefined,
      subject,
      html,
    }),
  });
  if (!r.ok) console.error("resend failed", r.status, await r.text());
  return r.ok;
}

async function sendViaSmtp(subject: string, html: string) {
  const host = env("SMTP_HOST");
  const pass = env("SMTP_PASS");
  // Both are needed. Without the password the connection just hangs on auth,
  // so bail out early and let the Resend fallback handle it.
  if (!host || !pass) return false;
  const port = Number(env("SMTP_PORT", "587"));
  const client = new SMTPClient({
    connection: {
      hostname: host,
      port,
      // 587 is STARTTLS (tls:false + starttls), 465 is implicit TLS.
      tls: port === 465,
      auth: { username: env("SMTP_USER"), password: pass },
    },
  });
  // Microsoft 365 rejects mail whose From is not the authenticated mailbox, so
  // send as SMTP_USER rather than the shared MAIL_FROM (which is the Resend
  // sender on a different domain).
  const from = env("SMTP_FROM") ||
    (env("SMTP_USER") ? `NEMI <${env("SMTP_USER")}>` : MAIL_FROM);
  try {
    await client.send({ from, to: NOTIFY_TO, subject, html, content: "text/html" });
    return true;
  } catch (e) {
    console.error("smtp failed", e);
    return false;
  } finally {
    try { await client.close(); } catch { /* ignore */ }
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400 });
  }

  // Accept the Database Webhook envelope, or a bare row for manual testing.
  const rec = (body.record ?? body) as Record<string, unknown>;
  if (!rec || !rec.email) {
    return new Response(JSON.stringify({ error: "No submission in payload" }), { status: 400 });
  }

  const fileUrl = await signedUrl((rec.attachment_path as string) ?? null);
  const subject = buildSubject(rec);
  const html = buildHtml(rec, fileUrl);

  // SMTP wins when it is configured, because sending through our own mailbox
  // lets the mail genuinely come FROM info@nemilmm.com. Resend can only send as
  // a domain verified in its account (nemi-ai.com), so it stays as the fallback
  // — if SMTP is down or misconfigured the notification still gets through.
  const ok = (await sendViaSmtp(subject, html)) ||
    (await sendViaResend(subject, html, String(rec.email)));

  if (!ok) {
    // 500 makes the failure visible in the webhook's delivery log rather than
    // silently losing the notification.
    return new Response(
      JSON.stringify({ error: "No mail transport configured or send failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
