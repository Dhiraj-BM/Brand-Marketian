/* Brand Marketian — motion layer.
   One small, dependency-free file loaded on every page (like cms.js). It adds:

     1. scroll-reveal  — content eases up + fades in as it enters the viewport,
                         once, staggered within a group.
     2. count-up       — [data-countup] figures roll from 0 to their value the
                         first time they are seen (the homepage stats already
                         carry this markup but had nothing driving them).

   Safety: the reveal "hidden" state only exists while <html> has .bm-motion,
   which this script adds AFTER confirming JS is running and the visitor has
   not asked for reduced motion. If the script never runs, or a browser has
   no IntersectionObserver, every element stays visible. A 3s failsafe also
   force-reveals anything still hidden. It never fights cms.js or the x-dc
   runtime — it watches for late-injected content and re-scans. */
(function () {
  'use strict';
  if (window.__bmMotion) return;
  window.__bmMotion = true;

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canObserve = 'IntersectionObserver' in window;

  /* ---------------- styles (self-contained) ---------------- */
  var css = [
    'html.bm-motion [data-bm-reveal]{opacity:0;transform:translateY(14px);',
    'transition:opacity .6s cubic-bezier(.22,.9,.28,1),transform .6s cubic-bezier(.22,.9,.28,1)}',
    'html.bm-motion [data-bm-reveal].bm-in{opacity:1;transform:none}',
    '@media (prefers-reduced-motion:reduce){html.bm-motion [data-bm-reveal]{opacity:1!important;transform:none!important;transition:none!important}}'
  ].join('');
  var style = document.createElement('style');
  style.id = 'bm-motion-css';
  style.textContent = css;
  (document.head || document.documentElement).appendChild(style);

  /* ============================================================ count-up */
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function fmtNum(n, decimals, grouped) {
    if (decimals > 0) return n.toFixed(decimals);
    var v = Math.round(n);
    return grouped ? v.toLocaleString('en-IN') : String(v);
  }
  function countUp(el) {
    if (el.__cu) return;                 // shared flag with influencer.js — whichever runs first wins
    el.__cu = 1;
    var target = (el.textContent || '').trim();
    var m = target.match(/^(\D*?)([\d,]+(?:\.\d+)?)(.*)$/);
    if (!m) return;
    var prefix = m[1], numStr = m[2], suffix = m[3];
    var grouped = numStr.indexOf(',') > -1;
    var decimals = (numStr.split('.')[1] || '').length;
    var end = parseFloat(numStr.replace(/,/g, ''));
    if (isNaN(end)) return;
    var dur = 1200, start = null;
    function step(ts) {
      if (start === null) start = ts;
      var p = Math.min(1, (ts - start) / dur);
      el.textContent = prefix + fmtNum(end * easeOut(p), decimals, grouped) + suffix;
      if (p < 1) { requestAnimationFrame(step); }
      else {
        var applied = el.getAttribute('data-cms-applied');
        el.textContent = (applied && applied.length) ? applied : target;
      }
    }
    requestAnimationFrame(step);
  }

  /* ============================================================ reveal targets
     Conservative auto-selection: the leading blocks of each <section> and the
     items inside any grid. Skips the header, the homepage hero carousel, and
     anything a page has opted out with data-bm-reveal="off". */
  function isSkippable(el) {
    if (!el || el.nodeType !== 1) return true;
    var tag = el.tagName;
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT' || tag === 'BR' || tag === 'HR') return true;
    if (el.getAttribute('data-bm-reveal') === 'off') return true;
    if (el.closest('header, nav, .bm-mobile-menu')) return true;
    // homepage hero carousel — leave it to home-hero.js
    if (el.querySelector && el.querySelector('canvas, [aria-label="Growth dashboard"], [aria-label="Brand visibility"]')) return true;
    if (el.getBoundingClientRect) {
      var r = el.getBoundingClientRect();
      if (r.width < 8 || r.height < 8) return true;
    }
    return false;
  }
  function isGrid(el) {
    if (!el || !el.nodeType) return false;
    var s = (el.getAttribute && el.getAttribute('style')) || '';
    if (/display:\s*grid/i.test(s) || /display:\s*flex/i.test(s)) {
      return el.children && el.children.length >= 2 && el.children.length <= 12;
    }
    var cls = el.className || '';
    return typeof cls === 'string' && /grid|cards|ccgrid/.test(cls) && el.children && el.children.length >= 2;
  }

  function collect() {
    var groups = [];
    var sections = document.querySelectorAll('main section, body > section, .wrap section, section');
    for (var i = 0; i < sections.length; i++) {
      var sec = sections[i];
      if (sec.__bmScanned) continue;
      sec.__bmScanned = 1;
      if (sec.closest('header')) continue;

      var kids = [], c = sec.firstElementChild;
      while (c) {
        if (!isSkippable(c)) {
          if (isGrid(c)) {
            var gk = [];
            for (var j = 0; j < c.children.length; j++) {
              if (!isSkippable(c.children[j])) gk.push(c.children[j]);
            }
            if (gk.length) groups.push(gk);
          } else {
            kids.push(c);
          }
        }
        c = c.nextElementSibling;
      }
      if (kids.length) groups.push(kids);
    }
    return groups;
  }

  var io = canObserve ? new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      en.target.classList.add('bm-in');
      io.unobserve(en.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }) : null;

  function arm() {
    // count-up
    document.querySelectorAll('[data-countup]').forEach(function (el) {
      if (el.__cuObserved || el.__cu) return;
      el.__cuObserved = 1;
      if (!io) { countUp(el); return; }
      var one = new IntersectionObserver(function (es) {
        es.forEach(function (e) { if (e.isIntersecting) { countUp(el); one.disconnect(); } });
      }, { threshold: 0.6 });
      one.observe(el);
    });

    if (reduce || !io) return;           // reveal is motion-only

    var groups = collect();
    groups.forEach(function (group) {
      group.forEach(function (el, idx) {
        if (el.__bmReveal) return;
        el.__bmReveal = 1;
        el.setAttribute('data-bm-reveal', '');
        el.style.transitionDelay = Math.min(idx * 70, 420) + 'ms';
        // already on screen at load → reveal on next frame, no scroll needed
        var r = el.getBoundingClientRect();
        if (r.top < (window.innerHeight || 800) * 0.92) {
          requestAnimationFrame(function () { el.classList.add('bm-in'); });
        } else {
          io.observe(el);
        }
      });
    });
  }

  if (!reduce && io) document.documentElement.classList.add('bm-motion');

  function boot() {
    arm();
    // the x-dc runtime / cms.js inject content after load — re-scan a few times
    setTimeout(arm, 700);
    setTimeout(arm, 1800);
    setTimeout(arm, 3400);
    if ('MutationObserver' in window) {
      var mo = new MutationObserver(function () { clearTimeout(boot.__t); boot.__t = setTimeout(arm, 250); });
      mo.observe(document.body, { childList: true, subtree: true });
    }
    // failsafe: nothing stays hidden
    setTimeout(function () {
      document.querySelectorAll('[data-bm-reveal]:not(.bm-in)').forEach(function (el) { el.classList.add('bm-in'); });
    }, 3000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 60); });
  } else {
    setTimeout(boot, 60);
  }
})();
