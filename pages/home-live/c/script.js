/* home-live/c — «Плакат 1870».
   Статика (всегда): табло из барабанов, календарь по дням, лид со штампом, липкая панель на мобильном.
   Движение (только html.m-on + GSAP): сборка цифр из геометрии с монтажной посадкой и отдачей,
   параллакс слоёв за курсором / наклоном, переклейка hero следующим плакатом, авторские появления секций. */
(() => {
  "use strict";
  const doc = document.documentElement;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const urlStates = new Set((new URLSearchParams(location.search).get("state") || "").split(",").map((s) => s.trim()).filter(Boolean));
  const hasState = (s) => (window.TVSU && window.TVSU.states ? window.TVSU.states.has(s) : urlStates.has(s));

  /* ───── табло: цифры на барабанах 0–9 ×3; в HTML лежит итоговое число ───── */
  const REPS = 3;
  const flaps = [];
  $$("[data-flap]").forEach((el) => {
    const val = el.textContent.trim();
    el.textContent = "";
    const sr = document.createElement("span");
    sr.className = "visually-hidden";
    sr.textContent = val;
    const cells = document.createElement("span");
    cells.className = "flap__cells";
    cells.setAttribute("aria-hidden", "true");
    const reels = [];
    for (const ch of val) {
      const cell = document.createElement("span");
      cell.className = "flap__cell";
      const reel = document.createElement("span");
      reel.className = "flap__reel";
      if (/\d/.test(ch)) {
        for (let r = 0; r < REPS; r++) {
          for (let d = 0; d < 10; d++) {
            const s = document.createElement("span");
            s.textContent = d;
            reel.append(s);
          }
        }
        const idx = (REPS - 1) * 10 + Number(ch);
        reel.dataset.idx = idx;
        reel.style.transform = `translateY(${((-idx * 100) / (REPS * 10)).toFixed(4)}%)`;
        reels.push(reel);
      } else {
        const s = document.createElement("span");
        s.textContent = ch;
        reel.append(s);
      }
      cell.append(reel);
      cells.append(cell);
    }
    el.append(sr, cells);
    flaps.push({ el, reels });
  });

  /* ───── календарь сентября (пример расписания) ───── */
  const cal = $("[data-cal]");
  const agenda = $("[data-agenda]");
  const agendaTitle = $("[data-agenda-title]");
  if (cal && agenda && agendaTitle) {
    const initial = agenda.innerHTML;
    const WD = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];
    const KIND = { a: "Абитуриенту", s: "Студенту", all: "Всем" };
    const POOL = [
      ["10:00", "Консультация приёмной комиссии", "Главный корпус, ул. Желябова, 33", "a"],
      ["11:30", "Открытая лекция: [тема]", "Аудитория [N]", "all"],
      ["13:00", "Мастер-класс факультета: [название]", "[место]", "a"],
      ["15:00", "Семинар студенческого научного общества", "[место]", "s"],
      ["16:30", "Тренировка сборной университета: [вид спорта]", "[спорткомплекс]", "s"],
      ["18:00", "Концерт студенческого клуба: [название]", "[место]", "all"],
      ["19:00", "Онлайн-встреча с приёмной комиссией", "Трансляция [ссылка]", "a"],
    ];
    const days = $$("[data-day]", cal);
    const render = (d, count) => {
      if (d === 15) return initial;
      if (!count) return '<li class="agenda__empty">В этот день событий нет. Ближайшие даты приёмной кампании — <a href="#ask">ниже на странице</a>.</li>';
      const picks = [];
      for (let i = 0; i < count; i++) picks.push(POOL[(d * 3 + i * 2) % POOL.length]);
      picks.sort((a, b) => a[0].localeCompare(b[0]));
      return picks
        .map(([t, n, p, k]) => `<li class="agenda__item"><time>${t}</time><div><p class="agenda__name">${n}</p><p class="agenda__place">${p}</p></div><span class="agenda__kind">${KIND[k]}</span></li>`)
        .join("");
    };
    const select = (btn) => {
      const d = Number(btn.dataset.day);
      days.forEach((b) => {
        const on = b === btn;
        b.setAttribute("aria-pressed", on ? "true" : "false");
        b.tabIndex = on ? 0 : -1;
      });
      agendaTitle.textContent = `${d} сентября, ${WD[new Date(2026, 8, d).getDay()]}`;
      agenda.innerHTML = render(d, btn.querySelectorAll(".cal__dots i").length);
      agenda.classList.remove("is-swap");
      void agenda.offsetWidth;
      agenda.classList.add("is-swap");
    };
    days.forEach((b) => { b.tabIndex = b.getAttribute("aria-pressed") === "true" ? 0 : -1; });
    cal.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-day]");
      if (btn && btn.getAttribute("aria-pressed") !== "true") select(btn);
    });
    cal.addEventListener("keydown", (e) => {
      const i = days.indexOf(document.activeElement);
      if (i < 0) return;
      const map = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: days.length - 1 };
      if (!(e.key in map)) return;
      e.preventDefault();
      const next = days[Math.max(0, Math.min(days.length - 1, map[e.key]))];
      days.forEach((b) => { b.tabIndex = b === next ? 0 : -1; });
      next.focus();
      next.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
    // на узких экранах лента дней сразу показывает «сегодня»
    const today = days.find((b) => b.getAttribute("aria-pressed") === "true");
    if (today && cal.scrollWidth > cal.clientWidth + 2) {
      cal.scrollLeft = Math.max(0, today.getBoundingClientRect().left - cal.getBoundingClientRect().left - 140);
    }
  }

  /* ───── лид: проверка контакта и штамп «Принято» ───── */
  const form = $("[data-lead-form]");
  const done = $("[data-lead-done]");
  if (form && done) {
    const input = $("#lead-contact");
    const err = $("#lead-contact-err");
    const check = (v) => v.replace(/\D/g, "").length >= 10 || /^@[a-z0-9_]{4,}$/i.test(v);
    const showDone = (animate) => {
      form.hidden = true;
      done.hidden = false;
      if (animate) {
        done.classList.add("is-slam");
        done.focus({ preventScroll: true });
      }
    };
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const v = input.value.trim();
      const ok = check(v);
      input.setAttribute("aria-invalid", ok ? "false" : "true");
      err.textContent = v ? "Проверьте контакт: нужен номер из 10–11 цифр или ник в Telegram через @." : "Оставьте телефон или @ник в Telegram, чтобы мы могли ответить.";
      err.hidden = ok;
      if (!ok) { input.focus(); return; }
      showDone(true);
    });
    input.addEventListener("input", () => {
      if (input.getAttribute("aria-invalid") === "true" && check(input.value.trim())) {
        input.setAttribute("aria-invalid", "false");
        err.hidden = true;
      }
    });
    if (hasState("lead-sent")) showDone(false);
  }

  /* ───── липкая панель действия на мобильном ───── */
  const dock = $("[data-dock]");
  const heroCta = $(".hero__actions");
  const ask = $("#ask");
  if (dock && heroCta && ask && "IntersectionObserver" in window) {
    const link = dock.querySelector("a");
    let ctaGone = false;
    let askIn = false;
    const sync = () => {
      const on = ctaGone && !askIn;
      dock.classList.toggle("is-shown", on);
      dock.setAttribute("aria-hidden", on ? "false" : "true");
      link.tabIndex = on ? 0 : -1;
    };
    new IntersectionObserver(([e]) => { ctaGone = !e.isIntersecting && e.boundingClientRect.top < 0; sync(); }).observe(heroCta);
    new IntersectionObserver(([e]) => { askIn = e.isIntersecting; sync(); }).observe(ask);
  }

  /* ═════════════ движение ═════════════ */
  const G = window.gsap;
  const ST = window.ScrollTrigger;
  if (!G || !ST || !doc.classList.contains("m-on")) return;
  G.registerPlugin(ST);

  const rnd = G.utils.random;
  const ACCENT = ".echo, .echo-ring, .sun, .tri";

  /* Сборка цифры: части прилетают с разгоном (power4.in), бьют в место без торможения,
     проскакивают на ~4 % пути и возвращаются пружиной. Удары идут битами по 2–3 части, лист вздрагивает. */
  function assemble(svg, opts = {}) {
    const parts = $$("[data-part]", svg);
    const main = parts
      .filter((p) => !p.matches(ACCENT))
      .map((p) => ({ p, x: p.getBBox().x }))
      .sort((a, b) => a.x - b.x)
      .map((o) => o.p);
    const acc = parts.filter((p) => p.matches(ACCENT));
    const vb = svg.viewBox.baseVal;
    const span = Math.max(vb.width, vb.height);
    const tl = G.timeline({ delay: opts.delay || 0 });
    G.set(parts, { transformOrigin: "50% 50%" });

    const fly = (p, at, dur, far) => {
      let dx, dy, rot;
      if (opts.fromCurrent) {
        dx = G.getProperty(p, "x");
        dy = G.getProperty(p, "y");
        rot = G.getProperty(p, "rotation");
        tl.to(p, { x: 0, y: 0, rotation: 0, scale: 1, duration: dur, ease: "power4.in" }, at);
      } else {
        const ang = rnd(0, Math.PI * 2);
        const dist = span * far * rnd(0.75, 1.05);
        dx = Math.cos(ang) * dist;
        dy = Math.sin(ang) * dist;
        rot = rnd(-150, 150);
        tl.set(p, { visibility: "visible" }, at).fromTo(
          p,
          { x: dx, y: dy, rotation: rot, scale: rnd(0.6, 1.4) },
          { x: 0, y: 0, rotation: 0, scale: 1, duration: dur, ease: "power4.in", immediateRender: false },
          at
        );
      }
      tl.to(p, { x: -dx * 0.045, y: -dy * 0.045, rotation: -rot * 0.03, duration: 0.07, ease: "power2.out" }, at + dur).to(
        p,
        { x: 0, y: 0, rotation: 0, duration: 0.55, ease: "elastic.out(1, 0.32)" },
        at + dur + 0.07
      );
    };
    const jolt = (at, amp) => {
      tl.to(svg, { y: amp, rotation: amp * 0.06, duration: 0.05, ease: "power1.out" }, at).to(
        svg,
        { y: 0, rotation: 0, duration: 0.5, ease: "elastic.out(1, 0.28)" },
        at + 0.05
      );
    };

    const beats = [2, 3, 2, 3, 2, 3];
    const dur = opts.fromCurrent ? 0.3 : 0.46;
    let t = 0;
    for (let i = 0, b = 0; i < main.length; b++) {
      const n = Math.min(beats[b % beats.length], main.length - i);
      for (let k = 0; k < n; k++) fly(main[i + k], t, dur, 1.15);
      jolt(t + dur, 4 + b);
      i += n;
      t += 0.19;
    }
    const tAcc = t + 0.08;
    acc.forEach((p) => {
      if (p.classList.contains("sun") && !opts.fromCurrent) {
        tl.set(p, { visibility: "visible" }, tAcc + 0.3).fromTo(
          p,
          { scale: 0.45 },
          { scale: 1, duration: 0.7, ease: "back.out(3.2)", immediateRender: false },
          tAcc + 0.3
        );
      } else {
        fly(p, tAcc, 0.3, 0.55);
      }
    });
    jolt(tAcc + 0.3, 11);
    return tl;
  }

  const once = (trigger, start, fn) => ST.create({ trigger, start, once: true, onEnter: fn });

  const mm = G.matchMedia();
  mm.add(
    {
      motion: "(prefers-reduced-motion: no-preference)",
      desk: "(min-width: 1024px)",
      fine: "(hover: hover) and (pointer: fine)",
    },
    (ctx) => {
      const { motion, desk, fine } = ctx.conditions;
      if (!motion) return;
      const cleanups = [];

      /* ── hero: шторка заголовка → сборка 1870 ── */
      const hero = $("#hero");
      const heroSvg = $("[data-assemble='hero']");
      const art = $("[data-hero-art]");
      const photoImg = $("[data-hero-photo] img");
      let intro = null;
      if (hero && heroSvg) {
        const lines = $$(".hero__pre, .hero__line", hero);
        G.fromTo(
          lines,
          { clipPath: "polygon(0% 0%, 0% 0%, -20% 100%, -20% 100%)" },
          { clipPath: "polygon(0% -30%, 135% -30%, 115% 130%, -20% 130%)", duration: 0.62, ease: "power3.inOut", stagger: 0.09, delay: 0.06 }
        );
        if (photoImg) G.fromTo(photoImg, { scale: 1.22 }, { scale: 1.06, duration: 2.2, ease: "expo.out" });
        G.fromTo(
          $$(".hero__facts dd", hero),
          { clipPath: "inset(100% 0% -12% 0%)", y: 24 },
          { clipPath: "inset(-12% 0% -12% 0%)", y: 0, duration: 0.55, ease: "power3.out", stagger: 0.07, delay: 0.45 }
        );
        intro = assemble(heroSvg, { delay: 0.22 });

        /* параллакс слоёв: курсор (мышь) или наклон телефона без запроса разрешения */
        const lays = $$(".lay", heroSvg).map((g) => ({
          k: Number(g.dataset.depth) || 0,
          qx: G.quickTo(g, "x", { duration: 0.7, ease: "power3" }),
          qy: G.quickTo(g, "y", { duration: 0.7, ease: "power3" }),
        }));
        const px = photoImg ? G.quickTo(photoImg, "x", { duration: 1, ease: "power3" }) : null;
        const py = photoImg ? G.quickTo(photoImg, "y", { duration: 1, ease: "power3" }) : null;
        const apply = (nx, ny) => {
          lays.forEach((l) => { l.qx(nx * l.k); l.qy(ny * l.k * 0.6); });
          if (px) { px(-nx * 12); py(-ny * 8); }
        };
        if (fine) {
          let rect = null;
          const enter = () => { rect = hero.getBoundingClientRect(); };
          const move = (e) => {
            if (e.pointerType !== "mouse") return;
            if (!rect) enter();
            apply(((e.clientX - rect.left) / rect.width) * 2 - 1, ((e.clientY - rect.top) / rect.height) * 2 - 1);
          };
          const leave = () => { rect = null; apply(0, 0); };
          hero.addEventListener("pointerenter", enter);
          hero.addEventListener("pointermove", move);
          hero.addEventListener("pointerleave", leave);
          cleanups.push(() => {
            hero.removeEventListener("pointerenter", enter);
            hero.removeEventListener("pointermove", move);
            hero.removeEventListener("pointerleave", leave);
          });
        } else if ("DeviceOrientationEvent" in window && typeof window.DeviceOrientationEvent.requestPermission !== "function") {
          const tilt = (e) => {
            if (e.gamma == null) return;
            apply(G.utils.clamp(-1, 1, e.gamma / 28), G.utils.clamp(-1, 1, (e.beta - 40) / 28));
          };
          const st = ST.create({
            trigger: hero, start: "top bottom", end: "bottom top",
            onToggle: (self) => (self.isActive ? window.addEventListener("deviceorientation", tilt) : window.removeEventListener("deviceorientation", tilt)),
          });
          cleanups.push(() => { st.kill(); window.removeEventListener("deviceorientation", tilt); });
        }

        /* тап/клик по цифре: разлёт и пересборка */
        if (art) {
          ctx.add("scatter", () => {
            if (intro && intro.isActive()) return;
            const parts = $$("[data-part]", heroSvg);
            G.killTweensOf(parts);
            G.to(parts, {
              x: () => rnd(-420, 420), y: () => rnd(-260, 260), rotation: () => rnd(-170, 170),
              duration: 0.26, ease: "power2.out", overwrite: true,
              onComplete: () => ctx.add(() => { intro = assemble(heroSvg, { fromCurrent: true }); }),
            });
          });
          const scatter = () => ctx.scatter();
          art.addEventListener("click", scatter);
          cleanups.push(() => art.removeEventListener("click", scatter));
        }
      }

      /* ── переклейка: hero стоит, синий плакат наезжает с диагональной кромкой ── */
      const who = $("#who");
      if (hero && who) {
        if (desk) {
          ST.create({ trigger: hero, start: "bottom bottom", end: () => "+=" + window.innerHeight, pin: true, pinSpacing: false, invalidateOnRefresh: true });
          const scrub = { trigger: who, start: "top bottom", end: "top top", scrub: true };
          G.fromTo(who, { clipPath: "polygon(0% 34%, 100% 0%, 100% 100%, 0% 100%)" }, { clipPath: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)", ease: "none", scrollTrigger: scrub });
          if (art) G.to(art, { yPercent: -18, rotation: -5, ease: "none", scrollTrigger: { ...scrub } });
          G.to(".hero__copy", { yPercent: -8, ease: "none", scrollTrigger: { ...scrub } });
        } else {
          G.fromTo(
            who,
            { clipPath: "polygon(0% 10%, 100% 0%, 100% 100%, 0% 100%)" },
            { clipPath: "polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)", duration: 0.9, ease: "power3.out", scrollTrigger: { trigger: who, start: "top 90%", once: true } }
          );
        }
      }

      /* ── заголовки плакатов: диагональная шторка ── */
      $$("main section:not(.hero) .ptitle, .who__title").forEach((t) => {
        G.fromTo(
          t,
          { clipPath: "polygon(0% -20%, 0% -20%, -25% 120%, -25% 120%)" },
          { clipPath: "polygon(0% -20%, 130% -20%, 105% 120%, -25% 120%)", duration: 0.85, ease: "power3.inOut", scrollTrigger: { trigger: t, start: "top 90%", once: true } }
        );
      });

      /* ── «Кому что нужно»: колонки падают сверху как наклейки ── */
      G.fromTo(".who__col", { y: -36, rotation: (i) => (i % 2 ? 2.5 : -2.5) }, { y: 0, rotation: 0, duration: 0.7, ease: "back.out(2)", stagger: 0.08, scrollTrigger: { trigger: ".who__grid", start: "top 88%", once: true } });

      /* ── направления: плитки штампуются диагональю из угла, фигуры доворачиваются ── */
      const tiles = $$(".dir");
      if (tiles.length) {
        const figs = $$(".dir__fig");
        G.set(figs, { transition: "none" });
        G.fromTo(
          tiles,
          { clipPath: "polygon(-5% -5%, -5% -5%, -5% -5%)", y: 30 },
          {
            clipPath: "polygon(-5% -5%, 215% -5%, -5% 215%)", y: 0, duration: 0.7, ease: "power4.out", stagger: 0.08,
            scrollTrigger: { trigger: ".dirs__grid", start: "top 85%", once: true },
            onComplete: () => G.set(tiles, { clearProps: "clipPath" }),
          }
        );
        G.fromTo(
          figs,
          { rotation: -90, transformOrigin: "50% 50%" },
          {
            rotation: 0, duration: 0.6, ease: "back.out(2.4)", stagger: 0.08, delay: 0.25,
            scrollTrigger: { trigger: ".dirs__grid", start: "top 85%", once: true },
            onComplete: () => G.set(figs, { clearProps: "transform,transition" }),
          }
        );
      }

      /* ── «15» и «?» собираются той же механикой при входе ── */
      $$("[data-assemble='scroll']").forEach((svg) => {
        const parts = $$("[data-part]", svg);
        const r = svg.getBoundingClientRect();
        if (r.top > window.innerHeight * 0.85) G.set(parts, { visibility: "hidden" });
        once(svg, "top 85%", () => ctx.add(() => assemble(svg)));
      });

      /* ── факультеты: строки выкатываются полосой слева ── */
      const rows = $$(".fac__list > li");
      if (rows.length) {
        G.fromTo(
          rows,
          { clipPath: "inset(0% 100% 0% 0%)" },
          { clipPath: "inset(-10% -2% -10% 0%)", duration: 0.5, ease: "power3.inOut", stagger: 0.04, scrollTrigger: { trigger: ".fac__list", start: "top 85%", once: true }, onComplete: () => G.set(rows, { clearProps: "clipPath" }) }
        );
      }

      /* ── наука: фото диагональной шторкой, табло крутит барабаны с «клак» ── */
      const sciPhoto = $(".sci__photo");
      if (sciPhoto) {
        const st = { trigger: ".sci", start: "top 70%", once: true };
        G.fromTo(sciPhoto, { clipPath: "polygon(0% 0%, 0% 0%, -35% 100%, -35% 100%)" }, { clipPath: "polygon(0% 0%, 135% 0%, 100% 100%, -35% 100%)", duration: 1.1, ease: "power3.inOut", scrollTrigger: st });
        G.fromTo($("img", sciPhoto), { scale: 1.25 }, { scale: 1, duration: 1.8, ease: "expo.out", scrollTrigger: { ...st } });
      }
      const allReels = flaps.flatMap((f) => f.reels);
      if (allReels.length) {
        allReels.forEach((reel) => { G.set(reel, { clearProps: "transform" }); G.set(reel, { yPercent: 0 }); });
        once(".board", "top 82%", () =>
          ctx.add(() => {
            flaps.forEach(({ reels }, fi) =>
              reels.forEach((reel, ri) => {
                const idx = Number(reel.dataset.idx);
                const d = 1 + ri * 0.12;
                G.timeline({ delay: fi * 0.2 + ri * 0.1 })
                  .to(reel, { yPercent: (-idx * 100) / (REPS * 10), duration: d, ease: "power4.inOut" })
                  .to(reel.parentElement, { y: 4, duration: 0.04, ease: "power1.out" })
                  .to(reel.parentElement, { y: 0, duration: 0.35, ease: "elastic.out(1, 0.3)" });
              })
            );
          })
        );
      }

      /* ── история: марки наклеиваются сверху ── */
      const stamps = $$(".stamp");
      if (stamps.length) {
        G.from(stamps, { y: -46, rotation: (i) => (i % 2 ? "+=9" : "-=9"), duration: 0.75, ease: "back.out(1.9)", stagger: 0.07, scrollTrigger: { trigger: ".stamps__track", start: "top 85%", once: true } });
      }

      /* ── сегодня: дни календаря сыплются быстрым каскадом, фото новостей — шторкой ── */
      const dayItems = $$(".cal__days > li");
      if (dayItems.length) {
        G.fromTo(
          dayItems,
          { clipPath: "inset(0% 0% 100% 0%)", y: 26 },
          { clipPath: "inset(0% 0% 0% 0%)", y: 0, duration: 0.42, ease: "power3.out", stagger: 0.016, scrollTrigger: { trigger: ".cal", start: "top 88%", once: true }, onComplete: () => G.set(dayItems, { clearProps: "clipPath,transform" }) }
        );
      }
      $$(".newsc__img").forEach((box) => {
        G.fromTo(box, { clipPath: "polygon(0% 100%, 0% 100%, 0% 100%)" }, { clipPath: "polygon(0% 100%, 0% -110%, 210% 100%)", duration: 0.8, ease: "power3.inOut", scrollTrigger: { trigger: box, start: "top 88%", once: true } });
      });
      /* плакат «день открытых дверей» наклеивается с отдачей, фигуры выскакивают */
      const visit = $(".visit");
      if (visit) {
        const vt = G.timeline({ scrollTrigger: { trigger: visit, start: "top 88%", once: true } });
        vt.from(visit, { y: 50, rotation: -4, transformOrigin: "0% 100%", duration: 0.6, ease: "back.out(2)" })
          .from(".visit__geo polygon", { xPercent: 60, duration: 0.4, ease: "power4.out" }, "-=0.3")
          .from(".visit__geo circle", { scale: 0.3, transformOrigin: "50% 50%", duration: 0.55, ease: "back.out(3.2)" }, "-=0.25");
      }

      /* ── FAQ: вопросы въезжают слева полосами ── */
      const qs = $$(".faq .accordion__item");
      if (qs.length) {
        G.fromTo(qs, { x: -40, clipPath: "inset(0% 100% 0% 0%)" }, { x: 0, clipPath: "inset(-5% -5% -5% 0%)", duration: 0.55, ease: "power3.out", stagger: 0.06, scrollTrigger: { trigger: ".faq__acc", start: "top 85%", once: true }, onComplete: () => G.set(qs, { clearProps: "clipPath,transform" }) });
      }

      /* ── кампания: даты вбиваются справа, лист формы шлёпается на плакат ── */
      const steps = $$(".steps__item");
      if (steps.length) {
        G.fromTo(steps, { x: 60, clipPath: "inset(0% 0% 0% 100%)" }, { x: 0, clipPath: "inset(-5% -5% -5% -5%)", duration: 0.5, ease: "power4.out", stagger: 0.09, scrollTrigger: { trigger: ".steps", start: "top 88%", once: true }, onComplete: () => G.set(steps, { clearProps: "clipPath,transform" }) });
      }
      const lead = $(".lead");
      if (lead) G.from(lead, { y: 70, rotation: "+=7", duration: 0.8, ease: "back.out(1.6)", scrollTrigger: { trigger: lead, start: "top 90%", once: true } });

      /* ── Lenis: плавная прокрутка только мышью на десктопе ── */
      if (desk && fine && typeof window.Lenis === "function") {
        const lenis = new window.Lenis({ lerp: 0.12, anchors: { offset: -76 } });
        lenis.on("scroll", ST.update);
        const raf = (time) => lenis.raf(time * 1000);
        G.ticker.add(raf);
        G.ticker.lagSmoothing(0);
        let locked = false;
        const mo = new MutationObserver(() => {
          const now = doc.classList.contains("is-locked");
          if (now === locked) return;
          locked = now;
          if (now) lenis.stop(); else lenis.start();
        });
        mo.observe(doc, { attributes: true, attributeFilter: ["class"] });
        cleanups.push(() => { mo.disconnect(); G.ticker.remove(raf); G.ticker.lagSmoothing(500, 33); lenis.destroy(); });
      }

      return () => cleanups.forEach((fn) => fn());
    }
  );

  const refresh = () => ST.refresh();
  if (window.TVSU && window.TVSU.ready) window.TVSU.ready.then(() => requestAnimationFrame(refresh));
  else document.addEventListener("partials:ready", refresh, { once: true });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(refresh);
  window.addEventListener("load", refresh, { once: true });
})();
