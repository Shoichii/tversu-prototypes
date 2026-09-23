/* Обвязка 3D-сцен на three.js (ES-модуль). Берёт на себя всё скучное и опасное:
   DPR ≤ 1.75, ресайз, пауза вне экрана и во скрытой вкладке, reduced-motion (один статичный кадр),
   запасной вариант без WebGL, курсор/скролл как нормированные значения.

   В <head> страницы — карта импортов (путь от страницы pages/<p>/<v>/):
     <script type="importmap">{"imports":{"three":"../../../system/vendor/three/three.module.js",
       "three/addons/":"../../../system/vendor/three/addons/"}}</script>
   Разметка:
     <div class="stage" data-stage>
       <canvas aria-hidden="true"></canvas>
       <div class="stage__fallback">…статичный SVG/картинка — видна, пока сцена не запустилась…</div>
     </div>
   Скрипт:
     import * as THREE from "three";
     import { mountStage } from "../../../system/three-stage.js";
     mountStage(document.querySelector("[data-stage]"), ({ scene, camera, renderer, THREE }) => {
       // построить сцену; вернуть функцию кадра (t — секунды, dt, pointer {x,y} в -1..1, scroll 0..1 по секции)
       return ({ t, dt, pointer, scroll }) => { … };
     }, { camera: "perspective", fov: 35, alpha: true });
   Состояние .is-live на контейнере — сцена рисует; тогда CSS прячет fallback.
   В скриншотах (reduced-motion) рисуется один кадр при t=0 — сцена должна быть красивой и в покое. */
import * as THREE from "three";

export function mountStage(root, build, opts = {}) {
  const canvas = root.querySelector("canvas");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  const fine = window.matchMedia("(hover: hover) and (pointer: fine)");

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: opts.alpha !== false, powerPreference: "low-power" });
  } catch (e) {
    root.classList.add("is-nogl");
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, opts.maxDpr || 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = opts.camera === "ortho"
    ? new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100)
    : new THREE.PerspectiveCamera(opts.fov || 35, 1, 0.1, 200);
  camera.position.set(0, 0, opts.z || 10);

  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const state = { t: 0, dt: 0, pointer, scroll: 0, width: 1, height: 1, mobile: false };
  const frame = build({ scene, camera, renderer, THREE, root, state }) || (() => {});

  function resize() {
    const r = root.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    state.width = w; state.height = h; state.mobile = w < 768;
    renderer.setSize(w, h, false);
    if (camera.isPerspectiveCamera) camera.aspect = w / h;
    else { const a = w / h; camera.left = -a; camera.right = a; camera.top = 1; camera.bottom = -1; }
    camera.updateProjectionMatrix();
    opts.onResize?.(state);
    if (!running) draw(0);
  }

  function readScroll() {
    const r = root.getBoundingClientRect();
    const vh = window.innerHeight;
    state.scroll = Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height)));
  }

  let running = false, visible = false, raf = 0, last = 0;
  function draw(dt) {
    pointer.x += (pointer.tx - pointer.x) * Math.min(1, dt * 4 || 1);
    pointer.y += (pointer.ty - pointer.y) * Math.min(1, dt * 4 || 1);
    state.dt = dt;
    frame(state);
    renderer.render(scene, camera);
  }
  function loop(now) {
    raf = requestAnimationFrame(loop);
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    state.t += dt;
    readScroll();
    draw(dt);
  }
  function start() {
    if (running || reduce.matches || document.hidden || !visible) return;
    running = true; last = 0; raf = requestAnimationFrame(loop);
  }
  function stop() { running = false; cancelAnimationFrame(raf); }

  new ResizeObserver(resize).observe(root);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : stop(); }, { rootMargin: "120px" }).observe(root);
  document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
  reduce.addEventListener?.("change", () => { reduce.matches ? (stop(), draw(0)) : start(); });

  if (fine.matches) {
    window.addEventListener("pointermove", (e) => {
      const r = root.getBoundingClientRect();
      pointer.tx = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1));
      pointer.ty = Math.max(-1, Math.min(1, -(((e.clientY - r.top) / r.height) * 2 - 1)));
    }, { passive: true });
  }

  resize();
  readScroll();
  draw(0);
  root.classList.add("is-live");
  return { renderer, scene, camera, state, stop, start, redraw: () => draw(0) };
}
