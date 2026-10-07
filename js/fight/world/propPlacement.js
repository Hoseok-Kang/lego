// 소품 놓기 계산 (지도 → 블록 위치 + 부딪힘 모양)
// mapLayout.js 의 지도를 읽어서, 소품마다 '세상 속 블록 위치 목록'과 '부딪힘 모양(네모·동그라미)'을 만듭니다.
// 모든 블록은 바닥판 돌기 자리(x.5, z.5)에 딱 맞게 놓입니다.
// three.js 를 쓰지 않아서 node 에서도 시험할 수 있습니다. (그리기는 props.js 가 맡음)
//
//   buildPlacements(layout, { width, depth }) → { statics, outside, crates, colliders, walls }
//       statics:  [{ x, y, z, hex }]      움직이지 않는 소품 블록 (돌담, 나무, 바위, 덤불, 꽃, 당근밭, 울타리)
//       outside:  [{ x, y, z, hex }]      울타리 바깥(한 칸 낮은 땅) 꾸미기 블록
//       crates:   [{ spec, voxels, box }] 나무 상자마다 블록 목록과 네모 범위
//       colliders:[{ shape: 'box', minX, maxX, minZ, maxZ, height, kind, ref } | { shape: 'circle', x, z, radius, height, kind, ref }]
//                 (상자 것은 빠져 있음 — 상자는 부서지므로 crates.js 가 따로 넣고 뺌)
//       walls:    [{ minX, maxX, minZ, maxZ, height }]   돌담 윗면 (부서진 조각이 그 위에 떨어지게)
//   placeModel(voxels, { x, z, y = 0, turn = 0 }) → [{ x, y, z, hex }]   모형 하나를 그 자리에 (돌기 칸에 맞춤)
//   voxelBox(voxels) → { minX, maxX, minZ, maxZ, height }                 블록들이 차지하는 네모 범위
//
// 소품 모양은 js/fight/art/propArt.js 에서 가져옵니다. (모양을 바꾸려면 그 파일)

import { createPropModel, createWall, createFence } from '../art/propArt.js';

const TREE_RADIUS = { 0: 3.8, 1: 4.6, 2: 3.8 }; // 나무 부딪힘 반지름 (잎 크기보다 조금 작게 → 잎 가장자리는 살짝 겹쳐도 됨)
const ROCK_RADIUS_SCALE = 0.95; // 바위 부딪힘 반지름 = 바위 폭의 절반 × 이 값
const FENCE_HEIGHT = 3; // 울타리 높이 (부딪힘 정보용)

