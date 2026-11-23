// 습격 감독의 도우미: 노릴 건물 고르기, 영웅이 내려올 자리 고르기
//
//   gapBetween(a, b) → 두 과녁 사이 빈 거리 (칸, 서로의 반지름을 뺀 값)
//   pickBuilding(town, position, avoid, now) → 가장 가까운 남은 건물 (avoid: 건물 → 이 시각까지는 건너뜀)
//   pickLandingSpot(town, monsterPosition) → 영웅이 내려올 땅 위 자리 (괴수에게서 조금 떨어진, 건물이 없는 곳)
//
// 영웅이 내려오는 거리 등은 아래 상수에서 바꿉니다.

import * as THREE from '../../lib/three.js';
import { VILLAIN } from '../villainConfig.js';

const LANDING_DISTANCE = 11; // 괴수에게서 이만큼 떨어진 곳에 내려옴 (칸)
const LANDING_EDGE = 5; // 바닥판 가장자리에서 이만큼은 안쪽으로
const LANDING_CLEAR = 2.5; // 건물과 이만큼은 떨어진 곳
const LANDING_ANGLES = 16; // 둘레를 몇 방향으로 나눠 찾을지

export function gapBetween(a, b) {
  return Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z) - (a.radius || 0) - (b.radius || 0);
}

export function pickBuilding(town, position, avoid = null, now = 0) {
  let best = null;
  let bestGap = Infinity;
  let fallback = null;
  let fallbackGap = Infinity;
  for (const b of town.buildings) {
    if (!b.alive) continue;
    const gap = Math.hypot(b.position.x - position.x, b.position.z - position.z) - (b.radius || 0);
    if (gap < fallbackGap) {
      fallbackGap = gap;
      fallback = b;
    }
    if (avoid && (avoid.get(b) ?? -Infinity) > now) continue;
    if (gap < bestGap) {
      bestGap = gap;
      best = b;
    }
  }
  return best || fallback;
}

export function pickLandingSpot(town, monsterPosition) {
  const bounds = town.bounds || {
    minX: -VILLAIN.town.width / 2,
    maxX: VILLAIN.town.width / 2,
    minZ: -VILLAIN.town.depth / 2,
    maxZ: VILLAIN.town.depth / 2,
  };
  const road = VILLAIN.town.monsterStart[1]; // 큰길의 z (괴수가 들어오는 줄)
  let best = null;
  let bestScore = Infinity;
  for (let i = 0; i < LANDING_ANGLES; i++) {
    const angle = (i / LANDING_ANGLES) * Math.PI * 2;
    const x = monsterPosition.x + Math.cos(angle) * LANDING_DISTANCE;
    const z = monsterPosition.z + Math.sin(angle) * LANDING_DISTANCE;
    if (x < bounds.minX + LANDING_EDGE || x > bounds.maxX - LANDING_EDGE || z < bounds.minZ + LANDING_EDGE || z > bounds.maxZ - LANDING_EDGE) continue;
    let blocked = false;
    for (const b of town.buildings) {
      if (b.alive && Math.hypot(b.position.x - x, b.position.z - z) < (b.radius || 0) + LANDING_CLEAR) blocked = true;
    }
    // 마을 가운데 큰길에 가까울수록, 괴수보다 앞쪽(카메라 쪽)일수록 잘 보여서 좋음
    const score = Math.hypot(x, z - road) - (z > monsterPosition.z ? 3 : 0) + (blocked ? 100 : 0);
    if (score < bestScore) {
      bestScore = score;
      best = new THREE.Vector3(x, 0, z);
    }
  }
  if (best) return best;
  // 둘레에 자리가 없으면 큰길 가운데
  return new THREE.Vector3(Math.max(bounds.minX + LANDING_EDGE, Math.min(bounds.maxX - LANDING_EDGE, monsterPosition.x * 0.3)), 0, road);
}
