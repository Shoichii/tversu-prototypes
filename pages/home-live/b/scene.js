/* home-live/b «Игрушечный кампус» — строитель диорамы (общий для hero и «Жизни в кампусе»).
   Мир: островок-«торт» из двух пластилиновых берегов, между ними русло Волги, мост, автобус,
   пять зданий-ответов (Учиться, Жить, Спорт, Наука, Гулять), деревья и фонари — InstancedMesh.
   Статичное — слито в меши с цветами вершин (одна Lambert-материя, мало вызовов отрисовки).
   Карта теней обновляется только когда статичное двигается; подвижное — мягкие «пятна». */
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "./rounded-box.js";

const V2 = THREE.Vector2, V3 = THREE.Vector3;
const TAU = Math.PI * 2, DEG = Math.PI / 180;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOutBack = (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

export const PAL = {
  sky: "#CFE6FF", cloud: "#EAF4FF", coral: "#FF8A6B", mint: "#9FE3C4", butter: "#FFE07A",
  ink: "#1B2350", ink2: "#3A4478", blue: "#2A3DAD", red: "#E10447",
  white: "#F6F9FF", cream: "#FFF1C2", water: "#7CC4F2", field: "#57C08E", sand: "#FFE3A3",
  road: "#C9D3F0", glass: "#BFE3FF", leaf: "#5CC79B",
};

/* ───────── геометрия: подготовка деталей и слияние ───────── */
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new V3(), _p = new V3();

function prep(g, color, t = {}) {
  if (g.index) g = g.toNonIndexed();
  for (const k of Object.keys(g.attributes)) if (k !== "position" && k !== "normal") g.deleteAttribute(k);
  _e.set(t.rx || 0, t.ry || 0, t.rz || 0);
  _q.setFromEuler(_e);
  _s.set(t.sx ?? 1, t.sy ?? 1, t.sz ?? 1);
  _p.set(t.x || 0, t.y || 0, t.z || 0);
  g.applyMatrix4(_m.compose(_p, _q, _s));
  if (color !== null) {
    const c = new THREE.Color(color), n = g.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    g.setAttribute("color", new THREE.BufferAttribute(a, 3));
  }
  return g;
}

class Kit {
  constructor() { this.list = []; }
  add(g, color, t) { this.list.push(prep(g, color, t)); return this; }
  /* скруглённый брусок, t.y — низ */
  block(w, h, d, r, color, t = {}) {
    const rr = Math.min(r, w / 2, h / 2, d / 2) * 0.98;
    const g = rr > 0.004 ? new RoundedBoxGeometry(w, h, d, 2, rr) : new THREE.BoxGeometry(w, h, d);
    return this.add(g, color, { ...t, y: (t.y || 0) + h / 2 });
  }
  /* брусок по центру (для повёрнутых) */
  box(w, h, d, r, color, t = {}) {
    const rr = Math.min(r, w / 2, h / 2, d / 2) * 0.98;
    const g = rr > 0.004 ? new RoundedBoxGeometry(w, h, d, 1, rr) : new THREE.BoxGeometry(w, h, d);
    return this.add(g, color, t);
  }
  cyl(rt, rb, h, seg, color, t = {}) {
    return this.add(new THREE.CylinderGeometry(rt, rb, h, seg), color, { ...t, y: (t.y || 0) + h / 2 });
  }
  sphere(r, color, t = {}, ws = 14, hs = 10) { return this.add(new THREE.SphereGeometry(r, ws, hs), color, t); }
  merge() {
    if (!this.list.length) return new THREE.BufferGeometry();
    const g = mergeGeometries(this.list, false);
    this.list.forEach((x) => x.dispose());
    this.list = [];
    return g;
  }
}

function prism(w, h, d) { // треугольник в XY (основание w, высота h), глубина d по Z; низ в y=0
  const s = new THREE.Shape([new V2(-w / 2, 0), new V2(w / 2, 0), new V2(0, h)]);
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelOffset: -0.03, bevelSegments: 1 });
  g.translate(0, 0, -d / 2);
  return g;
}

function rrPath(w, h, r, path) {
  const x = -w / 2, y = -h / 2;
  path.moveTo(x + r, y);
  path.lineTo(x + w - r, y); path.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
  path.lineTo(x + w, y + h - r); path.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  path.lineTo(x + r, y + h); path.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
  path.lineTo(x, y + r); path.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
  return path;
}
function flat(shape, depth, seg = 10) { // плоская плитка: фигура в XZ, толщина по Y от 0
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: seg });
  g.rotateX(-Math.PI / 2);
  return g;
}

function blobTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, "#fff"); gr.addColorStop(0.45, "rgba(255,255,255,.6)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function rng(seed) { // mulberry32
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/* ───────── план острова ───────── */
const IA = 6.4, IB = 6.0, IN = 3.2;              // суперэллипс
const zr = (x) => 2.3 + 0.45 * Math.sin(0.55 * x + 0.6); // ось русла
const RW = 0.625;                                  // полуширина русла
const inIsland = (x, z, m = 0) => Math.pow(Math.abs(x / (IA - m)), IN) + Math.pow(Math.abs(z / (IB - m)), IN) < 1;

function outline(steps = 150) {
  const pts = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * TAU, c = Math.cos(t), s = Math.sin(t);
    pts.push({ x: IA * Math.sign(c) * Math.pow(Math.abs(c), 2 / IN), z: IB * Math.sign(s) * Math.pow(Math.abs(s), 2 / IN) });
  }
  return pts;
}

function clipBank(pts, f, curve) {
  const items = [], n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n], ip = f(p.x, p.z) <= 0, iq = f(q.x, q.z) <= 0;
    if (ip) items.push({ x: p.x, z: p.z });
    if (ip !== iq) {
      let lo = 0, hi = 1;
      for (let k = 0; k < 30; k++) {
        const mid = (lo + hi) / 2, mx = lerp(p.x, q.x, mid), mz = lerp(p.z, q.z, mid);
        if ((f(mx, mz) <= 0) === ip) lo = mid; else hi = mid;
      }
      const tt = (lo + hi) / 2, x = lerp(p.x, q.x, tt);
      items.push({ x, z: lerp(p.z, q.z, tt), type: ip ? "exit" : "entry" });
    }
  }
  const out = [];
  items.forEach((it, i) => {
    out.push(it);
    if (it.type === "exit") {
      const nx = items[(i + 1) % items.length];
      const segs = Math.max(2, Math.ceil(Math.abs(nx.x - it.x) / 0.22));
      for (let s = 1; s < segs; s++) { const x = lerp(it.x, nx.x, s / segs); out.push({ x, z: curve(x) }); }
    }
  });
  return out;
}

function rimX(curve, sign) { // где кривая выходит на край острова
  let lo = 0, hi = IA * sign;
  for (let k = 0; k < 40; k++) {
    const mid = (lo + hi) / 2;
    if (inIsland(mid, curve(mid))) lo = mid; else hi = mid;
  }
  return lo;
}

