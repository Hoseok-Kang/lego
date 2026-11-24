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
// ─────────────────────────────────────────────────────────────

import { RANKS } from './ranks.js';
import { SCHEMES, SCHEME_LIST } from './schemes.js';

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
    name: '첫 출동',
    emoji: '🦖',
    desc: '괴수를 골라 꼬마 마을로 출동해요. 악당의 첫걸음이에요.',
    need: 1,
    progress: (s) => Number(s?.stats?.raids) || 0,
    reward: { money: 60, notoriety: 10 },
    done: '마을 사람들이 처음으로 비명을 질렀어요!',
  },
  {
    key: 'drawOwn',
    name: '내 괴수 그리기',
    emoji: '🎨',
    desc: '괴수 도감에서 나만의 괴수를 그려요. 크게 그리면 튼튼해요.',
    need: 1,
    progress: (s) => (Array.isArray(s?.designs) ? s.designs.length : 0),
    reward: { money: 80 },
    done: '세상에 하나뿐인 괴수가 태어났어요!',
  },
  {
    key: 'assembly',
    name: '첫 계책: 조립 라인',
    emoji: '⚙️',
    desc: '물감 창고를 괴수 공장 바로 옆에 지어요. 붙여 지으면 계책이 켜져요!',
    need: 1,
    progress: (s, ctx) => hasScheme(s, ctx, 'assembly'),
    reward: { money: 100, notoriety: 10 },
    done: '붙여 짓는 게 악당 소굴의 비밀이에요!',
  },
  {
    key: 'beatKnight',
    name: '번개 기사 혼내 주기',
    emoji: '⚡',
    desc: '꼬마 마을의 번개 기사를 이겨요. 크게 그리고 부품을 붙이면 쉬워요.',
    need: 1,
    after: ['firstRaid'],
    progress: (s) => wins(s, 'village'),
    reward: { money: 150, notoriety: 20 },
    done: '번개 기사가 울면서 도망갔어요!',
  },
  {
    key: 'buildLab',
    name: '연구실 짓기',
    emoji: '🧪',
    desc: '연구실을 지으면 불 뿜는 입을 살 수 있어요.',
    need: 1,
    after: ['assembly'],
    progress: (s) => countType(s, 'lab'),
    reward: { money: 120 },
    done: '부글부글, 수상한 연구가 시작됐어요!',
  },
  {
    key: 'rank1',
    name: '골목 악당 되기',
    emoji: '😈',
    desc: '습격해서 악명을 모아요. 골목 악당이 되면 바닷가 마을이 열려요.',
    need: RANKS[1].at,
    after: ['firstRaid'],
    progress: notoriety,
    reward: { money: 150 },
    done: '이제 골목 고양이도 나를 피해 다녀요!',
  },
  {
    key: 'threeSchemes',
    name: '계책 셋',
    emoji: '📜',
    desc: '서로 다른 계책 세 개를 켜 봐요. 계책 도감에 힌트가 있어요.',
    need: 3,
    after: ['assembly'],
    progress: (s, ctx) => seenSchemes(s, ctx).size,
    reward: { money: 200, notoriety: 15 },
    done: '시설끼리 붙이는 재미를 알아 버렸어요!',
  },
  {
    key: 'beatIceMage',
    name: '얼음 마법사 녹이기',
    emoji: '❄️',
    desc: '바닷가 마을의 얼음 마법사를 이겨요. 돌진 뿔로 확 들이받아요!',
    need: 1,
    after: ['rank1'],
    progress: (s) => wins(s, 'harbor'),
    reward: { money: 300, notoriety: 30 },
    done: '얼음 마법사가 물웅덩이가 됐어요!',
  },
  {
    key: 'labLv2',
    name: '뿔 연구',
    emoji: '🦏',
    desc: '연구실을 2단계로 강화하면 돌진 뿔을 살 수 있어요.',
    need: 2,
    after: ['buildLab'],
    progress: (s) => maxLevel(s, 'lab'),
    reward: { money: 150 },
    done: '뾰족뾰족 뿔이 발명됐어요!',
  },
  {
    key: 'tier2Scheme',
    name: '2단계 계책',
    emoji: '🧩',
    desc: '시설 여러 개를 함께 붙여야 켜지는 2단계 계책을 켜요.',
    need: 1,
    after: ['threeSchemes'],
    progress: (s, ctx) => tierSeen(s, ctx, 2),
    reward: { money: 250, notoriety: 20 },
    done: '소굴이 점점 악랄해지고 있어요!',
  },
  {
    key: 'rank2',
    name: '마을의 공포 되기',
    emoji: '👹',
    desc: '악명을 더 모아요. 땅이 넓어지고 부품 칸이 하나 늘어요.',
    need: RANKS[2].at,
    after: ['rank1'],
    progress: notoriety,
    reward: { money: 300 },
    done: '아이들이 내 이름만 들어도 이불 속에 숨어요!',
  },
  {
    // (S) 3D 블록 작업대가 열리면 (villainConfig 의 sculpt.unlockRank)
    key: 'build3d',
    name: '3D 괴수 만들기',
    emoji: '🧊',
    desc: '괴수 도감 → 3D로 쌓기. 블록을 하나하나 쌓아 입체 괴수를 만들어요.',
    need: 1,
    after: ['rank2'],
    progress: (s) => (Array.isArray(s?.designs) ? s.designs.filter((d) => d?.kind === 'voxel').length : 0),
    reward: { money: 200, notoriety: 20 },
    done: '진짜 입체 괴수가 태어났어요!',
  },
  {
    key: 'bigLair',
    name: '북적북적 소굴',
    emoji: '🏚️',
    desc: '소굴에 시설을 여덟 개 지어요. 붙일 짝이 많아져요.',
    need: 8,
    after: ['buildLab'],
    progress: (s) => buildings(s).length,
    reward: { money: 200 },
    done: '제법 악당 본부 같아졌어요!',
  },
  {
    key: 'tier3Scheme',
    name: '모양 계책',
    emoji: '✳️',
    desc: '십자 모양, 빈틈없이 둘러싸기처럼 모양을 맞추는 3단계 계책을 켜요.',
    need: 1,
    after: ['tier2Scheme'],
    progress: (s, ctx) => tierSeen(s, ctx, 3),
    reward: { money: 400, notoriety: 30 },
    done: '완벽한 모양! 타고난 악당 건축가예요!',
  },
  {
    key: 'rank3',
    name: '왕국의 골칫거리 되기',
    emoji: '👺',
    desc: '악명을 더 모으면 왕궁 성곽으로 쳐들어갈 수 있어요.',
    need: RANKS[3].at,
    after: ['rank2'],
    progress: notoriety,
    reward: { money: 400 },
    done: '임금님이 밤잠을 설쳐요!',
  },
  {
    key: 'beatGuardian',
    name: '왕궁 성곽 정복',
    emoji: '🏆',
    desc: '왕궁의 황금 수호자를 이겨요. 방패 옆이나 멀리서 공격해요!',
    need: 1,
    after: ['rank3'],
    progress: (s) => wins(s, 'castle'),
    reward: { money: 800, notoriety: 80 },
    done: '왕궁이 내 것이 됐어요! 와하하하!',
  },
  {
    key: 'allSchemes',
    name: '계책 도감 완성',
    emoji: '📖',
    desc: `계책 ${SCHEME_LIST.length}개를 모두 찾아요.`,
    need: SCHEME_LIST.length,
    after: ['tier3Scheme'],
    progress: (s, ctx) => seenSchemes(s, ctx).size,
    reward: { money: 1000, notoriety: 100 },
    done: '세상의 모든 악당 꾀를 알아냈어요!',
  },
  {
    key: 'rank4',
    name: '전설의 대마왕',
    emoji: '🐲',
    desc: '악명을 끝까지 모아 전설이 되어요.',
    need: RANKS[4].at,
    after: ['beatGuardian'],
    progress: notoriety,
    reward: { money: 1000 },
    done: '역사책 맨 앞장에 내 이름이 실렸어요!',
  },
];

for (const g of GOALS) g.icon = g.icon || g.key;

export const GOAL_MAP = Object.fromEntries(GOALS.map((g) => [g.key, g]));
