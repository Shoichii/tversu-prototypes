/* home-nika/a — «Чертёж»: пауза чертежа, цитаты на портретах, фильтр программ, лид-форма, липкая панель, состояние news-hover. */
(function () {
  "use strict";


  /* ── Сцена (из b): цветной луп двора в День знаний, только от 768 и без reduced-motion ── */
  const VIDEO = "../../../assets/stub/video/den-znaniy-obzor-2-dvor-pervokursniki.mp4";
  const POSTER = "../../../assets/stub/video/den-znaniy-obzor-2-dvor-pervokursniki.jpg";
  const media = document.querySelector("[data-cine-media]");
  const toggle = document.querySelector("[data-cine-toggle]");
  const wide = window.matchMedia("(min-width: 768px)");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  let video = null;
  let userPaused = false;

  const setToggle = (paused) => {
    toggle.setAttribute("aria-pressed", String(paused));
    toggle.querySelector("[data-icon-pause]").hidden = paused;
    toggle.querySelector("[data-icon-play]").hidden = !paused;
    toggle.querySelector("[data-cine-label]").textContent = paused ? "Продолжить видео" : "Поставить видео на паузу";
  };
  const mount = () => {
    if (video) return;
    video = document.createElement("video");
    video.className = "cine__video";
    Object.assign(video, { muted: true, loop: true, playsInline: true, autoplay: true, poster: POSTER, preload: "auto" });
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("aria-hidden", "true");
    video.addEventListener("playing", () => video.classList.add("is-on"), { once: true });
    video.src = VIDEO;
    media.appendChild(video);
    video.play().catch(() => {});
    toggle.hidden = false;
    setToggle(false);
  };
  const unmount = () => {
    if (!video) return;
    video.pause();
    video.removeAttribute("src");
    video.load();
    video.remove();
    video = null;
    toggle.hidden = true;
  };
  const sync = () => { if (wide.matches && !reduce.matches) mount(); else unmount(); };
  if (media && toggle) {
    toggle.addEventListener("click", () => {
      if (!video) return;
      if (video.paused) { userPaused = false; video.play().catch(() => {}); setToggle(false); }
      else { userPaused = true; video.pause(); setToggle(true); }
    });
    wide.addEventListener?.("change", sync);
    reduce.addEventListener?.("change", sync);
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(([e]) => {
        if (!video || userPaused) return;
        if (e.isIntersecting) video.play().catch(() => {});
        else video.pause();
      }).observe(media);
    }
    sync();
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
  const hero = document.querySelector(".cine");
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
