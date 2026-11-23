// 괴수 미리보기 (그림판 옆 작은 3D 화면, 도감 카드의 작은 그림)
// 그리는 중인 그림이 통통한 블록 괴수로 어떻게 보이는지 바로 보여 줍니다. 괴수는 좌우로 살랑살랑 돌며 숨을 쉽니다.
//
//   const preview = createMonsterPreview(el, { sway = true })   el: 미리보기를 넣을 상자 (크기는 css 로)
//   preview.show(design)        이 그림으로 바꿔 보여 주기 (그릴 때마다 불러도 가벼움, null 이면 비움)
//   preview.dispose()
//   renderThumb(design, { size = 192 }) → 'data:image/png…'   카드에 넣을 작은 그림 한 장 (배경 투명)
//
// 보는 각도·도는 폭은 아래 상수에서 바꿉니다.

import * as THREE from '../../lib/three.js';
import { createStudioLight } from '../../scene/stage.js';
import { VILLAIN } from '../villainConfig.js';
import { createMonsterFigure } from './monsterFigure.js';
import { createMonsterMotion } from './monsterMotion.js';

const PITCH_DEG = 24; // 내려다보는 각도 (게임보다 낮게 → 그림이 잘 보임)
const SWAY = 0.55; // 좌우로 도는 폭 (라디안)
const SWAY_SPEED = 0.9;
const THUMB_TURN = -0.45; // 카드 그림에서 살짝 돌아선 각도
const MARGIN = 1.26; // 화면 가장자리 여유

function createScene(renderer) {
  const scene = new THREE.Scene();
  scene.environment = createStudioLight(renderer);
  scene.environmentIntensity = 0.6;
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.position.set(14, 30, 22);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.04;
  Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 20, bottom: -8, near: 1, far: 90 });
  scene.add(new THREE.HemisphereLight(0xffffff, 0x5f7f5a, 0.9), sun, sun.target);
  // 발밑 동그란 잔디 판 (그림자가 떨어져서 서 있는 느낌)
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(1, 1, 0.5, 40),
    new THREE.MeshStandardMaterial({ color: VILLAIN.town.groundColor, roughness: 0.6 }),
  );
  base.position.y = -0.25;
  base.receiveShadow = true;
  scene.add(base);
  const camera = new THREE.PerspectiveCamera(VILLAIN.camera.fov, 1, 0.5, 400);
  return { scene, camera, base };
}

// 괴수 전체가 화면에 들어오게 카메라·바닥 판 맞추기
function frame(view, model, aspect) {
  const width = Math.max(4, model.width + 5); // 부품이 옆으로 삐져나올 자리
  const height = Math.max(4, model.height + 1.5);
  const radius = Math.max(3, model.width * 0.5 + 2.5);
  view.base.scale.set(radius, 1, radius);
  const pitch = (PITCH_DEG * Math.PI) / 180;
  const half = Math.tan((view.camera.fov * Math.PI) / 360);
  const distance = (Math.max(height / 2, width / 2 / aspect, (radius * 0.95) / aspect) * MARGIN) / half + radius * 0.5;
  const lookY = height * 0.4;
  view.camera.aspect = aspect;
  view.camera.position.set(0, lookY + Math.sin(pitch) * distance, Math.cos(pitch) * distance);
  view.camera.lookAt(0, lookY, 0);
  view.camera.updateProjectionMatrix();
}

export function createMonsterPreview(el, { sway = true } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.NeutralToneMapping;
  Object.assign(renderer.domElement.style, { display: 'block', width: '100%', height: '100%' });
  el.appendChild(renderer.domElement);
  const view = createScene(renderer);
  let figure = null;
  let motion = null;
  let disposed = false;
  let raf = 0;
  let last = 0;
  let time = 0;
  let aspect = 1;

  function resize() {
    const width = Math.max(1, el.clientWidth);
    const height = Math.max(1, el.clientHeight);
    renderer.setSize(width, height, false);
    aspect = width / height;
    if (figure) frame(view, figure.model, aspect);
  }
  const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  observer?.observe(el);

  function show(design) {
    figure?.dispose();
    figure = null;
    view.base.visible = false;
    if (!design) return renderer.render(view.scene, view.camera);
    figure = createMonsterFigure(view.scene, design);
    figure.attachAll();
    motion = createMonsterMotion(figure.model);
    motion.bounce(1.4); // 바뀔 때마다 통!
    view.base.visible = figure.model.cellCount > 0;
    resize();
  }

  function tick(now) {
    if (disposed) return;
    raf = requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    if (!figure || !el.isConnected || el.offsetParent === null) return; // 안 보일 때는 쉼
    time += dt;
    motion.step(dt, null);
    motion.apply(figure.fig.parts.body);
    figure.fig.root.rotation.y = sway ? Math.sin(time * SWAY_SPEED) * SWAY : 0;
    figure.fig.update();
    renderer.render(view.scene, view.camera);
  }
  resize();
  raf = requestAnimationFrame(tick);

  return {
    show,
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      observer?.disconnect();
      figure?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

// 카드용 작은 그림: 숨은 화면 하나를 돌려 쓰며 한 장씩 찍음
let thumb = null;
export function renderThumb(design, { size = 192 } = {}) {
  if (!thumb) {
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    renderer.setClearColor(0x000000, 0);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.NeutralToneMapping;
    thumb = { renderer, view: createScene(renderer) };
  }
  const { renderer, view } = thumb;
  renderer.setPixelRatio(1);
  renderer.setSize(size, size, false);
  const figure = createMonsterFigure(view.scene, design);
  figure.attachAll();
  view.base.visible = figure.model.cellCount > 0;
  frame(view, figure.model, 1);
  figure.fig.root.rotation.y = THUMB_TURN;
  figure.fig.update();
  renderer.render(view.scene, view.camera);
  const url = renderer.domElement.toDataURL('image/png');
  figure.dispose();
  return url;
}
