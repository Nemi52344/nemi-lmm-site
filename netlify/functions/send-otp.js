// Netlify adapter — delegates to the shared, platform-neutral core in otp-core.js
const core = require('../../otp-core');

exports.handler = async function (event) {
  const headers = { 'Content-Type': 'application/json' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  let email;
  try { email = JSON.parse(event.body || '{}').email; }
  catch (e) { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Bad request' }) }; }
  const r = await core.handleSend(email);
  return { statusCode: r.statusCode, headers, body: JSON.stringify(r.body) };
};
