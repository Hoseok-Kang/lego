// 소굴 3D 공용 도구 (칸 크기, 블록 재질, 블록 묶음 만들기, 칸 ↔ 3D 좌표)
// 소굴 화면의 다른 파일(lairView, lairPlate, lairBuildings, lairGhost …)이 모두 이 파일을 같이 씁니다.
//
//   TILE                                  땅 한 칸 = 블록 TILE 칸 (가로·세로)
//   getLairMaterials() → { solid, lit, glow, ghost }
//       solid: 보통 블록, lit: 고른 시설(살짝 밝게), glow: 스스로 빛나는 블록(용암·불·눈), ghost: 반투명 미리보기
//   createVoxelMesh(voxels, material, { shadow }) → InstancedMesh   블록 목록을 한 번에 그리는 묶음 (제자리에 고정)
//       voxels: [{ x, y, z, hex }]  (x,y,z = 블록 가운데 좌표)
//   tileCorner(size, x, y, out)         칸 (x, y) 의 왼쪽 뒤 모서리 3D 좌표 (out.x, out.z)
//   footprintCenter(size, x, y, w, h, out)  시설 자리(w×h 칸)의 가운데 3D 좌표
//   worldToTile(size, wx, wz) → { tx, ty }  3D 좌표 → 칸 번호 (땅 밖이면 범위 밖 숫자)
//   ZERO_MATRIX                          블록을 숨길 때 쓰는 0 크기 행렬
//   mergeGeos([모양…]) → 하나로 합친 모양      seededRandom(씨앗) → () => 0~1 (늘 같은 순서)
//
// 빛나는 정도는 아래 GLOW_STRENGTH 에서 바꿉니다.

import * as THREE from '../../lib/three.js';
import { getBlockAssets } from '../../game/core/blockAssets.js';

export const TILE = 5;
const GLOW_STRENGTH = 0.95; // 빛나는 블록의 밝기 (0 = 안 빛남)
const LIT_GLOW = 0.16; // 고른 시설이 밝아지는 정도

export const ZERO_MATRIX = new THREE.Matrix4().set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);

let materials = null;

// 빛(emissive)에도 블록 색을 곱해서 블록마다 자기 색으로 빛나게 함
function tintEmissive(material, key) {
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\n#ifdef USE_COLOR\n\ttotalEmissiveRadiance *= vColor.rgb;\n#endif',
    );
  };
  material.customProgramCacheKey = () => key;
  return material;
}

export function getLairMaterials() {
  if (materials) return materials;
  const base = getBlockAssets().material;
  const solid = base;
  const lit = tintEmissive(
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: base.roughness, emissive: 0xffffff, emissiveIntensity: LIT_GLOW }),
    'lairLit',
  );
  const glow = tintEmissive(
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, emissive: 0xffffff, emissiveIntensity: GLOW_STRENGTH }),
    'lairGlow',
  );
  const ghost = tintEmissive(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.4,
      transparent: true,
      opacity: 0.55,
      emissive: 0xffffff,
      emissiveIntensity: 0.25,
    }),
    'lairGhost',
  );
  materials = { solid, lit, glow, ghost };
  return materials;
}

// 블록 목록 → 고정된 블록 묶음 (InstancedMesh)
const tmpMatrix = new THREE.Matrix4();
const tmpColor = new THREE.Color();
export function createVoxelMesh(voxels, material, { shadow = true } = {}) {
  const { block } = getBlockAssets();
  const count = Math.max(1, voxels.length);
  const mesh = new THREE.InstancedMesh(block, material, count);
  mesh.count = voxels.length;
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  voxels.forEach((v, i) => {
    mesh.setMatrixAt(i, tmpMatrix.makeTranslation(v.x, v.y, v.z));
    mesh.setColorAt(i, tmpColor.set(v.hex));
  });
  if (!voxels.length) mesh.setColorAt(0, tmpColor.set(0xffffff));
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return mesh;
}

// 모양 여러 개를 하나로 합치기 (위치·방향만, 번호 있는 모양·없는 모양 모두)
export function mergeGeos(list) {
  const pos = [];
  const nor = [];
  const idx = [];
  let offset = 0;
  for (const g of list) {
    const p = g.attributes.position;
    const n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i));
      nor.push(n.getX(i), n.getY(i), n.getZ(i));
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + offset);
    else for (let i = 0; i < p.count; i++) idx.push(i + offset);
    offset += p.count;
    g.dispose();
  }
  const merged = new THREE.BufferGeometry();
  merged.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  merged.setIndex(idx);
  merged.computeBoundingSphere();
  return merged;
}

// 0 ~ 1 사이 '같은 씨앗이면 늘 같은' 난수 만들기
export function seededRandom(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function tileCorner(size, x, y, out) {
  out.x = (x - size / 2) * TILE;
  out.z = (y - size / 2) * TILE;
  return out;
}

export function footprintCenter(size, x, y, w, h, out) {
  out.x = (x + w / 2 - size / 2) * TILE;
  out.z = (y + h / 2 - size / 2) * TILE;
  return out;
}

export function worldToTile(size, wx, wz) {
  return { tx: Math.floor(wx / TILE + size / 2), ty: Math.floor(wz / TILE + size / 2) };
}
