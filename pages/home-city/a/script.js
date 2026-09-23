/* home-city/a — поведение варианта «Видео» */
(function () {
  "use strict";
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const small = matchMedia("(max-width: 767px)");
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  function plural(n, one, few, many) {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  }

  /* Счётчик дней до события (дата из подсказки CC1, год — ближайший) */
  function countdowns() {
    $$("[data-countdown]").forEach((el) => {
      const [mm, dd] = el.dataset.countdown.split("-").map(Number);
      const now = new Date(); now.setHours(0, 0, 0, 0);
      let t = new Date(now.getFullYear(), mm - 1, dd);
      if (t < now) t = new Date(now.getFullYear() + 1, mm - 1, dd);
      const days = Math.round((t - now) / 864e5);
      const word = plural(days, "день", "дня", "дней");
      if (el.dataset.countdownFormat === "long") el.textContent = days === 0 ? "Сегодня" : `Через ${days} ${word}`;
      else el.textContent = days === 0 ? "сегодня" : `через ${days} ${word}`;
    });
  }

  /* Hero-видео: 720p на десктопе, 480 на мобильном только при хорошей сети; reduced motion — постер */
  function heroVideo() {
    const v = $("[data-hero-video]");
    const btn = $("[data-hero-toggle]");
    const label = $("[data-hero-toggle-label]");
    if (!v || !btn) return;
    const conn = navigator.connection;
    const goodNet = !conn || (!conn.saveData && !/(^|-)2g|3g/.test(conn.effectiveType || ""));
    const isSmall = small.matches;
    if (isSmall && v.dataset.posterSmall) v.poster = v.dataset.posterSmall;
    let loaded = false;
    const load = () => {
      if (loaded) return;
      v.src = isSmall ? v.dataset.srcSmall : v.dataset.src;
      loaded = true;
    };
    const setUi = (playing) => {
      btn.classList.toggle("is-paused", !playing);
      label.textContent = playing ? "Пауза" : "Смотреть луп";
      btn.classList.toggle("hero__toggle--big", !playing && isSmall && !v.dataset.userPaused);
    };
    const play = () => { load(); v.play().then(() => setUi(true)).catch(() => setUi(false)); };
    btn.hidden = false;
    btn.addEventListener("click", () => {
      if (v.paused) { delete v.dataset.userPaused; play(); }
      else { v.pause(); v.dataset.userPaused = "1"; setUi(false); }
    });
    if (reduce.matches || (isSmall && !goodNet)) { setUi(false); return; }
    play();
    reduce.addEventListener?.("change", () => { if (reduce.matches) { v.pause(); setUi(false); } });
    // не крутим видео за экраном
    new IntersectionObserver(([e]) => {
      if (!loaded || v.dataset.userPaused) return;
      if (e.isIntersecting) v.play().catch(() => {}); else v.pause();
    }).observe(v);
  }

  /* Модалка «Смотреть кампус» */
  function videoModal() {
    const dlg = $("[data-video-modal]");
    const opener = $("[data-video-open]");
    if (!dlg || !opener) return;
    const vid = $("video", dlg);
    const open = () => {
      if (!vid.src) vid.src = small.matches ? vid.dataset.srcSmall : vid.dataset.src;
      dlg.showModal();
      $("[data-video-close]", dlg).focus();
    };
    opener.addEventListener("click", open);
    $("[data-video-close]", dlg).addEventListener("click", () => dlg.close());
    dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener("close", () => { vid.pause(); opener.focus(); });
    if (window.TVSU?.states?.has("video-open")) { vid.preload = "metadata"; dlg.showModal(); }
  }

  /* Сцена hero: кадр сжимается в окно (CSS view-timeline; без поддержки — один rAF), факты въезжают по сторожу */
  const bezier = (x1, y1, x2, y2) => (t) => {
    // решение кубической Безье по x Ньютоном — те же кривые, что в токенах
    let u = t;
    for (let i = 0; i < 6; i++) {
      const x = 3 * (1 - u) * (1 - u) * u * x1 + 3 * (1 - u) * u * u * x2 + u * u * u - t;
      const dx = 3 * (1 - u) * (1 - u) * x1 + 6 * (1 - u) * u * (x2 - x1) + 3 * u * u * (1 - x2);
      if (Math.abs(dx) < 1e-6) break;
      u = Math.min(1, Math.max(0, u - x / dx));
    }
    return 3 * (1 - u) * (1 - u) * u * y1 + 3 * (1 - u) * u * u * y2 + u * u * u;
  };
  const inOut = bezier(0.77, 0, 0.175, 1); // --ease-in-out
  let factsIn = false;
  function scene(onFacts) {
    const hero = $("[data-hero]");
    const cue = $("[data-hero-cue]");
    if (!hero || !cue || !document.documentElement.classList.contains("m-on") || reduce.matches) return;
    const facts = $$("[data-hero-count]", hero);
    let counted = false;
    // корень растянут вверх: сторож «в кадре», пока он выше низа экрана — прыжок наверх тоже снимает факты
    new IntersectionObserver(([e]) => {
      const on = e.isIntersecting;
      if (on === factsIn) return;
      factsIn = on;
      hero.classList.toggle("is-facts", on);
      if (on && !counted && window.TVSU_MOTION) {
        counted = true;
        facts.forEach((el, i) => setTimeout(() => { el.setAttribute("data-count", ""); window.TVSU_MOTION.reveal(el); }, i * 80));
      }
      onFacts();
    }, { rootMargin: "100000px 0px 0px 0px" }).observe(cue);

    if (window.CSS?.supports?.("animation-timeline: view()")) return;
    const media = $("[data-hero-media]", hero), video = $("[data-hero-video]", hero);
    const copy = $("[data-hero-copy]", hero), scrim = $("[data-hero-scrim]", hero);
    const seg = (p, a, b) => inOut(Math.min(1, Math.max(0, (p - a) / (b - a))));
    let raf = 0;
    const frame = () => {
      raf = 0;
      const r = hero.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) return;
      const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - innerHeight)));
      const c = seg(p, 0, 0.38), s = seg(p, 0.04, 0.6), w = seg(p, 0.1, 0.76);
      copy.style.transform = `translate3d(0, ${(-64 * c).toFixed(2)}px, 0)`;
      copy.style.clipPath = `inset(-40px -40px ${(c * 100).toFixed(3)}% -40px)`;
      scrim.style.opacity = (1 - 0.88 * s).toFixed(3);
      media.style.clipPath = `inset(calc(var(--win-t) * ${w}) calc(var(--win-r) * ${w}) calc(var(--win-b) * ${w}) calc(var(--win-l) * ${w}) round ${(8 * w).toFixed(2)}px)`;
      video.style.transform = `scale(${(1.12 - 0.12 * w).toFixed(4)})`;
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };
    addEventListener("scroll", kick, { passive: true });
    addEventListener("resize", kick, { passive: true });
    kick();
  }

  /* Липкая панель действия: после hero и до блока кампании */
  function actionBar() {
    const bar = $("[data-action-bar]");
    const hero = $("[data-hero]");
    const stop = $("#campaign");
    if (!bar || !hero || !("IntersectionObserver" in window)) return;
    let heroVisible = true, stopVisible = false;
    const link = $("a", bar);
    const update = () => {
      // в сцене hero остаётся на экране долго — панель появляется, когда окно сложилось
      const on = (!heroVisible || factsIn) && !stopVisible;
      bar.classList.toggle("is-visible", on);
      bar.setAttribute("aria-hidden", String(!on));
      link.tabIndex = on ? 0 : -1;
    };
    new IntersectionObserver(([e]) => { heroVisible = e.isIntersecting; update(); }).observe(hero);
    new IntersectionObserver(([e]) => { stopVisible = e.isIntersecting || e.boundingClientRect.top < 0; update(); }).observe(stop);
    return update;
  }

  /* Лид-форма: проверка на месте */
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
    heroVideo();
    videoModal();
    const barUpdate = actionBar() || (() => {});
    scene(barUpdate);
    lead();
  }
  if (window.TVSU?.ready) window.TVSU.ready.then(init);
  else document.addEventListener("DOMContentLoaded", init);
})();
