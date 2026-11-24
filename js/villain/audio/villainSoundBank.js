// ─────────────────────────────────────────────────────────────
// 악당 타이쿤 효과음 모음 (소리 하나하나의 모양)
// 소리 재료(음·잡음·와르르)는 js/fight/audio/synthKit.js 를 빌려 쓰고, 켜고 끄는 장치·게임 소식 연결은 villainSounds.js 에 있습니다.
//
//   VILLAIN_SOUNDS[이름] = { volume: 크기, gap: 같은 소리 사이 최소 간격(1/1000초), vary: 높낮이 흔들림,
//                            important: 소리가 많이 겹쳐도 꼭 냄, make(kit) }
//
// 소리 목록
//   stack 블록 쌓임(딸깍) · built 괴수 완성(짜잔) · step 쿵 발걸음 · headbutt 박치기(퍽) · claw 집게 휘두름(휙-착)
//   fire 불 뿜기(화르르) · charge 돌진 준비(부르릉) · dash 돌진(슈웅-쾅) · thud 맞음(툭) · ouch 괴수가 맞음
//   crumble 건물 블록 와르르 · collapse 건물 무너짐(우르르 쾅) · coin 돈(짤랑) · cash 돈 많이(짤랑짤랑)
//   siren 영웅 출동 사이렌 · heroLand 영웅 착지(번쩍-쿵) · sword 칼(챙) · leap 영웅 뛰어오름 · partLost 부품 떨어짐
//   pop 펑! (가장 신나는 소리) · win 승리 · lose 패배 · click 단추 · open 화면 넘김 · buy 샀어요 · nope 안 돼요 · launch 출동!
//   ── 2단계 소리 (영웅 셋의 공격 · 방패 · 얼음, 소굴의 짓기 · 강화 · 계책 · 목표 · 악명 단계) 는 villainSoundBank2.js ──
//
// 소리를 바꾸고 싶으면: volume(크기)부터 바꿔 보세요. freq 는 높낮이(Hz), decay 는 사라지는 시간(초)입니다.
// ─────────────────────────────────────────────────────────────

import { tone, noise, melody, clatter, bounce } from '../../fight/audio/synthKit.js';
import { STAGE2_SOUNDS } from './villainSoundBank2.js';

