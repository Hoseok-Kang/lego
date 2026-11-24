// ─────────────────────────────────────────────────────────────
// 악당 타이쿤: 게임 상태 계산 (저장 내용 + 소굴 효과 → 화면에 넘길 값)
// 저장(saveStore)을 읽어서 "지금 소굴 효과 · 괴수 출동 값 · 열린 마을 · 짓기 메뉴" 같은 값을 만들어 줍니다.
// 저장을 바꾸지는 않아요 (바꾸는 일은 game.js · lairController.js 가 합니다).
//
//   const gs = createGameState({ saveStore, bestiary })
//   gs.evaluation()        지금 소굴의 계책 계산 (lairSim.evaluate)
//   gs.mods()              지금 소굴 효과 (lair/modifiers.js 의 computeModifiers)
//   gs.rank()              지금 악명 단계 { rank, name, at, lairSize }
//   gs.fitDesign(design)   부품을 지금 부품 칸 수(mods.partSlots)까지만 남긴 괴수 (출동할 때 이것을 보냄)
//   gs.costOf(design)      소굴 효과를 넣은 출동 값 (원)       gs.baseCostOf(design)  효과 없는 값
//   gs.hpOf(design)        소굴 효과를 넣은 괴수 체력
//   gs.towns()             마을 목록 + { heroName, unlocked, wins, lockText }
//   gs.isTownOpen(id)      그 마을에 갈 수 있는지
//   gs.facilities()        시설 목록 + { unlocked, affordable, count }
//   gs.partState()         부품 상점용 { available: [살 수 있는 부품], locks: { 부품: '연구실 1단계에 열려요' }, slots }
//   gs.cheapestCost()      지금 보낼 수 있는 가장 싼 괴수 값 (돈이 다 떨어졌는지 볼 때)
//   gs.lairState(extra)    소굴 화면(ui/lairScreen.js)의 render 에 넘길 값 전부
//   gs.rankUpInfo(before, after) → 악명 단계가 올랐으면 { rank, name, emoji, lines: ['바닷가 마을', …] } 아니면 null
// ─────────────────────────────────────────────────────────────

import { VILLAIN } from './villainConfig.js';
import { FACILITY_LIST } from './data/facilities.js';
import { SCHEME_LIST } from './data/schemes.js';
import { RANKS, rankFor, nextRank, unlocksAtRank } from './data/ranks.js';
import { TOWN_LIST, getTown } from './data/towns.js';
import { evaluate, countOf } from './lair/lairSim.js';
import { computeModifiers, describeModifiers, raidCost } from './lair/modifiers.js';
import { activeGoals } from './lair/goalTracker.js';
import { lockText } from './ui/lairKit.js';
import { L } from './lang/lang.js';

// 화면에 보이는 글자 (상점 잠금 글 · 단계 오름 때 새로 열린 것)
const TEXT = L({
  ko: {
    partLock: (name, level) => `${name} ${level}단계에 열려요`,
    notYet: '아직 못 사요',
    partSlots: (n) => `부품 칸 +${n}`,
    pay: (p) => `습격 수입 +${p}%`,
    land: (n) => `땅 ${n}×${n}`,
  },
  en: {
    partLock: (name, level) => `Needs ${name} Lv ${level}`,
    notYet: "Can't buy yet",
    partSlots: (n) => `Part slots +${n}`,
    pay: (p) => `Raid coins +${p}%`,
    land: (n) => `Land ${n}×${n}`,
  },
});

