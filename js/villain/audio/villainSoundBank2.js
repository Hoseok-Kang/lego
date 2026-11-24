// ─────────────────────────────────────────────────────────────
// 악당 타이쿤 효과음 모음 2 (2단계: 마을 셋의 영웅 · 악당 소굴)
// villainSoundBank.js 의 VILLAIN_SOUNDS 에 그대로 합쳐집니다. 모양 설명은 그 파일 머리말과 같아요.
//
// 소리 목록
//   ice 얼음 던짐(쉭-팅) · freeze 괴수가 얼어 느려짐(사각사각) · blink 순간 이동(뾰롱) · hammer 철퇴(부웅-쿵)
//   slamWind 내려찍기 준비(우우웅) · slam 땅 내려찍기(콰앙) · shield 방패 듦(철컥) · clang 방패에 막힘(땡) · shieldBreak 방패 깨짐(쨍그랑)
//   build 시설 다 지음(뚝딱뚝딱-짠) · upgrade 강화(띠리링↑) · sell 팔기(짤랑-퐁) · move 옮기기(폴짝-쿵) · hint 계책 켜질 자리(반짝)
//   scheme 새 계책 발견(두구둥-빠밤) · goal 목표 달성(빰빠밤) · rankUp 악명 단계 오름(웅장한 팡파르)
// 어떤 게임 소식에 어떤 소리를 낼지는 villainSounds.js 의 EVENT_SOUNDS, 소굴 소리는 lairController.js 가 직접 냅니다.
// ─────────────────────────────────────────────────────────────

import { tone, noise, melody, clatter, bounce } from '../../fight/audio/synthKit.js';

