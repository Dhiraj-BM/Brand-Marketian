/* Brand Marketian — homepage hero: warm glow that orbits + tracks the cursor,
   and the shared nav riding transparent over the dark hero until you scroll.
   No-ops on any page without .bm-hero-bg. */
(function () {
  'use strict';

  function boot() {
    var hero = document.querySelector('.bm-hero-bg');
    if (!hero) return;

    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ---- nav: rides transparent while the dark hero is behind it ---- */
    var nav = document.querySelector('header');
    function updateNav() {
      if (!nav) return;
      var navH = nav.offsetHeight || 72;
      var over = hero.getBoundingClientRect().bottom > navH + 4;
      nav.classList.toggle('bm-nav-over', over);
    }
    updateNav();
    window.addEventListener('scroll', updateNav, { passive: true });
    window.addEventListener('resize', updateNav, { passive: true });

    if (reduced) return;

    /* ---- the glow: a warm circle of light. At rest it drifts in a slow visible
       orbit; when the pointer is over the hero the glow centre rides the cursor
       (small wobble), spinning faster the faster the cursor moves. ---- */
    var homeX = 78, homeY = 16;          // rest position, % of the hero box
    var tgtX = homeX, tgtY = homeY;      // where the glow centre wants to be
    var curX = homeX, curY = homeY;      // eased centre
    var phase = Math.random() * Math.PI * 2;
    var IDLE_R = 6.5;                    // orbit radius at rest, %
    var TRACK_R = 2.6;                   // orbit wobble while tracking the cursor, %
    var rad = IDLE_R;                    // eased current radius
    var IDLE_SPEED = 0.028, MAX_SPEED = 0.42;
    var EASE_IN = 0.28;                  // how fast the centre catches the cursor
    var HOME_EASE = 0.06;               // how fast it drifts back to rest

    var lastX = null, lastY = null, lastT = 0, active = false, seenPointer = false;
    var vel = 0, spin = IDLE_SPEED;

    // Listen on the whole window so the cursor is never "lost" to the fixed nav
    // or to any element stacked above the hero.
    function onMove(e) {
      var b = hero.getBoundingClientRect();
      var m = 90;  // px of slack around the hero that still counts as "over" it
      var inside = e.clientX >= b.left - m && e.clientX <= b.right + m &&
                   e.clientY >= b.top - m && e.clientY <= b.bottom + m;
      if (!inside) { active = false; lastX = null; return; }

      var now = (window.performance && performance.now()) || Date.now();
      var nx = ((e.clientX - b.left) / b.width) * 100;
      var ny = ((e.clientY - b.top) / b.height) * 100;
      if (lastX !== null) {
        var dt = Math.max(now - lastT, 8);
        var dx = e.clientX - lastX, dy = e.clientY - lastY;
        vel = vel * 0.6 + (Math.sqrt(dx * dx + dy * dy) / dt) * 0.4;
      }
      lastX = e.clientX; lastY = e.clientY; lastT = now;
      tgtX = nx; tgtY = ny;
      active = true; seenPointer = true;
    }
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('blur', function () { active = false; lastX = null; });

    function frame() {
      var targetSpin = Math.min(IDLE_SPEED + vel * 0.22, MAX_SPEED);
      spin += (targetSpin - spin) * 0.14;
      phase += spin;
      vel *= 0.9;

      if (active) {
        curX += (tgtX - curX) * EASE_IN;
        curY += (tgtY - curY) * EASE_IN;
        rad += (TRACK_R - rad) * 0.1;
      } else {
        tgtX = homeX; tgtY = homeY;
        curX += (tgtX - curX) * HOME_EASE;
        curY += (tgtY - curY) * HOME_EASE;
        rad += (IDLE_R - rad) * 0.05;
      }

      var ox = Math.cos(phase) * rad;
      var oy = Math.sin(phase) * rad;
      var gi = 0.92 + Math.sin(phase * 0.5) * 0.06;
      hero.style.setProperty('--gx', (curX + ox).toFixed(2) + '%');
      hero.style.setProperty('--gy', (curY + oy).toFixed(2) + '%');
      hero.style.setProperty('--gi', gi.toFixed(3));
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 60); });
  } else {
    setTimeout(boot, 60);
  }
})();
