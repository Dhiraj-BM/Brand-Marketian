/*
 * tilt-cards.js — lightweight, dependency-free 3D tilt-on-hover for any
 * element with a `data-tilt` attribute. CSS perspective + mouse-tracked
 * rotateX/rotateY, plus a cursor-following light sheen overlay. Reusable
 * site-wide (progressive enhancement, same pattern as motion.js): add
 * data-tilt to a card and it just works, no other markup needed.
 *
 * Skips entirely for prefers-reduced-motion and coarse/touch pointers,
 * where a mouse-tracked tilt has no meaningful equivalent.
 */
(function () {
  'use strict';
  if (window.__bmTiltCards) return;
  window.__bmTiltCards = true;

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (reduced || !canHover) return;

  var MAX_DEG = 7;
  var raf = null, pending = null;

  function ensureSheen(el) {
    var sheen = el.querySelector(':scope > .bm-tilt-sheen');
    if (sheen) return sheen;
    sheen = document.createElement('div');
    sheen.className = 'bm-tilt-sheen';
    sheen.style.cssText = 'position:absolute;inset:0;border-radius:inherit;pointer-events:none;' +
      'opacity:0;transition:opacity .25s ease;' +
      'background:radial-gradient(circle at var(--tx,50%) var(--ty,50%),rgba(255,255,255,.35),transparent 45%)';
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    el.style.overflow = el.style.overflow || 'hidden';
    el.appendChild(sheen);
    return sheen;
  }

  function apply(el, e) {
    var r = el.getBoundingClientRect();
    var px = (e.clientX - r.left) / r.width;  // 0..1
    var py = (e.clientY - r.top) / r.height;  // 0..1
    var rx = (0.5 - py) * MAX_DEG * 2;
    var ry = (px - 0.5) * MAX_DEG * 2;
    el.style.transform = 'perspective(800px) rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg) translateZ(4px)';
    var sheen = ensureSheen(el);
    sheen.style.setProperty('--tx', (px * 100).toFixed(1) + '%');
    sheen.style.setProperty('--ty', (py * 100).toFixed(1) + '%');
    sheen.style.opacity = '1';
  }

  function bind(el) {
    if (el.__bmTiltBound) return;
    el.__bmTiltBound = true;
    el.style.transition = el.style.transition ? el.style.transition + ', transform .35s cubic-bezier(.22,.9,.28,1)' : 'transform .35s cubic-bezier(.22,.9,.28,1)';
    el.style.willChange = 'transform';

    el.addEventListener('pointermove', function (e) {
      pending = { el: el, e: e };
      if (raf) return;
      raf = requestAnimationFrame(function () {
        raf = null;
        if (pending) { apply(pending.el, pending.e); pending = null; }
      });
    });
    el.addEventListener('pointerleave', function () {
      el.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg) translateZ(0)';
      var sheen = el.querySelector(':scope > .bm-tilt-sheen');
      if (sheen) sheen.style.opacity = '0';
    });
  }

  function scan() {
    document.querySelectorAll('[data-tilt]').forEach(bind);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scan);
  } else {
    scan();
  }
  // late-injected content (cms.js, x-dc runtime) — a few cheap re-scans, same
  // cadence motion.js already uses for the same reason
  setTimeout(scan, 700);
  setTimeout(scan, 1800);
})();
