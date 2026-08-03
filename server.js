// NEMI · universal server. Serves the static site AND the OTP API (/api/send-otp, /api/verify-otp).
// Zero dependencies — Node 18+ built-ins only. Runs anywhere Node runs:
//   AWS (EC2 / Elastic Beanstalk / App Runner / ECS / Lightsail), any VPS, Render, Railway, Fly, or locally.
//   Start:  node server.js         (reads PORT, defaults to 8080)
//   Local test without email:  OTP_DEV=1 node server.js   (code is logged to this console)
const http = require('http');
const fs = require('fs');
const path = require('path');

/* Load a local .env (gitignored) before anything reads process.env, so running
   `node server.js` on your own machine can send real email exactly like production. */
(function loadEnv() {
  try {
    var file = path.join(__dirname, '.env');
    if (!fs.existsSync(file)) return;
    fs.readFileSync(file, 'utf8').split(/\r?\n/).forEach(function (line) {
      var t = line.trim();
      if (!t || t[0] === '#') return;
      var eq = t.indexOf('=');
      if (eq < 1) return;
      var k = t.slice(0, eq).trim();
      var v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
      if (k && !process.env[k]) process.env[k] = v;   // real env always wins
    });
    console.log('Loaded .env');
  } catch (e) { /* no .env, carry on */ }
})();

const core = require('./otp-core');
const formCore = require('./form-core');

const ROOT = __dirname;
const PORT = process.env.PORT || 8080;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.woff': 'font/woff',
  '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.txt': 'text/plain; charset=utf-8', '.pdf': 'application/pdf'
};

function readBody(req, limit) {
  const max = limit || 1e6;
  return new Promise(function (resolve) {
    let data = ''; let size = 0;
    req.on('data', function (c) { size += c.length; if (size > max) { req.destroy(); } else { data += c; } });
    req.on('end', function () { resolve(data); });
    req.on('error', function () { resolve(''); });
  });
}
function sendJson(res, statusCode, obj) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

const server = http.createServer(async function (req, res) {
  const url = new URL(req.url, 'http://localhost');
  const pathname = decodeURIComponent(url.pathname);

  if (pathname === '/api/health') {
    const r = formCore.handleHealth();
    res.writeHead(r.statusCode, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify(r.body));
  }

  // --- API (same paths the frontend uses on every host) ---
  if (pathname === '/api/send-otp' || pathname === '/api/verify-otp' || pathname === '/api/submit-form') {
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' });
    const limit = pathname === '/api/submit-form' ? 8 * 1024 * 1024 : 1e6; // room for a base64 resume
    let body = {};
    try { body = JSON.parse((await readBody(req, limit)) || '{}'); } catch (e) { return sendJson(res, 400, { error: 'Bad request' }); }
    const r = pathname === '/api/send-otp' ? await core.handleSend(body.email)
      : pathname === '/api/verify-otp' ? core.handleVerify(body.challenge, body.code)
      : await formCore.handleSubmit(body);
    return sendJson(res, r.statusCode, r.body);
  }

  // --- static files ---
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end('Method not allowed'); }
  let rel = pathname === '/' ? '/index.html' : pathname;
  if (rel.endsWith('/')) rel += 'index.html';
  const filePath = path.join(ROOT, rel);
  // block path traversal and hidden server files
  if (!filePath.startsWith(ROOT) || rel.indexOf('/netlify/') === 0 || rel.indexOf('/node_modules/') === 0) {
    res.writeHead(403); return res.end('Forbidden');
  }
  fs.readFile(filePath, function (err, buf) {
    if (err) {
      // fall back to .html (pretty URLs), else 404
      fs.readFile(filePath + '.html', function (err2, buf2) {
        if (err2) { res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end('<h1>404</h1>'); }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(req.method === 'HEAD' ? undefined : buf2);
      });
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
    res.end(req.method === 'HEAD' ? undefined : buf);
  });
});

server.listen(PORT, function () {
  console.log('NEMI server running on http://localhost:' + PORT + (process.env.OTP_DEV === '1' ? '  (OTP_DEV: codes logged here, no email sent)' : ''));
});
