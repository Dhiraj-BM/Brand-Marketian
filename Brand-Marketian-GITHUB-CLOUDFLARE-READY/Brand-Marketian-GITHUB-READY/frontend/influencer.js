/* Brand Marketian — influencer page interactivity.
   Loaded from the real <head> (like enhance.js) so it runs even though the
   page body is rendered by the site's x-dc runtime. Everything is wired with
   EVENT DELEGATION on `document`, so it keeps working no matter when — or how
   many times — the runtime injects or re-renders the page content. */
(function () {
  if (window.__imInit) return;
  window.__imInit = true;

  function apiBase() {
    var m = document.querySelector('meta[name="bm-api"]');
    return ((m && m.getAttribute('content')) || window.BM_API || 'https://brand-marketian-api.onrender.com').replace(/\/$/, '');
  }
  function $(id) { return document.getElementById(id); }

  /* ---- sample creators (fallback + offline demo) ---- */
  var SAMPLES = {
    'ananya.eats': { name: 'Ananya Rao', handle: '@ananya.eats', cat: 'Food & Lifestyle · Mumbai', av: '#ffd8bf', aq: 92, aqnote: 'Real, India-based followers · low bot risk', followers: '248K', eng: '6.8%', engtag: 'EXCELLENT', views: '312K', cost: '₹45–60K', grad: 'linear-gradient(135deg,#ff9a5a,#e05600)', vidtitle: '“5 street foods under ₹50 every Mumbaikar swears by”', vv: '1.2M', vl: '84K', vc: '2.1K', vs: '19K' },
    'karanlifts': { name: 'Karan Mehta', handle: '@karanlifts', cat: 'Fitness · Delhi NCR', av: '#cdd6ff', aq: 88, aqnote: 'Strong male 18–34 audience · low bot risk', followers: '512K', eng: '5.4%', engtag: 'STRONG', views: '480K', cost: '₹70–95K', grad: 'linear-gradient(135deg,#5a74f2,#1b3bd8)', vidtitle: '“The ₹0 home workout that actually builds muscle”', vv: '2.4M', vl: '171K', vc: '3.8K', vs: '42K' },
    'simran.glow': { name: 'Simran Kaur', handle: '@simran.glow', cat: 'Beauty & Skincare · Chandigarh', av: '#f0d6ff', aq: 85, aqnote: 'High female 18–30 reach · verified creator', followers: '1.2M', eng: '4.1%', engtag: 'GOOD', views: '640K', cost: '₹1.4–1.8L', grad: 'linear-gradient(135deg,#f26fae,#b3275f)', vidtitle: '“I tried the viral ₹299 serum for 30 days”', vv: '3.1M', vl: '214K', vc: '6.2K', vs: '58K' },
    'devbuilds': { name: 'Dev Malhotra', handle: '@devbuilds', cat: 'Tech & Gadgets · Bengaluru', av: '#d6f0e6', aq: 94, aqnote: 'Niche high-intent buyers · very low bot risk', followers: '86K', eng: '7.9%', engtag: 'EXCELLENT', views: '138K', cost: '₹35–50K', grad: 'linear-gradient(135deg,#2bb3a3,#0e7c86)', vidtitle: '“5 gadgets under ₹2,000 that feel premium”', vv: '720K', vl: '61K', vc: '1.9K', vs: '24K' }
  };
  function getCreator(handle) {
    var key = (handle || '').trim().replace(/^@/, '').toLowerCase();
    if (SAMPLES[key]) return SAMPLES[key];
    var keys = Object.keys(SAMPLES), pick = SAMPLES[keys[key.length % keys.length]];
    var clone = Object.assign({}, pick);
    clone.name = key ? key.charAt(0).toUpperCase() + key.slice(1).replace(/[._]/g, ' ') : pick.name;
    clone.handle = '@' + (key || 'creator');
    return clone;
  }

  function setSkel(on) {
    var r = $('im-result'); if (!r) return;
    r.querySelectorAll('b, .im-topvid-t, .im-cat, .im-prof-handle, .im-prof-name b, small')
      .forEach(function (el) { el.classList.toggle('im-skel', on); });
    r.classList.toggle('loading', on);
  }
  // c.av / c.grad may be a full URL, a relative "/api/creator/avatar?u=…" proxy
  // path (resolve against the API origin), or a plain colour / CSS gradient.
  function imgUrl(v) {
    if (typeof v !== 'string') return null;
    if (/^https?:/.test(v)) return v;
    if (v.charAt(0) === '/') return apiBase() + v;
    return null;
  }
  function render(c) {
    var av = $('r-av'); if (!av) return;
    var avUrl = imgUrl(c.av);
    if (avUrl) {
      av.style.backgroundImage = 'url("' + avUrl + '")';
      av.style.backgroundSize = 'cover'; av.style.backgroundPosition = 'center';
      av.style.backgroundColor = '#eee';
    } else { av.style.backgroundImage = 'none'; av.style.backgroundColor = c.av; }
    $('r-name').textContent = c.name; $('r-handle').textContent = c.handle;
    $('r-cat').innerHTML = c.cat; $('r-aq').textContent = c.aq + ' / 100'; $('r-aqnote').textContent = c.aqnote;
    $('r-followers').textContent = c.followers; $('r-eng').textContent = c.eng; $('r-engtag').textContent = c.engtag;
    $('r-views').textContent = c.views; $('r-cost').textContent = c.cost;
    var th = $('r-thumb');
    var thUrl = imgUrl(c.grad);
    if (thUrl) { th.style.backgroundImage = 'url("' + thUrl + '")'; th.style.backgroundSize = 'cover'; th.style.backgroundPosition = 'center'; }
    else { th.style.backgroundImage = 'none'; th.style.background = c.grad; }
    $('r-vidtitle').innerHTML = c.vidtitle;
    $('r-vv').textContent = c.vv; $('r-vl').textContent = c.vl; $('r-vc').textContent = c.vc; $('r-vs').textContent = c.vs;
    var f = $('r-aqfill'); if (f) { f.style.width = '0%'; requestAnimationFrame(function () { setTimeout(function () { f.style.width = c.aq + '%'; }, 40); }); }
  }
  function analyze(handle) {
    var result = $('im-result'); if (!result) return;
    setSkel(true);
    var started = Date.now();
    var finish = function (c) {
      var wait = Math.max(0, 650 - (Date.now() - started));
      setTimeout(function () { setSkel(false); render(c); result.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, wait);
    };
    // Live data from YOUR server (/api/creator/:handle). Falls back to the local
    // sample if the API is unreachable or has no provider key yet.
    var h = (handle || '').replace(/^@/, '');
    fetch(apiBase() + '/api/creator/' + encodeURIComponent(h), { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r); })
      .then(function (c) { finish(c && !c.error && c.followers ? c : getCreator(handle)); })
      .catch(function () { finish(getCreator(handle)); });
  }

  function toggleFaq(btn) {
    var q = btn.parentElement, a = btn.nextElementSibling, open = q.classList.contains('open');
    document.querySelectorAll('.im-q').forEach(function (x) { x.classList.remove('open'); var aa = x.querySelector('.im-a'); if (aa) aa.style.maxHeight = null; });
    if (!open) { q.classList.add('open'); if (a) a.style.maxHeight = a.scrollHeight + 'px'; }
  }

  function submitForm(form) {
    var fd = new FormData(form), sb = form.querySelector('.im-submit');
    var payload = {
      name: (fd.get('name') || '').trim(), email: (fd.get('email') || '').trim(),
      phone: (fd.get('mobile') || '').trim(), company: (fd.get('company') || '').trim(),
      services: fd.get('service') ? [fd.get('service')] : [], budget: fd.get('budget') || '',
      message: 'Job title: ' + ((fd.get('job') || '').trim() || '—'),
      segment: 'other', source: 'influencer-page', page: 'influencer'
    };
    if (sb) { sb.disabled = true; sb.innerHTML = 'Sending…'; }
    var done = function () { form.style.display = 'none'; var ok = $('im-form-ok'); if (ok) ok.classList.add('on'); };
    fetch(apiBase() + '/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r); }).then(done).catch(done);
  }

  /* ---- delegated events (survive re-render) ---- */
  document.addEventListener('click', function (e) {
    var t = e.target; if (!t || !t.closest) return;
    if (t.closest('#im-analyze')) { var i = $('im-handle'); analyze(i ? i.value : 'ananya.eats'); return; }
    var s = t.closest('.im-samples button');
    if (s) { var i2 = $('im-handle'); if (i2) i2.value = '@' + s.getAttribute('data-h'); analyze(s.getAttribute('data-h')); return; }
    var q = t.closest('.im-q-btn'); if (q) { toggleFaq(q); return; }
    var sc = t.closest('[data-scroll]');
    if (sc) { e.preventDefault(); var el = document.getElementById(sc.getAttribute('data-scroll')); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
  });
  document.addEventListener('keydown', function (e) {
    if (e.target && e.target.id === 'im-handle' && e.key === 'Enter') { e.preventDefault(); analyze(e.target.value || 'ananya.eats'); }
  });
  document.addEventListener('submit', function (e) {
    if (e.target && e.target.id === 'im-enq-form') { e.preventDefault(); submitForm(e.target); }
  });

  /* rotating placeholder */
  var phs = ['e.g. ananya.eats', 'e.g. karanlifts', 'e.g. simran.glow', 'e.g. devbuilds'], pi = 0;
  setInterval(function () {
    var inp = $('im-handle');
    if (inp && document.activeElement !== inp && !inp.value) { pi = (pi + 1) % phs.length; inp.placeholder = 'paste an Instagram handle   ' + phs[pi]; }
  }, 2600);

  /* ---- count-up numbers (animate to their real value on scroll) ---- */
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
  function fmtNum(n, decimals, grouped) {
    if (decimals > 0) return n.toFixed(decimals);
    var v = Math.round(n); return grouped ? v.toLocaleString('en-IN') : String(v);
  }
  function countUp(el) {
    if (el.__cu) return; el.__cu = 1;
    var target = (el.textContent || '').trim();
    var m = target.match(/^(\D*?)([\d,]+(?:\.\d+)?)(.*)$/);
    if (!m) return;                                   // no number to animate
    var prefix = m[1], numStr = m[2], suffix = m[3];
    var grouped = numStr.indexOf(',') > -1;
    var decimals = (numStr.split('.')[1] || '').length;
    var end = parseFloat(numStr.replace(/,/g, '')); if (isNaN(end)) return;
    var dur = 1200, start = null;
    function step(ts) {
      if (start === null) start = ts;
      var p = Math.min(1, (ts - start) / dur);
      el.textContent = prefix + fmtNum(end * easeOut(p), decimals, grouped) + suffix;
      if (p < 1) { requestAnimationFrame(step); }
      else { var applied = el.getAttribute('data-cms-applied'); el.textContent = (applied && applied.length) ? applied : target; }
    }
    requestAnimationFrame(step);
  }
  var cObs = ('IntersectionObserver' in window) ? new IntersectionObserver(function (es) {
    es.forEach(function (en) { if (en.isIntersecting) { countUp(en.target); cObs.unobserve(en.target); } });
  }, { threshold: 0.4 }) : null;
  function armCount() {
    document.querySelectorAll('[data-countup]').forEach(function (el) {
      if (cObs) cObs.observe(el); else countUp(el);
    });
  }
  armCount(); setTimeout(armCount, 800); setTimeout(armCount, 2200);  // re-arm for late-injected content

  /* ---- featured creator cards: photo per creator ----
     The CMS "photo source" field per creator (infC<N>PhotoSource) decides:
       - "manual": use the uploaded photo (infC<N>Photo). If that image fails
                   to load, fall back to Instagram so the card is never blank.
       - "auto" (default): fetch the creator's Instagram profile photo via the
                   server (/api/creator/<handle>), which proxies the image so
                   it is not hot-link blocked in the browser.
     influencer.js is the sole authority for these card images (cms.js no
     longer binds them), so the two scripts never race.
     The per-handle Instagram result is cached per-browser for 12h; the server
     also caches upstream, so the provider sees ~1 call/day per handle. */
  var IG_CACHE_PREFIX = 'bm_ig2_';   // v2 — older "bm_ig_" entries held pre-proxy raw URLs
  function igCacheGet(h) {
    try {
      var raw = localStorage.getItem(IG_CACHE_PREFIX + h);
      if (raw) { var o = JSON.parse(raw); if (o && Date.now() - o.t < 432e5) return o.v; }
    } catch (e) {}
    return null;
  }
  function igCacheSet(h, v) {
    try { localStorage.setItem(IG_CACHE_PREFIX + h, JSON.stringify({ t: Date.now(), v: v })); } catch (e) {}
  }
  function setCardPhoto(img, url, onFail) {
    if (!url) { if (onFail) onFail(); return; }
    var probe = new Image();
    probe.onload = function () {
      img.style.backgroundImage = 'url("' + url.replace(/"/g, '%22') + '")';
      img.style.backgroundSize = 'cover';
      img.style.backgroundPosition = 'center';
      img.classList.add('bm-cms-has-img');
    };
    probe.onerror = function () { if (onFail) onFail(); };
    probe.src = url;
  }
  function creatorHandle(img) {
    var card = img.closest ? img.closest('.im-cc') : img.parentElement;
    var hEl = card && card.querySelector('.im-cc-h');
    return hEl ? (hEl.textContent || '').trim().replace(/^@/, '').toLowerCase() : '';
  }
  function fillFromInstagram(img, handle) {
    if (!handle) return;
    var cached = igCacheGet(handle);
    if (cached) { setCardPhoto(img, imgUrl(cached.av)); return; }
    fetch(apiBase() + '/api/creator/' + encodeURIComponent(handle), { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (c) {
        if (!c || c.error || !c.followers) return;
        igCacheSet(handle, { av: c.av });
        setCardPhoto(img, imgUrl(c.av));
      })
      .catch(function () {});
  }
  var _infContent = null;
  function influencerContent() {
    if (!_infContent) {
      _infContent = fetch(apiBase() + '/api/content/influencer', { headers: { Accept: 'application/json' } })
        .then(function (r) { return r.ok ? r.json() : {}; })
        .catch(function () { return {}; });
    }
    return _infContent;
  }
  function fillFeaturedPhotos() {
    var imgs = document.querySelectorAll('.im-cc .im-cc-img[data-creator-photo]');
    if (!imgs.length) return;
    influencerContent().then(function (content) {
      content = content || {};
      for (var i = 0; i < imgs.length; i++) {
        (function (img) {
          var n = img.getAttribute('data-creator-photo');
          if (!n || img.__creatorDone) return;
          img.__creatorDone = true;
          var handle = creatorHandle(img);
          var source = String(content['infC' + n + 'PhotoSource'] || 'auto').toLowerCase();
          var manual = imgUrl(content['infC' + n + 'Photo']);
          if (source === 'manual' && manual) {
            setCardPhoto(img, manual, function () { fillFromInstagram(img, handle); });
          } else {
            fillFromInstagram(img, handle);
          }
        })(imgs[i]);
      }
    });
  }
  fillFeaturedPhotos();
  setTimeout(fillFeaturedPhotos, 1400);   // re-run for content injected late by the x-dc runtime
  setTimeout(fillFeaturedPhotos, 3200);
})();
