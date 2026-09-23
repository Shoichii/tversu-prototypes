// Демо three-stage: сфера-«глобус» из тонких линий бренда, поворот за курсором и скроллом
import { mountStage } from "../../../system/three-stage.js";

const root = document.querySelector("[data-stage]");
mountStage(root, ({ scene, camera, THREE }) => {
  camera.position.z = 9.5;
  const group = new THREE.Group();
  scene.add(group);
  const blue = new THREE.LineBasicMaterial({ color: 0x2a3dad, transparent: true, opacity: 0.55 });
  const red = new THREE.LineBasicMaterial({ color: 0xe10447 });
  // меридианы и параллели
  for (let i = 0; i < 12; i++) {
    const c = new THREE.EllipseCurve(0, 0, 2.4, 2.4, 0, Math.PI * 2);
    const g = new THREE.BufferGeometry().setFromPoints(c.getPoints(96));
    const l = new THREE.LineLoop(g, blue);
    l.rotation.y = (i / 12) * Math.PI;
    group.add(l);
  }
  for (let j = 1; j < 8; j++) {
    const lat = -Math.PI / 2 + (j / 8) * Math.PI;
    const r = 2.4 * Math.cos(lat);
    const c = new THREE.EllipseCurve(0, 0, r, r, 0, Math.PI * 2);
    const g = new THREE.BufferGeometry().setFromPoints(c.getPoints(96).map((p) => new THREE.Vector3(p.x, 2.4 * Math.sin(lat), p.y)));
    group.add(new THREE.LineLoop(g, j === 4 ? red : blue));
  }
  group.rotation.x = 0.35;
  return ({ t, pointer, scroll }) => {
    group.rotation.y = t * 0.15 + pointer.x * 0.4;
    group.rotation.x = 0.35 - pointer.y * 0.25 + (scroll - 0.5) * 0.4;
  };
});
