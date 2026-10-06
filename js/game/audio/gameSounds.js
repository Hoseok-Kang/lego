// 성 지키기 소리
// 소리 파일 없이 브라우저가 직접 장난감 같은 효과음을 만들어 냅니다 (Web Audio).
// 브라우저 규칙상 사용자가 버튼을 한 번 누른 뒤(게임 시작, 소리 버튼)부터 소리가 납니다.
// 소리를 끄거나 브라우저가 소리를 지원하지 않으면 아무 소리 없이 조용히 넘어갑니다 (오류 없음).
//
// 쓰는 법
//   const sounds = createGameSounds();
//   sounds.setEnabled(true)        소리 켜기 → 실제로 켜졌으면 true (끄기는 false)
//   sounds.isEnabled()             켜져 있는지
//   sounds.play('coin')            소리 하나 내기 → 실제로 났으면 true
//   sounds.play('coin', { delay })   delay 초 뒤에 내기
//   sounds.setVolume(0.25)         전체 소리 크기 (0 ~ 1)
//   connectGameSounds(events, sounds)   게임 소식(events.js)에 맞춰 소리 내기. 연결을 끊는 함수를 돌려줌
//
// 바꾸고 싶을 때
//   전체 크기                      → MASTER_VOLUME
//   어떤 소식에 어떤 소리를 낼지     → EVENT_SOUNDS
//   소리 하나하나의 크기·간격·모양   → SOUNDS (volume: 크기, gap: 최소 간격(밀리초), vary: 높낮이 흔들림)
//
// 소리 목록
//   land 블록 딸깍 · twang 활시위 · boom-small 대포 발사 · chime 얼음 발사 · hit 맞음 · boom 대포알 폭발
//   pop 몬스터 퐁 · coin 동전 · thud 성이 맞음 · collapse 성 무너짐 · sad 슬픈 멜로디
//   build-done 타워 완성 · upgrade 강화 · sell 팔기 · horn 웨이브 시작 나팔 · fanfare 웨이브 막음 · victory 승리 노래
//
// 미리 듣기·시험용
//   scheduleSound(name, { context, destination, at })   원하는 오디오 장소에 소리 하나 예약
//   createMasterChain(context, volume)                   전체 크기 + 찢어지는 소리 방지 장치

const MASTER_VOLUME = 0.25; // 전체 소리 크기 (0 ~ 1)
const MAX_VOICES = 24; // 동시에 울리는 소리 최대 개수 (넘으면 작은 효과음은 생략)
const START_LEAD = 0.01; // 소리를 아주 살짝 늦게 시작해 앞부분이 잘리지 않게 함 (초)
const DISABLE_FADE = 0.03; // 끌 때 소리가 줄어드는 빠르기 (초)

// ── 어떤 소식에 어떤 소리를 낼지 ──
// '소리 이름' | ['이름', ['이름', 몇 초 뒤]] | (소식 내용) => 위의 것
const FIRE_SOUNDS = { arrow: 'twang', cannonball: 'boom-small', ice: 'chime' };

const EVENT_SOUNDS = {
  blockLanded: 'land',
  castleBuilt: 'build-done',
  projectileFired: ({ kind }) => FIRE_SOUNDS[kind] ?? 'twang',
  projectileHit: ({ kind }) => (kind === 'cannonball' ? 'boom' : 'hit'),
  enemyKilled: ['pop', ['coin', 0.07]],
  castleHit: 'thud',
  castleDestroyed: ['collapse', ['sad', 0.7]],
  towerBuilt: 'build-done',
  towerUpgraded: 'upgrade',
  towerSold: 'sell',
  waveStarted: 'horn',
  waveCleared: ({ wave, total }) => (wave >= total ? 'victory' : 'fanfare'),
};

