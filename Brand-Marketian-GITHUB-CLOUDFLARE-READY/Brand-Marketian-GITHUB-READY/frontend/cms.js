/* Brand Marketian — CMS binding.
   Any element with data-cms="fieldName" gets its TEXT replaced by the value
   stored for that page in the admin panel. Elements can also bind media:
     data-cms-img="fieldName"   -> sets background-image (cover/center)
     data-cms-src="fieldName"   -> sets the src attribute (for <img>)
     data-cms-href="fieldName"  -> sets the href attribute (for <a>)
   A value that is a bare "/uploads/..." path is resolved against the API
   origin, since uploaded media is served by the backend, not the website.
   When a data-cms-img element gets a real image it also gains the class
   `bm-cms-has-img`, so CSS can hide any placeholder/silhouette underneath.

   If the API is unreachable the authored content stays exactly as it is,
   so the site never breaks.

   Page key comes from <meta name="bm-page" content="home">, else the filename.
   API base comes from <meta name="bm-api" content="https://api.example.com">,
   else window.BM_API, else same-origin. */
(function () {
  if (window.__bmCms) return;
  window.__bmCms = true;

  var meta = function (n) {
    var el = document.querySelector('meta[name="' + n + '"]');
    return el ? el.getAttribute('content') : '';
  };

  var api = (meta('bm-api') || window.BM_API || 'https://brand-marketian-api.onrender.com').replace(/\/$/, '');
  var page = meta('bm-page');
  if (!page) {
    var f = decodeURIComponent(location.pathname.split('/').pop() || 'home');
    page = f.replace(/\.dc\.html$|\.html$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'home';
  }

  var data = null;

  // A bare "/uploads/..." path is served by the backend; everything else
  // (full URL, data:, blob:, or another site-relative path) is used as-is.
  function resolveUrl(v) {
    if (!v) return v;
    if (/^(https?:|data:|blob:)/i.test(v)) return v;
    if (v.indexOf('/uploads/') === 0) return api + v;
    return v;
  }

  function applyOne(el) {
    // text
    var tk = el.getAttribute('data-cms');
    if (tk) {
      var tv = data[tk];
      if (typeof tv === 'string' && tv.length && el.getAttribute('data-cms-applied') !== tv) {
        el.textContent = tv;
        el.setAttribute('data-cms-applied', tv);
      }
    }
    // background image — preload first so a broken / expired URL leaves the
    // authored placeholder in place instead of blanking the element.
    var ik = el.getAttribute('data-cms-img');
    if (ik) {
      var iv = data[ik];
      if (typeof iv === 'string' && iv.length && el.getAttribute('data-cms-img-applied') !== iv) {
        el.setAttribute('data-cms-img-applied', iv);
        (function (node, url) {
          var probe = new Image();
          probe.onload = function () {
            node.style.backgroundImage = 'url("' + url.replace(/"/g, '%22') + '")';
            if (!node.style.backgroundSize) node.style.backgroundSize = 'cover';
            if (!node.style.backgroundPosition) node.style.backgroundPosition = 'center';
            node.classList.add('bm-cms-has-img');
          };
          probe.src = url;
        })(el, resolveUrl(iv));
      }
    }
    // <img> src
    var sk = el.getAttribute('data-cms-src');
    if (sk) {
      var sv = data[sk];
      if (typeof sv === 'string' && sv.length && el.getAttribute('data-cms-src-applied') !== sv) {
        el.setAttribute('src', resolveUrl(sv));
        el.setAttribute('data-cms-src-applied', sv);
      }
    }
    // <a> href
    var hk = el.getAttribute('data-cms-href');
    if (hk) {
      var hv = data[hk];
      if (typeof hv === 'string' && hv.length && el.getAttribute('data-cms-href-applied') !== hv) {
        el.setAttribute('href', resolveUrl(hv));
        el.setAttribute('data-cms-href-applied', hv);
      }
    }
  }

  function apply(root) {
    if (!data) return;
    var nodes = (root || document).querySelectorAll('[data-cms],[data-cms-img],[data-cms-src],[data-cms-href]');
    for (var i = 0; i < nodes.length; i++) applyOne(nodes[i]);
  }

  function watch() {
    var mo = new MutationObserver(function () { apply(document); });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }

  // Preview mode: the admin panel opens this page with ?bmPreview=1 and pushes
  // the unsaved DRAFT content in via postMessage. Nothing here is persisted;
  // it only re-renders the page so an editor can see changes before publishing.
  var preview = /[?&]bmPreview=1/.test(location.search);
  if (preview) {
    window.addEventListener('message', function (ev) {
      var m = ev.data;
      if (!m || m.type !== 'bm-preview' || !m.data || typeof m.data !== 'object') return;
      data = m.data;
      // force re-apply even if a value was applied before
      var nodes = document.querySelectorAll('[data-cms-applied],[data-cms-img-applied],[data-cms-src-applied],[data-cms-href-applied]');
      for (var i = 0; i < nodes.length; i++) {
        nodes[i].removeAttribute('data-cms-applied');
        nodes[i].removeAttribute('data-cms-img-applied');
        nodes[i].removeAttribute('data-cms-src-applied');
        nodes[i].removeAttribute('data-cms-href-applied');
      }
      apply(document);
      if (!window.__bmPvWatch) { window.__bmPvWatch = true; watch(); }
    });
    try { if (window.opener) window.opener.postMessage({ type: 'bm-preview-ready' }, '*'); } catch (e) {}
    // still load published content as the baseline underneath the preview
  }

  fetch(api + '/api/content/' + page, { headers: { Accept: 'application/json' } })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (json) {
      if (!json || typeof json !== 'object') return;
      if (preview && data) return; // a preview payload already arrived; keep it
      data = json;
      apply(document);
      watch();
    })
    .catch(function () { /* offline or no API: authored copy stands */ });
})();
