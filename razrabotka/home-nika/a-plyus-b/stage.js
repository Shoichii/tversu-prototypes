/* home-nika/a — «Чертёж становится 3D».
   Плоский чертёж hero (окружности, кольцо рисок, две дуги) прорисовывается линиями, затем раскрывается в армиллярную
   конструкцию: каждая орбита уходит в свою наклонную плоскость, кольцо рисок и дуги медленно вращаются в своих плоскостях.
   Курсор чуть поворачивает конструкцию, прокрутка наклоняет и раскрывает её сильнее.
   Цифры и подписи — HTML (доступны и читаемы), ставятся в проекцию точек на орбитах.
   Reduced-motion: сцена не монтируется, остаётся SVG (он же кадр для скриншотов). Пауза — кнопка в кружке (WCAG 2.2.2). */
import { mountStage } from "../../../system/three-stage.js";

const fig = document.querySelector(".hero__art[data-stage]");
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const easeOutExpo = (p) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p));
const easeInOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const lerp = (a, b, k) => a + (b - a) * k;

/* Орбиты в единицах чертежа: 280 px SVG = 1. Наклон — Эйлер (x, y, z) в раскрытом виде. */
const ORBITS = [
  { r: 70 / 280, tilt: [1.18, 0.0, 0.2], color: 0x4a5775 },
  { r: 140 / 280, tilt: [0.25, -0.95, 0.0], color: 0x5c6a8f },   // 129
  { r: 210 / 280, tilt: [-0.95, 0.0, 0.3], color: 0x5c6a8f },  // 15
  { r: 270 / 280, tilt: [0.12, 0.5, 0.0], color: 0x6b7899 },    // 1870, [N], кольцо рисок
];
/* Якоря подписей: орбита и угол (градусы, против часовой от оси x, как в SVG с перевёрнутой y) */
const ANCHORS = {
  "1870": { orbit: 3, deg: 42, dot: "accent" },
  "15": { orbit: 2, deg: 165, dot: "solid" },
  "129": { orbit: 1, deg: 140, dot: "solid" },
  students: { orbit: 3, deg: -78, dot: "open", tx: "14px" },
};