// ── 소리 하나하나 ──
// volume: 크기 · gap: 같은 소리 사이 최소 간격(밀리초) · vary: 높낮이를 매번 살짝 바꾸는 정도
// important: 소리가 많이 겹쳐도 빼먹지 않음
export const SOUNDS = {
  // 블록 딸깍 (플라스틱 블록이 끼워지는 소리)
  land: {
    volume: 0.9,
    gap: 45,
    vary: 0.12,
    make(kit) {
      noise(kit, { filter: 'bandpass', freq: 3200, q: 4, decay: 0.035, volume: 1.6 });
      tone(kit, { type: 'sine', freq: 1900, to: 1500, glide: 0.03, decay: 0.03, volume: 0.22 });
      tone(kit, { type: 'triangle', freq: 520, decay: 0.045, volume: 0.25 });
    },
  },

  // 활시위 튕기는 소리 (화살 타워)
  twang: {
    volume: 0.75,
    gap: 60,
    vary: 0.08,
    make(kit) {
      tone(kit, {
        type: 'sawtooth', freq: 420, to: 250, glide: 0.12, decay: 0.16, volume: 0.6,
        filter: { type: 'lowpass', freq: 2600, to: 700, glide: 0.14, q: 6 },
      });
      noise(kit, { at: 0.01, filter: 'highpass', freq: 3500, decay: 0.07, volume: 0.35 });
    },
  },

  // 대포 발사 '펑'
  'boom-small': {
    volume: 0.55,
    gap: 90,
    vary: 0.08,
    make(kit) {
      tone(kit, { type: 'sine', freq: 160, to: 50, glide: 0.18, decay: 0.22, volume: 1 });
      noise(kit, { filter: 'lowpass', freq: 1800, to: 300, glide: 0.2, decay: 0.2, volume: 0.9 });
      noise(kit, { filter: 'bandpass', freq: 2500, q: 1, decay: 0.03, volume: 0.6 });
    },
  },

  // 얼음 발사 '띵'
  chime: {
    volume: 0.5,
    gap: 70,
    vary: 0,
    make(kit) {
      const freq = note(pick(['D6', 'E6', 'G6', 'A6']));
      tone(kit, { type: 'sine', freq, attack: 0.002, decay: 0.5, volume: 0.6 });
      tone(kit, { type: 'sine', freq: freq * 2.76, attack: 0.002, decay: 0.18, volume: 0.22 });
      tone(kit, { type: 'triangle', at: 0.03, freq: freq * 1.5, decay: 0.3, volume: 0.15 });
    },
  },

  // 몬스터가 맞음 '톡'
  hit: {
    volume: 0.8,
    gap: 70,
    vary: 0.15,
    make(kit) {
      noise(kit, { filter: 'bandpass', freq: 1400, q: 2, decay: 0.06, volume: 1.2 });
      tone(kit, { type: 'triangle', freq: 380, to: 160, glide: 0.07, decay: 0.08, volume: 0.6 });
    },
  },

  // 대포알 폭발 '쾅' (블록이 흩어지는 딸깍 소리 포함)
  boom: {
    volume: 0.7,
    gap: 100,
    vary: 0.1,
    make(kit) {
      tone(kit, { type: 'sine', freq: 120, to: 38, glide: 0.35, decay: 0.45, volume: 1 });
      noise(kit, { filter: 'lowpass', freq: 1200, to: 150, glide: 0.4, decay: 0.45, volume: 1 });
      for (let i = 0; i < 4; i++) {
        noise(kit, { at: 0.06 + Math.random() * 0.25, filter: 'bandpass', freq: 2500 + Math.random() * 1500, q: 5, decay: 0.03, volume: 0.9 });
      }
    },
  },

  // 몬스터가 쓰러짐 '퐁' (비눗방울 터지는 소리)
  pop: {
    volume: 0.8,
    gap: 40,
    vary: 0.1,
    make(kit) {
      tone(kit, { type: 'sine', freq: 260, to: 1100, glide: 0.07, attack: 0.002, decay: 0.09, volume: 0.9 });
      noise(kit, { filter: 'bandpass', freq: 1800, q: 1.5, decay: 0.04, volume: 0.5 });
    },
  },

  // 동전 '띠링'
  coin: {
    volume: 0.5,
    gap: 60,
    vary: 0,
    make(kit) {
      const soft = { type: 'lowpass', freq: 5000, q: 0.7 };
      tone(kit, { type: 'square', freq: note('A5'), hold: 0.05, decay: 0.03, volume: 0.35, filter: soft });
      tone(kit, { type: 'square', at: 0.07, freq: note('E6'), decay: 0.32, volume: 0.35, filter: soft });
      tone(kit, { type: 'sine', at: 0.07, freq: note('E7'), decay: 0.15, volume: 0.12 });
    },
  },

  // 성이 맞음 '쿵'
  thud: {
    volume: 0.7,
    gap: 120,
    vary: 0.08,
    make(kit) {
      tone(kit, { type: 'sine', freq: 95, to: 45, glide: 0.2, decay: 0.28, volume: 1 });
      noise(kit, { filter: 'lowpass', freq: 700, decay: 0.15, volume: 1 });
      tone(kit, { type: 'triangle', freq: 210, to: 120, glide: 0.1, decay: 0.12, volume: 0.35 });
      for (let i = 0; i < 2; i++) {
        noise(kit, { at: 0.05 + Math.random() * 0.15, filter: 'bandpass', freq: 2600 + Math.random() * 1200, q: 5, decay: 0.03, volume: 0.8 });
      }
    },
  },

  // 성이 무너짐 (우르르 + 블록이 와르르 떨어지는 딸깍딸깍)
  collapse: {
    volume: 0.7,
    gap: 1000,
    vary: 0,
    important: true,
    make(kit) {
      noise(kit, { filter: 'lowpass', freq: 900, to: 120, glide: 1.6, attack: 0.03, decay: 1.8, volume: 1 });
      tone(kit, { type: 'sine', freq: 70, to: 32, glide: 1.2, decay: 1.4, volume: 0.8 });
      for (let i = 0; i < 28; i++) {
        const at = Math.pow(Math.random(), 1.6) * 1.5;
        noise(kit, { at, filter: 'bandpass', freq: 1800 + Math.random() * 2400, q: 5, decay: 0.03, volume: 1.2 * (1 - at / 1.8) });
      }
    },
  },

  // 졌을 때 슬픈 멜로디 (뿌- 뿌- 뿌- 뿌우우)
  sad: {
    volume: 0.6,
    gap: 1000,
    vary: 0,
    important: true,
    make(kit) {
      const muted = { type: 'lowpass', freq: 1100, q: 1 };
      melody(kit, [['G4', 0, 0.3], ['F#4', 0.36, 0.3], ['F4', 0.72, 0.3]], { type: 'sawtooth', volume: 0.5, filter: muted });
      melody(kit, [['E4', 1.08, 1.1]], { type: 'sawtooth', volume: 0.5, filter: muted, vibrato: 0.025 });
    },
  },

  // 타워 완성 '딸깍-띠리링'
  'build-done': {
    volume: 0.45,
    gap: 150,
    vary: 0,
    important: true,
    make(kit) {
      noise(kit, { filter: 'bandpass', freq: 3000, q: 4, decay: 0.035, volume: 1.2 });
      melody(kit, [['C6', 0.04, 0.08], ['E6', 0.1, 0.08], ['G6', 0.16, 0.3]], { volume: 0.5 });
      tone(kit, { type: 'sine', at: 0.16, freq: note('C7'), decay: 0.3, volume: 0.12 });
    },
  },

  // 강화 '뾰로롱' (올라가는 반짝임)
  upgrade: {
    volume: 0.65,
    gap: 200,
    vary: 0,
    important: true,
    make(kit) {
      const steps = ['G5', 'C6', 'E6', 'G6', 'C7'];
      steps.forEach((name, i) => {
        const last = i === steps.length - 1;
        tone(kit, { type: 'triangle', at: i * 0.055, freq: note(name), decay: last ? 0.5 : 0.22, volume: 0.5 });
        tone(kit, { type: 'sine', at: i * 0.055, freq: note(name) * 2, decay: 0.15, volume: 0.12 });
      });
      noise(kit, { filter: 'highpass', freq: 2000, to: 6000, glide: 0.3, attack: 0.15, decay: 0.2, volume: 0.15 });
    },
  },

  // 팔기 '뿅- 짤랑'
  sell: {
    volume: 0.9,
    gap: 150,
    vary: 0,
    important: true,
    make(kit) {
      tone(kit, { type: 'sine', freq: 900, to: 300, glide: 0.12, decay: 0.12, volume: 0.6 });
      noise(kit, { at: 0.08, filter: 'bandpass', freq: 3500, q: 3, decay: 0.04, volume: 1 });
      const bright = { type: 'lowpass', freq: 6000, q: 0.7 };
      tone(kit, { type: 'square', at: 0.1, freq: note('E6'), decay: 0.3, volume: 0.25, filter: bright });
      tone(kit, { type: 'square', at: 0.16, freq: note('A6'), decay: 0.4, volume: 0.25, filter: bright });
    },
  },

  // 웨이브 시작 나팔 '빰- 빰- 빠밤'
  horn: {
    volume: 0.58,
    gap: 1000,
    vary: 0,
    important: true,
    make(kit) {
      brass(kit, note('G3'), 0, 0.16, 0.5);
      brass(kit, note('G3'), 0.2, 0.16, 0.5);
      brass(kit, note('C4'), 0.4, 0.75, 0.55);
      tone(kit, { type: 'sine', at: 0.4, freq: 110, to: 50, glide: 0.15, decay: 0.25, volume: 0.6 });
    },
  },

  // 웨이브를 막았을 때 '빠바바밤'
  fanfare: {
    volume: 0.45,
    gap: 1000,
    vary: 0,
    important: true,
    make(kit) {
      melody(kit, [['C5', 0, 0.08], ['E5', 0.09, 0.08], ['G5', 0.18, 0.1], ['C6', 0.3, 0.5]], { volume: 0.5 });
      melody(kit, [['G5', 0.3, 0.5], ['C4', 0.3, 0.5]], { volume: 0.25 });
      melody(kit, [['C6', 0.3, 0.45]], { type: 'square', volume: 0.08, filter: { type: 'lowpass', freq: 3000, q: 0.7 } });
    },
  },

  // 모든 웨이브를 막았을 때 승리 노래 (약 3초)
  victory: {
    volume: 0.47,
    gap: 2000,
    vary: 0,
    important: true,
    make(kit) {
      const lead = [
        ['G4', 0, 0.12], ['C5', 0.13, 0.12], ['E5', 0.26, 0.12], ['G5', 0.39, 0.36],
        ['E5', 0.78, 0.12], ['G5', 0.91, 0.4],
        ['A5', 1.34, 0.12], ['G5', 1.47, 0.12], ['F5', 1.6, 0.12], ['E5', 1.73, 0.12], ['D5', 1.86, 0.12],
        ['C6', 2.0, 0.9],
      ];
      melody(kit, lead, { volume: 0.45 });
      melody(kit, lead, { type: 'square', volume: 0.06, filter: { type: 'lowpass', freq: 3000, q: 0.7 } });
      melody(kit, [['E5', 2.0, 0.9], ['G5', 2.0, 0.9]], { volume: 0.2 });
      melody(kit, [['C3', 0, 0.7], ['C3', 0.78, 0.5], ['F3', 1.34, 0.24], ['G3', 1.6, 0.36], ['C3', 2.0, 0.9]], { volume: 0.45 });
      for (const at of [0, 0.78, 2.0]) tone(kit, { type: 'sine', at, freq: 120, to: 50, glide: 0.12, decay: 0.2, volume: 0.6 });
      for (const at of [0.39, 0.91, 1.6]) noise(kit, { at, filter: 'bandpass', freq: 1800, q: 0.8, decay: 0.09, volume: 0.5 });
    },
  },
};

