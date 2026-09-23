/* home-live/f — «Орбита 129».
   Вырез видеосцены под кнопку, видео по появлению, орбита программ (3D на InstancedMesh ≥768 с WebGL,
   иначе SVG: дуга на телефоне, эллипс на десктопе), ленты с перетаскиванием, липкая кнопка, форма.
   three.js грузится динамически и только когда секция орбиты рядом. */

const reduce = matchMedia("(prefers-reduced-motion: reduce)");
const wide = matchMedia("(min-width: 768px)");
const fine = matchMedia("(hover: hover) and (pointer: fine)");
const states = new Set(
  (new URLSearchParams(location.search).get("state") || "").split(",").map((s) => s.trim()).filter(Boolean)
);
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* ═════ 1. Вырез карточки под кнопку ═════
   Контур по часовой: внешние скругления R, у выреза — выпуклые r2 на нижней кромке
   и вогнутые r1 = bh/2 + g, концентричные торцам кнопки-пилюли. */
function initNotch() {
  const stage = $("[data-notch]");
  if (!stage) return;
  const card = $("[data-notch-card]", stage);
  const btn = $("[data-notch-btn]", stage);
  const f = (n) => Math.round(n * 100) / 100;
  const draw = () => {
    const W = card.clientWidth, H = card.clientHeight;
    const bw = btn.offsetWidth, bh = btn.offsetHeight;
    const R = W >= 700 ? 32 : 24;
    const g = W >= 960 ? 12 : 8;
    const nw = bw + 2 * g, nh = bh + g;
    const r1 = bh / 2 + g;
    const r2 = Math.max(4, Math.min(18, bh / 2 - 4));
    if (!W || !H || !bw || nw + 2 * (r2 + R) > W || nh + R + r2 > H) {
      card.style.clipPath = "";
      stage.classList.remove("has-notch");
      return;
    }
    const cx = W / 2, L = cx - nw / 2, Rt = cx + nw / 2;
    const d = [
      `M ${R} 0`, `H ${f(W - R)}`, `A ${R} ${R} 0 0 1 ${W} ${R}`,
      `V ${f(H - R)}`, `A ${R} ${R} 0 0 1 ${f(W - R)} ${H}`,
      `H ${f(Rt + r2)}`, `A ${r2} ${r2} 0 0 1 ${f(Rt)} ${f(H - r2)}`,
      `V ${f(H - nh + r1)}`, `A ${r1} ${r1} 0 0 0 ${f(Rt - r1)} ${f(H - nh)}`,
      `H ${f(L + r1)}`, `A ${r1} ${r1} 0 0 0 ${f(L)} ${f(H - nh + r1)}`,
      `V ${f(H - r2)}`, `A ${r2} ${r2} 0 0 1 ${f(L - r2)} ${H}`,
      `H ${R}`, `A ${R} ${R} 0 0 1 0 ${f(H - R)}`, `V ${R}`, `A ${R} ${R} 0 0 1 ${R} 0`, "Z",
    ].join(" ");
    card.style.clipPath = `path("${d}")`;
    stage.classList.add("has-notch");
  };
  let raf = 0;
  const schedule = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; draw(); }); };
  const ro = new ResizeObserver(schedule);
  ro.observe(card);
  ro.observe(btn);
  document.fonts?.ready.then(schedule);
  draw();
}

/* ═════ 2. Видео: постер всегда, файл — только без reduced-motion и по появлению ═════ */
function initVideos() {
  $$("[data-video]").forEach((v) => {
    const box = v.closest(".f-stage__card, .f-trad__media");
    const btn = box && $("[data-video-toggle]", box);
    const label = btn && $("[data-video-label]", btn);
    const small = !wide.matches;
    if (small && v.dataset.posterSmall) v.poster = v.dataset.posterSmall;
    if (reduce.matches) return;
    const c = navigator.connection;
    if (small && c && (c.saveData || /2g$/.test(c.effectiveType || ""))) return;

    let loaded = false, broken = false, userPaused = false, inView = false;
    v.addEventListener("error", () => {
      // кодек или сеть подвели — остаёмся на постере, без «битого» видео
      broken = true;
      v.removeAttribute("src");
      v.load();
      if (btn) btn.hidden = true;
    });
    const load = () => {
      if (loaded) return;
      loaded = true;
      v.src = (small && v.dataset.srcSmall) || v.dataset.src;
      if (btn) btn.hidden = false;
    };
    const sync = () => {
      if (broken) return;
      if (inView && !userPaused) {
        load();
        const p = v.play();
        if (p) p.catch(() => {});
      } else if (loaded) v.pause();
    };
    new IntersectionObserver(([e]) => { inView = e.isIntersecting; sync(); }, { rootMargin: "60px" }).observe(v);
    btn?.addEventListener("click", () => {
      userPaused = !userPaused;
      btn.toggleAttribute("data-paused", userPaused);
      if (label) label.textContent = userPaused ? "Включить видео" : "Поставить видео на паузу";
      sync();
    });
  });
}

