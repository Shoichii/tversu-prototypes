/* «129 программ»: гипсовая колоннада из 6 колонн-направлений. Ствол собран из барабанов,
   один барабан = две программы (пример). Барабаны падают стопками, когда сцена входит в экран;
   выбор направления ведёт камеру к колонне пружиной — новый клик перехватывает движение с текущей точки. */
import * as THREE from "three";
import { mountStage } from "../../../system/three-stage.js";
import { isSoftwareGL, contactTexture } from "./hero.js";

const D2R = Math.PI / 180;
const FOV = 26;
const AZ = 12, EL = 13;                       // обзорный ракурс
const DR = 0.7, DH = 0.15, DG = 0.014;        // барабан ствола: диаметр, высота, шов
const PW = 0.92, PHt = 0.12;                  // плинт
const TD = 0.8, TH = 0.05;                    // валик базы и эхин капители
const AW = 0.98, AH = 0.085;                  // абака
const STEP = 1.3;                             // шаг колонн вдоль ряда
const ROW = -36 * D2R;                        // ряд уходит вглубь вправо

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

export function columnPlates(n) { return Math.max(3, Math.round(n / 2)); }

export function initColonnade(root, dirs, { selected = 0, focused = false } = {}) {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
  let api = { select() {} };
  let onResize = () => {};
  root.setAttribute("data-stage", "");
  const ctl = mountStage(root, (ctx) => build(ctx), { fov: FOV, alpha: true, maxDpr: 1.5, onResize: (s) => onResize(s) });
  if (!ctl) return null;
  return api;

  function build({ scene, camera, renderer, state }) {
    const soft = isSoftwareGL(renderer);
    renderer.setPixelRatio(soft ? 0.55 : Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    camera.fov = FOV; camera.near = 0.5; camera.far = 80;

    /* ── колонны ── */
    const cols = dirs.map((d, i) => {
      const s = (i - (dirs.length - 1) / 2) * STEP;
      const n = columnPlates(d.count);
      const height = PHt + TH + n * (DH + DG) + TH + AH;
      return { x: s * Math.cos(ROW), z: s * Math.sin(ROW), n, height };
    });
    const drums = [], blocks = [];
    cols.forEach((c, ci) => {
      let y = 0, k = 0;
      blocks.push({ ci, k: k++, y: PHt / 2, sx: PW, sy: PHt, c: "#E6E4DE" }); y = PHt;
      drums.push({ ci, k: k++, y: y + TH / 2, sx: TD, sy: TH, c: "#EEEDE8" }); y += TH;
      for (let j = 0; j < c.n; j++) { drums.push({ ci, k: k++, y: y + DG / 2 + DH / 2, sx: DR, sy: DH, c: j % 2 ? "#F1F0EB" : "#F4F3EF" }); y += DH + DG; }
      drums.push({ ci, k: k++, y: y + TH / 2, sx: TD, sy: TH, c: "#EEEDE8" }); y += TH;
      blocks.push({ ci, k: k++, y: y + AH / 2, sx: AW, sy: AH, c: "#E9E7E1" });
    });

    const plaster = new THREE.MeshStandardMaterial({ color: "#FFFFFF", roughness: 0.93, metalness: 0 });
    const mkInst = (geo, parts) => {
      const m = new THREE.InstancedMesh(geo, plaster, parts.length);
      m.castShadow = true; m.receiveShadow = true;
      const col = new THREE.Color();
      parts.forEach((p, i) => m.setColorAt(i, col.set(p.c)));
      scene.add(m);
      return m;
    };
    const drumMesh = mkInst(new THREE.CylinderGeometry(0.5, 0.5, 1, soft ? 16 : 28), drums);
    const box = new THREE.BoxGeometry(1, 1, 1);
    const blockMesh = mkInst(box, blocks);

    const rowLen = STEP * (dirs.length - 1) + 1.6;
    const stylo = new THREE.Mesh(new THREE.BoxGeometry(rowLen, 0.18, 1.5), new THREE.MeshStandardMaterial({ color: "#E3E1DB", roughness: 0.96 }));
    stylo.position.set(0, -0.09, 0); stylo.rotation.y = -ROW;
    stylo.receiveShadow = true; stylo.castShadow = true;
    scene.add(stylo);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.13, color: "#3A372F" }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -0.181;
    floor.receiveShadow = true;
    scene.add(floor);
    const contact = new THREE.Mesh(new THREE.PlaneGeometry(rowLen + 1.2, 2.6), new THREE.MeshBasicMaterial({ color: "#35322B", alphaMap: contactTexture(0.6), transparent: true, opacity: 0.28, depthWrite: false }));
    contact.rotation.x = -Math.PI / 2; contact.rotation.z = -ROW; contact.position.y = -0.178;
    scene.add(contact);

    /* ── свет: тот же, что у монолита, плюс слабая подсветка теневой стороны ── */
    scene.add(new THREE.HemisphereLight("#FFFFFF", "#D9D5CC", 2.25));
    const key = new THREE.DirectionalLight("#FFFFFF", 1.85);
    key.position.set(-6, 9, 7);
    key.castShadow = true;
    const sm = soft ? 512 : 1024;
    key.shadow.mapSize.set(sm, sm);
    Object.assign(key.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5, near: 2, far: 40 });
    key.shadow.radius = soft ? 2 : 4;
    key.shadow.bias = -0.0005; key.shadow.normalBias = 0.02;
    scene.add(key);
    const fill = new THREE.DirectionalLight("#FFFFFF", 0.5);
    fill.position.set(7, 3, 5);
    scene.add(fill);

    /* ── синяя кромка выбранной колонны: плинт и абака ── */
    const edgeMat = new THREE.LineBasicMaterial({ color: "#2A3DAD", transparent: true, opacity: 0 });
    const edgeGeo = new THREE.EdgesGeometry(box);
    const capEdge = new THREE.LineSegments(edgeGeo, edgeMat);
    const baseEdge = new THREE.LineSegments(edgeGeo, edgeMat);
    capEdge.scale.set(AW + 0.006, AH + 0.006, AW + 0.006);
    baseEdge.scale.set(PW + 0.006, PHt + 0.006, PW + 0.006);
    capEdge.rotation.y = baseEdge.rotation.y = -ROW;
    scene.add(capEdge, baseEdge);

    /* ── состояние ── */
    let sel = selected, focus = focused, dirty = true, t0 = -1, dropDone = reduce.matches, placed = false;
    let edgeK = focused ? 1 : 0;
    const ov = { x: 0, y: 1, z: 0, dist: 14 };
    const cam = { x: 0, y: 1, z: 0, az: AZ, el: EL, dist: 14 };
    const goal = { ...cam };
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -ROW, 0));
    const pos = new THREE.Vector3(), scl = new THREE.Vector3(), tgt = new THREE.Vector3(), v = new THREE.Vector3();
    const right = new THREE.Vector3(), up = new THREE.Vector3();
    const maxH = Math.max(...cols.map((c) => c.height));

    const realRender = renderer.render.bind(renderer);
    renderer.render = (s, c) => { if (!dirty) return; dirty = false; realRender(s, c); };

    function place(t, az, el, dist) {
      const a = az * D2R, e = el * D2R;
      camera.position.set(t.x + dist * Math.sin(a) * Math.cos(e), t.y + dist * Math.sin(e), t.z + dist * Math.cos(a) * Math.cos(e));
      camera.lookAt(t);
      camera.updateMatrixWorld();
    }

    /* обзор: подбираем цель и дистанцию так, чтобы вся колоннада с плинтами вписалась в кадр */
    const corners = [];
    cols.forEach((c) => {
      for (const y of [-0.18, c.height]) for (const dx of [-0.6, 0.6]) for (const dz of [-0.6, 0.6]) corners.push(new THREE.Vector3(c.x + dx, y, c.z + dz));
    });
    function fitOverview() {
      camera.aspect = state.width / Math.max(1, state.height);
      camera.clearViewOffset();
      camera.updateProjectionMatrix();
      tgt.set(0, maxH * 0.45, 0);
      let d = 14;
      for (let it = 0; it < 7; it++) {
        place(tgt, AZ, EL, d);
        let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
        for (const p of corners) {
          v.copy(p).project(camera);
          x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
        }
        const halfH = d * Math.tan((FOV / 2) * D2R), halfW = halfH * camera.aspect;
        right.setFromMatrixColumn(camera.matrixWorld, 0);
        up.setFromMatrixColumn(camera.matrixWorld, 1);
        tgt.addScaledVector(right, ((x0 + x1) / 2) * halfW).addScaledVector(up, ((y0 + y1) / 2) * halfH);
        d *= Math.max((x1 - x0) / 2 / 0.84, (y1 - y0) / 2 / 0.78);
      }
      Object.assign(ov, { x: tgt.x, y: tgt.y, z: tgt.z, dist: d });
    }

    function setGoal() {
      const c = cols[sel];
      if (focus) {
        const near = (maxH * 1.5) / (2 * Math.tan((FOV / 2) * D2R) * Math.min(1, camera.aspect * 1.1));
        Object.assign(goal, { x: c.x, y: c.height * 0.5, z: c.z, az: AZ + (sel - 2.5) * 2, el: 11, dist: Math.max(ov.dist * 0.56, near) });
      } else Object.assign(goal, { x: ov.x, y: ov.y, z: ov.z, az: AZ, el: EL, dist: ov.dist });
    }
    function placeEdges() {
      const c = cols[sel];
      capEdge.position.set(c.x, c.height - AH / 2, c.z);
      baseEdge.position.set(c.x, PHt / 2, c.z);
    }

    fitOverview(); setGoal(); Object.assign(cam, goal); placeEdges();
    onResize = () => { fitOverview(); setGoal(); Object.assign(cam, goal); dirty = true; };

    api = {
      select(i, instant = false) {
        if (i !== sel || !focus) edgeK = 0;
        sel = i; focus = true;
        setGoal(); placeEdges();
        if (instant || reduce.matches) { Object.assign(cam, goal); edgeK = 1; }
        dirty = true; ctl?.start(); ctl?.redraw();
      },
    };

    function layout(mesh, parts, time) {
      let moving = false;
      parts.forEach((p, i) => {
        const c = cols[p.ci];
        let y = p.y;
        if (time < 99) {
          const s = clamp01((time - (p.ci * 0.08 + p.k * 0.032)) / 0.6);
          if (s < 1) moving = true;
          y += (1 - easeOut(s)) * 3.2;
        }
        pos.set(c.x, y, c.z);
        scl.set(p.sx, p.sy, p.sx);
        mesh.setMatrixAt(i, m4.compose(pos, q, scl));
      });
      mesh.instanceMatrix.needsUpdate = true;
      return moving;
    }

    return ({ t, dt }) => {
      if (!dropDone) {
        if (t0 < 0) t0 = t;
        const a = layout(drumMesh, drums, t - t0), b = layout(blockMesh, blocks, t - t0);
        if (!a && !b) dropDone = true;
        dirty = true;
      } else if (!placed) {
        layout(drumMesh, drums, 99); layout(blockMesh, blocks, 99);
        placed = true; dirty = true;
      }

      // камера: критически затухающая пружина к цели
      const k = reduce.matches || !dt ? 1 : 1 - Math.exp(-dt * 3.2);
      for (const key of ["x", "y", "z", "az", "el", "dist"]) {
        const d = goal[key] - cam[key];
        if (Math.abs(d) > 1e-4) { cam[key] += d * k; dirty = true; } else cam[key] = goal[key];
      }
      const eTarget = focus ? 1 : 0;
      if (edgeK !== eTarget) { edgeK = reduce.matches || !dt ? eTarget : Math.min(1, edgeK + dt / 0.22); dirty = true; }
      edgeMat.opacity = edgeK;
      capEdge.visible = baseEdge.visible = edgeK > 0.01;

      if (!dirty) return;
      place(tgt.set(cam.x, cam.y, cam.z), cam.az, cam.el, cam.dist);
    };
  }
}
