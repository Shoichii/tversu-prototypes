/* home-live/d — «Цвет факультета».
   Данные факультетов читаются из разметки (.fcard и плитки щита) — один источник.
   Движение: сборка щита, эстафета морфинга (MorphSVG), Flip-разворот плитки в карточку,
   перетекание --page-bg по прокрутке списка, линза с морфингом, резкие чипы подбора. */
(() => {
  const d = document;
  const html = d.documentElement;
  const body = d.body;
  const $ = (s, r = d) => r.querySelector(s);
  const $$ = (s, r = d) => [...r.querySelectorAll(s)];

  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const mobile = matchMedia("(max-width: 767px)").matches;
  const G = window.gsap;
  const hasG = !!(G && window.ScrollTrigger && window.Flip && window.MorphSVGPlugin);
  if (hasG) G.registerPlugin(ScrollTrigger, Flip, MorphSVGPlugin, CustomEase);
  const EIO = hasG ? CustomEase.create("d-io", "0.77,0,0.175,1") : null;
  const EOUT = hasG ? CustomEase.create("d-out", "0.23,1,0.32,1") : null;

  const PEACH = "#FEF3F1";
  const metaTheme = $('meta[name="theme-color"]');

  /* ───── данные ───── */
  const FAC = {};
  const ORDER = [];
  $$(".fcard").forEach((el, i) => {
    const k = el.dataset.fac;
    const svg = $(".fcard__badge .pg", el);
    const dot = $("circle", svg);
    FAC[k] = {
      k, i,
      name: $("[data-name]", el).textContent.trim(),
      about: $("[data-about]", el).textContent.trim(),
      short: ($(`.hero .tile[data-fac="${k}"] .tile__name`) || {}).textContent || "",
      c: el.style.getPropertyValue("--fc").trim(),
      fg: el.style.getPropertyValue("--fc-fg").trim(),
      tint: el.style.getPropertyValue("--fc-tint").trim(),
      path: $("path", svg).getAttribute("d"),
      dot: dot && dot.getAttribute("opacity") !== "0" ? [dot.getAttribute("cx"), dot.getAttribute("cy")] : null,
      media: el.dataset.media, src: el.dataset.src || "", alt: el.dataset.alt || "",
      card: el,
    };
    ORDER.push(k);
  });

  const hex = (h) => { h = h.replace("#", ""); return [0, 2, 4].map((j) => parseInt(h.slice(j, j + 2), 16)); };
  const mixRGB = (a, b, t) => a.map((v, j) => Math.round(v + (b[j] - v) * t));
  const rgb = (a) => `rgb(${a[0]} ${a[1]} ${a[2]})`;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const smooth = (t) => t * t * (3 - 2 * t);

  const setDot = (circle, dot) => {
    if (!circle) return;
    if (dot) { circle.setAttribute("cx", dot[0]); circle.setAttribute("cy", dot[1]); circle.setAttribute("opacity", "1"); }
    else circle.setAttribute("opacity", "0");
  };
  const dotTo = (circle, dot, vars) => {
    if (!circle) return null;
    return G.to(circle, Object.assign({ attr: dot ? { cx: +dot[0], cy: +dot[1], opacity: 1 } : { opacity: 0 } }, vars));
  };
  const plural = (n, f) => {
    const a = n % 100, b = n % 10;
    return f[a > 10 && a < 20 ? 2 : b === 1 ? 0 : b >= 2 && b <= 4 ? 1 : 2];
  };

  /* ───── цвет страницы ───── */
  let pageBg = PEACH;
  let bgHold = false; // пока открыта карточка, прокрутка цвет не трогает
  const setBg = (c) => {
    if (c === pageBg) return;
    pageBg = c;
    body.style.setProperty("--page-bg", c);
  };

  /* ───── Lenis ───── */
  let lenis = null;
  if (hasG && !reduce && fine && window.Lenis) {
    lenis = new Lenis({ lerp: 0.11, anchors: { offset: -76 } });
    lenis.on("scroll", ScrollTrigger.update);
    G.ticker.add((t) => lenis.raf(t * 1000));
    G.ticker.lagSmoothing(0);
  }

  /* ───── щит: сборка и эстафета ───── */
  const heroShield = $(".hero .shield");
  const tiles = {};
  $$(".hero .tile").forEach((t) => {
    const svg = $(".pg", t);
    tiles[t.dataset.fac] = { el: t, path: $("path", svg), dot: $("circle", svg) };
  });
  const accent = $(".hero__accent");
  const RELAY = ["bio", "math", "phil", "lang", "chem", "law", "phys", "hist", "psy", "sport", "geo", "econ", "ino", "cyb", "ped"];

  const relay = { cur: null, i: 0, blocks: new Set(), on: false };
  const relayBlocked = () => relay.blocks.size > 0;
  const block = (why) => { relay.blocks.add(why); if (relay.cur) relay.cur.pause(); };
  const unblock = (why) => { relay.blocks.delete(why); if (!relayBlocked() && relay.cur) relay.cur.resume(); };

  function relayStep() {
    const a = RELAY[relay.i % RELAY.length];
    const b = RELAY[(relay.i + 1) % RELAY.length];
    relay.i++;
    const T = tiles[a];
    const A = FAC[a], B = FAC[b];
    const m = 0.85, hold = 0.9;
    const tl = G.timeline({ paused: relayBlocked(), onComplete: relayNext });
    tl.add(() => accent && accent.style.setProperty("--relay", B.c), 0)
      .to(T.path, { morphSVG: B.path, duration: m, ease: "sine.inOut" }, 0)
      .add(dotTo(T.dot, B.dot, { duration: m, ease: "sine.inOut" }), 0)
      .to(T.path, { morphSVG: A.path, duration: m, ease: "sine.inOut" }, m + hold)
      .add(dotTo(T.dot, A.dot, { duration: m, ease: "sine.inOut" }), m + hold);
    relay.cur = tl;
  }
  function relayNext() {
    relay.cur = G.delayedCall(mobile ? 1.5 : 0.8, relayStep);
    if (relayBlocked()) relay.cur.pause();
  }

  if (hasG && heroShield && !reduce) {
    const plateEls = $$(".shield__body", heroShield);
    const roof = $(".shield__roof", heroShield);
    const tileEls = $$(".tile", heroShield);
    const intro = G.timeline({ defaults: { ease: "expo.out" } });
    intro
      .from(plateEls, { opacity: 0, scale: 0.96, transformOrigin: "50% 60%", duration: 0.5 }, 0)
      .from(tileEls, { opacity: 0, yPercent: 45, scale: 0.9, duration: 0.7, stagger: { each: 0.045, from: "end" }, clearProps: "transform,opacity" }, 0.05)
      .from(roof, { opacity: 0, y: -28, duration: 0.55 }, 0.72);

    relay.cur = G.delayedCall(2.2, relayStep);
    relay.on = true;

    ScrollTrigger.create({
      trigger: heroShield, start: "top bottom", end: "bottom top",
      onToggle: (self) => (self.isActive ? unblock("off") : block("off")),
    });
    if (fine) {
      heroShield.addEventListener("pointerenter", () => block("hover"));
      heroShield.addEventListener("pointerleave", () => unblock("hover"));
    }
    heroShield.addEventListener("focusin", () => block("focus"));
    heroShield.addEventListener("focusout", () => unblock("focus"));
    d.addEventListener("visibilitychange", () => (d.hidden ? block("tab") : unblock("tab")));
  }

  /* ───── факультеты: цвет по прокрутке + линза ───── */
  const list = $("[data-faclist]");
  const cards = list ? $$(".fcard", list) : [];
  const lens = $(".lens");
  const lensPath = lens && $(".lens__pg path", lens);
  const lensDot = lens && $(".lens__pg circle", lens);
  const lensNum = lens && $("[data-lens-num]", lens);
  const lensName = lens && $("[data-lens-name]", lens);
  let centers = [];
  let active = -1;
  const tints = cards.map((c) => hex(FAC[c.dataset.fac].tint));
  const peachRGB = hex(PEACH);

  function measure() {
    const y = window.scrollY;
    centers = cards.map((c) => { const r = c.getBoundingClientRect(); return r.top + y + r.height / 2; });
  }
  function setActive(i) {
    if (i === active) return;
    const prev = active;
    active = i;
    cards.forEach((c, j) => c.classList.toggle("is-active", j === i));
    if (!lens || i < 0) return;
    const F = FAC[cards[i].dataset.fac];
    lens.style.setProperty("--lens-c", F.c);
    lens.style.setProperty("--lens-fg", F.fg);
    lensNum.textContent = String(i + 1).padStart(2, "0");
    lensName.textContent = F.name;
    if (hasG && !reduce && prev >= 0) {
      G.to(lensPath, { morphSVG: F.path, duration: 0.6, ease: EIO, overwrite: true });
      dotTo(lensDot, F.dot, { duration: 0.6, ease: EIO, overwrite: true });
    } else {
      lensPath.setAttribute("d", F.path);
      setDot(lensDot, F.dot);
    }
  }
  function flow() {
    if (!centers.length) return;
    const vh = window.innerHeight;
    // снимок всей страницы одним окном: оставляем исходный кадр (первый факультет, персиковый фон)
    if (vh > 2400) { setActive(0); if (!bgHold) setBg(PEACH); return; }
    const y = window.scrollY + vh / 2;
    const n = centers.length;
    const ramp = vh * 0.45;
    let c;
    let nearest = 0;
    for (let j = 1; j < n; j++) if (Math.abs(centers[j] - y) < Math.abs(centers[nearest] - y)) nearest = j;
    const inside = y > centers[0] - ramp && y < centers[n - 1] + ramp;
    if (reduce) {
      c = inside ? tints[nearest] : peachRGB;
    } else if (y <= centers[0]) {
      c = mixRGB(peachRGB, tints[0], smooth(clamp((y - (centers[0] - ramp)) / ramp)));
    } else if (y >= centers[n - 1]) {
      c = mixRGB(tints[n - 1], peachRGB, smooth(clamp((y - centers[n - 1]) / ramp)));
    } else {
      let i = 0;
      while (i < n - 2 && y > centers[i + 1]) i++;
      const t = (y - centers[i]) / (centers[i + 1] - centers[i]);
      c = mixRGB(tints[i], tints[i + 1], smooth(clamp((t - 0.3) / 0.4)));
    }
    if (inside) setActive(nearest);
    if (!bgHold) setBg(rgb(c));
  }
  if (cards.length) {
    if (hasG) {
      ScrollTrigger.create({
        trigger: list, start: "top bottom", end: "bottom top",
        onRefresh: () => { measure(); flow(); },
        onUpdate: flow,
        onLeave: () => { setActive(cards.length - 1); if (!bgHold) setBg(PEACH); },
        onLeaveBack: () => { setActive(0); if (!bgHold) setBg(PEACH); },
      });
    } else {
      measure();
      addEventListener("scroll", flow, { passive: true });
      addEventListener("resize", () => { measure(); flow(); });
    }
    setActive(0);
  }

  /* ───── карточка факультета ───── */
  const dlg = $("#fac");
  const surface = $("[data-fac-surface]");
  const dIcon = $(".fac__icon", dlg);
  const dPath = $("path", dIcon);
  const dDot = $("circle", dIcon);
  const dNum = $("[data-fac-num]", dlg);
  const dTitle = $("[data-fac-title]", dlg);
  const dAbout = $("[data-fac-about]", dlg);
  const dMedia = $("[data-fac-media]", dlg);
  const dBar = $(".fac__bar", dlg);
  const pieces = () => [dBar, dTitle, dAbout, $(".fac__facts", dlg), $(".fac__actions", dlg), dMedia];
  const playIcon = '<svg class="pg pg--ui" viewBox="0 0 48 48" aria-hidden="true" focusable="false"><path d="M17 10.5C17 9 18.6 8.1 19.9 8.9L38 21.5C39.2 22.3 39.2 24 38 24.8L19.9 37.1C18.6 38 17 37 17 35.5Z"/></svg>';

  let openKey = null;
  let kind = null; // tile | card | quiz
  let busy = false;
  let lastFocus = null;

  const esc = (s) => s.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));

  function renderMedia(F) {
    if (F.media === "photo") {
      dMedia.innerHTML = `<img src="${F.src}" alt="${esc(F.alt)}" width="800" height="600" decoding="async">`;
    } else if (F.media === "video") {
      dMedia.innerHTML = `<img src="${F.src}.jpg" alt="${esc(F.alt)}" width="854" height="480" decoding="async">` +
        `<button class="fac__play" type="button" data-play><span>${playIcon}Смотреть видео</span></button>` +
        `<figcaption>${esc(F.alt)}. Звук включится только после нажатия.</figcaption>`;
    } else {
      dMedia.innerHTML = `<div class="stub stub--4x3"><span class="stub__caption">${esc(F.alt)}</span></div>`;
    }
  }
  function fill(k, withIcon = true) {
    const F = FAC[k];
    dlg.style.setProperty("--fc", F.c);
    dlg.style.setProperty("--fc-fg", F.fg);
    dlg.style.setProperty("--fc-tint", F.tint);
    dNum.textContent = String(F.i + 1).padStart(2, "0");
    dTitle.textContent = F.name;
    dAbout.textContent = F.about;
    renderMedia(F);
    if (withIcon) { dPath.setAttribute("d", F.path); setDot(dDot, F.dot); }
    if (metaTheme) metaTheme.setAttribute("content", F.c);
  }
  dMedia.addEventListener("click", (e) => {
    const b = e.target.closest("[data-play]");
    if (!b || !openKey) return;
    const F = FAC[openKey];
    const v = d.createElement("video");
    v.controls = true; v.playsInline = true; v.preload = "auto";
    v.poster = `${F.src}.jpg`;
    v.src = `${F.src}.mp4`;
    v.setAttribute("aria-label", F.alt);
    dMedia.querySelector("img").replaceWith(v);
    b.remove();
    v.play().catch(() => {});
    v.focus();
  });

  const outside = () => [$("main"), $(".site-header"), $(".site-footer")].filter(Boolean);
  function lock() {
    html.classList.add("d-locked");
    if (lenis) lenis.stop();
    outside().forEach((el) => (el.inert = true));
  }
  function unlock() {
    html.classList.remove("d-locked");
    if (lenis) lenis.start();
    outside().forEach((el) => (el.inert = false));
  }

  const sourceFor = (k, kd) => {
    if (kd === "tile") return $(`.hero .tile[data-fac="${k}"]`);
    if (kd === "quiz") return $(`.quiz__fac[data-open="${k}"]`) || $(`.fcard[data-fac="${k}"] .fcard__open`);
    return $(`.fcard[data-fac="${k}"] .fcard__open`);
  };
  const geomFor = (trigger) => {
    if (!trigger) return null;
    if (trigger.classList.contains("tile")) return { svg: $(".pg", trigger), box: trigger };
    const card = trigger.closest(".fcard");
    if (card) { const badge = $(".fcard__badge", card); return { svg: $(".pg", badge), box: badge }; }
    const svg = $(".pg:not(.pg--ui)", trigger);
    return svg ? { svg, box: svg } : null;
  };
  const insetOf = (box) => {
    const r = box.getBoundingClientRect();
    const W = window.innerWidth, H = window.innerHeight;
    let rad = getComputedStyle(box).borderTopLeftRadius;
    rad = rad.endsWith("%") ? (parseFloat(rad) / 100) * r.width : parseFloat(rad) || 0;
    return { str: `inset(${r.top}px ${W - r.right}px ${H - r.bottom}px ${r.left}px round ${rad}px)`, r, W, H };
  };
  const visible = (r, W, H) => r.bottom > 0 && r.right > 0 && r.top < H && r.left < W && r.width > 4;

  function open(k, trigger, { instant = false } = {}) {
    if (openKey || busy || !FAC[k]) return;
    openKey = k;
    kind = trigger && trigger.classList.contains("tile") ? "tile" : trigger && trigger.classList.contains("quiz__fac") ? "quiz" : "card";
    lastFocus = trigger || d.activeElement;
    block("dialog");
    fill(k);
    lock();
    bgHold = true;
    setBg(FAC[k].tint);
    const geo = geomFor(trigger);
    const done = () => { busy = false; $("[data-fac-close]", dlg).focus({ preventScroll: true }); };

    if (instant || reduce || !hasG || !geo) {
      dlg.hidden = false;
      surface.scrollTop = 0;
      done();
      return;
    }
    busy = true;
    const clip = insetOf(geo.box);
    geo.svg.dataset.flipId = "fac-icon";
    dIcon.dataset.flipId = "fac-icon";
    const state = Flip.getState(geo.svg);
    delete geo.svg.dataset.flipId;
    dlg.hidden = false;
    surface.scrollTop = 0;
    G.set(surface, { clipPath: clip.str });
    const tl = G.timeline({ onComplete: () => { G.set(surface, { clearProps: "clipPath" }); done(); } });
    tl.to(surface, { clipPath: `inset(0px 0px 0px 0px round 0px)`, duration: 0.75, ease: EIO }, 0)
      .add(Flip.from(state, { targets: dIcon, scale: true, duration: 0.75, ease: EIO }), 0)
      .from(pieces(), { opacity: 0, y: 28, duration: 0.55, ease: EOUT, stagger: 0.05, clearProps: "opacity,transform" }, 0.35);
  }

  function finishClose(focusEl) {
    dlg.hidden = true;
    G && G.set([surface, dIcon, ...pieces()], { clearProps: "all" });
    dMedia.innerHTML = "";
    unlock();
    openKey = null;
    busy = false;
    bgHold = false;
    if (metaTheme) metaTheme.setAttribute("content", PEACH);
    if (cards.length) flow();
    if (!(list && pageBg !== PEACH && centers.length)) setBg(PEACH);
    if (focusEl) focusEl.focus({ preventScroll: true });
    unblock("dialog");
  }

  function close({ instant = false } = {}) {
    if (!openKey || busy) return;
    const k = openKey;
    const target = (kind && sourceFor(k, kind)) || lastFocus;
    const focusEl = target && d.contains(target) ? target : null;
    const v = $("video", dMedia);
    if (v) v.pause();
    if (instant || reduce || !hasG) { finishClose(focusEl); return; }
    busy = true;
    const geo = geomFor(target);
    // перед закрытием вернуть поверхность наверх, чтобы знак был на месте
    const clip = geo ? insetOf(geo.box) : null;
    const tl = G.timeline({ onComplete: () => finishClose(focusEl) });
    tl.to(pieces(), { opacity: 0, y: 12, duration: 0.2, ease: "power2.out" }, 0);
    if (clip && visible(clip.r, clip.W, clip.H)) {
      tl.to(surface, { clipPath: `inset(0px 0px 0px 0px round 0px)`, duration: 0.001 }, 0)
        .to(surface, { clipPath: clip.str, duration: 0.6, ease: EIO }, 0.1)
        .add(Flip.fit(dIcon, geo.svg, { scale: true, duration: 0.6, ease: EIO }), 0.1);
    } else {
      tl.to(surface, { opacity: 0, scale: 0.98, duration: 0.3, ease: EOUT }, 0.08);
    }
  }

  function go(dir) {
    if (!openKey || busy) return;
    const i = (FAC[openKey].i + dir + ORDER.length) % ORDER.length;
    const k = ORDER[i];
    const F = FAC[k];
    const v = $("video", dMedia);
    if (v) v.pause();
    openKey = k;
    setBg(F.tint);
    if (reduce || !hasG) { fill(k); return; }
    busy = true;
    const parts = pieces().filter((el) => el !== dBar);
    dlg.style.setProperty("--fc", F.c);
    dlg.style.setProperty("--fc-fg", F.fg);
    dlg.style.setProperty("--fc-tint", F.tint);
    dNum.textContent = String(i + 1).padStart(2, "0");
    G.timeline({ onComplete: () => { busy = false; } })
      .to(dPath, { morphSVG: F.path, duration: 0.55, ease: EIO }, 0)
      .add(dotTo(dDot, F.dot, { duration: 0.55, ease: EIO }), 0)
      .to(parts, { opacity: 0, x: -16 * dir, duration: 0.18, ease: "power2.out" }, 0)
      .add(() => fill(k, false), 0.2)
      .fromTo(parts, { opacity: 0, x: 22 * dir }, { opacity: 1, x: 0, duration: 0.42, ease: EOUT, stagger: 0.04, clearProps: "opacity,transform" }, 0.22);
  }

  d.addEventListener("click", (e) => {
    const t = e.target.closest("[data-open]");
    if (t) { e.preventDefault(); open(t.dataset.open, t); }
  });
  $("[data-fac-close]", dlg).addEventListener("click", () => close());
  $("[data-fac-prev]", dlg).addEventListener("click", () => go(-1));
  $("[data-fac-next]", dlg).addEventListener("click", () => go(1));
  dlg.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.preventDefault(); close(); return; }
    if (e.key !== "Tab") return;
    const f = $$('button, a[href], video[controls], input, textarea, [tabindex]:not([tabindex="-1"])', dlg).filter((el) => el.offsetParent !== null || el === d.activeElement);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && d.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && d.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  addEventListener("resize", () => { if (openKey && !busy) G && G.set(surface, { clearProps: "clipPath" }); });

  /* ───── подбор «Что тебе нравится?» ───── */
  const chips = $$(".qchip");
  const mini = $(".quiz__board .shield--mini");
  const miniTiles = mini ? $$(".tile", mini) : [];
  const qEmpty = $("[data-quiz-empty]");
  const qFound = $("[data-quiz-found]");
  const qCountP = $("[data-quiz-count]") && $("[data-quiz-count]").parentElement; // строка пересобирается целиком
  const qList = $("[data-quiz-list]");
  function updateQuiz() {
    const hits = [];
    chips.forEach((c) => {
      if (c.getAttribute("aria-pressed") !== "true") return;
      c.dataset.match.split(",").forEach((k) => { if (!hits.includes(k)) hits.push(k); });
    });
    const n = hits.length;
    if (mini) {
      mini.classList.toggle("has-pick", n > 0);
      let q = 0;
      miniTiles.forEach((t) => {
        const hit = hits.includes(t.dataset.fac);
        t.classList.toggle("is-hit", hit);
        t.style.setProperty("--k", hit ? q++ : 0);
      });
    }
    qEmpty.hidden = n > 0;
    qFound.hidden = n === 0;
    if (!n) { qList.innerHTML = ""; return; }
    qCountP.innerHTML = `<b data-quiz-count>${n}</b> ${plural(n, ["факультет", "факультета", "факультетов"])} ${n % 10 === 1 && n % 100 !== 11 ? "подходит" : "подходят"}`;
    qList.innerHTML = hits.map((k) => {
      const F = FAC[k];
      const svg = $(".fcard__badge .pg", F.card).outerHTML;
      return `<li><button class="quiz__fac" type="button" data-open="${k}" aria-haspopup="dialog" aria-controls="fac" style="--fc:${F.c};--fc-fg:${F.fg};--fc-tint:${F.tint}">${svg}${esc(F.short || F.name)}</button></li>`;
    }).join("");
  }
  chips.forEach((c) => c.addEventListener("click", () => {
    c.setAttribute("aria-pressed", c.getAttribute("aria-pressed") === "true" ? "false" : "true");
    updateQuiz();
  }));

  /* ───── лид-форма ───── */
  const form = $("[data-lead]");
  if (form) {
    const contact = $("#lead-contact", form);
    const err = $("#lead-contact-err", form);
    const agree = $('input[name="agree"]', form);
    const ok = $("[data-lead-ok]", form);
    let agreeErr = null;
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const good = contact.value.trim().length >= 3;
      err.hidden = good;
      contact.setAttribute("aria-invalid", String(!good));
      if (!agree.checked) {
        if (!agreeErr) {
          agreeErr = d.createElement("p");
          agreeErr.className = "field__error";
          agreeErr.id = "lead-agree-err";
          agreeErr.textContent = "Поставь галочку, иначе мы не можем принять вопрос.";
          agree.closest(".check").after(agreeErr);
          agree.setAttribute("aria-describedby", agreeErr.id);
        }
        agreeErr.hidden = false;
      } else if (agreeErr) agreeErr.hidden = true;
      if (!good) { contact.focus(); return; }
      if (!agree.checked) { agree.focus(); return; }
      ok.hidden = false;
      form.reset();
    });
    contact.addEventListener("input", () => { if (!err.hidden && contact.value.trim().length >= 3) { err.hidden = true; contact.setAttribute("aria-invalid", "false"); } });
  }

  /* ───── состояния для скриншотов и обновление измерений ───── */
  const onReady = () => {
    if (hasG) ScrollTrigger.refresh();
    const states = (window.TVSU && window.TVSU.states) || new Set(new URLSearchParams(location.search).getAll("state").flatMap((s) => s.split(",")));
    if (states.has("quiz-result")) {
      chips.forEach((c) => { if (c.dataset.chip === "numbers" || c.dataset.chip === "code") c.setAttribute("aria-pressed", "true"); });
      updateQuiz();
    }
    if (states.has("faculty-open")) open("chem", $('.hero .tile[data-fac="chem"]'), { instant: true });
  };
  if (window.TVSU && window.TVSU.ready) window.TVSU.ready.then(onReady);
  else d.addEventListener("partials:ready", onReady, { once: true });
  if (d.fonts && d.fonts.ready && hasG) d.fonts.ready.then(() => ScrollTrigger.refresh());
})();
