// ─────────────────────────────────────────────────────────────
// 악당 타이쿤: 계책 표 (시설을 붙여 지으면 켜지는 보너스)
// 소굴의 재미 1순위! "이 칸에 놓으면 무엇이 켜지지?" 를 만드는 표입니다.
//
// 계책 하나 = {
//   key, name, icon (그림 이름), emoji, tier: 1 | 2 | 3,
//   self: 계책을 받는 시설 — 태그 글자('왕') 또는 'f:시설키' ('f:vault')
//   adjacent: [{ need, count }]  상하좌우로 맞닿은 시설 중 need 에 맞는 것이 count 개 이상 (모두 만족해야 함)
//   shape?: 'cross'    1×1 시설의 위·아래·왼쪽·오른쪽 칸이 모두 adjacent[0].need 시설 (3단계)
//           'surround' 시설에 맞닿은 땅 칸이 빈칸 없이 모두 시설 (땅 밖은 안 따짐) (3단계)
//   effect: { cost: -0.12, ... }  (키 뜻은 facilities.js 머리말과 같음)
//   desc: 웃긴 한 줄, how: 켜는 법 한 줄 }
//   이름 · 설명 · 켜는 법은 L({ ko: '한국어', en: 'English' }) 꼴 (js/villain/lang/lang.js). 영어는 en 쪽만 고치면 됩니다.
//
// 받는 시설 하나마다 한 번씩 켜지고 (최대 VILLAIN.lair.schemeMaxInstances 곳),
// 받는 시설 단계가 오를 때마다 효과 +VILLAIN.lair.schemeLevelBonus (25%).
//
// 쓰는 법
//   SCHEMES[key] / SCHEME_LIST / getScheme(key)
//   schemeFacilities(scheme)   → { self: [시설키], needs: [[시설키]] }  어떤 시설이 끼는지
//   schemeHint(scheme)         → '괴수 공장 + 물감 창고'   (도감에서 ??? 일 때 보여 줄 힌트)
//   schemesInvolving(key)      → 그 시설이 받거나 이웃으로 끼는 계책 목록 (짓기 메뉴·시설 창 설명용)
// ─────────────────────────────────────────────────────────────

import { FACILITIES, facilitiesMatching } from './facilities.js';
import { L } from '../lang/lang.js';

