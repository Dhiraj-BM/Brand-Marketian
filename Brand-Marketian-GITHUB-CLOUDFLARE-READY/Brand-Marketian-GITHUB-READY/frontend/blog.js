/* blog.html — topic filter + newsletter signup.
   Runs on the pre-rendered static page (the design-canvas runtime is stripped
   at build time, so this is plain vanilla JS). */
(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(function () {
    // --- topic filter ---
    var tabs = Array.prototype.slice.call(document.querySelectorAll('.bmb-filter[data-filter]'));
    var cards = Array.prototype.slice.call(document.querySelectorAll('.bmb-card[data-cat]'));

    if (tabs.length && cards.length) {
      var apply = function (f) {
        tabs.forEach(function (t) {
          t.classList.toggle('is-active', t.getAttribute('data-filter') === f);
        });
        cards.forEach(function (c) {
          var show = f === 'all' || c.getAttribute('data-cat') === f;
          c.style.display = show ? '' : 'none';
        });
      };
      tabs.forEach(function (t) {
        t.addEventListener('click', function () {
          apply(t.getAttribute('data-filter'));
        });
      });
    }

    // --- newsletter signup ---
    var btn = document.getElementById('bm_sub_btn');
    var email = document.getElementById('bm_sub_email');
    var note = document.getElementById('bm_sub_note');
    if (!btn || !email) return;

    var sent = false;
    btn.addEventListener('click', function () {
      if (sent) return;
      var value = String(email.value || '').trim();
      if (!/^\S+@\S+\.\S+$/.test(value)) {
        if (note) note.textContent = 'Please enter a valid work email.';
        email.focus();
        return;
      }
      sent = true;
      btn.textContent = 'Subscribed ✓';
      btn.disabled = true;
      if (note) note.textContent = 'Thanks — you are on the list.';

      var m = document.querySelector('meta[name="bm-api"]');
      var api = ((m && m.getAttribute('content')) || window.BM_API ||
        'https://brand-marketian-api.onrender.com').replace(/\/$/, '');
      try {
        fetch(api + '/api/newsletter', {
          method: 'POST',
          keepalive: true,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: value, source: 'blog' })
        }).catch(function () {});
      } catch (e) { /* ignore */ }
    });
  });
})();
