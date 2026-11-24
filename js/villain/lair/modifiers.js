// ─────────────────────────────────────────────────────────────
// 악당 타이쿤: 소굴 효과 → 습격 배수
// 시설 효과(단계만큼) + 켜진 계책 + 악명 단계 덤을 모두 더해서, 습격에 쓰는 배수로 바꿔 줍니다.
// 배수 = 1 + 합 을 villainConfig.js 의 lair.clamp 범위로 자름.
//
// 쓰는 법
//   computeModifiers(save, evaluation?) → mods
//       mods.costMul 출동 값 · hpMul 괴수 체력 · dmgMul 괴수 모든 공격 · partDmgMul 부품 공격 · smashMul 건물 부수는 힘
//           payMul 습격 수입 · notorietyMul 악명 · heroHpMul 영웅 체력 (1보다 작으면 좋음)
//       mods.heroDelay   영웅이 나오는 '마을 부서진 비율' 에 더할 값 (0 ~ lair.heroDelayMax)
//       mods.raidBonus   습격마다 덤으로 받는 돈 (원)
//       mods.partSlots   괴수 한 마리에 붙일 수 있는 부품 칸 '전체' 수 (= VILLAIN.parts.slots + 덤)
//       mods.extraPartSlots  그중 덤으로 늘어난 칸
//       mods.parts       살 수 있는 부품 Set ('claw' 는 늘 있음, 연구실 단계에 따라 'fireMouth', 'horn')
//       mods.sums (더한 값 그대로), mods.evaluation (lairSim.evaluate 결과), mods.rank (악명 단계 정보)
//   neutralModifiers()                  → 아무 효과 없는 mods (1단계처럼)
//   describeModifiers(mods)             → [{ key, label: '출동 값', value: '-18%', good: true }]   (변화 있는 것만)
//   describeEffect(effect, times = 1)   → 같은 모양 (시설·계책 한 개의 효과 설명용)
//   effectText(effect, times = 1)       → '출동 값 -12% · 괴수 체력 +5%'
//   raidCost(design, mods)              → 효과를 넣은 출동 값 (원)
//   notorietyFor(result, town, mods)    → 이번 습격으로 얻는 악명 (result: { win, destroyedPercent, aborted })
// ─────────────────────────────────────────────────────────────

import { VILLAIN } from '../villainConfig.js';
import { evaluate } from './lairSim.js';
import { rankFor, rankPerks } from '../data/ranks.js';
import { getTown } from '../data/towns.js';
import { designCost } from '../data/bestiary.js';
import { L } from '../lang/lang.js';

// 배수 효과 이름표 (better: 1 이면 클수록 좋음, -1 이면 작을수록 좋음). 화면 글자는 label (한국어 / 영어)
export const MOD_INFO = {
  cost: { label: L({ ko: '출동 값', en: 'Cost' }), better: -1 },
  hp: { label: L({ ko: '괴수 체력', en: 'Monster HP' }), better: 1 },
  dmg: { label: L({ ko: '괴수 공격', en: 'Monster attack' }), better: 1 },
  partDmg: { label: L({ ko: '부품 공격', en: 'Part attack' }), better: 1 },
  smash: { label: L({ ko: '부수는 힘', en: 'Smash power' }), better: 1 },
  pay: { label: L({ ko: '습격 수입', en: 'Raid coins' }), better: 1 },
  notoriety: { label: L({ ko: '악명', en: 'Infamy' }), better: 1 },
  heroHp: { label: L({ ko: '영웅 체력', en: 'Hero HP' }), better: -1 },
  heroDelay: { label: L({ ko: '영웅 늦게 오기', en: 'Hero arrives later' }), better: 1, kind: 'delay' },
  raidBonus: { label: L({ ko: '습격 덤', en: 'Raid bonus' }), better: 1, kind: 'money' },
  partSlots: { label: L({ ko: '부품 칸', en: 'Part slots' }), better: 1, kind: 'count' },
};
// 숫자 뒤에 붙는 말 (돈 · 칸)
const UNIT = L({
  ko: { money: (n) => `${n}원`, count: (n) => `${n}칸` },
  en: { money: (n) => `${n} coins`, count: (n) => `${n}` },
});
export const MUL_KEYS = ['cost', 'hp', 'dmg', 'partDmg', 'smash', 'pay', 'notoriety', 'heroHp'];

