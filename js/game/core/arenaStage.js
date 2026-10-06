// 전장 무대
// 3D 화면(렌더러), 조명, 반사광, 그림자, 넓은 잔디 바닥판을 준비합니다.
// 바닥판은 블록 한 칸 두께라서, 땅이 넓어질 때 둘레에 잔디 블록을 쌓은 뒤 바닥판을 키우면 이음매 없이 이어집니다.
//
//   stage.setArenaSize(칸 수)   바닥판 크기와 그림자 범위 바꾸기 (땅 넓히기 모션이 끝났을 때 씀)
//   stage.arenaSize            지금 바닥판 한 변 칸 수
// 블록 이미지 빌더의 무대(scene/stage.js)에서 조명과 바닥판 만드는 기능을 빌려 씁니다.

import * as THREE from '../../lib/three.js';
import { CONFIG } from '../../config.js';
import { createStudioLight, createBaseplate } from '../../scene/stage.js';

const GROUND_THICKNESS = 1; // 바닥판 두께 = 블록 한 칸 (둘레에 쌓는 잔디 블록과 높이가 같게)

export function createArenaStage(container, { arena, camera: cameraConfig }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.domElement.className = 'arena-canvas';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.environment = createStudioLight(renderer);
  scene.environmentIntensity = 0.6;

  const camera = new THREE.PerspectiveCamera(cameraConfig.fov, 1, 0.5, 800);

  const skyLight = new THREE.HemisphereLight(0xffffff, 0x6f7f8c, 0.75);
  const sun = new THREE.DirectionalLight(0xffffff, 2.1);
  sun.castShadow = true;
  // 휴대폰처럼 작은 화면에서는 그림자 지도를 작게 (화면에서는 차이가 거의 없고 훨씬 가벼움)
  const smallScreen = window.matchMedia('(pointer: coarse)').matches || Math.min(window.innerWidth, window.innerHeight) < 700;
  const shadowSize = smallScreen ? 1024 : 2048;
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(skyLight, sun, sun.target);

  const ground = createBaseplate(
    { color: arena.groundColor, thickness: GROUND_THICKNESS },
    { size: 1, studRadius: CONFIG.block.studRadius, studHeight: CONFIG.block.studHeight },
    { studSegments: arena.studSegments },
  );
  scene.add(ground.group);
  // 바닥판은 자기 위에만 그림자를 드리우므로 그림자 계산에서 빼서 가볍게 함 (그림자 받기는 그대로)
  const markGroundNoShadow = () => ground.group.traverse((object) => {
    object.castShadow = false;
  });

  let arenaSize = 0;
  function setArenaSize(size) {
    arenaSize = size;
    ground.resize(size, size);
    markGroundNoShadow();
    const half = size / 2;
    sun.position.set(half * 0.8, half * 2, half * 1.2);
    const shadowCam = sun.shadow.camera;
    shadowCam.left = -half - 6;
    shadowCam.right = half + 6;
    shadowCam.top = half + 6;
    shadowCam.bottom = -half - 6;
    shadowCam.near = 1;
    shadowCam.far = half * 6;
    shadowCam.updateProjectionMatrix();
  }
  setArenaSize(arena.startSize);

  const resizeHandlers = new Set();
  function resize() {
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    for (const handler of resizeHandlers) handler(width, height);
  }
  new ResizeObserver(resize).observe(container);
  resize();

  return {
    renderer,
    scene,
    camera,
    resize,
    onResize: (handler) => resizeHandlers.add(handler),
    setArenaSize,
    get arenaSize() {
      return arenaSize;
    },
    render: () => renderer.render(scene, camera),
  };
}
