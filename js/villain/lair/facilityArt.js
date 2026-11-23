// 소굴 시설 그림 (장난감 블록 시설: 종류 × 단계 1~3)
// 시설 종류(facilities.js 의 key)와 단계를 주면 블록 목록을 돌려줍니다. 한 번 만든 그림은 기억해 두고 다시 씁니다.
// 그림이 없는 새 시설은 '태그 색으로 칠한 블록 오두막'으로 대신 그립니다 (시설 표만 고쳐도 화면이 깨지지 않음).
// 2단계는 깃발, 3단계는 금관이 지붕 위에 붙습니다.
//
//   facilityArt(type, level) → art
//     art = { type, level, w, h (칸), W, D (블록 칸),
//             solid: [{ x, y, z, hex }], glow: [{ x, y, z, hex }]   보통 블록 / 빛나는 블록 (시설 가운데 = 0, 땅 = y 0)
//             anims: [{ kind, pivot: {x,y,z}, solid, glow, speed, axis, amount, phase }]   움직이는 조각
//             emitters: [{ kind, x, y, z }]                                             연기·불티 나오는 자리
//             height, top: {x,y,z}, bounds: { minX, maxX, minY, maxY, minZ, maxZ },
//             pick: { minX, maxX, minZ, maxZ, maxY } (누르기 상자: 시설 자리 안 + 움직이는 조각 뺌) }
//   facilitySize(type) → [w, h]          시설 크기 (칸). 시설 표에 없으면 [1, 1]
//   FACILITY_ART_KEYS                     직접 그린 그림이 있는 시설 종류 목록
//
// 그림 자체는 facilityArtBig.js(2×2), facilityArtSmall.js(1×1), 오두막 색은 아래 TAG_TINT 에서 바꿉니다.

import { FACILITIES } from '../data/facilities.js';
import { TILE } from './lairKit.js';
import { C, createArtShape, crown, smallCrown, flag } from './artShape.js';
import { BIG_ART } from './facilityArtBig.js';
import { SMALL_ART } from './facilityArtSmall.js';

// 직접 그린 그림 (그림을 그린 크기 [가로, 세로] 칸)
const DRAWN = {
  throne: [BIG_ART.throne, [2, 2]],
  factory: [BIG_ART.factory, [2, 2]],
  lab: [BIG_ART.lab, [2, 2]],
  training: [BIG_ART.training, [2, 2]],
  forge: [BIG_ART.forge, [2, 2]],
  paint: [SMALL_ART.paint, [1, 1]],
  vault: [SMALL_ART.vault, [1, 1]],
  watchtower: [SMALL_ART.watchtower, [1, 1]],
  traps: [SMALL_ART.traps, [1, 1]],
  bats: [SMALL_ART.bats, [1, 1]],
  lava: [SMALL_ART.lava, [1, 1]],
};
export const FACILITY_ART_KEYS = Object.keys(DRAWN);

// 그림이 없는 시설: 첫 태그 → 지붕 색
const TAG_TINT = {
  왕: C.yellow,
  공: C.darkRed,
  물: C.blue,
  연: C.teal,
  훈: C.red,
  금: C.yellow,
  감: C.purple,
  함: C.dark,
  소: C.magenta,
  용: C.orange,
};

const cache = new Map();

export function facilitySize(type) {
  const size = FACILITIES?.[type]?.size;
  if (Array.isArray(size) && size[0] > 0 && size[1] > 0) return [size[0] | 0, size[1] | 0];
  return DRAWN[type]?.[1] ?? [1, 1];
}

export function facilityArt(type, level = 1) {
  const lv = Math.max(1, Math.min(3, Math.round(level) || 1));
  const key = `${type}:${lv}`;
  if (cache.has(key)) return cache.get(key);
  const [w, h] = facilitySize(type);
  const drawn = DRAWN[type];
  let made;
  try {
    made = drawn && drawn[1][0] === w && drawn[1][1] === h ? drawn[0](lv) : hut(type, lv, w, h);
  } catch (error) {
    console.warn(`[lair] 시설 그림 오류 (${type})`, error);
    made = hut(type, lv, w, h);
  }
  const art = finish(type, lv, w, h, made);
  cache.set(key, art);
  return art;
}