/* ═════ 3. Орбита 129 ═════ */
const LV = { b: "бакалавриат", m: "магистратура", a: "аспирантура" };
const DIRS = [
  { name: "IT и математика", count: 24, fac: "Математический факультет, факультет прикладной математики и кибернетики",
    progs: [["Прикладная математика и информатика", "b"], ["Фундаментальная информатика и информационные технологии", "b"], ["Математика", "b"], ["Прикладная информатика", "b"], ["Математическое моделирование", "m"], ["Дискретная математика и математическая кибернетика", "a"]] },
  { name: "Естественные науки", count: 22, fac: "Биологический, химико-технологический и физико-технический факультеты, факультет географии и геоэкологии",
    progs: [["Биология", "b"], ["Химия", "b"], ["Физика", "b"], ["География", "b"], ["Экология и природопользование", "b"], ["Химическая технология", "m"]] },
  { name: "Гуманитарные", count: 27, fac: "Исторический и филологический факультеты, факультеты иностранных языков и психологии",
    progs: [["История", "b"], ["Филология", "b"], ["Лингвистика", "b"], ["Журналистика", "b"], ["Психология", "b"], ["Международные отношения", "m"]] },
  { name: "Педагогика", count: 19, fac: "Институт педагогического образования и социальных технологий, Институт непрерывного образования",
    progs: [["Педагогическое образование", "b"], ["Психолого-педагогическое образование", "b"], ["Специальное (дефектологическое) образование", "b"], ["Педагогика высшей школы", "m"], ["Общая педагогика, история педагогики и образования", "a"]] },
  { name: "Экономика и право", count: 21, fac: "Институт экономики и управления, юридический факультет",
    progs: [["Юриспруденция", "b"], ["Экономика", "b"], ["Менеджмент", "b"], ["Государственное и муниципальное управление", "b"], ["Бизнес-информатика", "b"], ["Правосудие и прокурорская деятельность", "m"]] },
  { name: "Спорт", count: 16, fac: "Факультет физической культуры",
    progs: [["Физическая культура", "b"], ["Спорт", "b"], ["Адаптивная физическая культура", "b"], ["Спортивная тренировка", "m"]] },
];

// 129 плашек + по пустому слоту между направлениями = 135 слотов по кругу
const SLOTS = [];
const PLATE = [];
DIRS.forEach((d, s) => {
  for (let k = 0; k < d.count; k++) { PLATE.push(SLOTS.length); SLOTS.push(s); }
  SLOTS.push(-1);
});
const NSLOT = SLOTS.length;
const slotA = (i) => (i / NSLOT) * TAU;
const segFirst = DIRS.map((_, s) => SLOTS.indexOf(s));
const segCenter = DIRS.map((d, s) => slotA(segFirst[s] + (d.count - 1) / 2));
const plateSeg = PLATE.map((i) => SLOTS[i]);
const plateOff = PLATE.map((i) => { const s = SLOTS[i]; return Math.abs(i - segFirst[s] - (DIRS[s].count - 1) / 2); });
const wrapPi = (a) => a - TAU * Math.round(a / TAU);
const nearestEq = (target, from) => target + TAU * Math.round((from - target) / TAU);

const ctl = {
  angle: -segCenter[0], vel: 0, target: -segCenter[0], mode: "idle",
  sel: 0, hover: -1, t: 0, selT: 0,
  lift: new Float32Array(PLATE.length),
};
const liftTarget = (p) => (plateSeg[p] === ctl.sel && ctl.t - ctl.selT >= plateOff[p] * 0.022 ? 1 : 0);

function frontSeg(angle) {
  let best = 0, bd = Infinity;
  segCenter.forEach((c, s) => {
    const d = Math.abs(wrapPi(-c - angle));
    if (d < bd) { bd = d; best = s; }
  });
  return best;
}

/* Шаг физики: инерция после броска → доводка пружиной к сегменту; плашки выбранного выходят лесенкой от центра.
   Возвращает true, пока что-то движется. */
