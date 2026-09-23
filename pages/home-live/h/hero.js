/* Первый экран: гипсовый монолит-щит на постаменте. Прокрутка раскрывает его на 15 плит-факультетов.
   Подписи — HTML-этикетки (nav.h-facs), к ним из угла каждой плиты тянется выносная линия.
   Рисуем только когда что-то изменилось: под программным рендером (SwiftShader) это главная экономия. */
import * as THREE from "three";
import { mountStage } from "../../../system/three-stage.js";

const N = 15;
const W = 2.0, H = 2.65, R = 0.8, RT = 0.07, T = 0.052;
const GAP0 = 0.004, GAP1 = 0.03;
const PODIUM = { w: 3.5, h: 0.24, d: 4.7, z: 1.4 };
const FOV = 28;
const D2R = Math.PI / 180;

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

export function isSoftwareGL(renderer) {
  try {
    const gl = renderer.getContext();
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const name = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER));
    return /swiftshader|llvmpipe|softpipe|software|basic render/i.test(name);
  } catch (e) { return false; }
}

export function shieldShape(w, h, r, rt) {
  const s = new THREE.Shape();
  const x0 = -w / 2, x1 = w / 2;
  s.moveTo(x0 + r, 0);
  s.lineTo(x1 - r, 0);
  s.absarc(x1 - r, r, r, -Math.PI / 2, 0, false);
  s.lineTo(x1, h - rt);
  s.absarc(x1 - rt, h - rt, rt, 0, Math.PI / 2, false);
  s.lineTo(x0 + rt, h);
  s.absarc(x0 + rt, h - rt, rt, Math.PI / 2, Math.PI, false);
  s.lineTo(x0, r);
  s.absarc(x0 + r, r, r, Math.PI, Math.PI * 1.5, false);
  return s;
}

/* Мягкое контактное пятно: белый центр → чёрный край, используется как alphaMap */
export function contactTexture(soft = 0.5) {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d");
  g.fillStyle = "#000"; g.fillRect(0, 0, 128, 128);
  const grd = g.createRadialGradient(64, 64, 64 * (1 - soft), 64, 64, 64);
  grd.addColorStop(0, "#fff"); grd.addColorStop(1, "#000");
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.NoColorSpace;
  return t;
}

function placeCamera(camera, tgt, az, el, dist) {
  const a = az * D2R, e = el * D2R;
  camera.position.set(tgt.x + dist * Math.sin(a) * Math.cos(e), tgt.y + dist * Math.sin(e), tgt.z + dist * Math.cos(a) * Math.cos(e));
  camera.lookAt(tgt);
  camera.updateMatrixWorld();
}

