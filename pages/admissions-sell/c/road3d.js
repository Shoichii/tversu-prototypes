/* admissions-sell/c — 3D-карта дороги Петербург — Тверь — Москва над ведомостью.
   Перспективная сетка из линий, по ней дорога; отрезок Тверь → выбранный город прорисовывается синим,
   второй остаётся серым пунктиром; два поезда идут навстречу; вокруг Твери расходится круг.
   Камера плывёт по скроллу и чуть наклоняется за курсором. Подписи станций (это же радиокнопки) — в HTML:
   точки на земле вычисляются из их мест в вёрстке, дальше подписи едут за проекцией.
   Грузится лениво, когда полоса близко к экрану. Без WebGL остаётся запасной слой из script.js.
   Тёмная версия (15.09): ночной вид. Цвета не зашиты — читаются из ролей темы (theme-dark.css),
   туман равен фону страницы, поэтому сетка тонет в нём без шва и без белой вспышки до первого кадра. */

const root = document.querySelector("[data-road-stage]");
const track = document.querySelector("[data-line]");

if (root && track) {
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      load();
    }, { rootMargin: "300px 0px" });
    io.observe(root);
  } else load();
}

async function load() {
  let mods;
  try {
    mods = await Promise.all([
      import("../../../system/three-stage.js"),
      import("three/addons/lines/Line2.js"),
      import("three/addons/lines/LineMaterial.js"),
      import("three/addons/lines/LineGeometry.js"),
    ]);
  } catch (e) { return; }
  const [{ mountStage }, { Line2 }, { LineMaterial }, { LineGeometry }] = mods;

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  const radios = [...track.querySelectorAll('input[name="city"]')];
  const labels = {
    spb: track.querySelector(".station--spb"),
    home: track.querySelector(".station--home"),
    msk: track.querySelector(".station--msk"),
  };
  let city = (radios.find((r) => r.checked) || {}).value || "msk";
  // прорисовка отрезков: v — текущее, from/to — твин, t0 — старт (мс)
  const seg = { spb: { v: 0, from: 0, to: 0, t0: 0 }, msk: { v: 0, from: 0, to: 0, t0: 0 } };
  seg[city].v = seg[city].from = seg[city].to = 1;

  const easeInOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2); // easeInOutCubic
  const easeOut = (p) => 1 - Math.pow(1 - p, 3);
  const clamp01 = (v) => Math.max(0, Math.min(1, v));

  const handle = mountStage(root, ({ scene, camera, THREE }) => {
    const css = getComputedStyle(document.documentElement);
    const role = (name, fallback) => new THREE.Color((css.getPropertyValue(name) || "").trim() || fallback);
    const BG = role("--c-bg", "#0a0f2c");            // туман = фон открытой ведомости
    const GRID = role("--c-line", "#2a3466");        // сетка земли
    const GREY = role("--c-line-strong", "#46518a"); // пунктир невыбранного отрезка
    const LIGHT = role("--c-blue-ink", "#a9b6ff");   // синий как свет: прорисовка и круг Твери
    const INK = role("--c-ink", "#f4f6fc");          // поезда — огни на ночной земле
    const EL0 = 0.56, R = 16;
    let scroll0 = null; // скролл в момент первого кадра: в покое подписи стоят ровно на своих местах
    scene.fog = new THREE.Fog(BG, 13, 34);

    const target = new THREE.Vector3(0, 0, 0);
    const pose = (az, el) => {
      camera.position.set(R * Math.cos(el) * Math.sin(az), R * Math.sin(el), R * Math.cos(el) * Math.cos(az));
      camera.lookAt(target);
      camera.updateMatrixWorld();
    };

    const ray = new THREE.Raycaster();
    const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const ndc = new THREE.Vector2();
    let W = 0, H = 0;
    const toGround = (px, py) => {
      ndc.set((px / W) * 2 - 1, -(py / H) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      return ray.ray.intersectPlane(ground, new THREE.Vector3());
    };

    const world = new THREE.Group();
    scene.add(world);
    let built = null;
    const N = 90; // точек на отрезок

    function dispose() {
      world.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); });
      world.clear();
    }

    function rebuild(state) {
      W = state.width; H = state.height;
      camera.aspect = W / H;
      camera.fov = state.mobile ? 30 : 26;
      camera.updateProjectionMatrix();
      pose(0, EL0);
      dispose();

      // места станций в вёрстке → точки на земле (вид в покое)
      const pad = -root.offsetLeft;
      const mapY = parseFloat(getComputedStyle(track).getPropertyValue("--map-y")) || 70;
      const base = {};
      const pts = {};
      for (const k of ["spb", "home", "msk"]) {
        const el = labels[k];
        base[k] = { x: pad + el.offsetLeft + el.offsetWidth / 2, y: mapY };
        pts[k] = toGround(base[k].x, base[k].y) || new THREE.Vector3();
      }
      const T = pts.home;

      // сетка: обрыв ближнего края — у нижней кромки холста, дальний тонет в тумане
      const g = state.mobile ? 2.4 : 2;
      const near = toGround(W / 2, H - 1);
      const zNear = near ? near.z : T.z + 2;
      const zFar = zNear - (state.mobile ? 30 : 40);
      const X = state.mobile ? 36 : 60;
      const v = [];
      const x0 = T.x - Math.ceil((X + T.x) / g) * g;
      for (let x = x0; x <= X; x += g) v.push(x, 0, zNear, x, 0, zFar);
      for (let z = T.z + Math.floor((zNear - T.z) / g) * g; z >= zFar; z -= g) v.push(-X, 0, z, X, 0, z);
      v.push(-X, 0, zNear, X, 0, zNear);
      const gridGeo = new THREE.BufferGeometry();
      gridGeo.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
      world.add(new THREE.LineSegments(gridGeo, new THREE.LineBasicMaterial({ color: GRID, fog: true })));

      // дорога: плавная линия через три станции с лёгкими изгибами между ними
      const S = pts.spb, M = pts.msk;
      const lerp = (a, b, k, dz) => new THREE.Vector3(a.x + (b.x - a.x) * k, 0, a.z + (b.z - a.z) * k + dz);
      const curve = new THREE.CatmullRomCurve3([
        S, lerp(S, T, 0.32, -2.2), lerp(S, T, 0.7, -0.5), T, lerp(T, M, 0.3, 0.3), lerp(T, M, 0.66, -1.9), M,
      ], false, "centripetal");
      const half = (dir) => {
        const arr = [];
        for (let i = 0; i <= N; i++) { const p = curve.getPoint(0.5 + dir * 0.5 * (i / N)); arr.push(p.x, 0, p.z); }
        return arr;
      };
      const res = new THREE.Vector2(W, H);
      const mkLine = (arr, mat, order) => {
        const geo = new LineGeometry();
        geo.setPositions(arr);
        const l = new Line2(geo, mat);
        l.computeLineDistances();
        l.renderOrder = order;
        world.add(l);
        return l;
      };
      const greyMat = () => new LineMaterial({ color: GREY, linewidth: 2, dashed: true, dashSize: 0.34, gapSize: 0.26, resolution: res, depthTest: false, transparent: true });
      const blueMat = () => new LineMaterial({ color: LIGHT, linewidth: state.mobile ? 3 : 3.5, resolution: res, depthTest: false, transparent: true });
      const halves = { spb: half(-1), msk: half(1) };
      mkLine(halves.spb, greyMat(), 2);
      mkLine(halves.msk, greyMat(), 2);
      const blue = { spb: mkLine(halves.spb, blueMat(), 3), msk: mkLine(halves.msk, blueMat(), 3) };

      // поезда: плоские вагончики на земле
      const trainGeo = new THREE.PlaneGeometry(state.mobile ? 1.9 : 1.6, state.mobile ? 0.55 : 0.46).rotateX(-Math.PI / 2);
      const trains = [0, 1].map(() => {
        const m = new THREE.Mesh(trainGeo, new THREE.MeshBasicMaterial({ color: INK, depthTest: false, fog: false }));
        m.renderOrder = 5;
        world.add(m);
        return m;
      });

      // Тверь: круг на земле, расходится и гаснет
      const ringPts = new THREE.EllipseCurve(0, 0, 1, 1, 0, Math.PI * 2).getPoints(64).map((p) => new THREE.Vector3(p.x, 0, p.y));
      const ring = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(ringPts),
        new THREE.LineBasicMaterial({ color: LIGHT, transparent: true, depthTest: false, fog: false }));
      ring.position.copy(T);
      ring.renderOrder = 4;
      world.add(ring);

      built = { base, pts, curve, blue, trains, ring, last: { spb: "", home: "", msk: "" } };
    }

    const proj = new THREE.Vector3();
    const tan = new THREE.Vector3();

    return (state) => {
      if (!built || state.width !== W || state.height !== H) rebuild(state);
      const { t, pointer, scroll } = state;

      if (scroll0 === null) { // первый draw в mountStage идёт до чтения скролла — считаем сами той же формулой
        const r = root.getBoundingClientRect(), vh = window.innerHeight;
        scroll0 = Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height)));
      }
      const ds = scroll - scroll0;
      pose(ds * 0.55 + pointer.x * 0.05, EL0 + ds * 0.2 + pointer.y * 0.035);

      // отрезки
      const now = performance.now();
      for (const k of ["spb", "msk"]) {
        const s = seg[k];
        const dur = s.to > s.from ? 640 : 260;
        const p = reduce.matches || !s.t0 ? 1 : clamp01((now - s.t0) / dur);
        s.v = s.from + (s.to - s.from) * (s.to > s.from ? easeInOut(p) : easeOut(p));
        const line = built.blue[k];
        line.visible = s.v > 0.01;
        line.geometry.instanceCount = Math.max(1, Math.round(s.v * N));
      }

      // поезда: навстречу друг другу по всей линии, круг ~16 с
      const u = [(0.2 + t / 16) % 1, 1 - ((0.28 + t / 16) % 1)];
      built.trains.forEach((m, i) => {
        const uu = 0.02 + u[i] * 0.96;
        built.curve.getPointAt(uu, m.position);
        built.curve.getTangentAt(uu, tan);
        m.rotation.y = -Math.atan2(tan.z, tan.x);
      });

      // круг Твери
      const k = ((t + 1.1) % 2.8) / 2.8;
      const sc = 0.45 + 1.5 * easeOut(k);
      built.ring.scale.set(sc, 1, sc);
      built.ring.material.opacity = 0.6 * (1 - k);

      // подписи станций едут за проекцией
      for (const key of ["spb", "home", "msk"]) {
        proj.copy(built.pts[key]).project(camera);
        const dx = ((proj.x + 1) / 2) * W - built.base[key].x;
        const dy = ((1 - proj.y) / 2) * H - built.base[key].y;
        const css = "translate3d(" + dx.toFixed(1) + "px," + dy.toFixed(1) + "px,0)";
        if (built.last[key] !== css) { labels[key].style.transform = css; built.last[key] = css; }
      }
    };
  }, { camera: "perspective", fov: 26, alpha: true, maxDpr: 1.5 });

  if (!handle) return;

  function select(next) {
    if (next === city) return;
    const now = performance.now();
    const prev = city;
    city = next;
    Object.assign(seg[prev], { from: seg[prev].v, to: 0, t0: now });
    Object.assign(seg[next], { from: seg[next].v, to: 1, t0: now });
    if (reduce.matches) handle.redraw();
  }
  radios.forEach((r) => r.addEventListener("change", () => select(r.value)));
}
