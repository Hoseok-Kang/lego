// ─────────────────────────────────────────────────────────────
// 악당 타이쿤: 마을 사람 목소리 (만화 같은 '으악!' 비명 · '와아!' 응원 · '으앙~' 울음)
// 소리 파일 없이 브라우저가 직접 만듭니다 (js/fight/audio/synthKit.js 의 tone · noise).
// 말풍선이 뜰 때만 나고 (villagerTalk.js 가 말풍선 수를 줄여 줌), 부수는 소리보다 작게 깔립니다.
// 소리 켜기·끄기는 다른 효과음과 같은 단추를 따릅니다 (villainSounds.js 가 이 소리들을 같이 씀).
//
//   VILLAGER_SOUNDS[이름]   villainSoundBank.js 의 소리와 같은 모양 { volume, gap, vary, make(kit) }
//       이름: villagerScream_kid · _high · _low,  villagerCheer_kid · _high · _low,  villagerWail_kid · _high · _low
//   villagerVoiceFor({ kind, voice }) → 소리 이름     villagerShout 소식 → 어떤 소리를 낼지
//       kind: 상황 (data/villagerLines.js 의 이름), voice: 'kid' 꼬마 | 'high' 높은 어른 | 'low' 낮은 어른
//
// 바꾸고 싶을 때
//   전체 크기        → VOLUME (다른 효과음 발걸음 'step' 이 0.42)
//   목소리 높낮이     → VOICES 의 base (Hz, 클수록 높음), formant (목소리 색, 클수록 앵앵)
//   비명 길이        → SCREAM_SECONDS (사람마다 이 사이에서 아무렇게나)
// ─────────────────────────────────────────────────────────────

import { tone, noise } from '../../fight/audio/synthKit.js';

const VOLUME = 0.3; // 마을 사람 소리 크기 (부수는 소리 밑에 깔리게 작게)
const GAP = 220; // 같은 목소리끼리 이만큼(1/1000초) 안에는 다시 안 냄
const VARY = 0.14; // 부를 때마다 높낮이가 이만큼 흔들림 (같은 사람도 매번 조금씩 다르게)
const SCREAM_SECONDS = [0.12, 0.32]; // '악' 을 끄는 길이 (가장 짧게, 가장 길게)
const VOICES = {
  kid: { base: 780, formant: 1500 }, // 꼬마
  high: { base: 520, formant: 1150 }, // 높은 어른
  low: { base: 270, formant: 850 }, // 낮은 어른
};

const between = ([a, b]) => a + Math.random() * (b - a);

// '으악!' — 짧고 낮은 '으' 다음 높이 솟았다가 주르륵 내려가는 '악', 끝에 작은 숨소리
function scream(kit, { base, formant }) {
  const len = between(SCREAM_SECONDS);
  const fall = 0.45 + Math.random() * 0.15;
  tone(kit, { type: 'sawtooth', freq: base * 0.72, to: base * 0.82, glide: 0.05, attack: 0.008, hold: 0.03, decay: 0.03, volume: 0.32, filter: { type: 'lowpass', freq: formant * 0.75, q: 1 } });
  tone(kit, { type: 'sawtooth', at: 0.055, freq: base * 1.28, to: base * fall, glide: len + 0.1, attack: 0.012, hold: len, decay: 0.09, volume: 0.6, vibrato: 0.05, vibratoRate: 11, filter: { type: 'bandpass', freq: formant, q: 1.3 } });
  tone(kit, { type: 'square', at: 0.055, freq: base * 2.56, to: base * fall * 2, glide: len + 0.1, attack: 0.012, hold: len * 0.7, decay: 0.06, volume: 0.06, filter: { type: 'lowpass', freq: formant * 2.2, q: 1 } });
  noise(kit, { at: 0.07 + len + 0.06, filter: 'bandpass', freq: formant * 2, q: 2, decay: 0.03, volume: 0.14 });
}

// '와아!' — 아래에서 위로 올라가는 신난 소리 (영웅 응원 · 만세)
function cheer(kit, { base, formant }) {
  const len = 0.22 + Math.random() * 0.12;
  tone(kit, { type: 'sawtooth', freq: base * 0.8, to: base * 1.3, glide: len * 0.6, attack: 0.02, hold: len, decay: 0.12, volume: 0.5, vibrato: 0.04, vibratoRate: 8, filter: { type: 'bandpass', freq: formant * 1.05, q: 1.2 } });
  tone(kit, { type: 'triangle', freq: base * 1.6, to: base * 2.6, glide: len * 0.6, attack: 0.02, hold: len * 0.8, decay: 0.1, volume: 0.18 });
}

// '으앙~' — 떨리며 천천히 내려가는 울음 (괴수가 이겼을 때)
function wail(kit, { base, formant }) {
  tone(kit, { type: 'sawtooth', freq: base * 0.8, to: base * 0.9, glide: 0.08, attack: 0.02, hold: 0.06, decay: 0.04, volume: 0.3, filter: { type: 'lowpass', freq: formant * 0.7, q: 1 } });
  tone(kit, { type: 'sawtooth', at: 0.11, freq: base * 1.1, to: base * 0.7, glide: 0.65, attack: 0.03, hold: 0.5, decay: 0.2, volume: 0.5, vibrato: 0.09, vibratoRate: 6.5, filter: { type: 'bandpass', freq: formant * 0.9, to: formant * 0.7, glide: 0.65, q: 1.4 } });
}

const MAKERS = { villagerScream: scream, villagerCheer: cheer, villagerWail: wail };

export const VILLAGER_SOUNDS = {};
for (const [prefix, make] of Object.entries(MAKERS)) {
  for (const [voice, shape] of Object.entries(VOICES)) {
    VILLAGER_SOUNDS[`${prefix}_${voice}`] = { volume: VOLUME, gap: GAP, vary: VARY, make: (kit) => make(kit, shape) };
  }
}

const CHEER_KINDS = new Set(['hero', 'saved']);

// villagerShout 소식 → 소리 이름 (모르는 목소리면 높은 어른)
export function villagerVoiceFor({ kind, voice } = {}) {
  const who = VOICES[voice] ? voice : 'high';
  if (CHEER_KINDS.has(kind)) return `villagerCheer_${who}`;
  if (kind === 'wail') return `villagerWail_${who}`;
  return `villagerScream_${who}`;
}