// ── 소리 장치 만들기 ──
export function createGameSounds({ volume = MASTER_VOLUME } = {}) {
  let ctx = null; // 처음 켤 때 만듦 (사용자가 버튼을 누른 순간)
  let master = null;
  let noiseBuffer = null;
  let enabled = false;
  let activeVoices = 0;
  let suspendTimer = null;
  const lastPlayed = new Map(); // 소리 이름 → 마지막으로 낸 시각 (밀리초)

  function ensureAudio() {
    if (ctx && ctx.state !== 'closed') return true;
    try {
      const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AudioContextClass) return false;
      ctx = new AudioContextClass();
      noiseBuffer = createNoiseBuffer(ctx);
      master = createMasterChain(ctx, volume);
      listenForUnlock();
      return true;
    } catch {
      ctx = null;
      return false;
    }
  }

  // 휴대폰은 화면을 눌러야 소리가 다시 나는 경우가 있어서, 누를 때마다 깨워 줌
  function listenForUnlock() {
    const wake = () => {
      if (enabled) resume();
    };
    for (const type of ['pointerdown', 'touchend', 'keydown']) {
      globalThis.addEventListener?.(type, wake, { capture: true, passive: true });
    }
    globalThis.document?.addEventListener?.('visibilitychange', () => {
      if (!globalThis.document.hidden) wake();
    });
  }

  function resume() {
    if (!ctx || ctx.state === 'running' || ctx.state === 'closed') return;
    safely(() => ctx.resume()?.catch?.(() => {}));
  }

  // 옛날 아이폰은 누른 순간에 소리를 하나 내야 열려서, 들리지 않는 아주 짧은 소리를 냄
  function unlockWithSilence() {
    safely(() => {
      const source = ctx.createBufferSource();
      source.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      source.connect(ctx.destination);
      source.start(0);
    });
  }

  function fadeMasterTo(value) {
    safely(() => {
      const now = ctx.currentTime;
      master.gain.cancelScheduledValues(now);
      master.gain.setTargetAtTime(value, now, DISABLE_FADE);
    });
  }

  function setEnabled(on) {
    if (!on) {
      enabled = false;
      if (ctx) {
        fadeMasterTo(0);
        clearTimeout(suspendTimer);
        suspendTimer = setTimeout(() => {
          if (!enabled) safely(() => ctx.suspend()?.catch?.(() => {}));
        }, 300);
      }
      return false;
    }
    if (!ensureAudio()) {
      enabled = false;
      return false;
    }
    enabled = true;
    clearTimeout(suspendTimer);
    resume();
    unlockWithSilence();
    fadeMasterTo(volume);
    return true;
  }

  function play(name, { delay = 0 } = {}) {
    if (!enabled || !ctx) return false;
    const sound = SOUNDS[name];
    if (!sound) return false;
    if (ctx.state !== 'running') {
      resume(); // 깨어나기 전 소리는 건너뜀 (나중에 한꺼번에 몰려 나오지 않게)
      return false;
    }
    const now = nowMs();
    if (now - (lastPlayed.get(name) ?? -Infinity) < sound.gap) return false;
    if (!sound.important && activeVoices >= MAX_VOICES) return false;
    lastPlayed.set(name, now);
    activeVoices += 1;
    try {
      scheduleSound(name, {
        context: ctx,
        destination: master,
        noise: noiseBuffer,
        at: ctx.currentTime + START_LEAD + Math.max(0, delay),
        onEnded: () => {
          activeVoices = Math.max(0, activeVoices - 1);
        },
      });
      return true;
    } catch {
      activeVoices = Math.max(0, activeVoices - 1);
      return false;
    }
  }

  function setVolume(value) {
    volume = Math.min(1, Math.max(0, value));
    if (ctx && enabled) fadeMasterTo(volume);
  }

  return {
    setEnabled,
    isEnabled: () => enabled,
    play,
    setVolume,
    get volume() {
      return volume;
    },
  };
}

