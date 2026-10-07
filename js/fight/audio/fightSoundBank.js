// 펑펑 토끼 효과음 모음 (소리 하나하나의 모양)
// 소리 재료(음·잡음·와르르)는 synthKit.js, 켜고 끄는 장치·게임 소식 연결은 fightSounds.js 에 있습니다.
//
//   FIGHT_SOUNDS[이름] = { volume: 크기, gap: 같은 소리 사이 최소 간격(밀리초), vary: 높낮이 흔들림,
//                          important: 소리가 많이 겹쳐도 꼭 냄, make(kit) }
//
// 소리 목록
//   pew 블록 총 · enemyPew 미친토끼 총 · swish 칼 휘두르기 · clink 총알 튕김(쨍) · thock 맞음(톡)
//   ouch 내 토끼가 맞음(앗!) · pop 귀 블록 톡 · bigPop 토끼가 펑! (가장 신나는 소리) · tick 총알이 벽에 딱
//   reload 장전 딸깍-착 · ready 장전 끝 · dry 빈 총 딸깍 · jump 점프 보잉 · land 착지 콩 · alert 미친토끼 '!' 찍
//   windup 공격 준비 끼이익 · slam 망치 쾅 · crate 나무 상자 똑 · crateBreak 상자 와장창
//   munch 당근 와작와작 · start 시작 띠링 · win 승리 빰빠밤 · lose 슬픈 뿌우 · click 단추 딸깍
//
// 소리를 바꾸고 싶으면: volume(크기)부터 바꿔 보세요. freq 는 높낮이(Hz), decay 는 사라지는 시간(초)입니다.

import { tone, noise, melody, clatter, bounce, note, pick } from './synthKit.js';

