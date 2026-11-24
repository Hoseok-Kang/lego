// ─────────────────────────────────────────────────────────────
// 악당 타이쿤: 게임 본체 · 소굴이 띄우는 알림 글자 (한국어 / 영어)
// game.js, lairController.js, lairActions.js 가 화면 아래쪽 알림(toast)으로 보여 주는 글자를 모아 둔 곳이에요.
// (그 파일들이 400줄을 넘지 않게 글자만 여기로 옮겼어요. 그리기 화면의 editorText.js 와 같은 방식)
//
// 쓰는 법
//   import { GAME_TEXT as TEXT } from './gameText.js';          게임 본체 (괴수 복사 · 지원금 · 출동 못 함)
//   import { LAIR_TEXT as TEXT } from './gameText.js';          소굴 (지었어요 · 계책 발견 · 악명 단계 UP)
//   import { LAIR_ACTION_TEXT as TEXT } from './gameText.js';   소굴 짓기 · 강화 돈 모자람
//
// 한국어는 ko: 쪽, 영어는 en: 쪽 글자만 바꾸면 됩니다 (js/villain/lang/lang.js 가 지금 말에 맞는 쪽을 고름).
// ─────────────────────────────────────────────────────────────

import { L } from './lang/lang.js';
import { money } from './ui/uiKit.js';

// ── 게임 본체 (game.js) ──
export const GAME_TEXT = L({
  ko: {
    copied: (name) => `'${name}' 괴수를 복사했어요`,
    saved: (name) => `'${name}' 괴수를 도감에 넣었어요`,
    removed: '괴수를 지웠어요',
    rescue: (amount) => `돈이 다 떨어져서 악당 협회가 지원금 ${amount}원을 줬어요`,
    noMonster: '출동할 괴수를 찾지 못했어요',
    keepMoney: (amount) => `괴수를 보낼 돈 ${amount}원은 남겨 둬야 해요. 조금 더 벌고 와요`,
    poor: (amount) => `돈이 모자라요 (${amount}원 필요)`,
    partLocked: (text) => `아직 못 사요. ${text}`,
    monster: '괴수',
  },
  en: {
    copied: (name) => `Copied the monster "${name}"`,
    saved: (name) => `"${name}" is in your Monster Book`,
    removed: 'Monster deleted',
    rescue: (amount) => `You ran out of coins, so the Villain Club sent you ${amount} coins!`,
    noMonster: "Couldn't find a monster to send",
    keepMoney: (amount) => `Keep ${amount} coins to send a monster. Earn a bit more first`,
    poor: (amount) => `Not enough coins (you need ${amount})`,
    partLocked: (text) => `Can't buy yet. ${text}`,
    monster: 'Monster',
  },
});

// ── 소굴 (lairController.js) ──
export const LAIR_TEXT = L({
  ko: {
    welcome: '악당 소굴에 어서 와요! 위의 목표를 하나씩 해 봐요',
    pickSpot: '먼저 3D 소굴에서 놓을 자리를 눌러요',
    noSpot: '빈자리가 없어요. 시설을 옮기거나 팔아 봐요',
    built: (name) => `${name}을(를) 지었어요!`,
    upgraded: (name, lv) => `${name} ${lv}레벨이 됐어요!`,
    moved: (name) => `${name}을(를) 옮겼어요`,
    sold: (name, n) => `${name}을(를) 팔고 ${money(n)}원을 돌려받았어요`,
    newScheme: (names) => `새 계책 발견: ${names.join(', ')}!`,
    rankStamp: '악명 단계 UP!',
    rankToast: (r) => `악명 ${r.rank}단계 '${r.name}'! 소굴 땅이 넓어졌어요`,
    opened: (lines) => `새로 열림: ${lines.join(' · ')}`,
    nope: '여기는 안 돼요',
  },
  en: {
    welcome: 'Welcome to your villain lair! Try the goals at the top, one by one',
    pickSpot: 'First tap a spot in the 3D lair',
    noSpot: 'No free space. Try moving or selling a building',
    built: (name) => `${name} built!`,
    upgraded: (name, lv) => `${name} is now level ${lv}!`,
    moved: (name) => `${name} moved`,
    sold: (name, n) => `Sold the ${name} for ${money(n)} coins`,
    newScheme: (names) => `New combo found: ${names.join(', ')}!`,
    rankStamp: 'Rank UP!',
    rankToast: (r) => `Rank ${r.rank}: ${r.name}! Your lair land got bigger`,
    opened: (lines) => `New: ${lines.join(' · ')}`,
    nope: "Can't go here",
  },
});

// ── 소굴 짓기 · 강화 (lairActions.js) ──
export const LAIR_ACTION_TEXT = L({
  ko: {
    poorBuild: (name, n) => `${name}을(를) 지을 돈이 ${money(n)} 모자라요. 마을을 부숴서 벌어 와요`,
    poorUp: (n) => `강화할 돈이 ${money(n)} 모자라요. 한 번 더 출동해 봐요`,
    notYet: '아직 다 못 했어요',
  },
  en: {
    poorBuild: (name, n) => `You need ${money(n)} more coins to build the ${name}. Go smash a town!`,
    poorUp: (n) => `You need ${money(n)} more coins to upgrade. Try one more raid!`,
    notYet: 'Not done yet',
  },
});