export function initHero(root, { labels, title, leaders, desk, scroll = false }) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
  let ctl = null;
  let api = { setTarget() {}, snap() {}, hover() {}, setScrollMode() {}, refit() {}, progress: () => 1 };

  root.setAttribute("data-stage", "");
  let onResize = () => {};
  ctl = mountStage(root, (ctx) => build(ctx), { fov: FOV, alpha: true, maxDpr: 1.75, onResize: (s) => onResize(s) });
  if (!ctl) return api;
  return api;

  function build({ scene, camera, renderer, state }) {
    const soft = isSoftwareGL(renderer);
    let dpr = soft ? 0.6 : Math.min(window.devicePixelRatio || 1, desk.matches ? 1.75 : 1.5);
    renderer.setPixelRatio(dpr);
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    camera.fov = FOV; camera.near = 0.5; camera.far = 80;

    /* ── материалы и геометрия ── */
    const plaster = new THREE.MeshStandardMaterial({ color: "#F1F0EB", roughness: 0.93, metalness: 0 });
    const plinthMat = new THREE.MeshStandardMaterial({ color: "#E3E1DB", roughness: 0.96, metalness: 0 });
    const roofMat = new THREE.MeshStandardMaterial({ color: "#E10447", roughness: 0.72, metalness: 0 });
    const shape = shieldShape(W, H, R, RT);
    const slabGeo = new THREE.ExtrudeGeometry(shape, { depth: T - 0.008, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 1, curveSegments: soft ? 8 : 14 });
    slabGeo.translate(0, 0, -(T - 0.004));
    const edgeGeo = new THREE.EdgesGeometry(new THREE.ExtrudeGeometry(shape, { depth: T, bevelEnabled: false, curveSegments: 14 }).translate(0, 0, -T), 30);

    const slabs = [], edges = [];
    for (let i = 0; i < N; i++) {
      const m = new THREE.Mesh(slabGeo, plaster);
      m.castShadow = true; m.receiveShadow = true;
      m.userData.i = i;
      const e = new THREE.LineSegments(edgeGeo, new THREE.LineBasicMaterial({ color: "#2A3DAD", transparent: true, opacity: 0, depthTest: true }));
      e.visible = false;
      e.scale.setScalar(1.002);
      m.add(e);
      scene.add(m);
      slabs.push(m); edges.push(e);
    }

    const roofPivot = new THREE.Group();
    const roof = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.11, 1), roofMat);
    roof.castShadow = true;
    roofPivot.add(roof);
    scene.add(roofPivot);

    const podium = new THREE.Mesh(new THREE.BoxGeometry(PODIUM.w, PODIUM.h, PODIUM.d), plinthMat);
    podium.position.set(0, -PODIUM.h / 2, PODIUM.z);
    podium.receiveShadow = true; podium.castShadow = true;
    scene.add(podium);

    const floorMat = new THREE.ShadowMaterial({ opacity: 0, color: "#3A372F" });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), floorMat);
    floor.rotation.x = -Math.PI / 2; floor.position.y = -PODIUM.h - 0.001;
    floor.receiveShadow = true;
    scene.add(floor);

    const contactMat = new THREE.MeshBasicMaterial({ color: "#35322B", alphaMap: contactTexture(0.55), transparent: true, opacity: 0, depthWrite: false });
    const contact = new THREE.Mesh(new THREE.PlaneGeometry(PODIUM.w + 1.1, PODIUM.d + 1.1), contactMat);
    contact.rotation.x = -Math.PI / 2; contact.position.set(0, -PODIUM.h + 0.002, PODIUM.z);
    scene.add(contact);

    /* ── свет ── */
    const hemi = new THREE.HemisphereLight("#FFFFFF", "#D9D5CC", 2.25);
    scene.add(hemi);
    const key = new THREE.DirectionalLight("#FFFFFF", 1.95);
    key.castShadow = true;
    const sm = soft ? 512 : 1024;
    key.shadow.mapSize.set(sm, sm);
    Object.assign(key.shadow.camera, { left: -4.2, right: 4.2, top: 4.2, bottom: -4.2, near: 2, far: 30 });
    key.shadow.radius = soft ? 2 : 5;
    key.shadow.bias = -0.0005;
    key.shadow.normalBias = 0.018;
    key.target.position.set(0, 0.7, 1.1);
    scene.add(key, key.target);

    /* ── состояние ── */
    let scrollMode = scroll && !reduce.matches;
    let p = scrollMode ? 0 : 1, pTarget = p;
    const phiT = new Array(N).fill(0).map((_, i) => (3 + (84 * i) / (N - 1)) * D2R);
    const lift = new Float32Array(N), vis = new Float32Array(N).fill(-1);
    let hot = -1, labelHot = -1, rayHot = -1;
    let dirty = true, needFit = true, intro = reduce.matches ? 1 : 0;
    const light = { x: 0, y: 0 };
    let gyro = null;
    const fit = { ys: [], lx: 0, ox0: 0, oy0: 0, ox1: 0, oy1: 0, d0: 7.6, d1: 11, ok: false };
    const M = { tgt: new THREE.Vector3(0, 1.28, 0), az: -26, el: 9 };
    const F = { tgt: new THREE.Vector3(0, 0.72, 1.25), az: -14, el: 26 };
    const tmpT = new THREE.Vector3(), v = new THREE.Vector3(), cornerLocal = new THREE.Vector3(W / 2 - 0.03, H - 0.03, 0);
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
    let rayDirty = false;

    const pivotZ = (i, gap) => {
      const depth = N * T + (N - 1) * gap;
      return -depth / 2 + (i + 1) * T + i * gap;
    };
    const isDesk = () => desk.matches;

    /* рисуем только «грязные» кадры */
    const realRender = renderer.render.bind(renderer);
    let rendered = 0, slowSum = 0, slowN = 0, lastRenderT = -1;
    renderer.render = (s, c) => {
      if (!dirty) return;
      dirty = false;
      realRender(s, c);
      rendered++;
    };

    onResize = () => { needFit = true; dirty = true; };
    document.fonts?.ready?.then(() => { needFit = true; dirty = true; ctl?.redraw(); });

    /* ── проекция ── */
    function projPx(world) {
      v.copy(world).project(camera);
      return [(v.x + 1) / 2 * state.width, (1 - v.y) / 2 * state.height];
    }
    function cornerAt(i, phi, gap, out) {
      const z = pivotZ(i, gap);
      return out.set(cornerLocal.x, cornerLocal.y * Math.cos(phi), z + cornerLocal.y * Math.sin(phi));
    }

    function doFit() {
      needFit = false;
      const w = state.width, h = state.height;
      camera.aspect = w / h;
      camera.clearViewOffset();
      if (!isDesk()) { fit.ok = false; camera.updateProjectionMatrix(); return; }
      const rr = root.getBoundingClientRect();
      fit.ys = labels.map((li) => { const r = li.getBoundingClientRect(); return r.top + r.height / 2 - rr.top; });
      fit.lx = labels[0].getBoundingClientRect().left - rr.left;
      const copy = document.querySelector(".h-hero__copy");
      const copyRight = copy ? copy.getBoundingClientRect().right - rr.left : w * 0.42;
      if (!(fit.ys[N - 1] - fit.ys[0] > 100)) { fit.ok = false; return; }

      // монолит: крупно в свободной части экрана
      fit.d0 = H / (2 * Math.tan((FOV / 2) * D2R) * 0.66);
      placeCamera(camera, M.tgt, M.az, M.el, fit.d0);
      camera.updateProjectionMatrix();
      const c0 = projPx(M.tgt);
      const pinH = root.parentElement ? root.parentElement.clientHeight : h;
      const monoX = lerp(copyRight, w, 0.52), monoY = Math.min(h, pinH) * 0.5;
      fit.ox0 = c0[0] - monoX; fit.oy0 = c0[1] - monoY;

      // веер: разброс углов плит = высота колонки этикеток
      let d = 11;
      const a = new THREE.Vector3(), b = new THREE.Vector3();
      for (let k = 0; k < 5; k++) {
        placeCamera(camera, F.tgt, F.az, F.el, d);
        const y0 = projPx(cornerAt(0, 3 * D2R, GAP1, a))[1];
        const y1 = projPx(cornerAt(N - 1, 87 * D2R, GAP1, b))[1];
        d *= (y1 - y0) / (fit.ys[N - 1] - fit.ys[0]);
      }
      fit.d1 = d;
      placeCamera(camera, F.tgt, F.az, F.el, d);
      const y0 = projPx(cornerAt(0, 3 * D2R, GAP1, a))[1];
      const y1 = projPx(cornerAt(N - 1, 87 * D2R, GAP1, b))[1];
      fit.oy1 = (y0 + y1) / 2 - (fit.ys[0] + fit.ys[N - 1]) / 2;
      let maxX = -1e9;
      for (let i = 0; i < N; i++) {
        let lo = 1 * D2R, hi = 88 * D2R;
        for (let it = 0; it < 30; it++) {
          const mid = (lo + hi) / 2;
          if (projPx(cornerAt(i, mid, GAP1, a))[1] - fit.oy1 < fit.ys[i]) lo = mid; else hi = mid;
        }
        phiT[i] = (lo + hi) / 2;
        maxX = Math.max(maxX, projPx(cornerAt(i, phiT[i], GAP1, a))[0]);
      }
      fit.ox1 = maxX - (fit.lx - 44);
      fit.ok = true;
      leaders.setAttribute("viewBox", `0 0 ${w} ${h}`);
    }

    /* ── ввод ── */
    if (fine.matches) {
      window.addEventListener("pointermove", (e) => {
        if (!isDesk()) return;
        const r = root.getBoundingClientRect();
        if (e.clientY < r.top || e.clientY > r.bottom) { if (rayHot !== -1) { rayHot = -1; dirty = true; } return; }
        ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
        rayDirty = true;
      }, { passive: true });
    } else if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission !== "function") {
      window.addEventListener("deviceorientation", (e) => {
        if (e.gamma == null || e.beta == null) return;
        gyro = { x: Math.max(-1, Math.min(1, e.gamma / 30)), y: Math.max(-1, Math.min(1, (e.beta - 50) / 30)) };
      }, { passive: true });
    }

    /* ── API для страницы ── */
    api = {
      setTarget(v) { pTarget = clamp01(v); dirty = true; ctl?.start(); },
      snap(v) { pTarget = p = clamp01(v); dirty = true; ctl?.redraw(); },
      hover(i) { labelHot = i; dirty = true; if (reduce.matches) ctl?.redraw(); },
      setScrollMode(on) { scrollMode = on && !reduce.matches; if (!scrollMode) { p = pTarget = isDesk() ? 1 : 0; } dirty = true; ctl?.redraw(); },
      refit() { needFit = true; dirty = true; ctl?.redraw(); },
      progress: () => p,
    };

    function applyLabels(on) {
      for (let i = 0; i < N; i++) {
        const k = on ? vis[i] : 1;
        const a = labels[i].firstElementChild;
        if (!on) { a.style.opacity = ""; a.style.transform = ""; continue; }
        a.style.opacity = k.toFixed(3);
        a.style.transform = k >= 1 ? "" : `translateX(${((1 - k) * 12).toFixed(1)}px)`;
      }
      if (title) title.style.opacity = on ? Math.max(...vis).toFixed(3) : "";
    }

    let wasDesk = null;
    const lineEls = [], dotEls = [];
    for (let i = 0; i < N; i++) {
      const l = document.createElementNS("http://www.w3.org/2000/svg", "line");
      l.setAttribute("pathLength", "1"); l.style.strokeDasharray = "1"; l.style.strokeDashoffset = "1";
      const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      c.setAttribute("r", "2.2"); c.style.opacity = "0";
      leaders.append(l, c); lineEls.push(l); dotEls.push(c);
    }

    /* ── кадр ── */
    return ({ t, dt }) => {
      const desktop = isDesk();
      if (desktop !== wasDesk) { wasDesk = desktop; needFit = true; dirty = true; if (!desktop) { applyLabels(false); } if (!scrollMode) p = pTarget = desktop ? 1 : 0; }
      if (needFit) doFit();

      // вход из света
      if (intro < 1) { intro = reduce.matches ? 1 : clamp01(t / 1.8); dirty = true; }
      const ei = easeOut(intro);
      renderer.toneMappingExposure = lerp(2.6, 1, ei);
      floorMat.opacity = 0.16 * ei;
      contactMat.opacity = 0.34 * ei;

      // прогресс веера: пружина к цели, обратная прокрутка сворачивает с любого места
      if (!desktop || !fit.ok) { pTarget = 0; }
      else if (!scrollMode) pTarget = 1;
      if (Math.abs(pTarget - p) > 1e-4) { p += (pTarget - p) * (reduce.matches || !dt ? 1 : Math.min(1, dt * 6)); dirty = true; }
      else if (p !== pTarget) { p = pTarget; dirty = true; }

      // свет за курсором / гироскоп / медленный облёт
      let lx = 0, ly = 0;
      if (fine.matches) { lx = state.pointer.x; ly = state.pointer.y; }
      else if (gyro) { lx = gyro.x; ly = gyro.y; }
      else if (!soft && !reduce.matches) { lx = Math.sin((t / 24) * Math.PI * 2) * 0.9; ly = Math.sin((t / 17) * Math.PI * 2) * 0.3; }
      const kL = !dt ? 1 : Math.min(1, dt * 2.2);
      if (Math.abs(lx - light.x) + Math.abs(ly - light.y) > 1e-4) { light.x += (lx - light.x) * kL; light.y += (ly - light.y) * kL; dirty = true; }
      const la = (-48 + light.x * 38) * D2R, le = (46 + light.y * 12) * D2R;
      key.position.set(12 * Math.sin(la) * Math.cos(le), 12 * Math.sin(le), 1.1 + 12 * Math.cos(la) * Math.cos(le));

      // наведение: этикетка важнее луча
      if (rayDirty && desktop && p > 0.6) {
        rayDirty = false;
        ray.setFromCamera(ndc, camera);
        const hit = ray.intersectObjects(slabs, false)[0];
        const ni = hit ? hit.object.userData.i : -1;
        if (ni !== rayHot) { rayHot = ni; dirty = true; }
      }
      const nh = desktop && p > 0.6 ? (labelHot >= 0 ? labelHot : rayHot) : -1;
      if (nh !== hot) {
        if (hot >= 0) { labels[hot].classList.remove("is-hot"); lineEls[hot].classList.remove("is-hot"); dotEls[hot].classList.remove("is-hot"); }
        hot = nh;
        if (hot >= 0) { labels[hot].classList.add("is-hot"); lineEls[hot].classList.add("is-hot"); dotEls[hot].classList.add("is-hot"); }
      }
      const kLift = reduce.matches || !dt ? 1 : Math.min(1, dt * 14);
      for (let i = 0; i < N; i++) {
        const target = i === hot ? 1 : 0;
        if (Math.abs(target - lift[i]) > 1e-3) { lift[i] += (target - lift[i]) * kLift; dirty = true; }
        else lift[i] = target;
      }

      // дыхание камеры
      const breathe = !soft && !reduce.matches;
      if (breathe) dirty = true;
      if (!dirty) return;

      /* ── раскладка плит ── */
      const gap = lerp(GAP0, GAP1, easeOut(smooth(0, 0.14, p)));
      for (let i = 0; i < N; i++) {
        const k = N - 1 - i;
        const s = clamp01((p - (0.12 + k * 0.042)) / 0.26);
        const e = easeInOut(s);
        const m = slabs[i];
        m.position.set(0, lift[i] * 0.04, pivotZ(i, gap));
        m.rotation.x = phiT[i] * e - lift[i] * 4 * D2R * e;
        const ev = lift[i] > 0.01;
        edges[i].visible = ev;
        if (ev) edges[i].material.opacity = lift[i];
        vis[i] = smooth(0.72, 1, s);
      }
      const rs = easeInOut(smooth(0.02, 0.3, p));
      const depth = N * T + (N - 1) * gap;
      roofPivot.position.set(0, 0, pivotZ(0, gap));
      roofPivot.rotation.x = slabs[0].rotation.x;
      // крыша: над центром стопки → над задней плитой
      roof.position.set(0, H + 0.14, lerp((depth - 2 * T) / 2, -T / 2, rs));
      roof.scale.z = lerp(depth + 0.02, T + 0.02, rs);

      /* ── камера ── */
      const cp = desktop && fit.ok ? easeInOut(smooth(0, 0.92, p)) : 0;
      const amp = breathe ? 1 - cp * 0.8 : 0;
      const baz = Math.sin(t * 0.35) * 0.6 * amp, bel = Math.sin(t * 0.27) * 0.35 * amp;
      if (desktop && fit.ok) {
        tmpT.lerpVectors(M.tgt, F.tgt, cp);
        placeCamera(camera, tmpT, lerp(M.az, F.az, cp) + baz, lerp(M.el, F.el, cp) + bel, lerp(fit.d0, fit.d1, cp));
        camera.setViewOffset(state.width, state.height, lerp(fit.ox0, fit.ox1, cp), lerp(fit.oy0, fit.oy1, cp), state.width, state.height);
      } else {
        const aspect = state.width / Math.max(1, state.height);
        const dist = 9 / Math.min(1, Math.max(0.72, aspect));
        camera.clearViewOffset();
        placeCamera(camera, tmpT.set(0, 1.05, 0.6), -24 + baz, 13 + bel, dist);
      }
      camera.updateProjectionMatrix();

      /* ── этикетки и выносные линии ── */
      if (desktop && fit.ok) {
        applyLabels(true);
        for (let i = 0; i < N; i++) {
          slabs[i].updateMatrixWorld();
          const [x, y] = projPx(slabs[i].localToWorld(v.copy(cornerLocal)));
          const l = lineEls[i], c = dotEls[i];
          l.setAttribute("x1", x.toFixed(1)); l.setAttribute("y1", y.toFixed(1));
          l.setAttribute("x2", (fit.lx - 10).toFixed(1)); l.setAttribute("y2", fit.ys[i].toFixed(1));
          l.style.strokeDashoffset = (1 - vis[i]).toFixed(3);
          c.setAttribute("cx", x.toFixed(1)); c.setAttribute("cy", y.toFixed(1));
          c.style.opacity = vis[i].toFixed(3);
        }
      }

      /* ── авторегулятор разрешения ── */
      if (lastRenderT >= 0 && dt > 0) {
        slowSum += dt; slowN++;
        if (slowN >= 12) {
          if (slowSum / slowN > 0.045 && dpr > 0.42) {
            dpr = Math.max(0.42, dpr * 0.8);
            renderer.setPixelRatio(dpr);
            renderer.setSize(state.width, state.height, false);
          }
          slowSum = 0; slowN = 0;
        }
      }
      lastRenderT = t;
    };
  }
}
