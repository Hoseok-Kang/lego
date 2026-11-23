// 악당 타이쿤 무대
// 3D 화면(렌더러), 조명(반사광 + 하늘빛 + 햇빛 그림자), 돌기가 촘촘한 마을 바닥판, 바닥판 바깥의 낮은 땅을 준비합니다.
// 바닥판은 한 칸 두께로 솟아 있어서 장난감 판 위에 마을이 놓인 것처럼 보입니다.
// 카메라 움직임(마을 전체가 화면에 들어오게 맞추기, 흔들기)은 townCamera.js 가 맡고, 여기서 함께 만들어 stage.view 로 내줍니다.
//
//   const stage = createVillainStage(container)
//   stage.renderer / stage.scene / stage.camera
//   stage.view                       마을 카메라 (townCamera.js): setInsets, setFocus, shake, worldToScreen …
//   stage.update(dt)                 카메라 움직임 한 장면 (stage.view.update 와 같음)
//   stage.render()                   한 장면 그리기
//   stage.onResize((가로, 세로) => …)  화면 크기가 바뀔 때마다 불림 → 그만 듣기 함수를 돌려줌
//   stage.resize()                   지금 크기에 맞추기 (보통 저절로 됨)
//   stage.sun / stage.smallScreen    햇빛 / 작은 화면(휴대폰)인지
//   stage.bounds                     바닥판 범위 { minX, maxX, minZ, maxZ } (잔해 벽으로 쓰기 좋음)
//   stage.dispose()
//
// 바닥판 크기·색은 villainConfig.js 의 town, 카메라 각도는 villainConfig.js 의 camera,
// 바깥 땅 색·빛의 세기·방향은 아래 상수에서 바꿉니다.

import * as THREE from '../../lib/three.js';
import { CONFIG } from '../../config.js';
import { VILLAIN } from '../villainConfig.js';
import { createStudioLight, createBaseplate } from '../../scene/stage.js';
import { createTownCamera } from './townCamera.js';

const OUTSIDE_COLOR = '#237841'; // 바닥판 바깥 땅 색 (짙은 초록 블록 색)
const PLATE_THICKNESS = 1; // 바닥판 두께 (칸)
const STUD_SEGMENTS = 8; // 바닥 돌기 둘레 조각 수 (작을수록 가벼움)
const MAX_PIXEL_RATIO = 2; // 화면 선명도 최대 배율 (휴대폰이 버벅이면 1.5 로)
const SKY_LIGHT = 0.8; // 하늘빛 세기 (그림자 속도 너무 어둡지 않게)
const SUN_LIGHT = 2.2; // 햇빛 세기
const SUN_DIRECTION = [0.42, 1, 0.55]; // 햇빛이 오는 쪽 (오른쪽 앞 위) → 그림자는 왼쪽 뒤로 짧게
const ENV_LIGHT = 0.6; // 플라스틱 반짝임 (반사광) 세기
const SHADOW_TOP = 30; // 그림자를 계산할 높이 (높은 탑 꼭대기 + 뛰어오른 영웅까지)
const SHADOW_MARGIN = 3; // 바닥판 둘레로 그림자를 더 계산할 칸 수
const OUTSIDE_SIZE = 900; // 바깥 땅 크기 (카메라가 어디를 봐도 덮이게)
const OUTSIDE_STUD_SHADE = 0.22; // 바깥 땅 돌기 무늬의 밝고 어두운 정도 (0 = 무늬 없음)

