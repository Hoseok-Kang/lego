// 습격 결과 만들기 (번 돈 줄 세우기 + 악명 + 저장)
// 판이 끝나면 raidDirector 가 부릅니다. 돈 줄: 부순 블록, 영웅 격파, 마을 싹쓸이 (모두 소굴 수입 × 마을 수입 배율),
// 너무 적으면 수고비, 그리고 소굴 금고 보너스(배율 없이 그대로). 악명은 소굴 효과의 notorietyFor 로 셉니다.
//
//   buildResult({ win, aborted, cleared, paidBlocks, plan, time, ratio, heroLeft, heroName, heroPay, designId }) → result
//       result = { win, aborted, earned, cost, destroyedPercent, time, bonuses: [{ id, label, amount }], designId, heroLeft,
//                  townId, townName, heroKind, heroName, notoriety, blocksBroken, heroBeaten }
//   saveResult(saveStore, result) → 저장된 save
//   START_TEXT                      출동을 못 할 때 알림 글자 (raidDirector.js 가 씀)
//       save.money += earned, save.stats: raids, wins, bestPay (1단계와 같음)
//       악명·마을별 승리·부순 블록·영웅 격파는 여기서 안 넣어요 → 게임 본체가 raidEnded 때
//       lair/goalTracker.js 의 recordRaid(save, result, { townId: result.townId, notoriety: result.notoriety }) 로 넣음 (두 번 세지 않게)
//
// 돈 줄 이름 글자는 아래 LABEL (한국어 / 영어).
// 돈 숫자(블록당 돈, 싹쓸이 보너스, 수고비)는 villainConfig.js 의 town · economy, 영웅 격파 돈은 heroes(hero).payForWin.

import { VILLAIN } from '../villainConfig.js';
import { notorietyOf } from './raidRules.js';
import { L } from '../lang/lang.js';

// 결과 화면의 돈 줄 이름 (화면에 보이는 글자)
const LABEL = L({
  ko: {
    blocks: (n) => `부순 블록 ${n}개`,
    hero: (name) => `${name} 격파`,
    clear: '마을 싹쓸이',
    minPay: '수고비',
    raidBonus: '소굴 금고 보너스',
  },
  en: {
    blocks: (n) => (n === 1 ? '1 block smashed' : `${n} blocks smashed`),
    hero: (name) => `Beat ${name}`,
    clear: 'Town wiped out',
    minPay: 'Effort pay',
    raidBonus: 'Lair vault bonus',
  },
});

// 출동을 못 할 때 알림 글자 (raidDirector.js 가 씀. 그 파일이 400줄을 넘지 않게 여기에 둠)
export const START_TEXT = L({
  ko: { pick: '출동할 괴수를 골라 주세요', poor: (cost) => `돈이 모자라요 (${cost}원 필요)` },
  en: { pick: 'Pick a monster to send', poor: (cost) => `Not enough coins (you need ${cost})` },
});

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
    const stats = save.stats || (save.stats = {});
    stats.raids = (stats.raids || 0) + 1;
    if (result.win) stats.wins = (stats.wins || 0) + 1;
    stats.bestPay = Math.max(stats.bestPay || 0, result.earned);
  });
}
