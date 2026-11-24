// ─────────────────────────────────────────────────────────────
// 악당 타이쿤: 소굴 시설 표
// 악당 소굴 땅(칸)에 짓는 시설들입니다. 숫자만 바꾸면 값·효과가 바뀝니다.
//
// 시설 하나 = {
//   key, name, icon (그림 이름), emoji, size: [가로, 세로] 칸,
//   tags: 계책 판정에 쓰는 글자 ('공' = 공장·공방 …  아래 TAG_NAMES),
//   levels: 3, price: [짓기, 2단계 강화, 3단계 강화],   (E 조정: 실제 습격 수입에 맞춰 1.5 ~ 2.5배로 올림)
//   unlockRank: 필요한 악명 단계, maxCount: 최대 개수, sellable: false 면 못 팖,
//   effect: 한 단계당 효과 (단계 L 이면 × L). 키 뜻은 lair/modifiers.js 의 MOD_INFO
//       cost 출동 값, hp 괴수 체력, dmg 괴수 공격, partDmg 부품 공격, smash 부수는 힘, pay 습격 수입,
//       notoriety 악명, heroHp 영웅 체력(-가 좋음), heroDelay 영웅 늦게 오기, raidBonus 습격마다 덤 돈(원)
//   unlocks?: { parts: { 단계: [부품] }, partSlots: { 단계: +칸 } }   (연구실 · 훈련장 · 악마 대장간)
//       그 시설을 그 단계까지 지어 두면 부품 상점에서 그 부품을 살 수 있음 (lair/lairSim.js 가 셈, 상점 잠금 글자는 gameState.js)
//   desc: 한 줄 설명 }
//
// 쓰는 법
//   FACILITIES[key] / FACILITY_LIST / getFacility(key)
//   buildPrice(key)                짓는 값
//   upgradePriceOf(key, level)     level → level+1 강화 값 (최고 단계면 null)
//   spentOn(key, level)            그 단계까지 쓴 돈 합계
//   sellRefundOf(key, level)       팔면 돌려받는 돈 (못 파는 시설이면 0)
//   matchesNeed(key, need)         need: 태그 글자('물'), 'f:시설키', '*'(아무 시설) 에 맞는지
//   facilitiesMatching(need)       need 에 맞는 시설 목록 (계책 도감 힌트용)
//   TAG_NAMES                      태그 글자 → 쉬운 말 (한국어 / 영어)
// 이름 · 설명은 L({ ko: '한국어', en: 'English' }) 꼴 (js/villain/lang/lang.js). 영어는 en 쪽만 고치면 됩니다.
// ─────────────────────────────────────────────────────────────

import { VILLAIN } from '../villainConfig.js';
import { L } from '../lang/lang.js';

export const TAG_NAMES = L({
  ko: { 왕: '왕좌', 공: '공장·공방', 물: '물감', 연: '연구', 훈: '훈련', 금: '금고', 감: '감시', 함: '함정', 소: '소문', 용: '용암' },
  en: { 왕: 'Throne', 공: 'Factory', 물: 'Paint', 연: 'Research', 훈: 'Training', 금: 'Vault', 감: 'Lookout', 함: 'Traps', 소: 'Rumors', 용: 'Lava' },
});

