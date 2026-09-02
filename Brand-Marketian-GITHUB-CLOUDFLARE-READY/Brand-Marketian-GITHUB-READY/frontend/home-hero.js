/* Brand Marketian — homepage hero carousel.
   The site is now pre-rendered to static HTML, so the design-canvas runtime that
   used to auto-rotate the three hero panels is gone. This restores that:
   auto-advance every ~4.2s, pause on hover, click a dot to jump. Swipe is handled
   by enhance.js (it drives the same dots). No-ops if the hero is not on the page
   or the visitor prefers reduced motion. */
(function () {
  'use strict';

  function boot() {
    var dots = Array.prototype.slice.call(document.querySelectorAll(
      'button[aria-label="Growth dashboard"],button[aria-label="Brand visibility"],button[aria-label="Channels"]'));
    if (dots.length < 2) return;

    var dotWrap = dots[0].parentElement;
    var stage = dotWrap && dotWrap.parentElement;
    if (!stage || stage.__bmHeroRotator) return;
    stage.__bmHeroRotator = true;

    var slides = Array.prototype.slice.call(stage.children).filter(function (el) {
      return el !== dotWrap;
    });
    if (slides.length < 2) return;

    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var ACCENT = 'var(--color-accent)';
    var DIM = 'color-mix(in srgb, var(--color-text) 20%, transparent)';
    var cur = 0, paused = false, timer = null;

    function render() {
      slides.forEach(function (el, i) {
        var on = i === cur;
        var offset = (i - cur + slides.length) % slides.length;
        el.style.opacity = on ? '1' : '0';
        el.style.transform = on
          ? 'translateY(0) scale(1)'
          : 'translateY(' + (offset === 1 ? 18 : -18) + 'px) scale(.97)';
        el.style.pointerEvents = on ? 'auto' : 'none';
        el.style.zIndex = on ? '3' : '1';
      });
      dots.forEach(function (d, i) {
        d.style.width = i === cur ? '26px' : '8px';
        d.style.background = i === cur ? ACCENT : DIM;
      });
    }
    function go(n) {
      cur = ((n % slides.length) + slides.length) % slides.length;
      render();
    }
    function start() {
      if (reduce) return;
      stop();
      timer = setInterval(function () { if (!paused) go(cur + 1); }, 4200);
    }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }

    dots.forEach(function (d, i) {
      d.addEventListener('click', function () { go(i); start(); });
    });
    stage.addEventListener('mouseenter', function () { paused = true; });
    stage.addEventListener('mouseleave', function () { paused = false; });

    render();
    start();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 200); });
  } else {
    setTimeout(boot, 200);
  }
})();
