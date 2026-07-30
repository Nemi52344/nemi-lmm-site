// NEMI · form submission core. Platform-neutral, zero dependencies (Node 18+ fetch).
// Stores submissions (and resume/attachment files) in Supabase, and emails a notification via Resend.
// Used by netlify/functions/submit-form.js AND server.js, so it runs on Netlify, AWS, any Node host.
//
// Env vars:
//   SUPABASE_URL           e.g. https://xxxx.supabase.co
//   SUPABASE_SERVICE_KEY   service-role key (server-side only, never shipped to the browser)
//   RESEND_API_KEY         Resend key for the notification email
//   OTP_FROM               sender identity (shared with the OTP email)
//   NOTIFY_TO              where notifications go (default info@nemilmm.com)
//   OTP_DEV=1              dev mode: accept + log submissions without Supabase/Resend
const crypto = require('crypto');
const otp = require('./otp-core');

const MAX_FILE_BYTES = 4.5 * 1024 * 1024; // keep under serverless payload limits
const BUCKET = 'attachments';

function env(k, d) { return process.env[k] || d || ''; }
function hasSupabase() { return !!env('SUPABASE_URL') && !!env('SUPABASE_SERVICE_KEY'); }
function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function sbHeaders(extra) {
  return Object.assign({
    apikey: env('SUPABASE_SERVICE_KEY'),
    Authorization: 'Bearer ' + env('SUPABASE_SERVICE_KEY')
  }, extra || {});
}

async function uploadFile(file) {
  // file: { name, type, data(base64) } -> returns storage path or null
  const clean = String(file.name || 'file').replace(/[^A-Za-z0-9._-]+/g, '_').slice(-80);
  const path = new Date().toISOString().slice(0, 10) + '/' + crypto.randomUUID() + '-' + clean;
  const buf = Buffer.from(file.data, 'base64');
  const r = await fetch(env('SUPABASE_URL') + '/storage/v1/object/' + BUCKET + '/' + path, {
    method: 'POST',
    headers: sbHeaders({ 'Content-Type': file.type || 'application/octet-stream', 'x-upsert': 'false' }),
    body: buf
  });
  return r.ok ? path : null;
}

async function signUrl(path) {
  try {
    const r = await fetch(env('SUPABASE_URL') + '/storage/v1/object/sign/' + BUCKET + '/' + path, {
      method: 'POST', headers: sbHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ expiresIn: 60 * 60 * 24 * 7 }) // 7 days
    });
    if (!r.ok) return null;
    const j = await r.json();
    return j.signedURL ? env('SUPABASE_URL') + '/storage/v1' + j.signedURL : null;
  } catch (e) { return null; }
}

async function insertRow(row) {
  const r = await fetch(env('SUPABASE_URL') + '/rest/v1/submissions', {
    method: 'POST',
    headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
    body: JSON.stringify(row)
  });
  return r.ok;
}

function notifyHtml(d, fileUrl) {
  const row = (k, v) => v ? '<tr><td style="padding:6px 14px 6px 0;font-family:monospace;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#0a4938;vertical-align:top;white-space:nowrap;">' + k + '</td><td style="padding:6px 0;font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#111;">' + v + '</td></tr>' : '';
  return '<div style="background:#ece7dd;padding:28px 12px;"><div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid rgba(7,7,7,.1);">'
    + '<div style="background:#0a4938;padding:16px 24px;font-family:Helvetica,Arial,sans-serif;font-weight:700;color:#fff;">NEMI<span style="color:#10a37e;">.</span> <span style="font-weight:400;font-size:13px;color:#9fe8cf;">new ' + esc(d.form) + ' submission</span></div>'
    + '<div style="padding:22px 24px;"><table cellpadding="0" cellspacing="0">'
    + row('Name', esc(d.name)) + row('Email', esc(d.email) + (d.emailVerified ? ' <span style="color:#10a37e;">(verified)</span>' : ' <span style="color:#b3261e;">(unverified)</span>'))
    + row('Company', esc(d.company)) + row('Topic', esc(d.topic))
    + row('Message', esc(d.message).replace(/\n/g, '<br>'))
    + row('File', fileUrl ? '<a href="' + fileUrl + '">' + esc(d.fileName || 'attachment') + '</a> <span style="color:#888;font-size:12px;">(link valid 7 days)</span>' : (d.fileName ? esc(d.fileName) + ' (stored in Supabase)' : ''))
    + '</table></div></div></div>';
}

async function notify(d, fileUrl) {
  if (!env('RESEND_API_KEY')) return false;
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + env('RESEND_API_KEY'), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env('OTP_FROM', 'NEMI <info@nemi-ai.com>'),
        to: [env('NOTIFY_TO', 'info@nemi-ai.com')],
        reply_to: d.email,
        subject: 'New ' + d.form + ' submission: ' + (d.name || d.email),
        html: notifyHtml(d, fileUrl)
      })
    });
    return r.ok;
  } catch (e) { return false; }
}

// Main entry. body: { form, name, email, company, topic, message, email_verified, file:{name,type,data} }
async function handleSubmit(body) {
  const d = {
    form: body.form === 'careers' ? 'careers' : 'contact',
    name: String(body.name || '').trim().slice(0, 200),
    email: String(body.email || '').trim().toLowerCase().slice(0, 200),
    company: String(body.company || '').trim().slice(0, 200),
    topic: String(body.topic || '').trim().slice(0, 200),
    message: String(body.message || '').trim().slice(0, 8000),
    fileName: body.file && body.file.name ? String(body.file.name).slice(0, 200) : ''
  };
  if (!d.name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email) || !d.message) {
    return { statusCode: 400, body: { error: 'Please fill in name, email and message.' } };
  }
  if (d.form === 'careers' && !(body.file && body.file.data)) {
    return { statusCode: 400, body: { error: 'Please attach your resume (PDF).' } };
  }
  if (body.file && body.file.data && Buffer.byteLength(body.file.data, 'base64') > MAX_FILE_BYTES) {
    return { statusCode: 400, body: { error: 'File is too large. Please keep it under 4 MB.' } };
  }
  d.emailVerified = otp.verifyProof(body.email_verified, d.email);
  if (!d.emailVerified) return { statusCode: 400, body: { error: 'Please verify your email before submitting.' } };

  // Dev mode with nothing configured: accept and log so the flow is testable locally.
  if (!hasSupabase() && !env('RESEND_API_KEY')) {
    if (env('OTP_DEV') === '1') {
      console.log('[FORM] (dev) submission:', JSON.stringify({ form: d.form, name: d.name, email: d.email, file: d.fileName }));
      return { statusCode: 200, body: { ok: true, dev: true } };
    }
    return { statusCode: 500, body: { error: 'Submissions are not configured yet.' } };
  }

  let storedPath = null, fileUrl = null, dbOk = false;
  if (hasSupabase()) {
    if (body.file && body.file.data) {
      storedPath = await uploadFile(body.file);
      if (storedPath) fileUrl = await signUrl(storedPath);
    }
    dbOk = await insertRow({
      form: d.form, name: d.name, email: d.email, email_verified: d.emailVerified,
      company: d.company || null, topic: d.topic || null, message: d.message,
      attachment_path: storedPath, meta: { file_name: d.fileName || null }
    });
  }
  const mailOk = await notify(d, fileUrl);

  if (!dbOk && !mailOk) return { statusCode: 502, body: { error: 'Could not save your submission. Please try again.' } };
  return { statusCode: 200, body: { ok: true } };
}

module.exports = { handleSubmit };
