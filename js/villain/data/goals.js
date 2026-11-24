// ─────────────────────────────────────────────────────────────
// 악당 타이쿤: 목표 (늘 손에 잡히는 다음 한 걸음)
// 한 번에 셋씩만 보여요 (GOALS_OPEN). 하나를 끝내면 그 뒤에 매달린 목표가 열려요.
// 목록 순서 = 보여 주는 순서 = 게임을 가르치는 순서:
//   첫 출동 → 내 괴수 그리기 → 물감 창고를 공장 옆에 (첫 계책!) → 번개 기사 → 연구실 → 바닷가 마을 → … → 왕궁 성곽 정복
//
// 목표 하나 = { key, name, icon, emoji, desc (무엇을·왜 한 줄), need, progress(save, ctx) → 숫자,
//              after?: [먼저 끝낼 목표], reward: { money?, notoriety? }, done: '끝냈을 때 한마디' }
//   ctx = { evaluation (lairSim.evaluate 결과), lastResult? } — 없어도 저장만 보고 셉니다
//
// 쓰는 법: GOALS (목록), GOAL_MAP[key], GOALS_OPEN (한 번에 보이는 수). 진행 계산은 lair/goalTracker.js
// 이름 · 설명 · 한마디는 L({ ko: '한국어', en: 'English' }) 꼴 (js/villain/lang/lang.js). 영어는 en 쪽만 고치면 됩니다.
// ─────────────────────────────────────────────────────────────

import { RANKS } from './ranks.js';
import { SCHEMES, SCHEME_LIST } from './schemes.js';
import { L } from '../lang/lang.js';

export const GOALS_OPEN = 3;

// ── 세는 도우미 ──
const buildings = (save) => save?.lair?.buildings || [];
const countType = (save, type) => buildings(save).filter((b) => b.type === type).length;
const maxLevel = (save, type) => buildings(save).reduce((m, b) => (b.type === type ? Math.max(m, b.level) : m), 0);
const wins = (save, townId) => Number(save?.townWins?.[townId]) || 0;
const notoriety = (save) => Number(save?.notoriety) || 0;

// 지금까지 켜 본 계책 (저장된 도감 + 지금 켜져 있는 것)
function seenSchemes(save, ctx) {
  const seen = new Set(Array.isArray(save?.schemesSeen) ? save.schemesSeen : []);
  for (const s of ctx?.evaluation?.schemes || []) seen.add(s.key);
  return seen;
}
const hasScheme = (save, ctx, key) => (seenSchemes(save, ctx).has(key) ? 1 : 0);
const tierSeen = (save, ctx, tier) => [...seenSchemes(save, ctx)].filter((k) => SCHEMES[k]?.tier === tier).length;

