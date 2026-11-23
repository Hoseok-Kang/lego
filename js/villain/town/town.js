// 마을 하나 (건물 + 바닥 타일 + 소품 + 마을 사람) — 꼬마 마을·바닷가 마을·왕궁 성곽이 모두 이것으로 만들어짐
// 배치도(townLayout.js, harborLayout.js, castleLayout.js)대로 건물을 세우고, 부서진 정도를 셉니다. 괴수·영웅이 노릴 건물 목록도 여기서 나옵니다.
//
//   const town = createTown(scene, { debris, events, fx?, layout?, hpPerBlock?, id?, name? })
//       layout: 배치도 (안 주면 꼬마 마을),  hpPerBlock: 건물 블록 하나의 튼튼함 (안 주면 villainConfig 의 town.hpPerBlock)
//   town.id / name / layout
//   town.buildings                  건물 목록 (과녁): team, position, radius, height, alive, takeDamage(), kind, name, totalBlocks, remaining
//   town.totalBlocks / destroyedBlocks / destroyedRatio (0 ~ 1) / aliveCount
//   town.nearestAlive(position) → 가장 가까운 남은 건물 (없으면 null)
//   town.groundHeight(x, z) → 바닥 높이 (길·물 위는 조금 높음) — debris.setGroundHeight 에 넘겨 주세요
//   town.groundKind(x, z) → 바닥 종류 ('water', 'sand' … 없으면 null) ; town.isWet(x, z) → 물 위인지
//   town.monsterStart [x, z] 괴수가 나타나는 자리 ; town.road 큰길 가운데 z
//   town.bounds                     바닥판 범위 { minX, maxX, minZ, maxZ }
//   town.update(dt) ; town.reset() (전부 새것으로) ; town.dispose() (장면에서 빼고 메모리 정리)
//   town.collapseAll()              남은 건물을 차례로 무너뜨림 (마지막 구경거리)
//   town.trample(position, radius)  그 둘레의 나무·울타리 같은 소품을 부숨 (괴수 발걸음·맞은 자리에 저절로 불림)
//   town.setThreat(() => 위치 | null)   마을 사람이 도망칠 상대 (괴수 위치). 안 주면 괴수 발걸음 소식으로 짐작
//
// 듣는 소식: monsterStep { position } → 소품 부수기 / 물이면 첨벙 / 마을 사람 놀라기,  hit { position } → 소품 부수기
// 바닥판 크기는 villainConfig.js 의 town, 바닥 타일 색은 townGround.js, 건물 블록 튼튼함은 마을 설정(data/towns.js)의 hpPerBlock.

import * as THREE from '../../lib/three.js';
import { VILLAIN } from '../villainConfig.js';
import { makeBuilding } from './buildingArt.js';
import { createBuilding } from './building.js';
import { createDecor } from './decor.js';
import { createVillagers } from './villagers.js';
import { createTownGround } from './townGround.js';
import { TOWN_LAYOUT } from './townLayout.js';

const STEP_TRAMPLE = 2.2; // 괴수 발걸음이 소품을 부수는 둘레 (칸)
const HIT_TRAMPLE = 1.6; // 맞은 자리 둘레의 소품도 부서짐
const COLLAPSE_GAP = 0.28; // collapseAll: 건물이 하나씩 무너지는 간격 (초)

export function createTown(scene, { debris = null, events = null, fx = null, layout = TOWN_LAYOUT, hpPerBlock = null, id = 'village', name = null } = {}) {
  const config = VILLAIN.town;
  const bounds = { minX: -config.width / 2, maxX: config.width / 2, minZ: -config.depth / 2, maxZ: config.depth / 2 };
  const blockHp = Number.isFinite(hpPerBlock) && hpPerBlock > 0 ? hpPerBlock : config.hpPerBlock;

  const buildings = layout.buildings.map(({ kind, x0, z0 }) => createBuilding(scene, makeBuilding(kind), { x0, z0, debris, events, fx, hpPerBlock: blockHp }));
  const totalBlocks = buildings.reduce((sum, b) => sum + b.totalBlocks, 0);

  const ground = createTownGround(scene, layout, { debris });
  const decor = createDecor(scene, layout.decor || [], { debris, events });
  const villagers = createVillagers(scene, {
    count: layout.villagers ?? 0,
    bounds,
    buildings,
    debris,
    style: layout.villagerStyle,
    street: layout.street,
    walkable: (x, z) => !ground.isWet(x, z),
  });

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
        ground.splash(position);
      }),
      events.on('hit', ({ position } = {}) => {
        if (position) decor.trample(position, HIT_TRAMPLE);
      }),
    );
  }

  let collapseQueue = null; // collapseAll 진행 중: { list, wait }

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
    ground.update(dt);
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
    id,
    name: name || id,
    layout,
    buildings,
    totalBlocks,
    bounds,
    monsterStart: layout.monsterStart || config.monsterStart,
    road: layout.road ?? config.monsterStart[1],
    decor: decor.items,
    villagers,
    nearestAlive,
    groundHeight: (x, z) => ground.heightAt(x, z),
    groundKind: (x, z) => ground.kindAt(x, z),
    isWet: (x, z) => ground.isWet(x, z),
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
      ground.dispose();
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
