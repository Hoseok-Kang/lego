// 전장 무대
// 3D 화면(렌더러), 조명, 반사광, 그림자, 넓은 잔디 바닥판을 준비합니다.
// 블록 이미지 빌더의 무대(scene/stage.js)에서 조명과 바닥판 만드는 기능을 빌려 씁니다.

import * as THREE from '../../lib/three.js';
import { CONFIG } from '../../config.js';
import { createStudioLight, createBaseplate } from '../../scene/stage.js';

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

  const half = arena.size / 2;
  const skyLight = new THREE.HemisphereLight(0xffffff, 0x6f7f8c, 0.75);
  const sun = new THREE.DirectionalLight(0xffffff, 2.1);
  sun.position.set(half * 0.8, half * 2, half * 1.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  const shadowCam = sun.shadow.camera;
  shadowCam.left = -half - 6;
  shadowCam.right = half + 6;
  shadowCam.top = half + 6;
  shadowCam.bottom = -half - 6;
  shadowCam.near = 1;
  shadowCam.far = half * 6;
  shadowCam.updateProjectionMatrix();
  scene.add(skyLight, sun, sun.target);

  const ground = createBaseplate(
    { color: arena.groundColor, thickness: 0.4 },
    { size: 1, studRadius: CONFIG.block.studRadius, studHeight: CONFIG.block.studHeight },
    { studSegments: arena.studSegments },
  );
  ground.resize(arena.size, arena.size);
  scene.add(ground.group);

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
    render: () => renderer.render(scene, camera),
  };
}