export const GOALS = [
  {
    key: 'firstRaid',
    name: L({ ko: '첫 출동', en: 'First Raid' }),
    emoji: '🦖',
    desc: L({ ko: '괴수를 골라 꼬마 마을로 출동해요. 악당의 첫걸음이에요.', en: 'Pick a monster and raid Tiny Town. Every villain starts here!' }),
    need: 1,
    progress: (s) => Number(s?.stats?.raids) || 0,
    reward: { money: 60, notoriety: 10 },
    done: L({ ko: '마을 사람들이 처음으로 비명을 질렀어요!', en: 'The villagers screamed for the very first time!' }),
  },
  {
    key: 'drawOwn',
    name: L({ ko: '내 괴수 그리기', en: 'Draw Your Monster' }),
    emoji: '🎨',
    desc: L({ ko: '괴수 도감에서 나만의 괴수를 그려요. 크게 그리면 튼튼해요.', en: 'Draw your own monster in the Monster Book. Bigger is tougher.' }),
    need: 1,
    progress: (s) => (Array.isArray(s?.designs) ? s.designs.length : 0),
    reward: { money: 80 },
    done: L({ ko: '세상에 하나뿐인 괴수가 태어났어요!', en: 'A one-of-a-kind monster is born!' }),
  },
  {
    key: 'assembly',
    name: L({ ko: '첫 계책: 조립 라인', en: 'First Combo: Assembly Line' }),
    emoji: '⚙️',
    desc: L({ ko: '물감 창고를 괴수 공장 바로 옆에 지어요. 붙여 지으면 계책이 켜져요!', en: 'Build a Paint Shed right next to the Monster Factory for a combo!' }),
    need: 1,
    progress: (s, ctx) => hasScheme(s, ctx, 'assembly'),
    reward: { money: 100, notoriety: 10 },
    done: L({ ko: '붙여 짓는 게 악당 소굴의 비밀이에요!', en: 'Building side by side is the secret of every great lair!' }),
  },
  {
    key: 'beatKnight',
    name: L({ ko: '번개 기사 혼내 주기', en: 'Zap the Thunder Knight' }),
    emoji: '⚡',
    desc: L({ ko: '꼬마 마을의 번개 기사를 이겨요. 크게 그리고 부품을 붙이면 쉬워요.', en: 'Beat the Thunder Knight in Tiny Town. Draw big and add parts!' }),
    need: 1,
    after: ['firstRaid'],
    progress: (s) => wins(s, 'village'),
    reward: { money: 150, notoriety: 20 },
    done: L({ ko: '번개 기사가 울면서 도망갔어요!', en: 'The Thunder Knight ran away crying!' }),
  },
  {
    key: 'buildLab',
    name: L({ ko: '연구실 짓기', en: 'Build a Lab' }),
    emoji: '🧪',
    desc: L({ ko: '연구실을 지으면 불 뿜는 입을 살 수 있어요.', en: 'Build a Lab to unlock Fire Breath in the shop.' }),
    need: 1,
    after: ['assembly'],
    progress: (s) => countType(s, 'lab'),
    reward: { money: 120 },
    done: L({ ko: '부글부글, 수상한 연구가 시작됐어요!', en: 'Bubble, bubble… the shady research begins!' }),
  },
  {
    key: 'rank1',
    name: L({ ko: '골목 악당 되기', en: 'Become an Alley Nuisance' }),
    emoji: '😈',
    desc: L({ ko: '습격해서 악명을 모아요. 골목 악당이 되면 바닷가 마을이 열려요.', en: 'Raid towns for infamy. As an Alley Nuisance, Harbor Town opens.' }),
    need: RANKS[1].at,
    after: ['firstRaid'],
    progress: notoriety,
    reward: { money: 150 },
    done: L({ ko: '이제 골목 고양이도 나를 피해 다녀요!', en: 'Even the alley cats run from you now!' }),
  },
  {
    key: 'threeSchemes',
    name: L({ ko: '계책 셋', en: 'Three Combos' }),
    emoji: '📜',
    desc: L({ ko: '서로 다른 계책 세 개를 켜 봐요. 계책 도감에 힌트가 있어요.', en: 'Turn on three different combos. The Combo Book has hints.' }),
    need: 3,
    after: ['assembly'],
    progress: (s, ctx) => seenSchemes(s, ctx).size,
    reward: { money: 200, notoriety: 15 },
    done: L({ ko: '시설끼리 붙이는 재미를 알아 버렸어요!', en: "You've found out how fun it is to build side by side!" }),
  },
  {
    key: 'beatIceMage',
    name: L({ ko: '얼음 마법사 녹이기', en: 'Melt the Ice Mage' }),
    emoji: '❄️',
    desc: L({ ko: '바닷가 마을의 얼음 마법사를 이겨요. 돌진 뿔로 확 들이받아요!', en: 'Beat the Ice Mage in Harbor Town. Ram hard with the Charge Horn!' }),
    need: 1,
    after: ['rank1'],
    progress: (s) => wins(s, 'harbor'),
    reward: { money: 300, notoriety: 30 },
    done: L({ ko: '얼음 마법사가 물웅덩이가 됐어요!', en: 'The Ice Mage melted into a puddle!' }),
  },
  {
    key: 'labLv2',
    name: L({ ko: '뿔 연구', en: 'Horn Research' }),
    emoji: '🦏',
    desc: L({ ko: '연구실을 2단계로 강화하면 돌진 뿔을 살 수 있어요.', en: 'Upgrade the Lab to level 2 to unlock the Charge Horn.' }),
    need: 2,
    after: ['buildLab'],
    progress: (s) => maxLevel(s, 'lab'),
    reward: { money: 150 },
    done: L({ ko: '뾰족뾰족 뿔이 발명됐어요!', en: 'Pointy horns invented!' }),
  },
  {
    key: 'tier2Scheme',
    name: L({ ko: '2단계 계책', en: 'Tier 2 Combo' }),
    emoji: '🧩',
    desc: L({ ko: '시설 여러 개를 함께 붙여야 켜지는 2단계 계책을 켜요.', en: 'Turn on a tier 2 combo by joining several buildings.' }),
    need: 1,
    after: ['threeSchemes'],
    progress: (s, ctx) => tierSeen(s, ctx, 2),
    reward: { money: 250, notoriety: 20 },
    done: L({ ko: '소굴이 점점 악랄해지고 있어요!', en: 'Your lair is getting more and more evil!' }),
  },
  {
    key: 'rank2',
    name: L({ ko: '마을의 공포 되기', en: 'Become a Town Terror' }),
    emoji: '👹',
    desc: L({ ko: '악명을 더 모아요. 땅이 넓어지고 부품 칸이 하나 늘어요.', en: 'Gain more infamy. Your land grows and you get a part slot.' }),
    need: RANKS[2].at,
    after: ['rank1'],
    progress: notoriety,
    reward: { money: 300 },
    done: L({ ko: '아이들이 내 이름만 들어도 이불 속에 숨어요!', en: 'Kids hide under their blankets when they hear your name!' }),
  },
  {
    // (S) 3D 블록 작업대가 열리면 (villainConfig 의 sculpt.unlockRank)
    key: 'build3d',
    name: L({ ko: '3D 괴수 만들기', en: 'Make a 3D Monster' }),
    emoji: '🧊',
    desc: L({ ko: '괴수 도감 → 3D로 쌓기. 블록을 하나하나 쌓아 입체 괴수를 만들어요.', en: 'Monster Book → Build in 3D. Stack blocks into a 3D monster.' }),
    need: 1,
    after: ['rank2'],
    progress: (s) => (Array.isArray(s?.designs) ? s.designs.filter((d) => d?.kind === 'voxel').length : 0),
    reward: { money: 200, notoriety: 20 },
    done: L({ ko: '진짜 입체 괴수가 태어났어요!', en: 'A real 3D monster is born!' }),
  },
  {
    key: 'bigLair',
    name: L({ ko: '북적북적 소굴', en: 'Busy Lair' }),
    emoji: '🏚️',
    desc: L({ ko: '소굴에 시설을 여덟 개 지어요. 붙일 짝이 많아져요.', en: 'Build eight buildings in your lair. More neighbors, more combos.' }),
    need: 8,
    after: ['buildLab'],
    progress: (s) => buildings(s).length,
    reward: { money: 200 },
    done: L({ ko: '제법 악당 본부 같아졌어요!', en: 'It finally looks like a real villain HQ!' }),
  },
  {
    key: 'tier3Scheme',
    name: L({ ko: '모양 계책', en: 'Shape Combo' }),
    emoji: '✳️',
    desc: L({ ko: '십자 모양, 빈틈없이 둘러싸기처럼 모양을 맞추는 3단계 계책을 켜요.', en: 'Turn on a tier 3 combo by making a shape, like a cross or a ring.' }),
    need: 1,
    after: ['tier2Scheme'],
    progress: (s, ctx) => tierSeen(s, ctx, 3),
    reward: { money: 400, notoriety: 30 },
    done: L({ ko: '완벽한 모양! 타고난 악당 건축가예요!', en: 'Perfect shape! A born evil architect!' }),
  },
  {
    key: 'rank3',
    name: L({ ko: '왕국의 골칫거리 되기', en: 'Become a Kingdom Menace' }),
    emoji: '👺',
    desc: L({ ko: '악명을 더 모으면 왕궁 성곽으로 쳐들어갈 수 있어요.', en: 'Gain more infamy to storm the Royal Castle.' }),
    need: RANKS[3].at,
    after: ['rank2'],
    progress: notoriety,
    reward: { money: 400 },
    done: L({ ko: '임금님이 밤잠을 설쳐요!', en: "The king can't sleep at night!" }),
  },
  {
    key: 'beatGuardian',
    name: L({ ko: '왕궁 성곽 정복', en: 'Conquer the Royal Castle' }),
    emoji: '🏆',
    desc: L({ ko: '왕궁의 황금 수호자를 이겨요. 방패 옆이나 멀리서 공격해요!', en: "Beat the castle's Golden Guardian. Hit beside the shield or from afar!" }),
    need: 1,
    after: ['rank3'],
    progress: (s) => wins(s, 'castle'),
    reward: { money: 800, notoriety: 80 },
    done: L({ ko: '왕궁이 내 것이 됐어요! 와하하하!', en: 'The castle is yours! Mwahahaha!' }),
  },
  {
    key: 'allSchemes',
    name: L({ ko: '계책 도감 완성', en: 'Complete the Combo Book' }),
    emoji: '📖',
    desc: L({ ko: `계책 ${SCHEME_LIST.length}개를 모두 찾아요.`, en: `Find all ${SCHEME_LIST.length} combos.` }),
    need: SCHEME_LIST.length,
    after: ['tier3Scheme'],
    progress: (s, ctx) => seenSchemes(s, ctx).size,
    reward: { money: 1000, notoriety: 100 },
    done: L({ ko: '세상의 모든 악당 꾀를 알아냈어요!', en: 'You know every evil trick in the world!' }),
  },
  {
    key: 'rank4',
    name: L({ ko: '전설의 대마왕', en: 'Legendary Overlord' }),
    emoji: '🐲',
    desc: L({ ko: '악명을 끝까지 모아 전설이 되어요.', en: 'Max out your infamy and become a legend.' }),
    need: RANKS[4].at,
    after: ['beatGuardian'],
    progress: notoriety,
    reward: { money: 1000 },
    done: L({ ko: '역사책 맨 앞장에 내 이름이 실렸어요!', en: 'Your name is on the first page of the history books!' }),
  },
];

for (const g of GOALS) g.icon = g.icon || g.key;

export const GOAL_MAP = Object.fromEntries(GOALS.map((g) => [g.key, g]));