export function createGameState({ saveStore, bestiary }) {
  // 같은 저장 내용이면 계산을 다시 하지 않음 (saveStore.update 가 끝나면 새 저장 물체가 됨)
  let cachedSave = null;
  let cachedEval = null;
  let cachedMods = null;

  function fresh() {
    const save = saveStore.getSave();
    if (save !== cachedSave) {
      cachedSave = save;
      cachedEval = evaluate(save.lair);
      cachedMods = computeModifiers(save, cachedEval);
    }
    return save;
  }

  const evaluation = () => (fresh(), cachedEval);
  const mods = () => (fresh(), cachedMods);
  const rank = () => rankFor(fresh().notoriety);

  // 부품 칸이 모자라면 앞에서부터 칸 수만큼만 붙여서 보냄
  function fitDesign(design) {
    if (!design) return design;
    const slots = mods().partSlots;
    const parts = design.parts ?? [];
    return parts.length > slots ? { ...design, parts: parts.slice(0, slots) } : design;
  }

  const costOf = (design) => raidCost(fitDesign(design), mods());
  const baseCostOf = (design) => bestiary.designCost(fitDesign(design));
  const hpOf = (design) => Math.round((bestiary.designHp ? bestiary.designHp(design) : bestiary.countBlocks(design) * VILLAIN.monster.hpPerBlock) * mods().hpMul); // (S) 두께 · 3D 블록까지 센 체력

  function towns() {
    const save = fresh();
    const r = rank().rank;
    return TOWN_LIST.map((t) => ({
      ...t,
      heroName: VILLAIN.heroes[t.hero]?.name ?? VILLAIN.hero.name,
      unlocked: r >= t.unlockRank,
      wins: Number(save.townWins?.[t.id]) || 0,
      lockText: lockText(t.unlockRank, RANKS),
    }));
  }

  const isTownOpen = (id) => rank().rank >= getTown(id).unlockRank;

  function facilities() {
    const save = fresh();
    const r = rank().rank;
    return FACILITY_LIST.map((f) => ({
      ...f,
      unlocked: r >= f.unlockRank,
      affordable: save.money >= f.price[0],
      count: countOf(save.lair, f.key),
    }));
  }

  // 부품 상점: 연구실 단계가 열어 주는 부품만 살 수 있음 (이미 가진 부품은 그대로 씀)
  function partState() {
    const m = mods();
    const available = [...m.parts];
    const locks = {};
    for (const type of Object.keys(VILLAIN.parts.types)) {
      if (m.parts.has(type)) continue;
      const by = FACILITY_LIST.find((f) => Object.values(f.unlocks?.parts ?? {}).some((list) => list.includes(type)));
      const level = by ? Object.entries(by.unlocks.parts).find(([, list]) => list.includes(type))?.[0] : null;
      locks[type] = by ? TEXT.partLock(by.name, level) : TEXT.notYet;
    }
    return { available, locks, slots: m.partSlots };
  }

  function cheapestCost() {
    const costs = bestiary.list().map(costOf);
    return costs.length ? Math.min(...costs) : Infinity;
  }

  function lairState(extra = {}) {
    const save = fresh();
    const ev = evaluation();
    return {
      money: save.money,
      notoriety: save.notoriety,
      rank: rankFor(save.notoriety),
      nextRank: nextRank(save.notoriety),
      ranks: RANKS,
      goals: activeGoals(save, { evaluation: ev }),
      facilities: facilities(),
      lair: save.lair,
      evaluation: ev,
      modsSummary: describeModifiers(mods()),
      designs: bestiary.list(),
      towns: towns(),
      schemes: SCHEME_LIST,
      schemesSeen: save.schemesSeen,
      stats: save.stats,
      ...extra,
    };
  }

  // 단계가 올랐을 때 알릴 내용 (새로 열린 마을 · 시설 · 덤)
  function rankUpInfo(before, after) {
    if (!(after > before)) return null;
    const lines = [];
    for (let r = before + 1; r <= after; r += 1) {
      const u = unlocksAtRank(r);
      for (const t of u.towns) lines.push(`${t.emoji ?? ''} ${t.name}`.trim());
      for (const f of u.facilities) lines.push(`${f.emoji ?? ''} ${f.name}`.trim());
      if (u.perks?.partSlots) lines.push(TEXT.partSlots(u.perks.partSlots));
      if (u.perks?.pay) lines.push(TEXT.pay(Math.round(u.perks.pay * 100)));
      if (u.lairSize && RANKS[r - 1] && u.lairSize > RANKS[r - 1].lairSize) lines.push(TEXT.land(u.lairSize));
    }
    const r = RANKS[after];
    return { rank: after, name: r.name, emoji: r.emoji, lines: [...new Set(lines)] };
  }

  return {
    evaluation,
    mods,
    rank,
    fitDesign,
    costOf,
    baseCostOf,
    hpOf,
    towns,
    isTownOpen,
    facilities,
    partState,
    cheapestCost,
    lairState,
    rankUpInfo,
  };
}
