// 괴수 미리보기 (그림판 옆 작은 3D 화면, 도감 카드의 작은 그림)
// 그리는 중인 그림이 통통한 블록 괴수로 어떻게 보이는지 바로 보여 줍니다. 괴수는 천천히 빙글빙글 돌며 숨을 쉬어서
// 두께가 잘 보여요. 손가락·마우스로 끌면 직접 돌려 볼 수 있고, 손을 떼고 조금 있으면 다시 혼자 돕니다.
// 그림판(WebGL)은 3D 작업대와 하나를 같이 씁니다 (sharedRenderer.js).
//
//   const preview = createMonsterPreview(el, { spin = true, drag = true, sway = false })   el: 미리보기를 넣을 상자 (크기는 css 로)
//       spin: 빙글빙글 한 바퀴씩 돎,  sway: (spin 이 꺼졌을 때) 좌우로 살랑살랑,  drag: 끌어서 돌리기
//   preview.show(design)        이 그림으로 바꿔 보여 주기 (그릴 때마다 불러도 가벼움, null 이면 비움)
//   preview.dispose()
//   renderThumb(design, { size = 192 }) → 'data:image/png…'   카드에 넣을 작은 그림 한 장 (배경 투명)
//
// 보는 각도·도는 빠르기는 아래 상수에서 바꿉니다.

import * as THREE from '../../lib/three.js';
import { createStudioLight } from '../../scene/stage.js';
import { VILLAIN } from '../villainConfig.js';
import { createMonsterFigure } from './monsterFigure.js';
import { createMonsterMotion } from './monsterMotion.js';
import { claimRenderer, ownsRenderer, releaseRenderer } from './sharedRenderer.js';

const PITCH_DEG = 24; // 내려다보는 각도 (게임보다 낮게 → 그림이 잘 보임)
const PITCH_RANGE = [4, 62]; // 끌어서 바꿀 수 있는 내려다보는 각도 범위
const SWAY = 0.55; // 좌우로 도는 폭 (라디안)
const SWAY_SPEED = 0.9;
const SPIN_SPEED = 0.55; // 혼자 도는 빠르기 (라디안/초, 약 11초에 한 바퀴)
const START_TURN = -0.5; // 처음 보이는 각도 (살짝 돌아서 옆 두께가 보이게)
const DRAG_TURN = 0.012; // 끌 때 1픽셀마다 도는 양
const RESUME_SECONDS = 2.2; // 손을 뗀 뒤 다시 혼자 돌기까지
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
function frame(view, model, aspect, pitchDeg = PITCH_DEG) {
  const width = Math.max(4, model.width + 5); // 부품이 옆으로 삐져나올 자리
  const height = Math.max(4, model.height + 1.5);
  const radius = Math.max(3, model.width * 0.5 + 2.5);
  view.base.scale.set(radius, 1, radius);
  const pitch = (pitchDeg * Math.PI) / 180;
  const half = Math.tan((view.camera.fov * Math.PI) / 360);
  const distance = (Math.max(height / 2, width / 2 / aspect, (radius * 0.95) / aspect) * MARGIN) / half + radius * 0.5;
  const lookY = height * 0.4;
  view.camera.aspect = aspect;
  view.camera.position.set(0, lookY + Math.sin(pitch) * distance, Math.cos(pitch) * distance);
  view.camera.lookAt(0, lookY, 0);
  view.camera.updateProjectionMatrix();
}

export function createMonsterPreview(el, { spin = true, drag = true, sway = false } = {}) {
  const renderer = claimRenderer(el);
  const view = createScene(renderer);
  let figure = null;
  let motion = null;
  let disposed = false;
  let raf = 0;
  let last = 0;
  let time = 0;
  let aspect = 1;
  let turn = START_TURN;
  let pitchDeg = PITCH_DEG;
  let grab = null; // 끌고 있는 손가락 { id, x, y }
  let idle = RESUME_SECONDS; // 손을 뗀 뒤 지난 시간
  let spinRate = 1;

  function resize() {
    if (!ownsRenderer(el)) return; // 3D 작업대가 그림판을 쓰는 중
    const width = Math.max(1, el.clientWidth);
    const height = Math.max(1, el.clientHeight);
    renderer.setSize(width, height, false);
    aspect = width / height;
    if (figure) frame(view, figure.model, aspect, pitchDeg);
  }
  const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
  observer?.observe(el);

  function show(design) {
    figure?.dispose();
    figure = null;
    view.base.visible = false;
    if (!design) return ownsRenderer(el) && renderer.render(view.scene, view.camera);
    figure = createMonsterFigure(view.scene, design);
    figure.attachAll();
    motion = createMonsterMotion(figure.model);
    motion.bounce(1.4); // 바뀔 때마다 통!
    view.base.visible = figure.model.cellCount > 0;
    resize();
  }

  // ── 끌어서 돌리기 ──
  function onDown(event) {
    if (!drag || grab || (event.pointerType === 'mouse' && event.button !== 0)) return;
    grab = { id: event.pointerId, x: event.clientX, y: event.clientY };
    el.setPointerCapture?.(event.pointerId);
    el.classList.add('is-turning');
  }
  function onMove(event) {
    if (!grab || event.pointerId !== grab.id) return;
    event.preventDefault();
    turn += (event.clientX - grab.x) * DRAG_TURN;
    pitchDeg = Math.min(PITCH_RANGE[1], Math.max(PITCH_RANGE[0], pitchDeg + (event.clientY - grab.y) * 0.35));
    grab.x = event.clientX;
    grab.y = event.clientY;
    idle = 0;
    spinRate = 0;
    if (figure) frame(view, figure.model, aspect, pitchDeg);
  }
  function onUp(event) {
    if (!grab || event.pointerId !== grab.id) return;
    grab = null;
    idle = 0;
    el.classList.remove('is-turning');
  }
  const listeners = [['pointerdown', onDown], ['pointermove', onMove], ['pointerup', onUp], ['pointercancel', onUp]];
  for (const [name, fn] of listeners) el.addEventListener(name, fn);
  if (drag) el.style.touchAction = 'none';

  function tick(now) {
    if (disposed) return;
    raf = requestAnimationFrame(tick);
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    if (!figure || !el.isConnected || el.offsetParent === null) return; // 안 보일 때는 쉼
    if (!ownsRenderer(el)) {
      claimRenderer(el); // 3D 작업대에서 돌아왔으면 그림판을 다시 가져옴
      resize();
    }
    time += dt;
    if (!grab) idle += dt;
    if (spin) {
      if (!grab && idle >= RESUME_SECONDS) spinRate = Math.min(1, spinRate + dt * 0.8); // 스르르 다시 돎
      turn += SPIN_SPEED * spinRate * dt;
    }
    motion.step(dt, null);
    motion.apply(figure.fig.parts.body);
    figure.fig.root.rotation.y = spin || !sway ? turn : turn + Math.sin(time * SWAY_SPEED) * SWAY;
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
      for (const [name, fn] of listeners) el.removeEventListener(name, fn);
      figure?.dispose();
      view.base.geometry.dispose();
      view.base.material.dispose();
      releaseRenderer(el);
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
