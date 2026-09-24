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
    // matches brand.css's own bm-rise keyframe (.7s, same easing, 18-22px rise)
    'html.bm-motion [data-bm-reveal]{opacity:0;transform:translateY(18px);',
    'transition:opacity .7s cubic-bezier(.22,.9,.28,1),transform .7s cubic-bezier(.22,.9,.28,1)}',
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
    if (reduce) { return; }              // reduced motion: leave the figure as authored, no roll-up
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
    // brand.css already animates these itself (bm-rise via animation-timeline; marquees)
    if (el.matches && el.matches('.card, [data-rise], .bm-marquee, .bm-marquee-row, .bm-marquee-row *, .bm-logos, [data-bm-stagger], [data-bm-stagger] > *, .bm-tl, .bm-tl > *')) return true;
    var cs = (el.ownerDocument.defaultView || window).getComputedStyle(el);
    if (cs.animationName && cs.animationName !== 'none') return true;   // element already has its own CSS animation
    // horizontal scroller / carousel track — never override its transform
    if (el.scrollWidth > el.clientWidth * 1.5) return true;
    // homepage hero carousel — leave it to home-hero.js
    if (el.querySelector && el.querySelector('canvas, [aria-label="Growth dashboard"], [aria-label="Brand visibility"]')) return true;
    var r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) return true;
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

  /* ============================================================ client logos
     <div class="bm-logos" data-bm-logos></div> becomes an endless, hover/focus-
     pausable marquee of real client logos. The list is doubled (second copy
     aria-hidden) so the -50% keyframe loops seamlessly; under reduced motion
     brand.css stops the track and wraps it into a static row. */
  var LOGOS = [
    ['haldirams', "Haldiram's", 463, 271], ['fabindia', 'Fabindia', 437, 177], ['bajaj-allianz', 'Bajaj Allianz', 554, 99],
    ['healthkart', 'HealthKart', 538, 166], ['physics-wallah', 'Physics Wallah', 445, 442], ['ajio', 'AJIO', 536, 188],
    ['marks-and-spencer', 'Marks & Spencer', 640, 276], ['acko', 'Acko', 597, 335], ['muscleblaze', 'MuscleBlaze', 447, 447],
    ['libas', 'Libas', 146, 114], ['milton', 'Milton', 225, 225], ['black-berrys', 'Black Berrys', 636, 154],
    ['om-books-international', 'Om Books International', 250, 99], ['fuel-one', 'Fuel One', 640, 147],
    ['divine-home-india', 'Divine Home India', 447, 447], ['the-pet-foundry', 'The Pet Foundry', 399, 399],
    ['community-chulha', 'Community Chulha', 214, 212], ['first-fiddle', 'First Fiddle', 450, 450],
    ['nakul-associates', 'Nakul Associates', 234, 290], ['sri-sai-convention-hall', 'Sri Sai Convention Hall', 640, 117]
  ];
  function buildLogos() {
    document.querySelectorAll('[data-bm-logos]').forEach(function (box) {
      if (box.querySelector('.bm-logos-track')) return;
      var list = LOGOS.slice();
      if (box.getAttribute('data-bm-logos') === 'rev') { list.reverse(); box.classList.add('rev'); }
      var track = document.createElement('div');
      track.className = 'bm-logos-track';
      [0, 1].forEach(function (copy) {
        list.forEach(function (l) {
          var img = document.createElement('img');
          img.src = 'assets/work/client-logo-' + l[0] + '.png';
          img.alt = copy ? '' : l[1] + ' logo';
          img.width = l[2]; img.height = l[3];
          img.loading = 'lazy'; img.decoding = 'async';
          if (copy) img.setAttribute('aria-hidden', 'true');
          track.appendChild(img);
        });
      });
      box.setAttribute('role', 'region');
      if (!box.getAttribute('aria-label')) box.setAttribute('aria-label', 'Brands we have worked with');
      box.appendChild(track);
    });
  }

  /* ============================================================ in-view hooks
     [data-bm-stagger] children rise in one after another; .bm-tl draws its
     track. Both get .is-in once seen. */
  var io2 = canObserve ? new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      en.target.classList.add('is-in');
      io2.unobserve(en.target);
    });
  }, { threshold: 0.2 }) : null;
  function armInView() {
    document.querySelectorAll('[data-bm-stagger], .bm-tl').forEach(function (el) {
      if (el.__bmIv) return;
      el.__bmIv = 1;
      for (var i = 0; i < el.children.length; i++) el.children[i].style.setProperty('--i', i);
      if (reduce || !io2) el.classList.add('is-in'); else io2.observe(el);
    });
  }

  /* ============================================================ tabs
     [data-bm-tabs] containing [role=tab][data-tab] buttons and
     [role=tabpanel] panels (id="ind-<tab>"). Arrow keys move between tabs;
     a #<tab> hash opens that tab directly (shareable links per sector). */
  function armTabs() {
    document.querySelectorAll('[data-bm-tabs]').forEach(function (box) {
      if (box.__bmTabs) return;
      box.__bmTabs = 1;
      var tabs = [].slice.call(box.querySelectorAll('[role="tab"]'));
      function select(tab, focus) {
        tabs.forEach(function (t) {
          var on = t === tab;
          t.setAttribute('aria-selected', on ? 'true' : 'false');
          t.tabIndex = on ? 0 : -1;
          var p = document.getElementById(t.getAttribute('aria-controls'));
          if (p) p.hidden = !on;
        });
        if (focus) tab.focus();
      }
      tabs.forEach(function (t, i) {
        t.addEventListener('click', function () {
          select(t);
          try { history.replaceState(null, '', '#' + t.getAttribute('data-tab')); } catch (e) {}
        });
        t.addEventListener('keydown', function (e) {
          var k = e.key, n = null;
          if (k === 'ArrowRight') n = tabs[(i + 1) % tabs.length];
          else if (k === 'ArrowLeft') n = tabs[(i - 1 + tabs.length) % tabs.length];
          else if (k === 'Home') n = tabs[0];
          else if (k === 'End') n = tabs[tabs.length - 1];
          if (n) { e.preventDefault(); select(n, true); }
        });
      });
      var h = (location.hash || '').slice(1);
      var start = (h && tabs.filter(function (t) { return t.getAttribute('data-tab') === h; })[0]) || tabs[0];
      if (start) select(start);
      box.classList.add('is-armed');
    });
  }

  if (!reduce && io) document.documentElement.classList.add('bm-motion');

  function boot() {
    armTabs();
    buildLogos();
    armInView();
    arm();
    // the x-dc runtime / cms.js inject content after load — re-scan a few times
    setTimeout(arm, 700);
    setTimeout(arm, 1800);
    setTimeout(arm, 3400);
    if ('MutationObserver' in window) {
      var mo = new MutationObserver(function () { clearTimeout(boot.__t); boot.__t = setTimeout(function () { buildLogos(); armInView(); arm(); }, 250); });
      mo.observe(document.body, { childList: true, subtree: true });
    }
    // failsafe: nothing that is on screen (or already scrolled past) stays hidden.
    // Content further down keeps its scroll reveal instead of popping in unseen.
    function failsafe() {
      var vh = window.innerHeight || 800;
      document.querySelectorAll('[data-bm-reveal]:not(.bm-in)').forEach(function (el) {
        if (el.getBoundingClientRect().top < vh) el.classList.add('bm-in');
      });
      document.querySelectorAll('[data-bm-stagger]:not(.is-in), .bm-tl:not(.is-in)').forEach(function (el) {
        if (el.getBoundingClientRect().top < vh) el.classList.add('is-in');
      });
    }
    setTimeout(failsafe, 3000);
    window.addEventListener('scroll', function () { clearTimeout(failsafe.__t); failsafe.__t = setTimeout(failsafe, 400); }, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(boot, 60); });
  } else {
    setTimeout(boot, 60);
  }
})();
