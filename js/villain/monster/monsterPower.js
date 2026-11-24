// 괴수 '몸집 점수' → 출동 값 · 체력 · 빠르기
// 예전에는 그림에 칠한 칸 수만 셌어요. 이제 두께도 셉니다:
//   그림판 괴수: 칸 하나 = 1점. 두께 붓으로 정한 칸은 (정한 두께 ÷ 자동 두께) 점 (너무 작거나 크지 않게 잘라 씀)
//               → 얇게 하면 싸고 약하고 빠르고, 두껍게 하면 비싸고 튼튼하고 느려요. 두께를 안 건드린 그림은 예전과 똑같아요.
//   3D 블록 괴수: 블록 수 ÷ 기준 두께 (자동 그림 한 칸이 평균 이만큼 블록이라서, 같은 부피면 그림과 값이 비슷)
//
//   designPower(design) → 몸집 점수 (그림판 괴수는 두께를 안 건드리면 칠한 칸 수와 같음)
//   designStats(design) → { cells, voxels, power, hp, speed, bodyCost }   bodyCost: 부품을 뺀 몸값 (올림 전)
//   isVoxelDesign(design) / voxelCount(design) / paintedCells(design)
//
// 숫자는 villainConfig.js 의 monster (costPerBlock, hpPerBlock, baseSpeed, slowPerBlock, minSpeed, thickness)
// 와 sculpt.refDepth 에서 바꿉니다.

import { VILLAIN } from '../villainConfig.js';
import { readCells } from './monsterDepth.js';

const CACHE_MAX = 80; // 같은 그림을 여러 번 계산하지 않게 기억해 두는 수
const cache = new Map();

export const isVoxelDesign = (design) => design?.kind === 'voxel' && !!design.voxels;

export function paintedCells(design) {
  let count = 0;
  const cols = design?.cols || VILLAIN.draw.cols;
  for (const line of (design?.cells || []).slice(0, design?.rows || VILLAIN.draw.rows)) for (const ch of String(line ?? '').slice(0, cols)) if (ch !== '.' && ch !== ' ') count++;
  return count;
}

export function voxelCount(design) {
  let count = 0;
  for (const layer of design?.voxels?.layers || []) for (const line of layer || []) for (const ch of String(line ?? '')) if (ch !== '.' && ch !== ' ') count++;
  return count;
}

const hasDepths = (design) => Array.isArray(design?.depths) && design.depths.some((line) => /[1-9]/.test(String(line ?? '')));

export function designPower(design) {
  if (isVoxelDesign(design)) return voxelCount(design) / (VILLAIN.sculpt?.refDepth || 3);
  if (!hasDepths(design)) return paintedCells(design); // 두께를 안 건드린 그림: 예전 그대로 (칸 수)
  const key = `${(design.cells || []).join('')}|${design.depths.join('')}`;
  if (cache.has(key)) return cache.get(key);
  const { minWeight = 0.4, maxWeight = 2.2 } = VILLAIN.monster.thickness || {};
  let power = 0;
  for (const cell of readCells(design)) power += cell.set ? Math.min(maxWeight, Math.max(minWeight, cell.depth / cell.auto)) : 1;
  power = Math.round(power * 100) / 100;
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(key, power);
  return power;
}

export function designStats(design) {
  const m = VILLAIN.monster;
  const power = designPower(design);
  return {
    cells: paintedCells(design),
    voxels: isVoxelDesign(design) ? voxelCount(design) : null,
    power,
    hp: Math.max(1, power * m.hpPerBlock),
    speed: Math.max(m.minSpeed, m.baseSpeed / (1 + power * m.slowPerBlock)),
    bodyCost: power * m.costPerBlock,
  };
}