// ── 게임 소식에 소리 연결 ──
export function connectGameSounds(events, sounds) {
  const unsubscribers = Object.entries(EVENT_SOUNDS).map(([eventName, rule]) =>
    events.on(eventName, (payload = {}) => {
      // 소리 때문에 게임이 멈추면 안 되니 어떤 오류도 밖으로 내보내지 않음
      safely(() => {
        for (const [name, delay] of soundsFor(rule, payload)) sounds.play(name, delay ? { delay } : undefined);
      });
    }),
  );
  return () => unsubscribers.forEach((off) => off?.());
}

// 규칙('이름' | 목록 | 함수) → [[이름, 지연 초], ...]
function soundsFor(rule, payload) {
  const value = typeof rule === 'function' ? rule(payload) : rule;
  if (!value) return [];
  const list = Array.isArray(value) ? value : [value];
  return list.map((item) => (Array.isArray(item) ? [item[0], item[1] ?? 0] : [item, 0]));
}

// ── 소리 하나 예약 (게임 안에서도, 미리 듣기·시험에서도 씀) ──
export function scheduleSound(name, { context, destination = context.destination, noise: noiseSource = null, at = context.currentTime, onEnded = null }) {
  const sound = SOUNDS[name];
  if (!sound) return false;
  const voice = context.createGain();
  voice.gain.value = sound.volume;
  voice.connect(destination);
  const kit = {
    ctx: context,
    out: voice,
    noise: noiseSource ?? createNoiseBuffer(context),
    t: at,
    pitch: 1 + (Math.random() * 2 - 1) * (sound.vary ?? 0),
    end: 0,
    last: null, // 가장 늦게 끝나는 소리 (끝나면 정리)
  };
  sound.make(kit);
  const finish = () => {
    safely(() => voice.disconnect());
    onEnded?.();
  };
  if (kit.last) kit.last.onended = finish;
  else finish();
  return true;
}

