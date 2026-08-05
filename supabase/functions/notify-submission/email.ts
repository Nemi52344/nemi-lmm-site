// Pure email rendering — no Deno APIs, so it can be unit-tested outside the
// Edge Function runtime.

// Quotes matter as much as angle brackets here: these values land inside
// href="..." attributes, and an unescaped quote lets a submitted string break
// out of the attribute and inject its own — in an email we open ourselves.
export const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// Only ever emit links we know are http(s). A submitted "javascript:..." URL
// would otherwise become a clickable script in the notification.
export const safeUrl = (s: unknown) => {
  const v = String(s ?? "").trim();
  return /^https?:\/\//i.test(v) ? esc(v) : "";
};

/** Every stored path for a submission: the array column, falling back to the
 *  single-file column for rows written before multi-upload existed. */
export function attachmentPaths(rec: Record<string, unknown>): string[] {
  const many = rec.attachment_paths;
  if (Array.isArray(many) && many.length) return many.map(String);
  return rec.attachment_path ? [String(rec.attachment_path)] : [];
}

/** Show just the filename, not the whole storage key. */
const baseName = (p: string) => String(p).split("/").pop()!.replace(/^\d+-[a-z0-9]{6}-/, "");

// fileUrls is index-matched to attachmentPaths(rec); an entry may be null when
// that file's signed link could not be created.
export function buildHtml(
  rec: Record<string, unknown>,
  fileUrl: string | null,
  fileUrls: (string | null)[] = fileUrl ? [fileUrl] : [],
) {
  const fileNames = attachmentPaths(rec).map(baseName);
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
    // One row listing every attached file. fileUrls is index-matched to the
    // stored paths; a file whose link could not be signed still gets listed by
    // name, so it is never silently dropped from the notification.
    row(
      fileNames.length > 1 ? `Attachments (${fileNames.length})` : "Attachment",
      fileNames.length
        ? fileNames
          .map((n, i) =>
            fileUrls[i]
              ? `<a href="${fileUrls[i]}">${esc(n)}</a>`
              : `${esc(n)} <span style="color:#888;font-size:12px;">(link unavailable)</span>`
          )
          .join("<br>") +
          (fileUrls.some(Boolean)
            ? ' <span style="color:#888;font-size:12px;">(links valid 7 days)</span>'
            : "")
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

export function buildSubject(rec: Record<string, unknown>) {
  return `New ${rec.form ?? "contact"} submission: ${rec.name || rec.email}`;
}
