/* Brand Marketian — CMS text binding.
   Any element with data-cms="fieldName" gets its text replaced by the value
   stored for that page in the admin panel. If the API is unreachable the
   text authored in the page stays exactly as it is, so the site never breaks.

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

  var api = (meta('bm-api') || window.BM_API || '').replace(/\/$/, '');
  var page = meta('bm-page');
  if (!page) {
    var f = decodeURIComponent(location.pathname.split('/').pop() || 'home');
    page = f.replace(/\.dc\.html$|\.html$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'home';
  }

  var data = null;

  function apply(root) {
    if (!data) return;
    var nodes = (root || document).querySelectorAll('[data-cms]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var key = el.getAttribute('data-cms');
      var val = data[key];
      if (typeof val !== 'string' || !val.length) continue;
      if (el.getAttribute('data-cms-applied') === val) continue;
      el.textContent = val;
      el.setAttribute('data-cms-applied', val);
    }
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
      var nodes = document.querySelectorAll('[data-cms-applied]');
      for (var i = 0; i < nodes.length; i++) nodes[i].removeAttribute('data-cms-applied');
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
