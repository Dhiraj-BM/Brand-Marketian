/* Brand Marketian — mobile UX enhancements (added Aug 2026)
   Non-invasive: runs after the design-canvas runtime finishes rendering.
   Adds (1) a hamburger menu on phones, (2) swipe gestures on the hero
   carousel and the client-stories slider, (3) touch active-state polish.
   Every feature is optional and no-ops if its target is not on the page. */
(function () {
  'use strict';

  /* wait until an element the renderer creates asynchronously exists */
  function waitFor(test, cb, tries) {
    tries = tries == null ? 45 : tries;
    (function loop(n) {
      var el = test();
      if (el) { cb(el); return; }
      if (n <= 0) return;
      setTimeout(function () { loop(n - 1); }, 120);
    })(tries);
  }

  /* ---------- 1. Hamburger navigation ---------- */
  function initNav() {
    waitFor(function () { return document.querySelector('header nav'); }, function (nav) {
      var header = nav.closest('header');
      if (!header || header.querySelector('.bm-hamburger')) return;
      var bar = nav.parentElement;
      var actions = nav.nextElementSibling;
      if (actions) actions.classList.add('bm-bar-actions');

      var btn = document.createElement('button');
      btn.className = 'bm-hamburger';
      btn.setAttribute('aria-label', 'Open menu');
      btn.setAttribute('aria-expanded', 'false');
      btn.innerHTML = '<span></span><span></span><span></span>';

      var panel = document.createElement('nav');
      panel.className = 'bm-mobile-menu';
      panel.setAttribute('aria-label', 'Mobile');
      nav.querySelectorAll('a').forEach(function (a) {
        var l = document.createElement('a');
        l.href = a.getAttribute('href');
        l.textContent = (a.textContent || '').trim();
        panel.appendChild(l);
      });
      var cta = document.createElement('a');
      cta.href = 'contact.html';
      cta.className = 'bm-mobile-cta';
      cta.textContent = 'Book a free audit';
      panel.appendChild(cta);

      header.appendChild(panel);
      bar.appendChild(btn);

      function close() {
        document.body.classList.remove('bm-menu-open');
        btn.setAttribute('aria-expanded', 'false');
      }
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var open = document.body.classList.toggle('bm-menu-open');
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      panel.addEventListener('click', function (e) { if (e.target.tagName === 'A') close(); });
      document.addEventListener('click', function (e) {
        if (document.body.classList.contains('bm-menu-open') &&
            !panel.contains(e.target) && !btn.contains(e.target)) close();
      });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
      window.addEventListener('resize', function () { if (window.innerWidth > 760) close(); });
    });
  }

  /* ---------- 2. Swipe helper ---------- */
  function addSwipe(el, onLeft, onRight) {
    if (!el || el.__bmSwipe) return;
    el.__bmSwipe = true;
    var x0 = null, y0 = null, t0 = 0;
    el.addEventListener('touchstart', function (e) {
      var t = e.changedTouches[0]; x0 = t.clientX; y0 = t.clientY; t0 = Date.now();
    }, { passive: true });
    el.addEventListener('touchend', function (e) {
      if (x0 == null) return;
      var t = e.changedTouches[0], dx = t.clientX - x0, dy = t.clientY - y0;
      if (Date.now() - t0 < 800 && Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        (dx < 0 ? onLeft : onRight)();
      }
      x0 = y0 = null;
    }, { passive: true });
  }

  /* hero carousel: swipe cycles the existing slide dots */
  function initHeroSwipe() {
    waitFor(function () {
      var d = document.querySelectorAll(
        'button[aria-label="Growth dashboard"],button[aria-label="Brand visibility"],button[aria-label="Channels"]');
      return d.length >= 2 ? d : null;
    }, function (list) {
      var dots = Array.prototype.slice.call(list);
      var container = dots[0].closest('div[style*="height: 432px"]') || dots[0].parentElement.parentElement;
      function active() { var i = 0; dots.forEach(function (d, k) { if (d.getBoundingClientRect().width > 14) i = k; }); return i; }
      function go(n) { var i = ((active() + n) % dots.length + dots.length) % dots.length; dots[i].click(); }
      addSwipe(container, function () { go(1); }, function () { go(-1); });
    });
  }

  /* client stories: swipe fires the existing prev / next buttons */
  function initStorySwipe() {
    waitFor(function () {
      var p = document.querySelector('button[aria-label="Previous story"]');
      var n = document.querySelector('button[aria-label="Next story"]');
      return (p && n) ? [p, n] : null;
    }, function (pn) {
      var span2 = document.querySelector('[style*="grid-column: span 2"]');
      var target = span2 ? span2.parentElement : pn[0].closest('section');
      addSwipe(target, function () { pn[1].click(); }, function () { pn[0].click(); });
    });
  }

  /* ---------- 4. Footer lead-capture form ----------
     The static build strips the design-canvas runtime that used to own this
     form's submit handler (see prerender/build.mjs: it deletes every
     <script type="text/x-dc"> block). This form appears on every page, so
     re-wire it here rather than per-page. No-ops if the fields aren't on
     the page, or if it's already wired (fires once per page load). */
  function apiBase() {
    var m = document.querySelector('meta[name="bm-api"]');
    return ((m && m.getAttribute('content')) || window.BM_API || 'https://brand-marketian-api.onrender.com').replace(/\/$/, '');
  }
  function initFooterForm() {
    var nameEl = document.getElementById('bmf_name');
    if (!nameEl || nameEl.__bmWired) return;
    var card = nameEl.closest('div[style*="neutral-800"]');
    var btn = card && card.querySelector('button.btn-primary');
    if (!btn) return;
    nameEl.__bmWired = true;

    var g = function (id) { var el = document.getElementById(id); return el ? String(el.value || '').trim() : ''; };
    var sending = false;
    var label = btn.querySelector('span') || btn;
    btn.addEventListener('click', function () {
      if (sending) return;
      var name = g('bmf_name'), email = g('bmf_email');
      if (!name || !email) { alert('Please add your name and email so we can reply.'); return; }
      sending = true;
      label.textContent = 'Sent, we’ll reply within 48 hrs ✓';
      // keepalive lets the request finish even as we navigate away, so we can
      // redirect instantly without waiting on the API to wake up.
      try {
        fetch(apiBase() + '/api/leads', {
          method: 'POST', keepalive: true,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: name, email: email, phone: g('bmf_phone'),
            services: [g('bmf_service')].filter(Boolean), budget: g('bmf_budget'),
            message: g('bmf_grow'), page: (location.pathname || '/'), source: 'footer'
          })
        }).catch(function () {});
      } catch (e) {}
      window.location.href = 'thank-you.html';
    });
  }

  function boot() { initNav(); initHeroSwipe(); initStorySwipe(); initFooterForm(); }
  if (document.readyState === 'complete') setTimeout(boot, 300);
  else window.addEventListener('load', function () { setTimeout(boot, 300); });
})();