function clampMul(key, value) {
  const [lo, hi] = VILLAIN.lair.clamp[key] || [0, Infinity];
  return Math.min(hi, Math.max(lo, value));
}

function build(sums, extraPartSlots, parts, evaluation, rank) {
  const mods = {};
  for (const key of MUL_KEYS) mods[`${key}Mul`] = clampMul(key, 1 + (sums[key] || 0));
  mods.heroDelay = Math.min(VILLAIN.lair.heroDelayMax, Math.max(0, sums.heroDelay || 0));
  mods.raidBonus = Math.max(0, Math.round(sums.raidBonus || 0));
  mods.extraPartSlots = extraPartSlots;
  mods.partSlots = VILLAIN.parts.slots + extraPartSlots;
  mods.parts = new Set(parts);
  mods.sums = sums;
  mods.evaluation = evaluation;
  mods.rank = rank;
  return mods;
}

export function computeModifiers(save, evaluation = null) {
  const lair = save?.lair;
  const ev = evaluation || (lair ? evaluate(lair) : null);
  const sums = { ...(ev?.combined || {}) };
  const perks = rankPerks(save?.notoriety);
  for (const [k, v] of Object.entries(perks)) if (k !== 'partSlots') sums[k] = (sums[k] || 0) + v;
  const extra = (ev?.extraPartSlots || 0) + (perks.partSlots || 0);
  return build(sums, extra, ev?.parts || VILLAIN.lair.baseParts, ev, rankFor(save?.notoriety));
}

export function neutralModifiers() {
  return build({}, 0, VILLAIN.lair.baseParts, null, rankFor(0));
}

// ── 글로 보여 주기 ──
const pct = (v) => `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`;

function line(key, amount) {
  const info = MOD_INFO[key];
  if (!info || Math.abs(amount) < 0.005) return null;
  let value;
  if (info.kind === 'money') value = `${amount > 0 ? '+' : ''}${UNIT.money(Math.round(amount))}`;
  else if (info.kind === 'count') value = `${amount > 0 ? '+' : ''}${UNIT.count(Math.round(amount))}`;
  else value = pct(amount);
  return { key, label: info.label, value, good: amount * info.better > 0 };
}

export function describeEffect(effect, times = 1) {
  const out = [];
  for (const key of Object.keys(MOD_INFO)) {
    if (!effect || effect[key] === undefined) continue;
    const item = line(key, effect[key] * times);
    if (item) out.push(item);
  }
  return out;
}

export function effectText(effect, times = 1) {
  return describeEffect(effect, times)
    .map((d) => `${d.label} ${d.value}`)
    .join(' · ');
}

export function describeModifiers(mods) {
  const out = [];
  for (const key of MUL_KEYS) {
    const item = line(key, (mods?.[`${key}Mul`] ?? 1) - 1);
    if (item) out.push(item);
  }
  for (const key of ['heroDelay', 'raidBonus']) {
    const item = line(key, mods?.[key] || 0);
    if (item) out.push(item);
  }
  const slots = line('partSlots', mods?.extraPartSlots || 0);
  if (slots) out.push(slots);
  return out;
}

// ── 습격 숫자 ──
export function raidCost(design, mods) {
  const base = designCost(design);
  return Math.max(1, Math.ceil(base * (mods?.costMul ?? 1) - 1e-9));
}

export function notorietyFor(result, town, mods) {
  const cfg = VILLAIN.notoriety;
  const base = getTown(town ?? 'village').notorietyBase;
  const destroyed = Math.max(0, Math.min(1, (Number(result?.destroyedPercent) || 0) / 100));
  let share = (result?.win ? cfg.win : cfg.lose) + cfg.destroy * destroyed;
  if (result?.aborted && !result?.win) share *= cfg.abortMul;
  return Math.max(cfg.min, Math.round(base * share * (mods?.notorietyMul ?? 1)));
}