function step(dt) {
  if (reduce.matches) {
    if (ctl.mode !== "drag") { ctl.angle = ctl.target; ctl.vel = 0; ctl.mode = "idle"; }
    for (let p = 0; p < ctl.lift.length; p++) ctl.lift[p] = plateSeg[p] === ctl.sel ? 1 : 0;
    return false;
  }
  if (!dt) return ctl.mode !== "idle";
  ctl.t += dt;
  if (ctl.mode === "inertia") {
    ctl.angle += ctl.vel * dt;
    ctl.vel *= Math.exp(-3.2 * dt);
    if (Math.abs(ctl.vel) < 0.4) select(frontSeg(ctl.angle + ctl.vel / 3.2), { user: true, keepVel: true });
  } else if (ctl.mode === "spring") {
    const h = dt / 2;
    for (let i = 0; i < 2; i++) {
      const a = -26 * (ctl.angle - ctl.target) - 9.2 * ctl.vel;
      ctl.vel += a * h;
      ctl.angle += ctl.vel * h;
    }
    if (Math.abs(ctl.angle - ctl.target) < 0.0008 && Math.abs(ctl.vel) < 0.006) {
      ctl.angle = ctl.target; ctl.vel = 0; ctl.mode = "idle";
    }
  }
  let busy = ctl.mode !== "idle";
  const k = 1 - Math.exp(-9 * dt);
  for (let p = 0; p < ctl.lift.length; p++) {
    const tg = liftTarget(p), d = tg - ctl.lift[p];
    if (Math.abs(d) > 0.0015) { ctl.lift[p] += d * k; busy = true; } else ctl.lift[p] = tg;
  }
  return busy;
}

/* ───── Панель со списком ───── */
const orbit = {
  viz: $("[data-orbit-viz]"),
  stage: $("[data-orbit-stage]"),
  svg: $("[data-orbit-svg]"),
  core: $(".f-orbit__core"),
  chips: $$("[data-orbit-chips] [data-dir]"),
  levels: $$("[data-orbit-levels] [data-lv]"),
  name: $("[data-orbit-name]"),
  meta: $("[data-orbit-meta]"),
  list: $("[data-orbit-list]"),
  status: $("[data-orbit-status]"),
};
let level = "all";
let swapT = 0;

function renderPanel({ animate = false, announce = false } = {}) {
  const d = DIRS[ctl.sel];
  orbit.chips.forEach((b) => b.setAttribute("aria-pressed", String(+b.dataset.dir === ctl.sel)));
  orbit.levels.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lv === level)));
  const items = d.progs.filter(([, lv]) => level === "all" || lv === level);
  const apply = () => {
    orbit.name.textContent = d.name;
    orbit.meta.textContent = `[N] программ · ${d.fac}`;
    if (items.length) {
      orbit.list.replaceChildren(...items.map(([n, lv]) => {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = "#";
        const nm = document.createElement("span"); nm.className = "f-progs__name"; nm.textContent = n;
        const tg = document.createElement("span"); tg.className = "f-progs__lvl"; tg.textContent = LV[lv];
        a.append(nm, tg); li.append(a);
        return li;
      }));
    } else {
      const li = document.createElement("li");
      li.className = "f-progs__empty";
      li.textContent = `В примере нет программ уровня «${LV[level]}» по этому направлению. Полный перечень — в каталоге: [ссылка].`;
      orbit.list.replaceChildren(li);
    }
  };
  if (announce) orbit.status.textContent = `${d.name}: в списке ${items.length} ${plural(items.length)}.`;
  const swap = [orbit.name, orbit.meta, orbit.list];
  if (animate && !reduce.matches) {
    swap.forEach((el) => el.classList.add("is-out"));
    clearTimeout(swapT);
    swapT = setTimeout(() => { apply(); swap.forEach((el) => el.classList.remove("is-out")); }, 150);
  } else apply();
}
const plural = (n) => (n % 10 === 1 && n % 100 !== 11 ? "программа" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? "программы" : "программ");

let kick = () => {};
function select(s, { instant = false, user = false, keepVel = false } = {}) {
  const changed = s !== ctl.sel;
  ctl.sel = s;
  if (changed) ctl.selT = ctl.t;
  ctl.target = nearestEq(-segCenter[s], ctl.angle);
  if (instant) {
    ctl.angle = ctl.target; ctl.vel = 0; ctl.mode = "idle";
    for (let p = 0; p < ctl.lift.length; p++) ctl.lift[p] = plateSeg[p] === s ? 1 : 0;
    ctl.selT = -1e3;
  } else {
    if (ctl.selT > ctl.t + 1) ctl.selT = ctl.t; // интро ещё не случилось, а выбор уже сделан
    if (!keepVel) ctl.vel *= 0.3;
    ctl.mode = "spring";
  }
  if (changed || user) renderPanel({ animate: changed && !instant, announce: user && changed });
  kick();
}
function setLevel(lv) {
  level = lv;
  renderPanel({ animate: true, announce: true });
}

