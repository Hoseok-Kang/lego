// 습격 규칙 계산 (어느 마을인지, 어떤 영웅이 오는지, 소굴 효과가 얼마나 붙는지를 한곳에서)
// raid.start(design, { town, mods }) 가 이것으로 '이번 판 설정' 을 만듭니다. 3D 와 상관없는 계산이라 node 에서도 시험할 수 있어요.
//
//   resolveTown(town) → 마을 설정 { id, name, layout, hero, payMul, notorietyBase, hpPerBlock, … }
//       town: 마을 id ('village' | 'harbor' | 'castle') 또는 마을 설정 그대로. 없거나 모르는 id 면 'village'
//   townList() → 마을 설정 목록
//   normalizeMods(mods) → 빠진 값을 '효과 없음' 으로 채운 소굴 효과 (배율 1, 더하기 0)
//   planRaid(design, { town, mods }, costOf?) → 이번 판 설정 (영웅이 나오는 시점은 그 마을 영웅의 숫자 VILLAIN.heroes[hero])
//       { town, mods, cost, heroKind, heroAt, heroLatest, payPerBlock, payMul, monster: { hpMul, dmgMul, partDmgMul, smashMul } }
//       cost: 출동 값 (lair/modifiers.js 의 raidCost), heroAt: 마을이 이만큼 부서지면 영웅 출동 (감시탑 효과로 늦어짐, 최대 HERO_DELAY_CAP)
//       payPerBlock: 블록 하나당 버는 돈 (기본 × 소굴 수입 배율 × 마을 수입 배율)
//   notorietyOf(result, town, mods) → 이번 판에 얻는 악명 (lair/modifiers.js 의 notorietyFor)
//
// 마을 설정은 js/villain/data/towns.js, 소굴 효과 계산은 js/villain/lair/modifiers.js, 영웅 출동 기본 시점은 villainConfig.js 의 heroes (마을 영웅마다).

import { VILLAIN } from '../villainConfig.js';
import { TOWN_LIST } from '../data/towns.js';
import { raidCost, notorietyFor } from '../lair/modifiers.js';
import { heroStats } from '../hero/hero.js';

const HERO_DELAY_CAP = 0.8; // 감시탑으로 늦춰도 영웅은 마을이 이만큼 부서지기 전에는 꼭 옴 (villainConfig 의 lair.heroDelayCap 이 있으면 그것)
const LATEST_PER_DELAY = 40; // 영웅 출동이 늦춰진 만큼(비율 1 당) '늦어도 이때는 옴' 시간도 이만큼(초) 늘어남

const NEUTRAL = {
  costMul: 1, hpMul: 1, dmgMul: 1, partDmgMul: 1, smashMul: 1, payMul: 1, notorietyMul: 1, heroHpMul: 1,
  heroDelay: 0, raidBonus: 0,
};

export function townList() {
  return TOWN_LIST;
}

export function resolveTown(town) {
  if (town && typeof town === 'object') return { ...(findTown(town.id) || {}), ...town };
  return findTown(town) || findTown('village') || TOWN_LIST[0];
}

function findTown(id) {
  if (!id) return null;
  return TOWN_LIST.find((t) => t.id === id) || null;
}

export function normalizeMods(mods) {
  const out = { ...NEUTRAL, parts: new Set() };
  if (!mods || typeof mods !== 'object') return out;
  for (const key of Object.keys(mods)) out[key] = mods[key];
  for (const key of Object.keys(NEUTRAL)) {
    const v = Number(out[key]);
    out[key] = Number.isFinite(v) ? v : NEUTRAL[key];
  }
  return out;
}

export function planRaid(design, { town = null, mods = null } = {}, costOf = null) {
  const def = resolveTown(town);
  const m = normalizeMods(mods);
  const heroKind = def.hero || 'knight';
  const hero = heroStats(heroKind);
  const cap = VILLAIN.lair?.heroDelayCap ?? HERO_DELAY_CAP;
  const delay = Math.max(0, m.heroDelay);
  const heroAt = Math.min(Math.max(cap, hero.appearAtDestroyed), hero.appearAtDestroyed + delay);
  const cost = costOf ? Math.max(0, Math.round(costOf(design) * m.costMul)) : raidCost(design, m);
  const payMul = m.payMul * (def.payMul ?? 1);
  return {
    town: def,
    mods: m,
    cost,
    heroKind,
    heroAt,
    heroLatest: (hero.appearLatestSeconds ?? 30) + (heroAt - hero.appearAtDestroyed) * LATEST_PER_DELAY,
    payMul,
    payPerBlock: VILLAIN.town.payPerBlock * payMul,
    monster: { hpMul: m.hpMul, dmgMul: m.dmgMul, partDmgMul: m.partDmgMul, smashMul: m.smashMul },
  };
}

export function notorietyOf(result, town, mods) {
  const value = notorietyFor(result, town, normalizeMods(mods));
  return Math.max(0, Math.round(Number(value) || 0));
}
