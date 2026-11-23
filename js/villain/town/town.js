// 꼬마 마을 (건물 + 길 + 소품 + 마을 사람)
// 배치도(townLayout.js)대로 건물을 세우고, 부서진 정도를 셉니다. 괴수·영웅이 노릴 건물 목록도 여기서 나옵니다.
//
//   const town = createTown(scene, { debris, events, fx? })
//   town.buildings                  건물 목록 (과녁): team, position, radius, height, alive, takeDamage(), kind, name, totalBlocks, remaining
//   town.totalBlocks / destroyedBlocks / destroyedRatio (0 ~ 1)
//   town.nearestAlive(position) → 가장 가까운 남은 건물 (없으면 null)
//   town.groundHeight(x, z) → 바닥 높이 (길 위는 조금 높음) — debris.setGroundHeight 에 넘겨 주세요
//   town.bounds                     바닥판 범위 { minX, maxX, minZ, maxZ }
//   town.update(dt) ; town.reset() (전부 새것으로) ; town.dispose()
//   town.collapseAll()              남은 건물을 차례로 무너뜨림 (마지막 구경거리)
//   town.trample(position, radius)  그 둘레의 나무·울타리 같은 소품을 부숨 (괴수 발걸음·맞은 자리에 저절로 불림)
//   town.setThreat(() => 위치 | null)   마을 사람이 도망칠 상대 (괴수 위치). 안 주면 괴수 발걸음 소식으로 짐작
//
// 듣는 소식: monsterStep { position }, hit { position } → 소품 부수기 / 마을 사람 놀라기
// 건물 블록 하나의 튼튼함은 villainConfig.js 의 town.hpPerBlock.

import * as THREE from '../../lib/three.js';
import { VILLAIN } from '../villainConfig.js';
import { makeBuilding } from './buildingArt.js';
import { createBuilding } from './building.js';
import { createDecor } from './decor.js';
import { createVillagers } from './villagers.js';
import { TOWN_LAYOUT } from './townLayout.js';

const ROAD_HEX = '#E4CD9E'; // 길 색 (모래색)
const ROAD_HEIGHT = 0.18; // 길 타일 두께 (바닥 돌기를 덮을 만큼)
const STEP_TRAMPLE = 2.2; // 괴수 발걸음이 소품을 부수는 둘레 (칸)
const HIT_TRAMPLE = 1.6; // 맞은 자리 둘레의 소품도 부서짐
const COLLAPSE_GAP = 0.28; // collapseAll: 건물이 하나씩 무너지는 간격 (초)

export function createTown(scene, { debris = null, events = null, fx = null, layout = TOWN_LAYOUT } = {}) {
  const config = VILLAIN.town;
  const bounds = { minX: -config.width / 2, maxX: config.width / 2, minZ: -config.depth / 2, maxZ: config.depth / 2 };

  const buildings = layout.buildings.map(({ kind, x0, z0 }) =>
    createBuilding(scene, makeBuilding(kind), { x0, z0, debris, events, fx, hpPerBlock: config.hpPerBlock }),
  );
  const totalBlocks = buildings.reduce((sum, b) => sum + b.totalBlocks, 0);

  // 길: 돌기 없는 매끈한 타일
  const roads = new THREE.Group();
  roads.name = 'townRoads';
  const roadMaterial = new THREE.MeshStandardMaterial({ color: ROAD_HEX, roughness: 0.45, metalness: 0 });
  for (const road of layout.roads) {
    const w = road.x1 - road.x0;
    const d = road.z1 - road.z0;
    const tile = new THREE.Mesh(new THREE.BoxGeometry(w, ROAD_HEIGHT, d), roadMaterial);
    tile.position.set(road.x0 + w / 2, ROAD_HEIGHT / 2, road.z0 + d / 2);
    tile.receiveShadow = true;
    roads.add(tile);
  }
  scene.add(roads);

  const decor = createDecor(scene, layout.decor, { debris, events });
  const villagers = createVillagers(scene, { count: layout.villagers ?? 0, bounds, buildings, debris });

  // 괴수가 어디 있는지 (마을 사람이 도망칠 때 씀)
  let threatFn = null;
  const lastStep = new THREE.Vector3();
  let stepAge = Infinity;
  const offs = [];
  if (events) {
    offs.push(
      events.on('monsterStep', ({ position } = {}) => {
        if (!position) return;
        lastStep.copy(position);
        stepAge = 0;
        decor.trample(position, STEP_TRAMPLE);
      }),
      events.on('hit', ({ position } = {}) => {
        if (position) decor.trample(position, HIT_TRAMPLE);
      }),
    );
  }

  let collapseQueue = null; // collapseAll 진행 중: { list, wait }

  function groundHeight(x, z) {
    for (const road of layout.roads) {
      if (x >= road.x0 && x < road.x1 && z >= road.z0 && z < road.z1) return ROAD_HEIGHT;
    }
    return 0;
  }

  function nearestAlive(position) {
    let best = null;
    let bestGap = Infinity;
    for (const b of buildings) {
      if (!b.alive) continue;
      const gap = Math.hypot(b.position.x - position.x, b.position.z - position.z) - b.radius;
      if (gap < bestGap) {
        bestGap = gap;
        best = b;
      }
    }
    return best;
  }

  function update(dt) {
    for (const b of buildings) b.update(dt);
    if (collapseQueue) {
      collapseQueue.wait -= dt;
      while (collapseQueue && collapseQueue.wait <= 0) {
        const next = collapseQueue.list.shift();
        if (!next) collapseQueue = null;
        else if (next.alive) {
          next.collapse();
          collapseQueue.wait += COLLAPSE_GAP;
        }
      }
    }
    stepAge += dt;
    const threat = threatFn ? threatFn() : stepAge < 2.5 ? lastStep : null;
    villagers.update(dt, threat);
  }

  function reset() {
    collapseQueue = null;
    stepAge = Infinity;
    for (const b of buildings) b.reset();
    decor.reset();
    villagers.reset();
  }

  return {
    buildings,
    totalBlocks,
    bounds,
    decor: decor.items,
    villagers,
    nearestAlive,
    groundHeight,
    update,
    reset,
    trample: (position, radius = STEP_TRAMPLE) => decor.trample(position, radius),
    setThreat(fn) {
      threatFn = fn;
    },
    collapseAll() {
      collapseQueue = { list: buildings.filter((b) => b.alive), wait: 0 };
    },
    dispose() {
      for (const off of offs) off();
      for (const b of buildings) b.dispose();
      decor.dispose();
      villagers.dispose();
      roads.removeFromParent();
    },
    get destroyedBlocks() {
      let left = 0;
      for (const b of buildings) left += b.remaining;
      return totalBlocks - left;
    },
    get destroyedRatio() {
      return totalBlocks > 0 ? this.destroyedBlocks / totalBlocks : 0;
    },
    get aliveCount() {
      let n = 0;
      for (const b of buildings) if (b.alive) n++;
      return n;
    },
  };
}
