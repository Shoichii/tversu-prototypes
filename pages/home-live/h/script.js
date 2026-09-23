/* h «Гипс» — связка страницы: монолит → веер по прокрутке, колоннада направлений,
   мобильная лента плит, высеченные имена, табличка «Вопрос принят», состояния для скриншотов. */
import { initHero } from "./hero.js";
import { initColonnade, columnPlates } from "./colonnade.js";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
const desk = window.matchMedia("(min-width: 1100px)");
const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";
const states = (window.TVSU && window.TVSU.states) || new Set(new URLSearchParams(location.search).get("state")?.split(",") || []);
const G = window.gsap, ST = window.ScrollTrigger;
let lenis = null;

/* ── данные направлений (пример: состав и число программ условные) ── */
const B = "бакалавриат", M = "магистратура", S = "специалитет";
const DIRS = [
  { name: "IT и математика", count: 24, items: [["Прикладная математика и информатика", B], ["Фундаментальная информатика и информационные технологии", B], ["Математика", B], ["Прикладная информатика", B], ["Математическое моделирование", M]] },
  { name: "Естественные науки", count: 22, items: [["Биология", B], ["Химия", B], ["Физика", B], ["География", B], ["Экология и природопользование", B]] },
  { name: "Гуманитарные науки", count: 30, items: [["Филология", B], ["История", B], ["Лингвистика", B], ["Перевод и переводоведение", S], ["Зарубежное регионоведение", B]] },
  { name: "Педагогика и психология", count: 20, items: [["Педагогическое образование", B], ["Психолого-педагогическое образование", B], ["Психология", B], ["Специальное (дефектологическое) образование", B], ["Социальная работа", B]] },
  { name: "Экономика и право", count: 21, items: [["Юриспруденция", B], ["Экономика", B], ["Менеджмент", B], ["Государственное и муниципальное управление", B], ["Бизнес-информатика", B]] },
  { name: "Физкультура и спорт", count: 12, items: [["Физическая культура", B], ["Спорт", B], ["Физическая культура для лиц с отклонениями в состоянии здоровья", B]] },
];
const nb = (t) => t.replace(/ (и|в|с|для|на|по|к) /g, " $1 ");

/* ═════════════ Первый экран ═════════════ */
const heroRoot = $("[data-hero-stage]");
const labels = $$("[data-facs] > li");
const scrollable = !!(G && ST) && !reduce.matches;
let hero = null, heroST = null;

if (heroRoot && labels.length === 15) {
  hero = initHero(heroRoot, { labels, title: $("#facs-title"), leaders: $("[data-leaders]"), desk, scroll: scrollable && desk.matches });

  labels.forEach((li, i) => {
    li.addEventListener("mouseenter", () => hero.hover(i));
    li.addEventListener("mouseleave", () => hero.hover(-1));
    li.addEventListener("focusin", () => {
      hero.hover(i);
      // этикетка ещё не проявилась — докручиваем веер до конца, чтобы фокус был виден
      if (heroST && desk.matches && hero.progress() < 0.98) {
        const y = heroST.end + 2;
        if (lenis) lenis.scrollTo(y, { duration: 0.9 });
        else window.scrollTo({ top: y, behavior: reduce.matches ? "auto" : "smooth" });
      }
    });
    li.addEventListener("focusout", () => hero.hover(-1));
  });
}

/* мобильная лента плит: центральная пластина приподнимается */
const facsList = $("[data-facs]");
if (facsList && "IntersectionObserver" in window) {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => e.target.classList.toggle("is-center", e.isIntersecting && !desk.matches));
  }, { root: facsList, rootMargin: "0px -42% 0px -42%", threshold: 0 });
  labels.forEach((li) => io.observe(li));
}

/* ═════════════ Направления: чипы, список, колоннада ═════════════ */
const chips = $$("[data-dir]");
const progName = $("[data-prog-name]");
const progItems = $("[data-prog-items]");
const progList = $("[data-prog-list]");
const colsRoot = $("[data-cols-stage]");
const visual = $(".h-prog__visual");
const colSvg = $("[data-colsvg]");
let current = 0, userPicked = false, cols = null, listAnim = null;