// 전체 크기 → 찢어지는 소리 방지(리미터) → 스피커
export function createMasterChain(context, volume = MASTER_VOLUME) {
  const master = context.createGain();
  master.gain.value = volume;
  const limiter = context.createDynamicsCompressor();
  limiter.threshold.value = -6;
  limiter.knee.value = 6;
  limiter.ratio.value = 12;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.25;
  master.connect(limiter).connect(context.destination);
  return master;
}

// ── 소리 재료 ──

// 음 하나: 오실레이터 + (필터) + 크기 변화. freq → to 로 glide 초 동안 미끄러짐
function tone(kit, { type = 'triangle', freq, to = null, glide = 0.1, at = 0, attack = 0.005, hold = 0, decay = 0.2, volume = 1, vibrato = 0, filter = null }) {
  const { ctx } = kit;
  const t = kit.t + at;
  const end = t + attack + hold + decay + 0.02;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq * kit.pitch, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to * kit.pitch, t + glide);
  if (vibrato) {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 5.5;
    const depth = ctx.createGain();
    depth.gain.setValueAtTime(0, t);
    depth.gain.linearRampToValueAtTime(freq * vibrato, t + attack + hold * 0.5 + 0.05);
    lfo.connect(depth).connect(osc.frequency);
    lfo.start(t);
    lfo.stop(end);
  }
  const amp = ctx.createGain();
  envelope(amp.gain, t, attack, hold, decay, volume);
  connectThroughFilter(kit, osc, amp, filter, t);
  amp.connect(kit.out);
  osc.start(t);
  osc.stop(end);
  track(kit, osc, end);
}

