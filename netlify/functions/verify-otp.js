// Netlify adapter — delegates to the shared, platform-neutral core in otp-core.js
const core = require('../../otp-core');

exports.handler = async function (event) {
  const headers = { 'Content-Type': 'application/json' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  let b;
  try { b = JSON.parse(event.body || '{}'); }
  catch (e) { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Bad request' }) }; }
  const r = core.handleVerify(b.challenge, b.code);
  return { statusCode: r.statusCode, headers, body: JSON.stringify(r.body) };
};
