// Emails every new row in public.submissions to the team inbox.
//
// Triggered by a Supabase Database Webhook on INSERT — no Netlify, no site
// backend. Supabase calls this function, this function sends the mail.
//
// Secrets (set with `supabase secrets set KEY=value`):
//   NOTIFY_TO         where to send        (default info@nemilmm.com)
//   MAIL_FROM         sender identity      (default NEMI <info@nemilmm.com>)
//   RESEND_API_KEY    use Resend to send   ── set ONE of these two ──
//   SMTP_HOST/PORT/USER/PASS               use your own mailbox's SMTP instead
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically and are
// used only to sign a short-lived download link for the attachment.

import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const env = (k: string, d = "") => Deno.env.get(k) ?? d;
const NOTIFY_TO = env("NOTIFY_TO", "info@nemilmm.com");
const MAIL_FROM = env("MAIL_FROM", "NEMI <info@nemilmm.com>");
const BUCKET = env("ATTACHMENT_BUCKET", "applications");

const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

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

function buildHtml(rec: Record<string, unknown>, fileUrl: string | null) {
  const row = (k: string, v: string) =>
    v
      ? `<tr><td style="padding:7px 16px 7px 0;font-family:monospace;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#0a4938;vertical-align:top;white-space:nowrap;">${k}</td>` +
        `<td style="padding:7px 0;font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#111;">${v}</td></tr>`
      : "";

  const verified = rec.email_verified
    ? ' <span style="color:#10a37e;">(verified)</span>'
    : ' <span style="color:#b3261e;">(unverified)</span>';

  return (
    '<div style="background:#ece7dd;padding:28px 12px;">' +
    '<div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid rgba(7,7,7,.1);">' +
    '<div style="background:#0a4938;padding:16px 24px;font-family:Helvetica,Arial,sans-serif;font-weight:700;color:#fff;">' +
    'NEMI<span style="color:#10a37e;">.</span> ' +
    `<span style="font-weight:400;font-size:13px;color:#9fe8cf;">new ${esc(rec.form)} submission</span></div>` +
    '<div style="padding:22px 24px;"><table cellpadding="0" cellspacing="0">' +
    row("Name", esc(rec.name)) +
    row("Email", `<a href="mailto:${esc(rec.email)}">${esc(rec.email)}</a>${verified}`) +
    row("Company", esc(rec.company)) +
    row("Topic", esc(rec.topic)) +
    row("Message", esc(rec.message).replace(/\n/g, "<br>")) +
    row(
      "Attachment",
      fileUrl
        ? `<a href="${fileUrl}">Download</a> <span style="color:#888;font-size:12px;">(link valid 7 days)</span>`
        : rec.attachment_path
        ? esc(rec.attachment_path)
        : "",
    ) +
    row("Received", esc(rec.created_at)) +
    "</table></div></div></div>"
  );
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
  if (!host) return false;
  const client = new SMTPClient({
    connection: {
      hostname: host,
      port: Number(env("SMTP_PORT", "587")),
      tls: env("SMTP_PORT", "587") === "465",
      auth: { username: env("SMTP_USER"), password: env("SMTP_PASS") },
    },
  });
  try {
    await client.send({ from: MAIL_FROM, to: NOTIFY_TO, subject, html, content: "text/html" });
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
  const subject = `New ${rec.form ?? "contact"} submission: ${rec.name || rec.email}`;
  const html = buildHtml(rec, fileUrl);

  // Resend if configured, otherwise plain SMTP.
  const ok = (await sendViaResend(subject, html, String(rec.email))) ||
    (await sendViaSmtp(subject, html));

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