const LIST = [
  // ── 1단계: 두 시설을 붙이기 ──
  {
    key: 'assembly',
    name: L({ ko: '조립 라인', en: 'Assembly Line' }),
    emoji: '⚙️',
    tier: 1,
    self: 'f:factory',
    adjacent: [{ need: '물', count: 1 }],
    effect: { cost: -0.12, hp: 0.05 },
    desc: L({ ko: '칠하고, 굳히고, 찍어 내요! 괴수가 줄줄이 나와요.', en: 'Paint, set, stamp! Monsters roll out one after another.' }),
    how: L({ ko: '괴수 공장 바로 옆에 물감 창고', en: 'A Paint Shed right next to the Monster Factory' }),
  },
  {
    key: 'blackMoney',
    name: L({ ko: '검은 돈', en: 'Shady Money' }),
    emoji: '💸',
    tier: 1,
    self: 'f:vault',
    adjacent: [{ need: '왕', count: 1 }],
    effect: { pay: 0.1 },
    desc: L({ ko: '왕좌 바로 옆 금고는 아무도 못 건드려요. 세금도요.', en: 'Nobody touches a vault next to the throne. Not even the tax man.' }),
    how: L({ ko: '금고를 왕좌에 붙여요', en: 'Put a Vault next to the Throne' }),
  },
  {
    key: 'hotLab',
    name: L({ ko: '비밀 실험', en: 'Secret Experiment' }),
    emoji: '🧪',
    tier: 1,
    self: 'f:lab',
    adjacent: [{ need: '용', count: 1 }],
    effect: { partDmg: 0.18 },
    desc: L({ ko: '부품을 용암에 푹 담갔다 빼요. 안전 수칙은 없어요.', en: 'Dunk the parts in lava. Safety rules? What safety rules?' }),
    how: L({ ko: '연구실 옆에 용암 웅덩이', en: 'A Lava Pool next to the Lab' }),
  },
  {
    key: 'hellTraining',
    name: L({ ko: '지옥 훈련', en: 'Lava Bootcamp' }),
    emoji: '🔥',
    tier: 1,
    self: 'f:training',
    adjacent: [{ need: '용', count: 1 }],
    effect: { hp: 0.12 },
    desc: L({ ko: '용암 위를 맨발로 달려요. 발바닥이 무쇠가 돼요.', en: 'Barefoot running on lava. Feet turn to iron.' }),
    how: L({ ko: '훈련장 옆에 용암 웅덩이', en: 'A Lava Pool next to the Training Yard' }),
  },
  {
    key: 'spyNet',
    name: L({ ko: '첩보망', en: 'Spy Network' }),
    emoji: '🦇',
    tier: 1,
    self: 'f:watchtower',
    adjacent: [{ need: '소', count: 1 }],
    effect: { heroDelay: 0.06 },
    desc: L({ ko: '박쥐가 영웅을 먼저 보고 찍찍 일러바쳐요.', en: 'Bats spot the heroes first and squeak on them.' }),
    how: L({ ko: '감시탑 옆에 박쥐 동굴', en: 'A Bat Cave next to the Watchtower' }),
  },
  {
    key: 'ambush',
    name: L({ ko: '매복 작전', en: 'Sneak Attack' }),
    emoji: '🍌',
    tier: 1,
    self: 'f:traps',
    adjacent: [{ need: '감', count: 1 }],
    effect: { heroHp: -0.1 },
    desc: L({ ko: '감시탑이 영웅 길을 알려 주면 거기에 바나나 껍질을 깔아요.', en: 'The Watchtower spots the hero path, and the banana peels go right there.' }),
    how: L({ ko: '함정 공방 옆에 감시탑', en: 'A Watchtower next to the Trap Workshop' }),
  },

  // ── 2단계: 여러 시설을 함께 붙이기 ──
  {
    key: 'terror',
    name: L({ ko: '공포 정치', en: 'Reign of Terror' }),
    emoji: '👑',
    tier: 2,
    self: '왕',
    adjacent: [{ need: '소', count: 2 }],
    effect: { notoriety: 0.25 },
    desc: L({ ko: '왕좌 둘레를 박쥐 떼가 빙빙 돌면 온 나라가 벌벌 떨어요.', en: 'With bats circling the throne, the whole kingdom shivers.' }),
    how: L({ ko: '왕좌에 박쥐 동굴 두 개를 붙여요', en: 'Put two Bat Caves next to the Throne' }),
  },
  {
    key: 'weaponWorks',
    name: L({ ko: '무기 공장', en: 'Weapon Works' }),
    emoji: '🦾',
    tier: 2,
    self: 'f:factory',
    adjacent: [
      { need: '연', count: 1 },
      { need: '공', count: 1 },
    ],
    effect: { dmg: 0.12, partDmg: 0.06 },
    desc: L({ ko: '연구실 설계도대로 괴수 팔에 무기를 철컥철컥 달아요.', en: 'Bolts weapons onto monster arms, straight from the Lab blueprints. Clank!' }),
    how: L({ ko: '괴수 공장에 연구실과 다른 공장(또는 함정 공방·대장간)을 붙여요', en: 'Put a Lab and another factory (or Trap Workshop / Forge) next to the Monster Factory' }),
  },
  {
    key: 'lootSchool',
    name: L({ ko: '도둑 학교', en: 'Thief School' }),
    emoji: '🎓',
    tier: 2,
    self: 'f:training',
    adjacent: [
      { need: '금', count: 1 },
      { need: '감', count: 1 },
    ],
    effect: { pay: 0.1, smash: 0.06 },
    desc: L({ ko: '감시탑에서 망보고, 금고 앞에서 따는 법을 배워요.', en: 'Keep watch from the tower, practice cracking the vault.' }),
    how: L({ ko: '훈련장에 금고와 감시탑을 붙여요', en: 'Put a Vault and a Watchtower next to the Training Yard' }),
  },

  // ── 3단계: 모양 맞추기 ──
  {
    key: 'goldenCross',
    name: L({ ko: '황금 십자', en: 'Golden Cross' }),
    emoji: '✨',
    tier: 3,
    self: 'f:vault',
    shape: 'cross',
    adjacent: [{ need: '물', count: 4 }],
    effect: { pay: 0.15, raidBonus: 50 },
    desc: L({ ko: '금고 사방을 금색 물감으로 칠했어요. 돈이 반짝반짝 불어나요.', en: 'Gold paint on every side of the vault. Coins sparkle and multiply.' }),
    how: L({ ko: '금고의 위·아래·왼쪽·오른쪽을 모두 물감 창고로', en: 'Paint Sheds above, below, left and right of the Vault' }),
  },
  {
    key: 'ironThrone',
    name: L({ ko: '철벽 왕좌', en: 'Fortress Throne' }),
    emoji: '🛡️',
    tier: 3,
    self: '왕',
    shape: 'surround',
    adjacent: [],
    effect: { heroHp: -0.15, hp: 0.1 },
    desc: L({ ko: '왕좌 둘레에 빈칸이 하나도 없어요. 영웅이 비집고 들어올 틈이 없어요.', en: 'Not one gap around the throne. Heroes have no way in.' }),
    how: L({ ko: '왕좌에 맞닿은 칸을 빈틈없이 채워요 (땅 끝 쪽은 안 채워도 돼요)', en: "Fill every square touching the Throne (the edge of the land doesn't count)" }),
  },
  {
    key: 'firePit',
    name: L({ ko: '불바다', en: 'Sea of Fire' }),
    emoji: '🌋',
    tier: 3,
    self: 'f:lava',
    shape: 'cross',
    adjacent: [{ need: '용', count: 4 }],
    effect: { smash: 0.25, dmg: 0.1 },
    desc: L({ ko: '용암 한가운데 또 용암, 사방도 용암. 바닥이 전부 뜨끈뜨끈해요.', en: 'Lava in the middle, lava all around. The whole floor is toasty.' }),
    how: L({ ko: '용암 웅덩이의 위·아래·왼쪽·오른쪽을 모두 용암(대장간도 돼요)으로', en: 'Lava above, below, left and right of a Lava Pool (the Forge counts too)' }),
  },
];

