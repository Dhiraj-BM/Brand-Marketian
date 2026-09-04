/* Brand Marketian — contact page: wire up the main "Tell us what you want
   to grow" form and the "Or pick a slot" meeting picker.

   The static build strips the design-canvas runtime that used to own this
   form's state and submit handler (see prerender/build.mjs: it deletes
   every <script type="text/x-dc"> block, by design, so the shipped page
   has no React/Babel payload). This rebuilds the same behavior in plain
   JS against the static markup. No-ops if that markup isn't on the page. */
(function () {
  'use strict';
  if (window.__bmContactInit) return;
  window.__bmContactInit = true;

  function apiBase() {
    var m = document.querySelector('meta[name="bm-api"]');
    return ((m && m.getAttribute('content')) || window.BM_API || 'https://brand-marketian-api.onrender.com').replace(/\/$/, '');
  }

  var card = document.querySelector('.card.elev-md');
  var sendBtn = card && card.querySelector('button.btn-primary.btn-block');
  if (!card || !sendBtn) return; // not this page, or markup changed — stay safe

  var inputs = card.querySelectorAll('input.input'); // order: name, phone, email, company
  var textarea = card.querySelector('textarea.input');
  var flexGroups = card.querySelectorAll('div[style*="flex-wrap"]'); // [0] services, [1] budget

  // "Or pick a slot" is a separate sibling card, not inside .card.elev-md.
  var slotCard = document.querySelector('.card.elev-sm[style*="accent-2"]');
  var dateInput = slotCard && slotCard.querySelector('input[type="date"]');
  var slotGroup = slotCard && slotCard.querySelector('div[style*="flex-wrap"]');

  /* A chip's on/off state is read straight off its inline style, matching
     exactly what the original component wrote: border-color/background of
     var(--color-accent)/var(--color-accent-100) when selected. */
  function isOn(b) { return b.style.borderColor === 'var(--color-accent)'; }
  function setOn(b, on) {
    b.style.borderColor = on ? 'var(--color-accent)' : 'var(--color-divider)';
    b.style.background = on ? 'var(--color-accent-100)' : 'transparent';
  }
  function wireChips(container, mode) { // mode: 'multi' | 'single' | 'toggle-single'
    var buttons = container ? Array.prototype.slice.call(container.querySelectorAll('button')) : [];
    buttons.forEach(function (b) {
      b.addEventListener('click', function () {
        if (mode === 'multi') {
          setOn(b, !isOn(b));
        } else if (mode === 'toggle-single') {
          var wasOn = isOn(b);
          buttons.forEach(function (o) { setOn(o, false); });
          setOn(b, !wasOn);
        } else {
          buttons.forEach(function (o) { setOn(o, o === b); });
        }
      });
    });
    return { selected: function () { return buttons.filter(isOn).map(function (b) { return (b.textContent || '').trim(); }); } };
  }

  var serviceChips = wireChips(flexGroups[0], 'multi');
  var budgetChips = wireChips(flexGroups[1], 'single');
  var slotChips = wireChips(slotGroup, 'toggle-single');

  var sending = false;
  sendBtn.addEventListener('click', function () {
    if (sending) return;
    var name = inputs[0] ? inputs[0].value.trim() : '';
    var phone = inputs[1] ? inputs[1].value.trim() : '';
    var email = inputs[2] ? inputs[2].value.trim() : '';
    var company = inputs[3] ? inputs[3].value.trim() : '';
    var message = textarea ? textarea.value.trim() : '';
    if (!name || !email) { alert('Please add your name and email so we can reply.'); return; }
    sending = true;
    var label = sendBtn.querySelector('span') || sendBtn;
    label.textContent = 'Sent, we’ll reply within 48 hrs ✓';

    var meetingDate = dateInput ? dateInput.value : '';
    var meetingSlot = slotChips.selected()[0] || '';
    var meeting = (meetingDate || meetingSlot)
      ? ('\n\nRequested call: ' + (meetingDate || 'any day') + (meetingSlot ? ' at ' + meetingSlot + ' IST' : ''))
      : '';

    // keepalive lets the request finish even as we navigate away, so we can
    // redirect instantly without waiting on the API to wake up.
    try {
      fetch(apiBase() + '/api/leads', {
        method: 'POST', keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name, email: email, phone: phone, company: company,
          services: serviceChips.selected(), budget: (budgetChips.selected()[0] || ''),
          message: message + meeting, page: (location.pathname || '/'), source: 'contact-page'
        })
      }).catch(function () {});
    } catch (e) {}
    window.location.href = 'thank-you.html';
  });
})();
