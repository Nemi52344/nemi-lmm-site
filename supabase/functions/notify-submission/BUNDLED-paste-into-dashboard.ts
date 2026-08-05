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

// Quotes matter as much as angle brackets here: these values land inside
// href="..." attributes, and an unescaped quote lets a submitted string break
// out of the attribute and inject its own — in an email we open ourselves.
const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// Only ever emit links we know are http(s). A submitted "javascript:..." URL
// would otherwise become a clickable script in the notification.
const safeUrl = (s: unknown) => {
  const v = String(s ?? "").trim();
  return /^https?:\/\//i.test(v) ? esc(v) : "";
};

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
    // Shared link, used when the file was too big to upload. Shown as plain
    // text if it is not a normal http(s) URL, so it is never a live link we
    // did not vet.
    row(
      "Shared link",
      rec.attachment_url
        ? (safeUrl(rec.attachment_url)
          ? `<a href="${safeUrl(rec.attachment_url)}">${esc(rec.attachment_url)}</a>`
          : esc(rec.attachment_url))
        : "",
    ) +
    row("Received", esc(rec.created_at)) +
    "</table></div></div></div>"
  );
}

function buildSubject(rec: Record<string, unknown>) {
  return `New ${rec.form ?? "contact"} submission: ${rec.name || rec.email}`;
}

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
