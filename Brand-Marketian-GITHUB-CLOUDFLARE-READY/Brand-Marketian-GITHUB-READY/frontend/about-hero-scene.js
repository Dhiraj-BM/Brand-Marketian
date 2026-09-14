/*
 * about-hero-scene.js — the About page hero: a small WebGL cluster of
 * low-poly gems in the brand palette, replacing the old static stock photo.
 * The idea is literal — "we build brands from scratch, piece by piece" — a
 * loose constellation of shapes that slowly assembles/rotates rather than a
 * single spinning logo.
 *
 * Interactive, not just decorative:
 * - Mouse parallax: the whole cluster tilts toward the cursor while it's
 *   over the hero tile.
 * - Click/tap: gives the cluster a small random spin "kick" that decays —
 *   a discoverable, low-stakes way to invite interaction.
 * - Pauses via IntersectionObserver (scrolled away) and the Page Visibility
 *   API (tab hidden).
 *
 * Safety: no WebGL, prefers-reduced-motion, or Save-Data -> this file no-ops
 * and the CSS gradient placeholder already on the container stands alone.
 */
(function () {
  'use strict';

  var mount = document.getElementById('aboutHeroGL');
  if (!mount) return;

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var saveData = !!(navigator.connection && navigator.connection.saveData);
  if (reduced || saveData) return;

  var coarse = (window.matchMedia && window.matchMedia('(pointer:coarse)').matches) ||
               (window.innerWidth < 760) || ((navigator.hardwareConcurrency || 8) <= 4);

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function init(THREE) {
    var w = mount.clientWidth, h = mount.clientHeight;
    if (!w || !h) return;

    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    } catch (e) { return; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2));
    renderer.setSize(w, h);
    renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    mount.insertBefore(renderer.domElement, mount.firstChild);

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    camera.position.set(0, 0, 6.5);

    scene.add(new THREE.AmbientLight(0x2a2440, 1.15));
    var warm = new THREE.PointLight(0xff6600, 2.2, 20); warm.position.set(3, 2, 5); scene.add(warm);
    var cool = new THREE.PointLight(0x1b3bd8, 1.6, 20); cool.position.set(-3, -1.5, -3); scene.add(cool);

    var group = new THREE.Group();
    scene.add(group);

    // brand palette gems, loosely clustered (not a tidy grid — "assembling")
    var GEMS = [
      { r: 0.62, x: -0.55, y: 0.18, z: 0.1, color: 0xff6600 },   // accent orange
      { r: 0.46, x: 0.5, y: 0.42, z: -0.3, color: 0x1b3bd8 },    // accent-2 cobalt
      { r: 0.5, x: 0.15, y: -0.5, z: 0.25, color: 0x0e9488 },    // teal
      { r: 0.36, x: 0.75, y: -0.28, z: -0.1, color: 0x6b21a8 },  // plum
      { r: 0.3, x: -0.65, y: -0.45, z: 0.35, color: 0xf4a300 }   // amber
    ];
    var meshes = GEMS.map(function (g) {
      var mesh = new THREE.Mesh(
        new THREE.IcosahedronGeometry(g.r, coarse ? 0 : 1),
        new THREE.MeshStandardMaterial({ color: g.color, roughness: 0.35, metalness: 0.22, flatShading: true })
      );
      mesh.position.set(g.x, g.y, g.z);
      mesh.userData.spin = 0.15 + Math.random() * 0.2;
      mesh.userData.axis = new THREE.Vector3(Math.random() - 0.5, 1, Math.random() - 0.5).normalize();
      group.add(mesh);
      return mesh;
    });
    group.scale.setScalar(coarse ? 0.85 : 1);

    function resize() {
      var w2 = mount.clientWidth, h2 = mount.clientHeight;
      if (!w2 || !h2) return;
      camera.aspect = w2 / h2;
      camera.updateProjectionMatrix();
      renderer.setSize(w2, h2);
    }
    window.addEventListener('resize', resize, { passive: true });
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(mount);

    /* ---- interaction: pointer parallax + click "kick" ---- */
    var ptrTgt = { x: 0, y: 0 }, ptr = { x: 0, y: 0 };
    var kick = 0, kickTgt = 0;
    if (!coarse) {
      mount.addEventListener('pointermove', function (e) {
        var r = mount.getBoundingClientRect();
        ptrTgt.x = ((e.clientY - r.top) / r.height - 0.5) * 0.5;
        ptrTgt.y = ((e.clientX - r.left) / r.width - 0.5) * 0.7;
      });
      mount.addEventListener('pointerleave', function () { ptrTgt.x = 0; ptrTgt.y = 0; });
    }
    mount.addEventListener('click', function () {
      kickTgt += 1.6; // one impulse per click, decays in the render loop
      mount.style.cursor = 'pointer';
    });
    mount.style.cursor = coarse ? 'default' : 'grab';

    var visible = true;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        visible = es[0].isIntersecting;
        if (visible) requestAnimationFrame(frame);
      }, { threshold: 0.1 }).observe(mount);
    }

    var running = false, raf = null, last = 0;
    function frame(now) {
      if (document.hidden || !visible) { running = false; return; }
      running = true;
      if (!last) last = now;
      var dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      ptr.x += (ptrTgt.x - ptr.x) * 0.06;
      ptr.y += (ptrTgt.y - ptr.y) * 0.06;
      kick += (kickTgt - kick) * 0.08;
      kickTgt *= 0.9; // impulse fades back toward 0

      group.rotation.y = ptr.y + now * 0.00012 + kick * 0.3;
      group.rotation.x = ptr.x * 0.6;

      meshes.forEach(function (m) {
        m.rotateOnAxis(m.userData.axis, m.userData.spin * dt + kick * dt * 0.6);
      });

      renderer.render(scene, camera);
      raf = requestAnimationFrame(frame);
    }
    renderer.render(scene, camera); // first static frame, no gap before motion
    requestAnimationFrame(frame);

    document.addEventListener('visibilitychange', function () {
      if (!document.hidden && visible && !running) requestAnimationFrame(frame);
    });
  }

  function start() {
    loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js')
      .then(function () { if (window.THREE) init(window.THREE); })
      .catch(function () { /* WebGL/script failure -> gradient placeholder stands alone */ });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
