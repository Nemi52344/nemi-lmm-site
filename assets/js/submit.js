/* NEMI · form submit. Sends contact/careers submissions as JSON (file as base64) to /api/submit-form,
   which stores them in Supabase and emails a notification via Resend. Shows the inline success card. */
(function () {
  var API = '/api/submit-form';
  var MAX = 4.5 * 1024 * 1024;

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
        if (file && file.size > MAX) return fail('File is too large. Please keep it under 4 MB.');

        var payload = {
          form: form.getAttribute('name') || 'contact',
          name: (form.querySelector('input[name="name"]') || {}).value || '',
          email: (form.querySelector('input[name="email"]') || {}).value || '',
          company: (form.querySelector('input[name="company"]') || {}).value || '',
          topic: (form.querySelector('select[name="topic"]') || {}).value || '',
          message: (form.querySelector('textarea[name="message"]') || {}).value || '',
          email_verified: (form.querySelector('input[name="email_verified"]') || {}).value || ''
        };

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
