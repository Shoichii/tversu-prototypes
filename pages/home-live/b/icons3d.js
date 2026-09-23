/* home-live/b — пластиковые предметы у входов «Кому что нужно»: зачётка, расписание, портфель, рукопожатие.
   Один canvas поверх сетки плиток; камера ортогональная в пикселях, предметы стоят в слотах .door__obj.
   Мышь: предметы поворачиваются к курсору; тап/клик по слоту — оборот 360° (700 мс). */
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { RoundedBoxGeometry } from "./rounded-box.js";
import { mountStage } from "../../../system/three-stage.js";
import { PAL } from "./scene.js";

const clamp = (v, a = -1, b = 1) => Math.min(b, Math.max(a, v));
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();

function part(g, color, t = {}) {
  if (g.index) g = g.toNonIndexed();
  for (const k of Object.keys(g.attributes)) if (k !== "position" && k !== "normal") g.deleteAttribute(k);
  _e.set(t.rx || 0, t.ry || 0, t.rz || 0); _q.setFromEuler(_e);
  _s.set(t.sx ?? 1, t.sy ?? 1, t.sz ?? 1); _p.set(t.x || 0, t.y || 0, t.z || 0);
  g.applyMatrix4(_m.compose(_p, _q, _s));
  const c = new THREE.Color(color), n = g.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute("color", new THREE.BufferAttribute(a, 3));
  return g;
}
const rb = (w, h, d, r, seg = 3) => new RoundedBoxGeometry(w, h, d, seg, Math.min(r, w / 2, h / 2, d / 2) * 0.98);

/* все предметы в единицах ~1 (вписаны в куб 1.4) */
const MAKERS = {
  book() { // зачётка
    return [
      part(rb(1.0, 1.36, 0.24, 0.07), PAL.white),
      part(rb(0.94, 1.28, 0.2, 0.03), PAL.cream, { x: 0.05 }),
      part(rb(0.16, 1.37, 0.26, 0.06), PAL.blue, { x: -0.44 }),
      part(rb(0.62, 0.24, 0.04, 0.03), PAL.blue, { x: 0.06, y: 0.22, z: 0.12 }),
      part(rb(0.4, 0.06, 0.03, 0.02), PAL.ink2, { x: 0.06, y: -0.05, z: 0.12 }),
      part(rb(0.3, 0.06, 0.03, 0.02), PAL.ink2, { x: 0.01, y: -0.17, z: 0.12 }),
      part(rb(0.1, 0.52, 0.03, 0.02), PAL.red, { x: 0.28, y: -0.78, z: 0.06, rz: 0.12 }),
      part(new THREE.CylinderGeometry(0.1, 0.1, 0.04, 16), PAL.butter, { x: 0.06, y: 0.43, z: 0.12, rx: Math.PI / 2 }),
    ];
  },
  board() { // расписание на планшете
    const g = [
      part(rb(1.04, 1.36, 0.1, 0.1), PAL.blue),
      part(rb(0.86, 1.08, 0.04, 0.03), PAL.white, { y: -0.07, z: 0.06 }),
      part(rb(0.46, 0.18, 0.12, 0.06), PAL.butter, { y: 0.66, z: 0.06 }),
      part(new THREE.TorusGeometry(0.09, 0.03, 8, 16), PAL.ink2, { y: 0.78, z: 0.06 }),
    ];
    [[PAL.coral, 0.52, 0.28], [PAL.mint, 0.36, 0.08], [PAL.butter, 0.6, -0.12], [PAL.blue, 0.3, -0.32], [PAL.coral, 0.46, -0.52]].forEach(([c, w, y], i) => {
      g.push(part(rb(w, 0.12, 0.05, 0.05), c, { x: -0.3 + w / 2 + (i % 2) * 0.12, y, z: 0.09 }));
    });
    return g;
  },
  bag() { // портфель
    return [
      part(rb(1.36, 0.92, 0.46, 0.14), PAL.coral),
      part(rb(1.38, 0.34, 0.48, 0.12), "#F2765A", { y: 0.3 }),
      part(rb(0.26, 0.18, 0.08, 0.05), PAL.butter, { y: 0.12, z: 0.24 }),
      part(new THREE.TorusGeometry(0.22, 0.05, 10, 20, Math.PI), PAL.ink, { y: 0.46 }),
      part(rb(0.1, 0.5, 0.5, 0.04), "#F2765A", { x: -0.44, y: -0.05 }),
      part(rb(0.1, 0.5, 0.5, 0.04), "#F2765A", { x: 0.44, y: -0.05 }),
    ];
  },
  hands() { // рукопожатие
    const sleeve = (color, s) => [
      part(new THREE.CapsuleGeometry(0.22, 0.62, 4, 14), color, { x: s * 0.62, y: -0.26, rz: s * 1.05 }),
      part(new THREE.CylinderGeometry(0.2, 0.2, 0.12, 16), PAL.white, { x: s * 0.3, y: -0.06, rz: s * 1.05 }),
    ];
    return [
      ...sleeve(PAL.blue, -1), ...sleeve("#57C596", 1),
      part(rb(0.52, 0.34, 0.36, 0.16), PAL.white, { x: -0.06, y: 0.1, rz: -0.35 }),
      part(rb(0.5, 0.32, 0.34, 0.15), "#FFF6DD", { x: 0.08, y: 0.18, z: 0.06, rz: 0.3 }),
      part(new THREE.CapsuleGeometry(0.07, 0.16, 3, 8), "#FFF6DD", { x: -0.02, y: 0.38, z: 0.16, rz: 1.1 }),
    ];
  },
};

