// NEMI · OTP core — platform-neutral. Zero dependencies (Node built-ins + global fetch, Node 18+).
// Used by the Netlify functions AND the standalone server.js, so the same logic runs on
// Netlify, AWS (Lambda/EC2/App Runner/Beanstalk/container), any VPS, or locally.
//
// Config via env vars (same names on every host):
//   OTP_SECRET       required — long random string used to sign tokens
//   RESEND_API_KEY   required in production — Resend API key that actually sends the email
//   OTP_FROM         optional, default "NEMI <info@nemi-ai.com>" (domain must be verified in Resend)
//   OTP_DEV=1        optional — dev mode: DON'T send email, just log the code to the server console
const crypto = require('crypto');

const TTL_MS = 10 * 60 * 1000;          // code valid 10 min
const VERIFIED_TTL_MS = 30 * 60 * 1000; // "verified" proof valid 30 min

function env(k, d) { return process.env[k] || d || ''; }
function secret() { return env('OTP_SECRET') || (env('OTP_DEV') === '1' ? 'nemi-otp-dev-secret' : ''); }
function b64url(buf) { return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function sign(data) { return b64url(crypto.createHmac('sha256', secret()).update(data).digest()); }
function safeEq(a, b) { const A = Buffer.from(String(a)), B = Buffer.from(String(b)); return A.length === B.length && crypto.timingSafeEqual(A, B); }
function isEmail(e) { return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e); }
function configured() { return !!secret() && (!!env('RESEND_API_KEY') || env('OTP_DEV') === '1'); }

function emailHtml(code) {
  const spaced = code.split('').join('&nbsp;&nbsp;');
  return `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#ece7dd;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ece7dd;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="width:480px;max-width:100%;background:#ffffff;border:1px solid rgba(7,7,7,.10);border-radius:4px;overflow:hidden;">
        <tr><td style="background:#0a4938;padding:22px 32px;">
          <span style="font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:20px;font-weight:700;letter-spacing:.5px;color:#ffffff;">NEMI<span style="color:#10a37e;">.</span></span>
          <span style="font-family:'Courier New',monospace;font-size:10px;letter-spacing:2px;color:#9fe8cf;text-transform:uppercase;float:right;padding-top:7px;">LMM&nbsp;for&nbsp;Physical&nbsp;AI</span>
        </td></tr>
        <tr><td style="padding:36px 32px 8px;">
          <h1 style="margin:0;font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:22px;line-height:1.3;color:#070707;letter-spacing:-.5px;">Verify your email</h1>
          <p style="margin:12px 0 0;font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:rgba(7,7,7,.66);">Enter this code back on the form to confirm your email address.</p>
        </td></tr>
        <tr><td style="padding:22px 32px 8px;">
          <div style="background:#f6f4e8;border:1px solid rgba(16,163,126,.28);border-radius:4px;padding:22px;text-align:center;">
            <div style="font-family:'Courier New',monospace;font-size:34px;font-weight:700;letter-spacing:6px;color:#0a4938;">${spaced}</div>
          </div>
          <p style="margin:14px 0 0;font-family:'Courier New',monospace;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:rgba(7,7,7,.45);text-align:center;">Expires in 10 minutes</p>
        </td></tr>
        <tr><td style="padding:20px 32px 34px;">
          <p style="margin:0;font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:rgba(7,7,7,.5);">If you didn&rsquo;t request this, you can safely ignore this email. No action is taken until the code is entered.</p>
        </td></tr>
        <tr><td style="background:#101512;padding:18px 32px;">
          <span style="font-family:'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;color:rgba(236,231,221,.55);">NEMI AI &middot; Stafford, Texas &middot; Chennai &middot; Coimbatore</span>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function sendEmail(email, code) {
  const dev = env('OTP_DEV') === '1';
  const key = env('RESEND_API_KEY');
  if (dev || !key) {
    // Dev mode (or key missing): log the code to the server console instead of emailing.
    console.log('[OTP] code for ' + email + ': ' + code + (key ? '' : '  (RESEND_API_KEY not set — email not sent)'));
    return { ok: dev };
  }
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env('OTP_FROM', 'NEMI <info@nemi-ai.com>'),
        to: [email], subject: 'Your NEMI verification code: ' + code, html: emailHtml(code)
      })
    });
    return { ok: r.ok };
  } catch (e) { return { ok: false }; }
}

// Step 1: create a challenge and send the code. Returns { statusCode, body }.
async function handleSend(email) {
  if (!configured()) return { statusCode: 500, body: { error: 'Verification is not configured yet.' } };
  email = String(email || '').trim().toLowerCase();
  if (!isEmail(email)) return { statusCode: 400, body: { error: 'Enter a valid email address.' } };

  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  const payload = b64url(JSON.stringify({ e: email, h: sign(code + '|' + email), x: Date.now() + TTL_MS }));
  const challenge = payload + '.' + sign(payload);

  const sent = await sendEmail(email, code);
  if (!sent.ok) return { statusCode: 502, body: { error: 'Could not send the code. Try again.' } };
  const body = { challenge };
  if (env('OTP_DEV') === '1') body.devCode = code; // dev only: surfaces the code so it can be tested without email
  return { statusCode: 200, body };
}

// Step 2: verify a code against the challenge. Returns { statusCode, body }.
function handleVerify(challenge, code) {
  if (!secret()) return { statusCode: 500, body: { error: 'Verification is not configured yet.' } };
  challenge = String(challenge || ''); code = String(code || '').trim();

  const parts = challenge.split('.');
  if (parts.length !== 2 || !safeEq(parts[1], sign(parts[0]))) return { statusCode: 400, body: { error: 'Invalid or tampered challenge.' } };
  let data;
  try { data = JSON.parse(Buffer.from(parts[0].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()); }
  catch (e) { return { statusCode: 400, body: { error: 'Invalid challenge.' } }; }

  if (Date.now() > data.x) return { statusCode: 400, body: { ok: false, error: 'Code expired. Request a new one.' } };
  if (!/^\d{6}$/.test(code)) return { statusCode: 200, body: { ok: false, error: 'Enter the 6-digit code.' } };
  if (!safeEq(data.h, sign(code + '|' + data.e))) return { statusCode: 200, body: { ok: false, error: 'Incorrect code.' } };

  const vpayload = b64url(JSON.stringify({ e: data.e, x: Date.now() + VERIFIED_TTL_MS }));
  return { statusCode: 200, body: { ok: true, verified: vpayload + '.' + sign(vpayload), email: data.e } };
}

// Server-side check of the "verified" proof a form submits. True only if the token is
// authentic, unexpired, and was issued for this exact email.
function verifyProof(token, email) {
  if (!secret()) return false;
  const parts = String(token || '').split('.');
  if (parts.length !== 2 || !safeEq(parts[1], sign(parts[0]))) return false;
  try {
    const data = JSON.parse(Buffer.from(parts[0].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
    return Date.now() <= data.x && data.e === String(email || '').trim().toLowerCase();
  } catch (e) { return false; }
}

module.exports = { handleSend, handleVerify, verifyProof };
