/* home-story/c — «Журнал»: фолбэк раскрытия кадра, счётчик дней (набегание цифр — общий слой motion.js),
   входы-аккордеоны на мобильном, фильтр областей, форма подписки, липкая панель. */
(function () {
  "use strict";
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  const states = new Set(
    (new URLSearchParams(location.search).get("state") || "").split(",").map((s) => s.trim()).filter(Boolean)
  );
  const plural = (n, one, few, many) => {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  };

  /* Кадр: без scroll-timeline раскрываем по IntersectionObserver */
  function initReveal() {
    const fig = document.querySelector("[data-reveal]");
    if (!fig || reduce.matches) return;
    if (window.CSS && CSS.supports("animation-timeline: view()")) return;
    const r = fig.getBoundingClientRect();
    if (r.top < window.innerHeight * 0.55) return; // уже на экране — не прячем то, что человек видит
    fig.classList.add("is-armed");
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { fig.classList.add("is-open"); io.disconnect(); }
    }, { threshold: 0.3 });
    io.observe(fig);
  }

  /* Счётчик дней до даты-примера */
  function initCountdown() {
    const box = document.querySelector("[data-countdown]");
    if (!box) return;
    const target = new Date(box.dataset.countdown + "T00:00:00+03:00");
    const days = Math.ceil((target - Date.now()) / 864e5);
    const num = box.querySelector("[data-countdown-num]");
    const unit = box.querySelector("[data-countdown-unit]");
    if (days > 0) {
      num.textContent = String(days);
      unit.textContent = plural(days, "день", "дня", "дней") + " до старта";
    } else {
      num.textContent = "идёт";
      unit.textContent = "приём документов";
    }
  }

  /* Три входа: на мобильном аккордеоны, с 768 — всегда открыты */
  function initEntries() {
    const list = [...document.querySelectorAll("[data-entry]")];
    const mq = window.matchMedia("(min-width: 768px)");
    const sync = () => list.forEach((d, i) => {
      if (mq.matches) d.setAttribute("open", "");
      else if (i > 0 || !states.has("accordion-open")) d.removeAttribute("open");
    });
    sync();
    mq.addEventListener?.("change", sync);
    list.forEach((d) => d.querySelector("summary").addEventListener("click", (e) => { if (mq.matches) e.preventDefault(); }));
  }

  /* Поиск по областям */
  function initPrograms() {
    const q = document.querySelector("[data-prog-q]");
    if (!q) return;
    const rows = [...document.querySelectorAll(".ptable a.ptable__row")];
    const empty = document.querySelector("[data-prog-empty]");
    const status = document.querySelector("[data-prog-status]");
    const norm = (s) => s.toLowerCase().replace(/ё/g, "е").trim();
    q.addEventListener("input", () => {
      const v = norm(q.value);
      let shown = 0;
      rows.forEach((r) => {
        const hay = norm(r.textContent + " " + (r.dataset.keys || ""));
        const ok = !v || v.split(/\s+/).every((w) => hay.includes(w));
        r.hidden = !ok;
        if (ok) shown++;
      });
      empty.hidden = shown > 0;
      status.textContent = !v ? "Показаны все 9 областей" : shown ? `Найдено: ${shown} ${plural(shown, "область", "области", "областей")}` : "Ничего не нашли";
    });
  }

  /* Подписка: одно поле, e-mail или @ник */
  function initLead() {
    const form = document.querySelector("[data-lead]");
    if (!form) return;
    const input = form.querySelector("input");
    const msg = form.querySelector("[data-lead-msg]");
    const base = msg.textContent;
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const v = input.value.trim();
      const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) || /^@[A-Za-z0-9_]{4,32}$/.test(v);
      form.classList.toggle("is-done", ok);
      if (ok) {
        input.removeAttribute("aria-invalid");
        msg.className = "field__hint";
        msg.textContent = "Готово. Первое письмо придёт в день выхода октябрьской истории.";
      } else {
        input.setAttribute("aria-invalid", "true");
        msg.className = "field__error";
        msg.textContent = v ? "Проверь адрес: нужен e-mail вида name@mail.ru или ник вида @username" : "Впиши e-mail или ник в Telegram";
        input.focus();
      }
    });
    input.addEventListener("input", () => {
      if (input.getAttribute("aria-invalid")) { input.removeAttribute("aria-invalid"); msg.className = "field__hint"; msg.textContent = base; }
    });
  }

  /* Липкая панель: когда главная кнопка обложки ушла вверх, и не поверх подвала */
  function initActionbar() {
    const bar = document.querySelector("[data-actionbar]");
    const hero = document.querySelector(".cover__actions");
    if (!bar || !hero || !("IntersectionObserver" in window)) return;
    const link = bar.querySelector("a");
    let past = false, footer = false, programs = false;
    const apply = () => {
      const on = past && !footer && !programs;
      bar.classList.toggle("is-on", on);
      bar.setAttribute("aria-hidden", String(!on));
      link.tabIndex = on ? 0 : -1;
    };
    new IntersectionObserver(([e]) => { past = !e.isIntersecting && e.boundingClientRect.top < 0; apply(); }).observe(hero);
    const watch = (sel, set) => {
      const el = document.querySelector(sel);
      if (el) new IntersectionObserver(([e]) => { set(e.isIntersecting); apply(); }).observe(el);
    };
    watch("#programs .programs__intro", (v) => (programs = v));
    (window.TVSU?.ready || Promise.resolve()).then(() => watch(".site-footer", (v) => (footer = v)));
  }

  /* Узлы общего слоя в горизонтальной ленте людей (<1024) за правым краем наблюдатель не увидит — показываем сразу */
  function initMotionFixups() {
    const M = window.TVSU_MOTION;
    if (!M || reduce.matches) return;
    requestAnimationFrame(() => {
      document.querySelectorAll(".people__spread > [data-m]:not(.m-in)").forEach((el) => {
        if (el.getBoundingClientRect().left >= window.innerWidth - 8) M.reveal(el);
      });
    });
  }

  function init() {
    initMotionFixups();
    initReveal();
    initCountdown();
    initEntries();
    initPrograms();
    initLead();
    initActionbar();
    if (states.has("people-hover")) document.querySelector(".person")?.classList.add("is-hover");
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