export function createVillainStage(container) {
  const town = VILLAIN.town;
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.domElement.className = 'villain-canvas';
  // 캔버스가 상자(container)를 꽉 채우게 (css 가 없어도)
  Object.assign(renderer.domElement.style, { display: 'block', width: '100%', height: '100%' });
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const outsideColor = new THREE.Color(OUTSIDE_COLOR);
  scene.background = outsideColor.clone();
  renderer.setClearColor(outsideColor, 1);
  const envTexture = createStudioLight(renderer);
  scene.environment = envTexture;
  scene.environmentIntensity = ENV_LIGHT;

  const camera = new THREE.PerspectiveCamera(VILLAIN.camera.fov, 1, 1, 800);

  // 빛: 하늘빛(위는 하양, 아래는 풀빛) + 그림자를 만드는 햇빛
  const skyLight = new THREE.HemisphereLight(0xffffff, 0x5f7f5a, SKY_LIGHT);
  const sun = new THREE.DirectionalLight(0xffffff, SUN_LIGHT);
  sun.castShadow = true;
  // 휴대폰처럼 작은 화면에서는 그림자 지도를 작게 (화면에서는 차이가 거의 없고 훨씬 가벼움)
  const smallScreen = matchesCoarse() || Math.min(window.innerWidth, window.innerHeight) < 700;
  const shadowSize = smallScreen ? 1024 : 2048;
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.04;
  scene.add(skyLight, sun, sun.target);
  fitSunToPlate(sun, town.width, town.depth);

  // 마을 바닥판 (윗면 높이 0, 돌기는 그 위). 바닥판은 그림자를 받기만 함
  const ground = createBaseplate(
    { color: town.groundColor, thickness: PLATE_THICKNESS },
    { size: 1, studRadius: CONFIG.block.studRadius, studHeight: CONFIG.block.studHeight },
    { studSegments: STUD_SEGMENTS },
  );
  ground.resize(town.width, town.depth);
  ground.group.traverse((object) => {
    object.castShadow = false;
    object.receiveShadow = true;
  });
  scene.add(ground.group);

  // 바닥판 바깥의 낮은 땅 (바닥판 밑면 높이). 돌기 무늬 그림을 깔아서 큰 장난감 판처럼 보이게
  const studs = createStudTexture(renderer);
  const outside = new THREE.Mesh(
    new THREE.PlaneGeometry(OUTSIDE_SIZE, OUTSIDE_SIZE),
    new THREE.MeshLambertMaterial({ color: outsideColor, map: studs }),
  );
  outside.rotation.x = -Math.PI / 2;
  outside.position.y = -PLATE_THICKNESS - 0.002;
  outside.receiveShadow = true;
  scene.add(outside);

  const view = createTownCamera(camera, renderer.domElement, {
    width: town.width,
    depth: town.depth,
    fov: VILLAIN.camera.fov,
    pitchDeg: VILLAIN.camera.pitchDeg,
  });

  const resizeHandlers = new Set();
  function resize() {
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    view.snap(); // 화면 모양이 바뀌면 바로 새 자리로
    for (const handler of resizeHandlers) handler(width, height);
  }
  let observer = null;
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(resize);
    observer.observe(container);
  } else window.addEventListener('resize', resize);
  resize();

  return {
    renderer,
    scene,
    camera,
    view,
    sun,
    smallScreen,
    bounds: { minX: -town.width / 2, maxX: town.width / 2, minZ: -town.depth / 2, maxZ: town.depth / 2 },
    resize,
    onResize(handler) {
      resizeHandlers.add(handler);
      return () => resizeHandlers.delete(handler);
    },
    update: (dt) => view.update(dt),
    render: () => renderer.render(scene, camera),
    dispose() {
      observer?.disconnect();
      window.removeEventListener('resize', resize);
      envTexture.dispose?.();
      studs.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

// 햇빛 그림자가 바닥판 전체(+ 둘레 조금, 높이 SHADOW_TOP 까지)를 딱 덮게 맞춤
// 햇빛 쪽에서 본 바닥판 상자의 여덟 모서리를 감싸는 가장 작은 네모로 그림자 범위를 정함 → 그림자가 또렷해짐
function fitSunToPlate(sun, width, depth) {
  const halfW = width / 2 + SHADOW_MARGIN;
  const halfD = depth / 2 + SHADOW_MARGIN;
  const direction = new THREE.Vector3(...SUN_DIRECTION).normalize();
  const distance = Math.hypot(halfW, halfD, SHADOW_TOP) * 2;
  sun.target.position.set(0, 0, 0);
  sun.position.copy(direction).multiplyScalar(distance);
  sun.updateMatrixWorld();
  sun.target.updateMatrixWorld();

  const shadowCamera = sun.shadow.camera;
  shadowCamera.position.copy(sun.position);
  shadowCamera.lookAt(sun.target.position);
  shadowCamera.updateMatrixWorld();
  const toLight = shadowCamera.matrixWorldInverse;
  const corner = new THREE.Vector3();
  const min = new THREE.Vector3(Infinity, Infinity, Infinity);
  const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  for (let i = 0; i < 8; i++) {
    corner.set(i & 1 ? halfW : -halfW, i & 2 ? SHADOW_TOP : -1, i & 4 ? halfD : -halfD).applyMatrix4(toLight);
    min.min(corner);
    max.max(corner);
  }
  shadowCamera.left = min.x;
  shadowCamera.right = max.x;
  shadowCamera.bottom = min.y;
  shadowCamera.top = max.y;
  shadowCamera.near = Math.max(0.1, -max.z - 1);
  shadowCamera.far = -min.z + 1;
  shadowCamera.updateProjectionMatrix();
}

// 돌기 한 칸 무늬 (가운데 동그란 돌기: 위쪽은 밝게, 아래쪽은 그림자) → 바깥 땅에 칸마다 반복
// 색은 재질 색(바깥 땅 색)에 곱해지므로 여기서는 밝기만 그림
function createStudTexture(renderer) {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d');
  const base = Math.round(255 * (1 - OUTSIDE_STUD_SHADE));
  g.fillStyle = `rgb(${base},${base},${base})`;
  g.fillRect(0, 0, size, size);
  const r = size * CONFIG.block.studRadius;
  const c = size / 2;
  const shade = (k) => `rgb(${Math.round(base * k)},${Math.round(base * k)},${Math.round(base * k)})`;
  g.fillStyle = shade(0.8); // 돌기 아래 그림자 (오른쪽 아래로 살짝)
  g.beginPath();
  g.arc(c + r * 0.14, c + r * 0.24, r * 1.02, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = shade(1.1); // 돌기 윗면 (바닥보다 조금 밝게)
  g.beginPath();
  g.arc(c, c, r, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.55)'; // 왼쪽 위 테두리 반짝임
  g.lineWidth = size * 0.035;
  g.beginPath();
  g.arc(c, c, r * 0.86, Math.PI * 0.95, Math.PI * 1.6);
  g.stroke();
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(OUTSIDE_SIZE, OUTSIDE_SIZE); // 한 칸 = 블록 한 칸 (돌기가 .5 자리에 옴)
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return texture;
}

function matchesCoarse() {
  try {
    return window.matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}
