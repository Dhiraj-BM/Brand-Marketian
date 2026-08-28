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

  function boot() { initNav(); initHeroSwipe(); initStorySwipe(); }
  if (document.readyState === 'complete') setTimeout(boot, 300);
  else window.addEventListener('load', function () { setTimeout(boot, 300); });
})();
