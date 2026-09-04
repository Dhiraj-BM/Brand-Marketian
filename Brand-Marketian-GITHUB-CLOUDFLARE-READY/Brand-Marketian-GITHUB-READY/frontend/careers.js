/* Brand Marketian — careers page: wire up "Tell us about yourself".

   The static build strips the design-canvas runtime that used to own this
   page's interactivity (see prerender/build.mjs). Unlike the contact form,
   this application form never had a real submit handler even in the
   original source — the "Drop a PDF here" line was caption text only, with
   no <input type="file"> anywhere. This adds one, wires drag-and-drop, and
   posts a real multipart request matching server/src/routes/public.js
   (POST /api/applications, resume field name "resume"). No-ops if the
   expected markup isn't on the page. */
(function () {
  'use strict';
  if (window.__bmCareersInit) return;
  window.__bmCareersInit = true;

  function apiBase() {
    var m = document.querySelector('meta[name="bm-api"]');
    return ((m && m.getAttribute('content')) || window.BM_API || 'https://brand-marketian-api.onrender.com').replace(/\/$/, '');
  }

  var submitBtn = Array.prototype.slice.call(document.querySelectorAll('button.btn-primary'))
    .filter(function (b) { return /submit application/i.test(b.textContent || ''); })[0];
  var card = submitBtn && submitBtn.closest('.card');
  if (!card) return; // not this page, or markup changed — stay safe

  var inputs = card.querySelectorAll('input.input'); // order: name, phone, email, portfolio
  var nameEl = inputs[0], phoneEl = inputs[1], emailEl = inputs[2], portfolioEl = inputs[3];
  var textarea = card.querySelector('textarea.input');
  var kicker = card.querySelector('.card-kicker');

  // The résumé dropzone is the element right after the "Résumé" label —
  // find it by label text rather than a class, since it has none of its own.
  var dropzone = null;
  Array.prototype.forEach.call(card.querySelectorAll('.field label'), function (l) {
    if (/r.sum.$/i.test((l.textContent || '').trim())) dropzone = l.nextElementSibling;
  });

  var fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.pdf,application/pdf';
  fileInput.style.display = 'none';
  document.body.appendChild(fileInput);

  var selectedFile = null;
  function showFile(f) {
    selectedFile = f;
    if (dropzone) dropzone.textContent = f.name + ' — ready to send';
  }

  if (dropzone) {
    dropzone.style.cursor = 'pointer';
    dropzone.addEventListener('click', function () { fileInput.click(); });
    dropzone.addEventListener('dragover', function (e) { e.preventDefault(); dropzone.style.borderColor = 'var(--color-accent)'; });
    dropzone.addEventListener('dragleave', function () { dropzone.style.borderColor = ''; });
    dropzone.addEventListener('drop', function (e) {
      e.preventDefault();
      dropzone.style.borderColor = '';
      var f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) showFile(f);
    });
  }
  fileInput.addEventListener('change', function () {
    if (fileInput.files && fileInput.files[0]) showFile(fileInput.files[0]);
  });

  var sending = false;
  var originalLabel = submitBtn.textContent;
  submitBtn.addEventListener('click', function () {
    if (sending) return;
    var name = nameEl ? nameEl.value.trim() : '';
    var email = emailEl ? emailEl.value.trim() : '';
    if (!name || !email) { alert('Please add your name and email so we can follow up.'); return; }
    sending = true;
    submitBtn.textContent = 'Submitting…';

    var fd = new FormData();
    fd.append('name', name);
    fd.append('email', email);
    if (phoneEl) fd.append('phone', phoneEl.value.trim());
    if (portfolioEl) fd.append('portfolio', portfolioEl.value.trim());
    if (textarea) fd.append('why', textarea.value.trim());
    var roleTitle = kicker ? (kicker.textContent || '').replace(/^Application\s*\W*/, '').trim() : '';
    if (roleTitle) fd.append('roleTitle', roleTitle);
    if (selectedFile) fd.append('resume', selectedFile);

    // A file upload can take real time and can genuinely fail, unlike the
    // small JSON lead payloads elsewhere — wait for a real response instead
    // of the optimistic keepalive-and-redirect pattern used for those.
    fetch(apiBase() + '/api/applications', { method: 'POST', body: fd })
      .then(function (res) {
        if (!res.ok) throw new Error('http ' + res.status);
        window.location.href = 'thank-you.html';
      })
      .catch(function () {
        sending = false;
        submitBtn.textContent = originalLabel;
        alert('Something went wrong sending your application — please email your résumé to growth@brandmarketian.com instead.');
      });
  });
})();
