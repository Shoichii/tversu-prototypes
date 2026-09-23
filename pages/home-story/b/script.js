/* home-story/b — поведение варианта «Видео-история» */
(function () {
  "use strict";
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  const small = matchMedia("(max-width: 767px)");
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const motionOn = !reduce.matches && "IntersectionObserver" in window;

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

  /* Видеолуп: на ≥768 сам (если движение разрешено и сеть не медленная), на мобильном — по кнопке */
  function heroVideo() {
    const v = $("[data-hero-video]");
    const btn = $("[data-hero-toggle]");
    const label = $("[data-hero-toggle-label]");
    if (!v || !btn) return;
    const conn = navigator.connection;
    const goodNet = !conn || (!conn.saveData && !/(^|-)(2g|3g)$/.test(conn.effectiveType || ""));
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
      btn.setAttribute("aria-pressed", String(!playing && loaded));
      label.textContent = playing ? "Пауза" : "Смотреть видео";
    };
    const play = () => { load(); v.play().then(() => setUi(true)).catch(() => setUi(false)); };
    btn.hidden = false;
    btn.addEventListener("click", () => {
      if (v.paused) { delete v.dataset.userPaused; play(); }
      else { v.pause(); v.dataset.userPaused = "1"; setUi(false); }
    });
    setUi(false);
    if (reduce.matches || isSmall || !goodNet) return;
    play();
    reduce.addEventListener?.("change", () => { if (reduce.matches) { v.pause(); setUi(false); } });
    new IntersectionObserver(([e]) => {
      if (!loaded || v.dataset.userPaused) return;
      if (e.isIntersecting) v.play().catch(() => {}); else v.pause();
    }).observe(v);
  }

  /* Авторский момент: кино-главы.
     ≥1024 и движение разрешено → .story.is-cine: справа закреплённый экран, кадры глав сменяются шторкой,
     номер щёлкает, как табло. Рейка слева — масляная шкала чтения (один rAF с инерцией, пока идёт догонка).
     Reduced-motion и узкие экраны — главы с фигурами в потоке, шкала ставится без инерции. */
  function buildCine(story, chapters) {
    const cine = document.createElement("div");
    cine.className = "cine";
    cine.setAttribute("aria-hidden", "true");
    const shots = chapters.map((ch) => {
      const img = ch.querySelector(".chapter__fig img");
      const f = document.createElement("figure");
      f.className = "cine__shot";
      if (img) {
        const c = img.cloneNode();
        c.alt = ""; c.removeAttribute("loading"); c.decoding = "async";
        f.append(c);
      }
      return f;
    });
    const reel = chapters.map((_, i) => `<span>${i + 1}</span>`).join("");
    cine.innerHTML = `<div class="cine__pin"><div class="cine__screen"></div>
      <div class="cine__bar"><span class="cine__board num"><span>0</span><span class="cine__digit"><span class="cine__reel">${reel}</span></span></span>
      <span class="cine__cap"><span class="cine__cap-title"></span><span class="cine__cap-text"></span></span></div></div>`;
    cine.querySelector(".cine__screen").append(...shots);
    story.querySelector(".story__grid").append(cine);
    const reelEl = cine.querySelector(".cine__reel");
    const cap = cine.querySelector(".cine__cap");
    const capT = cap.querySelector(".cine__cap-title"), capX = cap.querySelector(".cine__cap-text");
    let cur = -1;
    return (idx) => {
      if (idx < 0 || idx === cur) return;
      const first = cur < 0;
      cur = idx;
      shots.forEach((s, i) => {
        s.classList.toggle("is-on", i <= idx);
        s.classList.toggle("is-under", i < idx);
      });
      reelEl.style.setProperty("--ci", idx);
      capT.textContent = chapters[idx].querySelector(".chapter__title")?.textContent.trim() || "";
      capX.textContent = chapters[idx].querySelector("figcaption")?.textContent.trim() || "";
      if (!first) { cap.classList.remove("is-swap"); void cap.offsetWidth; cap.classList.add("is-swap"); }
    };
  }

  function storyRail() {
    const story = $("[data-story]");
    const fill = $("[data-story-fill]");
    const links = $$("[data-toc]");
    const chapters = $$("[data-chapter]");
    if (!story || !fill || !chapters.length) return;

    let showShot = null;
    if (motionOn) {
      story.classList.add("is-cine");
      showShot = buildCine(story, chapters);
      // на широком экране фигуры глав уходят в экран — общий слой не должен ждать их появления
      const wide = matchMedia("(min-width: 1024px)");
      const sync = () => { if (wide.matches) $$(".chapter__fig[data-m]", story).forEach((f) => window.TVSU_MOTION?.reveal(f)); };
      sync(); wide.addEventListener?.("change", sync);
    }

    const setCurrent = (id) => {
      let passed = true;
      links.forEach((a) => {
        const cur = a.dataset.toc === id;
        if (cur) passed = false;
        a.classList.toggle("is-current", cur);
        a.classList.toggle("is-passed", passed && !cur);
        if (cur) a.setAttribute("aria-current", "step"); else a.removeAttribute("aria-current");
      });
      // «свет в зале»: текущая глава в полную яркость, остальные приглушены (CSS только при .is-cine на ≥1024)
      chapters.forEach((c) => c.classList.toggle("is-current", c.id === id));
      showShot?.(chapters.findIndex((c) => c.id === id));
    };

    if ("IntersectionObserver" in window) {
      // текущая глава — первая по порядку из пересекающих полосу у середины экрана
      const seen = new Set();
      const io = new IntersectionObserver((entries) => {
        entries.forEach((e) => { if (e.isIntersecting) seen.add(e.target); else seen.delete(e.target); });
        const first = chapters.find((c) => seen.has(c));
        if (first) setCurrent(first.id);
      }, { rootMargin: "-40% 0px -55% 0px" });
      setCurrent(chapters[0].id);
      chapters.forEach((c) => io.observe(c));
    }

    // шкала: прогресс чтения истории (0 — верх истории у середины экрана, 1 — конец); догоняет цель с инерцией
    let target = 0, shown = 0, raf = 0;
    const read = () => {
      const r = story.getBoundingClientRect();
      target = Math.min(1, Math.max(0, (innerHeight * 0.5 - r.top) / Math.max(1, r.height - innerHeight * 0.5)));
    };
    const paint = () => { fill.style.transform = `scaleY(${shown.toFixed(4)})`; };
    const loop = () => {
      read();
      shown += (target - shown) * 0.1;
      if (Math.abs(target - shown) < 0.0005) { shown = target; raf = 0; paint(); return; }
      paint();
      raf = requestAnimationFrame(loop);
    };
    const onScroll = () => {
      if (!motionOn) { read(); shown = target; paint(); return; }
      if (!raf) raf = requestAnimationFrame(loop);
    };
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll, { passive: true });
    read(); shown = target; paint();
  }

  /* Три входа: аккордеоны на мобильном, открытые колонки с 768 */
  function audiences() {
    const rows = $$("[data-aud]");
    const apply = () => rows.forEach((d, i) => { d.open = small.matches ? i === 0 : true; });
    rows.forEach((d) => d.querySelector("summary").addEventListener("click", (e) => { if (!small.matches) e.preventDefault(); }));
    apply();
    small.addEventListener?.("change", apply);
  }

  function people() {
    if (window.TVSU?.states?.has("people-hover")) $(".person")?.classList.add("is-hover");
  }

  /* Поиск по направлениям: фильтр строк на клиенте, пустое состояние */
  function programs() {
    const form = $("[data-prog-search]");
    const q = $("[data-prog-q]");
    const rows = $$("[data-prog]");
    const empty = $("[data-prog-empty]");
    const term = $("[data-prog-term]");
    const head = $(".ptable__head");
    if (!form || !q) return;
    const norm = (s) => s.toLowerCase().replace(/ё/g, "е").trim();
    const run = () => {
      const t = norm(q.value);
      let shown = 0;
      rows.forEach((li) => {
        const hay = norm(li.textContent + " " + li.dataset.prog);
        const ok = !t || t.split(/\s+/).every((w) => hay.includes(w));
        li.hidden = !ok;
        if (ok) shown++;
      });
      empty.hidden = shown > 0;
      if (head) head.hidden = shown === 0;
      term.textContent = q.value.trim();
    };
    q.addEventListener("input", run);
    form.addEventListener("submit", (e) => { e.preventDefault(); run(); });
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
      const ok = /^@[\w\d_]{4,}$/.test(v) || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
      input.setAttribute("aria-invalid", String(!ok));
      err.hidden = ok;
      done.hidden = !ok;
      if (!ok) input.focus();
    });
  }

  /* Узлы общего слоя, которых нет на этой ширине (оглавление hero и архивное фото на мобильном)
     или которые лежат в горизонтальной ленте за краем экрана, наблюдатель не увидит — показываем сразу */
  function motionFixups() {
    const M = window.TVSU_MOTION;
    if (!M || !motionOn) return;
    $$("[data-m]:not(.m-in)").forEach((el) => { if (!el.getClientRects().length) M.reveal(el); });
    if (small.matches) $$(".people__track > [data-m]").forEach((el) => M.reveal(el));
  }

  function init() {
    motionFixups();
    countdowns();
    heroVideo();
    storyRail();
    audiences();
    people();
    programs();
    actionBar();
    lead();
  }
  if (window.TVSU?.ready) window.TVSU.ready.then(init);
  else document.addEventListener("DOMContentLoaded", init);
})();
