// Pure email rendering — no Deno APIs, so it can be unit-tested outside the
// Edge Function runtime.

export const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function buildHtml(rec: Record<string, unknown>, fileUrl: string | null) {
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

export function buildSubject(rec: Record<string, unknown>) {
  return `New ${rec.form ?? "contact"} submission: ${rec.name || rec.email}`;
}
