/* home-nika/a — «Чертёж»: пауза чертежа, цитаты на портретах, фильтр программ, лид-форма, липкая панель, состояние news-hover. */
(function () {
  "use strict";


  /* ── Пауза вращения чертежа (WCAG 2.2.2) ── */
  const toggle = document.querySelector("[data-spin-toggle]");
  if (toggle) {
    const fig = toggle.closest(".hero__art");
    const label = toggle.querySelector("[data-spin-label]");
    toggle.addEventListener("click", () => {
      const paused = fig.classList.toggle("is-paused");
      toggle.setAttribute("aria-pressed", String(paused));
      toggle.querySelector("[data-icon-pause]").hidden = paused;
      toggle.querySelector("[data-icon-play]").hidden = !paused;
      label.textContent = paused ? "Продолжить вращение чертежа" : "Остановить вращение чертежа";
    });
  }

  /* ── «+» на портрете раскрывает цитату ── */
  document.querySelectorAll("[data-quote]").forEach((btn) => {
    const quote = document.getElementById(btn.getAttribute("aria-controls"));
    const label = btn.querySelector(".visually-hidden");
    const base = label.textContent;
    btn.addEventListener("click", () => {
      const open = btn.getAttribute("aria-expanded") !== "true";
      btn.setAttribute("aria-expanded", String(open));
      quote.hidden = !open;
      label.textContent = open ? "Скрыть: " + base.toLowerCase() : base;
    });
  });

  /* ── Фильтр программ ── */
  const input = document.querySelector("[data-filter-input]");
  if (input) {
    const items = [...document.querySelectorAll("[data-filter-list] > li")];
    const empty = document.querySelector("[data-filter-empty]");
    const echo = document.querySelector("[data-filter-echo]");
    const status = document.querySelector("[data-filter-status]");
    const hay = items.map((li) => (li.textContent + " " + li.dataset.keys).toLowerCase().replace(/ё/g, "е"));
    const run = () => {
      const q = input.value.trim().toLowerCase().replace(/ё/g, "е");
      let shown = 0;
      items.forEach((li, i) => {
        const hit = !q || q.split(/\s+/).every((w) => hay[i].includes(w));
        li.hidden = !hit;
        if (hit) shown++;
      });
      empty.hidden = shown > 0;
      echo.textContent = input.value.trim();
      status.textContent = q ? (shown ? "Найдено направлений: " + shown : "Направлений не найдено") : "";
    };
    input.addEventListener("input", run);
    input.closest("form").addEventListener("submit", (e) => { e.preventDefault(); run(); });
  }

  /* ── Мягкий лид ── */
  const ask = document.querySelector("[data-ask]");
  if (ask) {
    const contact = ask.querySelector("#ask-contact");
    const err = ask.querySelector("#ask-contact-err");
    const done = ask.querySelector("[data-ask-done]");
    const valid = (v) => v.replace(/\D/g, "").length >= 11 || /^@[a-z0-9_]{5,32}$/i.test(v.trim());
    const setError = (on) => {
      err.hidden = !on;
      if (on) contact.setAttribute("aria-invalid", "true");
      else contact.removeAttribute("aria-invalid");
    };
    contact.addEventListener("input", () => { if (!err.hidden && valid(contact.value)) setError(false); });
    ask.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!valid(contact.value)) { setError(true); contact.focus(); return; }
      setError(false);
      done.hidden = false;
      done.textContent = "Вопрос отправлен. Приёмная комиссия ответит на " + contact.value.trim() + " в течение [N] рабочих дней.";
      ask.reset();
    });
  }

  /* ── Липкая панель «Поступить» на мобильном: после hero и до контактов ── */
  const dock = document.querySelector("[data-dock]");
  const hero = document.querySelector(".hero");
  const contacts = document.getElementById("contacts");
  if (dock && hero && contacts && "IntersectionObserver" in window) {
    const btn = dock.querySelector("a");
    let heroGone = false, contactsReached = false;
    const update = () => {
      const on = heroGone && !contactsReached;
      dock.classList.toggle("is-visible", on);
      dock.setAttribute("aria-hidden", String(!on));
      btn.tabIndex = on ? 0 : -1;
    };
    new IntersectionObserver(([e]) => { heroGone = !e.isIntersecting && e.boundingClientRect.top < 0; update(); }).observe(hero);
    new IntersectionObserver(([e]) => { contactsReached = e.isIntersecting || e.boundingClientRect.top < 0; update(); }).observe(contacts);
  }

  /* ── Состояния для скриншотов ── */
  const applyStates = () => {
    const states = (window.TVSU && window.TVSU.states) || new Set();
    if (states.has("news-hover")) {
      document.querySelector("[data-hover-demo]")?.classList.add("is-hover");
      document.querySelector(".prog__row")?.classList.add("is-hover");
    }
  };
  if (window.TVSU && window.TVSU.ready) window.TVSU.ready.then(applyStates);
  else document.addEventListener("partials:ready", applyStates, { once: true });
})();
