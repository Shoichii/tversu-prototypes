/* home-live/b — «Игрушечный кампус»: сцены и взаимодействия страницы.
   hero: диорама (scene.js) + HTML-флажки + карточки зданий + закат по прокрутке;
   «Кому что нужно»: пластиковые предметы (icons3d.js, лениво);
   «Жизнь в кампусе»: вторая диорама, вкладки везут камеру; лид: флажок почтового ящика. */
import { mountStage } from "../../../system/three-stage.js";
import { createCampus } from "./scene.js";

const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const coarse = window.matchMedia("(pointer: coarse)").matches;
const states = new Set((new URLSearchParams(location.search).get("state") || "").split(",").map((s) => s.trim()).filter(Boolean));

function isSoftware(renderer) {
  try {
    const gl = renderer.getContext();
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const name = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
    return /swiftshader|llvmpipe|software|basic render|softpipe/i.test(name);
  } catch (e) {
    return false;
  }
}

/* адаптивное качество: средний кадр тяжёлый → ниже плотность пикселей (1 → 0.75) */
function makeGovernor(getHandle, floor) {
  let acc = 0, n = 0, step = 0;
  const ladder = [1, 0.75, floor].filter((v, i, a) => a.indexOf(v) === i && v >= floor);
  return (st) => {
    if (reduce || !st.dt) return;
    acc += st.dt; n++;
    if (n < 36) return;
    const avg = acc / n; acc = 0; n = 0;
    const h = getHandle();
    if (!h || avg < 0.03 || step >= ladder.length) return;
    const pr = ladder[step++];
    if (h.renderer.getPixelRatio() <= pr) return;
    h.renderer.setPixelRatio(pr);
    h.renderer.setSize(st.width, st.height, false);
  };
}

function lazy(el, fn, margin = "300px 0px") {
  if (!el) return;
  if (reduce || !("IntersectionObserver" in window)) { fn(); return; }
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) { io.disconnect(); fn(); }
  }, { rootMargin: margin });
  io.observe(el);
}

/* ═════════ HERO ═════════ */
const heroEl = document.querySelector("[data-hero]");
const campusEl = heroEl?.querySelector("[data-campus]");
const stageEl = campusEl?.querySelector(".campus__stage");