export const STAGE2_SOUNDS = {
  // ── 2단계: 영웅 셋 ──

  // 얼음 마법사가 얼음 화살을 던짐 '쉭-팅'
  ice: {
    volume: 0.55,
    gap: 160,
    vary: 0.08,
    make(kit) {
      noise(kit, { filter: 'highpass', freq: 3000, to: 7000, glide: 0.12, attack: 0.01, decay: 0.12, volume: 0.6 });
      tone(kit, { type: 'triangle', freq: 1760, to: 2640, glide: 0.1, decay: 0.12, volume: 0.35 });
      tone(kit, { type: 'sine', at: 0.08, freq: 3520, decay: 0.18, volume: 0.18 });
    },
  },

  // 괴수가 얼어서 느려짐 '사각사각-'
  freeze: {
    volume: 0.6,
    gap: 400,
    make(kit) {
      for (let i = 0; i < 5; i++) tone(kit, { type: 'sine', at: i * 0.045, freq: 2400 + i * 260, decay: 0.12, volume: 0.25 });
      noise(kit, { filter: 'bandpass', freq: 5200, q: 3, attack: 0.02, hold: 0.1, decay: 0.25, volume: 0.45 });
      tone(kit, { type: 'triangle', freq: 600, to: 300, glide: 0.35, decay: 0.3, volume: 0.25 });
    },
  },

  // 순간 이동 '뾰롱'
  blink: {
    volume: 0.55,
    gap: 300,
    make(kit) {
      tone(kit, { type: 'sine', freq: 500, to: 2200, glide: 0.12, decay: 0.12, volume: 0.5, vibrato: 0.05, vibratoRate: 30 });
      tone(kit, { type: 'triangle', at: 0.13, freq: 2200, to: 700, glide: 0.1, decay: 0.14, volume: 0.35 });
      noise(kit, { filter: 'highpass', freq: 6000, attack: 0.01, decay: 0.2, volume: 0.25 });
    },
  },

  // 황금 수호자의 철퇴 '부웅-쿵'
  hammer: {
    volume: 0.75,
    gap: 200,
    vary: 0.08,
    make(kit) {
      noise(kit, { filter: 'bandpass', freq: 300, to: 900, glide: 0.18, q: 1, attack: 0.05, decay: 0.12, volume: 0.8 });
      tone(kit, { type: 'sine', at: 0.18, freq: 140, to: 45, glide: 0.2, decay: 0.3, volume: 1.2 });
      noise(kit, { at: 0.18, filter: 'lowpass', freq: 800, decay: 0.15, volume: 0.6 });
    },
  },

  // 내려찍기 준비 (바닥에 표시가 뜸) '우우웅'
  slamWind: {
    volume: 0.6,
    gap: 600,
    important: true,
    make(kit) {
      tone(kit, { type: 'sawtooth', freq: 60, to: 140, glide: 0.8, attack: 0.1, hold: 0.6, decay: 0.15, volume: 0.5, vibrato: 0.08, vibratoRate: 14, filter: { type: 'lowpass', freq: 400, to: 1200, glide: 0.8, q: 4 } });
      tone(kit, { type: 'square', freq: 880, hold: 0.06, decay: 0.05, volume: 0.15, filter: { type: 'lowpass', freq: 2400, q: 1 } });
      tone(kit, { type: 'square', at: 0.3, freq: 880, hold: 0.06, decay: 0.05, volume: 0.15, filter: { type: 'lowpass', freq: 2400, q: 1 } });
    },
  },

  // 땅 내려찍기 '콰앙'
  slam: {
    volume: 0.8,
    gap: 400,
    important: true,
    make(kit) {
      tone(kit, { type: 'sine', freq: 110, to: 30, glide: 0.4, decay: 0.6, volume: 1.4 });
      noise(kit, { filter: 'lowpass', freq: 1200, to: 120, glide: 0.5, attack: 0.002, decay: 0.6, volume: 1.1 });
      clatter(kit, { at: 0.05, count: 20, spread: 0.8, volume: 0.7, low: 900, high: 2600 });
    },
  },

  // 방패를 듦 '철컥'
  shield: {
    volume: 0.55,
    gap: 400,
    make(kit) {
      noise(kit, { filter: 'bandpass', freq: 2200, q: 4, decay: 0.04, volume: 0.8 });
      tone(kit, { type: 'square', at: 0.05, freq: 660, decay: 0.08, volume: 0.25, filter: { type: 'lowpass', freq: 2600, q: 2 } });
      tone(kit, { type: 'triangle', at: 0.05, freq: 1320, decay: 0.2, volume: 0.2 });
    },
  },

  // 공격이 방패에 막힘 '땡'
  clang: {
    volume: 0.55,
    gap: 140,
    vary: 0.06,
    make(kit) {
      tone(kit, { type: 'triangle', freq: 1500, decay: 0.3, volume: 0.45 });
      tone(kit, { type: 'sine', freq: 2380, decay: 0.25, volume: 0.25 });
      noise(kit, { filter: 'bandpass', freq: 4000, q: 5, decay: 0.03, volume: 0.6 });
    },
  },

  // 방패가 깨짐 '쨍그랑'
  shieldBreak: {
    volume: 0.7,
    gap: 500,
    important: true,
    make(kit) {
      noise(kit, { filter: 'highpass', freq: 2500, attack: 0.002, decay: 0.3, volume: 0.9 });
      clatter(kit, { count: 18, spread: 0.6, volume: 0.9, low: 2800, high: 6000 });
      tone(kit, { type: 'square', freq: 900, to: 220, glide: 0.3, decay: 0.3, volume: 0.25, filter: { type: 'lowpass', freq: 2000, q: 1 } });
    },
  },

  // ── 2단계: 악당 소굴 ──

  // 시설을 다 지음 '뚝딱뚝딱-짠'
  build: {
    volume: 0.6,
    gap: 300,
    important: true,
    make(kit) {
      for (let i = 0; i < 3; i++) {
        noise(kit, { at: i * 0.12, filter: 'bandpass', freq: 1800, q: 4, decay: 0.03, volume: 0.9 });
        tone(kit, { type: 'triangle', at: i * 0.12, freq: 520 + i * 90, decay: 0.05, volume: 0.35 });
      }
      melody(kit, [['C5', 0.4, 0.08], ['E5', 0.48, 0.08], ['G5', 0.56, 0.24]], { type: 'square', volume: 0.22, filter: { type: 'lowpass', freq: 3200, q: 1 } });
    },
  },

  // 시설 강화 '띠리리링↑'
  upgrade: {
    volume: 0.6,
    gap: 300,
    important: true,
    make(kit) {
      melody(kit, [['G4', 0, 0.06], ['C5', 0.06, 0.06], ['E5', 0.12, 0.06], ['G5', 0.18, 0.06], ['C6', 0.24, 0.3]], { type: 'square', volume: 0.24, filter: { type: 'lowpass', freq: 3600, q: 1 } });
      tone(kit, { type: 'sine', at: 0.24, freq: 130, to: 65, glide: 0.2, decay: 0.25, volume: 0.6 });
      noise(kit, { at: 0.24, filter: 'highpass', freq: 6000, decay: 0.25, volume: 0.2 });
    },
  },

  // 시설 팔기 '짤랑-퐁'
  sell: {
    volume: 0.6,
    gap: 300,
    make(kit) {
      bounce(kit, { first: 0.12, count: 4, volume: 0.6 });
      tone(kit, { type: 'square', at: 0.2, freq: 1320, decay: 0.05, volume: 0.3, filter: { type: 'lowpass', freq: 5200, q: 1 } });
      tone(kit, { type: 'square', at: 0.25, freq: 1976, decay: 0.12, volume: 0.3, filter: { type: 'lowpass', freq: 6000, q: 1 } });
    },
  },

  // 시설 옮기기 '폴짝-쿵'
  move: {
    volume: 0.55,
    gap: 300,
    make(kit) {
      tone(kit, { type: 'triangle', freq: 300, to: 700, glide: 0.15, decay: 0.12, volume: 0.45 });
      tone(kit, { type: 'sine', at: 0.3, freq: 160, to: 60, glide: 0.12, decay: 0.18, volume: 0.9 });
      noise(kit, { at: 0.3, filter: 'lowpass', freq: 600, decay: 0.08, volume: 0.6 });
    },
  },

  // 자리 고르는 중: 여기 놓으면 계책이 켜져요 '반짝'
  hint: {
    volume: 0.4,
    gap: 250,
    make(kit) {
      tone(kit, { type: 'sine', freq: 1568, decay: 0.12, volume: 0.4 });
      tone(kit, { type: 'sine', at: 0.07, freq: 2349, decay: 0.2, volume: 0.3 });
    },
  },

  // 새 계책 발견 '두구둥-빠밤!'
  scheme: {
    volume: 0.65,
    gap: 800,
    important: true,
    make(kit) {
      tone(kit, { type: 'sine', freq: 98, to: 60, glide: 0.1, decay: 0.12, volume: 0.9 });
      tone(kit, { type: 'sine', at: 0.12, freq: 98, to: 60, glide: 0.1, decay: 0.12, volume: 0.9 });
      melody(kit, [['D5', 0.26, 0.1], ['A5', 0.38, 0.1], ['D6', 0.5, 0.36]], { type: 'square', volume: 0.26, filter: { type: 'lowpass', freq: 3800, q: 1 } });
      melody(kit, [['F#5', 0.5, 0.36]], { type: 'triangle', volume: 0.3 });
      noise(kit, { at: 0.5, filter: 'highpass', freq: 6500, decay: 0.4, volume: 0.2 });
    },
  },

  // 목표 달성 '빰빠밤!'
  goal: {
    volume: 0.6,
    gap: 600,
    important: true,
    make(kit) {
      melody(kit, [['C5', 0, 0.1], ['C5', 0.12, 0.08], ['G5', 0.22, 0.34]], { type: 'square', volume: 0.26, filter: { type: 'lowpass', freq: 3400, q: 1 } });
      melody(kit, [['E5', 0.22, 0.34], ['C6', 0.22, 0.34]], { type: 'triangle', volume: 0.22 });
      noise(kit, { filter: 'bandpass', freq: 2500, q: 2, decay: 0.05, volume: 0.6 });
    },
  },

  // 악명 단계 오름 (웅장한 악당 팡파르)
  rankUp: {
    volume: 0.7,
    gap: 2000,
    important: true,
    make(kit) {
      melody(kit, [['D4', 0, 0.14], ['F4', 0.16, 0.14], ['A4', 0.32, 0.14], ['D5', 0.48, 0.2], ['C5', 0.72, 0.12], ['D5', 0.86, 0.12], ['F5', 1.0, 0.18], ['A5', 1.2, 0.6]], { type: 'square', volume: 0.26, filter: { type: 'lowpass', freq: 3200, q: 1 } });
      melody(kit, [['D3', 0, 0.44], ['A2', 0.48, 0.36], ['D3', 1.0, 0.18], ['D2', 1.2, 0.6]], { type: 'triangle', volume: 0.5 });
      tone(kit, { type: 'sine', at: 1.2, freq: 90, to: 40, glide: 0.4, decay: 0.6, volume: 0.9 });
      noise(kit, { at: 1.2, filter: 'highpass', freq: 5000, decay: 0.6, volume: 0.25 });
    },
  },
};
