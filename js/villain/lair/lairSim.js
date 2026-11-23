// ─────────────────────────────────────────────────────────────
// 악당 타이쿤: 소굴 계산 (화면·3D 없이 숫자만 — node 에서도 돌아감)
// 소굴 땅 = { size: 한 변 칸 수, nextId, buildings: [{ id, type, x, y, level }] }
//   x, y = 시설의 왼쪽 위 칸 (0 ~ size-1), y 가 클수록 카메라 쪽.
// 모든 함수는 받은 소굴을 고치지 않고 새 소굴을 돌려줍니다.
//
// 쓰는 법
//   tileOwner(lair)                           → Int16Array(size*size): 칸마다 buildings 의 번호(index), 빈칸 -1
//   canPlace(lair, type, x, y, { ignoreId })  → { ok, reason }   reason: '땅 밖이에요' · '다른 시설이 있어요' · '하나만 지을 수 있어요' …
//   place(lair, type, x, y)                   → { lair, id, ok, reason }   (못 놓으면 id: null, 소굴 그대로)
//   move(lair, id, x, y)                      → { lair, ok, reason }
//   remove(lair, id)                          → { lair, refund, ok, reason }   (왕좌는 못 팖)
//   upgrade(lair, id)                         → { lair, price, ok, reason }    (돈은 부르는 쪽에서 빼요)
//   upgradePrice(lair, id) / sellValue(lair, id) → 강화 값 / 팔 때 받는 돈 (못 하면 null)
//   neighbours(lair, buildingOrId)            → 상하좌우로 맞닿은 시설 목록
//   evaluate(lair) → { schemes: [{ key, ownerIds, links: [[idA, idB]], count, effect }],
//                      totals (계책 효과 합), facilityTotals (시설 자체 효과 합), combined (둘 다),
//                      parts: [살 수 있는 부품], extraPartSlots }
//   previewPlace(lair, type, x, y, { moveId }) → { valid, reason, gained: [계책키], lost: [계책키],
//                      delta: { cost: -0.12, … } (시설+계책 효과 변화), changes: [{ key, before, after }], evaluation }
//       새로 지을 시설은 미리보기 안에서 id = lair.nextId 로 셉니다. moveId 를 주면 그 시설을 옮겨 보는 것 (type 무시)
//   growLand(lair, newSize)                   → 땅 넓히기 (시설을 floor((새-옛)/2) 칸씩 밀어 가운데 유지. 좁히지는 않음)
//   growShift(oldSize, newSize)               → 그때 시설이 밀리는 칸 수 (새 칸은 왼쪽·위에 이만큼, 나머지는 오른쪽·아래)
//   schemesOf(evaluation, id)                 → 그 시설이 낀 계책 키 목록
//   countOf(lair, type) / findBuilding(lair, id) / footprint(building) → { x, y, w, h }
//   findSpot(lair, type, { near: {x,y}, ignoreId }) → 놓을 수 있는 가장 가까운 칸 {x,y} 또는 null
//   (새 소굴 만들기 · 망가진 저장 고치기는 lairSave.js 의 startLair / normalizeLair)
//
// 숫자(계책 단계 보너스, 최대 겹침, 판 돈 비율)는 villainConfig.js 의 lair, 시설·계책 표는 data/ 에서 바꿉니다.
// ─────────────────────────────────────────────────────────────

import { VILLAIN } from '../villainConfig.js';
import { FACILITIES, matchesNeed, upgradePriceOf, sellRefundOf } from '../data/facilities.js';
import { SCHEME_LIST } from '../data/schemes.js';

export const REASONS = {
  unknown: '없는 시설이에요',
  outside: '땅 밖이에요',
  occupied: '다른 시설이 있어요',
  onlyOne: '하나만 지을 수 있어요',
  tooMany: (n) => `${n}개까지만 지을 수 있어요`,
  missing: '그 시설이 없어요',
  notSellable: '이 시설은 팔 수 없어요',
  maxLevel: '이미 가장 높은 단계예요',
};