if (campusEl && stageEl) {
  const pins = [...stageEl.querySelectorAll(".pin")];
  const triggers = [...campusEl.querySelectorAll("[data-open]")];
  const cards = Object.fromEntries([...campusEl.querySelectorAll("[data-card]")].map((c) => [c.dataset.card, c]));
  let ctl = null;
  let hero = null;
  let pinsOn = window.innerWidth >= 768;
  const last = new Map();

  const placePins = () => {
    if (!pinsOn || !ctl) return;
    const a = ctl.anchors();
    for (const p of pins) {
      const q = a[p.dataset.open];
      if (!q) continue;
      const prev = last.get(p);
      if (prev && Math.abs(prev.x - q.x) < 0.3 && Math.abs(prev.y - q.y) < 0.3) continue;
      last.set(p, { x: q.x, y: q.y });
      p.style.translate = `${q.x.toFixed(1)}px ${q.y.toFixed(1)}px`;
    }
  };

  const govern = makeGovernor(() => hero, 0.6);
  hero = mountStage(stageEl, ({ scene, camera, renderer }) => {
    const soft = !reduce && isSoftware(renderer);
    const low = !reduce && (window.innerWidth < 768 || coarse || soft);
    if (soft) renderer.setPixelRatio(Math.min(renderer.getPixelRatio(), 0.75));
    ctl = createCampus({ scene, camera, renderer, mode: "hero", reduce, low, mobile: window.innerWidth < 768 });
    const pinsEl = stageEl.querySelector("[data-pins]");
    const t0 = performance.now();
    let pinsReady = false;
    return (st) => {
      ctl.frame(st); placePins(); govern(st);
      // флажки встают, когда здания выпрыгнули; на медленном рендере — не позже 2,2 с
      if (!pinsReady && pinsEl && (ctl.ready || performance.now() - t0 > 2200)) {
        pinsReady = true;
        pinsEl.classList.add("is-ready", "is-entering");
        setTimeout(() => pinsEl.classList.remove("is-entering"), 1000);
      }
    };
  }, {
    camera: "ortho", alpha: true, maxDpr: 1.5,
    onResize(st) {
      pinsOn = window.innerWidth >= 768;
      last.clear();
      ctl?.resize(st);
    },
  });
  if (hero) { last.clear(); hero.redraw(); }

  /* наведение и клик по зданиям */
  let hot = null;
  const setHot = (key) => {
    if (key === hot) return;
    hot = key;
    stageEl.classList.toggle("is-pointing", !!key);
    pins.forEach((p) => p.classList.toggle("is-hot", p.dataset.open === key));
    if (key) ctl?.bounce(key);
  };
  const pickAt = (e) => {
    if (!ctl) return null;
    const r = stageEl.getBoundingClientRect();
    return ctl.pick(e.clientX - r.left, e.clientY - r.top);
  };
  if (hero) {
    stageEl.addEventListener("pointermove", (e) => {
      if (e.pointerType !== "mouse" || e.target.closest(".pin")) return;
      setHot(pickAt(e));
    }, { passive: true });
    stageEl.addEventListener("pointerleave", () => setHot(null));
    stageEl.addEventListener("click", (e) => {
      if (e.target.closest(".pin")) return;
      const key = pickAt(e);
      if (!key) { if (current) close(); return; }
      ctl.bounce(key);
      const t = window.innerWidth >= 768 ? pins.find((p) => p.dataset.open === key) : campusEl.querySelector(`.spot[data-open="${key}"]`);
      open(key, { trigger: t, fromCanvas: true });
    });
    pins.forEach((p) => p.addEventListener("pointerenter", () => ctl?.bounce(p.dataset.open)));
  }

  /* карточки */
  let current = null;
  let lastTrigger = null;
  function open(key, { trigger = null, instant = false, fromCanvas = false } = {}) {
    if (current === key && !instant) { close({ restore: true }); return; }
    if (current) { cards[current].hidden = true; cards[current].classList.remove("is-open"); pauseVideo(cards[current]); }
    current = key;
    const card = cards[key];
    card.hidden = false;
    card.classList.remove("is-open");
    if (!instant && !reduce) { void card.offsetWidth; card.classList.add("is-open"); }
    triggers.forEach((t) => t.setAttribute("aria-expanded", String(t.dataset.open === key)));
    campusEl.classList.add("has-card");
    lastTrigger = trigger;
    ctl?.focus(key, instant);
    if (reduce) hero?.redraw();
    if (!instant) {
      if (window.innerWidth < 1024) card.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
      if (!fromCanvas) card.focus({ preventScroll: true });
    }
  }
  function close({ restore = false } = {}) {
    if (!current) return;
    const card = cards[current];
    card.hidden = true;
    card.classList.remove("is-open");
    pauseVideo(card);
    triggers.forEach((t) => t.setAttribute("aria-expanded", "false"));
    campusEl.classList.remove("has-card");
    current = null;
    ctl?.focus(null);
    if (reduce) hero?.redraw();
    if (restore && lastTrigger && lastTrigger.getClientRects().length) lastTrigger.focus({ preventScroll: true });
  }
  function pauseVideo(card) { card.querySelector("video")?.pause(); }

  triggers.forEach((t) => t.addEventListener("click", () => open(t.dataset.open, { trigger: t })));
  campusEl.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => close({ restore: true })));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && current && !document.documentElement.classList.contains("is-locked")) close({ restore: true });
  });

  /* видео Ботсада — только по кнопке, без звука */
  campusEl.querySelectorAll("[data-play]").forEach((btn) => btn.addEventListener("click", () => {
    const fig = btn.closest("[data-video]");
    const img = fig.querySelector("img");
    const v = document.createElement("video");
    v.muted = true; v.playsInline = true; v.controls = true; v.loop = true; v.preload = "auto";
    v.poster = img.currentSrc || img.src;
    v.width = 1280; v.height = 720;
    v.setAttribute("aria-label", img.alt);
    v.src = btn.dataset.src;
    fig.replaceChildren(v);
    v.play().catch(() => {});
    v.focus();
  }));

  if (states.has("building-open")) open("walk", { instant: true });

  /* закат по прокрутке hero */
  if (!reduce && hero && heroEl) {
    const dusk = heroEl.querySelector(".hero__dusk");
    const sun = campusEl.querySelector(".campus__sun");
    let heroH = heroEl.offsetHeight;
    new ResizeObserver(() => { heroH = heroEl.offsetHeight; }).observe(heroEl);
    let queued = false, lastP = -1;
    const apply = () => {
      queued = false;
      const p = Math.min(1, Math.max(0, window.scrollY / (heroH * 0.85)));
      if (Math.abs(p - lastP) < 0.004) return;
      lastP = p;
      dusk.style.opacity = p.toFixed(3);
      sun.style.transform = `translate3d(0, ${(p * 140).toFixed(1)}px, 0)`;
      sun.style.backgroundColor = p > 0.02 ? `color-mix(in srgb, #FFF0B8, #FFB38A ${Math.round(p * 100)}%)` : "";
      ctl?.setSunset(p);
    };
    window.addEventListener("scroll", () => { if (!queued) { queued = true; requestAnimationFrame(apply); } }, { passive: true });
    apply();
  }
}

