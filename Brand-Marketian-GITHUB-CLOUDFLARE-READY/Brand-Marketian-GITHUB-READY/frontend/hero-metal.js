/* Brand Marketian — homepage hero: a live "liquid metal" WebGL surface behind
   the existing hero content. It sits UNDER .bm-hero-glow and the headline /
   dashboard card, so nothing about the hero's copy, cards, data or the
   cursor-tracked warm glow changes — this only replaces the flat dark base
   with a slow-flowing brushed-chrome field tinted toward the brand orange.

   The surface has an "energy" that reads as marketing momentum: it swells on a
   slow compounding curve, quickens + warms when someone hovers the CTAs or the
   growth-dashboard card (intent), and settles when the hero scrolls away. Point
   HERO_METRIC at a real number (this month's qualified leads, say) to make it
   literally data-driven.

   Safety: no WebGL -> this file no-ops and the site is unchanged. Reduced-motion
   -> one still frame. Off-screen -> paused. 30fps cap, DPR capped at 1.75. */
(function () {
  'use strict';
  if (window.__bmHeroMetal) return;
  window.__bmHeroMetal = true;

  var HERO_METRIC = null;   // e.g. set to {value: 128, target: 200} to drive energy from data

  function boot() {
    var hero = document.querySelector('.bm-hero-bg');
    if (!hero) return;

    var gl = null, canvas = document.createElement('canvas');
    canvas.className = 'bm-hero-metal';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;z-index:0';
    try { gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl'); } catch (e) {}
    if (!gl) return;                        // leave the hero exactly as it was

    hero.insertBefore(canvas, hero.firstChild);
    // a dark scrim over the metal (still under the glow + content) keeps the
    // headline / sub-line contrast the hero always had on its left third
    var scrim = document.createElement('div');
    scrim.className = 'bm-hero-metal-scrim';
    scrim.style.cssText = 'position:absolute;inset:0;z-index:0;pointer-events:none;background:' +
      'linear-gradient(92deg,rgba(6,5,4,.72) 0%,rgba(6,5,4,.34) 44%,rgba(6,5,4,0) 72%),' +
      'linear-gradient(0deg,rgba(6,5,4,.55) 0%,rgba(6,5,4,0) 34%)';
    canvas.insertAdjacentElement('afterend', scrim);
    // thin the existing warm glow so the metal reads through it (glow still
    // tracks the cursor and colours the top-right, just less opaque)
    var glow = hero.querySelector('.bm-hero-glow');
    if (glow) { glow.style.opacity = '0.5'; }

    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var FRAG = [
      'precision highp float;',
      'uniform vec2 u_res;uniform float u_time;uniform vec2 u_ptr;uniform float u_ptrAmt;uniform float u_energy;',
      'float hash(vec2 x){return fract(sin(dot(x,vec2(27.17,113.9)))*43758.5453);}',
      'float noise(vec2 x){vec2 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);',
      ' float a=hash(i),b=hash(i+vec2(1,0)),c=hash(i+vec2(0,1)),d=hash(i+vec2(1,1));',
      ' return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);}',
      'float fbm(vec2 x){float s=0.,a=.5;mat2 m=mat2(1.6,1.2,-1.2,1.6);',
      ' for(int i=0;i<6;i++){s+=a*noise(x);x=m*x;a*=.5;}return s;}',
      'void main(){',
      ' vec2 uv=(gl_FragCoord.xy-.5*u_res)/u_res.y;',
      ' float t=u_time*(0.030+0.028*u_energy);',
      ' vec2 q=vec2(fbm(uv*2.1+vec2(0.,t)),fbm(uv*2.1+vec2(5.2,-t)));',
      ' vec2 r=vec2(fbm(uv*2.1+3.4*q+vec2(1.7,9.2)+t),fbm(uv*2.1+3.4*q+vec2(8.3,2.8)-t));',
      ' float pd=length(uv-u_ptr);',
      ' float ripple=sin(pd*20.-u_time*3.)*exp(-pd*4.5)*0.07*u_ptrAmt;',
      ' float h=fbm(uv*2.1+3.8*r)+ripple;',
      ' float e=0.0018;',
      ' float hx=fbm((uv+vec2(e,0.))*2.1+3.8*r), hy=fbm((uv+vec2(0.,e))*2.1+3.8*r);',
      ' vec3 n=normalize(vec3(h-hx,h-hy,e*6.5));',
      ' vec3 L=normalize(vec3(0.5,0.68,0.9)); vec3 V=vec3(0.,0.,1.); vec3 H=normalize(L+V);',
      ' float diff=clamp(dot(n,L),0.,1.);',
      ' float spec=pow(clamp(dot(n,H),0.,1.),95.);',
      ' float fres=pow(1.-clamp(dot(n,V),0.,1.),3.);',
      // palette matched to .bm-hero-glow (#17120e -> #040303, warm #ff7a24 / #ffbe78)
      ' vec3 envLo=vec3(0.016,0.013,0.011);',
      ' vec3 envHi=vec3(0.085,0.066,0.052);',
      ' vec3 sky=mix(envLo,envHi,smoothstep(-.45,.6,n.y));',
      ' vec3 warm=vec3(1.0,0.478,0.14);',
      ' float warmK=0.30+0.55*u_energy;',
      ' vec3 col=sky+diff*vec3(0.06,0.055,0.05);',
      ' col+=warm*fres*(0.26+0.30*u_energy);',
      ' col+=vec3(1.0,0.92,0.83)*spec*(0.42+0.34*u_energy);',
      ' col+=warm*pow(clamp(h*0.6,0.,1.),3.)*warmK*0.5;',
      ' col*=0.70+0.30*smoothstep(0.,1.,h);',
      ' col=pow(col,vec3(0.96));',
      ' gl_FragColor=vec4(col,1.);',
      '}'
    ].join('\n');

    function sh(ty, src) { var s = gl.createShader(ty); gl.shaderSource(s, src); gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : (console.warn(gl.getShaderInfoLog(s)), null); }
    var vs = sh(gl.VERTEX_SHADER, 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}');
    var fs = sh(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) { cleanup(); return; }
    var prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { cleanup(); return; }
    gl.useProgram(prog);

    var b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var lp = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(lp);
    gl.vertexAttribPointer(lp, 2, gl.FLOAT, false, 0, 0);

    var uRes = gl.getUniformLocation(prog, 'u_res'), uTime = gl.getUniformLocation(prog, 'u_time'),
        uPtr = gl.getUniformLocation(prog, 'u_ptr'), uPtrAmt = gl.getUniformLocation(prog, 'u_ptrAmt'),
        uEnergy = gl.getUniformLocation(prog, 'u_energy');

    // this fbm shader is fragment-bound, so cap the pixels we actually render.
    // The field is soft, so a lower internal resolution is invisible once the
    // canvas is stretched to full size by CSS. Phones / low-core devices get a
    // much smaller budget and a stronger scrim (the hero stacks there).
    var coarse = (window.matchMedia && window.matchMedia('(pointer:coarse)').matches) ||
                 (window.innerWidth < 760) || ((navigator.hardwareConcurrency || 8) <= 4);
    var PIXEL_BUDGET = coarse ? 300000 : 1100000;
    var FRAME_MS = coarse ? 42 : 33;                 // ~24fps mobile, ~30fps desktop
    if (coarse) {
      scrim.style.background =
        'linear-gradient(180deg,rgba(6,5,4,.62) 0%,rgba(6,5,4,.30) 46%,rgba(6,5,4,.55) 100%)';
    }
    function resize() {
      var w = Math.max(1, hero.clientWidth), h = Math.max(1, hero.clientHeight);
      var s = Math.min(1, Math.sqrt(PIXEL_BUDGET / (w * h)));
      canvas.width = Math.max(1, Math.round(w * s));
      canvas.height = Math.max(1, Math.round(h * s));
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(uRes, canvas.width, canvas.height);
    }
    window.addEventListener('resize', resize, { passive: true });
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(hero);
    resize();

    /* ---- energy: momentum you can feel ---- */
    var ptr = [0, 0], ptrTgt = [0, 0], ptrAmt = 0, ptrAmtTgt = 0;
    var energy = 0.15, energyTgt = 0.15, intent = 0;
    hero.addEventListener('pointermove', function (e) {
      var r = hero.getBoundingClientRect();
      ptrTgt[0] = ((e.clientX - r.left) / r.width - 0.5) * (r.width / r.height);
      ptrTgt[1] = -((e.clientY - r.top) / r.height - 0.5);
      ptrAmtTgt = 1;
    });
    hero.addEventListener('pointerleave', function () { ptrAmtTgt = 0; });
    // hovering a CTA or the dashboard card = intent -> more energy
    hero.querySelectorAll('a.btn-primary,a.btn-secondary,[class*="dashboard"],[aria-label="Growth dashboard"]')
      .forEach(function (el) {
        el.addEventListener('pointerenter', function () { intent = 1; });
        el.addEventListener('pointerleave', function () { intent = 0; });
      });

    var visible = true;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        visible = es[0].isIntersecting;
        if (visible && !reduce) requestAnimationFrame(frame);
      }, { threshold: 0.02 }).observe(hero);
    }

    var start = (window.performance && performance.now()) || Date.now(), last = 0;
    function frame(now) {
      var tSec = (now - start) / 1000;
      // slow compounding swell 0..1 (ramp, brief hold, gentle release)
      var swell = 0.5 + 0.5 * Math.sin(tSec * 0.05 - 1.2);
      swell = Math.pow(swell, 1.6);
      var metric = HERO_METRIC ? Math.min(1, HERO_METRIC.value / (HERO_METRIC.target || 1)) : 0;
      energyTgt = Math.min(1, 0.12 + 0.5 * swell + 0.42 * intent + 0.35 * metric);

      if (reduce) { energy = energyTgt; ptr[0] = ptrTgt[0]; ptr[1] = ptrTgt[1]; draw(tSec); return; }
      if (!visible) return;
      if (now - last > FRAME_MS) {
        last = now;
        energy += (energyTgt - energy) * 0.03;
        ptr[0] += (ptrTgt[0] - ptr[0]) * 0.08; ptr[1] += (ptrTgt[1] - ptr[1]) * 0.08;
        ptrAmt += (ptrAmtTgt - ptrAmt) * 0.05;
        draw(tSec);
      }
      requestAnimationFrame(frame);
    }
    function draw(tSec) {
      gl.uniform1f(uTime, tSec);
      gl.uniform2f(uPtr, ptr[0], ptr[1]);
      gl.uniform1f(uPtrAmt, ptrAmt);
      gl.uniform1f(uEnergy, energy);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    requestAnimationFrame(frame);

    function cleanup() {
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      if (glow) { glow.style.mixBlendMode = ''; glow.style.opacity = ''; }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 80); });
  } else {
    setTimeout(boot, 80);
  }
})();
