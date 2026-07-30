// Netlify adapter — delegates to the shared, platform-neutral core in form-core.js
const core = require('../../form-core');

exports.handler = async function (event) {
  const headers = { 'Content-Type': 'application/json' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  let b;
  try { b = JSON.parse(event.body || '{}'); }
  catch (e) { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Bad request' }) }; }
  const r = await core.handleSubmit(b);
  return { statusCode: r.statusCode, headers, body: JSON.stringify(r.body) };
};