function drawSvgColonnade() {
  if (!colSvg) return;
  const NS = "http://www.w3.org/2000/svg";
  const el = (tag, attrs, parent) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); parent.appendChild(n); return n; };
  colSvg.textContent = "";
  el("rect", { class: "c-floor", x: 16, y: 324, width: 608, height: 18, rx: 1 }, colSvg);
  const PH = 12, PG = 3, floorY = 324;
  DIRS.forEach((d, i) => {
    const cx = 68 + i * 100.8;
    const g = el("g", { class: "c-col", "data-col": i }, colSvg);
    el("ellipse", { class: "c-shadow", cx: cx + 10, cy: floorY + 4, rx: 46, ry: 6 }, g);
    el("rect", { class: "c-base", x: cx - 33, y: floorY - 14, width: 66, height: 14, rx: 1 }, g);
    const n = columnPlates(d.count);
    let y = floorY - 14 - PG;
    for (let k = 0; k < n; k++) { y -= PH; el("rect", { class: "c-plate", x: cx - 23, y, width: 46, height: PH, rx: 1 }, g); y -= PG; }
    el("rect", { class: "c-cap", x: cx - 35, y: y - 10, width: 70, height: 10, rx: 1 }, g);
  });
}

function renderList(i, animate) {
  const d = DIRS[i];
  progName.textContent = nb(d.name);
  progItems.textContent = "";
  d.items.forEach(([t, lvl]) => {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = "#";
    const s1 = document.createElement("span"); s1.textContent = nb(t);
    const s2 = document.createElement("span"); s2.className = "h-progs__lvl"; s2.textContent = lvl;
    a.append(s1, s2); li.append(a); progItems.append(li);
  });
  if (!animate || !progList.animate) return;
  listAnim?.cancel();
  // короткая смена содержимого: ответ интерфейса, 200 мс, без театра
  listAnim = progList.animate(
    reduce.matches ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "none" }],
    { duration: 200, easing: EASE_OUT }
  );
}

function select(i, { animate = true, instant = false } = {}) {
  current = i;
  chips.forEach((c, k) => c.setAttribute("aria-pressed", String(k === i)));
  $$(".c-col", colSvg || document).forEach((g, k) => g.classList.toggle("is-on", k === i));
  renderList(i, animate);
  cols?.select(i, instant);
}

function mountCols() {
  if (cols || !colsRoot || !desk.matches) return;
  cols = initColonnade(colsRoot, DIRS, { selected: current, focused: userPicked });
  if (cols) visual?.classList.add("is-3d");
}

drawSvgColonnade();
$$(".c-col", colSvg || document).forEach((g, k) => g.classList.toggle("is-on", k === current));
chips.forEach((c, i) => c.addEventListener("click", () => { userPicked = true; if (i !== current || cols) select(i); }));

if (colsRoot) {
  if (reduce.matches || !("IntersectionObserver" in window)) {
    mountCols();
    desk.addEventListener?.("change", mountCols);
  } else {
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting && desk.matches) { mountCols(); if (cols) io.disconnect(); } }, { rootMargin: "300px 0px" });
    io.observe(visual || colsRoot);
  }
}

/* ═════════════ Высеченные имена: лесенка ═════════════ */
$$(".h-carve").forEach((el, i) => el.style.setProperty("--carve-i", String(i)));

/* ═════════════ Вопрос в приёмную → гипсовая табличка ═════════════ */
const lead = $("[data-lead]");
const form = $("[data-lead-form]");
const err = $("[data-lead-err]");
const wrap = $("[data-plaque-wrap]");
const plaque = $("[data-plaque]");
let plaqueAnim = null;

function showPlaque(animate) {
  if (!lead || !form || !wrap) return;
  lead.style.minHeight = lead.offsetHeight + "px";
  form.hidden = true;
  wrap.hidden = false;
  plaqueAnim?.cancel();
  if (animate && plaque.animate) {
    // редкий момент успеха: табличка встаёт с наклона, 700 мс, сильный ease-out
    plaqueAnim = plaque.animate(
      reduce.matches
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [{ opacity: 0, transform: "translateY(-24px) rotateX(-70deg)" }, { opacity: 1, transform: "none" }],
      { duration: reduce.matches ? 200 : 700, easing: EASE_OUT }
    );
  }
  if (animate) plaque.focus({ preventScroll: true });
}