const LIST = [
  {
    key: 'throne',
    name: L({ ko: '악당 왕좌', en: 'Villain Throne' }),
    emoji: '🪑',
    size: [2, 2],
    tags: ['왕'],
    price: [0, 1200, 3500],
    unlockRank: 0,
    maxCount: 1,
    sellable: false,
    effect: { notoriety: 0.06 },
    desc: L({ ko: '악당이 다리 꼬고 앉는 의자예요. 앉아만 있어도 소문이 나요.', en: "A villain's comfy chair. Just sitting on it gets people talking." }),
  },
  {
    key: 'factory',
    name: L({ ko: '괴수 공장', en: 'Monster Factory' }),
    emoji: '🏭',
    size: [2, 2],
    tags: ['공'],
    price: [250, 700, 1800],
    unlockRank: 0,
    maxCount: 2,
    effect: { cost: -0.06, hp: 0.03 },
    desc: L({ ko: '괴수를 붕어빵처럼 찍어 내요. 출동 값이 싸지고 조금 튼튼해져요.', en: 'Stamps out monsters like cookies. Cheaper to send, and a bit tougher.' }),
  },
  {
    key: 'paint',
    name: L({ ko: '물감 창고', en: 'Paint Shed' }),
    emoji: '🎨',
    size: [1, 1],
    tags: ['물'],
    price: [100, 300, 700],
    unlockRank: 0,
    maxCount: 4,
    effect: { cost: -0.03 },
    desc: L({ ko: '괴수 칠할 물감을 쌓아 둬요. 공장 옆에 두면 좋은 일이 생겨요.', en: 'Stores paint for your monsters. Good things happen next to a factory.' }),
  },
  {
    key: 'lab',
    name: L({ ko: '연구실', en: 'Lab' }),
    emoji: '🧪',
    size: [2, 2],
    tags: ['연'],
    price: [400, 1200, 3500],
    unlockRank: 0,
    maxCount: 1,
    effect: { partDmg: 0.06 },
    unlocks: { parts: { 1: ['fireMouth'], 2: ['horn'] }, partSlots: { 3: 1 } },
    desc: L({ ko: '수상한 거품이 부글부글. 불 뿜는 입, 돌진 뿔을 발명해요.', en: 'Suspicious bubbles everywhere. Invents Fire Breath and the Ram Horn.' }),
  },
  {
    key: 'vault',
    name: L({ ko: '금고', en: 'Vault' }),
    emoji: '💰',
    size: [1, 1],
    tags: ['금'],
    price: [350, 900, 2200],
    unlockRank: 0,
    maxCount: 2,
    effect: { pay: 0.02, raidBonus: 15 },
    desc: L({ ko: '훔친 돈을 차곡차곡 모아요. 습격마다 용돈이 나와요.', en: 'Piles up stolen coins. Pays a little bonus every raid.' }),
  },
  {
    key: 'lava',
    name: L({ ko: '용암 웅덩이', en: 'Lava Pool' }),
    emoji: '🌋',
    size: [1, 1],
    tags: ['용'],
    price: [150, 400, 900],
    unlockRank: 1,
    maxCount: 6,
    effect: { smash: 0.04 },
    desc: L({ ko: '보글보글 끓는 웅덩이예요. 보기만 해도 부수고 싶어져요.', en: 'A bubbling pool. Just looking at it makes you want to smash stuff.' }),
  },
  {
    key: 'training',
    name: L({ ko: '훈련장', en: 'Training Yard' }),
    emoji: '🏋️',
    size: [2, 2],
    tags: ['훈'],
    price: [800, 1800, 4000],
    unlockRank: 1,
    maxCount: 2,
    effect: { hp: 0.06 },
    unlocks: { parts: { 1: ['tailMace'] } },
    desc: L({ ko: '괴수들이 줄넘기를 천 번 해요. 체력이 쑥쑥 늘고, 꼬리 철퇴 돌리기를 배워요.', en: 'Monsters jump rope a thousand times. HP goes up, and they learn the Tail Mace spin.' }),
  },
  {
    key: 'watchtower',
    name: L({ ko: '감시탑', en: 'Watchtower' }),
    emoji: '🔭',
    size: [1, 1],
    tags: ['감'],
    price: [500, 1200, 2600],
    unlockRank: 1,
    maxCount: 2,
    effect: { heroDelay: 0.04 },
    desc: L({ ko: '영웅이 오는지 망원경으로 지켜봐요. 영웅이 늦게 와요.', en: 'Keeps an eye out for heroes with a telescope. Heroes show up later.' }),
  },
  {
    key: 'bats',
    name: L({ ko: '박쥐 동굴', en: 'Bat Cave' }),
    emoji: '🦇',
    size: [1, 1],
    tags: ['소'],
    price: [400, 900, 2000],
    unlockRank: 1,
    maxCount: 3,
    effect: { notoriety: 0.05 },
    desc: L({ ko: '박쥐들이 온 동네에 무서운 소문을 퍼뜨려요. 악명이 쑥쑥.', en: 'Bats spread scary rumors all over town. Infamy shoots up.' }),
  },
  {
    key: 'traps',
    name: L({ ko: '함정 공방', en: 'Trap Workshop' }),
    emoji: '🪤',
    size: [1, 1],
    tags: ['공', '함'],
    price: [1000, 2200, 4500],
    unlockRank: 2,
    maxCount: 3,
    effect: { heroHp: -0.04 },
    desc: L({ ko: '바나나 껍질부터 가시 구덩이까지 손수 만들어요. 영웅이 다쳐서 와요.', en: 'Handmade traps, from banana peels to spike pits. Heroes show up hurt.' }),
  },
  {
    key: 'forge',
    name: L({ ko: '악마 대장간', en: 'Demon Forge' }),
    emoji: '⚒️',
    size: [2, 2],
    tags: ['공', '용'],
    price: [3000, 6000, 10000],
    unlockRank: 3,
    maxCount: 1,
    effect: { dmg: 0.08 },
    unlocks: { parts: { 1: ['laserEye'] } },
    desc: L({ ko: '용암 불로 괴수 이빨을 쓱쓱 갈아요. 공격이 세지고 용암 노릇도 하고, 레이저 눈을 벼려 내요.', en: 'Sharpens monster teeth in lava fire. Stronger attacks, counts as lava, and forges Laser Eyes.' }),
  },
];

// 빠진 칸 채우기 (levels, icon)
for (const def of LIST) {
  def.levels = def.price.length;
  def.icon = def.icon || def.key;
  if (def.sellable === undefined) def.sellable = true;
}

export const FACILITY_LIST = LIST;
export const FACILITIES = Object.fromEntries(LIST.map((d) => [d.key, d]));

export function getFacility(key) {
  return FACILITIES[key] || null;
}

export function buildPrice(key) {
  return FACILITIES[key]?.price[0] ?? 0;
}

export function upgradePriceOf(key, level) {
  const def = FACILITIES[key];
  if (!def || level >= def.levels) return null;
  return def.price[Math.max(1, level)];
}

export function spentOn(key, level) {
  const def = FACILITIES[key];
  if (!def) return 0;
  let sum = 0;
  for (let i = 0; i < Math.min(level, def.levels); i += 1) sum += def.price[i];
  return sum;
}

export function sellRefundOf(key, level) {
  const def = FACILITIES[key];
  if (!def || !def.sellable) return 0;
  return Math.floor(spentOn(key, level) * VILLAIN.lair.sellRefund);
}

// need: '물' 같은 태그 글자, 'f:paint' 같은 시설 이름, '*' 이면 아무 시설 (계산을 빨리 하려고 한 번 만든 표를 다시 씀)
const matchCache = new Map();
function matchSet(need) {
  const k = need || '*';
  let set = matchCache.get(k);
  if (!set) {
    set = new Set();
    for (const d of LIST) {
      if (k === '*' || (k.startsWith('f:') ? d.key === k.slice(2) : d.tags.includes(k))) set.add(d.key);
    }
    matchCache.set(k, set);
  }
  return set;
}

export function matchesNeed(key, need) {
  return matchSet(need).has(key);
}

export function facilitiesMatching(need) {
  const set = matchSet(need);
  return LIST.filter((d) => set.has(d.key));
}
