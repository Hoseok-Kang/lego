// 마을 소품 묶음 (나무·울타리·가로등·덤불) — 전부 한 번에 그림
// 소품은 과녁이 아니지만, 괴수가 밟거나 근처가 맞으면 블록으로 흩어집니다 (돈은 안 됨).
//
//   const decor = createDecor(scene, 배치목록, { debris, events })
//   decor.trample(position, radius) → 부서진 블록 수      그 둘레의 소품을 부숨
//   decor.reset() ; decor.dispose() ; decor.items ([{ kind, position, radius, alive }])
//
// 보내는 소식: blocksBroken { count, source: 'decor', position }

import * as THREE from '../../lib/three.js';
import { createBlockBatch } from '../../game/core/blockAssets.js';
import { makeDecor } from './decorArt.js';

export function createDecor(scene, layout, { debris = null, events = null } = {}) {
  const items = [];
  const blocks = []; // { position, color }
  for (const entry of layout) {
    const art = makeDecor(entry.kind, entry);
    const start = blocks.length;
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (const v of art.voxels) {
      const position = new THREE.Vector3(entry.x + v.x + 0.5, v.y + 0.5, entry.z + v.z + 0.5);
      blocks.push({ position, color: new THREE.Color(v.hex) });
      if (v.y > 1) continue; // 나무는 줄기 굵기로만 닿음 (잎은 넓어도 밑동이 밟혀야 쓰러짐)
      minX = Math.min(minX, position.x);
      maxX = Math.max(maxX, position.x);
      minZ = Math.min(minZ, position.z);
      maxZ = Math.max(maxZ, position.z);
    }
    items.push({
      kind: entry.kind,
      start,
      count: art.voxels.length,
      alive: true,
      position: new THREE.Vector3((minX + maxX) / 2, 0, (minZ + maxZ) / 2),
      halfX: (maxX - minX) / 2 + 0.5,
      halfZ: (maxZ - minZ) / 2 + 0.5,
      radius: Math.max(maxX - minX, maxZ - minZ) / 2 + 0.5,
    });
  }

  const mesh = createBlockBatch(blocks.length).bodies;
  mesh.name = 'townDecor';
  mesh.count = blocks.length;
  scene.add(mesh);
  const matrix = new THREE.Matrix4();
  const ZERO = new THREE.Matrix4().set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);

  function reset() {
    blocks.forEach((block, i) => {
      mesh.setMatrixAt(i, matrix.makeTranslation(block.position.x, block.position.y, block.position.z));
      mesh.setColorAt(i, block.color);
    });
    for (const item of items) item.alive = true;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  function trample(position, radius = 2) {
    let broken = 0;
    for (const item of items) {
      if (!item.alive) continue;
      const dx = Math.max(0, Math.abs(position.x - item.position.x) - item.halfX);
      const dz = Math.max(0, Math.abs(position.z - item.position.z) - item.halfZ);
      if (dx * dx + dz * dz > radius * radius) continue;
      item.alive = false;
      const list = blocks.slice(item.start, item.start + item.count);
      for (let i = item.start; i < item.start + item.count; i++) mesh.setMatrixAt(i, ZERO);
      debris?.burst(list, { from: new THREE.Vector3(position.x, 0, position.z), power: 5, upward: 7 });
      events?.emit('blocksBroken', { count: item.count, source: 'decor', position: item.position.clone().setY(1.5) });
      broken += item.count;
    }
    if (broken) mesh.instanceMatrix.needsUpdate = true;
    return broken;
  }

  reset();
  return {
    items,
    trample,
    reset,
    dispose() {
      mesh.removeFromParent();
      mesh.dispose();
    },
  };
}
