// ─────────────────────────────────────────────────────────────
// 악당 타이쿤: 악명 단계
// 습격으로 악명을 모으면 단계가 올라요 → 소굴 땅이 넓어지고, 새 시설·새 마을이 열려요.
//
// 단계 하나 = { rank, name, emoji, at: 필요한 악명, lairSize: 소굴 땅 한 변 칸 수,
//              perks?: { partSlots: +칸, pay: +0.1, ... } (이 단계부터 계속 받는 덤) }
//
// 쓰는 법
//   RANKS                       단계 표 (낮은 단계부터)
//   rankFor(notoriety)          지금 단계 정보
//   nextRank(notoriety)         다음 단계 정보 (끝까지 왔으면 null)
//   rankProgress(notoriety)     다음 단계까지 0~1 (끝 단계면 1)
//   lairSizeFor(notoriety)      그 악명의 소굴 땅 크기
//   rankPerks(notoriety)        지금까지 받은 덤 합계 { partSlots, pay, ... }
//   unlocksAtRank(rank)         그 단계에서 새로 열리는 것 { facilities, towns, lairSize, perks } (단계 오름 알림용)
// ─────────────────────────────────────────────────────────────

import { FACILITY_LIST } from './facilities.js';
import { TOWN_LIST } from './towns.js';
import { L } from '../lang/lang.js';

export const RANKS = [
  { rank: 0, name: L({ ko: '동네 말썽꾼', en: 'Little Rascal' }), emoji: '😼', at: 0, lairSize: 8 },
  { rank: 1, name: L({ ko: '골목 악당', en: 'Alley Nuisance' }), emoji: '😈', at: 200, lairSize: 9 }, // (E 조정: 160 → 200)
  { rank: 2, name: L({ ko: '마을의 공포', en: 'Town Terror' }), emoji: '👹', at: 500, lairSize: 10, perks: { partSlots: 1 } },
  { rank: 3, name: L({ ko: '왕국의 골칫거리', en: 'Kingdom Menace' }), emoji: '👺', at: 1200, lairSize: 11 }, // (E 조정: 1100 → 1200)
  { rank: 4, name: L({ ko: '전설의 대마왕', en: 'Legendary Overlord' }), emoji: '🐲', at: 2500, lairSize: 12, perks: { pay: 0.1, notoriety: 0.1 } },
];

function amount(notoriety) {
  const n = Number(notoriety);
  return Number.isFinite(n) ? n : 0;
}

export function rankFor(notoriety) {
  const n = amount(notoriety);
  let found = RANKS[0];
  for (const r of RANKS) if (n >= r.at) found = r;
  return found;
}

export function nextRank(notoriety) {
  return RANKS[rankFor(notoriety).rank + 1] || null;
}

export function rankProgress(notoriety) {
  const now = rankFor(notoriety);
  const next = nextRank(notoriety);
  if (!next) return 1;
  return Math.max(0, Math.min(1, (amount(notoriety) - now.at) / (next.at - now.at)));
}

export function lairSizeFor(notoriety) {
  return rankFor(notoriety).lairSize;
}

export function rankPerks(notoriety) {
  const out = {};
  const top = rankFor(notoriety).rank;
  for (const r of RANKS) {
    if (r.rank > top || !r.perks) continue;
    for (const [k, v] of Object.entries(r.perks)) out[k] = (out[k] || 0) + v;
  }
  return out;
}

export function unlocksAtRank(rank) {
  const r = RANKS[rank] || null;
  return {
    rank: r,
    facilities: FACILITY_LIST.filter((d) => d.unlockRank === rank),
    towns: TOWN_LIST.filter((t) => t.unlockRank === rank),
    lairSize: r ? r.lairSize : null,
    perks: r?.perks || {},
  };
}