export function mountDoors(root, scope = root) {
  const slots = [...scope.querySelectorAll("[data-door-obj]")];
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const items = [];
  const local = { x: -9999, y: -9999, on: false };
  let W = 1, Hh = 1, cam = null;
  const fitCam = (w, h) => {
    if (!cam) return;
    cam.left = 0; cam.right = w; cam.top = 0; cam.bottom = -h;
    cam.near = -1000; cam.far = 1000; cam.position.set(0, 0, 10);
    cam.updateProjectionMatrix();
  };

  function measure() {
    const r = root.getBoundingClientRect();
    W = r.width; Hh = r.height;
    items.forEach((it) => {
      const s = it.slot.getBoundingClientRect();
      it.cx = s.left - r.left + s.width / 2;
      it.cy = s.top - r.top + s.height / 2;
      it.size = Math.min(s.width, s.height) * 0.56;
    });
  }

  const handle = mountStage(root, ({ scene, renderer, camera }) => {
    cam = camera;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.setClearColor(0x000000, 0);
    scene.add(new THREE.HemisphereLight("#FFFFFF", "#B9C4EA", 1.7));
    const dl = new THREE.DirectionalLight("#FFFFFF", 2.1);
    dl.position.set(-0.5, 0.8, 1).multiplyScalar(100);
    scene.add(dl);
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    slots.forEach((slot, i) => {
      const kind = slot.dataset.doorObj;
      const geo = mergeGeometries(MAKERS[kind](), false);
      geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, mat);
      const holder = new THREE.Group();
      holder.add(mesh);
      scene.add(holder);
      const it = { slot, kind, holder, mesh, cx: 0, cy: 0, size: 60, yaw: -0.35, pitch: 0.25, spin: -1, ph: i * 1.3 };
      items.push(it);
      slot.addEventListener("pointerdown", () => { if (!reduce) it.spin = 0; });
    });
    return (st) => {
      const t = st.t, dt = st.dt;
      items.forEach((it) => {
        let ty = -0.35, tp = 0.22;
        if (!reduce && local.on) {
          ty = clamp((local.x - it.cx) / 420) * 0.65;
          tp = 0.12 + clamp((local.y - it.cy) / 420) * 0.4;
        } else if (!reduce) {
          ty = -0.35 + Math.sin(t * 0.6 + it.ph) * 0.18;
        }
        const k = reduce ? 1 : Math.min(1, dt * 5);
        it.yaw += (ty - it.yaw) * k;
        it.pitch += (tp - it.pitch) * k;
        let spin = 0;
        if (it.spin >= 0) {
          it.spin += dt / 0.7;
          const x = Math.min(1, it.spin);
          spin = (1 - Math.pow(1 - x, 3)) * Math.PI * 2;
          if (it.spin >= 1) it.spin = -1;
        }
        const bob = reduce ? 0 : Math.sin(t * 1.4 + it.ph) * 4;
        it.holder.position.set(it.cx, -(it.cy) + bob, 0);
        it.holder.scale.setScalar(it.size);
        it.mesh.rotation.set(it.pitch, it.yaw + spin, 0);
      });
    };
  }, {
    camera: "ortho", alpha: true, maxDpr: 1.25,
    onResize(st) { measure(); fitCam(st.width, st.height); },
  });
  if (!handle) return null;
  measure();
  handle.redraw();

  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
    window.addEventListener("pointermove", (e) => {
      const r = root.getBoundingClientRect();
      local.x = e.clientX - r.left; local.y = e.clientY - r.top;
      local.on = local.y > -200 && local.y < r.height + 200;
    }, { passive: true });
  }
  const again = () => { measure(); handle.redraw(); };
  document.fonts?.ready.then(again);
  window.addEventListener("load", again);
  new ResizeObserver(again).observe(scope);
  return handle;
}
