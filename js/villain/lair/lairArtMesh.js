// 시설 그림 → 3D 블록 묶음 (보통 블록 + 빛나는 블록 + 움직이는 조각) · 움직이는 조각 한 장면
// 땅 위 시설(lairBuildings.js)과 지을 자리 유령(lairGhost.js)이 같이 씁니다.
//
//   buildArtMeshes(art, 보통재질, 빛재질, { shadow }) → { body, solid, glow, pivots }
//       body: 모두 담은 묶음 (시설 가운데 = 0), solid/glow: 블록 묶음 (glow 는 없으면 null), pivots: [{ group, def }]
//   animatePivots(pivots, time)     움직이는 조각: spin 빙글 · swing 흔들 · bob 둥실 · orbit 빙빙 돌며 오르락내리락
//   disposeArtMeshes(parts)         블록 묶음 치우기 (모양 · 재질은 같이 쓰므로 남김)

import * as THREE from '../../lib/three.js';
import { createVoxelMesh } from './lairKit.js';

const AXES = { x: 'x', y: 'y', z: 'z' };

export function buildArtMeshes(art, solidMat, glowMat, { shadow = true } = {}) {
  const body = new THREE.Group();
  const solid = createVoxelMesh(art.solid, solidMat, { shadow });
  body.add(solid);
  let glow = null;
  if (art.glow.length) {
    glow = createVoxelMesh(art.glow, glowMat, { shadow: false });
    body.add(glow);
  }
  const pivots = art.anims.map((def) => {
    const group = new THREE.Group();
    group.position.set(def.pivot.x, def.pivot.y, def.pivot.z);
    if (def.solid.length) group.add(createVoxelMesh(def.solid, solidMat, { shadow: false }));
    if (def.glow.length) group.add(createVoxelMesh(def.glow, glowMat, { shadow: false }));
    body.add(group);
    return { group, def };
  });
  return { body, solid, glow, pivots };
}

export function animatePivots(pivots, time) {
  for (let i = 0; i < pivots.length; i++) {
    const { group, def } = pivots[i];
    const t = time * def.speed + def.phase;
    const axis = AXES[def.axis] ?? 'y';
    if (def.kind === 'spin') group.rotation[axis] = t;
    else if (def.kind === 'swing') group.rotation[axis] = Math.sin(t) * def.amount;
    else if (def.kind === 'bob') group.position.y = def.pivot.y + Math.sin(t) * def.amount;
    else if (def.kind === 'orbit') {
      group.rotation.y = t;
      group.position.y = def.pivot.y + Math.sin(t * 2.3) * def.amount;
    }
  }
}

export function disposeArtMeshes(parts) {
  parts.body.traverse((o) => {
    if (o.isInstancedMesh) o.dispose();
  });
}
