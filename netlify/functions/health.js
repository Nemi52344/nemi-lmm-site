// Netlify adapter — reports which integrations are configured (never the secret values).
const core = require('../../form-core');

exports.handler = async function () {
  const r = core.handleHealth();
  return {
    statusCode: r.statusCode,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    body: JSON.stringify(r.body)
  };
};