function colorize(g, fn) {
  const pos = g.attributes.position, nor = g.attributes.normal, n = pos.count, a = new Float32Array(n * 3), c = new THREE.Color();
  for (let i = 0; i < n; i++) {
    fn(c, pos.getY(i), nor.getY(i), pos.getX(i), pos.getZ(i));
    a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(a, 3));
  for (const k of Object.keys(g.attributes)) if (!["position", "normal", "color"].includes(k)) g.deleteAttribute(k);
  return g;
}

function islandGeometry() {
  const pts = outline();
  const north = clipBank(pts, (x, z) => z - (zr(x) - RW), (x) => zr(x) - RW);
  const south = clipBank(pts, (x, z) => (zr(x) + RW) - z, (x) => zr(x) + RW);
  const DEPTH = 1.1, BT = 0.2;
  const grass = new THREE.Color(PAL.mint), lip = new THREE.Color("#86D8B2"), clayTop = new THREE.Color("#FF9C80"),
    clayMid = new THREE.Color("#FFB79C"), clayLow = new THREE.Color("#EE7A60"), clayBot = new THREE.Color("#D9624F");
  const parts = [north, south].map((poly) => {
    const shape = new THREE.Shape(poly.map((p) => new V2(p.x, -p.z)));
    const g = new THREE.ExtrudeGeometry(shape, { depth: DEPTH, steps: 3, bevelEnabled: true, bevelThickness: BT, bevelSize: 0.2, bevelOffset: -0.2, bevelSegments: 3, curveSegments: 1 });
    g.rotateX(-Math.PI / 2);
    g.translate(0, -(DEPTH + BT), 0);
    return colorize(g, (c, y, ny) => {
      if (ny > 0.35 && y > -0.07) c.copy(grass);
      else if (y > -0.19 && ny > -0.2) c.copy(lip);
      else if (ny < -0.6) c.copy(clayBot);
      else if (y > -0.6) c.copy(clayTop).lerp(clayMid, smooth(-0.25, -0.567, y));
      else c.copy(clayMid).lerp(clayLow, smooth(-0.6, -0.95, y)).lerp(clayBot, smooth(-1.0, -1.5, y));
    });
  });
  // вода: плита в русле
  const cn = (x) => zr(x) - RW - 0.04, cs = (x) => zr(x) + RW + 0.04;
  const wpts = [];
  const xw = rimX(cn, -1) + 0.1, xe = rimX(cn, 1) - 0.1, xw2 = rimX(cs, -1) + 0.1, xe2 = rimX(cs, 1) - 0.1;
  for (let i = 0; i <= 50; i++) { const x = lerp(xw, xe, i / 50); wpts.push(new V2(x, -cn(x))); }
  for (let i = 0; i <= 50; i++) { const x = lerp(xe2, xw2, i / 50); wpts.push(new V2(x, -cs(x))); }
  const wg = new THREE.ExtrudeGeometry(new THREE.Shape(wpts), { depth: 0.96, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelOffset: -0.06, bevelSegments: 2 });
  wg.rotateX(-Math.PI / 2);
  wg.translate(0, -1.4, 0); // вершина воды: 1.02 − 1.4 = −0.38
  const wTop = new THREE.Color(PAL.water), wSide = new THREE.Color("#63B4EC"), wLow = new THREE.Color("#3F8CCF");
  colorize(wg, (c, y, ny) => {
    if (ny > 0.5) c.copy(wTop);
    else c.copy(wSide).lerp(wLow, smooth(-0.5, -1.4, y));
  });
  return mergeGeometries([...parts, wg], false);
}

/* ───────── дорожки ───────── */
const PATHS = [
  [[-1.6, 0.95], [-3.1, 0.62], [-3.95, -0.25]],        // площадь → общежитие
  [[-2.05, 0.5], [-2.45, -1.1], [-2.35, -2.5], [-1.85, -3.1]], // вокруг корпуса → библиотека
  [[1.0, 0.95], [1.6, 0.9]],                            // площадь → дорога
  [[1.0, 0.3], [1.0, 1.9]],                             // тротуар север
  [[1.0, 3.62], [1.0, 5.25]],                           // тротуар юг
  [[1.0, 4.45], [-0.6, 4.62], [-1.55, 4.3]],            // тротуар → пруд
  [[2.0, 0.3], [2.35, -0.25]],                          // к стадиону
  [[3.45, -2.05], [3.4, -2.5]],                         // стадион → спортзал
];

function distSeg(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
  const t = l2 ? clamp(((px - ax) * dx + (pz - az) * dz) / l2) : 0;
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

/* Полилиния для ходьбы */
function polyline(points, closed = false) {
  const pts = points.map(([x, z]) => new V2(x, z));
  if (closed) pts.push(pts[0].clone());
  const acc = [0];
  for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + pts[i].distanceTo(pts[i - 1]));
  return { pts, acc, len: acc[acc.length - 1], closed };
}
function along(pl, d, out) {
  let s = pl.closed ? ((d % pl.len) + pl.len) % pl.len : pl.len - Math.abs(((d % (2 * pl.len)) + 2 * pl.len) % (2 * pl.len) - pl.len);
  let i = 1;
  while (i < pl.acc.length - 1 && pl.acc[i] < s) i++;
  const a = pl.pts[i - 1], b = pl.pts[i], seg = pl.acc[i] - pl.acc[i - 1] || 1;
  const t = (s - pl.acc[i - 1]) / seg;
  out.set(lerp(a.x, b.x, t), lerp(a.y, b.y, t));
  return out;
}
const ellipse = (cx, cz, rx, rz, n = 40) => Array.from({ length: n }, (_, i) => [cx + rx * Math.cos((i / n) * TAU), cz + rz * Math.sin((i / n) * TAU)]);

/* ───────── здания ───────── */
const DEFS = {
  study:   { pos: [-0.4, -0.9], anchorY: 2.45, hit: [3.4, 2.2, 2.3] },
  live:    { pos: [-4.0, -1.2], anchorY: 3.15, hit: [1.9, 3.0, 2.3] },
  science: { pos: [-1.6, -4.2], anchorY: 2.35, hit: [2.4, 2.2, 2.4] },
  sport:   { pos: [3.6, -0.9],  anchorY: 1.95, hit: [3.6, 1.7, 2.8] },
  walk:    { pos: [-2.9, 4.2],  anchorY: 1.2,  hit: [4.2, 1.0, 2.4] },
};

