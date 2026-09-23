/* home-nika/c — «Лист». Движение на вендорном GSAP (ScrollTrigger, SplitText, MorphSVG, CustomEase), без three.js.
   Всё, что двигается, решено через gsap.matchMedia: при reduced-motion контексты не создаются (или откатываются),
   и страница остаётся статичной и разложенной. Слушателей scroll на window нет: только ScrollTrigger и IntersectionObserver. */
(function () {
  "use strict";

  const root = document.documentElement;
  const hasGsap = typeof window.gsap !== "undefined" && typeof window.ScrollTrigger !== "undefined";
  const REDUCE = "(prefers-reduced-motion: reduce)";
  const reduced = () => window.matchMedia(REDUCE).matches;

  if (hasGsap) {
    gsap.registerPlugin(ScrollTrigger, CustomEase);
    if (window.MorphSVGPlugin) gsap.registerPlugin(MorphSVGPlugin);
    CustomEase.create("nc-expo", "0.16, 1, 0.3, 1");   /* easeOutExpo: посадка крупных появлений */
    CustomEase.create("nc-io", "0.77, 0, 0.175, 1");   /* сильный in-out: линии и маски, движение по экрану */
  }

  /* ───────── 1. Интро: страница рождается из линий ─────────
     Зачем: первый и единственный раз показывает, из чего собран язык (линия → плоскость → лист → текст).
     Инструмент: WAAPI (element.animate). Интро идёт, пока страница ещё грузится, а transform/opacity на WAAPI
     считаются композитором и не рвутся от занятого главного потока. SplitText только режет h1 на строки.
     Кривые: линии и маски — сильный in-out (они «едут» по экрану), текст — easeOutExpo (посадка). Всего ≈ 2,3 с,
     ничего не блокирует: ссылки кликабельны сразу. Прерывание: включили reduced-motion — все анимации в конец. */
  const EXPO = "cubic-bezier(0.16, 1, 0.3, 1)";
  const IO = "cubic-bezier(0.77, 0, 0.175, 1)";
  const hero = document.querySelector("[data-hero]");
  const intro = () => {
    if (!root.classList.contains("nc-intro") || !hero) return;
    if (reduced() || !Element.prototype.animate) { root.classList.remove("nc-intro"); return; }

    const q = (s) => Array.from(hero.querySelectorAll(s));
    const one = (s) => q(s).slice(0, 1);
    const h1 = hero.querySelector("[data-hero-title]");
    const anims = [];
    /* at и step в секундах; fill both держит «до» на задержке и «после» до снятия класса */
    const play = (els, from, to, at, dur, easing, step) => els.forEach((el, i) => {
      anims.push(el.animate([from, to], { duration: dur * 1000, delay: (at + i * (step || 0)) * 1000, easing: easing || EXPO, fill: "both" }));
    });

    let split = null;
    try {
      if (window.SplitText) {
        if (hasGsap) gsap.registerPlugin(SplitText);
        split = SplitText.create(h1, { type: "lines", mask: "lines", linesClass: "nc-line" });
        (split.masks || []).forEach((m) => m.classList.add("nc-line-mask"));
      }
    } catch (e) { split = null; }

    play(q('[data-g="h"]'), { transform: "scaleX(0)" }, { transform: "scaleX(1)" }, 0, 0.9, IO, 0.06);
    play(q('[data-g="v"]'), { transform: "scaleY(0)" }, { transform: "scaleY(1)" }, 0.1, 0.9, IO, 0.06);
    play(one("[data-desk-fill]"), { clipPath: "inset(0 100% 0 0)" }, { clipPath: "inset(0 0% 0 0)" }, 0.35, 0.9, IO);
    play(one("[data-sheet]"), { clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0% 0)" }, 0.65, 0.8, IO);
    play(one("[data-shade]"), { opacity: 0, transform: "translate(-12px, -12px)" }, { opacity: 1, transform: "none" }, 1.0, 1.0);
    if (split && split.lines && split.lines.length) {
      h1.style.opacity = "1";
      play(split.lines, { transform: "translateY(120%)", filter: "blur(6px)" }, { transform: "none", filter: "blur(0px)" }, 0.5, 1.1, EXPO, 0.09);
    } else {
      play([h1], { opacity: 0, filter: "blur(6px)" }, { opacity: 1, filter: "blur(0px)" }, 0.5, 1.1);
    }
    play(q("[data-hero-fade]"), { opacity: 0, transform: "translateY(16px)" }, { opacity: 1, transform: "none" }, 0.9, 1.0, EXPO, 0.08);
    play(one(".nc-sheet__head"), { opacity: 0 }, { opacity: 1 }, 1.0, 0.6, "ease-out");
    play(q(".nc-toc__rule"), { transform: "scaleX(0)" }, { transform: "scaleX(1)" }, 1.0, 0.7, IO, 0.07);
    play(q(".nc-toc__link"), { opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }, 1.12, 0.8, EXPO, 0.07);
    play(q(".nc-aud__link"), { opacity: 0 }, { opacity: 1 }, 1.3, 0.8, "ease-out", 0.06);

    const mq = window.matchMedia(REDUCE);
    const onReduce = () => { if (mq.matches) anims.forEach((a) => a.finish()); };
    mq.addEventListener?.("change", onReduce);
    Promise.all(anims.map((a) => a.finished.catch(() => {}))).then(() => {
      root.classList.remove("nc-intro");
      h1.style.opacity = "";
      if (split) split.revert();
      anims.forEach((a) => a.cancel());
      mq.removeEventListener?.("change", onReduce);
    });
  };
  if (root.classList.contains("nc-intro")) {
    window.__ncIntro = true;
    const fonts = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    Promise.race([fonts, new Promise((r) => setTimeout(r, 500))]).then(intro);
  }

  /* ───────── 2. Лист листа: переворот «+» ─────────
     Зачем: пространственная связь — программы лежат «на обороте» того же листа. CSS transition transform 460 мс
     ease-in-out (движение по экрану), поэтому повторный клик разворачивает с текущего угла. Reduced-motion — мгновенно.
     Фокус: кнопка стоит перед листом, Tab после раскрытия идёт в программы; Esc закрывает и возвращает фокус. */
  const setLeaf = (btn, open, instant) => {
    const leaf = btn.closest(".nc-leaf");
    if (!leaf) return;
    const front = leaf.querySelector(".nc-leaf__front");
    const back = leaf.querySelector(".nc-leaf__back");
    if (instant) leaf.classList.add("is-instant");
    leaf.classList.toggle("is-flipped", open);
    btn.setAttribute("aria-expanded", String(open));
    if (front) front.inert = open;
    if (back) back.inert = !open;
    if (instant) requestAnimationFrame(() => requestAnimationFrame(() => leaf.classList.remove("is-instant")));
  };
  document.querySelectorAll("[data-leaf-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => setLeaf(btn, btn.getAttribute("aria-expanded") !== "true"));
    btn.closest(".nc-leaf")?.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && btn.getAttribute("aria-expanded") === "true") { setLeaf(btn, false); btn.focus(); }
    });
  });

  /* ───────── 3. Лид в одно поле: линия поля → галочка ───────── */
  const ask = document.querySelector("[data-ask]");
  let askSent = null;
  if (ask) {
    const input = ask.querySelector("#ask-contact");
    const err = ask.querySelector("#ask-contact-err");
    const done = ask.querySelector("[data-ask-done]");
    const again = ask.querySelector("[data-ask-again]");
    const svg = ask.querySelector(".nc-field__line");
    const path = ask.querySelector("[data-ask-line]");
    let W = 400;
    const lineD = () => `M0 47.5 L${W} 47.5`;
    const CHECK = "M6 30 L18 42 L42 14";
    const fit = (w) => {
      W = Math.max(48, Math.round(w || svg.getBoundingClientRect().width || 400));
      svg.setAttribute("viewBox", `0 0 ${W} 48`);
      if (!ask.classList.contains("is-sent")) { if (hasGsap) gsap.killTweensOf(path); path.setAttribute("d", lineD()); }
    };
    fit();
    if ("ResizeObserver" in window) new ResizeObserver(([e]) => fit(e.contentRect.width)).observe(svg);

    /* Зачем: подтверждение (feedback) там же, куда смотрел человек. Морф 520 мс nc-io — редкий момент успеха,
       поэтому длиннее UI-нормы. Прерывание: killTweensOf, новый морф стартует с текущей формы. */
    const morph = (d, instant) => {
      if (hasGsap) gsap.killTweensOf(path);
      if (instant || !hasGsap || !window.MorphSVGPlugin || reduced()) { path.setAttribute("d", d); return; }
      gsap.to(path, { morphSVG: d, duration: 0.52, ease: "nc-io" });
    };
    const valid = (v) => {
      const t = v.trim();
      return t.replace(/\D/g, "").length >= 11 || /^@[a-z0-9_]{5,32}$/i.test(t);
    };
    const setError = (on) => {
      err.hidden = !on;
      if (on) input.setAttribute("aria-invalid", "true");
      else input.removeAttribute("aria-invalid");
    };
    askSent = (contact, instant) => {
      fit();
      setError(false);
      ask.classList.add("is-sent");
      done.textContent = "Вопрос отправлен. Ответим на " + contact + " за [N] рабочих дня.";
      again.hidden = false;
      morph(CHECK, instant);
      if (!instant) again.focus({ preventScroll: true });
    };
    input.addEventListener("input", () => { if (!err.hidden && valid(input.value)) setError(false); });
    ask.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!valid(input.value)) { setError(true); input.focus(); return; }
      askSent(input.value.trim(), false);
    });
    again.addEventListener("click", () => {
      ask.classList.remove("is-sent");
      again.hidden = true;
      done.textContent = "";
      input.value = "";
      morph(lineD(), false);
      input.focus();
    });
  }

  /* ───────── 4. Движение по прокрутке (только с GSAP и без reduced-motion) ───────── */
  if (hasGsap) {
    const mm = gsap.matchMedia();

    /* 4a. Наклон листа за курсором. Зачем: бумага на столе, одно тихое «живое» касание первого экрана.
       quickTo 0,9 с power3.out — мягкое догоняние, прерывается само (каждое движение ретаргетит).
       Только мышь от 1024. Уход курсора — лист ложится обратно. */
    mm.add("(min-width: 1024px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)", () => {
      const stage = document.querySelector("[data-stage-sheet]");
      const tilt = document.querySelector("[data-tilt-sheet]");
      const shade = document.querySelector("[data-shade]");
      if (!hero || !stage || !tilt || !shade) return;
      gsap.set(tilt, { transformPerspective: 1200, transformOrigin: "50% 50%" });
      const o = { duration: 0.9, ease: "power3.out" };
      const rx = gsap.quickTo(tilt, "rotationX", o), ry = gsap.quickTo(tilt, "rotationY", o);
      const sx = gsap.quickTo(shade, "x", o), sy = gsap.quickTo(shade, "y", o);
      const clamp = gsap.utils.clamp(-1, 1);
      const move = (e) => {
        if (e.pointerType !== "mouse" || root.classList.contains("nc-intro")) return;
        const s = stage.getBoundingClientRect(), h = hero.getBoundingClientRect();
        const nx = clamp((e.clientX - (s.left + s.width / 2)) / (h.width / 2));
        const ny = clamp((e.clientY - (s.top + s.height / 2)) / (h.height / 2));
        ry(nx * 3); rx(-ny * 3); sx(-nx * 6); sy(-ny * 6);
      };
      const leave = () => { rx(0); ry(0); sx(0); sy(0); };
      hero.addEventListener("pointermove", move);
      hero.addEventListener("pointerleave", leave);
      return () => {
        hero.removeEventListener("pointermove", move);
        hero.removeEventListener("pointerleave", leave);
        gsap.set([tilt, shade], { clearProps: "transform" });
      };
    });

    /* 4b. Веер направлений. Зачем: объяснение — «шесть направлений это одна стопка университета».
       Pin на 90 % экрана (≤ 1 экрана), scrub 0.6: прокрутка остаётся прокруткой, в любой момент можно
       остановиться или вернуться — веер идёт назад по той же дороге. Кривые: веер power1.inOut, укладка power2.inOut
       лесенкой от центра. Только высокий десктоп: на низком экране пин съел бы листы. */
    mm.add("(min-width: 1024px) and (min-height: 860px) and (prefers-reduced-motion: no-preference)", () => {
      const band = document.querySelector("[data-fan-band]");
      const fan = band && band.querySelector("[data-fan]");
      if (!fan) return;
      const slots = gsap.utils.toArray(fan.children);
      const mid = (slots.length - 1) / 2;
      const dx = (i) => fan.clientWidth / 2 - (slots[i].offsetLeft + slots[i].offsetWidth / 2);
      const dy = (i) => fan.clientHeight / 2 - (slots[i].offsetTop + slots[i].offsetHeight / 2);
      gsap.set(slots, { transformOrigin: "50% 100%", transformPerspective: 1400, zIndex: (i) => slots.length - i }); /* сверху стопки — первое направление */
      const tl = gsap.timeline({
        defaults: { ease: "none" },
        scrollTrigger: {
          trigger: band,
          start: () => "top " + (document.querySelector(".site-header") ? 60 : 0) + "px",
          end: "+=90%", pin: true, scrub: 0.6, invalidateOnRefresh: true, anticipatePin: 1,
        },
      });
      tl.fromTo(slots,
        { x: (i) => dx(i) + (i - mid) * 6, y: (i) => dy(i) - (i - mid) * 4, rotation: (i) => (i - mid) * 2.2, rotationX: 0, scale: 0.92 },
        { x: (i) => dx(i) + (i - mid) * 150, y: (i) => dy(i) + (i - mid) * (i - mid) * 12, rotation: (i) => (i - mid) * 8, rotationX: 14, scale: 0.88, duration: 1, ease: "power1.inOut" })
        .to(slots, { x: 0, y: 0, rotation: 0, rotationX: 0, scale: 1, duration: 1.2, ease: "power2.inOut", stagger: { each: 0.05, from: "center" } })
        .to({}, { duration: 0.2 });
      return () => gsap.set(slots, { clearProps: "transform,zIndex" });
    });

    /* 4c. Линия времени. Зачем: состояние — точка показывает, докуда дочитана история; узел проявляется,
       когда точка его коснулась, и остаётся (назад не прячется, чтобы не мигать). Scrub 0.5 — точка слегка догоняет
       прокрутку. Проявление узла — CSS transition 700–900 мс expo, маска фото nc-io. */
    mm.add({ desk: "(min-width: 1024px)", motion: "(prefers-reduced-motion: no-preference)" }, (ctx) => {
      const { desk, motion } = ctx.conditions;
      const time = document.querySelector("[data-time]");
      if (!motion || !time) return;
      const track = time.querySelector(".nc-time__track");
      const trail = time.querySelector("[data-time-trail]");
      const dot = time.querySelector("[data-time-dot]");
      const items = Array.from(time.querySelectorAll("[data-t]"));
      time.classList.add("is-live");
      const setTrail = gsap.quickSetter(trail, desk ? "scaleX" : "scaleY");
      const setDot = gsap.quickSetter(dot, desk ? "x" : "y", "px");
      const state = { p: 0 };
      let len = 0, marks = [];
      const measure = () => {
        const t = track.getBoundingClientRect();
        len = desk ? t.width : t.height;
        marks = items.map((it) => {
          const r = it.getBoundingClientRect();
          return len ? (desk ? (r.left - t.left) : (r.top + Math.min(24, r.height / 2) - t.top)) / len : 0;
        });
      };
      const render = () => {
        const p = state.p;
        setTrail(p);
        setDot(p * Math.max(0, len - 16));
        if (p <= 0) return;
        items.forEach((it, i) => { if (p + 0.02 >= marks[i]) it.classList.add("is-on"); });
      };
      measure(); render();
      gsap.to(state, {
        p: 1, ease: "none", onUpdate: render,
        scrollTrigger: {
          trigger: time, start: desk ? "top 70%" : "top 80%", end: desk ? "bottom 55%" : "bottom 65%",
          scrub: 0.5, onRefresh: () => { measure(); render(); },
        },
      });
      return () => {
        time.classList.remove("is-live");
        items.forEach((it) => it.classList.remove("is-on"));
        gsap.set([trail, dot], { clearProps: "transform" });
      };
    });

    /* 4d. Циферблат приёма. Зачем: состояние кампании одним жестом — дуга дорисовывается до пройденной доли.
       Один раз при входе (не scrub: число не должно «ездить» от прокрутки). WAAPI: дуга 1,6 с сильный in-out,
       число и точки — посадка expo. Прерывание: смена медиа-условия (reduced-motion) откатывает контекст — всё статично. */
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      const dial = document.querySelector("[data-dial]");
      if (!dial || !Element.prototype.animate) return;
      const arc = dial.querySelector("[data-dial-arc]");
      const final = String(parseFloat(getComputedStyle(arc).strokeDashoffset) || 0.54);
      const past = Array.from(dial.querySelectorAll(".nc-dial__stop.is-past"));
      const next = Array.from(dial.querySelectorAll(".nc-dial__stop:not(.is-past)"));
      const center = dial.querySelector(".nc-dial__center");
      const anims = [];
      const a = (el, kf, o) => anims.push(el.animate(kf, Object.assign({ fill: "both", easing: EXPO }, o)));
      dial.classList.add("is-live");
      const run = () => {
        a(arc, [{ strokeDashoffset: "1" }, { strokeDashoffset: final }], { duration: 1600, easing: IO });
        past.forEach((el) => a(el, [{ opacity: 0, transform: "scale(0.6)" }, { opacity: 1, transform: "none" }], { duration: 600 }));
        a(center, [{ opacity: 0, transform: "translateY(16px)" }, { opacity: 1, transform: "none" }], { duration: 1000, delay: 250 });
        next.forEach((el, i) => a(el, [{ opacity: 0, transform: "scale(0.6)" }, { opacity: 1, transform: "none" }], { duration: 600, delay: 1200 + i * 120 }));
        dial.classList.add("is-run");
        Promise.all(anims.map((x) => x.finished.catch(() => {}))).then(() => anims.forEach((x) => x.cancel()));
      };
      const st = ScrollTrigger.create({ trigger: dial, start: "top 75%", once: true, onEnter: run });
      return () => { st.kill(); anims.forEach((x) => x.cancel()); dial.classList.remove("is-live", "is-run"); };
    });

    /* Шапка и подвал вставляются партиалами — после них пересчитать позиции триггеров */
    const refresh = () => ScrollTrigger.refresh();
    if (window.TVSU && window.TVSU.ready) window.TVSU.ready.then(refresh);
    window.addEventListener("load", refresh, { once: true });
  }

  /* ───────── 5. Липкая панель на мобильном: после первого экрана и до «Приёма» ───────── */
  const dock = document.querySelector("[data-dock]");
  const adm = document.getElementById("admission");
  if (dock && hero && adm && "IntersectionObserver" in window) {
    const btn = dock.querySelector("a");
    let heroGone = false, admReached = false;
    const update = () => {
      const on = heroGone && !admReached;
      dock.classList.toggle("is-visible", on);
      dock.setAttribute("aria-hidden", String(!on));
      if (btn) btn.tabIndex = on ? 0 : -1;
    };
    new IntersectionObserver(([e]) => { heroGone = !e.isIntersecting && e.boundingClientRect.top < 0; update(); }).observe(hero);
    new IntersectionObserver(([e]) => { admReached = e.isIntersecting || e.boundingClientRect.top < 0; update(); }).observe(adm);
  }

  /* ───────── Состояния для скриншотов: ?state=leaf-open,ask-sent ───────── */
  const applyStates = () => {
    const states = (window.TVSU && window.TVSU.states) || new Set();
    if (states.has("leaf-open")) {
      const b = document.querySelector("[data-leaf-toggle]");
      if (b) setLeaf(b, true, true);
    }
    if (states.has("ask-sent") && askSent) askSent("+7 900 000-00-00", true);
  };
  if (window.TVSU && window.TVSU.ready) window.TVSU.ready.then(applyStates);
  else document.addEventListener("partials:ready", applyStates, { once: true });
})();
