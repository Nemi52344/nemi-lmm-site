// Local preview launcher: runs the universal server (static site + OTP API) in DEV mode on port 4100.
// Dev mode means the OTP code is shown in the browser and logged here — no Resend / email needed.
// Production never uses this file: deploy runs `node server.js` (with real env vars) or Netlify functions.
process.env.OTP_DEV = '1';
if (!process.env.OTP_SECRET) process.env.OTP_SECRET = 'local-dev-secret';
if (!process.env.PORT) process.env.PORT = '4100';
require('./server.js');
