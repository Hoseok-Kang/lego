// 무대
// 3D 화면(렌더러), 조명, 반사광, 바닥판, 카메라를 준비합니다.
// 블록 자체는 blockMeshes.js, 카메라 움직임은 cameraRig.js가 맡습니다.

import * as THREE from '../lib/three.js';

export function createStage(container, { ground, block, camera: cameraConfig }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0); // 배경은 투명하게 → 페이지 배경색이 비쳐 보임
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.domElement.className = 'stage-canvas';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.environment = createStudioLight(renderer);
  scene.environmentIntensity = 0.6;

  const camera = new THREE.PerspectiveCamera(cameraConfig.fov, 1, 0.1, 2000);

  const skyLight = new THREE.HemisphereLight(0xffffff, 0x6f7f8c, 0.7);
  const sun = new THREE.DirectionalLight(0xffffff, 2.2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(skyLight, sun, sun.target);

  const baseplate = createBaseplate(ground, block);
  scene.add(baseplate.group);

  // 그림 크기에 맞춰 바닥판과 그림자 범위를 조절
  function fitToPlan(plan) {
    const plateWidth = plan.columns + ground.margin * 2;
    const plateDepth = plan.depth + ground.margin * 2;
    baseplate.resize(plateWidth, plateDepth);

    const height = plan.rows * block.size;
    const span = Math.max(plateWidth, height, plateDepth);
    sun.target.position.set(0, height * 0.45, 0);
    sun.position.set(span * 0.55, height * 0.45 + span * 1.3, span * 1.05);
    const radius = 0.5 * Math.hypot(plateWidth, height + 2, plateDepth) + 2;
    const shadowCam = sun.shadow.camera;
    shadowCam.left = -radius;
    shadowCam.right = radius;
    shadowCam.top = radius;
    shadowCam.bottom = -radius;
    shadowCam.near = 0.5;
    shadowCam.far = sun.position.distanceTo(sun.target.position) + radius * 2;
    shadowCam.updateProjectionMatrix();
  }

  function resize() {
    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(container);
  resize();

  return {
    renderer,
    scene,
    camera,
    fitToPlan,
    resize,
    render: () => renderer.render(scene, camera),
  };
}

// 스튜디오 조명처럼 은은한 반사광을 만들어 블록이 플라스틱처럼 반짝이게 함 (게임에서도 같이 씀)
export function createStudioLight(renderer) {
  const room = new THREE.Scene();
  room.add(
    new THREE.Mesh(
      new THREE.BoxGeometry(10, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0x5d666e, side: THREE.BackSide }),
    ),
  );
  const addPanel = (width, height, position, brightness) => {
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(brightness, brightness, brightness) }),
    );
    panel.position.copy(position);
    panel.lookAt(0, 0, 0);
    room.add(panel);
  };
  addPanel(7, 4, new THREE.Vector3(0.01, 4.9, 0), 3.2); // 위
  addPanel(4, 5, new THREE.Vector3(4.9, 1.5, 2), 2.2); // 오른쪽 앞
  addPanel(3, 4, new THREE.Vector3(-4.9, 1, -1), 1.3); // 왼쪽 뒤
  addPanel(6, 2.5, new THREE.Vector3(0, 0.5, 4.9), 1.6); // 정면

  const generator = new THREE.PMREMGenerator(renderer);
  const texture = generator.fromScene(room, 0.04).texture;
  generator.dispose();
  return texture;
}

// 동그란 돌기가 촘촘히 박힌 바닥판 (게임에서도 같이 씀)
// studSegments: 돌기 둘레를 몇 조각으로 그릴지 (작을수록 가볍고 덜 둥긂)
export function createBaseplate(ground, block, { studSegments = 18 } = {}) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color: ground.color, roughness: 0.5 });

  const plate = new THREE.Mesh(new THREE.BoxGeometry(1, ground.thickness, 1), material);
  plate.position.y = -ground.thickness / 2; // 바닥판 윗면이 높이 0
  plate.castShadow = true;
  plate.receiveShadow = true;
  group.add(plate);

  const studGeometry = new THREE.CylinderGeometry(block.studRadius, block.studRadius, block.studHeight, studSegments);
  studGeometry.translate(0, block.studHeight / 2, 0);
  let studs = null;

  function resize(width, depth) {
    plate.scale.set(width * block.size, 1, depth * block.size);
    if (studs) {
      group.remove(studs);
      studs.dispose();
    }
    studs = new THREE.InstancedMesh(studGeometry, material, width * depth);
    studs.castShadow = true;
    studs.receiveShadow = true;
    const matrix = new THREE.Matrix4();
    let i = 0;
    for (let x = 0; x < width; x++) {
      for (let z = 0; z < depth; z++) {
        matrix.makeTranslation((x - (width - 1) / 2) * block.size, 0, (z - (depth - 1) / 2) * block.size);
        studs.setMatrixAt(i++, matrix);
      }
    }
    studs.instanceMatrix.needsUpdate = true;
    group.add(studs);
  }

  return { group, resize };
}
