// 펑펑 토끼 무대
// 3D 화면(렌더러), 조명(반사광 + 하늘빛 + 햇빛 그림자), 돌기가 촘촘한 잔디 바닥판, 바닥판 바깥의 낮은 땅을 준비합니다.
// 바닥판은 한 칸 두께로 살짝 솟아 있어서 장난감 판 위에서 싸우는 느낌이 납니다.
// 바깥 땅은 아주 넓게 깔아서 카메라가 가장자리로 가도 빈 공간이 보이지 않습니다.
//
//   const stage = createFightStage(container)
//   stage.renderer / stage.scene / stage.camera          (카메라 움직임은 followCamera.js)
//   stage.render()                                      한 장면 그리기
//   stage.onResize((가로, 세로) => …)                    화면 크기가 바뀔 때마다 불림
//   stage.resize()                                      지금 크기에 맞추기 (보통 저절로 됨)
//   stage.sun / stage.smallScreen                       햇빛 / 작은 화면(휴대폰)인지
//
// 바닥판 크기·색은 fightConfig.js 의 map, 바닥판 두께는 mapLayout.js 의 plateThickness,
// 빛의 세기·방향은 아래 상수에서 바꿉니다.

import * as THREE from '../../lib/three.js';
import { CONFIG } from '../../config.js';
import { FIGHT } from '../fightConfig.js';
import { FIGHT_MAP } from '../world/mapLayout.js';
import { createStudioLight, createBaseplate } from '../../scene/stage.js';

const SKY_LIGHT = 0.8; // 하늘빛 세기 (그림자 속도 너무 어둡지 않게)
const SUN_LIGHT = 2.2; // 햇빛 세기
const SUN_DIRECTION = [0.42, 1, 0.55]; // 햇빛이 오는 쪽 (오른쪽 앞 위) → 그림자는 왼쪽 위로 짧게
const ENV_LIGHT = 0.6; // 플라스틱 반짝임 (반사광) 세기
const SHADOW_TOP = 24; // 그림자를 계산할 높이 (큰 망치 토끼 귀 끝까지)
const SHADOW_MARGIN = 3; // 바닥판 둘레로 그림자를 더 계산할 칸 수
const OUTSIDE_SIZE = 900; // 바깥 땅 크기 (카메라가 어디를 봐도 덮이게)
const OUTSIDE_STUD_SHADE = 0.22; // 바깥 땅 돌기 무늬의 밝고 어두운 정도 (0 = 무늬 없음)

export function createFightStage(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.domElement.className = 'fight-canvas';
  // 캔버스가 상자(container)를 꽉 채우게 (css 가 없어도)
  Object.assign(renderer.domElement.style, { display: 'block', width: '100%', height: '100%' });
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const outsideColor = new THREE.Color(FIGHT.map.outsideColor);
  scene.background = outsideColor.clone();
  renderer.setClearColor(outsideColor, 1);
  scene.environment = createStudioLight(renderer);
  scene.environmentIntensity = ENV_LIGHT;

  const camera = new THREE.PerspectiveCamera(FIGHT.camera.fov, 1, 1, 800);

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
  fitSunToMap(sun, FIGHT.map.width, FIGHT.map.depth);

  // 잔디 바닥판 (윗면 높이 0, 돌기는 그 위). 바닥판은 그림자를 받기만 함
  const thickness = FIGHT_MAP.plateThickness ?? 1;
  const ground = createBaseplate(
    { color: FIGHT.map.groundColor, thickness },
    { size: 1, studRadius: CONFIG.block.studRadius, studHeight: CONFIG.block.studHeight },
    { studSegments: FIGHT.map.studSegments },
  );
  ground.resize(FIGHT.map.width, FIGHT.map.depth);
  ground.group.traverse((object) => {
    object.castShadow = false;
    object.receiveShadow = true;
  });
  scene.add(ground.group);

  // 바닥판 바깥의 낮은 땅 (바닥판 밑면 높이). 돌기 무늬 그림을 깔아서 장난감 판처럼 보이게
  const studs = createStudTexture(renderer);
  const outside = new THREE.Mesh(
    new THREE.PlaneGeometry(OUTSIDE_SIZE, OUTSIDE_SIZE),
    new THREE.MeshStandardMaterial({ color: outsideColor, map: studs, roughness: 0.85, metalness: 0 }),
  );
  outside.rotation.x = -Math.PI / 2;
  outside.position.y = -thickness - 0.002;
  outside.receiveShadow = true;
  scene.add(outside);

  const resizeHandlers = new Set();
  function resize() {
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    for (const handler of resizeHandlers) handler(width, height);
  }
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(resize).observe(container);
  else window.addEventListener('resize', resize);
  resize();

  return {
    renderer,
    scene,
    camera,
    sun,
    smallScreen,
    resize,
    onResize(handler) {
      resizeHandlers.add(handler);
      return () => resizeHandlers.delete(handler);
    },
    render: () => renderer.render(scene, camera),
  };
}

// 햇빛 그림자가 바닥판 전체(+ 둘레 조금, 높이 SHADOW_TOP 까지)를 딱 덮게 맞춤
// 햇빛 쪽에서 본 바닥판 상자의 여덟 모서리를 감싸는 가장 작은 네모로 그림자 범위를 정함 → 그림자가 또렷해짐
function fitSunToMap(sun, width, depth) {
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