export const FIGHT_SOUNDS = {
  // 블록 총 '퓨' (자주 나니까 짧고 가볍게)
  pew: {
    volume: 0.42,
    gap: 40,
    vary: 0.06,
    make(kit) {
      tone(kit, { type: 'square', freq: 1500, to: 440, glide: 0.085, attack: 0.002, decay: 0.09, volume: 0.45, filter: { type: 'lowpass', freq: 3800, q: 0.8 } });
      tone(kit, { type: 'sine', freq: 190, to: 90, glide: 0.05, decay: 0.05, volume: 0.6 });
      noise(kit, { filter: 'bandpass', freq: 4200, q: 3, decay: 0.014, volume: 0.6 });
    },
  },

  // 미친토끼 총 '퓨웅' (낮고 느릿하게 — 듣고 피할 수 있게)
  enemyPew: {
    volume: 0.4,
    gap: 50,
    vary: 0.07,
    make(kit) {
      tone(kit, { type: 'sawtooth', freq: 760, to: 210, glide: 0.16, attack: 0.004, decay: 0.17, volume: 0.9, vibrato: 0.05, filter: { type: 'lowpass', freq: 1900, to: 700, glide: 0.16, q: 4 } });
      tone(kit, { type: 'square', freq: 380, to: 140, glide: 0.14, decay: 0.12, volume: 0.25, filter: { type: 'lowpass', freq: 1200, q: 1 } });
      noise(kit, { filter: 'bandpass', freq: 1500, q: 2, decay: 0.03, volume: 0.6 });
    },
  },

  // 칼 휘두르기 '휙'
  swish: {
    volume: 0.7,
    gap: 60,
    vary: 0.1,
    make(kit) {
      noise(kit, { filter: 'bandpass', freq: 500, to: 3400, glide: 0.15, q: 1.4, attack: 0.04, decay: 0.13, volume: 1.2 });
      noise(kit, { at: 0.03, filter: 'highpass', freq: 5000, decay: 0.08, volume: 0.25 });
      tone(kit, { type: 'sine', at: 0.05, freq: 2600, to: 3100, glide: 0.1, decay: 0.12, volume: 0.06 });
    },
  },

  // 칼에 총알이 튕김 '쨍'
  clink: {
    volume: 0.5,
    gap: 50,
    vary: 0.06,
    make(kit) {
      noise(kit, { filter: 'highpass', freq: 5000, decay: 0.02, volume: 1.2 });
      tone(kit, { type: 'sine', freq: 2250, decay: 0.3, volume: 0.8 });
      tone(kit, { type: 'sine', freq: 5650, decay: 0.12, volume: 0.3 });
      tone(kit, { type: 'triangle', freq: 3380, decay: 0.2, volume: 0.3 });
    },
  },

  // 맞음 '톡' (플라스틱 블록을 치는 소리)
  thock: {
    volume: 0.75,
    gap: 35,
    vary: 0.15,
    make(kit) {
      tone(kit, { type: 'triangle', freq: 440, to: 150, glide: 0.06, attack: 0.001, decay: 0.08, volume: 0.7 });
      noise(kit, { filter: 'bandpass', freq: 1200, q: 2, decay: 0.045, volume: 1 });
      tone(kit, { type: 'sine', freq: 130, to: 80, glide: 0.05, decay: 0.06, volume: 0.5 });
    },
  },

  // 내 토끼가 맞음 '앗!' (짧은 고무 삑)
  ouch: {
    volume: 0.45,
    gap: 120,
    vary: 0.05,
    make(kit) {
      tone(kit, { type: 'triangle', freq: 1250, to: 640, glide: 0.13, attack: 0.006, decay: 0.15, volume: 1, vibrato: 0.03, filter: { type: 'lowpass', freq: 3000, q: 1 } });
      tone(kit, { type: 'sine', freq: 2500, to: 1280, glide: 0.13, decay: 0.1, volume: 0.2 });
    },
  },

  // 귀 블록이 톡 떨어짐 (작은 플라스틱 '퐁' + 바닥에 '틱')
  pop: {
    volume: 0.7,
    gap: 30,
    vary: 0.15,
    make(kit) {
      tone(kit, { type: 'sine', freq: 380, to: 1500, glide: 0.045, attack: 0.001, decay: 0.065, volume: 0.85 });
      noise(kit, { filter: 'bandpass', freq: 2400, q: 3, decay: 0.025, volume: 0.7 });
      noise(kit, { at: 0.17 + Math.random() * 0.12, filter: 'bandpass', freq: 3200, q: 6, decay: 0.02, volume: 0.35 });
    },
  },

  // 펑! 토끼가 터짐 — 가장 신나는 소리
  //   1) 쭉 부푸는 '뿌잉' → 2) 큰 '펑' (톡 터지는 소리 + 묵직한 쿵 + 바람) → 3) 반짝 → 4) 블록이 와르르 + 통통통
  bigPop: {
    volume: 0.55, // 다른 소리보다 훨씬 크지만, 너무 커서 다른 소리가 묻히지 않게
    gap: 60,
    vary: 0.05,
    important: true,
    make(kit) {
      const p = 0.07; // 부푼 뒤 터지는 순간
      tone(kit, { type: 'sine', freq: 420, to: 1150, glide: 0.07, attack: 0.012, decay: 0.06, volume: 0.32 });
      // 펑: 톡 터지는 첫소리
      noise(kit, { at: p, filter: 'bandpass', freq: 1500, q: 0.7, attack: 0.001, decay: 0.06, volume: 1.5 });
      noise(kit, { at: p, filter: 'highpass', freq: 3200, attack: 0.001, decay: 0.035, volume: 0.7 });
      // 만화 같은 '펑' 몸통 (높은 데서 뚝 떨어지는 음)
      tone(kit, { type: 'sine', at: p, freq: 620, to: 85, glide: 0.2, attack: 0.002, decay: 0.3, volume: 1 });
      tone(kit, { type: 'triangle', at: p, freq: 300, to: 60, glide: 0.28, attack: 0.002, decay: 0.34, volume: 0.55 });
      // 배를 울리는 쿵
      tone(kit, { type: 'sine', at: p, freq: 95, to: 38, glide: 0.32, attack: 0.003, decay: 0.48, volume: 0.95 });
      // 퍼지는 바람
      noise(kit, { at: p, filter: 'lowpass', freq: 2600, to: 220, glide: 0.5, attack: 0.004, decay: 0.5, volume: 0.6 });
      // 반짝 (꽃가루처럼)
      for (let i = 0; i < 4; i++) {
        tone(kit, { type: 'triangle', at: p + 0.04 + i * 0.05 + Math.random() * 0.02, freq: note(pick(['C6', 'E6', 'G6', 'A6', 'C7'])), decay: 0.16, volume: 0.13 });
      }
      // 블록이 와르르 + 하나가 통통통
      clatter(kit, { at: p + 0.1, count: 26, spread: 0.85, volume: 1.05 });
      bounce(kit, { at: p + 0.28, first: 0.2, count: 6, volume: 0.7, freq: 2800 + Math.random() * 600 });
    },
  },

  // 총알이 벽·나무에 '딱'
  tick: {
    volume: 0.32,
    gap: 45,
    vary: 0.2,
    make(kit) {
      noise(kit, { filter: 'bandpass', freq: 3800, q: 3, decay: 0.022, volume: 3 });
      tone(kit, { type: 'triangle', freq: 1300, to: 900, glide: 0.02, decay: 0.025, volume: 0.6 });
    },
  },

  // 장전 '딸깍-착'
  reload: {
    volume: 0.6,
    gap: 150,
    vary: 0.03,
    make(kit) {
      noise(kit, { filter: 'bandpass', freq: 2800, q: 5, decay: 0.025, volume: 1 });
      tone(kit, { type: 'triangle', freq: 900, decay: 0.03, volume: 0.3 });
      noise(kit, { at: 0.16, filter: 'bandpass', freq: 1600, q: 3, decay: 0.04, volume: 1.1 });
      tone(kit, { type: 'triangle', at: 0.16, freq: 520, to: 380, glide: 0.04, decay: 0.05, volume: 0.4 });
    },
  },

  // 장전 끝 '척-띵'
  ready: {
    volume: 0.5,
    gap: 120,
    vary: 0,
    make(kit) {
      noise(kit, { filter: 'bandpass', freq: 2200, q: 4, decay: 0.03, volume: 1 });
      tone(kit, { type: 'sine', at: 0.03, freq: note('E6'), decay: 0.12, volume: 0.22 });
      tone(kit, { type: 'sine', at: 0.08, freq: note('B6'), decay: 0.2, volume: 0.16 });
    },
  },

  // 빈 총 '틱'
  dry: {
    volume: 0.5,
    gap: 120,
    vary: 0.05,
    make(kit) {
      noise(kit, { filter: 'highpass', freq: 3500, decay: 0.018, volume: 1.2 });
      tone(kit, { type: 'triangle', freq: 1800, decay: 0.015, volume: 0.6 });
    },
  },

  // 점프 '보잉~' (장난감 용수철처럼 통통 떨리며 올라감)
  jump: {
    volume: 0.5,
    gap: 150,
    vary: 0.06,
    make(kit) {
      noise(kit, { filter: 'bandpass', freq: 1900, q: 3, decay: 0.018, volume: 0.5 }); // 발로 '톡' 차기
      tone(kit, { type: 'sine', freq: 230, to: 720, glide: 0.2, attack: 0.004, decay: 0.24, volume: 0.6, vibrato: 0.09, vibratoRate: 24 });
      tone(kit, { type: 'triangle', at: 0.01, freq: 460, to: 1440, glide: 0.18, decay: 0.12, volume: 0.14, vibrato: 0.06, vibratoRate: 24 });
    },
  },

  // 착지 '콩' (말랑한 플라스틱 쿵 + 작은 딸깍)
  land: {
    volume: 0.5,
    gap: 150,
    vary: 0.07,
    make(kit) {
      tone(kit, { type: 'sine', freq: 160, to: 70, glide: 0.08, attack: 0.002, decay: 0.12, volume: 0.75 });
      noise(kit, { filter: 'lowpass', freq: 700, decay: 0.05, volume: 0.45 });
      noise(kit, { at: 0.012, filter: 'bandpass', freq: 3400, q: 4, decay: 0.012, volume: 0.55 });
      tone(kit, { type: 'triangle', at: 0.012, freq: 2300, decay: 0.012, volume: 0.12 });
    },
  },

  // 미친토끼가 나를 봄 '찍찍!'
  alert: {
    volume: 0.5,
    gap: 200,
    vary: 0.08,
    make(kit) {
      const soft = { type: 'lowpass', freq: 5000, q: 0.8 };
      tone(kit, { type: 'square', freq: 900, to: 1700, glide: 0.06, decay: 0.07, volume: 0.35, filter: soft });
      tone(kit, { type: 'square', at: 0.09, freq: 1200, to: 2300, glide: 0.06, decay: 0.1, volume: 0.35, filter: soft });
    },
  },

  // 공격 준비 '끼이익' (점점 높아짐 → 피할 때!)
  windup: {
    volume: 0.32,
    gap: 120,
    vary: 0.05,
    make(kit) {
      tone(kit, { type: 'sawtooth', freq: 280, to: 1100, glide: 0.36, attack: 0.03, hold: 0.24, decay: 0.1, volume: 0.45, vibrato: 0.04, filter: { type: 'lowpass', freq: 2200, q: 2 } });
    },
  },

  // 망치 '쾅' (바닥 블록이 들썩)
  slam: {
    volume: 0.85,
    gap: 150,
    vary: 0.05,
    important: true,
    make(kit) {
      tone(kit, { type: 'sine', freq: 115, to: 36, glide: 0.3, attack: 0.002, decay: 0.5, volume: 1 });
      noise(kit, { filter: 'lowpass', freq: 900, to: 120, glide: 0.35, attack: 0.002, decay: 0.4, volume: 1 });
      tone(kit, { type: 'triangle', freq: 210, to: 90, glide: 0.12, decay: 0.14, volume: 0.45 });
      clatter(kit, { at: 0.05, count: 9, spread: 0.45, volume: 0.7 });
    },
  },

  // 나무 상자를 맞힘 '똑'
  crate: {
    volume: 0.55,
    gap: 50,
    vary: 0.12,
    make(kit) {
      tone(kit, { type: 'triangle', freq: 540, to: 420, glide: 0.05, decay: 0.07, volume: 0.6 });
      tone(kit, { type: 'sine', freq: 260, decay: 0.09, volume: 0.4 });
      noise(kit, { filter: 'bandpass', freq: 900, q: 2, decay: 0.04, volume: 0.6 });
    },
  },

  // 나무 상자가 부서짐 '와장창'
  crateBreak: {
    volume: 0.7,
    gap: 120,
    vary: 0.06,
    make(kit) {
      noise(kit, { filter: 'bandpass', freq: 700, q: 1, attack: 0.002, decay: 0.18, volume: 1 });
      tone(kit, { type: 'sine', freq: 150, to: 60, glide: 0.15, decay: 0.2, volume: 0.6 });
      for (let i = 0; i < 4; i++) {
        tone(kit, { type: 'triangle', at: Math.random() * 0.35, freq: 300 + Math.random() * 320, decay: 0.06, volume: 0.4 });
      }
      clatter(kit, { at: 0.06, count: 10, spread: 0.55, volume: 0.6, low: 1200, high: 3000 });
    },
  },

  // 당근 '와작와작' + 냠
  munch: {
    volume: 0.45,
    gap: 200,
    vary: 0.05,
    make(kit) {
      for (let i = 0; i < 3; i++) {
        const at = i * 0.11;
        noise(kit, { at, filter: 'bandpass', freq: 1800 + Math.random() * 800, q: 1.5, attack: 0.003, decay: 0.06, volume: 1 });
        noise(kit, { at: at + 0.01, filter: 'highpass', freq: 4000, decay: 0.03, volume: 0.45 });
      }
      tone(kit, { type: 'sine', at: 0.34, freq: note('G5'), to: note('C6'), glide: 0.08, decay: 0.16, volume: 0.25 });
    },
  },

  // 시작 '띠리링'
  start: {
    volume: 0.45,
    gap: 500,
    vary: 0,
    make(kit) {
      melody(kit, [['G4', 0, 0.07], ['C5', 0.07, 0.07], ['E5', 0.14, 0.07], ['G5', 0.21, 0.07], ['C6', 0.28, 0.22]], { type: 'square', volume: 0.22, filter: { type: 'lowpass', freq: 4000, q: 0.7 } });
      tone(kit, { type: 'sine', at: 0.28, freq: note('C7'), decay: 0.25, volume: 0.08 });
    },
  },

  // 다 터뜨렸어요! 빰빠밤
  win: {
    volume: 0.6,
    gap: 1000,
    vary: 0,
    important: true,
    make(kit) {
      const lead = [['C5', 0, 0.1], ['E5', 0.11, 0.1], ['G5', 0.22, 0.1], ['C6', 0.33, 0.26], ['A5', 0.62, 0.1], ['C6', 0.74, 0.62]];
      const harmony = [['E4', 0, 0.1], ['G4', 0.11, 0.1], ['C5', 0.22, 0.1], ['E5', 0.33, 0.26], ['F5', 0.62, 0.1], ['E5', 0.74, 0.62]];
      melody(kit, lead, { type: 'square', volume: 0.26, filter: { type: 'lowpass', freq: 3600, q: 0.8 } });
      melody(kit, lead, { type: 'triangle', volume: 0.3 });
      melody(kit, harmony, { type: 'triangle', volume: 0.22 });
      tone(kit, { type: 'sine', at: 0.74, freq: note('C3'), decay: 0.6, volume: 0.35 });
      for (let i = 0; i < 6; i++) {
        tone(kit, { type: 'sine', at: 0.8 + i * 0.07, freq: note(pick(['C7', 'E7', 'G7', 'D7'])), decay: 0.15, volume: 0.07 });
      }
    },
  },

  // 내 토끼가 터졌어요… 뿌- 뿌- 뿌- 뿌우우 (슬픈 트롬본)
  lose: {
    volume: 0.55,
    gap: 1000,
    vary: 0,
    important: true,
    make(kit) {
      const notes = [['G4', 0, 0.3], ['F#4', 0.36, 0.3], ['F4', 0.72, 0.3], ['E4', 1.08, 0.95]];
      for (const [name, at, length] of notes) {
        const long = length > 0.5;
        for (const detune of [0.996, 1.004]) {
          tone(kit, {
            type: 'sawtooth', freq: note(name) * detune, at, attack: 0.03, hold: length * 0.7, decay: length * 0.4 + 0.05,
            volume: 0.22, vibrato: long ? 0.025 : 0,
            filter: { type: 'lowpass', freq: 300, to: 1500, glide: 0.12, q: 2 },
          });
        }
      }
    },
  },

  // 단추 '딸깍'
  click: {
    volume: 0.5,
    gap: 40,
    vary: 0.08,
    make(kit) {
      noise(kit, { filter: 'bandpass', freq: 3200, q: 3, decay: 0.03, volume: 2.6 });
      tone(kit, { type: 'sine', freq: 1900, to: 1500, glide: 0.03, decay: 0.035, volume: 0.5 });
    },
  },
};
