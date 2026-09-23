/* Инклюд шапки и подвала + поведение шапки.
   Страница: <div data-include="header"></div> … <div data-include="footer"></div>
             <script src="../../../system/partials.js" defer></script>
   Тема шапки: <body data-header="dark">. Активный раздел: <body data-nav="applicants">.
   Состояния для скриншотов: ?state=menu-open, ?state=search-open (через запятую — несколько).
   Когда партиалы вставлены, на document летит событие "partials:ready";
   window.TVSU.ready — промис того же момента, window.TVSU.states — Set состояний из адреса. */
(function () {
  "use strict";

  const script = document.currentScript;
  const root = new URL("..", script ? script.src : location.href); // корень design/
  const states = new Set(
    (new URLSearchParams(location.search).get("state") || "").split(",").map((s) => s.trim()).filter(Boolean)
  );

  let resolveReady;
  window.TVSU = Object.assign(window.TVSU || {}, {
    root: root.href,
    states,
    ready: new Promise((r) => (resolveReady = r)),
  });

  const NAV = [
    ["about", "О вузе"], ["education", "Образование"], ["science", "Наука"],
    ["international", "Международное сотрудничество"], ["applicants", "Абитуриенту"],
    ["students", "Студенту"], ["staff", "Сотруднику"], ["resources", "Ресурсы"],
  ];

  function fallback(name) {
    const box = document.createElement("div");
    box.className = "partial-fallback";
    if (name === "header") {
      box.innerHTML =
        "<strong>ТвГУ</strong> · шапка не загрузилась — откройте проект через http-сервер " +
        "(<code>python3 -m http.server 8000</code> в design/)" +
        '<nav aria-label="Основные разделы">' +
        NAV.map(([, t]) => '<a href="#">' + t + "</a>").join("") +
        '<a href="#">Версия для слабовидящих</a><a href="#">Личный кабинет</a></nav>';
    } else {
      box.innerHTML =
        "© Тверской государственный университет, 1870–2026 · " +
        '<a href="#">Сведения об образовательной организации</a> · подвал не загрузился';
    }
    return box;
  }

  async function include(el) {
    const name = el.getAttribute("data-include");
    try {
      const res = await fetch(new URL("system/partials/" + name + ".html", root));
      if (!res.ok) throw new Error(res.status);
      const tpl = document.createElement("template");
      tpl.innerHTML = await res.text();
      el.replaceWith(tpl.content);
    } catch (e) {
      el.replaceWith(fallback(name));
    }
  }

  /* ───── Шапка ───── */
  function initHeader() {
    const header = document.querySelector("[data-site-header]");
    if (!header) return;
    const slot = header.querySelector(".hdr-slot");

    // активный раздел
    const current = document.body.dataset.nav;
    if (current) {
      header.querySelectorAll('[data-nav="' + current + '"]').forEach((a) => a.setAttribute("aria-current", "page"));
    }

    // компактная липкая: полоса уходит в fixed, когда слот покинул экран
    if (slot && "IntersectionObserver" in window) {
      new IntersectionObserver(
        ([entry]) => {
          const compact = !entry.isIntersecting && entry.boundingClientRect.top < 0;
          header.classList.toggle("is-compact", compact);
        },
        { threshold: 0 }
      ).observe(slot);
    }

    // поиск
    const searchBtn = header.querySelector("[data-search-toggle]");
    const panel = header.querySelector("[data-search-panel]");
    function setSearch(open, { focus = true } = {}) {
      if (!panel) return;
      panel.classList.toggle("is-open", open);
      searchBtn && searchBtn.setAttribute("aria-expanded", String(open));
      if (open && focus) setTimeout(() => panel.querySelector("input")?.focus({ preventScroll: true }), 30);
      if (!open && focus && panel.contains(document.activeElement)) searchBtn?.focus();
    }
    searchBtn?.addEventListener("click", () => setSearch(!panel.classList.contains("is-open")));
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && panel?.classList.contains("is-open")) setSearch(false);
    });
    document.addEventListener("click", (e) => {
      if (panel?.classList.contains("is-open") && !panel.contains(e.target) && !searchBtn.contains(e.target)) {
        setSearch(false, { focus: false });
      }
    });

    // меню
    const menu = document.querySelector("[data-menu]");
    const openers = document.querySelectorAll("[data-menu-open]");
    let lastFocus = null;

    const focusables = () =>
      [...menu.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])')]
        .filter((el) => el.offsetParent !== null || el === document.activeElement);

    function setMenu(open, { instant = false } = {}) {
      if (!menu) return;
      if (open) {
        lastFocus = document.activeElement;
        setSearch(false, { focus: false });
      }
      if (instant) menu.style.transition = "none";
      menu.classList.toggle("is-open", open);
      if (instant) { menu.offsetHeight; menu.style.transition = ""; }
      document.documentElement.classList.toggle("is-locked", open);
      openers.forEach((b) => b.setAttribute("aria-expanded", String(open)));
      if (open) {
        menu.querySelector("[data-menu-close]")?.focus({ preventScroll: true });
      } else if (lastFocus && document.contains(lastFocus)) {
        lastFocus.focus({ preventScroll: true });
      }
    }
    openers.forEach((b) => b.addEventListener("click", () => setMenu(true)));
    menu?.querySelector("[data-menu-close]")?.addEventListener("click", () => setMenu(false));
    menu?.addEventListener("click", (e) => {
      if (e.target.closest("a[href]")) setMenu(false);
    });
    menu?.addEventListener("keydown", (e) => {
      if (e.key === "Escape") { e.preventDefault(); setMenu(false); return; }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });

    window.TVSU.menu = { open: () => setMenu(true), close: () => setMenu(false) };
    window.TVSU.search = { open: () => setSearch(true), close: () => setSearch(false) };

    if (states.has("menu-open")) setMenu(true, { instant: true });
    if (states.has("search-open")) setSearch(true, { focus: false });
  }

  async function run() {
    const slots = [...document.querySelectorAll("[data-include]")];
    await Promise.all(slots.map(include));
    initHeader();
    document.dispatchEvent(new CustomEvent("partials:ready"));
    resolveReady();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
  else run();
})();
