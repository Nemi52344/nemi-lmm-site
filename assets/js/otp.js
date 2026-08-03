/* NEMI · email OTP.
   Uses Supabase Auth's built-in email OTP (auth/v1/otp + auth/v1/verify) via plain
   fetch, so there is no library to load and no backend of ours to run. Works on
   localhost exactly as it does in production.

   Falls back to our own /api/* endpoints if Supabase isn't configured, so nothing
   breaks for anyone still running the old setup. */
(function () {
  var cfg = window.NEMI_CONFIG || {};
  var SB_URL = (cfg.SUPABASE_URL || '').replace(/\/+$/, '');
  var SB_KEY = cfg.SUPABASE_ANON_KEY || '';
  var useSupabase = !!(SB_URL && SB_KEY);
  var API = '/api/';

  function sbFetch(pathname, body) {
    return fetch(SB_URL + pathname, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY },
      body: JSON.stringify(body)
    }).then(function (r) {
      return r.text().then(function (t) {
        var j = {}; try { j = JSON.parse(t); } catch (e) {}
        return { ok: r.ok, j: j };
      });
    });
  }

  /* Supabase surfaces errors under a few different keys depending on the endpoint. */
  function sbError(j, fallback) {
    return (j && (j.msg || j.error_description || j.message || j.error)) || fallback;
  }

  var boxes = document.querySelectorAll('[data-otp]');
  Array.prototype.forEach.call(boxes, function (box) {
    var form = box.closest('form');
    if (!form) return;
    var email = form.querySelector('input[type="email"]');
    var sendBtn = box.querySelector('.otp-send');
    var step = box.querySelector('.otp-step');
    var codeInput = box.querySelector('.otp-code');
    var confirmBtn = box.querySelector('.otp-confirm');
    var msg = box.querySelector('.otp-msg');
    var tokenField = box.querySelector('input[name="email_verified"]');
    var submitBtn = form.querySelector('button[type="submit"]');
    var challenge = null, verified = false;

    function setMsg(t, kind) { msg.textContent = t || ''; msg.className = 'otp-msg' + (kind ? ' otp-msg--' + kind : ''); }
    function readJson(r) { return r.text().then(function (t) { var j = {}; try { j = JSON.parse(t); } catch (e) {} return { ok: r.ok, j: j }; }); }
    function lockSubmit() { if (submitBtn) submitBtn.disabled = !verified; }
    function reset() {
      verified = false; challenge = null; if (tokenField) tokenField.value = '';
      box.classList.remove('is-verified'); if (step) step.hidden = true;
      if (sendBtn) { sendBtn.hidden = false; sendBtn.disabled = false; }
      if (codeInput) { codeInput.style.display = ''; codeInput.value = ''; }
      if (confirmBtn) { confirmBtn.classList.remove('btn--signal'); confirmBtn.classList.add('btn--ghost'); confirmBtn.textContent = 'Confirm'; confirmBtn.disabled = false; }
      if (email) email.readOnly = false; lockSubmit();
    }
    function onVerified(token) {
      verified = true; if (tokenField) tokenField.value = token || 'verified';
      box.classList.add('is-verified');
      confirmBtn.classList.remove('btn--ghost'); confirmBtn.classList.add('btn--signal');
      confirmBtn.textContent = 'Verified ✓'; confirmBtn.disabled = true;
      if (email) email.readOnly = true;
      setMsg('Email verified.', 'ok'); lockSubmit();
    }

    lockSubmit();
    if (email) email.addEventListener('input', function () { if (verified || challenge) { reset(); } setMsg(''); });

    /* Confirm goes green as soon as a full 6-digit code is typed, so it reads as ready */
    if (codeInput && confirmBtn) codeInput.addEventListener('input', function () {
      if (verified) return;
      var ready = /^\d{6}$/.test(codeInput.value.trim());
      confirmBtn.classList.toggle('btn--signal', ready);
      confirmBtn.classList.toggle('btn--ghost', !ready);
    });

    if (sendBtn) sendBtn.addEventListener('click', function () {
      var e = (email && email.value || '').trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) { setMsg('Enter a valid email first.', 'err'); if (email) email.focus(); return; }
      sendBtn.disabled = true; setMsg('Sending code…');

      /* tell Supabase which form this came from so the email template can branch */
      var formKind = (form.getAttribute('name') === 'careers') ? 'careers' : 'contact';

      var request = useSupabase
        ? sbFetch('/auth/v1/otp', {
            email: e,
            create_user: true,
            data: { form: formKind },
            redirect_to: window.location.origin + '/' + formKind + '.html'
          })
            .then(function (res) {
              if (!res.ok) throw new Error(sbError(res.j, 'Could not send the code. Please try again.'));
              return {};
            })
        : fetch(API + 'send-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: e }) })
            .then(readJson)
            .then(function (res) {
              if (!res.ok || !res.j.challenge) throw new Error((res.j && res.j.error) || 'Could not send the code. Please try again.');
              challenge = res.j.challenge;
              return res.j;
            });

      request.then(function (data) {
          if (step) step.hidden = false; sendBtn.hidden = true;
          if (codeInput) codeInput.focus();
          if (data && data.devCode) { if (codeInput) codeInput.value = data.devCode; setMsg('Dev mode: code ' + data.devCode + ' filled in. Click Confirm. (No email sent locally.)'); }
          else setMsg('We sent a 6-digit code to ' + e + '. It expires shortly, check your inbox and spam.');
        })
        .catch(function (err) { sendBtn.disabled = false; setMsg(err.message || 'Could not send code. Try again.', 'err'); });
    });

    if (confirmBtn) confirmBtn.addEventListener('click', function () {
      var code = (codeInput && codeInput.value || '').trim();
      if (!/^\d{6}$/.test(code)) { setMsg('Enter the 6-digit code.', 'err'); return; }
      var e = (email && email.value || '').trim();
      confirmBtn.disabled = true; setMsg('Verifying…');

      var request = useSupabase
        ? sbFetch('/auth/v1/verify', { type: 'email', email: e, token: code })
            .then(function (res) {
              if (!res.ok) throw new Error(sbError(res.j, 'Incorrect or expired code.'));
              return res.j.access_token || 'verified';
            })
        : fetch(API + 'verify-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ challenge: challenge, code: code }) })
            .then(readJson)
            .then(function (res) {
              if (!res.ok || !res.j || !res.j.verified) throw new Error((res.j && res.j.error) || 'Incorrect or expired code.');
              return res.j.verified;
            });

      request.then(onVerified)
        .catch(function (err) { confirmBtn.disabled = false; setMsg(err.message || 'Verification failed. Try again.', 'err'); });
    });

    // Hard guard: block submit until verified, running before the form's own submit handler.
    form.addEventListener('submit', function (ev) {
      if (!verified) { ev.preventDefault(); ev.stopImmediatePropagation(); setMsg('Please verify your email before submitting.', 'err'); if (sendBtn && sendBtn.hidden === false) sendBtn.focus(); }
    }, true);
  });
})();