function buildStudy(k, w) {
  k.block(3.36, 0.24, 2.02, 0.08, PAL.cloud);
  k.block(3.0, 1.22, 1.5, 0.12, PAL.blue, { y: 0.22 });
  k.block(3.1, 0.08, 1.6, 0.04, PAL.white, { y: 0.8 });                 // карниз этажа
  k.block(2.3, 0.1, 0.62, 0.04, PAL.white, { y: 0.22, z: 0.9 });        // крыльцо
  for (let i = 0; i < 6; i++) k.cyl(0.075, 0.085, 0.98, 10, PAL.white, { x: -0.9 + i * 0.36, y: 0.3, z: 1.02 });
  k.block(2.3, 0.16, 0.5, 0.05, PAL.white, { y: 1.26, z: 0.98 });
  k.add(prism(2.36, 0.46, 0.46), PAL.red, { y: 1.4, z: 0.98 });
  k.add(prism(1.6, 0.26, 0.05), PAL.white, { y: 1.47, z: 1.22, sx: 1, sy: 1 });   // тимпан
  k.block(3.16, 0.2, 1.66, 0.09, PAL.red, { y: 1.42 });
  k.cyl(0.36, 0.4, 0.34, 18, PAL.white, { y: 1.6 });
  k.add(new THREE.SphereGeometry(0.36, 18, 8, 0, TAU, 0, Math.PI / 2), PAL.red, { y: 1.94 });
  k.cyl(0.018, 0.018, 0.5, 6, PAL.ink2, { y: 2.2 });
  k.box(0.34, 0.2, 0.03, 0.01, PAL.red, { x: 0.18, y: 2.58, z: 0 });
  // окна
  for (const y of [0.42, 0.98]) {
    for (const x of [-1.28, 1.28]) w.block(0.24, 0.3, 0.05, 0.03, null, { x, y, z: 0.75 });
    for (const z of [-0.45, 0, 0.45]) w.block(0.05, 0.3, 0.24, 0.03, null, { x: 1.5, y, z });
  }
  w.block(0.34, 0.5, 0.05, 0.04, null, { y: 0.32, z: 0.76 });            // дверь-витраж
}

function buildLive(k, w) {
  k.block(1.62, 0.14, 1.62, 0.06, PAL.cloud);
  k.block(1.5, 2.3, 1.5, 0.12, PAL.coral, { y: 0.1 });
  k.block(1.58, 0.1, 1.58, 0.05, PAL.white, { y: 0.8 });
  const roof = prism(1.66, 0.62, 1.74); roof.rotateY(Math.PI / 2);
  k.add(roof, PAL.butter, { y: 2.38 });
  k.block(0.22, 0.4, 0.22, 0.04, PAL.white, { x: 0.4, y: 2.5, z: -0.3 }); // труба
  // полосатый козырёк столовой
  for (let i = 0; i < 5; i++) k.box(0.3, 0.05, 0.46, 0.02, i % 2 ? PAL.white : PAL.mint, { x: -0.6 + i * 0.3, y: 0.78, z: 0.97, rx: 0.32 });
  k.block(0.36, 0.52, 0.06, 0.04, PAL.blue, { x: 0.46, y: 0.12, z: 0.76 });
  // столик с зонтом
  k.cyl(0.24, 0.24, 0.04, 16, PAL.white, { x: -0.35, y: 0.3, z: 1.45 });
  k.cyl(0.03, 0.03, 0.3, 6, PAL.ink2, { x: -0.35, y: 0, z: 1.45 });
  k.cyl(0.018, 0.018, 0.6, 6, PAL.white, { x: -0.35, y: 0.3, z: 1.45 });
  k.add(new THREE.ConeGeometry(0.42, 0.2, 10), PAL.butter, { x: -0.35, y: 0.98, z: 1.45 });
  k.box(0.14, 0.14, 0.14, 0.04, PAL.mint, { x: -0.72, y: 0.07, z: 1.45 });
  k.box(0.14, 0.14, 0.14, 0.04, PAL.mint, { x: 0.02, y: 0.07, z: 1.45 });
  for (const y of [1.05, 1.5, 1.95]) {
    for (const x of [-0.45, 0, 0.45]) w.block(0.22, 0.28, 0.05, 0.03, null, { x, y, z: 0.75 });
    for (const z of [-0.45, 0, 0.45]) w.block(0.05, 0.28, 0.22, 0.03, null, { x: 0.75, y, z });
  }
  w.block(0.72, 0.36, 0.05, 0.04, null, { x: -0.3, y: 0.22, z: 0.76 });
  w.block(0.05, 0.36, 0.72, 0.04, null, { x: 0.76, y: 0.22, z: 0 });
}

function buildScience(k, w) {
  k.cyl(1.2, 1.24, 0.14, 28, PAL.cloud);
  k.cyl(1.0, 1.04, 1.1, 28, PAL.butter, { y: 0.12 });
  k.cyl(1.06, 1.06, 0.14, 28, PAL.white, { y: 1.1 });
  k.add(new THREE.SphereGeometry(0.86, 24, 10, 0, TAU, 0, Math.PI / 2), PAL.white, { y: 1.22 });
  const scope = new THREE.CapsuleGeometry(0.1, 0.62, 3, 10);
  k.add(scope, PAL.blue, { x: 0.28, y: 1.92, z: 0.18, rz: -0.75, rx: 0.3 });
  k.block(0.5, 0.06, 0.7, 0.03, PAL.blue, { x: 0.12, y: 1.94, z: 0.05, rz: -0.35 });
  k.block(0.62, 0.1, 0.5, 0.04, PAL.white, { y: 0.12, z: 1.08 });
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU + 0.31;
    if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a)) - Math.PI / 2) < 0.25) continue;
    w.box(0.2, 0.44, 0.05, 0.03, null, { x: Math.sin(a) * 1.02, y: 0.62, z: Math.cos(a) * 1.02, ry: a });
  }
  w.block(0.34, 0.5, 0.06, 0.04, null, { y: 0.22, z: 1.03 });
}

function buildSport(k, w) {
  const outer = rrPath(3.5, 2.3, 1.15, new THREE.Shape());
  outer.holes.push(rrPath(2.56, 1.36, 0.68, new THREE.Path()));
  k.add(flat(outer, 0.08, 14), PAL.coral);
  k.add(flat(rrPath(2.6, 1.4, 0.7, new THREE.Shape()), 0.06, 14), PAL.field);
  k.block(0.03, 0.012, 1.2, 0, PAL.white, { y: 0.06 });
  k.add(new THREE.TorusGeometry(0.22, 0.016, 4, 28), PAL.white, { y: 0.066, rx: Math.PI / 2 });
  for (const s of [-1, 1]) {
    for (const z of [-0.22, 0.22]) k.cyl(0.018, 0.018, 0.2, 6, PAL.white, { x: s * 1.05, y: 0.06, z });
    k.box(0.036, 0.036, 0.48, 0.012, PAL.white, { x: s * 1.05, y: 0.27, z: 0 });
  }
  // трибуна на севере
  k.block(2.7, 0.22, 0.6, 0.08, PAL.cloud, { z: -1.52 });
  k.block(2.7, 0.44, 0.3, 0.08, PAL.cloud, { z: -1.67 });
  k.block(2.5, 0.06, 0.14, 0.03, PAL.blue, { y: 0.22, z: -1.36 });
  k.block(2.5, 0.06, 0.14, 0.03, PAL.red, { y: 0.44, z: -1.6 });
  // прожекторы
  for (const [x, z] of [[-1.75, -1.15], [1.75, 1.15]]) {
    k.cyl(0.035, 0.05, 1.45, 8, PAL.ink2, { x, z });
    w.box(0.34, 0.2, 0.08, 0.03, null, { x, y: 1.52, z, ry: x < 0 ? -0.6 : -0.6 + Math.PI });
  }
}

