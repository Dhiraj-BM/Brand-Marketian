(function () {
  'use strict';
  var d = document, root = d.documentElement;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canIO = 'IntersectionObserver' in window;
  var motion = canIO && !reduce;
  if (motion) root.classList.add('hm-js');
  function $(s, c) { return (c || d).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || d).querySelectorAll(s)); }

  // this page owns its reveals; keep the site-wide motion.js from double-animating these sections
  $$('.hm section').forEach(function (s) { s.__bmScanned = 1; });

  /* reveal once */
  if (motion) {
    var rv = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        rv.unobserve(e.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    $$('.hm-rv,.hm-chain,.hm-mark').forEach(function (el) { rv.observe(el); });
  }

  /* proof numbers count up once */
  function fmt(n, dec) {
    return dec ? n.toFixed(dec) : Math.round(n).toLocaleString('en-IN');
  }
  function countUp(el) {
    var to = parseFloat(el.getAttribute('data-to')), dec = +(el.getAttribute('data-dec') || 0);
    var pre = el.getAttribute('data-pre') || '', suf = el.getAttribute('data-suf') || '';
    var t0 = null, dur = 1100;
    setTimeout(function () { el.textContent = pre + fmt(to, dec) + suf; }, dur + 400);
    requestAnimationFrame(function step(ts) {
      if (t0 === null) t0 = ts;
      var p = Math.min(1, (ts - t0) / dur);
      el.textContent = pre + fmt(to * (1 - Math.pow(1 - p, 3)), dec) + suf;
      if (p < 1) requestAnimationFrame(step);
    });
  }
  if (motion) {
    var co = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        countUp(e.target);
        co.unobserve(e.target);
      });
    }, { threshold: 0.6 });
    $$('.hm-num[data-to]').forEach(function (n) { co.observe(n); });
  }

  /* FAQ: one open at a time */
  var items = $$('.hm-item');
  items.forEach(function (it) {
    var btn = $('.hm-qbtn', it);
    btn.addEventListener('click', function () {
      var willOpen = !it.classList.contains('open');
      items.forEach(function (o) {
        o.classList.remove('open');
        $('.hm-qbtn', o).setAttribute('aria-expanded', 'false');
      });
      if (willOpen) { it.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); }
    });
  });
})();
