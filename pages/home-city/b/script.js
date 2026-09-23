/* home-city/b — поведение варианта «Карта» */
(function () {
  "use strict";
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const small = matchMedia("(max-width: 767px)");
  const desk = matchMedia("(min-width: 1280px)");
  const fine = matchMedia("(hover: hover) and (pointer: fine)");
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const STUB = "../../../assets/stub/photos/";
  const svg = $("[data-map]");

  /* Кадр карты: на десктопе вся схема за текстом, ниже 1280 — восточная часть с корпусами.
     Ставим сразу, до первой отрисовки. */
  function setView() {
    if (!svg) return;
    if (desk.matches) {
      svg.setAttribute("viewBox", "0 0 1440 820");
      svg.setAttribute("preserveAspectRatio", "xMaxYMid slice");
    } else {
      svg.setAttribute("viewBox", "520 20 920 760");
      svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    }
  }
  setView();

  /* Прорисовка плоской схемы: класс ставим сразу (линии спрятаны), запускаем, когда карта в кадре.
     С 768 карту рисует 3D-сцена (map3d.js) — плоская прорисовка стартует, только если сцена не поднялась. */
  const CM = (window.CITY_MAP = window.CITY_MAP || {});
  if (svg && !reduce.matches && "IntersectionObserver" in window) {
    svg.classList.add("is-drawing");
    const frame = svg.closest("[data-map-frame]");
    let flat = !matchMedia("(min-width: 768px)").matches;
    let seen = false;
    const draw = () => {
      if (!seen || !flat || svg.classList.contains("is-live")) return;
      svg.classList.add("is-live");
      setTimeout(() => svg.classList.add("is-drawn"), 2500);
    };
    document.addEventListener("city:flat", () => { flat = true; draw(); });
    setTimeout(() => { if (!frame.classList.contains("is-live")) { flat = true; draw(); } }, 3000);
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      seen = true;
      draw();
    }, { threshold: 0.25 });
    io.observe(svg);
  }

  function plural(n, one, few, many) {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  }

  function countdowns() {
    $$("[data-countdown]").forEach((el) => {
      const [mm, dd] = el.dataset.countdown.split("-").map(Number);
      const now = new Date(); now.setHours(0, 0, 0, 0);
      let t = new Date(now.getFullYear(), mm - 1, dd);
      if (t < now) t = new Date(now.getFullYear() + 1, mm - 1, dd);
      const days = Math.round((t - now) / 864e5);
      el.textContent = days === 0 ? "сегодня" : `через ${days} ${plural(days, "день", "дня", "дней")}`;
    });
  }

  function events() {
    const items = $$("[data-events] .events__item");
    const next = $("[data-events-next]");
    if (!items.length || !next) return;
    let i = 0;
    next.addEventListener("click", () => {
      items[i].classList.remove("is-current");
      i = (i + 1) % items.length;
      items[i].classList.add("is-current");
    });
  }

  /* Масштаб схемы на мобильном */
  function mapZoom() {
    const frame = $("[data-map-frame]");
    const btns = $$("[data-zoom]");
    if (!frame || !svg) return;
    const levels = [1, 1.5, 2.1];
    let li = 0;
    const center = (rx, ry) => {
      frame.scrollLeft = rx * svg.clientWidth - frame.clientWidth / 2;
      frame.scrollTop = ry * svg.clientHeight - frame.clientHeight / 2;
    };
    const apply = (keepCenter) => {
      const rx = (frame.scrollLeft + frame.clientWidth / 2) / (svg.clientWidth || 1);
      const ry = (frame.scrollTop + frame.clientHeight / 2) / (svg.clientHeight || 1);
      svg.style.setProperty("--z", levels[li]);
      btns[0].disabled = li === 0;
      btns[1].disabled = li === levels.length - 1;
      if (keepCenter) center(rx, ry);
    };
    btns.forEach((b) => b.addEventListener("click", () => {
      li = Math.max(0, Math.min(levels.length - 1, li + Number(b.dataset.zoom)));
      apply(true);
    }));
    apply(false);
    // главный корпус — в центр кадра
    if (small.matches) center((1020 - 520) / 920, (483 - 20) / 760);
  }

  /* Корпуса: ряд кнопок ↔ точки ↔ карточка (всплывающая на ≥1280, в потоке ниже) */
  function buildings() {
    const tpl = $("[data-bld-data]");
    const card = $("[data-map-card]");
    const hero = $("[data-hero]");
    if (!tpl || !card || !hero) return;
    const data = JSON.parse(tpl.innerHTML);
    const buttons = $$("[data-bld]");
    const dots = $$("[data-dot]");
    const media = $("[data-card-media]", card);
    const title = $("[data-card-title]", card);
    const meta = $("[data-card-meta]", card);
    const addr = $("[data-card-addr]", card);
    const stubHtml = (cap) =>
      `<div class="stub" role="img" aria-label="Заглушка: ${cap}"><span class="stub__caption">${cap}</span></div>`;

    buttons.forEach((b) => {
      const d = data[b.dataset.bld];
      if (!d) return;
      const tmp = document.createElement("span");
      tmp.innerHTML = d.img
        ? `<img class="bld__thumb" src="${STUB}800/${d.img}.jpg" alt="" loading="lazy" width="64" height="48">`
        : `<span class="bld__thumb stub" aria-hidden="true"></span>`;
      b.prepend(tmp.firstElementChild);
    });

    let current = null, open = false, closeTimer = 0;
    const fill = (key) => {
      const d = data[key];
      media.innerHTML = d.img
        ? `<img src="${STUB}800/${d.img}.jpg" alt="${d.alt}" width="800" height="533">`
        : stubHtml(d.stub);
      title.textContent = d.title;
      meta.textContent = d.meta;
      addr.textContent = d.addr;
    };
    /* Размеры для раскладки кэшируются: в 3D карточка переставляется каждый кадр полёта камеры */
    const stageEl = $(".hero__stage", hero);
    const copyEl = $(".hero__copy", hero);
    const geo = { cw: 320, ch: 320, stageH: 0, heroW: 0, copyR: 560 };
    const measure = () => {
      geo.cw = card.offsetWidth; geo.ch = card.offsetHeight;
      geo.stageH = stageEl.offsetHeight; geo.heroW = hero.offsetWidth;
      geo.copyR = copyEl ? copyEl.getBoundingClientRect().right - hero.getBoundingClientRect().left : 560;
    };
    let side = "", slot = "", slotKey = "";
    const svgAnchor = (key) => {
      const core = $(`[data-dot="${key}"] .map-dot__core`, svg);
      if (!core) return null;
      const r = core.getBoundingClientRect(), h = hero.getBoundingClientRect();
      return { x: r.left + r.width / 2 - h.left, y: r.top + r.height / 2 - h.top, rx: 20, flat: true };
    };
    // площадь пересечения прямоугольников (b расширен на pad)
    const overlap = (a, b, pad) => {
      const w = Math.min(a.x + a.w, b.x + b.w + pad) - Math.max(a.x, b.x - pad);
      const h = Math.min(a.y + a.h, b.y + b.h + pad) - Math.max(a.y, b.y - pad);
      return w > 0 && h > 0 ? w * h : 0;
    };
    /* В 3D карточка выбирает из шести мест (справа/слева × по центру/выше/ниже) то, что меньше всего закрывает
       соседние корпуса и их подписи и никогда — сам выбранный объём. Гистерезис держит место в полёте камеры,
       смена места — короткое проявление, а не прыжок. */
    const place3d = (key, a, obs) => {
      const { cw: w, ch } = geo;
      const gap = Math.max(44, a.rx + 28);
      const minL = geo.copyR + 24, maxL = geo.heroW - 16 - w;
      const clampTop = (t) => Math.max(16, Math.min(t, geo.stageH - ch - 16));
      side = ""; // режимы не делят состояние: плоская схема и 3D выставляют transform-origin сами
      if (slotKey !== key) { slot = ""; slotKey = key; }
      let best = null, kept = null;
      for (const sd of ["right", "left"]) {
        const want = sd === "right" ? a.x + gap : a.x - gap - w;
        const l = Math.max(minL, Math.min(want, maxL));
        for (const v of ["mid", "up", "down"]) {
          const t = clampTop(v === "mid" ? a.y - ch / 2 : v === "up" ? a.y + 48 - ch : a.y - 48);
          const r = { x: l, y: t, w, h: ch };
          let score = Math.abs(want - l) * 60 + (v === "mid" ? 0 : 900) + (sd === "left" ? 300 : 0);
          if (obs.self) score += overlap(r, obs.self, 12) * 6;
          obs.others.forEach((o) => { score += overlap(r, o, 10); });
          const c = { id: sd + "-" + v, sd, v, l, t, score };
          if (!best || score < best.score) best = c;
          if (c.id === slot) kept = c;
        }
      }
      const pick = kept && kept.score <= best.score + 2500 ? kept : best;
      if (pick.id !== slot) {
        if (slot && open && !reduce.matches) card.animate([{ opacity: 0.15 }, { opacity: 1 }], { duration: 180, easing: "cubic-bezier(0.23, 1, 0.32, 1)" });
        slot = pick.id;
        card.style.transformOrigin = `${pick.sd === "right" ? "left" : "right"} ${pick.v === "mid" ? "center" : pick.v === "up" ? "bottom" : "top"}`;
      }
      card.style.translate = `${Math.round(pick.l)}px ${Math.round(pick.t)}px`;
      return { x: pick.l, y: pick.t, w, h: ch };
    };
    const place = (key) => {
      const a = (CM.live && CM.anchor && CM.anchor(key)) || svgAnchor(key);
      if (!a) return null;
      const obs = !a.flat && CM.obstacles ? CM.obstacles(key) : null;
      if (obs) return place3d(key, a, obs);
      slot = "";
      const { cw: w, ch } = geo;
      const gap = Math.max(44, a.rx + 28);
      // карточка — с противоположной от подписи стороны; слева не заезжаем в колонку текста
      const fitsLeft = a.x - gap - w > geo.copyR + 24;
      const fitsRight = a.x + gap + w < geo.heroW - 16;
      let toRight;
      if (a.flat) toRight = key === "k4" || key === "dorm" ? fitsRight : !fitsLeft && fitsRight;
      else toRight = side === "left" ? !fitsLeft && fitsRight : fitsRight || !fitsLeft; // без дрожания сторон в полёте
      const left = toRight ? a.x + gap : a.x - gap - w;
      const top = Math.max(16, Math.min(a.y - ch / 2, geo.stageH - ch - 16));
      card.style.translate = `${Math.round(left)}px ${Math.round(top)}px`;
      const s = toRight ? "right" : "left";
      if (s !== side) { side = s; card.style.transformOrigin = toRight ? "left center" : "right center"; }
      return { x: left, y: top, w, h: ch };
    };
    const notify = () => document.dispatchEvent(new CustomEvent("city:select"));
    const select = (key, how = {}) => {
      if (!data[key]) return;
      clearTimeout(closeTimer);
      if (key !== current) {
        current = key;
        fill(key);
        if (desk.matches) measure();
        if (!desk.matches) {
          card.classList.remove("is-swapping"); void card.offsetWidth; card.classList.add("is-swapping");
        }
      }
      dots.forEach((g) => g.classList.toggle("is-active", g.dataset.dot === key));
      if (desk.matches) {
        place(key);
        open = true;
        card.classList.add("is-open");
      }
      buttons.forEach((b) => b.setAttribute("aria-expanded", String(b.dataset.bld === key && (open || !desk.matches))));
      CM.current = current; CM.open = open;
      notify();
      if (how.focusCard) $("[data-card-close]", card).focus();
    };
    const close = () => {
      if (!desk.matches || !open) return;
      open = false;
      card.classList.remove("is-open");
      dots.forEach((g) => g.classList.remove("is-active"));
      buttons.forEach((b) => b.setAttribute("aria-expanded", "false"));
      CM.open = false;
      notify();
    };
    const later = () => { clearTimeout(closeTimer); closeTimer = setTimeout(close, 220); };

    buttons.forEach((b) => {
      b.addEventListener("click", () => select(b.dataset.bld));
      b.addEventListener("focus", () => { if (desk.matches) select(b.dataset.bld); });
      b.addEventListener("mouseenter", () => { if (fine.matches && desk.matches) select(b.dataset.bld); });
      b.addEventListener("mouseleave", () => { if (desk.matches) later(); });
    });
    dots.forEach((g) => {
      g.addEventListener("click", () => select(g.dataset.dot));
      g.addEventListener("mouseenter", () => { if (fine.matches && desk.matches) select(g.dataset.dot); });
      g.addEventListener("mouseleave", () => { if (desk.matches) later(); });
    });
    card.addEventListener("mouseenter", () => clearTimeout(closeTimer));
    card.addEventListener("mouseleave", () => { if (desk.matches) later(); });
    $("[data-card-close]", card).addEventListener("click", () => {
      const k = current; close();
      $(`[data-bld="${k}"]`)?.focus({ preventScroll: true });
    });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && open) close(); });
    window.addEventListener("resize", () => { if (desk.matches) measure(); if (open && desk.matches) place(current); });
    // мост для map3d.js: наведение/клик по объёмам и перестановка карточки за камерой
    CM.select = (key) => select(key);
    CM.hover = (key) => { if (fine.matches && desk.matches) select(key); };
    CM.leave = () => { if (desk.matches) later(); };
    CM.place = () => (open && desk.matches ? place(current) : null);

    const init = () => {
      setView();
      open = false;
      card.classList.remove("is-open");
      current = null;
      if (desk.matches) {
        fill("main"); current = "main"; measure();
        CM.current = current; CM.open = false; notify();
        dots.forEach((g) => g.classList.remove("is-active"));
        buttons.forEach((b) => b.setAttribute("aria-expanded", "false"));
        // map-hover — главный корпус; map-k2…map-dorm — служебные состояния для кадров подлёта к остальным
        const st = window.TVSU?.states;
        const pre = st && (st.has("map-hover") ? "main" : Object.keys(data).find((k) => st.has("map-" + k)));
        if (pre) select(pre);
      } else {
        select("main");
      }
    };
    desk.addEventListener?.("change", init);
    init();
    // шрифт может сдвинуть геометрию — переставим открытую карточку
    document.fonts?.ready.then(() => { if (desk.matches) measure(); if (open) place(current); });
  }

  /* «Кому что нужно»: аккордеоны на мобильном, строки открыты с 768 */
  function audiences() {
    const rows = $$("[data-aud]");
    const apply = () => rows.forEach((d, i) => { d.open = small.matches ? i === 0 : true; });
    rows.forEach((d) => d.querySelector("summary").addEventListener("click", (e) => { if (!small.matches) e.preventDefault(); }));
    apply();
    small.addEventListener?.("change", apply);
  }

  function actionBar() {
    const bar = $("[data-action-bar]");
    const cta = $(".hero__actions");
    const stop = $("#campaign");
    if (!bar || !cta || !stop || !("IntersectionObserver" in window)) return;
    let ctaVisible = true, stopVisible = false;
    const link = $("a", bar);
    const update = () => {
      const on = !ctaVisible && !stopVisible;
      bar.classList.toggle("is-visible", on);
      bar.setAttribute("aria-hidden", String(!on));
      link.tabIndex = on ? 0 : -1;
    };
    new IntersectionObserver(([e]) => { ctaVisible = e.isIntersecting || e.boundingClientRect.top > 0; update(); }).observe(cta);
    new IntersectionObserver(([e]) => { stopVisible = e.isIntersecting || e.boundingClientRect.top < 0; update(); }).observe(stop);
  }

  function lead() {
    const f = $("[data-lead]");
    if (!f) return;
    const input = $("input", f), err = $(".field__error", f), done = $(".ask__done", f);
    f.addEventListener("submit", (e) => {
      e.preventDefault();
      const v = input.value.trim();
      const ok = /^@[\w\d_]{4,}$/.test(v) || v.replace(/\D/g, "").length === 11;
      input.setAttribute("aria-invalid", String(!ok));
      err.hidden = ok;
      done.hidden = !ok;
      if (!ok) input.focus();
    });
  }

  function init() {
    countdowns();
    events();
    mapZoom();
    buildings();
    audiences();
    actionBar();
    lead();
  }
  if (window.TVSU?.ready) window.TVSU.ready.then(init);
  else document.addEventListener("DOMContentLoaded", init);
})();