function buildWalk(k, w) {
  k.cyl(1, 1, 0.04, 36, PAL.sand, { sx: 1.42, sz: 1.0 });
  k.cyl(1, 1, 0.05, 36, PAL.water, { y: 0.004, sx: 1.18, sz: 0.78 });
  for (const [x, z, r] of [[-0.5, 0.2, 0.13], [0.35, -0.3, 0.1], [0.62, 0.25, 0.12]]) k.cyl(r, r, 0.02, 12, PAL.field, { x, y: 0.05, z });
  k.sphere(0.035, PAL.coral, { x: -0.48, y: 0.08, z: 0.2 }, 8, 6);
  // оранжерея
  k.block(0.96, 0.44, 0.64, 0.06, PAL.white, { x: -1.4, z: -0.62 });
  const roof = new THREE.CylinderGeometry(0.32, 0.32, 0.96, 16, 1, false, 0, Math.PI); roof.rotateZ(Math.PI / 2);
  k.add(roof, PAL.glass, { x: -1.4, y: 0.44, z: -0.62 });
  w.block(0.8, 0.26, 0.05, 0.03, null, { x: -1.4, y: 0.1, z: -0.3 });
  // скамейка
  k.block(0.52, 0.06, 0.16, 0.03, PAL.coral, { x: 0.9, y: 0.12, z: 0.86, ry: -0.3 });
  k.block(0.52, 0.16, 0.04, 0.02, PAL.coral, { x: 0.93, y: 0.18, z: 0.93, ry: -0.3 });
  // мостки
  k.block(0.18, 0.04, 0.6, 0.02, PAL.white, { x: -1.0, y: 0.03, z: 0.4, ry: 0.7 });
}