function build({ scene, camera, THREE, root }) {
  const small = root.getBoundingClientRect().width < 440;
  const SEG = small ? 96 : 160;
  camera.fov = 30;
  camera.position.set(0, 0, 4.25);
  camera.updateProjectionMatrix();
  scene.fog = new THREE.Fog(0x1f2a44, 3.4, 7.0); // дальние половины орбит тише — глубина без свечений

  const world = new THREE.Group();
  scene.add(world);

  const circlePoints = (r, from = 0, to = Math.PI * 2, n = SEG) => {
    const pts = [];
    for (let i = 0; i <= n; i++) {
      const a = from + (to - from) * (i / n);
      pts.push(new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, 0));
    }
    return pts;
  };
  const lineMat = (color, opacity = 1) => new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity });

  /* оси чертежа; третья ось (z) вырастает при раскрытии */
  const axisMat = lineMat(0x3a4763);
  const axes = [];
  [[-1, 0, 0, 1, 0, 0], [0, -1, 0, 0, 1, 0], [0, 0, -1, 0, 0, 1]].forEach((c, i) => {
    const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(c[0], c[1], c[2]), new THREE.Vector3(c[3], c[4], c[5])]);
    const l = new THREE.Line(g, axisMat);
    world.add(l);
    axes.push(l);
  });

  /* орбиты: у каждой свой шарнир-группа, чтобы наклон не трогал вращение в плоскости */
  const orbits = ORBITS.map((o, i) => {
    const pivot = new THREE.Group();
    world.add(pivot);
    const geo = new THREE.BufferGeometry().setFromPoints(circlePoints(o.r));
    const line = new THREE.Line(geo, lineMat(o.color));
    pivot.add(line);
    const spin = new THREE.Group(); // вращение в собственной плоскости (для рисок и дуг)
    pivot.add(spin);
    return { ...o, pivot, geo, spin, count: SEG + 1, delay: 0.12 + i * 0.14 };
  });

  /* кольцо рисок на внешней орбите */
  const TICKS = small ? 24 : 36;
  const tickPts = [];
  for (let i = 0; i < TICKS; i++) {
    const a = (i / TICKS) * Math.PI * 2;
    const long = i % 3 === 0;
    const r1 = 260 / 280, r0 = (long ? 230 : 250) / 280;
    tickPts.push(new THREE.Vector3(Math.cos(a) * r0, Math.sin(a) * r0, 0), new THREE.Vector3(Math.cos(a) * r1, Math.sin(a) * r1, 0));
  }
  const tickGeo = new THREE.BufferGeometry().setFromPoints(tickPts);
  orbits[3].spin.add(new THREE.LineSegments(tickGeo, lineMat(0x6b7899)));

  /* две синие дуги — своя невидимая орбита r=175 между 129 и 15 */
  const arcPivot = new THREE.Group();
  world.add(arcPivot);
  const arcSpin = new THREE.Group();
  arcPivot.add(arcSpin);
  const arcR = 175 / 280, arcN = Math.round(SEG / 4);
  const arcGeos = [20, 200].map((deg) => {
    const a0 = (deg * Math.PI) / 180;
    const g = new THREE.BufferGeometry().setFromPoints(circlePoints(arcR, a0, a0 + (80 * Math.PI) / 180, arcN));
    arcSpin.add(new THREE.Line(g, lineMat(0x8f9ce6)));
    return g;
  });
  const ARC_TILT = [-0.35, 0.72, 0.0];

  /* HTML: подписи и точки */
  const labels = [...root.querySelectorAll("[data-anchor]")].map((el) => {
    const a = ANCHORS[el.dataset.anchor];
    const dot = document.createElement("span");
    dot.className = "hero__dot hero__dot--" + a.dot;
    dot.setAttribute("aria-hidden", "true");
    root.insertBefore(dot, el);
    const rad = (a.deg * Math.PI) / 180;
    const r = ORBITS[a.orbit].r;
    return { el, dot, pivot: orbits[a.orbit].pivot, local: new THREE.Vector3(Math.cos(rad) * r, Math.sin(rad) * r, 0), tx: a.tx || el.style.getPropertyValue("--tx").trim() || "12px" };
  });
  const center = document.createElement("span");
  center.className = "hero__dot hero__dot--open hero__dot--center";
  center.setAttribute("aria-hidden", "true");
  root.insertBefore(center, root.querySelector("[data-anchor]"));
  root.classList.add("is-3d");

  const v = new THREE.Vector3();
  let clock = 0, speed = 1, s0 = null;

  return (state) => {
    const { t, dt, pointer, scroll, width, height } = state;
    const paused = root.classList.contains("is-paused");
    speed += ((paused ? 0 : 1) - speed) * Math.min(1, dt * 3);
    clock += dt * speed;
    if (s0 === null) s0 = scroll;
    const ps = clamp01(((scroll - s0) / Math.max(0.2, 1 - s0)) * 1.5); // 0 наверху → 1, когда hero уходит

    /* 1) прорисовка линий: орбиты лесенкой, затем риски и дуги */
    orbits.forEach((o) => {
      const p = easeOutExpo(clamp01((t - o.delay) / 1.5));
      o.geo.setDrawRange(0, Math.max(2, Math.floor(o.count * p)));
    });
    const tp = easeOutExpo(clamp01((t - 0.7) / 1.2));
    tickGeo.setDrawRange(0, Math.floor(TICKS * tp) * 2);
    arcGeos.forEach((g) => g.setDrawRange(0, Math.max(2, Math.floor((arcN + 1) * easeOutExpo(clamp01((t - 0.9) / 1.2))))));

    /* 2) раскрытие в армиллярную сферу: плоский чертёж → наклонные орбиты */
    const unfold = easeInOut(clamp01((t - 1.1) / 2.6));
    const k = unfold * (1 + 0.35 * ps);
    orbits.forEach((o) => o.pivot.rotation.set(o.tilt[0] * k, o.tilt[1] * k, o.tilt[2] * k));
    arcPivot.rotation.set(ARC_TILT[0] * k, ARC_TILT[1] * k, 0);
    axes[2].scale.setScalar(Math.max(0.001, unfold));
    axes[2].visible = unfold > 0.01;

    /* 3) медленная жизнь: риски и дуги навстречу, вся конструкция покачивается; курсор и прокрутка */
    orbits[3].spin.rotation.z = clock * 0.045;
    arcSpin.rotation.z = -clock * 0.07;
    orbits[0].spin.rotation.z = clock * 0.1;
    const idle = unfold * speed;
    world.rotation.y = unfold * Math.sin(clock * 0.24) * 0.22 + pointer.x * 0.22 * idle + unfold * 0.12;
    world.rotation.x = unfold * (0.1 + Math.sin(clock * 0.17) * 0.05) - pointer.y * 0.14 * idle + ps * 0.5;
    camera.position.z = lerp(4.25, 4.7, ps);

    /* 4) подписи — в проекцию */
    world.updateMatrixWorld(true);
    camera.updateMatrixWorld();
    const show = clamp01((t - 1.0) / 0.5);
    const place = (el, vec, extra) => {
      v.copy(vec).project(camera);
      const x = ((v.x + 1) / 2) * width, y = ((1 - v.y) / 2) * height;
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)` + extra;
      return v.z;
    };
    labels.forEach((L) => {
      v.copy(L.local);
      L.pivot.localToWorld(v);
      const w = v.clone();
      // точка чуть меньше и тише, когда уходит за центр — читается глубина; подпись всегда в полную силу
      const depth = clamp01(0.5 - w.z * 0.7); // w.z > 0 — ближе к зрителю
      place(L.dot, w, "");
      place(L.el, w, ` translate(${L.tx}, -50%)`);
      L.dot.style.opacity = (show * lerp(1, 0.55, depth)).toFixed(3);
      L.dot.style.transform += ` scale(${lerp(1.1, 0.8, depth).toFixed(3)})`;
    });
    place(center, v.set(0, 0, 0), "");
    center.style.opacity = show.toFixed(3);
  };
}

let mounted = false;
function mount() {
  if (mounted || !fig || reduce.matches) return;
  mounted = true;
  const handle = mountStage(fig, build, { fov: 30, alpha: true, maxDpr: 1.75 });
  if (!handle) { fig.classList.remove("is-3d"); mounted = false; }
}
mount();
reduce.addEventListener?.("change", mount);