if (form) {
  const q = $("#lead-q"), c = $("#lead-c");
  const mark = (input, bad) => input.setAttribute("aria-invalid", String(bad));
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const qv = q.value.trim(), cv = c.value.trim();
    const contactOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cv) || /^(@|https?:\/\/t\.me\/|t\.me\/)[A-Za-z0-9_]{4,}$/.test(cv);
    mark(q, !qv); mark(c, !contactOk);
    if (!qv) { err.textContent = "Напишите вопрос — хватит одного предложения."; q.focus(); return; }
    if (!contactOk) { err.textContent = "Укажите e-mail или Telegram, например name@mail.ru или @username."; c.focus(); return; }
    err.textContent = "";
    showPlaque(true);
  });
  [q, c].forEach((input) => input.addEventListener("input", () => { if (input.getAttribute("aria-invalid") === "true") { mark(input, false); err.textContent = ""; } }));

  $("[data-plaque-reset]")?.addEventListener("click", () => {
    plaqueAnim?.cancel();
    wrap.hidden = true;
    form.hidden = false;
    q.value = "";
    lead.style.minHeight = "";
    if (form.animate) form.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: EASE_OUT });
    q.focus();
  });
}

/* ═════════════ Прокрутка: пин веера и Lenis ═════════════ */
if (G && ST) {
  G.registerPlugin(ST);
  const mm = G.matchMedia();
  mm.add({ motion: "(prefers-reduced-motion: no-preference)", desk: "(min-width: 1100px)", fine: "(hover: hover) and (pointer: fine)" }, (ctx) => {
    const { motion, desk: isDesk, fine: isFine } = ctx.conditions;
    if (!motion) return;
    const cleanups = [];

    const pin = $(".h-hero__pin");
    if (isDesk && hero && pin) {
      hero.setScrollMode(true);
      heroST = ST.create({
        trigger: pin,
        pin: true,
        start: "bottom bottom",
        end: () => "+=" + Math.round(window.innerHeight * 1.05),
        invalidateOnRefresh: true,
        onUpdate: (self) => hero.setTarget(self.progress),
        onLeave: () => hero.snap(1),
        onRefresh: (self) => { hero.refit(); self.progress >= 1 ? hero.snap(1) : hero.setTarget(self.progress); },
      });
      cleanups.push(() => { heroST?.kill(); heroST = null; hero.setScrollMode(false); });
    }

    if (isDesk && isFine && typeof window.Lenis === "function") {
      lenis = new window.Lenis({ lerp: 0.12, anchors: { offset: -76 } });
      lenis.on("scroll", ST.update);
      const raf = (time) => lenis.raf(time * 1000);
      G.ticker.add(raf);
      G.ticker.lagSmoothing(0);
      const doc = document.documentElement;
      let locked = false;
      const mo = new MutationObserver(() => {
        const now = doc.classList.contains("is-locked");
        if (now === locked) return;
        locked = now;
        now ? lenis.stop() : lenis.start();
      });
      mo.observe(doc, { attributes: true, attributeFilter: ["class"] });
      cleanups.push(() => { mo.disconnect(); G.ticker.remove(raf); G.ticker.lagSmoothing(500, 33); lenis.destroy(); lenis = null; });
    }

    return () => cleanups.forEach((fn) => fn());
  });

  const refresh = () => ST.refresh();
  if (window.TVSU && window.TVSU.ready) window.TVSU.ready.then(() => requestAnimationFrame(refresh));
  else document.addEventListener("partials:ready", refresh, { once: true });
  document.fonts?.ready?.then(refresh);
  window.addEventListener("load", refresh, { once: true });
}

/* ═════════════ Состояния для скриншотов ═════════════ */
function applyStates() {
  if (states.has("direction-selected")) { userPicked = true; select(2, { animate: false, instant: true }); }
  if (states.has("lead-sent")) showPlaque(false);
}
if (window.TVSU && window.TVSU.ready) window.TVSU.ready.then(applyStates);
else applyStates();
