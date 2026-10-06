// 블록 한 개의 모양과 재질
// 게임 속 모든 블록(성, 타워, 몬스터, 부서진 조각, 발사체)이 이 모양 하나를 같이 씁니다.
// 게임에서는 멀리서 보기 때문에 모서리를 둥글리지 않은 가벼운 블록(몸통 + 돌기를 한 덩어리로)을 씁니다.
// → 휴대폰에서도 블록 수천 개를 부드럽게 그릴 수 있습니다. (크기·돌기 크기는 js/config.js 의 block 설정)
//
//   getBlockAssets()              { block(모양), material(재질), size }
//   createBlockBatch(최대 개수)    블록 여러 개를 한 번에 그리는 묶음 → { bodies, studs, capacity }
//                                 (예전 코드와 맞추려고 bodies 와 studs 는 같은 묶음을 가리킵니다)

import * as THREE from '../../lib/three.js';
import { CONFIG } from '../../config.js';

const STUD_SEGMENTS = 8; // 돌기 둘레 조각 수 (작을수록 가벼움)

let assets = null;

export function getBlockAssets() {
  if (assets) return assets;
  const block = CONFIG.block;
  const bodySize = block.size - block.gap;
  const body = new THREE.BoxGeometry(bodySize, bodySize, bodySize);
  const stud = new THREE.CylinderGeometry(block.studRadius, block.studRadius, block.studHeight, STUD_SEGMENTS, 1, true);
  stud.translate(0, bodySize / 2 + block.studHeight / 2 - 0.005, 0);
  const cap = new THREE.CircleGeometry(block.studRadius, STUD_SEGMENTS);
  cap.rotateX(-Math.PI / 2);
  cap.translate(0, bodySize / 2 + block.studHeight - 0.005, 0);
  const merged = mergeGeometries([body, stud, cap]);
  const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: block.roughness, metalness: 0 });
  assets = { block: merged, material, size: block.size };
  return assets;
}

// 블록 여러 개를 한 번에 그리는 묶음
export function createBlockBatch(capacity, { castShadow = true, receiveShadow = true } = {}) {
  const { block, material } = getBlockAssets();
  const mesh = new THREE.InstancedMesh(block, material, Math.max(1, capacity));
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = receiveShadow;
  mesh.frustumCulled = false;
  mesh.count = 0;
  mesh.setColorAt(0, new THREE.Color(1, 1, 1)); // 색 정보 칸을 미리 만들어 둠
  return { bodies: mesh, studs: mesh, capacity: Math.max(1, capacity) };
}

// 번호(index)가 있는 모양 여러 개를 하나로 합치기 (위치·방향·무늬 좌표만)
function mergeGeometries(list) {
  const names = ['position', 'normal', 'uv'];
  const arrays = Object.fromEntries(names.map((name) => [name, []]));
  const indices = [];
  let offset = 0;
  for (const geometry of list) {
    const count = geometry.attributes.position.count;
    for (const name of names) arrays[name].push(...geometry.attributes[name].array);
    const index = geometry.index ? geometry.index.array : Array.from({ length: count }, (_, i) => i);
    for (const i of index) indices.push(i + offset);
    offset += count;
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(arrays.position, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(arrays.normal, 3));
  merged.setAttribute('uv', new THREE.Float32BufferAttribute(arrays.uv, 2));
  merged.setIndex(indices);
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}