export function buildPlacements(layout, { width, depth }) {
  const statics = [];
  const outside = [];
  const crates = [];
  const colliders = [];
  const walls = [];
  const groundY = 0;
  const outsideY = -(layout.plateThickness ?? 1);
  // 칸 하나에 블록 두 개가 겹치면 화면이 지글거리므로, 단단한 소품이 먼저 칸을 차지하고 꾸미기는 빈칸에만 놓음
  const taken = new Set();
  const key = (v) => `${v.x},${v.y},${v.z}`;
  const claim = (voxels) => {
    for (const v of voxels) taken.add(key(v));
    return voxels;
  };
  const decor = (voxels) => voxels.filter((v) => !taken.has(key(v)) && (taken.add(key(v)), true));

  // 돌담 (두께만큼 한 줄씩 나란히, 줄마다 돌 무늬를 다르게)
  (layout.walls ?? []).forEach((wall, index) => {
    const thickness = wall.thickness ?? 1;
    const height = wall.height ?? 3;
    const voxels = [];
    for (let row = 0; row < thickness; row++) {
      const offset = row - (thickness - 1) / 2;
      const line = createWall(wall.length, height, wall.axis, index * 7 + row).voxels;
      for (const v of line) voxels.push(wall.axis === 'x' ? { ...v, z: v.z + offset } : { ...v, x: v.x + offset });
    }
    const placed = claim(placeModel(voxels, { x: wall.x, z: wall.z, y: groundY, turn: wall.turn }));
    statics.push(...placed);
    const box = voxelBox(placed);
    colliders.push({ shape: 'box', ...box, kind: 'wall', ref: wall });
    walls.push(box);
  });

  // 나무 상자 (부딪힘은 crates.js 가 따로)
  for (const spec of layout.crates ?? []) {
    const voxels = claim(placeModel(createPropModel('crate', spec.variant ?? 0).voxels, { x: spec.x, z: spec.z, y: groundY, turn: spec.turn }));
    crates.push({ spec, voxels, box: voxelBox(voxels) });
  }

  // 나무: 동그라미 부딪힘 (줄기 가운데)
  for (const spec of layout.trees ?? []) {
    const variant = spec.variant ?? 0;
    const placed = claim(placeModel(createPropModel('tree', variant).voxels, { x: spec.x, z: spec.z, y: groundY, turn: spec.turn }));
    statics.push(...placed);
    const box = voxelBox(placed);
    colliders.push({ shape: 'circle', x: (box.minX + box.maxX) / 2, z: (box.minZ + box.maxZ) / 2, radius: spec.radius ?? TREE_RADIUS[variant] ?? 3.8, height: box.height, kind: 'tree', ref: spec });
  }

  // 바위
  for (const spec of layout.rocks ?? []) {
    const placed = claim(placeModel(createPropModel('rock', spec.variant ?? 0).voxels, { x: spec.x, z: spec.z, y: groundY, turn: spec.turn }));
    statics.push(...placed);
    const box = voxelBox(placed);
    const radius = spec.radius ?? (Math.max(box.maxX - box.minX, box.maxZ - box.minZ) / 2) * ROCK_RADIUS_SCALE;
    colliders.push({ shape: 'circle', x: (box.minX + box.maxX) / 2, z: (box.minZ + box.maxZ) / 2, radius, height: box.height, kind: 'rock', ref: spec });
  }

  // 둘레 울타리: 위·아래 줄은 끝까지, 왼쪽·오른쪽 줄은 그 사이
  if (layout.fence) {
    const halfW = width / 2;
    const halfD = depth / 2;
    const rows = [
      { voxels: createFence(width, 'x').voxels, x: 0, z: -halfD + 0.5 },
      { voxels: createFence(width, 'x').voxels, x: 0, z: halfD - 0.5 },
      { voxels: createFence(depth - 2, 'z').voxels, x: -halfW + 0.5, z: 0 },
      { voxels: createFence(depth - 2, 'z').voxels, x: halfW - 0.5, z: 0 },
    ];
    for (const row of rows) {
      const placed = claim(placeModel(row.voxels, { x: row.x, z: row.z, y: groundY }));
      statics.push(...placed);
      colliders.push({ shape: 'box', ...voxelBox(placed), height: FENCE_HEIGHT, kind: 'fence', ref: null });
    }
  }

  // 꾸미기 (부딪힘 없음)
  for (const spec of layout.bushes ?? []) statics.push(...decor(placeModel(createPropModel('bush', spec.variant ?? 0).voxels, { ...spec, y: groundY })));
  for (const spec of layout.flowers ?? []) statics.push(...decor(placeModel(createPropModel('flowers', spec.variant ?? 0).voxels, { ...spec, y: groundY })));
  for (const spec of layout.carrotPatches ?? []) statics.push(...decor(placeModel(createPropModel('carrotPatch', spec.variant ?? 0).voxels, { ...spec, y: groundY })));

  // 울타리 바깥 꾸미기 (한 칸 낮은 땅 위)
  const out = layout.outside ?? {};
  for (const spec of out.trees ?? []) outside.push(...placeModel(createPropModel('tree', spec.variant ?? 0).voxels, { ...spec, y: outsideY }));
  for (const spec of out.bushes ?? []) outside.push(...placeModel(createPropModel('bush', spec.variant ?? 0).voxels, { ...spec, y: outsideY }));
  for (const spec of out.rocks ?? []) outside.push(...placeModel(createPropModel('rock', spec.variant ?? 0).voxels, { ...spec, y: outsideY }));
  for (const spec of out.flowers ?? []) outside.push(...placeModel(createPropModel('flowers', spec.variant ?? 0).voxels, { ...spec, y: outsideY }));

  return { statics, outside, crates, colliders, walls };
}

// 모형을 (x, z) 에 놓기: turn 만큼 90도씩 돌리고, 블록 가운데가 돌기 칸(x.5, z.5)에 오게 맞춤
export function placeModel(voxels, { x = 0, z = 0, y = 0, turn = 0 } = {}) {
  const quarter = ((Math.round(turn ?? 0) % 4) + 4) % 4;
  // 모형 전체를 똑같이 옮겨야 모양이 안 깨지므로, 첫 블록 기준으로 맞출 양을 한 번만 정함
  let shiftX = 0;
  let shiftZ = 0;
  return voxels.map((v, i) => {
    let lx = v.x;
    let lz = v.z;
    for (let q = 0; q < quarter; q++) [lx, lz] = [-lz, lx];
    if (i === 0) {
      shiftX = snapHalf(x + lx) - (x + lx);
      shiftZ = snapHalf(z + lz) - (z + lz);
    }
    return { x: tidy(x + lx + shiftX), y: tidy(y + v.y), z: tidy(z + lz + shiftZ), hex: v.hex };
  });
}

export function voxelBox(voxels) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  let top = 0;
  for (const v of voxels) {
    minX = Math.min(minX, v.x - 0.5);
    maxX = Math.max(maxX, v.x + 0.5);
    minZ = Math.min(minZ, v.z - 0.5);
    maxZ = Math.max(maxZ, v.z + 0.5);
    top = Math.max(top, v.y + 0.5);
  }
  return { minX, maxX, minZ, maxZ, height: top };
}

// 가장 가까운 x.5 자리
function snapHalf(value) {
  return Math.floor(value) + 0.5;
}

function tidy(value) {
  return Math.round(value * 1000) / 1000 + 0;
}