for (const s of LIST) s.icon = s.icon || s.key;

export const SCHEME_LIST = LIST;
export const SCHEMES = Object.fromEntries(LIST.map((s) => [s.key, s]));

export function getScheme(key) {
  return SCHEMES[key] || null;
}

const keysOf = (need) => facilitiesMatching(need).map((d) => d.key);

export function schemeFacilities(scheme) {
  return { self: keysOf(scheme.self), needs: (scheme.adjacent || []).map((a) => keysOf(a.need)) };
}

// 힌트 글자: 개수 말 · 빈틈없이 (한국어 / 영어)
const HINT = L({
  ko: { counts: ['', '', ' 둘', ' 셋', ' 넷'], surround: '빈틈없이' },
  en: { counts: ['', '', ' ×2', ' ×3', ' ×4'], surround: 'no gaps' },
});
const COUNT_WORDS = HINT.counts;

export function schemeHint(scheme) {
  const { self, needs } = schemeFacilities(scheme);
  const names = (keys) => keys.map((k) => FACILITIES[k].name).join('·');
  const parts = [names(self), ...needs.map((keys, i) => names(keys) + (COUNT_WORDS[scheme.adjacent[i].count] || ''))];
  if (scheme.shape === 'surround') parts.push(HINT.surround);
  return parts.join(' + ');
}

export function schemesInvolving(key) {
  return LIST.filter((s) => {
    const { self, needs } = schemeFacilities(s);
    return self.includes(key) || needs.some((n) => n.includes(key)); // '빈틈없이 채우기' 칸은 어떤 시설이든 되므로 안 셈
  });
}
