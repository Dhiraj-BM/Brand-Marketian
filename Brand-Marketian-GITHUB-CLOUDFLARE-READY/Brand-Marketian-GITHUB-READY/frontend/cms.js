/* Brand Marketian — CMS binding.
   Any element with data-cms="fieldName" gets its TEXT replaced by the value
   stored for that page in the admin panel. Elements can also bind media:
     data-cms-img="fieldName"   -> sets background-image (cover/center)
     data-cms-src="fieldName"   -> sets the src attribute (for <img>)
     data-cms-href="fieldName"  -> sets the href attribute (for <a>)
   A value that is a bare "/uploads/..." path is resolved against the API
   origin, since uploaded media is served by the backend, not the website.
   Cloudinary image URLs get f_auto,q_auto added so they are served as
   WebP/AVIF at a sensible quality.
   When a data-cms-img element gets a real image it also gains the class
   `bm-cms-has-img`, so CSS can hide any placeholder/silhouette underneath.

   ON-PAGE EDITS (data._edits)
   Everything else on a page — any heading, paragraph, button, link or image,
   wired or not — can be changed from the admin panel's visual editor. Each
   change is stored as { f: page file, p: element path, k: kind, o: original,
   v: new value } and re-applied here on load. An edit is only applied when
   the element still holds the original it was made against (found by path,
   else by a unique original-text match), so a later code change to the page
   can never make an old edit land on the wrong element.
   Kinds: text (plain text), html (text with inline formatting), tn (only the
   element's own text, keeping icons), src (<img>), href (<a>), bg (background).

   Visual editor: the admin panel loads the page in an iframe with ?bmEdit=1
   and talks to it over postMessage. Nothing is saved by the page itself.

   If the API is unreachable the authored content stays exactly as it is,
   so the site never breaks.

   Page key comes from <meta name="bm-page" content="home">, else the filename.
   API base comes from <meta name="bm-api" content="https://api.example.com">,
   else window.BM_API, else the Render API. */
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
  // The file this page is (several files can share one content key, e.g. the
  // blog articles all use "blog"), so on-page edits stay on their own page.
  var FILE = decodeURIComponent(location.pathname.split('/').pop() || '').toLowerCase().replace(/\.html$/, '') || 'index';

  var data = null;
  var editMode = /[?&]bmEdit=1/.test(location.search) && window.parent !== window;
  var preview = !editMode && /[?&]bmPreview=1/.test(location.search);

  // Cloudinary: ask for the best format/quality unless a transformation is set.
  function cld(url) {
    var m = url.match(/^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.*)$/);
    if (m && !/^[a-z]{1,3}_[^/]*\//.test(m[2])) return m[1] + 'f_auto,q_auto/' + m[2];
    return url;
  }

  // A bare "/uploads/..." path is served by the backend; everything else
  // (full URL, data:, blob:, or another site-relative path) is used as-is.
  function resolveUrl(v) {
    if (!v) return v;
    if (/^(https?:|data:|blob:)/i.test(v)) return cld(v);
    if (v.indexOf('/uploads/') === 0) return api + v;
    return v;
  }

  function setBg(node, url, cover) {
    var probe = new Image();
    probe.onload = function () {
      node.style.backgroundImage = 'url("' + url.replace(/"/g, '%22') + '")';
      if (cover) {
        if (!node.style.backgroundSize) node.style.backgroundSize = 'cover';
        if (!node.style.backgroundPosition) node.style.backgroundPosition = 'center';
      }
      node.classList.add('bm-cms-has-img');
    };
    probe.src = url;
  }

  function setImg(img, url) {
    img.removeAttribute('srcset');
    img.removeAttribute('data-src');
    img.removeAttribute('data-srcset');
    var pic = img.parentElement;
    if (pic && pic.tagName === 'PICTURE') {
      var s = pic.querySelectorAll('source');
      for (var i = 0; i < s.length; i++) s[i].parentNode.removeChild(s[i]);
    }
    img.setAttribute('src', url);
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
        setBg(el, resolveUrl(iv), true);
      }
    }
    // <img> src
    var sk = el.getAttribute('data-cms-src');
    if (sk) {
      var sv = data[sk];
      if (typeof sv === 'string' && sv.length && el.getAttribute('data-cms-src-applied') !== sv) {
        setImg(el, resolveUrl(sv));
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

  /* ------------------------------------------------------ on-page edits */
  function norm(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); }
  // Like norm, but keeps a leading/trailing space (it can separate inline pieces).
  function collapse(s) { return String(s == null ? '' : s).replace(/\s+/g, ' '); }

  function ownText(el) {
    var t = '';
    for (var c = el.firstChild; c; c = c.nextSibling) if (c.nodeType === 3) t += c.nodeValue;
    return norm(t);
  }

  function bgUrl(el) {
    var m = (getComputedStyle(el).backgroundImage || '').match(/url\(["']?(.*?)["']?\)/);
    return m ? m[1] : '';
  }

  function pathOf(el) {
    var parts = [];
    while (el && el.nodeType === 1 && el !== document.body && el !== document.documentElement) {
      var i = 1, s = el;
      while ((s = s.previousElementSibling)) if (s.tagName === el.tagName) i++;
      parts.unshift(el.tagName.toLowerCase() + ':nth-of-type(' + i + ')');
      el = el.parentElement;
    }
    return 'body>' + parts.join('>');
  }

  // The element's value for an edit kind, captured the first time we look so
  // it stays the ORIGINAL even after an edit has been applied.
  function origOf(el, k) {
    var o = el.__bmO || (el.__bmO = {});
    if (!(k in o)) {
      if (k === 'text' || k === 'html') o[k] = norm(el.textContent);
      else if (k === 'tn') o[k] = ownText(el);
      else if (k === 'src') o[k] = el.getAttribute('src') || '';
      else if (k === 'href') o[k] = el.getAttribute('href') || '';
      else if (k === 'bg') o[k] = bgUrl(el);
      if (el.__bmPH === undefined) el.__bmPH = el.innerHTML;
    }
    return o[k];
  }

  function findTarget(ed) {
    var el = null;
    try { el = document.querySelector(ed.p); } catch (e) {}
    if (el && origOf(el, ed.k) === ed.o) return el;
    var tag = (ed.p.match(/([a-z0-9-]+):nth-of-type\(\d+\)$/) || [])[1];
    if (!tag || !ed.o) return null;
    var list = document.getElementsByTagName(tag), hit = null;
    for (var i = 0; i < list.length; i++) {
      if (origOf(list[i], ed.k) === ed.o) { if (hit) return null; hit = list[i]; }
    }
    return hit;
  }

  var OK_TAGS = { B: 1, STRONG: 1, I: 1, EM: 1, U: 1, BR: 1, SPAN: 1, A: 1, SMALL: 1, SUP: 1, SUB: 1, MARK: 1 };
  // Keep only inline formatting (with its class, and safe hrefs on links).
  function sanitize(html) {
    var t = document.createElement('template');
    t.innerHTML = String(html || '');
    (function walk(n) {
      var c = n.firstChild;
      while (c) {
        var nx = c.nextSibling;
        if (c.nodeType === 1) {
          walk(c);
          if (!OK_TAGS[c.tagName]) {
            while (c.firstChild) n.insertBefore(c.firstChild, c);
            n.removeChild(c);
          } else {
            for (var i = c.attributes.length - 1; i >= 0; i--) {
              var a = c.attributes[i].name;
              if (a !== 'class' && !(a === 'href' && c.tagName === 'A')) c.removeAttribute(a);
            }
            if (c.tagName === 'A' && !/^(https?:|mailto:|tel:|\/|#)/i.test(c.getAttribute('href') || '')) c.removeAttribute('href');
          }
        } else if (c.nodeType !== 3) n.removeChild(c);
        c = nx;
      }
    })(t.content);
    var d = document.createElement('div');
    d.appendChild(t.content);
    return d.innerHTML;
  }

  function setOwnText(el, v) {
    var first = true;
    for (var c = el.firstChild; c; c = c.nextSibling) {
      if (c.nodeType !== 3) continue;
      if (first && c.nodeValue.trim()) { c.nodeValue = c.nodeValue.replace(/\S[\s\S]*\S|\S/, v); first = false; }
      else if (!first) c.nodeValue = c.nodeValue.trim() ? ' ' : c.nodeValue;
    }
  }

  function applyEdit(el, ed) {
    var done = el.__bmDone || (el.__bmDone = {});
    if (done[ed.k] === ed.v) return;
    origOf(el, ed.k);
    if (ed.k === 'text') { el.textContent = ed.v; el.setAttribute('data-cms-applied', ed.v); }
    else if (ed.k === 'html') { el.innerHTML = sanitize(ed.v); el.setAttribute('data-cms-applied', el.textContent); }
    else if (ed.k === 'tn') setOwnText(el, ed.v);
    else if (ed.k === 'src') setImg(el, resolveUrl(ed.v));
    else if (ed.k === 'href') el.setAttribute('href', ed.v);
    else if (ed.k === 'bg') setBg(el, resolveUrl(ed.v), false);
    done[ed.k] = ed.v;
    if (editMode) el.classList.add('bm-edited');
  }

  function applyEdits() {
    var list = data && Array.isArray(data._edits) ? data._edits : [];
    for (var i = 0; i < list.length; i++) {
      var ed = list[i];
      if (!ed || ed.f !== FILE || typeof ed.v !== 'string') continue;
      var el = findTarget(ed);
      if (el) applyEdit(el, ed);
    }
  }

  function apply(root) {
    if (!data) return;
    var nodes = (root || document).querySelectorAll('[data-cms],[data-cms-img],[data-cms-src],[data-cms-href]');
    for (var i = 0; i < nodes.length; i++) applyOne(nodes[i]);
    applyEdits();
  }

  function watch() {
    var mo = new MutationObserver(function () { apply(document); });
    mo.observe(document.documentElement, { childList: true, subtree: true });
  }

  if (editMode) { startEditor(); return; }

  // Preview mode: the admin panel opens this page with ?bmPreview=1 and pushes
  // the unsaved DRAFT content in via postMessage. Nothing here is persisted;
  // it only re-renders the page so an editor can see changes before publishing.
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

  /* ================================================== VISUAL EDITOR */
  function startEditor() {
    var parentOrigin = '*';
    var edits = [];
    var sel = null;        // { el, k, field }
    var picks = {}, pickSeq = 0;
    var INLINE = /^(SPAN|STRONG|B|EM|I|U|SMALL|MARK|SUP|SUB|A|BR)$/;
    var SKIP = /^(SCRIPT|STYLE|NOSCRIPT|TEMPLATE|TEXTAREA|SELECT|OPTION|INPUT|IFRAME|CANVAS|VIDEO|HTML|HEAD|BODY|svg|path)$/;
    var ACC = '#FD6301';

    function post(msg) { try { window.parent.postMessage(msg, parentOrigin); } catch (e) {} }

    var st = document.createElement('style');
    st.textContent = [
      'html.bm-editing [data-bm-reveal]{opacity:1!important;transform:none!important}',
      'html.bm-editing .bm-hov{outline:2px dashed ' + ACC + '!important;outline-offset:3px;cursor:text}',
      'html.bm-editing img.bm-hov,html.bm-editing .bm-hov-bg{outline:2px dashed #2563eb!important;outline-offset:-2px;cursor:pointer}',
      'html.bm-editing .bm-sel{outline:2px solid ' + ACC + '!important;outline-offset:3px}',
      'html.bm-editing [contenteditable=true]{background:rgba(253,99,1,.07);caret-color:' + ACC + '}',
      'html.bm-editing .bm-edited{box-shadow:0 0 0 2px rgba(22,163,74,.55)!important}',
      '#bm-ed-bar{position:fixed;left:50%;bottom:14px;transform:translateX(-50%);z-index:2147483647;background:#111827;color:#fff;border-radius:12px;padding:10px 12px;display:none;gap:8px;align-items:center;flex-wrap:wrap;max-width:calc(100vw - 24px);box-shadow:0 12px 30px rgba(0,0,0,.35);font:500 13px/1.3 system-ui,sans-serif}',
      '#bm-ed-bar .lb{color:#fdba74;font-weight:700;margin-right:4px}',
      '#bm-ed-bar button{background:#374151;color:#fff;border:0;border-radius:8px;padding:7px 11px;font:600 12.5px system-ui,sans-serif;cursor:pointer}',
      '#bm-ed-bar button.pr{background:' + ACC + '}',
      '#bm-ed-bar input,#bm-ed-bar textarea{background:#fff;color:#111;border:0;border-radius:7px;padding:6px 8px;font:13px system-ui,sans-serif;min-width:220px}',
      '#bm-ed-bar textarea{min-height:54px;width:320px}'
    ].join('\n');
    document.head.appendChild(st);
    document.documentElement.classList.add('bm-editing');

    var bar = document.createElement('div');
    bar.id = 'bm-ed-bar';
    bar.setAttribute('data-bm-ui', '1');
    function mountBar() { if (!bar.parentNode) document.body.appendChild(bar); }
    if (document.body) mountBar(); else document.addEventListener('DOMContentLoaded', mountBar);

    function hasOwnText(el) {
      for (var c = el.firstChild; c; c = c.nextSibling) if (c.nodeType === 3 && c.nodeValue.trim()) return true;
      return false;
    }
    function onlyInline(el) {
      var all = el.getElementsByTagName('*');
      for (var i = 0; i < all.length; i++) if (!OK_TAGS[all[i].tagName]) return false;
      return true;
    }
    function isUi(el) { return el && el.closest && el.closest('[data-bm-ui]'); }

    // The text block a click belongs to (a whole heading, not the accent span in it).
    function unitFor(t) {
      var el = t && t.nodeType === 1 ? t : t && t.parentElement;
      if (!el || isUi(el) || el.closest('svg')) return null;
      var n = 0;
      while (el && !hasOwnText(el) && el.children.length === 1 && n++ < 3) el = el.firstElementChild;
      if (!el || !hasOwnText(el)) return null;
      while (el.parentElement && INLINE.test(el.tagName) && hasOwnText(el.parentElement) && el.parentElement !== document.body) el = el.parentElement;
      if (SKIP.test(el.tagName)) return null;
      return el;
    }
    function kindFor(el) {
      if (!el.children.length) return 'text';
      return onlyInline(el) ? 'html' : 'tn';
    }
    // Images are often covered by an overlay (gradient, badge), so look at
    // everything under the pointer, not just the top element.
    function mediaAt(e) {
      var list = document.elementsFromPoint ? document.elementsFromPoint(e.clientX, e.clientY) : [e.target];
      for (var i = 0; i < list.length; i++) {
        var el = list[i];
        if (isUi(el) || el === document.body || el === document.documentElement) break;
        if (el.tagName === 'IMG') return { el: el, k: 'src' };
        if (bgUrl(el)) return { el: el, k: 'bg' };
      }
      return null;
    }
    function bgHost(t) {
      var el = t && t.nodeType === 1 ? t : t && t.parentElement, n = 0;
      while (el && el !== document.body && n++ < 6) { if (bgUrl(el)) return el; el = el.parentElement; }
      return null;
    }

    function upsert(el, k, v) {
      var p = pathOf(el), o = origOf(el, k);
      for (var i = edits.length - 1; i >= 0; i--) {
        var e = edits[i];
        if (e.f === FILE && e.p === p && e.k === k) edits.splice(i, 1);
      }
      var same = (k === 'html') ? sanitize(v) === sanitize(el.__bmPH) : (k === 'text' || k === 'tn') ? norm(v) === o : v === o;
      if (!same) edits.push({ f: FILE, p: p, k: k, o: o, v: v });
      el.classList.toggle('bm-edited', !same);
      if (!el.__bmDone) el.__bmDone = {};
      el.__bmDone[k] = v;
      post({ type: 'bm-edit-change', edits: edits });
    }

    function valueOf(el, k) {
      if (k === 'text') return collapse(el.textContent);
      if (k === 'html') return sanitize(el.innerHTML);
      return ownText(el);
    }

    function commit() {
      if (!sel || !sel.el || (sel.k !== 'text' && sel.k !== 'html')) return;
      var el = sel.el;
      if (sel.field) { post({ type: 'bm-edit-field', k: sel.field, v: collapse(el.textContent) }); el.classList.add('bm-edited'); return; }
      upsert(el, sel.k, valueOf(el, sel.k));
    }

    function deselect() {
      if (sel && sel.el) {
        commit();
        sel.el.removeAttribute('contenteditable');
        sel.el.classList.remove('bm-sel');
      }
      sel = null;
      bar.style.display = 'none';
    }

    function btn(label, fn, pr) {
      var b = document.createElement('button');
      b.type = 'button'; b.textContent = label;
      if (pr) b.className = 'pr';
      b.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); fn(); });
      return b;
    }

    function revert(el) {
      var o = el.__bmO || {};
      for (var i = edits.length - 1; i >= 0; i--) {
        var e = edits[i];
        if (e.f === FILE && e.p === pathOf(el)) edits.splice(i, 1);
      }
      if (el.__bmPH !== undefined && ('text' in o || 'html' in o || 'tn' in o)) el.innerHTML = el.__bmPH;
      if ('src' in o) setImg(el, o.src);
      if ('href' in o) el.setAttribute('href', o.href);
      if ('bg' in o) el.style.backgroundImage = '';
      el.__bmDone = {};
      el.classList.remove('bm-edited');
      post({ type: 'bm-edit-change', edits: edits });
      deselect();
    }

    function pick(el, k, field) {
      var id = 'p' + (++pickSeq);
      picks[id] = { el: el, k: k, field: field };
      post({ type: 'bm-edit-pick', id: id });
    }

    function showBar(el, k, field) {
      mountBar();
      bar.innerHTML = '';
      var labels = { text: 'Text', html: 'Text', tn: 'Text', src: 'Image', bg: 'Background' };
      var lb = document.createElement('span');
      lb.className = 'lb';
      lb.textContent = (/^H[1-6]$/.test(el.tagName) ? 'Heading' : el.tagName === 'A' || el.tagName === 'BUTTON' ? 'Button' : labels[k]) + (field ? ' (page field)' : '');
      bar.appendChild(lb);

      if (k === 'tn') {
        var ta = document.createElement('textarea');
        ta.value = ownText(el);
        ta.addEventListener('input', function () { setOwnText(el, ta.value); upsert(el, 'tn', norm(ta.value)); });
        bar.appendChild(ta);
      }
      if (k === 'src' || k === 'bg') bar.appendChild(btn(k === 'src' ? 'Replace image' : 'Replace background', function () { pick(el, k, field); }, true));
      if (k !== 'bg') {
        var bh = bgHost(el);
        if (bh && bh !== el) bar.appendChild(btn('Section background', function () { selectEl(bh, 'bg'); }));
      }
      var link = el.tagName === 'A' ? el : el.closest('a');
      if (link && !link.hasAttribute('data-cms-href')) {
        var li = document.createElement('input');
        li.placeholder = 'Link goes to…';
        li.value = link.getAttribute('href') || '';
        li.addEventListener('input', function () { link.setAttribute('href', li.value.trim()); upsert(link, 'href', li.value.trim()); });
        var wrap = document.createElement('span');
        wrap.textContent = 'Link ';
        wrap.appendChild(li);
        bar.appendChild(wrap);
      }
      bar.appendChild(btn('Undo change', function () { revert(el); if (link && link !== el) revert(link); }));
      bar.appendChild(btn('Done', deselect, true));
      bar.style.display = 'flex';
    }

    function selectEl(el, k) {
      deselect();
      var field = null;
      if (k === 'src') field = el.getAttribute('data-cms-src');
      else if (k === 'bg') field = el.getAttribute('data-cms-img');
      else field = el.getAttribute('data-cms');
      if (field && k !== 'text' && k !== 'src' && k !== 'bg') field = null;
      origOf(el, k);
      sel = { el: el, k: k, field: field };
      el.classList.add('bm-sel');
      if (k === 'text' || k === 'html') {
        el.setAttribute('contenteditable', 'true');
        el.focus();
      }
      showBar(el, k, field);
    }

    var hov = null;
    document.addEventListener('mouseover', function (e) {
      if (hov) { hov.classList.remove('bm-hov'); hov.classList.remove('bm-hov-bg'); hov = null; }
      if (isUi(e.target)) return;
      var el = unitFor(e.target);
      if (el) { el.classList.add('bm-hov'); hov = el; return; }
      var md = mediaAt(e);
      if (md) { md.el.classList.add(md.k === 'src' ? 'bm-hov' : 'bm-hov-bg'); hov = md.el; }
    }, true);

    document.addEventListener('click', function (e) {
      if (isUi(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      if (sel && sel.el && sel.el.contains(e.target) && sel.el.getAttribute('contenteditable')) return;
      var el = unitFor(e.target);
      if (el) { selectEl(el, kindFor(el)); return; }
      var md = mediaAt(e);
      if (md) { selectEl(md.el, md.k); return; }
      deselect();
    }, true);

    document.addEventListener('submit', function (e) { e.preventDefault(); e.stopPropagation(); }, true);

    document.addEventListener('keydown', function (e) {
      if (!sel || !sel.el || !sel.el.getAttribute('contenteditable')) return;
      if (e.key === 'Escape') { deselect(); return; }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey && sel.k === 'html') document.execCommand('insertLineBreak');
      }
    }, true);

    document.addEventListener('input', function (e) {
      if (sel && sel.el && sel.el.contains(e.target) && sel.el.getAttribute('contenteditable')) commit();
    }, true);

    document.addEventListener('paste', function (e) {
      if (!sel || !sel.el || !sel.el.getAttribute('contenteditable')) return;
      e.preventDefault();
      var txt = (e.clipboardData || window.clipboardData).getData('text/plain');
      document.execCommand('insertText', false, norm(txt));
    }, true);

    window.addEventListener('message', function (ev) {
      var m = ev.data;
      if (!m || typeof m !== 'object' || ev.source !== window.parent) return;
      if (m.type === 'bm-edit-init') {
        parentOrigin = ev.origin || '*';
        clearInterval(hello);
        data = (m.data && typeof m.data === 'object') ? m.data : {};
        edits = Array.isArray(m.edits) ? m.edits.slice() : [];
        data._edits = edits;
        apply(document);
        var nodes = document.querySelectorAll('[data-cms-applied],[data-cms-src-applied],[data-cms-img-applied]');
        for (var i = 0; i < nodes.length; i++) if (nodes[i].getAttribute('data-cms') || nodes[i].getAttribute('data-cms-src')) nodes[i].classList.add('bm-edited');
      } else if (m.type === 'bm-edit-image' && picks[m.id] && typeof m.url === 'string') {
        var pk = picks[m.id];
        delete picks[m.id];
        if (pk.k === 'src') setImg(pk.el, resolveUrl(m.url)); else setBg(pk.el, resolveUrl(m.url), !!pk.field);
        if (pk.field) { post({ type: 'bm-edit-field', k: pk.field, v: m.url }); pk.el.classList.add('bm-edited'); }
        else upsert(pk.el, pk.k, m.url);
      } else if (m.type === 'bm-edit-commit') {
        deselect();
        post({ type: 'bm-edit-committed', edits: edits });
      }
    });

    var tries = 0;
    var hello = setInterval(function () {
      post({ type: 'bm-edit-ready', file: FILE, page: page });
      if (++tries > 60) clearInterval(hello);
    }, 500);
    post({ type: 'bm-edit-ready', file: FILE, page: page });
  }
})();
