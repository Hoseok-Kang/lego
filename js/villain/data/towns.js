// ─────────────────────────────────────────────────────────────
// 악당 타이쿤: 습격할 마을 셋
// 악명 단계가 오르면 새 마을이 열려요. 마을마다 지키는 영웅이 다르고, 버는 돈·악명도 달라요.
//
// 마을 하나 = {
//   id, name, emoji, layout: 마을 배치 이름 (js/villain/town/* 가 이 이름으로 배치를 고름),
//   hero: VILLAIN.heroes 의 영웅 이름 ('knight' | 'iceMage' | 'guardian'),
//   unlockRank: 필요한 악명 단계, payMul: 습격 수입 배수, notorietyBase: 한 판 기본 악명,
//   hpPerBlock: 건물 블록 하나 떼는 데 드는 피해 (클수록 단단), blurb: 마을 소개 한 줄, heroHint: 영웅 공략 한 줄 }
//
// 쓰는 법
//   TOWNS[id] / TOWN_LIST / getTown(id)   (모르는 id 면 꼬마 마을)
//   heroOf(town | id)              → 영웅 숫자 (VILLAIN.heroes.*)
//   isTownOpen(town | id, rank)    → 그 악명 단계에서 갈 수 있는지
//   openTowns(rank)                → 갈 수 있는 마을 목록
// ─────────────────────────────────────────────────────────────

import { VILLAIN } from '../villainConfig.js';

const LIST = [
  {
    id: 'village',
    name: '꼬마 마을',
    emoji: '🏘️',
    layout: 'village',
    hero: 'knight',
    unlockRank: 0,
    payMul: 1,
    notorietyBase: 20,
    hpPerBlock: VILLAIN.town.hpPerBlock,
    blurb: '풍차가 도는 조용한 마을이에요. 첫 습격에 딱 좋아요.',
  },
  {
    id: 'harbor',
    name: '바닷가 마을',
    emoji: '⚓',
    layout: 'harbor',
    hero: 'iceMage',
    unlockRank: 1,
    payMul: 1.2, // (E 조정: 1.4 → 1.2)
    notorietyBase: 40,
    hpPerBlock: 1,
    blurb: '등대와 생선 가게가 있는 항구예요. 배를 와장창 부숴요.',
  },
  {
    id: 'castle',
    name: '왕궁 성곽',
    emoji: '🏰',
    layout: 'castle',
    hero: 'guardian',
    unlockRank: 3,
    payMul: 1.35, // (E 조정: 2 → 1.35 — 성곽은 블록이 많아 이미 많이 벌어요)
    notorietyBase: 70,
    hpPerBlock: 1.4,
    blurb: '튼튼한 성벽 안에 임금님 궁전이 있어요. 부수면 대박이에요.',
  },
];

for (const town of LIST) town.heroHint = VILLAIN.heroes[town.hero]?.hint ?? '';

export const TOWN_LIST = LIST;
export const TOWNS = Object.fromEntries(LIST.map((t) => [t.id, t]));

export function getTown(id) {
  if (id && typeof id === 'object') return id;
  return TOWNS[id] || TOWNS.village;
}

export function heroOf(town) {
  return VILLAIN.heroes[getTown(town).hero] || VILLAIN.hero;
}

export function isTownOpen(town, rank) {
  return (Number(rank) || 0) >= getTown(town).unlockRank;
}

export function openTowns(rank) {
  return LIST.filter((t) => isTownOpen(t, rank));
}
