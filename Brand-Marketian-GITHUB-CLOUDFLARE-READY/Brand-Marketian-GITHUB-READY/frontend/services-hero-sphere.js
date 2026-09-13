/*
 * services-hero-sphere.js — enhances the (flat ink) services hero with a WebGL
 * sphere of the ten service-platform icons, on mobile and desktop both.
 *
 * Practical by design, not just decorative:
 * - Responsive: the whole sphere is one THREE.Group, uniformly rescaled and
 *   repositioned per breakpoint (see layoutFor()) so it clears the headline
 *   column and stays inside the camera frustum at any viewport width.
 * - Skips only for prefers-reduced-motion and Save-Data — real accessibility /
 *   bandwidth constraints, not a screen-size guess — those visitors get the
 *   plain hero, unchanged.
 * - Three.js (~150KB) is only fetched once those gates pass — never blocks
 *   first paint, never loads for someone who won't see it move.
 * - Pauses the render loop via IntersectionObserver (hero scrolled away) and
 *   the Page Visibility API (tab hidden), so it never spins unseen.
 * - Fails silently (leaves the flat hero showing) on any WebGL/script-load error.
 */
(function () {
  'use strict';

  var mount = document.getElementById('svcHeroGL');
  if (!mount) return;

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var saveData = !!(navigator.connection && navigator.connection.saveData);
  if (reduced || saveData) return; // real accessibility/bandwidth constraints only

  var canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  // uniform scale + x-offset per breakpoint — one THREE.Group holds core, shell
  // and every icon, so a single scale/position pair repositions all of them.
  // Below 720px the headline's own min font-size already fills the width, so
  // (per .svc-hero-gl's mobile CSS) the sphere isn't an overlay beside the text
  // there any more — it's its own small, centered square below it — hence x:0.
  // 720-960px keeps the overlay but pushes further right / smaller to clear the
  // headline; bleeding off the right edge there is intentional (hero clips via
  // overflow:hidden, same treatment the old flat blob used).
  function layoutFor(w) {
    if (w < 720) return { scale: 0.8, x: 0 };       // phones: standalone block
    if (w < 960) return { scale: 0.42, x: 2.5 };    // tablets / narrow windows
    return { scale: 1, x: 2.9 };                    // desktop
  }

  // the ten platforms this page is about — real badge files already in /assets,
  // same ones used elsewhere on the site (industries.html, footer, etc.)
  var ICON_FILES = [
    'assets/icon-meta.svg',
    'assets/icon-instagram.svg',
    'assets/icon-linkedin.svg',
    'assets/icon-youtube.svg',
    'assets/icon-whatsapp.svg',
    'assets/icon-googleads.svg',
    'assets/icon-googleanalytics.svg',
    'assets/icon-googlesearchconsole.svg',
    'assets/icon-hubspot.svg',
    'assets/icon-shopify.svg'
  ];

  function fibonacciSphere(n, radius) {
    var pts = [], offset = 2 / n, increment = Math.PI * (3 - Math.sqrt(5));
    for (var i = 0; i < n; i++) {
      var y = ((i * offset) - 1) + (offset / 2);
      var r = Math.sqrt(Math.max(0, 1 - y * y));
      var phi = i * increment;
      pts.push({ x: Math.cos(phi) * r * radius, y: y * radius, z: Math.sin(phi) * r * radius });
    }
    return pts;
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function loadIcon(src) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { resolve(null); }; // one missing icon shouldn't break the sphere
      img.src = src;
    });
  }

  // Redraws a flat colour-rect + white-glyph badge as ONE glass tile — no
  // duplicate layer, and this time genuinely translucent: the "glass" pixels
  // get their ALPHA reduced (not just their colour paled), so the sprite's
  // real transparency lets the sphere/wireframe behind actually show through
  // at render time — a live effect, not a pre-baked tint. The glyph is kept
  // separate on its own layer, given a diagonal light/dark bevel (an emboss,
  // faking the 3D relief in the reference) and a soft blurred contact shadow
  // it casts onto the glass beneath it, so it reads as sitting above the glass.
  var ICON_ART = 116;
  var ICON_PAD = 27;
  var ICON_TEXTURE_SIZE = ICON_ART + ICON_PAD * 2;
  function buildIconTexture(img) {
    var art = ICON_ART, pad = ICON_PAD, size = ICON_TEXTURE_SIZE;

    var raw = document.createElement('canvas');
    raw.width = raw.height = art;
    var rctx = raw.getContext('2d');
    rctx.drawImage(img, 0, 0, art, art);
    var data = rctx.getImageData(0, 0, art, art);
    var px = data.data;

    // sample the badge's own brand colour from a safe spot: top-center strip,
    // above every glyph's inset and outside the rounded corners
    var sx = Math.floor(art * 0.5), sy = Math.floor(art * 0.06);
    var sIdx = (sy * art + sx) * 4;
    var brand = { r: px[sIdx], g: px[sIdx + 1], b: px[sIdx + 2] };
    var glassTint = {
      r: Math.round(brand.r + (255 - brand.r) * 0.3),
      g: Math.round(brand.g + (255 - brand.g) * 0.3),
      b: Math.round(brand.b + (255 - brand.b) * 0.3)
    };

    // split into two layers: GLASS (tinted, low alpha — real transparency)
    // and GLYPH (full brand colour, full alpha), by how white each pixel is
    var glassData = rctx.createImageData(art, art);
    var glyphData = rctx.createImageData(art, art);
    var gpx = glassData.data, ypx = glyphData.data;
    for (var i = 0; i < px.length; i += 4) {
      var a = px[i + 3];
      if (a === 0) continue; // transparent corner on both layers
      var minC = Math.min(px[i], px[i + 1], px[i + 2]);
      var t = Math.max(0, Math.min(1, (minC - 175) / 70)); // 0=rect, 1=glyph
      gpx[i] = glassTint.r; gpx[i + 1] = glassTint.g; gpx[i + 2] = glassTint.b;
      gpx[i + 3] = Math.round(a * (1 - t) * 0.58); // this is the actual "see-through"
      ypx[i] = brand.r; ypx[i + 1] = brand.g; ypx[i + 2] = brand.b;
      ypx[i + 3] = Math.round(a * t);
    }
    var glassCanvas = document.createElement('canvas');
    glassCanvas.width = glassCanvas.height = art;
    glassCanvas.getContext('2d').putImageData(glassData, 0, 0);

    var glyphCanvas = document.createElement('canvas');
    glyphCanvas.width = glyphCanvas.height = art;
    var gctx = glyphCanvas.getContext('2d');
    gctx.putImageData(glyphData, 0, 0);
    // emboss: a diagonal light-to-dark bevel, clipped to the glyph's own alpha
    gctx.save();
    gctx.globalCompositeOperation = 'source-atop';
    var bevel = gctx.createLinearGradient(0, 0, art, art);
    bevel.addColorStop(0, 'rgba(255,255,255,.5)');
    bevel.addColorStop(.5, 'rgba(255,255,255,0)');
    bevel.addColorStop(1, 'rgba(0,0,0,.4)');
    gctx.fillStyle = bevel;
    gctx.fillRect(0, 0, art, art);
    gctx.restore();

    var c = document.createElement('canvas');
    c.width = c.height = size;
    var ctx = c.getContext('2d');

    // the glass chip itself — soft outer shadow, real per-pixel transparency
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.4)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 7;
    ctx.drawImage(glassCanvas, pad, pad, art, art);
    ctx.restore();

    // the contact shadow the glyph casts onto the glass beneath it
    ctx.save();
    try { ctx.filter = 'blur(3px)'; } catch (e) {}
    ctx.globalAlpha = 0.35;
    ctx.drawImage(glyphCanvas, pad + 2, pad + 3, art, art);
    ctx.restore();

    // the glyph, crisp, on top
    ctx.drawImage(glyphCanvas, pad, pad, art, art);

    // overall glossy sheen across glass + glyph, clipped via 'source-atop'
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    var glow = ctx.createRadialGradient(size * .32, size * .28, 0, size * .32, size * .28, size * .66);
    glow.addColorStop(0, 'rgba(255,255,255,.55)');
    glow.addColorStop(.45, 'rgba(255,255,255,.12)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, size, size);
    ctx.restore();

    return c;
  }

  function init(THREE, icons) {
    var w = mount.clientWidth, h = mount.clientHeight;
    if (!w || !h) return;

    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    } catch (e) { return; } // leave the CSS blob showing
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(w, h);
    mount.appendChild(renderer.domElement);

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(42, w / h, 0.1, 100);
    camera.position.set(0, 0, 7);

    scene.add(new THREE.AmbientLight(0x2a2440, 1.1));
    var key = new THREE.PointLight(0xff6600, 2.6, 20); key.position.set(3, 2, 5); scene.add(key);
    var rim = new THREE.PointLight(0x1b3bd8, 1.8, 20); rim.position.set(-3, -1.5, -4); scene.add(rim);

    var group = new THREE.Group();
    group.rotation.set(0.5, -0.4, 0);
    scene.add(group);

    function applyLayout() {
      var layout = layoutFor(window.innerWidth);
      group.scale.setScalar(layout.scale);
      group.position.x = layout.x;
    }
    applyLayout();

    var core = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.6, 1),
      new THREE.MeshStandardMaterial({ color: 0xff6600, roughness: 0.35, metalness: 0.25, flatShading: true })
    );
    group.add(core);

    var shell = new THREE.Mesh(
      new THREE.IcosahedronGeometry(1.95, 1),
      new THREE.MeshBasicMaterial({ color: 0x1b3bd8, wireframe: true, transparent: true, opacity: 0.28 })
    );
    group.add(shell);

    // the tile has padding around the badge art (for the shadow), so the
    // sprite is scaled up by that ratio to keep the badge's own apparent
    // size consistent with the plain-icon baseline
    var spriteScale = 0.56 * (ICON_TEXTURE_SIZE / ICON_ART);
    var positions = fibonacciSphere(icons.length, 1.95);
    icons.forEach(function (img, i) {
      if (!img) return;
      var tex = new THREE.CanvasTexture(buildIconTexture(img));
      // depthWrite:false so the tile's real (now much lower) alpha blends
      // correctly against the wireframe/core behind it instead of occluding
      var sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
      sprite.scale.set(spriteScale, spriteScale, 1);
      sprite.position.set(positions[i].x, positions[i].y, positions[i].z);
      group.add(sprite);
    });

    var target = { x: 0, y: 0 }, current = { x: 0, y: 0 };
    if (canHover) {
      mount.parentElement.addEventListener('mousemove', function (e) {
        var r = mount.getBoundingClientRect();
        target.x = ((e.clientY - r.top) / r.height - 0.5) * 0.6;
        target.y = ((e.clientX - r.left) / r.width - 0.5) * 0.9;
      });
    }

    var running = false, raf = null, lastT = 0;
    function tick(t) {
      var dt = Math.min((t - lastT) / 1000 || 0, 0.05);
      lastT = t;
      group.rotation.y += dt * 0.25;
      current.x += (target.x - current.x) * 0.05;
      current.y += (target.y - current.y) * 0.05;
      group.rotation.x = 0.5 + current.x;
      core.rotation.y -= dt * 0.15;
      shell.rotation.y += dt * 0.08;
      renderer.render(scene, camera);
      if (running) raf = requestAnimationFrame(tick);
    }
    function play() {
      if (running || document.hidden) return;
      running = true; lastT = 0;
      raf = requestAnimationFrame(tick);
    }
    function pause() {
      running = false;
      if (raf) cancelAnimationFrame(raf);
    }

    // only spend GPU/battery while the hero is actually on screen and the tab is visible
    var io = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) play(); else pause();
    }, { threshold: 0.1 });
    io.observe(mount);
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) pause(); else io.takeRecords(); // IO will re-fire play() if still in view
    });

    // render one static frame immediately so there's never a blank gap before the first tick
    renderer.render(scene, camera);
    play();

    window.addEventListener('resize', function () {
      var w2 = mount.clientWidth, h2 = mount.clientHeight;
      if (!w2 || !h2) return;
      camera.aspect = w2 / h2;
      camera.updateProjectionMatrix();
      renderer.setSize(w2, h2);
      applyLayout(); // re-fit scale/position if the viewport crossed a breakpoint
      renderer.render(scene, camera); // repaint immediately so a resize never leaves a stale frame
    });
  }

  function start() {
    Promise.all([
      loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js'),
      Promise.all(ICON_FILES.map(loadIcon))
    ]).then(function (results) {
      if (window.THREE) init(window.THREE, results[1]);
    }).catch(function () { /* Three.js failed to load — CSS blob stands on its own */ });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