/* ═════════ КОМУ ЧТО НУЖНО: предметы ═════════ */
const doorsWrap = document.querySelector("[data-doors]");
lazy(doorsWrap, async () => {
  try {
    const { mountDoors } = await import("./icons3d.js");
    const h = mountDoors(doorsWrap.querySelector(".doors__stage"), doorsWrap);
    if (h) doorsWrap.classList.add("is-3d");
  } catch (e) {
    /* без WebGL остаются SVG-предметы */
  }
});

/* ═════════ ЖИЗНЬ В КАМПУСЕ ═════════ */
const lifeEl = document.querySelector("[data-life]");
if (lifeEl) {
  const tabs = [...lifeEl.querySelectorAll('[role="tab"]')];
  const shots = [...lifeEl.querySelectorAll("[data-shot]")];
  let lctl = null, lhandle = null;
  let view = tabs.find((t) => t.getAttribute("aria-selected") === "true")?.dataset.view || "room";

  const showShot = (key) => {
    shots.forEach((img) => {
      const on = img.dataset.shot === key;
      if (on) { img.classList.remove("was-on"); img.classList.add("is-on"); }
      else if (img.classList.contains("is-on")) {
        img.classList.remove("is-on"); img.classList.add("was-on");
        setTimeout(() => img.classList.remove("was-on"), reduce ? 0 : 600);
      }
    });
  };
  const setView = (key) => {
    if (!key || key === view) return;
    view = key;
    showShot(key);
    lctl?.focus(key);
    if (reduce) lhandle?.redraw();
  };
  const mo = new MutationObserver(() => {
    const t = tabs.find((x) => x.getAttribute("aria-selected") === "true");
    if (t) setView(t.dataset.view);
  });
  tabs.forEach((t) => mo.observe(t, { attributes: true, attributeFilter: ["aria-selected"] }));

  const stage = lifeEl.querySelector(".life__stage");
  lazy(stage, () => {
    const govern = makeGovernor(() => lhandle, 0.6);
    lhandle = mountStage(stage, ({ scene, camera, renderer }) => {
      const soft = !reduce && isSoftware(renderer);
      if (soft) renderer.setPixelRatio(Math.min(renderer.getPixelRatio(), 0.75));
      lctl = createCampus({ scene, camera, renderer, mode: "life", reduce, low: !reduce && (window.innerWidth < 768 || coarse || soft), mobile: window.innerWidth < 1024 });
      return (st) => { lctl.frame(st); govern(st); };
    }, {
      camera: "ortho", alpha: true, maxDpr: 1.25,
      onResize(st) { lctl?.resize(st); },
    });
    if (!lhandle || !lctl) return;
    if (reduce) {
      lctl.focus(view, true);
      lhandle.redraw();
    } else {
      lctl.focus(null, true);
      setTimeout(() => lctl.focus(view), 350);
    }
  }, "150px 0px");
}

/* ═════════ ЛИД ═════════ */
const form = document.querySelector("[data-lead-form]");
if (form) {
  const lead = form.closest("[data-lead]");
  const input = form.querySelector("#lead-contact");
  const err = form.querySelector("#lead-contact-err");
  const done = lead.querySelector("[data-lead-done]");
  const valid = (v) => /^@[A-Za-z0-9_]{4,32}$/.test(v) || v.replace(/\D/g, "").length === 11;
  const check = (show) => {
    const ok = valid(input.value.trim());
    if (show || input.getAttribute("aria-invalid") === "true") {
      input.setAttribute("aria-invalid", String(!ok));
      err.hidden = ok;
    }
    return ok;
  };
  input.addEventListener("input", () => check(false));
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!check(true)) { input.focus(); return; }
    lead.classList.add("is-sent");
    form.hidden = true;
    done.hidden = false;
    done.tabIndex = -1;
    done.focus({ preventScroll: true });
  });
}
