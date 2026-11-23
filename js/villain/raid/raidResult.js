// 습격 결과 만들기 (번 돈 줄 세우기 + 악명 + 저장)
// 판이 끝나면 raidDirector 가 부릅니다. 돈 줄: 부순 블록, 영웅 격파, 마을 싹쓸이 (모두 소굴 수입 × 마을 수입 배율),
// 너무 적으면 수고비, 그리고 소굴 금고 보너스(배율 없이 그대로). 악명은 소굴 효과의 notorietyFor 로 셉니다.
//
//   buildResult({ win, aborted, cleared, paidBlocks, plan, time, ratio, heroLeft, heroName, heroPay, designId }) → result
//       result = { win, aborted, earned, cost, destroyedPercent, time, bonuses: [{ id, label, amount }], designId, heroLeft,
//                  townId, townName, heroKind, heroName, notoriety, blocksBroken, heroBeaten }
//   saveResult(saveStore, result) → 저장된 save
//       save.money += earned, save.notoriety += notoriety, 이기면 save.townWins[townId] += 1,
//       save.stats: raids, wins, bestPay, blocksBroken (+부순 블록), heroesBeaten (+1 이기면)
//
// 돈 숫자(블록당 돈, 싹쓸이 보너스, 수고비)는 villainConfig.js 의 town · economy, 영웅 격파 돈은 heroes(hero).payForWin.

import { VILLAIN } from '../villainConfig.js';
import { notorietyOf } from './raidRules.js';

const LABEL = {
  blocks: (n) => `부순 블록 ${n}개`,
  hero: (name) => `${name} 격파`,
  clear: '마을 싹쓸이',
  minPay: '수고비',
  raidBonus: '소굴 금고 보너스',
};

export function buildResult({ win, aborted = false, cleared = false, paidBlocks = 0, plan, time = 0, ratio = 0, heroLeft = 1, heroName = '', heroPay = 0, designId = null }) {
  const bonuses = [];
  bonuses.push({ id: 'blocks', label: LABEL.blocks(paidBlocks), amount: Math.round(paidBlocks * plan.payPerBlock) });
  if (win) {
    bonuses.push({ id: 'hero', label: LABEL.hero(heroName), amount: Math.round(heroPay * plan.payMul) });
    if (cleared) bonuses.push({ id: 'clear', label: LABEL.clear, amount: Math.round(VILLAIN.town.clearBonus * plan.payMul) });
  }
  let earned = bonuses.reduce((sum, b) => sum + b.amount, 0);
  const minPay = VILLAIN.economy.minPay;
  if (earned < minPay) {
    bonuses.push({ id: 'minPay', label: LABEL.minPay, amount: minPay - earned });
    earned = minPay;
  }
  const flat = Math.max(0, Math.round(plan.mods.raidBonus || 0));
  if (flat > 0) {
    bonuses.push({ id: 'raidBonus', label: LABEL.raidBonus, amount: flat });
    earned += flat;
  }
  const result = {
    win,
    aborted,
    earned,
    cost: plan.cost,
    destroyedPercent: Math.round(ratio * 100),
    time: Math.round(time * 10) / 10,
    bonuses,
    designId,
    heroLeft,
    townId: plan.town.id,
    townName: plan.town.name,
    heroKind: plan.heroKind,
    heroName,
    blocksBroken: paidBlocks,
    heroBeaten: !!win,
    notoriety: 0,
  };
  result.notoriety = notorietyOf(result, plan.town, plan.mods);
  return result;
}

export function saveResult(saveStore, result) {
  if (!saveStore) return null;
  return saveStore.update((save) => {
    save.money += result.earned;
    save.notoriety = (Number(save.notoriety) || 0) + result.notoriety;
    if (result.win) {
      if (!save.townWins || typeof save.townWins !== 'object') save.townWins = {};
      save.townWins[result.townId] = (save.townWins[result.townId] || 0) + 1;
    }
    const stats = save.stats || (save.stats = {});
    stats.raids = (stats.raids || 0) + 1;
    if (result.win) stats.wins = (stats.wins || 0) + 1;
    stats.bestPay = Math.max(stats.bestPay || 0, result.earned);
    stats.blocksBroken = (stats.blocksBroken || 0) + result.blocksBroken;
    if (result.heroBeaten) stats.heroesBeaten = (stats.heroesBeaten || 0) + 1;
  });
}
