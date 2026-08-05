// Emails every new row in public.submissions to the team inbox.
// Triggered by a Supabase Database Webhook on INSERT.
//
// Resend only. Do NOT add an SMTP client here: Supabase Edge Functions run on
// a Deno runtime with no outbound TCP sockets, so importing one makes the
// worker fail to boot and every call returns 503. Sending as a different
// domain has to go through an HTTPS email API with that domain verified.
//
// Secrets:
//   NOTIFY_TO       where to send  (default info@nemilmm.com)
//   MAIL_FROM       sender         (default NEMI <info@nemi-ai.com>; the FROM
//                                  domain must be verified in Resend, and
//                                  nemi-ai.com is, nemilmm.com is not)
//   RESEND_API_KEY  required
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically and
// used only to sign short-lived download links for the attachments.

import { buildHtml, buildSubject, attachmentPaths } from "./email.ts";

const env = (k: string, d = "") => Deno.env.get(k) ?? d;
const NOTIFY_TO = env("NOTIFY_TO", "info@nemilmm.com");
const MAIL_FROM = env("MAIL_FROM", "NEMI <info@nemi-ai.com>");
const BUCKET = env("ATTACHMENT_BUCKET", "applications");

/** Short-lived download link for one stored attachment (7 days). */
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

  // Sign every attachment, keeping order so names and links stay paired.
  const paths = attachmentPaths(rec);
  const fileUrls = await Promise.all(paths.map((p) => signedUrl(p)));
  const html = buildHtml(rec, fileUrls[0] ?? null, fileUrls);

  const ok = await sendViaResend(buildSubject(rec), html, String(rec.email));

  if (!ok) {
    // 500 makes the failure visible in the webhook's delivery log rather than
    // silently losing the notification.
    return new Response(JSON.stringify({ error: "Send failed" }), {
      status: 500, headers: { "Content-Type": "application/json" },
    });
  }
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