/* ───── SVG: дуга (телефон) и эллипс с глубиной (десктоп без WebGL) ───── */
const NS = "http://www.w3.org/2000/svg";
const COL = { base: "#4a4a55", sel: "#7b61ff", hover: "#6f6690" };
function el(name, attrs, parent) {
  const n = document.createElementNS(NS, name);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.append(n);
  return n;
}
function makeSvg(kind) {
  const svg = orbit.svg;
  svg.replaceChildren();
  const arc = kind === "arc";
  const G = arc ? { w: 360, h: 270, cx: 180, cy: 300, r: 232 } : { w: 600, h: 470, cx: 300, cy: 220, rx: 262, ry: 112 };
  svg.setAttribute("viewBox", `0 0 ${G.w} ${G.h}`);
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

  const orbitAttrs = { fill: "none", stroke: "#8e8b85", "stroke-width": arc ? 1.2 : 1.4, "stroke-dasharray": arc ? "2 6" : "3 7", "stroke-linecap": "round", opacity: 0.7 };
  let dotPath;
  if (arc) {
    const r = 262;
    el("circle", { cx: G.cx, cy: G.cy, r, ...orbitAttrs }, svg);
    const a = Math.PI / 3, x1 = G.cx - r * Math.sin(a), x2 = G.cx + r * Math.sin(a), y = G.cy - r * Math.cos(a);
    dotPath = `M ${x1.toFixed(1)} ${y.toFixed(1)} A ${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y.toFixed(1)}`;
  } else {
    const rx = 292, ry = 130, cy = G.cy + 26;
    el("ellipse", { cx: G.cx, cy, rx, ry, ...orbitAttrs }, svg);
    dotPath = `M ${G.cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${G.cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${G.cx - rx} ${cy}`;
  }
  const g = el("g", {}, svg);
  const rects = PLATE.map((_, p) => el("rect", arc
    ? { x: -3.5, y: -13, width: 7, height: 26, rx: 3.5, fill: COL.base, "data-seg": plateSeg[p] }
    : { x: -6, y: -30, width: 12, height: 60, rx: 6, fill: COL.base, "data-seg": plateSeg[p] }, g));
  const fills = new Array(PLATE.length).fill(COL.base);
  const shown = new Array(PLATE.length).fill(true);

  if (reduce.matches) {
    const a = arc ? 0.38 : 0.62;
    const pos = arc
      ? [G.cx + 262 * Math.sin(a), G.cy - 262 * Math.cos(a)]
      : [G.cx + 292 * Math.sin(a), G.cy + 26 + 130 * Math.cos(a)];
    el("circle", { cx: pos[0].toFixed(1), cy: pos[1].toFixed(1), r: arc ? 5 : 6.5, fill: "#e3ff7c" }, svg);
  } else {
    const dot = el("circle", { r: arc ? 5 : 6.5, fill: "#e3ff7c" }, svg);
    const am = el("animateMotion", { dur: arc ? "8s" : "18s", repeatCount: "indefinite", path: dotPath }, dot);
    am.beginElement?.();
  }

  const render = () => {
    for (let p = 0; p < PLATE.length; p++) {
      const phi = wrapPi(slotA(PLATE[p]) + ctl.angle);
      const r = rects[p], l = ctl.lift[p];
      if (arc) {
        const vis = Math.abs(phi) < 1.3;
        if (vis !== shown[p]) { r.style.display = vis ? "" : "none"; shown[p] = vis; }
        if (!vis) continue;
        const rr = G.r + l * 13;
        r.setAttribute("transform", `translate(${(G.cx + rr * Math.sin(phi)).toFixed(1)} ${(G.cy - rr * Math.cos(phi)).toFixed(1)}) rotate(${(phi * 57.2958).toFixed(2)})`);
      } else {
        const d = (Math.cos(phi) + 1) / 2, s = 0.62 + 0.38 * d;
        const x = G.cx + (G.rx + l * 10) * Math.sin(phi);
        const y = G.cy + G.ry * Math.cos(phi) - l * 18 * s;
        r.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s.toFixed(3)})`);
        r.setAttribute("opacity", (0.28 + 0.72 * d).toFixed(2));
      }
      const seg = plateSeg[p];
      const fill = seg === ctl.sel && l > 0.5 ? COL.sel : seg === ctl.hover ? COL.hover : COL.base;
      if (fill !== fills[p]) { r.setAttribute("fill", fill); fills[p] = fill; }
    }
  };
  const radPerPx = () => {
    const sc = Math.min(svg.clientWidth / G.w, svg.clientHeight / G.h) || 1;
    return 1 / ((arc ? G.r : G.rx) * sc);
  };
  const pick = (e) => {
    const t = e.target.closest?.("rect[data-seg]");
    return t ? +t.dataset.seg : -1;
  };
  return { kind, render, radPerPx, pick };
}

/* ───── 3D: кольцо-картотека на InstancedMesh ───── */
function build3d({ scene, camera, THREE }) {
  const R = 3.6;
  const group = new THREE.Group();
  scene.add(group);

  const w = 0.13, h = 0.54, rad = 0.055;
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2 + rad, -h / 2);
  shape.lineTo(w / 2 - rad, -h / 2);
  shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + rad);
  shape.lineTo(w / 2, h / 2 - rad);
  shape.quadraticCurveTo(w / 2, h / 2, w / 2 - rad, h / 2);
  shape.lineTo(-w / 2 + rad, h / 2);
  shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - rad);
  shape.lineTo(-w / 2, -h / 2 + rad);
  shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + rad, -h / 2);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.03, bevelEnabled: false, curveSegments: 3 });
  geo.translate(0, 0, -0.015);

  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0xffffff }), PLATE.length);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  // в 3D под светом базовый цвет темнеет — берём светлее, чем в плоском SVG
  const cBase = new THREE.Color("#6e6a74"), cSel = new THREE.Color(COL.sel), cHov = new THREE.Color("#9186bd");
  const cur = PLATE.map(() => cBase.clone());
  cur.forEach((c, p) => mesh.setColorAt(p, c));
  group.add(mesh);

  scene.add(new THREE.HemisphereLight(0xfff4ea, 0x2a2733, 0.8));
  const sun = new THREE.DirectionalLight(0xfff0de, 0.9);
  sun.position.set(2.5, 6, 8);
  scene.add(sun);

  const ro = R + 0.62;
  const pts = [];
  for (let i = 0; i <= 180; i++) { const a = (i / 180) * TAU; pts.push(new THREE.Vector3(Math.sin(a) * ro, -0.42, Math.cos(a) * ro)); }
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(pts),
    new THREE.LineDashedMaterial({ color: 0x8e8b85, dashSize: 0.06, gapSize: 0.12, transparent: true, opacity: 0.75 })
  );
  line.computeLineDistances();
  group.add(line);
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.08, 18, 12), new THREE.MeshBasicMaterial({ color: 0xe3ff7c }));
  group.add(dot);

  const dummy = new THREE.Object3D();
  dummy.rotation.order = "YXZ";
  const dir = new THREE.Vector3(0, 0.62, 1).normalize();
  const center = new THREE.Vector3();
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  function place(dt) {
    const kc = reduce.matches || !dt ? 1 : 1 - Math.exp(-10 * dt);
    for (let p = 0; p < PLATE.length; p++) {
      const phi = slotA(PLATE[p]) + ctl.angle, l = ctl.lift[p], r = R + l * 0.42;
      dummy.position.set(Math.sin(phi) * r, l * 0.2, Math.cos(phi) * r);
      dummy.rotation.set(l * 0.16, phi, 0);
      dummy.updateMatrix();
      mesh.setMatrixAt(p, dummy.matrix);
      const seg = plateSeg[p];
      const tg = seg === ctl.sel && l > 0.35 ? cSel : seg === ctl.hover ? cHov : cBase;
      if (kc === 1) cur[p].copy(tg); else cur[p].lerp(tg, kc);
      mesh.setColorAt(p, cur[p]);
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
  }

  function fit(s) {
    const aspect = s.width / Math.max(1, s.height);
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const half = R + 1.0;
    const hv = (R + 0.62) * dir.y + 0.7; // вертикальный полуразмах кольца с орбитой при наклоне камеры
    const dist = Math.max((half / (t * aspect)) * 1.12, (hv / t) * 1.35, 11);
    camera.position.copy(dir).multiplyScalar(dist);
    camera.lookAt(0, -0.2, 0);
    camera.updateMatrixWorld();
    center.set(0, 0.02, 0).project(camera);
    orbit.core.style.left = `${((center.x + 1) / 2) * s.width}px`;
    orbit.core.style.top = `${((1 - center.y) / 2) * s.height}px`;
  }

  function pick(e) {
    const r = orbit.stage.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    group.updateMatrixWorld();
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObject(mesh, false)[0];
    return hit && hit.instanceId != null ? plateSeg[hit.instanceId] : -1;
  }

  place(0);
  const frame = (s) => {
    if (orbit.viz.dataset.mode !== "gl") return; // на узком экране цикл сцены может проснуться от IO — физику шагает SVG
    step(s.dt);
    place(s.dt);
    const a = 0.62 + s.t * 0.35;
    dot.position.set(Math.sin(a) * ro, -0.42, Math.cos(a) * ro);
    group.rotation.x = (s.scroll - 0.5) * 0.14;
    group.rotation.z = -s.pointer.x * 0.03;
  };
  return { frame, fit, pick };
}

function hasGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch (e) { return false; }
}

function initOrbit() {
  if (!orbit.viz || !orbit.svg) return;
  let svgR = null, gl = null, glLoading = false, glFailed = false, near = false;
  let raf = 0, last = 0;

  const svgLoop = (now) => {
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
    last = now;
    if (orbit.viz.dataset.mode === "gl") { raf = 0; last = 0; return; } // физику уже шагает цикл 3D
    const busy = step(dt);
    svgR?.render();
    if (busy && svgR) raf = requestAnimationFrame(svgLoop);
    else { raf = 0; last = 0; }
  };
  const svgKick = () => {
    if (!svgR) return;
    if (reduce.matches) { step(0); svgR.render(); return; }
    if (!raf) { last = 0; raf = requestAnimationFrame(svgLoop); }
  };
  kick = () => {
    if (gl && orbit.viz.dataset.mode === "gl") { if (reduce.matches) gl.handle.redraw(); }
    else svgKick();
  };

  const useSvg = (kind) => {
    orbit.viz.dataset.mode = kind;
    orbit.core.style.left = "";
    orbit.core.style.top = "";
    if (gl) {
      gl.handle.stop();
      orbit.stage.classList.remove("is-live");
      orbit.stage.removeAttribute("data-stage");
    }
    if (!svgR || svgR.kind !== kind) svgR = makeSvg(kind);
    step(0);
    svgR.render();
  };

  const useGl = async () => {
    if (gl) {
      orbit.stage.setAttribute("data-stage", "");
      orbit.stage.classList.add("is-live");
      orbit.viz.dataset.mode = "gl";
      gl.hooks.fit(gl.handle.state);
      gl.handle.redraw();
      gl.handle.start();
      return;
    }
    if (glLoading || glFailed) return;
    glLoading = true;
    let mod;
    try { mod = await import("../../../system/three-stage.js"); }
    catch (e) { glLoading = false; glFailed = true; return; }
    glLoading = false;
    if (!wide.matches) return;
    orbit.stage.setAttribute("data-stage", "");
    let hooks = null;
    let handle = null;
    try {
      handle = mod.mountStage(orbit.stage, (ctx) => { hooks = build3d(ctx); return hooks.frame; }, {
        camera: "perspective", fov: 30, maxDpr: 1.5, alpha: true,
        onResize: (s) => hooks && hooks.fit(s),
      });
    } catch (e) { handle = null; }
    if (!handle) {
      orbit.stage.removeAttribute("data-stage");
      orbit.stage.classList.remove("is-nogl", "is-live");
      glFailed = true;
      return;
    }
    gl = { handle, hooks };
    orbit.viz.dataset.mode = "gl";
    hooks.fit(handle.state);
    handle.redraw();
  };

  const decide = () => {
    if (wide.matches && near && !glFailed && hasGLCached()) { useGl(); if (!gl) useSvg("ellipse"); }
    else useSvg(wide.matches ? "ellipse" : "arc");
  };
  let glCache = null;
  const hasGLCached = () => (glCache ??= hasGL());

  // стартовое положение: без reduced-motion кольцо ждёт в развороте и доезжает при появлении
  const direct = states.has("direction-selected");
  if (direct) select(4, { instant: true });
  else if (!reduce.matches) {
    ctl.angle = ctl.target + 1.7;
    ctl.lift.fill(0);
    ctl.selT = 1e9;
  }
  renderPanel();
  useSvg(wide.matches ? "ellipse" : "arc");

  new IntersectionObserver((entries, io) => {
    if (!entries[0].isIntersecting) return;
    io.disconnect();
    near = true;
    decide();
  }, { rootMargin: "600px 0px" }).observe(orbit.viz);

  if (!direct && !reduce.matches) {
    new IntersectionObserver((entries, io) => {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      ctl.selT = ctl.t + 0.25;
      ctl.mode = "spring";
      kick();
    }, { threshold: 0.35 }).observe(orbit.viz);
  }
  wide.addEventListener?.("change", decide);

  /* чипы направлений */
  orbit.chips.forEach((b, i) => {
    b.addEventListener("click", () => select(+b.dataset.dir, { user: true }));
    b.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      e.preventDefault();
      const n = orbit.chips[(i + (e.key === "ArrowRight" ? 1 : orbit.chips.length - 1)) % orbit.chips.length];
      n.focus();
      select(+n.dataset.dir, { user: true });
    });
  });
  orbit.levels.forEach((b) => b.addEventListener("click", () => setLevel(b.dataset.lv)));
  $$(".f-levels [data-level]").forEach((a) => a.addEventListener("click", () => setLevel(a.dataset.level)));

  /* перетаскивание, наведение, клик по плашке */
  const viz = orbit.viz;
  const pickAt = (e) => (viz.dataset.mode === "gl" && gl ? gl.hooks.pick(e) : svgR ? svgR.pick(e) : -1);
  const radPerPx = () => (viz.dataset.mode === "gl" ? (Math.PI * 1.1) / Math.max(1, viz.clientWidth) : svgR.radPerPx());
  let drag = null, hoverRaf = 0, lastMove = null;
  const setHover = (seg) => {
    if (seg === ctl.hover) return;
    ctl.hover = seg;
    viz.classList.toggle("is-hover", seg >= 0);
    kick();
  };
  viz.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    drag = { id: e.pointerId, x: e.clientX, lastX: e.clientX, lastT: performance.now(), captured: false };
  });
  viz.addEventListener("pointermove", (e) => {
    if (!drag && e.pointerType === "mouse" && fine.matches) {
      lastMove = e;
      if (!hoverRaf) hoverRaf = requestAnimationFrame(() => { hoverRaf = 0; if (!drag && lastMove) setHover(pickAt(lastMove)); });
    }
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.captured) {
      if (Math.abs(e.clientX - drag.x) < 5) return;
      drag.captured = true;
      try { viz.setPointerCapture(e.pointerId); } catch (err) { /* указатель уже отпущен */ }
      ctl.mode = "drag";
      ctl.vel = 0;
      viz.classList.add("is-dragging");
      setHover(-1);
    }
    const now = performance.now();
    const dA = (e.clientX - drag.lastX) * radPerPx();
    const dts = Math.max(8, now - drag.lastT) / 1000;
    ctl.angle += dA;
    ctl.vel = ctl.vel * 0.5 + (dA / dts) * 0.5;
    drag.lastX = e.clientX;
    drag.lastT = now;
    kick();
  });
  const end = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    viz.classList.remove("is-dragging");
    if (d.captured) {
      if (performance.now() - d.lastT > 90) ctl.vel = 0;
      ctl.vel = clamp(ctl.vel, -8, 8);
      if (reduce.matches) select(frontSeg(ctl.angle), { instant: true, user: true });
      else { ctl.mode = "inertia"; kick(); }
    } else if (e.type === "pointerup") {
      const seg = pickAt(e);
      if (seg >= 0) select(seg, { user: true });
    }
  };
  viz.addEventListener("pointerup", end);
  viz.addEventListener("pointercancel", end);
  viz.addEventListener("pointerleave", () => { if (!drag) setHover(-1); });
}

/* ═════ 4. Наука: в аккордеоне всегда открыт один пункт — портрет не пропадает ═════ */
function initSci() {
  $$("[data-sci] > details > summary").forEach((s) => {
    s.addEventListener("click", (e) => { if (s.parentElement.open) e.preventDefault(); });
  });
}

/* ═════ 5. Ленты: мышью тянутся с инерцией (пальцем — нативный скролл) ═════ */
function initDrag() {
  if (!fine.matches) return;
  $$("[data-drag]").forEach((track) => {
    let down = null, moved = false, raf = 0, vel = 0;
    track.querySelectorAll("img").forEach((i) => { i.draggable = false; });
    track.addEventListener("pointerdown", (e) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      cancelAnimationFrame(raf);
      track.classList.remove("is-dragging");
      down = { x: e.clientX, sl: track.scrollLeft, lastX: e.clientX, lastT: performance.now() };
      moved = false;
      vel = 0;
    });
    track.addEventListener("pointermove", (e) => {
      if (!down) return;
      const dx = e.clientX - down.x;
      if (!moved) {
        if (Math.abs(dx) < 6) return;
        moved = true;
        try { track.setPointerCapture(e.pointerId); } catch (err) { /* уже отпущен */ }
        track.classList.add("is-dragging");
      }
      const now = performance.now();
      vel = 0.7 * ((down.lastX - e.clientX) / Math.max(8, now - down.lastT)) + 0.3 * vel;
      down.lastX = e.clientX;
      down.lastT = now;
      track.scrollLeft = down.sl - dx;
    });
    const up = () => {
      if (!down) return;
      const lastT = down.lastT;
      down = null;
      if (!moved) return;
      if (performance.now() - lastT > 90) vel = 0;
      let v = vel * 16;
      const glide = () => {
        if (Math.abs(v) < 0.6 || reduce.matches) { track.classList.remove("is-dragging"); return; }
        track.scrollLeft += v;
        v *= 0.92;
        raf = requestAnimationFrame(glide);
      };
      glide();
    };
    track.addEventListener("pointerup", up);
    track.addEventListener("pointercancel", up);
    track.addEventListener("click", (e) => {
      if (moved) { e.preventDefault(); e.stopPropagation(); moved = false; }
    }, true);
  });
}

/* Ленты стартуют с начала: при перестройке сетки (шрифты, картинки) снап мог уводить их вбок */
function initTrackStart() {
  const tracks = $$(".ribbon__track, .f-events__list");
  const touched = new WeakSet();
  tracks.forEach((t) => {
    const mark = () => touched.add(t);
    ["pointerdown", "wheel", "keydown", "touchstart"].forEach((ev) => t.addEventListener(ev, mark, { passive: true, once: true }));
    t.closest("[data-ribbon]")?.querySelectorAll("[data-ribbon-prev], [data-ribbon-next]").forEach((b) => b.addEventListener("click", mark, { once: true }));
  });
  const reset = () => tracks.forEach((t) => { if (!touched.has(t) && t.scrollLeft) t.scrollTo({ left: 0, behavior: "instant" }); });
  if (document.readyState === "complete") reset(); else addEventListener("load", reset, { once: true });
  document.fonts?.ready.then(reset);
}

/* ═════ 6. Липкая «Поступить»: когда кнопка первого экрана ушла и до лида ═════ */
function initDock() {
  const dock = $("[data-dock]"), cta = $("[data-notch-btn]"), lead = $("#lead");
  if (!dock || !cta || !lead) return;
  // док появляется, только когда кнопку первого экрана уже проскроллили (а не пока до неё не дошли)
  let heroPassed = false, leadNear = false;
  const upd = () => {
    const on = heroPassed && !leadNear;
    dock.classList.toggle("is-on", on);
    dock.inert = !on;
  };
  new IntersectionObserver(([e]) => { heroPassed = !e.isIntersecting && e.boundingClientRect.top < 0; upd(); }).observe(cta);
  new IntersectionObserver(([e]) => { leadNear = e.isIntersecting || e.boundingClientRect.top < 0; upd(); }).observe(lead);
}

/* ═════ 7. Лид-форма ═════ */
function initLead() {
  const form = $("[data-lead]");
  if (!form) return;
  const q = form.elements.q, c = form.elements.c;
  const err = $("#lead-err"), ok = $("[data-lead-ok]");
  const valid = (v) => /^@?[A-Za-z0-9_]{5,32}$/.test(v.trim()) || v.replace(/\D/g, "").length === 11;
  c.addEventListener("input", () => {
    if (c.getAttribute("aria-invalid") === "true" && valid(c.value)) { c.removeAttribute("aria-invalid"); err.hidden = true; }
  });
  q.addEventListener("input", () => { if (q.value.trim()) q.removeAttribute("aria-invalid"); });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    ok.textContent = "";
    const qBad = !q.value.trim();
    const cBad = !valid(c.value);
    if (qBad) q.setAttribute("aria-invalid", "true"); else q.removeAttribute("aria-invalid");
    if (cBad) c.setAttribute("aria-invalid", "true"); else c.removeAttribute("aria-invalid");
    err.hidden = !cBad;
    if (qBad) { q.focus(); return; }
    if (cBad) { c.focus(); return; }
    ok.textContent = "Спасибо! Вопрос уже у приёмной комиссии, ответим в течение [N часов].";
    form.reset();
  });
}

initNotch();
initVideos();
initOrbit();
initSci();
initDrag();
initTrackStart();
initDock();
initLead();