// ── 그림이 없는 시설용 블록 오두막 (태그 색 지붕, 단계마다 한 층 더) ──
function hut(type, level, w, h) {
  const s = createArtShape();
  const W = w * TILE;
  const D = h * TILE;
  const tags = FACILITIES?.[type]?.tags ?? [];
  const tint = TAG_TINT[tags[0]] ?? C.lavender;
  const wallH = 1 + level;
  s.box(1, 0, 1, W - 2, 0, D - 2, C.black);
  s.walls(1, 1, 1, W - 2, wallH, D - 2, C.dark);
  const doorX = Math.floor((W - 1) / 2);
  s.box(doorX, 1, D - 2, doorX, Math.min(2, wallH), D - 2, C.black);
  if (W >= 5) s.glow(1, wallH, D - 2, C.lime);
  // 계단 지붕
  let k = 0;
  for (; 1 + k <= W - 2 - k && 1 + k <= D - 2 - k; k++) {
    s.box(1 + k, wallH + 1 + k, 1 + k, W - 2 - k, wallH + 1 + k, D - 2 - k, k % 2 ? C.black : tint);
  }
  return { shape: s, top: [doorX, wallH + 1 + k, Math.floor((D - 1) / 2)] };
}

// 칸 좌표 그림 → 시설 가운데 기준 블록 좌표 + 단계 장식 + 크기 정보
function finish(type, level, w, h, made) {
  const W = w * TILE;
  const D = h * TILE;
  const s = made.shape;
  const top = made.top ?? [Math.floor(W / 2), s.topAt(Math.floor(W / 2), Math.floor(D / 2)), Math.floor(D / 2)];
  if (made.badge !== false) {
    if (level === 2) flag(s, top[0], top[1], top[2], C.magenta, 3);
    if (level === 3) (w > 1 ? crown : smallCrown)(s, top[0], top[1], top[2]);
  }
  const ox = -W / 2 + 0.5;
  const oz = -D / 2 + 0.5;
  const solid = [];
  const glow = [];
  const bounds = { minX: Infinity, maxX: -Infinity, minY: 0, maxY: 0, minZ: Infinity, maxZ: -Infinity };
  const grow = (x, y, z) => {
    bounds.minX = Math.min(bounds.minX, x - 0.5);
    bounds.maxX = Math.max(bounds.maxX, x + 0.5);
    bounds.maxY = Math.max(bounds.maxY, y + 0.5);
    bounds.minZ = Math.min(bounds.minZ, z - 0.5);
    bounds.maxZ = Math.max(bounds.maxZ, z + 0.5);
  };
  for (const v of s.voxels()) {
    const voxel = { x: v.x + ox, y: v.y + 0.5, z: v.z + oz, hex: v.hex };
    (v.glow ? glow : solid).push(voxel);
    grow(voxel.x, voxel.y, voxel.z);
  }
  // 누르기 상자: 움직이는 조각은 빼고, 시설 자리(칸) 밖으로는 안 나가게
  const pick = {
    minX: Math.max(-W / 2, bounds.minX),
    maxX: Math.min(W / 2, bounds.maxX),
    minZ: Math.max(-D / 2, bounds.minZ),
    maxZ: Math.min(D / 2, bounds.maxZ),
    maxY: Math.max(1.2, bounds.maxY),
  };
  const anims = (made.anims ?? []).map((a) => {
    const pivot = { x: a.pivot[0] + ox, y: a.pivot[1] + 0.5, z: a.pivot[2] + oz };
    const parts = { solid: [], glow: [] };
    for (const v of a.voxels) {
      parts[v.glow ? 'glow' : 'solid'].push({ x: v.x, y: v.y, z: v.z, hex: v.hex });
      grow(pivot.x + v.x, pivot.y + v.y, pivot.z + v.z);
    }
    return { kind: a.kind, pivot, ...parts, speed: a.speed ?? 1, axis: a.axis ?? 'y', amount: a.amount ?? 0.3, phase: a.phase ?? 0 };
  });
  const emitters = (made.emitters ?? []).map((e) => ({ kind: e.kind, x: e.at[0] + ox, y: e.at[1], z: e.at[2] + oz }));
  if (!Number.isFinite(bounds.minX)) Object.assign(bounds, { minX: -W / 2, maxX: W / 2, minZ: -D / 2, maxZ: D / 2, maxY: 1 });
  return {
    type,
    level,
    w,
    h,
    W,
    D,
    solid,
    glow,
    anims,
    emitters,
    height: bounds.maxY,
    top: { x: top[0] + ox, y: top[1] + 2, z: top[2] + oz },
    bounds,
    pick,
  };
}
