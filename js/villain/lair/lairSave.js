// ─────────────────────────────────────────────────────────────
// 악당 타이쿤: 소굴 새로 만들기 · 저장된 소굴 고치기 (화면 없이 숫자만)
// 저장 보관함(data/saveStore.js)이 불러올 때마다 씁니다.
//
// 쓰는 법
//   startLair()                          → 새 소굴 (villainConfig.js 의 lair.startLayout: 가운데 왕좌 + 옆 괴수 공장)
//   normalizeLair(raw, { minSize })      → { lair, refund }
//       모르는 시설은 버리고, 겹치거나 땅 밖에 있는 시설은 가장 가까운 빈자리로 옮기고,
//       자리가 없거나 개수를 넘으면 버리고 그 시설에 쓴 돈(refund)을 돌려줌. 왕좌가 없으면 새로 세움.
//       땅이 minSize(악명 단계의 땅 크기)보다 작으면 growLand 로 넓힘.
// ─────────────────────────────────────────────────────────────

import { VILLAIN } from '../villainConfig.js';
import { FACILITIES, spentOn } from '../data/facilities.js';
import { RANKS } from '../data/ranks.js';
import { canPlace, findSpot, freshId, growLand, REASONS } from './lairSim.js';

export function startLair() {
  const buildings = VILLAIN.lair.startLayout.map((b, i) => ({ id: i + 1, type: b.type, x: b.x, y: b.y, level: 1 }));
  return { size: RANKS[0].lairSize, nextId: buildings.length + 1, buildings };
}

const toInt = (v, fallback) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : fallback);

// 망가진 저장도 쓸 수 있게: 모르는 시설·겹친 시설·땅 밖 시설은 빈 곳으로 옮기고, 자리가 없으면 판 값(refund)으로 돌려줌
export function normalizeLair(raw, { minSize = RANKS[0].lairSize } = {}) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.buildings)) {
    const fresh = startLair();
    return { lair: minSize > fresh.size ? growLand(fresh, minSize) : fresh, refund: 0 };
  }
  const maxSize = RANKS[RANKS.length - 1].lairSize;
  const size = Math.max(RANKS[0].lairSize, Math.min(maxSize, toInt(raw.size, RANKS[0].lairSize)));
  let lair = { size, nextId: 1, buildings: [] };
  let refund = 0;
  const usedIds = new Set();
  let nextId = Math.max(1, toInt(raw.nextId, 1));
  for (const b of raw.buildings) {
    if (b && Number.isInteger(b.id) && b.id >= nextId) nextId = b.id + 1;
  }
  for (const rb of raw.buildings) {
    const def = rb && FACILITIES[rb.type];
    if (!def) continue;
    const level = Math.max(1, Math.min(def.levels, toInt(rb.level, 1)));
    let id = Number.isInteger(rb.id) && rb.id > 0 && !usedIds.has(rb.id) ? rb.id : null;
    if (id === null) id = nextId++;
    let x = toInt(rb.x, -1);
    let y = toInt(rb.y, -1);
    const check = canPlace(lair, rb.type, x, y);
    if (!check.ok) {
      const spot = check.reason === REASONS.outside || check.reason === REASONS.occupied ? findSpot(lair, rb.type) : null;
      if (!spot) {
        refund += spentOn(rb.type, level); // 자리가 없으면 쓴 돈을 다 돌려줌
        continue;
      }
      ({ x, y } = spot);
    }
    usedIds.add(id);
    lair.buildings.push({ id, type: rb.type, x, y, level });
  }
  lair.nextId = Math.max(nextId, freshId(lair));
  // 왕좌는 꼭 하나
  if (!lair.buildings.some((b) => b.type === 'throne')) {
    const spot = findSpot(lair, 'throne');
    if (spot) {
      lair.buildings.push({ id: lair.nextId, type: 'throne', x: spot.x, y: spot.y, level: 1 });
      lair.nextId += 1;
    }
  }
  if (minSize > lair.size) lair = growLand(lair, Math.min(maxSize, minSize));
  return { lair, refund: Math.floor(refund) };
}