// 쉬익 하는 잡음 + 필터 (딸깍, 펑, 우르르 소리의 재료)
function noise(kit, { at = 0, attack = 0.002, hold = 0, decay = 0.1, volume = 1, filter = 'bandpass', freq = 2000, to = null, glide = 0.1, q = 1 }) {
  const { ctx } = kit;
  const t = kit.t + at;
  const end = t + attack + hold + decay + 0.02;
  const source = ctx.createBufferSource();
  source.buffer = kit.noise;
  source.loop = true;
  const amp = ctx.createGain();
  envelope(amp.gain, t, attack, hold, decay, volume);
  connectThroughFilter(kit, source, amp, { type: filter, freq, to, glide, q }, t);
  amp.connect(kit.out);
  source.start(t, Math.random() * (kit.noise.duration * 0.5));
  source.stop(end);
  track(kit, source, end);
}

// 멜로디: [['C5', 시작 초, 길이 초], ...]
function melody(kit, notes, { type = 'triangle', volume = 0.5, filter = null, vibrato = 0 } = {}) {
  for (const [name, at, length] of notes) {
    tone(kit, { type, freq: note(name), at, attack: 0.01, hold: length * 0.7, decay: length * 0.5 + 0.05, volume, filter, vibrato });
  }
}

// 나팔 소리: 살짝 어긋난 톱니파 두 개 + 열리는 필터
function brass(kit, freq, at, length, volume) {
  for (const detune of [0.997, 1.003]) {
    tone(kit, {
      type: 'sawtooth', freq: freq * detune, at, attack: 0.03, hold: length * 0.75, decay: length * 0.35 + 0.05,
      volume: volume * 0.5, vibrato: length > 0.5 ? 0.012 : 0,
      filter: { type: 'lowpass', freq: 350, to: freq * 7, glide: 0.07, q: 1.5 },
    });
  }
}