const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];
const EPS = 1e-9;

const sizeOf = (type) => FACILITIES[type]?.size || [1, 1];

function copyLair(lair, buildings) {
  return { ...lair, buildings: buildings ?? lair.buildings.map((b) => ({ ...b })) };
}

export function findBuilding(lair, id) {
  for (const b of lair.buildings) if (b.id === id) return b;
  return null;
}

export function countOf(lair, type, ignoreId = null) {
  let n = 0;
  for (const b of lair.buildings) if (b.type === type && b.id !== ignoreId) n += 1;
  return n;
}

export function footprint(b) {
  const [w, h] = sizeOf(b.type);
  return { x: b.x, y: b.y, w, h };
}

// ── 칸 주인 표 ──
function fillOwners(grid, lair) {
  const n = lair.size;
  grid.fill(-1, 0, n * n);
  lair.buildings.forEach((b, i) => {
    const [w, h] = sizeOf(b.type);
    for (let y = b.y; y < b.y + h; y += 1) {
      if (y < 0 || y >= n) continue;
      for (let x = b.x; x < b.x + w; x += 1) if (x >= 0 && x < n) grid[y * n + x] = i;
    }
  });
  return grid;
}

export function tileOwner(lair) {
  return fillOwners(new Int16Array(lair.size * lair.size), lair);
}

// 계산할 때 다시 쓰는 칸 표 (매번 새로 만들지 않게)
let scratch = new Int16Array(144);
function ownersOf(lair) {
  const need = lair.size * lair.size;
  if (scratch.length < need) scratch = new Int16Array(need);
  return fillOwners(scratch, lair);
}

// ── 놓기 규칙 ──
export function canPlace(lair, type, x, y, { ignoreId = null } = {}) {
  const def = FACILITIES[type];
  if (!def) return { ok: false, reason: REASONS.unknown };
  if (def.maxCount && countOf(lair, type, ignoreId) >= def.maxCount) {
    return { ok: false, reason: def.maxCount === 1 ? REASONS.onlyOne : REASONS.tooMany(def.maxCount) };
  }
  const [w, h] = def.size;
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x + w > lair.size || y + h > lair.size) {
    return { ok: false, reason: REASONS.outside };
  }
  for (const b of lair.buildings) {
    if (b.id === ignoreId) continue;
    const [bw, bh] = sizeOf(b.type);
    if (x < b.x + bw && b.x < x + w && y < b.y + bh && b.y < y + h) return { ok: false, reason: REASONS.occupied };
  }
  return { ok: true, reason: '' };
}

export function freshId(lair) {
  let id = Number.isInteger(lair.nextId) ? lair.nextId : 1;
  for (const b of lair.buildings) if (b.id >= id) id = b.id + 1;
  return id;
}

export function place(lair, type, x, y) {
  const check = canPlace(lair, type, x, y);
  if (!check.ok) return { lair, id: null, ok: false, reason: check.reason };
  const id = freshId(lair);
  const next = copyLair(lair);
  next.buildings.push({ id, type, x, y, level: 1 });
  next.nextId = id + 1;
  return { lair: next, id, ok: true, reason: '' };
}

export function move(lair, id, x, y) {
  const b = findBuilding(lair, id);
  if (!b) return { lair, ok: false, reason: REASONS.missing };
  const check = canPlace(lair, b.type, x, y, { ignoreId: id });
  if (!check.ok) return { lair, ok: false, reason: check.reason };
  return { lair: copyLair(lair, lair.buildings.map((o) => (o.id === id ? { ...o, x, y } : { ...o }))), ok: true, reason: '' };
}

export function remove(lair, id) {
  const b = findBuilding(lair, id);
  if (!b) return { lair, refund: 0, ok: false, reason: REASONS.missing };
  if (FACILITIES[b.type] && !FACILITIES[b.type].sellable) return { lair, refund: 0, ok: false, reason: REASONS.notSellable };
  const refund = sellRefundOf(b.type, b.level);
  return { lair: copyLair(lair, lair.buildings.filter((o) => o.id !== id).map((o) => ({ ...o }))), refund, ok: true, reason: '' };
}

