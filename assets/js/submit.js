/* NEMI · form submit. Sends contact/careers submissions as JSON (file as base64) to /api/submit-form,
   which stores them in Supabase and emails a notification via Resend. Shows the inline success card. */
(function () {
  var API = '/api/submit-form';
  /* Supabase Storage caps uploads at 50 MB per file on the current plan, and that
     ceiling is enforced server-side whatever we do here. We check first only so
     an oversized file is rejected instantly with a clear message, instead of the
     visitor waiting through a long upload that is going to be refused. */
  var MAX = 50 * 1024 * 1024;
  var MAX_LABEL = '50 MB';
  var MAILTO = 'info@nemilmm.com';

  /* If the backend can't send email yet, fall back to opening the visitor's mail
     client with everything pre-filled, and drop the OTP gate (it needs the backend). */
  fetch('/api/health', { cache: 'no-store' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (h) { if (!h || (!h.email && !h.dev)) enableMailtoMode(h && h.notifyTo); })
    .catch(function () { enableMailtoMode(); });

  function enableMailtoMode(to) {
    var addr = to || MAILTO;
    var cfg = window.NEMI_CONFIG || {};
    /* Supabase Auth handles OTP on its own, so keep verification when it's configured
       even though delivery falls back to mailto. */
    var otpStillWorks = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);
    Array.prototype.forEach.call(document.querySelectorAll('.cform form'), function (form) {
      form.setAttribute('data-mailto', addr);
      var otpBox = form.querySelector('[data-otp]');
      if (otpBox && !otpStillWorks) otpBox.hidden = true;   /* nothing can verify, so drop the gate */
      var submitBtn = form.querySelector('button[type="submit"]');
      if (submitBtn && !otpStillWorks) submitBtn.disabled = false;  /* release the OTP lock */
      var fileField = form.querySelector('input[type="file"]');
      if (fileField) {
        fileField.required = false;
        var note = form.querySelector('.mailto-note');
        if (!note) {
          note = document.createElement('p');
          note.className = 'otp-msg mailto-note';
          note.textContent = 'Your email app will open with the details filled in. Please attach your file there before sending.';
          fileField.parentElement.appendChild(note);
        }
      }
    });
  }

  function sendViaMailto(form, payload) {
    var lines = [];
    if (payload.name) lines.push('Name: ' + payload.name);
    if (payload.email) lines.push('Email: ' + payload.email);
    if (payload.company) lines.push('Company: ' + payload.company);
    if (payload.topic) lines.push('Topic: ' + payload.topic);
    lines.push('', payload.message || '');
    var subject = (payload.form === 'careers' ? 'Application: ' : 'Enquiry: ') + (payload.name || payload.email);
    window.location.href = 'mailto:' + form.getAttribute('data-mailto')
      + '?subject=' + encodeURIComponent(subject)
      + '&body=' + encodeURIComponent(lines.join('\n'));
  }

  Array.prototype.forEach.call(document.querySelectorAll('.cform form'), function (form) {
    var wrap = form.closest('.cform');
    var btn = form.querySelector('button[type="submit"]');
    var status = document.createElement('p');
    status.className = 'form-status';
    status.hidden = true;
    if (btn) btn.insertAdjacentElement('afterend', status);

    function fail(msg) {
      status.textContent = msg;
      status.hidden = false;
      if (btn) { btn.disabled = false; btn.textContent = btn.getAttribute('data-label'); }
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.reportValidity || form.reportValidity()) {
        status.hidden = true;
        if (btn) {
          if (!btn.getAttribute('data-label')) btn.setAttribute('data-label', btn.textContent);
          btn.disabled = true; btn.textContent = 'Sending…';
        }
        var fileInput = form.querySelector('input[type="file"]');
        var file = fileInput && fileInput.files && fileInput.files[0];
        if (file && file.size > MAX) return fail('File is too large. Please keep it under ' + MAX_LABEL + '.');

        var payload = {
          form: form.getAttribute('name') || 'contact',
          name: (form.querySelector('input[name="name"]') || {}).value || '',
          email: (form.querySelector('input[name="email"]') || {}).value || '',
          company: (form.querySelector('input[name="company"]') || {}).value || '',
          topic: (form.querySelector('select[name="topic"]') || {}).value || '',
          message: (form.querySelector('textarea[name="message"]') || {}).value || '',
          email_verified: (form.querySelector('input[name="email_verified"]') || {}).value || ''
        };

        /* Supabase path: store the file in the private bucket, then save the row.
           Nothing depends on a backend of ours. */
        var cfg = window.NEMI_CONFIG || {};
        if (cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY) {
          var SB = cfg.SUPABASE_URL.replace(/\/+$/, '');
          var KEY = cfg.SUPABASE_ANON_KEY;
          var hdrs = { apikey: KEY, Authorization: 'Bearer ' + KEY };

          var storeThenInsert = function (storedPath) {
            return fetch(SB + '/rest/v1/submissions', {
              method: 'POST',
              headers: Object.assign({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }, hdrs),
              body: JSON.stringify({
                form: payload.form, name: payload.name, email: payload.email,
                company: payload.company || null, topic: payload.topic || null,
                message: payload.message, attachment_path: storedPath || null
              })
            }).then(function (r) {
              if (!r.ok) return r.text().then(function (t) { throw new Error('Could not save your submission. Please try again.'); });
              wrap.classList.add('sent');
              wrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
            });
          };

          if (file) {
            var safe = file.name.replace(/[^A-Za-z0-9._-]+/g, '_').slice(-80);
            var path = payload.form + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '-' + safe;
            fetch(SB + '/storage/v1/object/applications/' + path, {
              method: 'POST',
              headers: Object.assign({ 'Content-Type': file.type || 'application/octet-stream' }, hdrs),
              body: file
            })
              .then(function (r) {
                /* Never submit silently without the file the visitor attached:
                   they would see "thanks, your message is in" while we received
                   an enquiry with no drawing and no sign one was ever sent.
                   Stop and say so, so they can retry or send it another way. */
                if (!r.ok) {
                  throw new Error(
                    r.status === 413
                      ? 'That file is too large to upload (limit ' + MAX_LABEL + '). Please send a smaller file.'
                      : 'Your file could not be uploaded, so nothing was sent. Please try again, or email it to us directly.'
                  );
                }
                return storeThenInsert(path);
              })
              .catch(function (err) { fail(err.message || 'Could not send. Please try again.'); });
          } else {
            storeThenInsert(null).catch(function (err) { fail(err.message || 'Could not send. Please try again.'); });
          }
          return;
        }

        if (form.hasAttribute('data-mailto')) {
          sendViaMailto(form, payload);
          wrap.classList.add('sent');
          return;
        }

        var send = function () {
          fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
            .then(function (r) { return r.text().then(function (t) { var j = {}; try { j = JSON.parse(t); } catch (x) {} return { ok: r.ok, j: j }; }); })
            .then(function (res) {
              if (!res.ok || !res.j.ok) return fail((res.j && res.j.error) || 'Could not send. Please try again.');
              wrap.classList.add('sent');
              wrap.scrollIntoView({ behavior: 'smooth', block: 'center' });
            })
            .catch(function () { fail('Could not send. Please check your connection and try again.'); });
        };

        if (file) {
          var reader = new FileReader();
          reader.onload = function () {
            payload.file = { name: file.name, type: file.type || 'application/octet-stream', data: String(reader.result).split(',')[1] || '' };
            send();
          };
          reader.onerror = function () { fail('Could not read the file. Please try again.'); };
          reader.readAsDataURL(file);
        } else {
          send();
        }
      }
    });
  });
})();
