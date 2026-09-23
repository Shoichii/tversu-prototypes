/* home-proof / a — справка с источниками: лид-форма и состояния */

(function () {
  function init() {
    var states = (window.TVSU && window.TVSU.states) || new Set();

    // ?state=faculties-open — раскрыть состав факультетов в справке
    if (states.has('faculties-open') || states.has('accordion-open')) {
      document.querySelectorAll('.faculties').forEach(function (d) { d.open = true; });
    }

    var form = document.querySelector('[data-lead-form]');
    if (!form) return;
    var input = form.querySelector('input');
    var err = form.querySelector('.field__error');
    var ok = form.querySelector('.lead-form__ok');

    function valid(v) {
      v = v.trim();
      if (/^@[A-Za-z0-9_]{4,}$/.test(v)) return true;
      return v.replace(/\D/g, '').length === 11;
    }
    input.addEventListener('input', function () {
      if (!err.hidden && valid(input.value)) { err.hidden = true; input.removeAttribute('aria-invalid'); }
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!valid(input.value)) {
        err.hidden = false;
        input.setAttribute('aria-invalid', 'true');
        input.focus();
        return;
      }
      err.hidden = true;
      input.removeAttribute('aria-invalid');
      form.querySelector('.field').hidden = true;
      ok.hidden = false;
    });
  }
  if (window.TVSU && window.TVSU.ready) window.TVSU.ready.then(init);
  else document.addEventListener('partials:ready', init, { once: true });
})();
