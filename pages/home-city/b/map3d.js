/* home-city/b — объёмный план центра Твери (three.js через system/three-stage.js).
   Геометрия берётся из SVG-схемы (SVGLoader): берега Волги, Тьмаки и Тверцы — плоские ленты с синими
   кромками, улицы — тонкие линии, мост — две тёмные нити. Корпуса ТвГУ вырастают объёмами
   (светлые грани, синие рёбра), вокруг — город из низких белых кварталов, поднимается кольцами от главного корпуса.
   Интро: вид сверху наклоняется в перспективу, линии прорисовываются, корпуса растут лесенкой.
   Выбор корпуса (кнопки, наведение на объём, клик) — камера плавно подлетает, объём заливается синим,
   всплывающая карточка из script.js едет за проекцией. Подписи — HTML-слой .map-tags поверх холста.
   Только ≥768; ниже — плоская SVG-карта с прорисовкой. Reduced-motion — один кадр в конечной позе.
   Тёмная версия (15.09): цвета сцены не зашиты — читаются из переменных --map-* на .hero (style.css, роли темы).
   Туман и проявление воды — из цвета земли, поэтому до и во время интро нет белых вспышек. */

const frame = document.querySelector("[data-map-frame]");
const svgEl = frame && frame.querySelector("[data-map]");
const tagsBox = frame && frame.querySelector("[data-map-tags]");
const wide = matchMedia("(min-width: 768px)");
const desk = matchMedia("(min-width: 1280px)");
const reduce = matchMedia("(prefers-reduced-motion: reduce)");
const fine = matchMedia("(hover: hover) and (pointer: fine)");
const CM = (window.CITY_MAP = window.CITY_MAP || {});
let handle = null, loading = false;
const a11y = frame ? { role: frame.getAttribute("role"), label: frame.getAttribute("aria-label"), tab: frame.getAttribute("tabindex") } : null;

function flat() {
  frame.removeAttribute("data-stage");
  frame.classList.remove("is-live");
  if (a11y) {
    frame.setAttribute("role", a11y.role);
    frame.setAttribute("aria-label", a11y.label);
    if (a11y.tab !== null) frame.setAttribute("tabindex", a11y.tab);
  }
  CM.live = false;
  document.dispatchEvent(new CustomEvent("city:flat"));
}
function live() {
  frame.setAttribute("data-stage", "");
  frame.setAttribute("role", "img");
  frame.setAttribute("aria-label", "Объёмная схема центра Твери: Волга, Тьмака и Тверца, главные улицы и корпуса ТвГУ. Главный корпус — на улице Желябова, 33.");
  frame.removeAttribute("tabindex");
  CM.live = true;
}
function hasGL() {
  try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); }
  catch (e) { return false; }
}

async function boot() {
  if (!frame || !svgEl || !tagsBox || handle || loading || !wide.matches) return;
  if (!hasGL()) { frame.classList.add("is-nogl"); flat(); return; }
  loading = true;
  let mods;
  try {
    mods = await Promise.all([import("../../../system/three-stage.js"), import("three/addons/loaders/SVGLoader.js")]);
  } catch (e) { loading = false; flat(); return; }
  const [{ mountStage }, { SVGLoader }] = mods;
  let hooks = null;
  live();
  try {
    handle = mountStage(frame, (ctx) => { hooks = build(ctx, SVGLoader); return hooks.frame; }, {
      camera: "perspective", fov: 30, maxDpr: 1.5, alpha: true,
      onResize: (s) => hooks && hooks.resize(s),
    });
  } catch (e) { handle = null; }
  loading = false;
  if (!handle) { flat(); return; }
  hooks.measure();
  document.addEventListener("city:select", () => { if (reduce.matches || !handle.state.t) handle.redraw(); });
  document.fonts && document.fonts.ready.then(() => { hooks.measure(); if (reduce.matches) handle.redraw(); });
}

if (frame) {
  boot();
  wide.addEventListener && wide.addEventListener("change", () => {
    if (!handle) { boot(); return; }
    if (wide.matches) { live(); frame.classList.add("is-live"); handle.start(); }
    else { handle.stop(); flat(); }
  });
}

