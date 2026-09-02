/* Brand Marketian — hero flowing-colour background.
   A lightweight real-time canvas animation behind the hero: three soft
   colour fields drift and blend like slow-moving liquid. Reads as a video
   loop without shipping a video file. No dependencies.

   - Only mounts above 640px (phones keep the cheaper CSS blobs).
   - Freezes for prefers-reduced-motion and while the tab is hidden.
   - Sits behind the hero content; the hero copy stays fully readable. */
(function () {
  'use strict';

  function boot() {
    var host = document.querySelector('.bm-hero-bg');
    if (!host || host.__flow) return;
    if (window.innerWidth < 641) return;
    var mq = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mq && mq.matches) return;
    host.__flow = true;

    var css = getComputedStyle(document.documentElement);
    function tok(name, fallback) {
      var v = css.getPropertyValue(name).trim();
      return v || fallback;
    }
    // brand hues (kept cool + calm)
    var blobs = [
      { color: tok('--color-accent-2', '#1b3bd8'), r: 0.55, ax: 0.14, ay: 0.10, px: 0.22, py: 0.24, sx: 0.11, sy: 0.09, a: 0.16 },
      { color: tok('--bm-teal', '#0e7c86'), r: 0.50, ax: 0.18, ay: 0.13, px: 0.72, py: 0.30, sx: 0.08, sy: 0.13, a: 0.14 },
      { color: tok('--bm-plum', '#6b21a8'), r: 0.48, ax: 0.12, ay: 0.16, px: 0.50, py: 0.68, sx: 0.10, sy: 0.07, a: 0.10 }
    ];

    var canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:0;pointer-events:none;filter:blur(52px)';
    host.insertBefore(canvas, host.firstChild);
    // make sure hero content stays above the canvas
    for (var i = 0; i < host.children.length; i++) {
      var el = host.children[i];
      if (el !== canvas && getComputedStyle(el).position === 'static') el.style.position = 'relative';
      if (el !== canvas) el.style.zIndex = el.style.zIndex || '1';
    }

    var ctx = canvas.getContext('2d');
    var W = 0, H = 0, DPR = Math.min(window.devicePixelRatio || 1, 1.5);
    function resize() {
      var b = host.getBoundingClientRect();
      W = Math.max(1, Math.round(b.width));
      H = Math.max(1, Math.round(b.height));
      canvas.width = Math.round(W * DPR);
      canvas.height = Math.round(H * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    resize();
    var ro = ('ResizeObserver' in window) ? new ResizeObserver(resize) : null;
    if (ro) ro.observe(host); else window.addEventListener('resize', resize);

    function hexToRgb(h) {
      h = h.replace('#', '');
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      var n = parseInt(h, 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    blobs.forEach(function (b) { b.rgb = hexToRgb(b.color); });

    var running = true;
    document.addEventListener('visibilitychange', function () {
      running = !document.hidden;
      if (running) requestAnimationFrame(frame);
    });

    var t0 = performance.now();
    function frame(now) {
      if (!running) return;
      var t = (now - t0) / 1000;
      ctx.clearRect(0, 0, W, H);
      var maxR = Math.max(W, H);
      for (var k = 0; k < blobs.length; k++) {
        var b = blobs[k];
        var cx = (b.px + Math.sin(t * b.sx + k) * b.ax) * W;
        var cy = (b.py + Math.cos(t * b.sy + k * 1.7) * b.ay) * H;
        var rad = b.r * maxR;
        var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
        var c = b.rgb;
        g.addColorStop(0, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + b.a + ')');
        g.addColorStop(1, 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, rad, 0, Math.PI * 2);
        ctx.fill();
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 150); });
  } else {
    setTimeout(boot, 150);
  }
})();