function connectThroughFilter(kit, source, target, filter, t) {
  if (!filter || !filter.type) {
    source.connect(target);
    return;
  }
  const node = kit.ctx.createBiquadFilter();
  node.type = filter.type;
  node.Q.value = filter.q ?? 1;
  node.frequency.setValueAtTime(clampFrequency(filter.freq * kit.pitch, kit.ctx), t);
  if (filter.to) node.frequency.exponentialRampToValueAtTime(clampFrequency(filter.to * kit.pitch, kit.ctx), t + (filter.glide ?? 0.1));
  source.connect(node).connect(target);
}

// 소리 크기 변화: 0 → (attack 초) → volume → (hold 초 유지) → (decay 초 동안 사라짐)
function envelope(param, t, attack, hold, decay, volume) {
  param.setValueAtTime(0, t);
  param.linearRampToValueAtTime(volume, t + attack);
  if (hold > 0) param.setValueAtTime(volume, t + attack + hold);
  param.exponentialRampToValueAtTime(0.0001, t + attack + hold + decay);
}

function track(kit, node, end) {
  if (end >= kit.end) {
    kit.end = end;
    kit.last = node;
  }
}

function createNoiseBuffer(context) {
  const length = Math.floor(context.sampleRate * 1);
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

// 'C5', 'F#4', 'Bb3' 같은 음 이름 → 주파수(Hz)
const NOTE_STEPS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
function note(name) {
  const match = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!match) return 440;
  const accidental = match[2] === '#' ? 1 : match[2] === 'b' ? -1 : 0;
  const midi = 12 * (Number(match[3]) + 1) + NOTE_STEPS[match[1]] + accidental;
  return 440 * 2 ** ((midi - 69) / 12);
}

function clampFrequency(value, context) {
  return Math.min(context.sampleRate / 2 - 100, Math.max(20, value));
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function nowMs() {
  return globalThis.performance?.now?.() ?? Date.now();
}

function safely(action) {
  try {
    return action();
  } catch {
    return undefined;
  }
}
