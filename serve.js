// Local preview launcher on port 4100. Runs the universal server (static site + API).
//
// Two modes, chosen automatically:
//   * .env has a RESEND_API_KEY  -> REAL mode: the OTP is actually emailed, exactly like production.
//   * no key                     -> DEV mode: the code is auto-filled on screen, no email sent.
// Copy .env.example to .env and paste your Resend key to switch to real emails.
const fs = require('fs');
const path = require('path');

// peek at .env early, just to decide the mode (server.js loads it properly)
try {
  const file = path.join(__dirname, '.env');
  if (fs.existsSync(file)) {
    fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach(function (line) {
      const t = line.trim();
      if (!t || t[0] === '#') return;
      const eq = t.indexOf('=');
      if (eq < 1) return;
      const k = t.slice(0, eq).trim();
      const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (k && !process.env[k]) process.env[k] = v;
    });
  }
} catch (e) { /* ignore */ }

if (process.env.RESEND_API_KEY) {
  console.log('REAL mode: RESEND_API_KEY found, OTP codes will be emailed for real.');
  if (!process.env.OTP_SECRET) process.env.OTP_SECRET = 'local-dev-secret';
} else {
  console.log('DEV mode: no RESEND_API_KEY, the OTP code is shown on screen instead of emailed.');
  console.log('          To send real emails, copy .env.example to .env and add your Resend key.');
  process.env.OTP_DEV = '1';
  if (!process.env.OTP_SECRET) process.env.OTP_SECRET = 'local-dev-secret';
}
if (!process.env.PORT) process.env.PORT = '4100';
require('./server.js');
