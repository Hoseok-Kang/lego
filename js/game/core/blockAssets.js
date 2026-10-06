// 블록 한 개의 모양과 재질
// 게임 속 모든 블록(성, 타워, 몬스터, 부서진 조각, 발사체)이 이 모양 하나를 같이 씁니다.
// 모양은 블록 이미지 빌더와 똑같습니다 (js/config.js 의 block 설정).

import * as THREE from '../../lib/three.js';
import { CONFIG } from '../../config.js';
import { createRoundedBoxGeometry } from '../../scene/blockMeshes.js';

let assets = null;

export function getBlockAssets() {
  if (assets) return assets;
  const block = CONFIG.block;
  const bodySize = block.size - block.gap;
  const body = createRoundedBoxGeometry(bodySize, block.cornerRadius);
  const stud = new THREE.CylinderGeometry(block.studRadius, block.studRadius, block.studHeight, 12);
  stud.translate(0, bodySize / 2 + block.studHeight / 2 - 0.005, 0);
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: block.roughness, metalness: 0 });
  assets = { body, stud, material, size: block.size };
  return assets;
}

// 블록 여러 개를 한 번에 그리는 묶음(몸통 + 돌기) 만들기
export function createBlockBatch(capacity, { castShadow = true, receiveShadow = true } = {}) {
  const { body, stud, material } = getBlockAssets();
  const bodies = new THREE.InstancedMesh(body, material, Math.max(1, capacity));
  const studs = new THREE.InstancedMesh(stud, material, Math.max(1, capacity));
  for (const mesh of [bodies, studs]) {
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    mesh.frustumCulled = false;
    mesh.count = 0;
  }
  // 색 정보 칸을 미리 만들어 둠
  const white = new THREE.Color(1, 1, 1);
  bodies.setColorAt(0, white);
  studs.setColorAt(0, white);
  return { bodies, studs, capacity: Math.max(1, capacity) };
}
