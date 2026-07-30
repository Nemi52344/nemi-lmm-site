/* NEMI · email OTP flow. Wires any [data-otp] block inside a form:
   Verify email -> code sent -> confirm code -> submit unlocked. Submit stays blocked until verified. */
(function () {
  var API = '/api/'; /* universal: Netlify rewrites /api/* to the function; server.js handles it directly */
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

    lockSubmit();
    if (email) email.addEventListener('input', function () { if (verified || challenge) { reset(); } setMsg(''); });

    if (sendBtn) sendBtn.addEventListener('click', function () {
      var e = (email && email.value || '').trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) { setMsg('Enter a valid email first.', 'err'); if (email) email.focus(); return; }
      sendBtn.disabled = true; setMsg('Sending code…');
      fetch(API + 'send-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: e }) })
        .then(readJson)
        .then(function (res) {
          if (!res.ok || !res.j.challenge) throw new Error(res.j && res.j.error || 'Could not send the code. Please try again.');
          challenge = res.j.challenge;
          if (step) step.hidden = false; sendBtn.hidden = true;
          if (codeInput) codeInput.focus();
          if (res.j.devCode) { if (codeInput) codeInput.value = res.j.devCode; setMsg('Dev mode: code ' + res.j.devCode + ' filled in. Click Confirm. (No email sent locally.)'); }
          else setMsg('We sent a 6-digit code to ' + e + '. It expires in 10 minutes.');
        })
        .catch(function (err) { sendBtn.disabled = false; setMsg(err.message || 'Could not send code. Try again.', 'err'); });
    });

    if (confirmBtn) confirmBtn.addEventListener('click', function () {
      var code = (codeInput && codeInput.value || '').trim();
      if (!/^\d{6}$/.test(code)) { setMsg('Enter the 6-digit code.', 'err'); return; }
      confirmBtn.disabled = true; setMsg('Verifying…');
      fetch(API + 'verify-otp', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ challenge: challenge, code: code }) })
        .then(readJson)
        .then(function (res) {
          confirmBtn.disabled = false;
          if (res.ok && res.j && res.j.verified) {
            verified = true; if (tokenField) tokenField.value = res.j.verified;
            box.classList.add('is-verified');
            /* Confirm turns green only now, as the success indicator */
            confirmBtn.classList.remove('btn--ghost'); confirmBtn.classList.add('btn--signal');
            confirmBtn.textContent = 'Verified ✓'; confirmBtn.disabled = true;
            if (email) email.readOnly = true; setMsg('Email verified.', 'ok'); lockSubmit();
          } else {
            setMsg((res.j && res.j.error) || 'Incorrect or expired code.', 'err');
          }
        })
        .catch(function () { confirmBtn.disabled = false; setMsg('Verification failed. Try again.', 'err'); });
    });

    // Hard guard: block submit until verified, running before the form's own submit handler.
    form.addEventListener('submit', function (ev) {
      if (!verified) { ev.preventDefault(); ev.stopImmediatePropagation(); setMsg('Please verify your email before submitting.', 'err'); if (sendBtn && sendBtn.hidden === false) sendBtn.focus(); }
    }, true);
  });
})();
