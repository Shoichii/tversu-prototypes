/* home-live/e — «Квест: поступи».
   Механика: pin-сцена с фишкой на MotionPath (≥1200×760), вертикальная дорога (меньше), тетрис-статы,
   курсор выбора персонажа, инструменты уровней (направления, калькулятор, чек-лист), видео уровня 5, лид.
   Никаких scroll-listener'ов: всё через ScrollTrigger / IntersectionObserver. */
(() => {
  "use strict";
  const doc = document.documentElement;
  const reduceMQ = matchMedia("(prefers-reduced-motion: reduce)");
  const G = window.gsap, ST = window.ScrollTrigger, MP = window.MotionPathPlugin;
  if (window.__qIntroT) clearTimeout(window.__qIntroT);
  const live = doc.classList.contains("q-live") && !reduceMQ.matches && !!(G && ST && MP);
  if (!live) doc.classList.remove("q-live", "q-intro");
  else G.registerPlugin(ST, MP);

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const quest = $("[data-quest]");
  const offer = $("[data-offer]");
  const levels = $$(".level", quest);
  const stops = $$(".stop", quest);
  const nodes = [1, 2, 3, 4, 5].map((i) => $("#q-node-" + i));
  const hudLevel = $("[data-hud-level]");
  const hudBar = $("[data-hud-bar]");

  const state = { picks: new Set(), calc: null, docs: 0, reached: 0 };
  let mode = "static";
  let cur = 0;
  let goPin = null;

  /* ───────── общие отметки уровня ───────── */
  function hud(n) {
    if (hudLevel) hudLevel.textContent = n;
    if (hudBar) hudBar.style.setProperty("--xp", n / 5);
  }
  function markBoard(n) {
    stops.forEach((s, i) => { s.classList.toggle("is-reached", i + 1 < n); s.classList.toggle("is-current", i + 1 === n); });
    nodes.forEach((g, i) => { if (!g) return; g.classList.toggle("is-reached", i + 1 < n); g.classList.toggle("is-current", i + 1 === n); });
  }
  function popNode(n) {
    const g = nodes[n - 1];
    if (!g || !live) return;
    G.fromTo(g.querySelector(".node__body"), { scale: 1.45 }, { scale: 1, duration: 0.18, ease: "back.out(3)", transformOrigin: "50% 50%", overwrite: "auto" });
    G.fromTo(g.querySelector(".node__burst"), { scale: 1, opacity: 0.95 }, { scale: 2.2, opacity: 0, duration: 0.34, ease: "power2.out", transformOrigin: "50% 50%", overwrite: "auto" });
    G.fromTo("#q-token-body", { scaleX: 1.16, scaleY: 0.82 }, { scaleX: 1, scaleY: 1, duration: 0.2, ease: "back.out(3)", transformOrigin: "50% 70%", overwrite: "auto" });
  }
  function reach(n) {
    if (n > state.reached) { state.reached = n; renderProgress(); }
  }

  /* ───────── PIN: закреплённая сцена ───────── */
  function setLevel(n) {
    if (n === cur) return;
    const fwd = n > cur;
    cur = n;
    quest.classList.toggle("is-playing", n > 0);
    offer.inert = n > 0;
    levels.forEach((li, i) => {
      const on = i + 1 === n;
      li.classList.toggle("is-active", on);
      li.inert = !on;
    });
    markBoard(n);
    hud(n);
    if (fwd && n > 0) popNode(n);
    reach(n);
    syncVideo();
  }

  function initPin() {
    mode = "pin";
    const road = $("#q-road");
    const token = $("#q-token");
    const trail = $(".road__trail");
    const FR = [0, 0.1186, 0.3471, 0.5955, 0.7385, 1];
    const MOVE = 1, HOLD = 0.7, LAST = 1.1;

    levels.forEach((li) => (li.inert = true));
    G.set(token, { x: 70, y: 580 });
    G.set(trail, { strokeDasharray: "1 2", strokeDashoffset: 1 });

    const tl = G.timeline({ paused: true, defaults: { ease: "power1.inOut" } });
    const arrive = [0];
    for (let i = 1; i <= 5; i++) {
      tl.to(token, { motionPath: { path: road, start: FR[i - 1], end: FR[i] }, duration: MOVE });
      tl.to(trail, { strokeDashoffset: 1 - FR[i], duration: MOVE }, "<");
      arrive[i] = tl.duration();
      tl.to({}, { duration: i === 5 ? LAST : HOLD });
    }
    tl.eventCallback("onUpdate", () => {
      const t = tl.time();
      let n = 0;
      for (let i = 5; i >= 1; i--) if (t >= arrive[i] - 0.001) { n = i; break; }
      setLevel(n);
    });

    const st = ST.create({
      trigger: quest, pin: true, start: "top top", end: "+=200%",
      scrub: 0.6, animation: tl, anticipatePin: 1, invalidateOnRefresh: true,
    });

    goPin = (n) => {
      const t = n === 0 ? 0 : arrive[n] + HOLD * 0.35;
      const y = st.start + (st.end - st.start) * (t / tl.duration());
      smoothTo(y, () => { setLevel(n); focusLevel(n); });
    };

    return () => {
      goPin = null;
      setLevel(0);
      quest.classList.remove("is-playing");
      offer.inert = false;
      levels.forEach((li) => { li.inert = false; li.classList.remove("is-active"); });
      markBoard(0);
      mode = "static";
    };
  }

  /* ───────── RAIL: вертикальная дорога ───────── */
  function initRail() {
    mode = "rail";
    const track = $(".track", quest);
    const tok = $(".rail__token", quest);
    const tokBody = $(".token__body", tok);
    G.fromTo(tok, { y: 0 }, {
      y: () => track.clientHeight - tok.offsetHeight + 8, ease: "none",
      scrollTrigger: { trigger: track, start: "top 55%", end: "bottom 55%", scrub: 0.5, invalidateOnRefresh: true },
    });
    const railSet = (n, fwd) => {
      levels.forEach((li, i) => {
        li.classList.toggle("is-reached", i + 1 < n);
        li.classList.toggle("is-current", i + 1 === n);
      });
      hud(n);
      reach(n);
      if (!fwd || n < 1) return;
      const li = levels[n - 1];
      G.fromTo($(".level__node", li), { scale: 1.4 }, { scale: 1, duration: 0.18, ease: "back.out(3)", overwrite: "auto" });
      G.fromTo($(".lv", li), { scale: 0.97 }, { scale: 1, duration: 0.2, ease: "back.out(2.5)", transformOrigin: "0% 30%", overwrite: "auto" });
      G.fromTo(tokBody, { scaleX: 1.16, scaleY: 0.82 }, { scaleX: 1, scaleY: 1, duration: 0.2, ease: "back.out(3)", transformOrigin: "50% 70%", overwrite: "auto" });
    };
    levels.forEach((li, i) => {
      ST.create({
        trigger: li, start: () => "top+=" + (li.querySelector(".level__node").offsetTop + 18) + " 55%",
        onEnter: () => railSet(i + 1, true),
        onLeaveBack: () => railSet(i, false),
      });
    });
    return () => {
      levels.forEach((li) => li.classList.remove("is-reached", "is-current"));
      hud(0);
      mode = "static";
    };
  }

  /* ───────── интро: заголовок, оффер, доска ───────── */
  function initIntro() {
    doc.classList.remove("q-intro"); // до создания твинов: GSAP читает трансформы без CSS-заготовок, инлайны ставятся до кадра
    const lines = $$(".quest__title .ln > span");
    G.timeline({ defaults: { ease: "expo.out" } })
      .fromTo(lines, { yPercent: 105 }, { yPercent: 0, duration: 0.9, stagger: 0.08 }, 0.05)
      .fromTo([$(".hud"), offer], { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.1, clearProps: "transform" }, 0.3);

    const bt = G.timeline({ paused: true, defaults: { ease: "expo.out" } })
      .fromTo(".board__blob", { opacity: 0, scale: 0.6 }, { opacity: 1, scale: 1, duration: 1, transformOrigin: "50% 50%" }, 0)
      .fromTo(".road", { strokeDasharray: "1 2", strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.95, ease: "power2.inOut" }, 0.1)
      .fromTo(".road__dash", { opacity: 0 }, { opacity: 0.9, duration: 0.3, ease: "none" }, 0.95)
      .fromTo(".node__body", { scale: 0 }, { scale: 1, duration: 0.18, ease: "back.out(3)", stagger: 0.07, transformOrigin: "50% 50%" }, 0.6)
      .fromTo([".board__flag", ".board__ring", ".board__spark"], { opacity: 0 }, { opacity: 1, duration: 0.2, ease: "none" }, 0.95)
      .fromTo("#q-token-body", { scale: 1, y: -90, opacity: 0 }, { y: 0, opacity: 1, duration: 0.2, ease: "power3.in" }, 1.0)
      .fromTo("#q-token-body", { scaleX: 1.2, scaleY: 0.78 }, { scaleX: 1, scaleY: 1, duration: 0.18, ease: "back.out(3)", transformOrigin: "50% 80%", immediateRender: false }, 1.2)
      .fromTo([".board__start", ...stops], { scale: 0 }, { scale: 1, duration: 0.18, ease: "back.out(2.5)", stagger: 0.06, clearProps: "transform" }, 1.15);

    const board = $(".quest__board");
    ST.create({ trigger: board, start: "top 85%", once: true, onEnter: () => bt.play() });
  }

  /* ───────── тетрис-статы ───────── */
  function initWell() {
    const well = $("[data-well]");
    if (!well) return;
    const pieces = $$(".piece", well);
    let played = false;
    const lift = () => { if (!played) G.set(pieces, { y: -well.clientHeight - 16 }); };
    lift();
    ST.addEventListener("refreshInit", lift);
    ST.create({
      trigger: well, start: "top 78%", once: true,
      onEnter: () => {
        played = true;
        const order = pieces.slice().sort((a, b) =>
          (b.offsetTop + b.offsetHeight) - (a.offsetTop + a.offsetHeight) || a.offsetLeft - b.offsetLeft);
        const tl = G.timeline();
        order.forEach((p, i) => {
          const at = i * 0.2;
          tl.to(p, { y: 0, duration: 0.32, ease: "power3.in" }, at)
            .to(p, { keyframes: [{ scaleY: 0.93, duration: 0.05, ease: "power1.out" }, { scaleY: 1, duration: 0.12, ease: "back.out(3)" }], transformOrigin: "50% 100%" }, at + 0.32)
            .to(well, { keyframes: [{ y: 3, duration: 0.05 }, { y: 0, duration: 0.12, ease: "back.out(3)" }] }, at + 0.32);
        });
      },
    });
  }

  /* ───────── плавная прокрутка к точке + фокус ───────── */
  function smoothTo(y, done) {
    const behavior = reduceMQ.matches ? "auto" : "smooth";
    let fired = false;
    const fin = () => { if (fired) return; fired = true; window.removeEventListener("scrollend", fin); done && done(); };
    if (Math.abs(window.scrollY - y) < 2) { fin(); return; }
    window.addEventListener("scrollend", fin, { once: true });
    setTimeout(fin, 1400);
    window.scrollTo({ top: y, behavior });
  }
  function focusLevel(n) {
    const target = n === 0 ? $("#quest-title") : levels[n - 1];
    if (!target) return;
    if (n === 0) return;
    target.focus({ preventScroll: true });
  }
  document.addEventListener("click", (e) => {
    const a = e.target.closest("[data-goto]");
    if (!a) return;
    const n = +a.dataset.goto;
    const li = levels[n - 1];
    if (!li) return;
    e.preventDefault();
    if (mode === "pin" && goPin) { goPin(n); return; }
    li.scrollIntoView({ behavior: reduceMQ.matches ? "auto" : "smooth", block: "start" });
    li.focus({ preventScroll: true });
  });

  /* ───────── уровень 1: направления ───────── */
  const DIRS = { it: "IT и математика", nat: "Естественные науки", hum: "Гуманитарные", ped: "Педагогика", econ: "Экономика и право", sport: "Спорт" };
  const picksOut = $("[data-picks-out]");
  const calcDir = $("#calc-dir");
  function setPick(btn, on) {
    btn.setAttribute("aria-pressed", on ? "true" : "false");
    const key = btn.dataset.pick;
    if (on) state.picks.add(key); else state.picks.delete(key);
    const names = [...state.picks].map((k) => DIRS[k]);
    picksOut.textContent = names.length
      ? `Выбрано: ${names.join(", ")}. Программ под выбор: [N]. Экзамены и порог — на уровне 2.`
      : "Пока ничего не выбрано. Программ под выбор: [N].";
    if (on && calcDir) { calcDir.value = key; syncSubjects(); }
    renderProgress();
  }
  $$("[data-pick]").forEach((btn) => btn.addEventListener("click", () => {
    const on = btn.getAttribute("aria-pressed") !== "true";
    setPick(btn, on);
    if (live) { btn.classList.remove("is-pop"); void btn.offsetWidth; btn.classList.add("is-pop"); }
  }));

  /* ───────── уровень 2: калькулятор ───────── */
  const calc = $("[data-calc]");
  const calcOut = $("[data-calc-out]");
  function syncSubjects() {
    const o = calcDir.selectedOptions[0];
    $("[data-e2]", calc).textContent = o.dataset.e2;
    $("[data-e3]", calc).textContent = o.dataset.e3;
  }
  function runCalc() {
    const inputs = ["calc-1", "calc-2", "calc-3"].map((id) => $("#" + id));
    let bad = false;
    const vals = inputs.map((inp) => {
      const raw = inp.value.trim();
      const v = Number(raw);
      const ok = raw !== "" && Number.isFinite(v) && v >= 0 && v <= 100;
      inp.setAttribute("aria-invalid", ok ? "false" : "true");
      if (!ok) bad = true;
      return v;
    });
    calcOut.classList.remove("is-pass", "is-fail", "is-stamp");
    if (bad) {
      calcOut.textContent = "Впиши баллы по всем трём предметам — от 0 до 100";
      state.calc = null;
      renderProgress();
      return;
    }
    const sum = vals.reduce((a, b) => a + b, 0);
    const o = calcDir.selectedOptions[0];
    const min = +o.dataset.min;
    const diff = sum - min;
    state.calc = { sum, dir: o.value };
    if (diff >= 0) {
      calcOut.textContent = `Сумма ${sum} из 300. Порог-пример ${min} — проходишь с запасом ${diff}.`;
      calcOut.classList.add("is-pass");
    } else {
      calcOut.textContent = `Сумма ${sum} из 300. До порога-примера ${min} не хватает ${-diff}: смотри платное и целевое обучение.`;
      calcOut.classList.add("is-fail");
    }
    if (live) { void calcOut.offsetWidth; calcOut.classList.add("is-stamp"); }
    renderProgress();
  }
  if (calc) {
    calcDir.addEventListener("change", syncSubjects);
    calc.addEventListener("submit", (e) => { e.preventDefault(); runCalc(); });
  }

  /* ───────── уровень 3: чек-лист ───────── */
  const docsOut = $("[data-docs-out]");
  const docBoxes = $$("[data-doc]");
  function syncDocs() {
    state.docs = docBoxes.filter((b) => b.checked).length;
    docsOut.textContent = `Готово ${state.docs} из 3`;
    renderProgress();
  }
  docBoxes.forEach((b) => b.addEventListener("change", syncDocs));

  /* ───────── панель прогресса в лиде ───────── */
  const cells = $$("[data-cell]");
  const progressSum = $("[data-progress-sum]");
  function renderProgress() {
    const on = [state.picks.size > 0, !!state.calc, state.docs > 0, state.reached >= 4, state.reached >= 5];
    cells.forEach((c, i) => {
      const was = c.classList.contains("is-on");
      c.classList.toggle("is-on", on[i]);
      if (on[i] && !was && live) { c.classList.remove("is-pop"); void c.offsetWidth; c.classList.add("is-pop"); }
    });
    const parts = [];
    if (state.picks.size) parts.push("интересы: " + [...state.picks].map((k) => DIRS[k]).join(", "));
    if (state.calc) parts.push(`баллы: ${state.calc.sum} из 300`);
    if (state.docs) parts.push(`документы: ${state.docs} из 3`);
    progressSum.textContent = parts.length
      ? "Сохранится — " + parts.join(" · ") + "."
      : "Пока пусто: отметь направление на уровне 1 и посчитай баллы на уровне 2.";
  }

  /* ───────── лид ───────── */
  const lead = $("[data-lead]");
  function leadDone() {
    $("[data-lead-fields]", lead).hidden = true;
    const done = $("[data-lead-done]", lead);
    done.hidden = false;
    return done;
  }
  if (lead) {
    const input = $("#lead-contact");
    const err = $("[data-lead-error]", lead);
    lead.addEventListener("submit", (e) => {
      e.preventDefault();
      const v = input.value.trim();
      const ok = /^@?[A-Za-z0-9_]{5,32}$/.test(v) || v.replace(/\D/g, "").length >= 10;
      input.setAttribute("aria-invalid", ok ? "false" : "true");
      err.hidden = ok;
      if (!ok) { input.focus(); return; }
      leadDone().focus();
    });
  }

  /* ───────── видео уровня 5 ───────── */
  const clip = $("[data-clip]");
  const video = clip && $("video", clip);
  const toggle = clip && $("[data-clip-toggle]", clip);
  let inView = false, userPaused = false, userPlay = false;
  function syncVideo() {
    if (!video) return;
    const allowedByMode = mode !== "pin" || cur === 5;
    const want = inView && !document.hidden && allowedByMode && (userPlay || (!reduceMQ.matches && !userPaused));
    if (want && video.paused) video.play().catch(() => {});
    else if (!want && !video.paused) video.pause();
  }
  if (video) {
    const label = () => {
      const playing = !video.paused;
      toggle.textContent = playing ? "Пауза" : "Смотреть";
      toggle.setAttribute("aria-pressed", playing ? "true" : "false");
    };
    video.addEventListener("play", label);
    video.addEventListener("pause", label);
    toggle.addEventListener("click", () => {
      if (video.paused) { userPlay = true; userPaused = false; } else { userPaused = true; userPlay = false; }
      if (userPlay) video.play().catch(() => {}); else video.pause();
    });
    new IntersectionObserver((es) => { inView = es[es.length - 1].isIntersecting; syncVideo(); }, { threshold: 0.2 }).observe(clip);
    document.addEventListener("visibilitychange", syncVideo);
    reduceMQ.addEventListener?.("change", syncVideo);
  }

  /* ───────── персонажи: курсор P1 ───────── */
  const stage = $("[data-chars]");
  if (stage) {
    const cursor = $(".chars__cursor", stage);
    const chars = $$("[data-char]", stage);
    let selected = chars.find((c) => c.classList.contains("is-selected")) || chars[0];
    const place = (el, instant) => {
      if (instant) cursor.style.transition = "none";
      cursor.style.setProperty("--cw", el.offsetWidth + 20 + "px");
      cursor.style.setProperty("--ch", el.offsetHeight + 20 + "px");
      cursor.style.setProperty("--cx", el.offsetLeft - 10 + "px");
      cursor.style.setProperty("--cy", el.offsetTop - 10 + "px");
      if (instant) { void cursor.offsetWidth; cursor.style.transition = ""; }
      cursor.classList.add("is-ready");
    };
    const select = (el) => {
      if (el === selected) return;
      selected.classList.remove("is-selected");
      selected = el;
      el.classList.add("is-selected");
      el.classList.remove("is-hop"); void el.offsetWidth; el.classList.add("is-hop");
      place(el);
    };
    const fine = matchMedia("(hover: hover) and (pointer: fine)");
    chars.forEach((el) => {
      el.addEventListener("pointerenter", () => { if (fine.matches) place(el); });
      el.addEventListener("click", () => select(el));
      el.addEventListener("focusin", () => select(el));
    });
    stage.addEventListener("pointerleave", () => { if (fine.matches) place(selected); });
    new ResizeObserver(() => place(selected, true)).observe(stage);
  }

  /* ───────── запуск ───────── */
  if (calc) syncSubjects();

  if (live) {
    initIntro();
    initWell();
    const mm = G.matchMedia();
    mm.add("(min-width: 1200px) and (min-height: 760px)", initPin);
    mm.add("(max-width: 1199.98px), (max-height: 759.98px)", initRail);
  }

  const ready = (window.TVSU && window.TVSU.ready) || Promise.resolve();
  ready.then(() => {
    const states = (window.TVSU && window.TVSU.states) || new Set();
    if (states.has("calc-result")) {
      const it = $('[data-pick="it"]');
      if (it) setPick(it, true);
      calcDir.value = "it"; syncSubjects();
      $("#calc-1").value = 78; $("#calc-2").value = 82; $("#calc-3").value = 74;
      runCalc();
      if (docBoxes[0]) { docBoxes[0].checked = true; syncDocs(); }
    }
    if (states.has("lead-sent") && lead) {
      $("#lead-contact").value = "@abiturient_tver";
      leadDone();
    }
    if (live) {
      const refresh = () => ST.refresh();
      (document.fonts ? document.fonts.ready : Promise.resolve()).then(refresh);
      requestAnimationFrame(refresh);
    }
  });
})();