/* ───────── главный строитель ───────── */
export function createCampus(o) {
  const { scene, camera, renderer, mode = "hero", reduce = false } = o;
  const low = !!o.low;
  const mobile = !!o.mobile;
  const hero = mode === "hero";

  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = !low;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;

  /* свет */
  const hemi = new THREE.HemisphereLight("#FFFFFF", "#C9D3F0", 1.55);
  const dir = new THREE.DirectionalLight("#FFFFFF", 1.95);
  const DAY = new V3(-0.29, 0.82, 0.48).normalize(), DUSK = new V3(-0.78, 0.46, 0.42).normalize();
  dir.position.copy(DAY).multiplyScalar(22);
  if (!low) {
    dir.castShadow = true;
    dir.shadow.mapSize.set(1024, 1024);
    Object.assign(dir.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 2, far: 48 });
    dir.shadow.bias = -0.0005;
    dir.shadow.normalBias = 0.025;
    dir.shadow.radius = 2.5;
  }
  scene.add(hemi, dir, dir.target);

  const matBase = new THREE.MeshLambertMaterial({ vertexColors: true });
  const matWin = new THREE.MeshLambertMaterial({ color: "#DCEBFF", emissive: "#000000" });
  const matBulb = new THREE.MeshLambertMaterial({ color: PAL.butter, emissive: "#FFD36B", emissiveIntensity: 0.15 });
  const blobTex = blobTexture();
  const blobMat = (op) => new THREE.MeshBasicMaterial({ color: PAL.ink, alphaMap: blobTex, transparent: true, opacity: op, depthWrite: false });
  const plane = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);

  const world = new THREE.Group();
  scene.add(world);
  const island = new THREE.Group();
  world.add(island);

  const under = new THREE.Mesh(plane, blobMat(0.16));
  under.scale.set(13, 1, 12);
  under.position.y = -2.6;
  world.add(under);

  const ground = new THREE.Mesh(islandGeometry(), matBase);
  ground.receiveShadow = true;
  island.add(ground);

  /* детали на земле: дорожки, площадь, дорога, мост */
  const kd = new Kit();
  const PATHW = 0.32;
  PATHS.forEach((pl) => {
    for (let i = 0; i < pl.length; i++) {
      const [x, z] = pl[i];
      kd.cyl(PATHW / 2, PATHW / 2, 0.022, 12, PAL.cream, { x, y: 0.0, z });
      if (i) {
        const [px, pz] = pl[i - 1], len = Math.hypot(x - px, z - pz);
        kd.block(len, 0.022, PATHW, 0, PAL.cream, { x: (x + px) / 2, z: (z + pz) / 2, ry: -Math.atan2(z - pz, x - px) });
      }
    }
  });
  kd.cyl(1, 1, 0.03, 40, PAL.cream, { x: -0.3, z: 0.95, sx: 1.45, sz: 0.66 });
  kd.cyl(0.36, 0.38, 0.1, 20, PAL.white, { x: -0.3, z: 0.95 });
  kd.cyl(0.3, 0.3, 0.12, 20, "#7FD6AE", { x: -0.3, z: 0.95 });
  [[0, 0, PAL.red], [0.14, 0.08, PAL.butter], [-0.13, 0.07, PAL.white], [0.06, -0.14, PAL.butter], [-0.1, -0.1, PAL.coral], [0.18, -0.06, PAL.white]]
    .forEach(([dx, dz, c]) => kd.sphere(0.055, c, { x: -0.3 + dx, y: 0.14, z: 0.95 + dz }, 8, 6));
  // дорога
  kd.block(0.8, 0.03, 1.72, 0.012, PAL.road, { x: 1.6, z: 1.02 });
  kd.block(0.8, 0.03, 2.0, 0.012, PAL.road, { x: 1.6, z: 4.62 });
  for (let z = 0.35; z < 5.6; z += 0.42) if (z < 1.8 || z > 3.7) kd.block(0.045, 0.012, 0.18, 0, PAL.white, { x: 1.6, y: 0.03, z });
  // остановка
  kd.cyl(0.022, 0.022, 0.62, 6, PAL.ink2, { x: 2.18, z: 5.05 });
  kd.box(0.24, 0.24, 0.04, 0.03, PAL.blue, { x: 2.18, y: 0.66, z: 5.05, ry: Math.PI / 4 });
  kd.block(0.44, 0.05, 0.14, 0.02, PAL.coral, { x: 2.3, y: 0.14, z: 5.35, ry: Math.PI / 4 });
  const details = new THREE.Mesh(kd.merge(), matBase);
  details.receiveShadow = true;
  island.add(details);

  const kb = new Kit(); // мост
  kb.block(1.22, 0.1, 1.95, 0.04, PAL.white, { x: 1.6, y: -0.02, z: 2.72 });
  for (const s of [-1, 1]) {
    kb.block(0.06, 0.18, 1.95, 0.03, PAL.blue, { x: 1.6 + s * 0.56, y: 0.08, z: 2.72 });
    for (const z of [1.85, 2.72, 3.6]) kb.block(0.1, 0.24, 0.1, 0.04, PAL.white, { x: 1.6 + s * 0.56, y: 0.06, z });
  }
  kb.add(new THREE.TorusGeometry(0.66, 0.08, 8, 20, Math.PI), PAL.coral, { x: 1.6, y: -0.68, z: 2.72, ry: Math.PI / 2 });
  const bridge = new THREE.Mesh(kb.merge(), matBase);
  bridge.castShadow = true; bridge.receiveShadow = true;
  island.add(bridge);

  /* здания */
  const buildings = {};
  const builders = { study: buildStudy, live: buildLive, science: buildScience, sport: buildSport, walk: buildWalk };
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  const hits = [];
  Object.entries(DEFS).forEach(([key, d], i) => {
    const group = new THREE.Group();
    group.position.set(d.pos[0], 0, d.pos[1]);
    const pivot = new THREE.Group();
    group.add(pivot);
    const k = new Kit(), w = new Kit();
    builders[key](k, w);
    const body = new THREE.Mesh(k.merge(), matBase);
    body.castShadow = key !== "walk"; body.receiveShadow = true;
    const wins = new THREE.Mesh(w.merge(), matWin);
    wins.receiveShadow = true;
    pivot.add(body, wins);
    if (key !== "walk") {
      const ao = new THREE.Mesh(plane, blobMat(0.14));
      const [hx, , hz] = d.hit;
      ao.scale.set(hx * 1.15, 1, hz * 1.15);
      ao.position.y = key === "sport" ? 0.09 : 0.02;
      if (key === "sport") ao.visible = false;
      group.add(ao);
    }
    const hit = new THREE.Mesh(new THREE.BoxGeometry(d.hit[0], d.hit[1], d.hit[2]), hitMat);
    hit.position.y = d.hit[1] / 2;
    hit.userData.key = key;
    pivot.add(hit);
    hits.push(hit);
    island.add(group);
    buildings[key] = { key, group, pivot, anchor: new V3(0, d.anchorY, 0), delay: 0.5 + i * 0.1, bounceT: -1 };
  });

  // спортзал (не кнопка, но к нему летит «Жизнь»)
  const kg = new Kit(), wg = new Kit();
  kg.block(1.9, 0.12, 1.2, 0.05, PAL.cloud);
  kg.block(1.8, 0.8, 1.1, 0.1, PAL.white, { y: 0.1 });
  const barrel = new THREE.CylinderGeometry(0.55, 0.55, 1.84, 18, 1, false, 0, Math.PI);
  barrel.rotateZ(Math.PI / 2);
  kg.add(barrel, PAL.blue, { y: 0.9 });
  for (const x of [-0.6, -0.2, 0.2]) wg.block(0.26, 0.34, 0.05, 0.04, null, { x, y: 0.36, z: 0.56 });
  kg.block(0.34, 0.5, 0.06, 0.04, PAL.coral, { x: 0.6, y: 0.1, z: 0.56 });
  for (const z of [-0.3, 0.1]) wg.block(0.05, 0.34, 0.26, 0.04, null, { x: 0.91, y: 0.36, z });
  const gym = new THREE.Group();
  gym.position.set(3.4, 0, -3.15);
  const gymBody = new THREE.Mesh(kg.merge(), matBase);
  gymBody.castShadow = true; gymBody.receiveShadow = true;
  gym.add(gymBody, new THREE.Mesh(wg.merge(), matWin));
  const gymAo = new THREE.Mesh(plane, blobMat(0.14)); gymAo.scale.set(2.3, 1, 1.5); gymAo.position.y = 0.02; gym.add(gymAo);
  const gymPivot = gym; gymPivot.userData.delay = 1.0;
  island.add(gym);

  /* деревья */
  const rand = rng(1870);
  const trees = [];
  const nTrees = low || mobile ? 34 : 52;
  const blocked = (x, z) => {
    if (!inIsland(x, z, 0.75)) return true;
    if (Math.abs(z - zr(x)) < RW + 0.42) return true;
    if (x > -2.35 && x < 1.55 && z > -2.2 && z < 0.4) return true;                 // корпус
    if (x > -5.0 && x < -2.95 && z > -2.2 && z < 0.55) return true;                // общежитие
    if (Math.hypot(x + 1.6, z + 4.2) < 1.55) return true;                          // библиотека
    if (x > 1.6 && x < 5.55 && z > -2.55 && z < 0.55) return true;                 // стадион
    if (x > 2.25 && x < 4.55 && z > -3.95 && z < -2.35) return true;               // спортзал
    if (Math.pow((x + 2.9) / 1.75, 2) + Math.pow((z - 4.2) / 1.3, 2) < 1) return true; // пруд
    if (x > -4.75 && x < -3.85 && z > 3.15 && z < 3.95) return true;               // оранжерея
    if (Math.abs(x - 1.6) < 0.8 && z > -0.1) return true;                          // дорога
    if (x > 1.9 && x < 2.6 && z > 4.8 && z < 5.6) return true;                     // остановка
    if (Math.pow((x + 0.3) / 1.75, 2) + Math.pow((z - 0.95) / 0.92, 2) < 1) return true; // площадь
    for (const pl of PATHS) for (let i = 1; i < pl.length; i++) if (distSeg(x, z, pl[i - 1][0], pl[i - 1][1], pl[i][0], pl[i][1]) < 0.38) return true;
    for (const t of trees) if (Math.hypot(t.x - x, t.z - z) < 0.62 * Math.max(t.s, 0.9)) return true;
    return false;
  };
  const greens = ["#4FBF8D", "#63CC9E", "#3DAE80", "#57C596"];
  for (let tries = 0; tries < 4000 && trees.length < nTrees; tries++) {
    const x = (rand() * 2 - 1) * IA, z = (rand() * 2 - 1) * IB;
    if (blocked(x, z)) continue;
    const r = rand();
    const color = r < 0.08 ? PAL.butter : r < 0.14 ? "#FFB3A0" : greens[Math.floor(rand() * greens.length)];
    trees.push({ x, z, s: 0.78 + rand() * 0.5, color: new THREE.Color(color), ph: rand() * TAU, delay: 0.75 + rand() * 0.45 });
  }
  const crownGeo = new THREE.SphereGeometry(0.3, 12, 9);
  { const p = crownGeo.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); const k = 1 - 0.28 * Math.max(0, y / 0.3); p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k); p.setY(i, y * 1.22); } crownGeo.computeVertexNormals(); crownGeo.translate(0, 0.36, 0); }
  const trunkGeo = new THREE.CylinderGeometry(0.045, 0.06, 0.32, 6).translate(0, 0.16, 0);
  const crowns = new THREE.InstancedMesh(crownGeo, new THREE.MeshLambertMaterial(), trees.length);
  const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshLambertMaterial({ color: "#E07A5F" }), trees.length);
  crowns.castShadow = true; crowns.receiveShadow = true;
  trees.forEach((t, i) => crowns.setColorAt(i, t.color));
  island.add(crowns, trunks);
  const treeAo = new THREE.InstancedMesh(plane, blobMat(0.12), trees.length);
  island.add(treeAo);

  /* фонари */
  const LAMPS = [[2.14, 0.55], [2.14, 1.5], [2.14, 4.0], [2.14, 4.95], [-1.9, 0.55], [0.7, 1.45], [-2.72, -1.2], [-1.4, 3.75], [0.3, 4.95], [-3.25, 1.05]];
  const poleGeo = new THREE.CylinderGeometry(0.022, 0.03, 0.52, 6).translate(0, 0.26, 0);
  const bulbGeo = new THREE.SphereGeometry(0.065, 10, 8).translate(0, 0.56, 0);
  const poles = new THREE.InstancedMesh(poleGeo, new THREE.MeshLambertMaterial({ color: PAL.ink2 }), LAMPS.length);
  const bulbs = new THREE.InstancedMesh(bulbGeo, matBulb, LAMPS.length);
  LAMPS.forEach(([x, z], i) => { _m.makeTranslation(x, 0, z); poles.setMatrixAt(i, _m); bulbs.setMatrixAt(i, _m); });
  island.add(poles, bulbs);

  /* фигурки */
  const walkers = [];
  const addWalkers = (pl, n, speed, colors, y = 0.02, hop = 0.035) => {
    for (let i = 0; i < n; i++) walkers.push({ pl, off: (pl.len / n) * i + rand() * 0.4, speed: speed * (0.85 + rand() * 0.3) * (rand() < 0.5 && !pl.closed ? 1 : 1), color: colors[i % colors.length], y, hop, ph: rand() * TAU });
  };
  const bodyColors = [PAL.blue, PAL.coral, PAL.butter, PAL.red, "#4FBF8D", PAL.ink2, PAL.white];
  const nW = low || mobile ? 0.6 : 1;
  addWalkers(polyline(ellipse(-0.3, 0.95, 1.18, 0.5), true), Math.round(3 * nW) || 1, 0.32, [PAL.blue, PAL.butter, PAL.red]);
  addWalkers(polyline(PATHS[0]), Math.round(2 * nW) || 1, 0.26, [PAL.coral, PAL.white]);
  addWalkers(polyline(PATHS[1]), 1, 0.24, [PAL.ink2]);
  addWalkers(polyline([[1.0, 0.3], [1.0, 1.9], [1.0, 3.62], [1.0, 5.25]]), Math.round(2 * nW) || 1, 0.3, ["#4FBF8D", PAL.red]);
  addWalkers(polyline(PATHS[5]), 1, 0.28, [PAL.blue]);
  addWalkers(polyline(ellipse(-2.9, 4.2, 1.34, 0.93), true), Math.round(2 * nW) || 1, 0.22, [PAL.butter, PAL.coral]);
  { const pts = rrPath(3.02, 1.82, 0.91, new THREE.Shape()).getPoints(10).map((p) => [3.6 + p.x, -0.9 - p.y]); addWalkers(polyline(pts, true), Math.round(2 * nW) || 1, 0.55, [PAL.white, PAL.blue], 0.08, 0.05); }
  const pawnBody = new THREE.CapsuleGeometry(0.075, 0.11, 3, 8).translate(0, 0.13, 0);
  const pawnHead = new THREE.SphereGeometry(0.07, 10, 8).translate(0, 0.33, 0);
  const bodies = new THREE.InstancedMesh(pawnBody, new THREE.MeshLambertMaterial(), walkers.length);
  const heads = new THREE.InstancedMesh(pawnHead, new THREE.MeshLambertMaterial({ color: PAL.cream }), walkers.length);
  const pawnAo = new THREE.InstancedMesh(plane, blobMat(0.2), walkers.length);
  walkers.forEach((wk, i) => bodies.setColorAt(i, new THREE.Color(wk.color)));
  [bodies, heads, pawnAo].forEach((m) => { m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.frustumCulled = false; });
  island.add(bodies, heads, pawnAo);

  /* автобус */
  const kbus = new Kit();
  kbus.block(0.46, 0.34, 0.92, 0.1, PAL.butter, { y: 0.08 });
  kbus.block(0.48, 0.13, 0.78, 0.05, PAL.glass, { y: 0.24 });
  kbus.block(0.3, 0.035, 0.6, 0.015, PAL.coral, { y: 0.42 });
  kbus.block(0.44, 0.08, 0.05, 0.02, PAL.white, { y: 0.14, z: 0.46 });
  for (const x of [-0.21, 0.21]) for (const z of [-0.28, 0.28]) kbus.add(new THREE.CylinderGeometry(0.085, 0.085, 0.07, 12), PAL.ink, { x, y: 0.085, z, rz: Math.PI / 2 });
  const bus = new THREE.Mesh(kbus.merge(), matBase);
  const busAo = new THREE.Mesh(plane, blobMat(0.22));
  busAo.scale.set(0.8, 1, 1.25);
  island.add(bus, busAo);

  /* утка в пруду и рябь на реке */
  const kduck = new Kit();
  kduck.sphere(0.09, PAL.butter, { sy: 0.7 }, 10, 8);
  kduck.sphere(0.055, PAL.butter, { x: 0.07, y: 0.07 }, 10, 8);
  kduck.add(new THREE.ConeGeometry(0.025, 0.06, 6), "#FF9A3C", { x: 0.13, y: 0.065, rz: -Math.PI / 2 });
  const duck = new THREE.Mesh(kduck.merge(), matBase);
  buildings.walk.pivot.add(duck);
  const ripples = [];
  const ripMat = new THREE.MeshBasicMaterial({ color: "#FFFFFF", transparent: true, opacity: 0.55, depthWrite: false });
  const ripGeo = new THREE.CapsuleGeometry(0.035, 0.5, 2, 6).rotateZ(Math.PI / 2).scale(1, 0.25, 1);
  for (let i = 0; i < 4; i++) { const r = new THREE.Mesh(ripGeo, ripMat); ripples.push({ m: r, off: i * 3.2, dz: (i % 2 ? 1 : -1) * 0.22 }); island.add(r); }

  /* облака */
  const kc = new Kit();
  [[0, 0, 0, 0.62], [0.62, -0.12, 0.1, 0.46], [-0.66, -0.16, 0, 0.44], [0.15, 0.26, -0.1, 0.48]].forEach(([x, y, z, r]) => kc.sphere(r, "#FFFFFF", { x, y, z, sy: 0.8 }, 16, 12));
  const cloudGeo = kc.merge();
  const clouds = [[-7.36, 2.0, 0.42, 1.0], [1.59, 2.4, -5.76, 0.8]].map(([x, y, z, s], i) => {
    const m = new THREE.Mesh(cloudGeo, matBase);
    m.position.set(x, y, z); m.scale.setScalar(s);
    m.userData = { x, y, ph: i * 2.1 };
    world.add(m);
    return m;
  });

  /* ───────── камера ───────── */
  const view = { az: 45 * DEG, el: 32 * DEG, target: new V3(0, -0.3, 0), zoom: 1 };
  const base = { az: 45 * DEG, el: 32 * DEG, target: new V3(0, -0.3, 0), zoom: 1 };
  let tween = null, H = 7, aspect = 1, width = 1, height = 1;
  const dirV = new V3();
  function placeCamera(pointer, t) {
    const sway = reduce ? 0 : 1;
    const az = view.az + (pointer ? pointer.x * (hero ? 7 : 3) * DEG * sway : 0) + (reduce ? 0 : Math.sin(t * 0.22) * 1.1 * DEG);
    const el = view.el + (pointer ? pointer.y * (hero ? 4 : 2) * DEG * sway : 0);
    dirV.set(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
    camera.position.copy(view.target).addScaledVector(dirV, 40);
    camera.lookAt(view.target);
    if (camera.zoom !== view.zoom) { camera.zoom = view.zoom; camera.updateProjectionMatrix(); }
    camera.updateMatrixWorld();
  }

  function resize(st) {
    width = st.width; height = st.height; aspect = width / height;
    const halfW = hero ? (mobile ? 7.4 : 7.9) : 7.2;
    H = Math.max(hero ? 5.3 : 4.6, halfW / aspect);
    camera.left = -H * aspect; camera.right = H * aspect; camera.top = H; camera.bottom = -H;
    camera.near = 1; camera.far = 100;
    camera.updateProjectionMatrix();
  }

  const PRESETS = {
    room:    { of: () => buildings.live.group.position, add: new V3(0.2, 1.55, 0.2), zoom: 3.1, az: 22, el: 24 },
    canteen: { of: () => buildings.live.group.position, add: new V3(-0.2, 0.55, 1.0), zoom: 3.4, az: 58, el: 17 },
    gym:     { of: () => gym.position, add: new V3(0, 0.55, 0.1), zoom: 3.0, az: 36, el: 22 },
  };

  function goTo(dest, instant) {
    if (instant || reduce) {
      view.az = dest.az; view.el = dest.el; view.zoom = dest.zoom; view.target.copy(dest.target);
      tween = null;
      return;
    }
    tween = { t: 0, dur: dest.dur || 0.9, from: { az: view.az, el: view.el, zoom: view.zoom, target: view.target.clone() }, to: dest };
  }

  function focus(key, instant) {
    if (!key) { goTo({ ...base, target: base.target.clone() }, instant); return; }
    let dest;
    if (PRESETS[key]) {
      const p = PRESETS[key];
      dest = { az: p.az * DEG, el: p.el * DEG, zoom: p.zoom, target: p.of().clone().add(p.add) };
      if (!mobile) { const right = new V3(Math.cos(dest.az), 0, -Math.sin(dest.az)); dest.target.addScaledVector(right, (0.22 * H * aspect) / dest.zoom); }
    } else {
      const b = buildings[key];
      const zoom = mobile ? 1.75 : 2.0;
      dest = { az: base.az, el: base.el, zoom, target: b.group.position.clone().add(new V3(0, key === "walk" ? 0.2 : 0.7, 0)) };
      if (!mobile) { const right = new V3(Math.cos(base.az), 0, -Math.sin(base.az)); dest.target.addScaledVector(right, (0.3 * H * aspect) / zoom); }
    }
    goTo(dest, instant);
  }

  function bounce(key) {
    const b = buildings[key];
    if (!b || reduce) return;
    if (b.bounceT >= 0 && b.bounceT < 0.25) return;
    b.bounceT = 0;
  }

  const ray = new THREE.Raycaster(), ndc = new V2();
  function pick(px, py) { // координаты в пикселях внутри сцены
    ndc.set((px / width) * 2 - 1, -(py / height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(hits, false)[0];
    return hit ? hit.object.userData.key : null;
  }

  const tmp = new V3();
  function anchors() {
    scene.updateMatrixWorld();
    const out = {};
    for (const key in buildings) {
      const b = buildings[key];
      tmp.copy(b.anchor);
      b.group.localToWorld(tmp);
      tmp.project(camera);
      out[key] = { x: (tmp.x + 1) / 2 * width, y: (1 - tmp.y) / 2 * height };
    }
    return out;
  }

  /* закат */
  const C_HEMI_SKY = [new THREE.Color("#FFFFFF"), new THREE.Color("#FFD9E4")];
  const C_HEMI_GND = [new THREE.Color("#C9D3F0"), new THREE.Color("#B7A6DA")];
  const C_DIR = [new THREE.Color("#FFFFFF"), new THREE.Color("#FFB38A")];
  const C_WIN = [new THREE.Color("#DCEBFF"), new THREE.Color(PAL.butter)];
  const C_GLOW = new THREE.Color("#FFB23F");
  let sunset = -1, shadowSunset = 0;
  function setSunset(p) {
    p = clamp(p);
    if (Math.abs(p - sunset) < 0.002) return false;
    sunset = p;
    hemi.color.lerpColors(C_HEMI_SKY[0], C_HEMI_SKY[1], p);
    hemi.groundColor.lerpColors(C_HEMI_GND[0], C_HEMI_GND[1], p);
    hemi.intensity = lerp(1.55, 1.2, p);
    dir.color.lerpColors(C_DIR[0], C_DIR[1], p);
    dir.intensity = lerp(1.95, 1.75, p);
    dir.position.lerpVectors(DAY, DUSK, p).normalize().multiplyScalar(22);
    matWin.color.lerpColors(C_WIN[0], C_WIN[1], smooth(0.25, 0.8, p));
    matWin.emissive.copy(C_GLOW).multiplyScalar(smooth(0.35, 1, p) * 0.55);
    matBulb.emissiveIntensity = lerp(0.15, 1.1, smooth(0.3, 0.9, p));
    if (!low && Math.abs(p - shadowSunset) > 0.04) { shadowSunset = p; renderer.shadowMap.needsUpdate = true; }
    return true;
  }
  setSunset(0);

  /* ───────── кадр ───────── */
  const INTRO = hero && !reduce ? 1.75 : 0;
  let clock = 0, lastIntroDone = false;
  const w2 = new V2();
  const busState = { dir: 1 };

  function updateTrees(t, intro) {
    for (let i = 0; i < trees.length; i++) {
      const tr = trees[i];
      const g = INTRO ? clamp((t - tr.delay) / 0.5) : 1;
      const s = tr.s * Math.max(0.001, g < 1 ? easeOutBack(g) : 1);
      const sway = reduce || low ? 0 : Math.sin(t * 1.1 + tr.ph) * 0.035;
      _e.set(sway * 0.6, 0, sway);
      _q.setFromEuler(_e);
      _s.set(s, s, s);
      _p.set(tr.x, 0, tr.z);
      crowns.setMatrixAt(i, _m.compose(_p, _q, _s));
      if (intro || !lastIntroDone) {
        _q.identity();
        trunks.setMatrixAt(i, _m.compose(_p, _q, _s));
        _s.set(0.95 * s, 1, 0.95 * s); _p.set(tr.x, 0.025, tr.z);
        treeAo.setMatrixAt(i, _m.compose(_p, _q, _s));
      }
    }
    crowns.instanceMatrix.needsUpdate = true;
    if (intro || !lastIntroDone) { trunks.instanceMatrix.needsUpdate = true; treeAo.instanceMatrix.needsUpdate = true; }
  }

  function frame(st) {
    const dt = st.dt;
    clock = reduce ? 0 : clock + dt;
    const t = reduce ? 30 : clock;
    const introOn = INTRO > 0 && t < INTRO;
    let shadowsDirty = introOn;

    // остров: падение и мягкое покачивание
    if (INTRO > 0 && t < 0.95) {
      if (t < 0.45) { const u = t / 0.45; island.position.y = 5 * (1 - u * u); island.scale.set(1, 1, 1); }
      else { const u = t - 0.45; const s = 1 - 0.1 * Math.exp(-7 * u) * Math.sin(16 * u); island.position.y = 0; island.scale.set(1 / Math.sqrt(s), s, 1 / Math.sqrt(s)); }
    } else {
      island.scale.set(1, 1, 1);
      island.position.y = reduce ? 0 : Math.sin(t * 0.8) * 0.06;
    }
    under.material.opacity = 0.16 * (INTRO > 0 && t < 0.45 ? 0.3 + 0.7 * (t / 0.45) : 1);

    // здания: выпрыгивают по очереди, потом прыгают по наведению
    for (const key in buildings) {
      const b = buildings[key];
      let sy = 1, sxz = 1, lift = 0;
      if (INTRO > 0 && t < b.delay + 0.7) {
        const g = clamp((t - b.delay) / 0.6);
        const s = Math.max(0.001, easeOutBack(g));
        sy = s; sxz = s;
      } else if (b.bounceT >= 0) {
        b.bounceT += dt;
        const u = b.bounceT;
        if (u < 0.22) { lift = 0.24 * Math.sin((Math.PI * u) / 0.22); sy = 1.06; sxz = 1 / Math.sqrt(sy); }
        else if (u < 0.62) { const v = u - 0.22; sy = 1 - 0.13 * Math.exp(-7 * v) * Math.sin(17 * v); sxz = 1 / Math.sqrt(sy); }
        else b.bounceT = -1;
        shadowsDirty = true;
      }
      b.pivot.scale.set(sxz, sy, sxz);
      b.pivot.position.y = lift;
    }
    if (INTRO > 0 && t < 1.8) { const g = clamp((t - 1.0) / 0.6); gym.scale.setScalar(Math.max(0.001, easeOutBack(g))); }
    else gym.scale.setScalar(1);

    updateTrees(t, introOn);
    lastIntroDone = !introOn;

    // фигурки
    const appear = INTRO > 0 ? clamp((t - 1.2) / 0.4) : 1;
    for (let i = 0; i < walkers.length; i++) {
      const wk = walkers[i];
      along(wk.pl, wk.off + t * wk.speed, w2);
      const hop = reduce ? 0 : Math.abs(Math.sin(t * 7 + wk.ph)) * wk.hop;
      let y = wk.y;
      if (w2.x > 0.8 && w2.x < 1.2 && w2.y > 1.8 && w2.y < 3.7) y = 0.08;
      _q.identity();
      _s.setScalar(Math.max(0.001, appear));
      _p.set(w2.x, y + hop, w2.y);
      _m.compose(_p, _q, _s);
      bodies.setMatrixAt(i, _m); heads.setMatrixAt(i, _m);
      _s.set(0.34 * appear, 1, 0.34 * appear); _p.set(w2.x, y + 0.012, w2.y);
      pawnAo.setMatrixAt(i, _m.compose(_p, _q, _s));
    }
    bodies.instanceMatrix.needsUpdate = heads.instanceMatrix.needsUpdate = pawnAo.instanceMatrix.needsUpdate = true;

    // автобус: туда-обратно по мосту с остановками
    {
      const cyc = reduce ? 1.2 : (t % 12);
      let z, heading;
      if (cyc < 4.4) { z = lerp(0.75, 5.1, easeInOut(cyc / 4.4)); heading = 0; }
      else if (cyc < 6) { z = 5.1; heading = Math.PI * smooth(4.6, 5.6, cyc); }
      else if (cyc < 10.4) { z = lerp(5.1, 0.75, easeInOut((cyc - 6) / 4.4)); heading = Math.PI; }
      else { z = 0.75; heading = Math.PI + Math.PI * smooth(10.6, 11.6, cyc); }
      const onBridge = smooth(1.62, 1.95, z) * (1 - smooth(3.5, 3.83, z));
      const y = 0.03 + onBridge * 0.05;
      bus.position.set(1.6, y, z);
      bus.rotation.y = heading;
      bus.scale.setScalar(Math.max(0.001, appear));
      busAo.position.set(1.6, y + 0.01, z);
      busAo.visible = appear > 0.5;
    }

    // утка, рябь, облака
    duck.position.set(Math.cos(t * 0.35) * 0.6, 0.06, Math.sin(t * 0.35) * 0.36);
    duck.rotation.y = -t * 0.35 - Math.PI;
    for (const r of ripples) {
      const x = -5.2 + (((r.off + t * 0.28) % 10.4) + 10.4) % 10.4;
      r.m.position.set(x, -0.37, zr(x) + r.dz);
      r.m.rotation.y = -Math.atan(0.45 * 0.55 * Math.cos(0.55 * x + 0.6));
      r.m.material.opacity = 0.5;
    }
    clouds.forEach((c) => { c.position.x = c.userData.x + (reduce ? 0 : Math.sin(t * 0.07 + c.userData.ph) * 0.7); c.position.y = c.userData.y + (reduce ? 0 : Math.sin(t * 0.5 + c.userData.ph) * 0.08); });

    // камера
    if (tween) {
      tween.t += dt / tween.dur;
      const e = easeInOut(clamp(tween.t));
      view.az = lerp(tween.from.az, tween.to.az, e);
      view.el = lerp(tween.from.el, tween.to.el, e);
      view.zoom = lerp(tween.from.zoom, tween.to.zoom, e);
      view.target.lerpVectors(tween.from.target, tween.to.target, e);
      if (tween.t >= 1) tween = null;
    }
    placeCamera(st.pointer, t);

    if (!low && (shadowsDirty || reduce || st.forceShadow)) renderer.shadowMap.needsUpdate = true;
  }

  return { frame, resize, focus, bounce, pick, anchors, setSunset, buildings, low, get moving() { return !!tween; }, get ready() { return INTRO === 0 || clock >= INTRO - 0.4; } };
}
