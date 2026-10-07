// 전장 소품 (돌담, 나무 상자, 나무, 바위, 덤불, 꽃, 당근밭, 울타리, 울타리 바깥 꾸미기)
// 지도(mapLayout.js)대로 블록 소품을 세우고, 부딪힘 모양을 collision 에 넣습니다.
// 움직이지 않는 소품은 블록 묶음(InstancedMesh) 두 개(안쪽·바깥쪽)로 한꺼번에 그려서 가볍습니다.
// 나무 상자는 따로 한 묶음 (crates.js) — 맞으면 블록이 떨어져 나가다 부서집니다.
//
//   const props = createProps(scene, { collision, debris, events, layout = FIGHT_MAP })
//   props.crates → [{ id, position, hp, alive }]          나무 상자 목록 (position: 바닥 가운데)
//   props.damageCrate(crate, 양, 맞은곳) → { broken }      블록 1~3개가 맞은 곳 근처에서 떨어짐, 0 이 되면 와르르
//   props.groundHeight(x, z) → 높이                        부서진 조각이 떨어질 바닥 높이 (돌담 위는 돌담 높이, 나머지 0)
//   props.update(dt)                                      상자 움찔 모션
//   props.reset()                                         상자를 모두 처음 모습으로 (다시 하기)
//   props.blockCount                                      그리는 소품 블록 수 (확인용)
//   props.dispose()
//
// 상자를 부술 때 'crateHit' / 'crateBroken' 소식을 보냅니다 (crates.js).
// 무엇을 어디에 놓을지는 mapLayout.js, 모양·색은 js/fight/art/propArt.js 에서 바꿉니다.

import * as THREE from '../../lib/three.js';
import { FIGHT } from '../fightConfig.js';
import { createBlockBatch } from '../../game/core/blockAssets.js';
import { FIGHT_MAP } from './mapLayout.js';
import { buildPlacements } from './propPlacement.js';
import { createCrates } from './crates.js';

const INSIDE_SPLIT = 2; // 안쪽 소품 묶음을 가로·세로 몇 조각으로 나눌지 (2 → 4 묶음)
const OUTSIDE_SPLIT = 3; // 바깥 꾸미기 묶음 (3 → 최대 9 묶음, 가운데는 비어 있음)

export function createProps(scene, { collision, debris, events, layout = FIGHT_MAP }) {
  const placements = buildPlacements(layout, { width: FIGHT.map.width, depth: FIGHT.map.depth });

  // 안쪽 소품: 그림자를 드리우고 받음 / 바깥 꾸미기: 그림자 범위 밖이라 그림자 계산에서 뺌 (가볍게)
  // 땅을 몇 조각으로 나눠 묶으면, 화면 밖 조각은 그리지 않아서 휴대폰에서도 가벼움
  const batches = [
    ...splitByArea(placements.statics, INSIDE_SPLIT).map((voxels, i) => createStaticBlocks(scene, voxels, { castShadow: true, name: `props${i}` })),
    ...splitByArea(placements.outside, OUTSIDE_SPLIT).map((voxels, i) => createStaticBlocks(scene, voxels, { castShadow: false, name: `outsideProps${i}` })),
  ];

  const colliderIds = placements.colliders.map((c) => (c.shape === 'circle' ? collision.addCircle({ ...c, owner: c.ref }) : collision.addBox({ ...c, owner: c.ref })));

  const crates = createCrates(scene, { collision, debris, events, list: placements.crates });

  // 돌담 윗면 (부서진 조각이 돌담 위에 떨어지면 그 위에 얹힘)
  const tops = placements.walls;
  function groundHeight(x, z) {
    for (let i = 0; i < tops.length; i++) {
      const top = tops[i];
      if (x >= top.minX && x <= top.maxX && z >= top.minZ && z <= top.maxZ) return top.height;
    }
    return 0;
  }

  return {
    crates: crates.list,
    damageCrate: crates.damage,
    groundHeight,
    update: crates.update,
    reset: crates.reset,
    blockCount: placements.statics.length + placements.outside.length + crates.list.reduce((n, c) => n + c.blocks.length, 0),
    dispose() {
      for (const id of colliderIds) collision.remove(id);
      crates.dispose();
      for (const batch of batches) batch.dispose();
    },
  };
}

// 블록 목록을 땅 위치에 따라 split × split 조각으로 나눔 (빈 조각은 뺌)
function splitByArea(voxels, split) {
  if (!voxels.length) return [];
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const v of voxels) {
    minX = Math.min(minX, v.x);
    maxX = Math.max(maxX, v.x);
    minZ = Math.min(minZ, v.z);
    maxZ = Math.max(maxZ, v.z);
  }
  const cells = Array.from({ length: split * split }, () => []);
  const cellOf = (value, min, max) => Math.min(split - 1, Math.floor(((value - min) / Math.max(1e-6, max - min)) * split));
  for (const v of voxels) cells[cellOf(v.x, minX, maxX) * split + cellOf(v.z, minZ, maxZ)].push(v);
  return cells.filter((cell) => cell.length > 0);
}

// 움직이지 않는 블록 목록을 한 묶음으로 (위치·색은 처음 한 번만 씀)
function createStaticBlocks(scene, voxels, { castShadow, name }) {
  const batch = createBlockBatch(Math.max(1, voxels.length), { castShadow, receiveShadow: true });
  const mesh = batch.bodies;
  mesh.name = name;
  mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  const matrix = new THREE.Matrix4();
  const color = new THREE.Color();
  voxels.forEach((v, i) => {
    mesh.setMatrixAt(i, matrix.makeTranslation(v.x, v.y, v.z));
    mesh.setColorAt(i, color.set(v.hex));
  });
  mesh.count = voxels.length;
  mesh.visible = voxels.length > 0;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  // 화면 밖 판단을 위해 실제 범위를 계산해 둠 (createBlockBatch 는 frustumCulled = false 로 만듦)
  mesh.computeBoundingSphere();
  mesh.frustumCulled = voxels.length > 0;
  scene.add(mesh);
  return {
    mesh,
    dispose() {
      scene.remove(mesh);
      mesh.dispose();
    },
  };
}