export function upgradePrice(lair, id) {
  const b = findBuilding(lair, id);
  return b ? upgradePriceOf(b.type, b.level) : null;
}

export function sellValue(lair, id) {
  const b = findBuilding(lair, id);
  if (!b || !FACILITIES[b.type]?.sellable) return null;
  return sellRefundOf(b.type, b.level);
}

export function upgrade(lair, id) {
  const b = findBuilding(lair, id);
  if (!b) return { lair, price: 0, ok: false, reason: REASONS.missing };
  const price = upgradePriceOf(b.type, b.level);
  if (price === null) return { lair, price: 0, ok: false, reason: REASONS.maxLevel };
  return { lair: copyLair(lair, lair.buildings.map((o) => (o.id === id ? { ...o, level: o.level + 1 } : { ...o }))), price, ok: true, reason: '' };
}

// ── 이웃 ──
// 시설 둘레 칸을 한 바퀴 돌며 다른 시설 번호를 모아 out 에 넣고 개수를 돌려줌
function collectNeighbours(lair, grid, bi, out) {
  const n = lair.size;
  const b = lair.buildings[bi];
  const [w, h] = sizeOf(b.type);
  let count = 0;
  const add = (x, y) => {
    if (x < 0 || y < 0 || x >= n || y >= n) return;
    const o = grid[y * n + x];
    if (o === -1 || o === bi) return;
    for (let k = 0; k < count; k += 1) if (out[k] === o) return;
    out[count] = o;
    count += 1;
  };
  for (let x = b.x; x < b.x + w; x += 1) {
    add(x, b.y - 1);
    add(x, b.y + h);
  }
  for (let y = b.y; y < b.y + h; y += 1) {
    add(b.x - 1, y);
    add(b.x + w, y);
  }
  return count;
}

export function neighbours(lair, building) {
  const id = typeof building === 'object' && building ? building.id : building;
  const bi = lair.buildings.findIndex((b) => b.id === id);
  if (bi < 0) return [];
  const grid = ownersOf(lair);
  const out = [];
  const count = collectNeighbours(lair, grid, bi, out);
  return out.slice(0, count).map((i) => lair.buildings[i]);
}

// ── 계책 판정 ──
const nbBuf = new Int16Array(32);
const linkBuf = [];

function checkAdjacent(lair, scheme, nbCount) {
  for (const req of scheme.adjacent || []) {
    let hit = 0;
    for (let k = 0; k < nbCount; k += 1) if (matchesNeed(lair.buildings[nbBuf[k]].type, req.need)) hit += 1;
    if (hit < (req.count || 1)) return false;
  }
  return true;
}

// 십자: 1×1 시설의 상하좌우 칸이 모두 need 시설
function checkCross(lair, grid, bi, need, links) {
  const b = lair.buildings[bi];
  const [w, h] = sizeOf(b.type);
  if (w !== 1 || h !== 1) return false;
  const n = lair.size;
  for (let d = 0; d < 4; d += 1) {
    const x = b.x + DX[d];
    const y = b.y + DY[d];
    if (x < 0 || y < 0 || x >= n || y >= n) return false;
    const o = grid[y * n + x];
    if (o === -1 || !matchesNeed(lair.buildings[o].type, need)) return false;
  }
  for (let d = 0; d < 4; d += 1) links.push(grid[(b.y + DY[d]) * n + b.x + DX[d]]);
  return true;
}