function build({ scene, camera, THREE, state }, SVGLoader) {
  // палитра из CSS: getComputedStyle отдаёт уже подставленные роли темы (#rrggbb); запасные значения — тёмная тема
  const css = getComputedStyle(frame.closest("[data-hero]") || document.documentElement);
  const tone = (name, fallback) => {
    const v = css.getPropertyValue(name).trim();
    const c = new THREE.Color(fallback);
    if (/^(#[0-9a-f]{3,8}|rgba?\(|hsla?\()/i.test(v)) c.setStyle(v);
    return c;
  };
  const COL = {
    ground: tone("--map-ground", "#0a0f2c"), water: tone("--map-water", "#060a1f"), bank: tone("--map-bank", "#a9b6ff"),
    minor: tone("--map-minor", "#2a3466"), street: tone("--map-street", "#46518a"), bridge: tone("--map-bridge", "#b4bcd8"),
    block: tone("--map-block", "#0f1638"), blockEdge: tone("--map-block-edge", "#2a3466"),
    bld: tone("--map-bld", "#1c2766"), bldEdge: tone("--map-bld-edge", "#a9b6ff"),
    sel: tone("--map-sel", "#4a5eeb"), selEdge: tone("--map-sel-edge", "#f4f6fc"), main: tone("--map-main", "#ff6f93"),
  };
  scene.fog = new THREE.Fog(COL.ground, 16, 42);
  const V2 = THREE.Vector2, V3 = THREE.Vector3;
  const K = 100; // единиц SVG на единицу сцены
  const wx = (x) => (x - 720) / K, wz = (y) => (y - 410) / K;
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const easeInOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
  const easeOutExpo = (p) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p));
  const seg = (t, a, b) => clamp01((t - a) / (b - a));

  /* ───── Пути из SVG ───── */
  const loader = new SVGLoader();
  const pathPts = (d, div = 20) => {
    const data = loader.parse(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${d}"/></svg>`);
    return data.paths[0].subPaths[0].getPoints(div).map((p) => new V2(p.x, p.y));
  };
  const onEdge = (p) => p.x < 3 || p.x > 1437 || p.y < 3 || p.y > 817;
  const extend = (p, far = 900) => {
    const out = p.slice();
    if (onEdge(p[0])) out.unshift(p[0].clone().addScaledVector(new V2().subVectors(p[0], p[1]).normalize(), far));
    const n = p.length - 1;
    if (onEdge(p[n])) out.push(p[n].clone().addScaledVector(new V2().subVectors(p[n], p[n - 1]).normalize(), far));
    return out;
  };
  const resample = (p, step) => {
    const out = [p[0]];
    for (let i = 1; i < p.length; i++) {
      const a = p[i - 1], b = p[i];
      const k = Math.max(1, Math.ceil(a.distanceTo(b) / step));
      for (let j = 1; j <= k; j++) out.push(new V2().lerpVectors(a, b, j / k));
    }
    return out;
  };
  const q = (sel) => [...svgEl.querySelectorAll(sel)].map((el) => el.getAttribute("d"));

  const minor = q(".map-minor path").map((d) => extend(pathPts(d)));
  const streets = q(".map-street path").map((d) => extend(pathPts(d)));
  const banks = q(".map-bank:not(.map-bank--small) path").map((d) => extend(pathPts(d, 28)));
  const small = q(".map-bank--small path").map((d) => extend(pathPts(d, 24)));
  const walk = extend(pathPts(svgEl.querySelector(".map-walk").getAttribute("d")));
  const park = pathPts(svgEl.querySelector(".map-park").getAttribute("d"));
  const bridge = q(".map-bridge path").map((d) => pathPts(d));
  const mouths = [...svgEl.querySelectorAll(".map-mouth")].map((r) => ({
    x: +r.getAttribute("x") - 4, y: +r.getAttribute("y") - 8, w: +r.getAttribute("width") + 8, h: +r.getAttribute("height") + 16,
  }));
  const inMouth = (p) => mouths.some((m) => p.x > m.x && p.x < m.x + m.w && p.y > m.y && p.y < m.y + m.h);

  /* Линии: отрезки упорядочены по доле пути — все линии набора растут одновременно (как pathLength=1) */
  function lineSet(polys, color, { y = 0.004, opacity = 1, skip = null, step = 24 } = {}) {
    const segs = [];
    polys.forEach((p) => {
      const dense = resample(p, step);
      const n = dense.length - 1;
      for (let i = 0; i < n; i++) {
        const a = dense[i], b = dense[i + 1];
        if (skip && skip(new V2().lerpVectors(a, b, 0.5))) continue;
        segs.push([i / n, a, b]);
      }
    });
    segs.sort((s1, s2) => s1[0] - s2[0]);
    const pos = new Float32Array(segs.length * 6);
    segs.forEach(([, a, b], i) => pos.set([wx(a.x), y, wz(a.y), wx(b.x), y, wz(b.y)], i * 6));
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const m = new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity });
    const l = new THREE.LineSegments(g, m);
    l.userData.count = segs.length * 2;
    l.renderOrder = 2;
    return l;
  }
  function dashed(poly, color, dash) {
    const pts = resample(poly, 12).map((p) => new V3(wx(p.x), 0.004, wz(p.y)));
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    const l = new THREE.Line(g, new THREE.LineDashedMaterial({ color, dashSize: dash, gapSize: dash, transparent: true, opacity: 1 }));
    l.computeLineDistances();
    l.renderOrder = 2;
    return l;
  }
  /* Лента воды между двумя берегами (одинаковое число точек) */
  function ribbon(top, bot, mat) {
    const n = Math.min(top.length, bot.length);
    const pos = new Float32Array(n * 6), idx = [];
    for (let i = 0; i < n; i++) {
      pos.set([wx(top[i].x), 0, wz(top[i].y), wx(bot[i].x), 0, wz(bot[i].y)], i * 6);
      if (i < n - 1) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setIndex(idx);
    const m = new THREE.Mesh(g, mat);
    m.renderOrder = 1;
    return m;
  }

  const world = new THREE.Group();
  scene.add(world);

  const waterMat = new THREE.MeshBasicMaterial({ color: COL.ground.clone(), side: THREE.DoubleSide, depthWrite: false });
  world.add(ribbon(banks[0], banks[1], waterMat));
  world.add(ribbon(small[0], small[1], waterMat));
  world.add(ribbon(small[2], small[3], waterMat));

  const L = {
    minor: lineSet(minor, COL.minor, { opacity: 0.8 }),
    streets: lineSet(streets, COL.street),
    banks: lineSet(banks, COL.bank, { opacity: 0.6, skip: inMouth, step: 16 }),
    small: lineSet(small, COL.bank, { opacity: 0.6, skip: inMouth, step: 16 }),
    bridge: lineSet(bridge, COL.bridge, { y: 0.03, step: 8 }),
  };
  Object.values(L).forEach((l) => world.add(l));
  const walkLine = dashed(walk, COL.street, 0.05);
  const parkLine = dashed([...park, park[0]], COL.street, 0.025);
  world.add(walkLine, parkLine);

  /* ───── Корпуса ТвГУ ───── */
  const dots = {};
  svgEl.querySelectorAll("[data-dot]").forEach((g) => {
    const m = /translate\(([\d.]+)[ ,]+([\d.]+)\)/.exec(g.parentNode.getAttribute("transform") || "");
    if (m) dots[g.dataset.dot] = new V2(+m[1], +m[2]);
  });
  // контуры в единицах SVG относительно точки (x вправо, y вниз), высота — в единицах сцены
  const PLANS = {
    main: { h: 0.62, shapes: [[[-88, 42], [88, 42], [88, -42], [52, -42], [52, 0], [-52, 0], [-52, -42], [-88, -42]]] },
    k2: { h: 0.44, shapes: [[[-48, 30], [48, 30], [48, -32], [6, -32], [6, 0], [-48, 0]]] },
    k3: { h: 0.36, shapes: [[[-54, 24], [54, 24], [54, -24], [-54, -24]]] },
    k4: { h: 0.5, shapes: [[[-30, 46], [30, 46], [30, -46], [-30, -46]]] },
    k5: { h: 0.32, shapes: [[[-58, 22], [58, 22], [58, -22], [-58, -22]]] },
    dorm: { h: 0.8, shapes: [[[-44, 54], [-12, 54], [-12, -54], [-44, -54]], [[12, 54], [44, 54], [44, -54], [12, -54]]] },
  };
  const ORDER = ["main", "k2", "k3", "k4", "k5", "dorm"];
  const blds = {};
  const shade = (geo) => {
    const nrm = geo.getAttribute("normal"), cols = new Float32Array(nrm.count * 3);
    for (let i = 0; i < nrm.count; i++) {
      const nx = nrm.getX(i), ny = nrm.getY(i), nz = nrm.getZ(i);
      const s = ny > 0.5 ? 1 : ny < -0.5 ? 0.6 : 0.7 + 0.08 * nz - 0.1 * nx; // верх — чистый цвет, юг светлее востока
      cols.set([s, s, s], i * 3);
    }
    geo.setAttribute("color", new THREE.BufferAttribute(cols, 3));
  };
  ORDER.forEach((key, i) => {
    const p = dots[key], plan = PLANS[key];
    if (!p) return;
    const group = new THREE.Group();
    group.position.set(wx(p.x), 0, wz(p.y));
    const faceMat = new THREE.MeshBasicMaterial({ color: COL.bld.clone(), vertexColors: true, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    const edgeMat = new THREE.LineBasicMaterial({ color: COL.bldEdge.clone() });
    let rad = 0;
    const box = { minx: 1e9, maxx: -1e9, minz: 1e9, maxz: -1e9 };
    const meshes = [];
    plan.shapes.forEach((pts) => {
      const shape = new THREE.Shape(pts.map(([x, y]) => new V2(x / K, -y / K)));
      pts.forEach(([x, y]) => {
        rad = Math.max(rad, Math.hypot(x, y) / K);
        box.minx = Math.min(box.minx, x / K); box.maxx = Math.max(box.maxx, x / K);
        box.minz = Math.min(box.minz, y / K); box.maxz = Math.max(box.maxz, y / K);
      });
      const geo = new THREE.ExtrudeGeometry(shape, { depth: plan.h, bevelEnabled: false });
      geo.rotateX(-Math.PI / 2);
      shade(geo);
      const mesh = new THREE.Mesh(geo, faceMat);
      mesh.userData.key = key;
      meshes.push(mesh);
      group.add(mesh);
      group.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 20), edgeMat));
    });
    group.scale.y = 0.001;
    world.add(group);
    blds[key] = { key, i, group, meshes, faceMat, edgeMat, h: plan.h, rad, box, p, sel: 0 };
  });

  // главный корпус — тонкое красное кольцо на земле и три мягких расхождения после интро
  const main = blds.main;
  const ringMat = new THREE.MeshBasicMaterial({ color: COL.main, side: THREE.DoubleSide, transparent: true, opacity: 0, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.02, 1.04, 96), ringMat);
  ring.rotation.x = -Math.PI / 2;
  const pulseMat = ringMat.clone();
  const pulse = new THREE.Mesh(ring.geometry, pulseMat);
  pulse.rotation.x = -Math.PI / 2;
  if (main) {
    ring.position.set(main.group.position.x, 0.006, main.group.position.z);
    pulse.position.copy(ring.position);
    world.add(ring, pulse);
  }

  /* ───── Город: низкие тёмные кварталы, растут кольцами от главного корпуса ───── */
  const allLines = [...minor, ...streets, walk].map((p) => resample(p, 40));
  const distSeg = (p, a, b) => {
    const abx = b.x - a.x, aby = b.y - a.y;
    const t = clamp01(((p.x - a.x) * abx + (p.y - a.y) * aby) / (abx * abx + aby * aby || 1));
    return Math.hypot(p.x - a.x - abx * t, p.y - a.y - aby * t);
  };
  const distPoly = (p, poly) => { let d = 1e9; for (let i = 1; i < poly.length; i++) d = Math.min(d, distSeg(p, poly[i - 1], poly[i])); return d; };
  const riverMid = (a, b) => a.map((pt, i) => new V2().lerpVectors(pt, b[Math.min(i, b.length - 1)], 0.5));
  const tmaka = riverMid(small[0], small[1]), tverca = riverMid(small[2], small[3]);
  const bankY = (poly, x) => {
    for (let i = 1; i < poly.length; i++) {
      const a = poly[i - 1], b = poly[i];
      if ((x >= a.x && x <= b.x) || (x <= a.x && x >= b.x)) return a.y + (b.y - a.y) * ((x - a.x) / (b.x - a.x || 1));
    }
    return null;
  };
  const rnd = (i) => { const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };
  const RINGS = 6, ringBoxes = Array.from({ length: RINGS }, () => []);
  const mainP = dots.main || new V2(1020, 483);
  const step = frame.clientWidth < 1100 ? 58 : 50;
  let n = 0;
  for (let gy = -320; gy <= 1180; gy += step) {
    for (let gx = 760; gx <= 1960; gx += step) {
      n++;
      const c = new V2(gx + (rnd(n) - 0.5) * 18, gy + (rnd(n + 7) - 0.5) * 18);
      const w = 14 + rnd(n + 3) * 16, d = 12 + rnd(n + 5) * 14;
      const half = Math.max(w, d) / 2;
      const top = bankY(banks[0], c.x), bot = bankY(banks[1], c.x);
      if (top !== null && c.y > top - 22 - half && c.y < bot + 22 + half) continue;
      if (distPoly(c, tmaka) < 34 + half || distPoly(c, tverca) < 30 + half) continue;
      if (c.x > 700 && c.x < 870 && c.y > 185 && c.y < 290) continue; // Горсад
      if (c.x > 850 && c.x < 910 && c.y < 220) continue; // мост
      if (Object.values(dots).some((dp) => dp.distanceTo(c) < 112)) continue;
      if (allLines.some((poly) => distPoly(c, poly) < 12 + half)) continue;
      if (rnd(n + 11) < 0.18) continue; // пустыри: город не сплошной
      const far = c.distanceTo(mainP);
      const h = (0.05 + rnd(n + 13) * 0.16) * (far < 500 ? 1 : 0.8);
      ringBoxes[Math.min(RINGS - 1, Math.floor(far / 190))].push({ x: wx(c.x), z: wz(c.y), w: w / K, d: d / K, h });
    }
  }
  const unit = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const unitEdges = new THREE.EdgesGeometry(unit);
  const cityFace = new THREE.MeshBasicMaterial({ color: COL.block, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  const cityEdge = new THREE.LineBasicMaterial({ color: COL.blockEdge });
  const mergeInto = (src, boxes) => {
    const sp = src.getAttribute("position"), vc = sp.count;
    const pos = new Float32Array(vc * boxes.length * 3);
    boxes.forEach((b, bi) => {
      for (let i = 0; i < vc; i++) {
        pos[(bi * vc + i) * 3] = sp.getX(i) * b.w + b.x;
        pos[(bi * vc + i) * 3 + 1] = sp.getY(i) * b.h;
        pos[(bi * vc + i) * 3 + 2] = sp.getZ(i) * b.d + b.z;
      }
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    if (src.index) {
      const si = src.index.array, idx = new Uint32Array(si.length * boxes.length);
      boxes.forEach((b, bi) => { for (let i = 0; i < si.length; i++) idx[bi * si.length + i] = si[i] + bi * vc; });
      g.setIndex(new THREE.BufferAttribute(idx, 1));
    }
    return g;
  };
  const city = ringBoxes.map((boxes) => {
    const g = new THREE.Group();
    if (boxes.length) {
      g.add(new THREE.Mesh(mergeInto(unit, boxes), cityFace));
      g.add(new THREE.LineSegments(mergeInto(unitEdges, boxes), cityEdge));
    }
    g.scale.y = 0.001;
    world.add(g);
    return g;
  });

  /* ───── Подписи (HTML) ───── */
  const txt = (sel) => (svgEl.querySelector(sel)?.textContent || "").trim();
  const labelsSvg = [...svgEl.querySelectorAll(".map-labels text")];
  const TAGS = [];
  const addTag = (text, cls, at, dir, i) => {
    const el = document.createElement("span");
    el.className = "map-tag " + cls;
    el.textContent = text;
    el.style.setProperty("--i", i);
    tagsBox.append(el);
    const shift = cls.includes("bld") ? "translate(-50%, calc(-100% - 14px))"
      : cls.includes("side") ? "translate(8px, -50%)"
      : cls.includes("street") ? "translate(-50%, -115%)" : "translate(-50%, -50%)";
    const t = { el, at, dir, cls, shift, w: 0, h: 0 };
    TAGS.push(t);
    return t;
  };
  const byText = (s) => labelsSvg.find((t) => t.textContent.trim() === s);
  const P = (x, y) => new V2(x, y);
  // улицы: точка на оси и направление вдоль неё
  [
    ["ул. Советская", P(930, 305), P(1, 0.024)],
    ["ул. Желябова", P(1270, 477), P(1, -0.022)],
    ["Тверской проспект", P(1077, 650), P(-0.03, 1)],
    ["Трёхсвятская", P(966, 700), P(-0.03, 1)],
    ["пр-т Чайковского", P(880, 744), P(1, -0.09)],
  ].forEach(([s, at, dir], i) => byText(s) && addTag(s, "map-tag--street", at, dir, 6 + i));
  [
    ["Волга", P(1130, 148), P(1, 0.02)],
    ["Волга", P(420, 76), P(1, 0.05)],
    ["Тверца", P(1300, 50), P(0.6, -0.8)],
    ["Тьмака", P(676, 470), P(0.12, 1)],
  ].forEach(([s, at, dir], i) => addTag(s, "map-tag--water", at, dir, 2 + i));
  addTag(txt(".map-label--area") || "Заволжье", "map-tag--area", P(1000, 40), null, 1);
  addTag("Староволжский мост", "map-tag--side", P(896, 120), null, 5);
  addTag(txt(".map-label--park") || "Горсад", "map-tag--park", P(788, 236), null, 4);
  const bldTags = {};
  ORDER.forEach((key, i) => {
    const b = blds[key];
    if (!b) return;
    const btn = document.querySelector(`[data-bld="${key}"] .bld__name`);
    const t = addTag(btn ? btn.textContent.trim() : key, "map-tag--bld" + (key === "main" ? " map-tag--main" : ""), b.p, null, 10 + i);
    t.bld = b;
    bldTags[key] = t;
  });

  /* ───── Камера ───── */
  const F = { overview: desk.matches ? P(1105, 470) : P(1030, 450) };
  const cur = { x: 0, z: 0, r: 16, el: 0.92, az: -0.14, off: 0 };
  const goal = { ...cur };
  let W = 1, H = 1, r0 = 16, snapped = false;
  const tan = Math.tan((30 / 2) * Math.PI / 180);
  const hoff = { x: 0, y: 0 }, copy = { right: 0 };
  const heroEl = frame.closest("[data-hero]");
  const copyEl = heroEl && heroEl.querySelector(".hero__copy");
  const factsEl = heroEl && heroEl.querySelector(".hero__facts");

  function measure() {
    TAGS.forEach((t) => { t.w = t.el.offsetWidth; t.h = t.el.offsetHeight; });
    if (heroEl) {
      const fr = frame.getBoundingClientRect(), hr = heroEl.getBoundingClientRect();
      hoff.x = fr.left - hr.left; hoff.y = fr.top - hr.top;
      copy.right = desk.matches && copyEl ? Math.max(copyEl.getBoundingClientRect().right, factsEl ? factsEl.getBoundingClientRect().right : 0) - fr.left + 12 : 0;
    }
    dirty = true;
  }
  function resize(s) {
    W = s.width; H = s.height;
    const aspect = W / H;
    const frac = desk.matches ? 0.6 : 1;
    const needW = desk.matches ? 9.6 : 9.2;
    r0 = Math.max(11.5, Math.min(22, needW / (2 * tan * aspect * frac)));
    F.overview = desk.matches ? P(1105, 470) : P(1030, 450);
    measure();
  }

  function computeGoal() {
    const key = CM.current;
    const on = key && blds[key] && (desk.matches ? CM.open : true);
    if (on) {
      const b = blds[key];
      // подлёт к объёму, но не до упора: запад схемы не должен уезжать под колонку текста.
      // На десктопе 0.8 — восточным корпусам (к4, общежития) нужно место под карточку по обе стороны.
      const pull = desk.matches ? 0.8 : 0.7;
      goal.x = wx(F.overview.x + (b.p.x - F.overview.x) * pull);
      goal.z = wz(F.overview.y + (b.p.y - F.overview.y) * pull);
      goal.r = r0 * (desk.matches ? 0.8 : 0.78);
      goal.el = 0.82; goal.az = b.p.x > F.overview.x ? -0.3 : -0.2;
      goal.off = desk.matches ? 0.17 : 0;
    } else {
      goal.x = wx(F.overview.x); goal.z = wz(F.overview.y);
      goal.r = r0; goal.el = 0.92; goal.az = -0.14;
      goal.off = desk.matches ? 0.17 : 0;
    }
    return on ? key : null;
  }

  const target = new V3(), tmp = new V3(), tmp2 = new V3(), right = new V3();
  function pose(p, pointer) {
    const el = p.el + pointer.y * 0.025, az = p.az + pointer.x * 0.05;
    target.set(p.x, 0, p.z);
    camera.position.set(p.x + p.r * Math.cos(el) * Math.sin(az), p.r * Math.sin(el), p.z + p.r * Math.cos(el) * Math.cos(az));
    camera.lookAt(target);
    camera.setViewOffset(W, H, -p.off * W, 0, W, H);
    camera.updateMatrixWorld();
  }
  const project = (v) => { tmp.copy(v).project(camera); return { x: (tmp.x + 1) / 2 * W, y: (1 - tmp.y) / 2 * H, z: tmp.z }; };

  // якорь карточки для script.js: центр объёма и его полуширина на экране, в координатах hero
  CM.anchor = (key) => {
    const b = blds[key];
    if (!b || !CM.live) return null;
    const c = new V3(b.group.position.x, b.h * 0.5, b.group.position.z);
    const s = project(c);
    right.setFromMatrixColumn(camera.matrixWorld, 0).multiplyScalar(b.rad);
    const e = project(tmp2.copy(c).add(right));
    return { x: hoff.x + s.x, y: hoff.y + s.y, rx: Math.abs(e.x - s.x) };
  };

  // что карточке нельзя закрывать: экранные прямоугольники объёмов и чипов-подписей (координаты hero).
  // self — выбранный корпус, others — остальные корпуса и их чипы.
  const corner = new V3();
  const rectOf = (b) => {
    const { minx, maxx, minz, maxz } = b.box, gx = b.group.position.x, gz = b.group.position.z, hy = b.h * b.group.scale.y;
    let l = 1e9, t = 1e9, r = -1e9, d = -1e9;
    for (const x of [minx, maxx]) for (const y of [0, hy]) for (const z of [minz, maxz]) {
      const s = project(corner.set(gx + x, y, gz + z));
      l = Math.min(l, s.x); r = Math.max(r, s.x); t = Math.min(t, s.y); d = Math.max(d, s.y);
    }
    return { x: hoff.x + l, y: hoff.y + t, w: r - l, h: d - t };
  };
  CM.obstacles = (key) => {
    if (!CM.live) return null;
    const out = { self: null, others: [] };
    Object.values(blds).forEach((b) => {
      if (!b.group.visible) return;
      if (b.key === key) { out.self = rectOf(b); return; }
      out.others.push(rectOf(b));
      const t = bldTags[b.key];
      if (t && t.w) {
        const s = project(corner.set(b.group.position.x, b.h * b.group.scale.y, b.group.position.z));
        out.others.push({ x: hoff.x + s.x - t.w / 2, y: hoff.y + s.y - t.h - 14, w: t.w, h: t.h + 14 });
      }
    });
    return out;
  };

  /* ───── Наведение и клик по объёмам ───── */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const pickables = Object.values(blds).flatMap((b) => b.meshes);
  let pointerPx = null, hoverKey = null;
  frame.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse" || !fine.matches) return;
    const r = frame.getBoundingClientRect();
    pointerPx = { x: e.clientX - r.left, y: e.clientY - r.top };
    if (!running()) pick();
  });
  frame.addEventListener("pointerleave", () => { pointerPx = null; if (hoverKey) { hoverKey = null; frame.style.cursor = ""; CM.leave && CM.leave(); } });
  frame.addEventListener("click", (e) => {
    const r = frame.getBoundingClientRect();
    const key = hit(e.clientX - r.left, e.clientY - r.top);
    if (key && CM.select) CM.select(key);
  });
  const running = () => !reduce.matches;
  function hit(x, y) {
    if (x < copy.right) return null; // под колонкой текста — не ловим
    ndc.set((x / W) * 2 - 1, -(y / H) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const h = ray.intersectObjects(pickables, false)[0];
    return h ? h.object.userData.key : null;
  }
  function pick() {
    if (!pointerPx) return;
    const key = hit(pointerPx.x, pointerPx.y);
    pointerPx = null;
    if (key === hoverKey) return;
    hoverKey = key;
    frame.style.cursor = key ? "pointer" : "";
    if (key) CM.hover && CM.hover(key);
    else CM.leave && CM.leave();
  }

  /* ───── Кадр ───── */
  let dirty = true, lastSig = "", tagsIn = false;
  const sets = [
    [L.banks, 0.0, 1.3], [L.small, 0.35, 1.5], [L.minor, 0.55, 1.75], [L.streets, 0.6, 1.8], [L.bridge, 1.2, 1.7],
  ];

  function frameFn(s) {
    const still = reduce.matches;
    const T = still ? 99 : s.t;
    const selKey = computeGoal();
    const k = still || !snapped ? 1 : 1 - Math.exp(-s.dt * 3.2);
    for (const f of ["x", "z", "r", "el", "az", "off"]) cur[f] += (goal[f] - cur[f]) * k;
    snapped = true;

    // интро: план сверху наклоняется в перспективу
    const ip = easeInOut(seg(T, 0.05, 2.1));
    const cam = {
      x: cur.x, z: cur.z - (1 - ip) * 0.6, off: cur.off,
      r: cur.r * (1 + (1 - ip) * 0.22), el: cur.el + (1.5 - cur.el) * (1 - ip), az: cur.az * ip,
    };
    pose(cam, still ? { x: 0, y: 0 } : s.pointer);

    sets.forEach(([l, a, b]) => l.geometry.setDrawRange(0, Math.floor(l.userData.count * easeInOut(seg(T, a, b)) / 2) * 2));
    const wp = seg(T, 0.9, 1.7);
    waterMat.color.copy(COL.ground).lerp(COL.water, wp);
    walkLine.material.opacity = parkLine.material.opacity = seg(T, 1.4, 2.0);
    Object.values(blds).forEach((b) => {
      b.group.scale.y = Math.max(0.001, easeOutExpo(seg(T, 1.25 + b.i * 0.09, 2.45 + b.i * 0.09)));
      b.group.visible = b.group.scale.y > 0.002; // до роста не показываем плоский след
      const want = b.key === selKey ? 1 : 0;
      b.sel += (want - b.sel) * (still ? 1 : 1 - Math.exp(-s.dt * 9));
      b.faceMat.color.copy(COL.bld).lerp(COL.sel, b.sel);
      b.edgeMat.color.copy(COL.bldEdge).lerp(COL.selEdge, b.sel);
    });
    city.forEach((g, i) => { g.scale.y = Math.max(0.001, easeOutExpo(seg(T, 1.7 + i * 0.16, 2.9 + i * 0.16))); g.visible = g.scale.y > 0.002; });
    ringMat.opacity = seg(T, 2.2, 2.6);
    const pp = still ? 1 : ((T - 2.8) % 2.4) / 2.4;
    const pOn = !still && T > 2.8 && T < 2.8 + 2.4 * 3;
    pulse.scale.setScalar(1 + (pOn ? easeOutExpo(pp) : 0) * 0.45);
    pulseMat.opacity = pOn ? 0.5 * (1 - pp) : 0;

    if (!still) pick();

    // карточка и подписи — только если что-то сдвинулось
    const e = camera.matrixWorld.elements;
    const sig = e[12].toFixed(3) + e[13].toFixed(3) + e[14].toFixed(3) + cam.off.toFixed(4) + W + "x" + H + main?.group.scale.y.toFixed(3);
    if (sig === lastSig && !dirty) return;
    lastSig = sig; dirty = false;
    let card = null;
    if (desk.matches && CM.open && CM.place) {
      card = CM.place(); // {x,y,w,h} в координатах hero
      if (card) card = { x: card.x - hoff.x, y: card.y - hoff.y, w: card.w, h: card.h };
    }
    placeTags(selKey, card);
    if (!tagsIn && (still || T > 1.9)) { tagsIn = true; tagsBox.classList.add("is-in"); }
  }

  function placeTags(selKey, card) {
    const pad = 10;
    TAGS.forEach((t) => {
      let v;
      if (t.bld) v = new V3(t.bld.group.position.x, t.bld.h * t.bld.group.scale.y, t.bld.group.position.z);
      else v = new V3(wx(t.at.x), 0, wz(t.at.y));
      const s = project(v);
      let ang = 0;
      if (t.dir) {
        const s2 = project(new V3(wx(t.at.x + t.dir.x * 60), 0, wz(t.at.y + t.dir.y * 60)));
        ang = Math.atan2(s2.y - s.y, s2.x - s.x);
        if (ang > Math.PI / 2) ang -= Math.PI;
        if (ang < -Math.PI / 2) ang += Math.PI;
      }
      // центр текста на экране (для проверок перекрытия)
      let cx = s.x, cy = s.y;
      if (t.bld) cy -= t.h / 2 + 14;
      else if (t.cls.includes("side")) cx += t.w / 2 + 8;
      else if (t.cls.includes("street")) { cx += Math.sin(ang) * t.h * 0.65; cy -= Math.cos(ang) * t.h * 0.65; }
      const hw = Math.abs(Math.cos(ang)) * t.w / 2 + Math.abs(Math.sin(ang)) * t.h / 2;
      const hh = Math.abs(Math.sin(ang)) * t.w / 2 + Math.abs(Math.cos(ang)) * t.h / 2;
      let off = s.z > 1 || cx - hw < 4 || cx + hw > W - 4 || cy - hh < 4 || cy + hh > H - 4; // обрезанную краем не показываем
      if (!off && copy.right && cx - hw < copy.right) off = true; // под колонкой текста
      if (!off && card && cx + hw > card.x - pad && cx - hw < card.x + card.w + pad && cy + hh > card.y - pad && cy - hh < card.y + card.h + pad) off = true;
      if (!off && t.bld && card && t.bld.key === selKey) off = true; // имя уже в карточке
      t.el.classList.toggle("is-off", off);
      t.el.classList.toggle("is-active", !!t.bld && t.bld.key === selKey);
      const rot = ang ? ` rotate(${(ang * 180 / Math.PI).toFixed(2)}deg)` : "";
      t.el.style.transform = `translate3d(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px, 0)${rot} ${t.shift}`;
    });
  }

  return { frame: frameFn, resize, measure };
}