export const VILLAIN_SOUNDS = {
  ...STAGE2_SOUNDS, // 2단계 소리 (영웅 셋 · 소굴) → villainSoundBank2.js
  // 블록 하나가 딸깍 쌓임 (괴수가 조립될 때 촤르륵 이어짐)
  stack: {
    volume: 0.5,
    gap: 28,
    vary: 0.22,
    make(kit) {
      noise(kit, { filter: 'bandpass', freq: 2600, q: 5, decay: 0.022, volume: 0.9 });
      tone(kit, { type: 'triangle', freq: 880, to: 620, glide: 0.03, decay: 0.045, volume: 0.4 });
    },
  },

  // 괴수 완성 '짜-잔' (낮고 으스스하지만 귀엽게)
  built: {
    volume: 0.6,
    gap: 300,
    important: true,
    make(kit) {
      melody(kit, [['E3', 0, 0.1], ['G3', 0.09, 0.1], ['Bb3', 0.18, 0.1], ['E4', 0.28, 0.3]], { type: 'square', volume: 0.32, filter: { type: 'lowpass', freq: 2200, q: 1 } });
      tone(kit, { type: 'sawtooth', freq: 82, to: 62, glide: 0.4, at: 0.28, hold: 0.1, decay: 0.4, volume: 0.5, filter: { type: 'lowpass', freq: 500, q: 2 } });
      noise(kit, { at: 0.28, filter: 'highpass', freq: 5200, decay: 0.2, volume: 0.25 });
    },
  },

  // 쿵 발걸음 (자주 나니까 작게)
  step: {
    volume: 0.42,
    gap: 110,
    vary: 0.12,
    make(kit) {
      tone(kit, { type: 'sine', freq: 120, to: 52, glide: 0.09, decay: 0.13, volume: 1 });
      noise(kit, { filter: 'lowpass', freq: 420, decay: 0.05, volume: 0.55 });
    },
  },

  // 박치기 '퍽'
  headbutt: {
    volume: 0.6,
    gap: 90,
    vary: 0.1,
    make(kit) {
      tone(kit, { type: 'sine', freq: 210, to: 60, glide: 0.1, decay: 0.16, volume: 1.1 });
      tone(kit, { type: 'square', freq: 330, to: 110, glide: 0.05, decay: 0.06, volume: 0.3, filter: { type: 'lowpass', freq: 1400, q: 1 } });
      noise(kit, { filter: 'bandpass', freq: 900, q: 1.2, decay: 0.06, volume: 0.8 });
    },
  },

  // 집게 휘두름 '휙-착'
  claw: {
    volume: 0.95,
    gap: 90,
    vary: 0.1,
    make(kit) {
      noise(kit, { filter: 'bandpass', freq: 600, to: 3600, glide: 0.12, q: 1.6, attack: 0.03, decay: 0.1, volume: 1.1 });
      noise(kit, { at: 0.11, filter: 'bandpass', freq: 3400, q: 6, decay: 0.03, volume: 1 });
      tone(kit, { type: 'square', at: 0.11, freq: 1250, to: 700, glide: 0.04, decay: 0.05, volume: 0.3 });
    },
  },

  // 불 뿜기 '화르르' (뿜는 동안 여러 번 이어 붙음)
  fire: {
    volume: 0.5,
    gap: 150,
    vary: 0.15,
    make(kit) {
      noise(kit, { filter: 'bandpass', freq: 380, to: 1500, glide: 0.25, q: 0.8, attack: 0.03, hold: 0.12, decay: 0.22, volume: 1.2 });
      noise(kit, { filter: 'highpass', freq: 3800, attack: 0.02, hold: 0.08, decay: 0.16, volume: 0.22 });
      tone(kit, { type: 'sawtooth', freq: 96, to: 150, glide: 0.25, attack: 0.03, hold: 0.1, decay: 0.2, volume: 0.35, vibrato: 0.2, vibratoRate: 22, filter: { type: 'lowpass', freq: 600, q: 1 } });
    },
  },

  // 돌진 준비 '부르릉' (발을 구르며 뒤로 당김)
  charge: {
    volume: 0.6,
    gap: 300,
    make(kit) {
      tone(kit, { type: 'sawtooth', freq: 70, to: 210, glide: 0.5, attack: 0.04, hold: 0.36, decay: 0.12, volume: 0.7, vibrato: 0.12, vibratoRate: 26, filter: { type: 'lowpass', freq: 500, to: 1600, glide: 0.5, q: 3 } });
      noise(kit, { filter: 'bandpass', freq: 300, to: 1200, glide: 0.5, q: 1, attack: 0.1, hold: 0.3, decay: 0.1, volume: 0.45 });
    },
  },

  // 돌진 '슈웅'
  dash: {
    volume: 0.7,
    gap: 200,
    make(kit) {
      noise(kit, { filter: 'bandpass', freq: 400, to: 4200, glide: 0.28, q: 1.2, attack: 0.05, hold: 0.12, decay: 0.2, volume: 1.2 });
      tone(kit, { type: 'square', freq: 180, to: 620, glide: 0.3, attack: 0.03, hold: 0.15, decay: 0.12, volume: 0.28, filter: { type: 'lowpass', freq: 1500, q: 1 } });
    },
  },

  // 무언가 맞음 '툭' (아주 자주 남)
  thud: {
    volume: 0.45,
    gap: 55,
    vary: 0.18,
    make(kit) {
      tone(kit, { type: 'triangle', freq: 300, to: 130, glide: 0.05, decay: 0.07, volume: 0.9 });
      noise(kit, { filter: 'bandpass', freq: 1700, q: 2, decay: 0.03, volume: 0.6 });
    },
  },

  // 내 괴수가 맞음 '앗' (살짝 내려가는 음)
  ouch: {
    volume: 0.5,
    gap: 160,
    vary: 0.08,
    make(kit) {
      tone(kit, { type: 'square', freq: 420, to: 250, glide: 0.11, attack: 0.004, decay: 0.13, volume: 0.5, filter: { type: 'lowpass', freq: 1500, q: 2 } });
      tone(kit, { type: 'sine', freq: 150, to: 80, glide: 0.08, decay: 0.1, volume: 0.6 });
    },
  },

  // 건물 블록 와르르 (부서질 때마다)
  crumble: {
    volume: 0.5,
    gap: 90,
    vary: 0.14,
    make(kit) {
      clatter(kit, { count: 7, spread: 0.28, volume: 0.9, low: 1500, high: 3800 });
      tone(kit, { type: 'sine', freq: 150, to: 80, glide: 0.07, decay: 0.09, volume: 0.5 });
    },
  },

  // 건물 무너짐 '우르르 쾅'
  collapse: {
    volume: 0.6,
    gap: 220,
    important: true,
    make(kit) {
      tone(kit, { type: 'sine', freq: 130, to: 38, glide: 0.35, decay: 0.5, volume: 1.2 });
      noise(kit, { filter: 'lowpass', freq: 900, to: 180, glide: 0.5, attack: 0.005, hold: 0.1, decay: 0.55, volume: 1 });
      clatter(kit, { at: 0.04, count: 26, spread: 1.0, volume: 0.9 });
      bounce(kit, { at: 0.55, first: 0.16, count: 4, volume: 0.4 });
    },
  },

  // 돈 '짤랑' (블록을 부술 때마다 조금씩)
  coin: {
    volume: 0.32,
    gap: 120,
    vary: 0.05,
    make(kit) {
      tone(kit, { type: 'square', freq: 1320, decay: 0.05, volume: 0.35, filter: { type: 'lowpass', freq: 5200, q: 1 } });
      tone(kit, { type: 'square', at: 0.055, freq: 1976, hold: 0.02, decay: 0.16, volume: 0.35, filter: { type: 'lowpass', freq: 6000, q: 1 } });
      tone(kit, { type: 'sine', at: 0.055, freq: 3952, decay: 0.12, volume: 0.12 });
    },
  },

  // 돈 많이 '짤랑짤랑짤랑' (결과 화면)
  cash: {
    volume: 0.7,
    gap: 200,
    important: true,
    make(kit) {
      for (let i = 0; i < 6; i++) {
        const at = i * 0.07;
        tone(kit, { type: 'square', at, freq: 1320 * (1 + i * 0.06), decay: 0.05, volume: 0.3, filter: { type: 'lowpass', freq: 5200, q: 1 } });
        tone(kit, { type: 'square', at: at + 0.035, freq: 1976 * (1 + i * 0.06), decay: 0.09, volume: 0.3, filter: { type: 'lowpass', freq: 6000, q: 1 } });
      }
      melody(kit, [['E6', 0.44, 0.1], ['B6', 0.52, 0.3]], { type: 'triangle', volume: 0.4 });
    },
  },

  // 영웅 출동 사이렌 '위-오 위-오'
  siren: {
    volume: 0.8,
    gap: 1200,
    important: true,
    make(kit) {
      for (let i = 0; i < 3; i++) {
        const at = i * 0.56;
        tone(kit, { type: 'square', at, freq: 620, to: 930, glide: 0.26, attack: 0.02, hold: 0.24, decay: 0.05, volume: 0.42, filter: { type: 'lowpass', freq: 2400, q: 2 } });
        tone(kit, { type: 'square', at: at + 0.28, freq: 930, to: 620, glide: 0.26, attack: 0.02, hold: 0.22, decay: 0.06, volume: 0.42, filter: { type: 'lowpass', freq: 2400, q: 2 } });
      }
    },
  },

  // 영웅 착지 '번쩍-쿵'
  heroLand: {
    volume: 0.6,
    gap: 300,
    important: true,
    make(kit) {
      noise(kit, { filter: 'highpass', freq: 2400, to: 7000, glide: 0.1, attack: 0.002, decay: 0.16, volume: 0.6 });
      tone(kit, { type: 'sine', at: 0.03, freq: 170, to: 36, glide: 0.3, decay: 0.5, volume: 1.3 });
      noise(kit, { at: 0.03, filter: 'lowpass', freq: 700, to: 150, glide: 0.4, decay: 0.45, volume: 0.9 });
      melody(kit, [['C5', 0.12, 0.08], ['G5', 0.2, 0.08], ['C6', 0.28, 0.22]], { type: 'square', volume: 0.22, filter: { type: 'lowpass', freq: 3600, q: 1 } });
      clatter(kit, { at: 0.1, count: 8, spread: 0.5, volume: 0.5 });
    },
  },

  // 영웅 칼 '챙'
  sword: {
    volume: 0.8,
    gap: 80,
    vary: 0.1,
    make(kit) {
      noise(kit, { filter: 'bandpass', freq: 900, to: 4600, glide: 0.09, q: 1.6, attack: 0.02, decay: 0.08, volume: 0.9 });
      tone(kit, { type: 'triangle', at: 0.07, freq: 2400, decay: 0.14, volume: 0.3 });
      tone(kit, { type: 'sine', at: 0.07, freq: 3620, decay: 0.2, volume: 0.14 });
    },
  },

  // 영웅이 높이 뛰어오름 '보잉'
  leap: {
    volume: 0.5,
    gap: 300,
    make(kit) {
      tone(kit, { type: 'triangle', freq: 280, to: 920, glide: 0.3, attack: 0.01, hold: 0.16, decay: 0.16, volume: 0.6, vibrato: 0.04, vibratoRate: 16 });
      noise(kit, { filter: 'bandpass', freq: 800, to: 2600, glide: 0.3, q: 1.4, attack: 0.05, decay: 0.2, volume: 0.35 });
    },
  },

  // 공격 부품이 떨어져 나감 '뚝-또르르'
  partLost: {
    volume: 0.6,
    gap: 200,
    important: true,
    make(kit) {
      tone(kit, { type: 'square', freq: 520, to: 180, glide: 0.2, decay: 0.24, volume: 0.45, filter: { type: 'lowpass', freq: 1800, q: 2 } });
      bounce(kit, { at: 0.16, first: 0.15, count: 4, volume: 0.6, freq: 2400 });
    },
  },

  // 펑! (괴수나 영웅이 블록으로 터짐 — 가장 신나는 소리)
  pop: {
    volume: 0.55,
    gap: 200,
    important: true,
    make(kit) {
      tone(kit, { type: 'sine', freq: 520, to: 44, glide: 0.2, decay: 0.42, volume: 1.4 });
      noise(kit, { filter: 'lowpass', freq: 5200, to: 300, glide: 0.3, attack: 0.001, decay: 0.34, volume: 1.1 });
      tone(kit, { type: 'square', freq: 1500, to: 300, glide: 0.07, decay: 0.08, volume: 0.35 });
      clatter(kit, { at: 0.06, count: 30, spread: 1.1, volume: 1 });
      bounce(kit, { at: 0.7, first: 0.2, count: 5, volume: 0.45 });
    },
  },

  // 승리 (악당답게 '음하하' 느낌의 단조 팡파르 → 밝게 끝)
  win: {
    volume: 0.6,
    gap: 1500,
    important: true,
    make(kit) {
      melody(kit, [['A4', 0, 0.12], ['A4', 0.14, 0.12], ['C5', 0.28, 0.12], ['E5', 0.42, 0.2], ['D5', 0.66, 0.1], ['E5', 0.78, 0.12], ['A5', 0.92, 0.5]], { type: 'square', volume: 0.3, filter: { type: 'lowpass', freq: 3200, q: 1 } });
      melody(kit, [['A2', 0, 0.26], ['E3', 0.28, 0.26], ['A2', 0.66, 0.2], ['A3', 0.92, 0.5]], { type: 'triangle', volume: 0.5 });
      melody(kit, [['C#6', 0.92, 0.5], ['E6', 1.0, 0.45]], { type: 'triangle', volume: 0.22, vibrato: 0.01 });
      noise(kit, { at: 0.92, filter: 'highpass', freq: 6000, decay: 0.4, volume: 0.18 });
    },
  },

  // 패배 '뿌우-웅' (슬프지만 웃기게)
  lose: {
    volume: 0.9,
    gap: 1500,
    important: true,
    make(kit) {
      melody(kit, [['E4', 0, 0.2], ['Eb4', 0.24, 0.2], ['D4', 0.48, 0.2]], { type: 'sawtooth', volume: 0.3, filter: { type: 'lowpass', freq: 1300, q: 2 } });
      tone(kit, { type: 'sawtooth', at: 0.72, freq: 277, to: 130, glide: 0.6, attack: 0.02, hold: 0.3, decay: 0.4, volume: 0.36, vibrato: 0.04, vibratoRate: 7, filter: { type: 'lowpass', freq: 1100, q: 2 } });
    },
  },

  // 단추 딸깍
  click: {
    volume: 0.4,
    gap: 40,
    vary: 0.04,
    make(kit) {
      noise(kit, { filter: 'bandpass', freq: 3000, q: 5, decay: 0.016, volume: 0.9 });
      tone(kit, { type: 'triangle', freq: 760, to: 520, glide: 0.03, decay: 0.04, volume: 0.5 });
    },
  },

  // 화면이 넘어감 '슉'
  open: {
    volume: 0.55,
    gap: 120,
    make(kit) {
      noise(kit, { filter: 'bandpass', freq: 700, to: 2600, glide: 0.1, q: 1.5, attack: 0.02, decay: 0.08, volume: 0.7 });
      tone(kit, { type: 'triangle', freq: 440, to: 660, glide: 0.08, decay: 0.09, volume: 0.35 });
    },
  },

  // 부품을 샀어요 '짤랑-띠링'
  buy: {
    volume: 0.75,
    gap: 300,
    important: true,
    make(kit) {
      tone(kit, { type: 'square', freq: 1320, decay: 0.05, volume: 0.3, filter: { type: 'lowpass', freq: 5200, q: 1 } });
      tone(kit, { type: 'square', at: 0.05, freq: 1976, decay: 0.1, volume: 0.3, filter: { type: 'lowpass', freq: 6000, q: 1 } });
      melody(kit, [['E5', 0.14, 0.08], ['G#5', 0.22, 0.08], ['B5', 0.3, 0.08], ['E6', 0.38, 0.3]], { type: 'triangle', volume: 0.42 });
    },
  },

  // 안 돼요 (돈이 모자람) '붑-붑'
  nope: {
    volume: 0.45,
    gap: 200,
    make(kit) {
      tone(kit, { type: 'square', freq: 196, hold: 0.05, decay: 0.05, volume: 0.4, filter: { type: 'lowpass', freq: 900, q: 1 } });
      tone(kit, { type: 'square', at: 0.13, freq: 156, hold: 0.08, decay: 0.08, volume: 0.4, filter: { type: 'lowpass', freq: 900, q: 1 } });
    },
  },

  // 출동! (괴수를 마을로 보냄) '두둥-'
  launch: {
    volume: 0.6,
    gap: 500,
    important: true,
    make(kit) {
      tone(kit, { type: 'sine', freq: 110, to: 55, glide: 0.2, decay: 0.3, volume: 1 });
      tone(kit, { type: 'sine', at: 0.2, freq: 98, to: 49, glide: 0.25, decay: 0.4, volume: 1 });
      melody(kit, [['E3', 0, 0.16], ['E3', 0.2, 0.1], ['G3', 0.32, 0.1], ['Bb3', 0.44, 0.34]], { type: 'sawtooth', volume: 0.28, filter: { type: 'lowpass', freq: 1500, q: 2 } });
      noise(kit, { at: 0.44, filter: 'bandpass', freq: 500, to: 3000, glide: 0.25, q: 1, attack: 0.05, decay: 0.25, volume: 0.4 });
    },
  },
};