// 둘러싸기: 시설에 맞닿은 땅 칸이 하나도 비어 있지 않음
function checkSurround(lair, grid, bi) {
  const n = lair.size;
  const b = lair.buildings[bi];
  const [w, h] = sizeOf(b.type);
  let inside = 0;
  const filled = (x, y) => {
    if (x < 0 || y < 0 || x >= n || y >= n) return true;
    inside += 1;
    return grid[y * n + x] !== -1;
  };
  for (let x = b.x; x < b.x + w; x += 1) if (!filled(x, b.y - 1) || !filled(x, b.y + h)) return false;
  for (let y = b.y; y < b.y + h; y += 1) if (!filled(b.x - 1, y) || !filled(b.x + w, y)) return false;
  return inside > 0;
}

function addEffect(into, effect, times) {
  for (const k in effect) into[k] = (into[k] || 0) + effect[k] * times;
}

function tidy(obj) {
  for (const k in obj) {
    const v = Math.round(obj[k] * 1e6) / 1e6;
    if (Math.abs(v) < EPS) delete obj[k];
    else obj[k] = v;
  }
  return obj;
}

export function evaluate(lair) {
  const list = lair.buildings;
  const grid = ownersOf(lair);
  const bonus = VILLAIN.lair.schemeLevelBonus;
  const maxInst = VILLAIN.lair.schemeMaxInstances;
  // 시설마다 이웃 번호 (한 번만 셈)
  const nbStart = new Int16Array(list.length + 1);
  const nbAll = [];
  for (let i = 0; i < list.length; i += 1) {
    nbStart[i] = nbAll.length;
    const count = collectNeighbours(lair, grid, i, nbBuf);
    for (let k = 0; k < count; k += 1) nbAll.push(nbBuf[k]);
  }
  nbStart[list.length] = nbAll.length;

  const schemes = [];
  const totals = {};
  for (const scheme of SCHEME_LIST) {
    let owners = null;
    for (let i = 0; i < list.length; i += 1) {
      if (!matchesNeed(list[i].type, scheme.self)) continue;
      const links = linkBuf;
      links.length = 0;
      let ok;
      if (scheme.shape === 'cross') {
        ok = checkCross(lair, grid, i, scheme.adjacent?.[0]?.need || '*', links);
      } else {
        const count = nbStart[i + 1] - nbStart[i];
        for (let k = 0; k < count; k += 1) nbBuf[k] = nbAll[nbStart[i] + k];
        ok = checkAdjacent(lair, scheme, count) && (scheme.shape !== 'surround' || checkSurround(lair, grid, i));
        if (ok) {
          for (let k = 0; k < count; k += 1) {
            const o = nbBuf[k];
            const useful = scheme.shape === 'surround' || (scheme.adjacent || []).some((req) => matchesNeed(list[o].type, req.need));
            if (useful) links.push(o);
          }
        }
      }
      if (!ok) continue;
      (owners ||= []).push({ i, links: links.slice() });
    }
    if (!owners) continue;
    // 단계 높은 시설부터 (같으면 먼저 지은 것) 최대 maxInst 곳
    owners.sort((a, b) => list[b.i].level - list[a.i].level || list[a.i].id - list[b.i].id);
    if (owners.length > maxInst) owners.length = maxInst;
    const effect = {};
    const ownerIds = [];
    const links = [];
    for (const o of owners) {
      const owner = list[o.i];
      ownerIds.push(owner.id);
      for (const l of o.links) links.push([owner.id, list[l].id]);
      addEffect(effect, scheme.effect, 1 + bonus * (owner.level - 1));
    }
    tidy(effect);
    addEffect(totals, effect, 1);
    schemes.push({ key: scheme.key, tier: scheme.tier, ownerIds, links, count: owners.length, effect });
  }

  // 시설 자체 효과 + 연구실이 연 부품·부품 칸
  const facilityTotals = {};
  const parts = new Set(VILLAIN.lair.baseParts);
  let extraPartSlots = 0;
  for (const b of list) {
    const def = FACILITIES[b.type];
    if (!def) continue;
    addEffect(facilityTotals, def.effect || {}, b.level);
    const unlocks = def.unlocks;
    if (!unlocks) continue;
    for (const [lv, types] of Object.entries(unlocks.parts || {})) if (b.level >= Number(lv)) for (const t of types) parts.add(t);
    for (const [lv, n] of Object.entries(unlocks.partSlots || {})) if (b.level >= Number(lv)) extraPartSlots += n;
  }
  tidy(totals);
  tidy(facilityTotals);
  const combined = { ...facilityTotals };
  addEffect(combined, totals, 1);
  tidy(combined);
  return { schemes, totals, facilityTotals, combined, parts: [...parts], extraPartSlots };
}

