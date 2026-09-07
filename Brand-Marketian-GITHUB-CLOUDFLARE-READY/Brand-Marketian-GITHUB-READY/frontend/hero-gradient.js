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

    /* ---- the glow: a circle of warm light whose centre is pinned to the
       cursor, tracing a continuous orbit that spins faster the faster you move ---- */
    var homeX = 78, homeY = 16;          // rest position, % of the hero box
    var tgtX = homeX, tgtY = homeY;      // where the orbit centre wants to be
    var curX = homeX, curY = homeY;      // eased centre (only lags on the way home)
    var phase = Math.random() * Math.PI * 2;
    var ORBIT_RX = 6.5, ORBIT_RY = 5.2;  // orbit radius, %
    var IDLE_SPEED = 0.028, MAX_SPEED = 0.42;  // always-visible circular drift (~one lap every ~3.7s)
    var HOME_EASE = 0.08;

    var lastX = null, lastY = null, lastT = 0, active = false;
    var vel = 0, spin = IDLE_SPEED;

    if (window.matchMedia && window.matchMedia('(pointer:fine)').matches) {
      hero.addEventListener('pointermove', function (e) {
        var b = hero.getBoundingClientRect();
        var now = (window.performance && performance.now()) || Date.now();
        var nx = ((e.clientX - b.left) / b.width) * 100;
        var ny = ((e.clientY - b.top) / b.height) * 100;
        if (lastX !== null) {
          var dt = Math.max(now - lastT, 8);
          var d = Math.sqrt((e.clientX - lastX) * (e.clientX - lastX) + (e.clientY - lastY) * (e.clientY - lastY));
          vel = vel * 0.65 + (d / dt) * 0.35;
        }
        lastX = e.clientX; lastY = e.clientY; lastT = now;
        tgtX = curX = nx; tgtY = curY = ny;   // no lag while the pointer is live
        active = true;
      });
      hero.addEventListener('pointerleave', function () {
        tgtX = homeX; tgtY = homeY; vel = 0; lastX = null; active = false;
      });
    }

    function frame() {
      var targetSpin = Math.min(IDLE_SPEED + vel * 0.20, MAX_SPEED);
      spin += (targetSpin - spin) * 0.14;
      phase += spin;
      vel *= 0.88;

      if (!active) {
        curX += (tgtX - curX) * HOME_EASE;
        curY += (tgtY - curY) * HOME_EASE;
      }

      var ox = Math.cos(phase) * ORBIT_RX;
      var oy = Math.sin(phase) * ORBIT_RY;
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
