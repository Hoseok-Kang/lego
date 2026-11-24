// ─────────────────────────────────────────────────────────────
// 악당 타이쿤 효과음 모음 3 (3단계: 새 부품 꼬리 철퇴 · 레이저 눈)
// villainSoundBank.js 의 VILLAIN_SOUNDS 에 그대로 합쳐집니다. 모양 설명은 그 파일 머리말과 같아요.
//
// 소리 목록
//   maceWind 꼬리 감아올림(끼이익-) · maceSpin 빙글 돌기(휘휘휘잉) · maceHit 철퇴에 맞음(꽝-챙)
//   laserCharge 눈빛 모으기(위이이잉↑) · laserBeam 레이저 발사(지이이잉-) · sizzle 레이저에 지져짐(치익)
// 어떤 게임 소식에 어떤 소리를 낼지는 villainSounds.js 의 ATTACK_SOUNDS · EVENT_SOUNDS 에서 정합니다.
// ─────────────────────────────────────────────────────────────

import { tone, noise } from '../../fight/audio/synthKit.js';

export const STAGE3_SOUNDS = {
  // 꼬리를 감아올림 '끼이익-' (고무줄을 당기는 느낌)
  maceWind: {
    volume: 0.5,
    gap: 250,
    vary: 0.08,
    make(kit) {
      tone(kit, { type: 'square', freq: 220, to: 520, glide: 0.38, attack: 0.03, hold: 0.25, decay: 0.12, volume: 0.22, vibrato: 0.05, vibratoRate: 18, filter: { type: 'lowpass', freq: 900, to: 2200, glide: 0.38, q: 2 } });
      noise(kit, { filter: 'bandpass', freq: 500, to: 1400, glide: 0.38, q: 2, attack: 0.08, hold: 0.22, decay: 0.1, volume: 0.35 });
    },
  },

  // 빙글 한 바퀴 '휘휘휘잉' (바람 가르는 소리가 빠르게 두 번)
  maceSpin: {
    volume: 0.85,
    gap: 250,
    vary: 0.06,
    make(kit) {
      noise(kit, { filter: 'bandpass', freq: 700, to: 3200, glide: 0.2, q: 1.8, attack: 0.03, decay: 0.16, volume: 1.1 });
      noise(kit, { at: 0.2, filter: 'bandpass', freq: 900, to: 2600, glide: 0.2, q: 1.8, attack: 0.03, decay: 0.2, volume: 0.9 });
      tone(kit, { type: 'triangle', freq: 300, to: 160, glide: 0.45, attack: 0.02, hold: 0.2, decay: 0.2, volume: 0.25, vibrato: 0.25, vibratoRate: 9 });
    },
  },

  // 철퇴에 맞음 '꽝-챙' (묵직한 쿵 + 쇠 소리)
  maceHit: {
    volume: 0.7,
    gap: 70,
    vary: 0.12,
    make(kit) {
      tone(kit, { type: 'sine', freq: 170, to: 48, glide: 0.14, decay: 0.2, volume: 1.2 });
      noise(kit, { filter: 'bandpass', freq: 1100, q: 1.4, decay: 0.07, volume: 0.9 });
      tone(kit, { type: 'square', at: 0.01, freq: 1480, to: 1320, glide: 0.1, decay: 0.12, volume: 0.12, filter: { type: 'highpass', freq: 900, q: 1 } });
    },
  },

  // 눈빛 모으기 '위이이잉↑' (점점 높아지고 빨라지는 떨림, 0.8초)
  laserCharge: {
    volume: 0.5,
    gap: 400,
    make(kit) {
      tone(kit, { type: 'sawtooth', freq: 180, to: 1400, glide: 0.8, attack: 0.05, hold: 0.7, decay: 0.08, volume: 0.28, vibrato: 0.06, vibratoRate: 30, filter: { type: 'lowpass', freq: 800, to: 4200, glide: 0.8, q: 4 } });
      tone(kit, { type: 'sine', freq: 360, to: 2800, glide: 0.8, attack: 0.1, hold: 0.62, decay: 0.08, volume: 0.25 });
      noise(kit, { filter: 'highpass', freq: 5000, attack: 0.5, hold: 0.25, decay: 0.05, volume: 0.15 });
    },
  },

  // 레이저 발사 '지이이잉-' (1초 동안 윙윙 떨리는 빛줄기)
  laserBeam: {
    volume: 0.55,
    gap: 400,
    important: true,
    make(kit) {
      tone(kit, { type: 'sawtooth', freq: 110, to: 98, glide: 1, attack: 0.02, hold: 0.85, decay: 0.15, volume: 0.45, vibrato: 0.08, vibratoRate: 40, filter: { type: 'lowpass', freq: 1800, q: 3 } });
      tone(kit, { type: 'square', freq: 880, to: 820, glide: 1, attack: 0.01, hold: 0.85, decay: 0.15, volume: 0.1, vibrato: 0.02, vibratoRate: 55 });
      noise(kit, { filter: 'bandpass', freq: 2600, q: 0.8, attack: 0.01, hold: 0.85, decay: 0.15, volume: 0.35 });
      tone(kit, { type: 'sine', freq: 1900, to: 600, glide: 0.12, decay: 0.14, volume: 0.35 }); // 처음 '피융'
    },
  },

  // 레이저에 지져짐 '치익' (자주 나니까 작고 짧게)
  sizzle: {
    volume: 0.35,
    gap: 120,
    vary: 0.2,
    make(kit) {
      noise(kit, { filter: 'highpass', freq: 3200, attack: 0.005, decay: 0.09, volume: 0.8 });
      noise(kit, { filter: 'bandpass', freq: 1200, q: 3, decay: 0.05, volume: 0.5 });
    },
  },
};