export function schemesOf(evaluation, id) {
  const out = [];
  for (const s of evaluation?.schemes || []) {
    if (s.ownerIds.includes(id) || s.links.some((l) => l[1] === id)) out.push(s.key);
  }
  return out;
}

// ── 미리보기: 여기 놓으면 무엇이 켜지고 꺼지나 ──
export function previewPlace(lair, type, x, y, { moveId = null } = {}) {
  let after = null;
  let check;
  if (moveId !== null && moveId !== undefined) {
    const b = findBuilding(lair, moveId);
    check = b ? canPlace(lair, b.type, x, y, { ignoreId: moveId }) : { ok: false, reason: REASONS.missing };
    if (check.ok) after = { ...lair, buildings: lair.buildings.map((o) => (o.id === moveId ? { ...o, x, y } : o)) };
  } else {
    check = canPlace(lair, type, x, y);
    if (check.ok) after = { ...lair, buildings: [...lair.buildings, { id: freshId(lair), type, x, y, level: 1 }] };
  }
  if (!after) return { valid: false, reason: check.reason, gained: [], lost: [], delta: {}, changes: [], evaluation: null };
  const before = evaluate(lair);
  const next = evaluate(after);
  const countBefore = {};
  for (const s of before.schemes) countBefore[s.key] = s.count;
  const gained = [];
  const lost = [];
  const changes = [];
  for (const s of next.schemes) {
    const was = countBefore[s.key] || 0;
    if (!was) gained.push(s.key);
    if (was !== s.count) changes.push({ key: s.key, before: was, after: s.count });
    delete countBefore[s.key];
  }
  for (const key in countBefore) {
    lost.push(key);
    changes.push({ key, before: countBefore[key], after: 0 });
  }
  const delta = { ...next.combined };
  for (const k in before.combined) delta[k] = (delta[k] || 0) - before.combined[k];
  return { valid: true, reason: '', gained, lost, delta: tidy(delta), changes, evaluation: next };
}

// ── 땅 넓히기 ──
// 새 칸이 둘레에 생기고 시설은 floor((새-옛)/2) 칸씩 밀려 가운데를 지킴 (3D 화면 lairView 도 같은 식으로 계산)
export function growShift(oldSize, newSize) {
  return newSize > oldSize ? Math.floor((newSize - oldSize) / 2) : 0;
}

export function growLand(lair, newSize) {
  const size = Math.floor(Number(newSize));
  if (!(size > lair.size)) return copyLair(lair);
  const shift = growShift(lair.size, size);
  return { ...lair, size, buildings: lair.buildings.map((b) => ({ ...b, x: b.x + shift, y: b.y + shift })) };
}

// near 에서 가장 가까운 놓을 수 있는 칸
export function findSpot(lair, type, { near = null, ignoreId = null } = {}) {
  const def = FACILITIES[type];
  if (!def) return null;
  const [w, h] = def.size;
  const cx = near ? near.x : (lair.size - w) / 2;
  const cy = near ? near.y : (lair.size - h) / 2;
  let best = null;
  let bestD = Infinity;
  for (let y = 0; y + h <= lair.size; y += 1) {
    for (let x = 0; x + w <= lair.size; x += 1) {
      const d = (x - cx) ** 2 + (y - cy) ** 2;
      if (d >= bestD || !canPlace(lair, type, x, y, { ignoreId }).ok) continue;
      best = { x, y };
      bestD = d;
    }
  }
  return best;
}
