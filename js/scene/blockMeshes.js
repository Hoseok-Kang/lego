// 블록 모양과 배치
// 모서리가 둥근 네모 블록 + 위쪽 돌기 하나로 블록 한 개를 만들고,
// 같은 모양을 수천 개 한꺼번에 그리는 방식(InstancedMesh)으로 빠르게 보여 줍니다.
// stackAnimator.js가 여기 있는 setPose/setFinal로 블록을 움직입니다.

import * as THREE from '../lib/three.js';

export function createBlockMeshes(scene, block) {
  const bodySize = block.size - block.gap;
  const bodyGeometry = createRoundedBoxGeometry(bodySize, block.cornerRadius);
  const studGeometry = new THREE.CylinderGeometry(block.studRadius, block.studRadius, block.studHeight, 18);
  studGeometry.translate(0, bodySize / 2 + block.studHeight / 2 - 0.005, 0);
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: block.roughness, metalness: 0 });

  let body = null;
  let stud = null;
  let targets = new Float32Array(0); // 블록마다 최종 위치 (x, y, z)
  let figure = { width: 1, height: 1, depth: 1 };

  // 쌓기 계획을 받아서 블록 색과 최종 위치를 준비
  function setPlan(plan, palette) {
    removeMeshes();
    const count = plan.blocks.length;
    body = createInstanced(bodyGeometry, count);
    stud = createInstanced(studGeometry, count);

    targets = new Float32Array(count * 3);
    const color = new THREE.Color();
    plan.blocks.forEach((b, i) => {
      targets[i * 3] = (b.x - (plan.columns - 1) / 2) * block.size;
      targets[i * 3 + 1] = b.y * block.size + block.size / 2;
      targets[i * 3 + 2] = ((plan.depth - 1) / 2 - b.z) * block.size;
      color.set(palette[b.colorIndex].hex);
      body.setColorAt(i, color);
      stud.setColorAt(i, color);
      setFinal(i);
    });
    body.instanceColor.needsUpdate = true;
    stud.instanceColor.needsUpdate = true;
    commit();
    setVisibleCount(0);

    figure = {
      width: plan.columns * block.size,
      height: plan.rows * block.size,
      depth: plan.depth * block.size,
    };
  }

  function createInstanced(geometry, count) {
    const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, count));
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false; // 움직이는 블록이 화면 밖으로 잘못 판단되지 않게
    scene.add(mesh);
    return mesh;
  }

  function removeMeshes() {
    for (const mesh of [body, stud]) {
      if (!mesh) continue;
      scene.remove(mesh);
      mesh.dispose();
    }
  }

  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const scale = new THREE.Vector3();

  // i번째 블록을 최종 위치에서 (dx, dy, dz)만큼 떨어진 곳에, 기울기와 크기를 줘서 놓기
  function setPose(i, dx, dy, dz, tilt, scaleX, scaleY, scaleZ) {
    position.set(targets[i * 3] + dx, targets[i * 3 + 1] + dy, targets[i * 3 + 2] + dz);
    rotation.setFromEuler(euler.set(0, 0, tilt));
    scale.set(scaleX, scaleY, scaleZ);
    matrix.compose(position, rotation, scale);
    body.setMatrixAt(i, matrix);
    stud.setMatrixAt(i, matrix);
  }

  function setFinal(i) {
    setPose(i, 0, 0, 0, 0, 1, 1, 1);
  }

  // 앞에서부터 n개 블록만 보이게 (계획 순서 = 쌓는 순서)
  function setVisibleCount(n) {
    body.count = n;
    stud.count = n;
  }

  function commit() {
    body.instanceMatrix.needsUpdate = true;
    stud.instanceMatrix.needsUpdate = true;
  }

  return {
    setPlan,
    setPose,
    setFinal,
    setVisibleCount,
    commit,
    figureSize: () => figure,
    blockSize: block.size,
  };
}

// 모서리가 둥근 정육면체 모양 만들기
// 면마다 3×3 조각으로 나눈 뒤, 가장자리 점들을 안쪽 상자 둘레의 둥근 면 위로 옮깁니다.
export function createRoundedBoxGeometry(size, radius) {
  const geometry = new THREE.BoxGeometry(size, size, size, 3, 3, 3);
  const positions = geometry.attributes.position;
  const normals = geometry.attributes.normal;
  const half = size / 2;
  const inner = half - radius;
  const point = new THREE.Vector3();
  const core = new THREE.Vector3();
  const offset = new THREE.Vector3();
  const snap = (v) => (Math.abs(Math.abs(v) - half) < 1e-4 ? v : Math.sign(v) * inner);
  const clampInner = (v) => Math.max(-inner, Math.min(inner, v));

  for (let i = 0; i < positions.count; i++) {
    point.fromBufferAttribute(positions, i);
    point.set(snap(point.x), snap(point.y), snap(point.z));
    core.set(clampInner(point.x), clampInner(point.y), clampInner(point.z));
    offset.subVectors(point, core);
    if (offset.lengthSq() > 1e-10) {
      offset.normalize();
      point.copy(core).addScaledVector(offset, radius);
      normals.setXYZ(i, offset.x, offset.y, offset.z);
    }
    positions.setXYZ(i, point.x, point.y, point.z);
  }
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
