// 펑펑 토끼 소리
// 소리 파일 없이 브라우저가 직접 장난감 같은 효과음을 만들어 냅니다 (Web Audio).
// 브라우저 규칙상 사용자가 버튼을 한 번 누른 뒤(시작 단추, 소리 단추)부터 소리가 납니다.
// 소리를 끄거나 브라우저가 소리를 지원하지 않으면 아무 소리 없이 조용히 넘어갑니다 (오류 없음).
//
//   const sounds = createFightSounds()
//   sounds.setEnabled(true) → 실제로 켜졌으면 true (끄기는 false)   ※ 시작 단추를 누른 순간에 켜 주세요
//   sounds.isEnabled()
//   sounds.play('bigPop', { delay })  소리 하나 → 실제로 났으면 true (delay 초 뒤에)
//   sounds.setVolume(0.3)             전체 크기 (0 ~ 1)
//   connectFightSounds(events, sounds) → 연결 끊는 함수     게임 소식(shot, hit, rabbitPopped …)에 맞춰 소리 내기
//
// 바꾸고 싶을 때
//   전체 크기                      → MASTER_VOLUME
//   어떤 소식에 어떤 소리를 낼지     → EVENT_SOUNDS (아래)
//   소리 하나하나의 모양·크기        → fightSoundBank.js
//
// 미리 듣기·시험용
//   scheduleSound(이름, { context, destination, at })   원하는 오디오 장소(OfflineAudioContext 등)에 소리 하나 예약
//   SOUND_NAMES                                         소리 이름 목록

import { FIGHT_SOUNDS } from './fightSoundBank.js';
import { createNoiseBuffer, createMasterChain } from './synthKit.js';

const MASTER_VOLUME = 0.5; // 전체 소리 크기 (0 ~ 1)
const MAX_VOICES = 28; // 동시에 울리는 소리 최대 개수 (넘으면 작은 효과음은 생략)
const START_LEAD = 0.01; // 소리를 아주 살짝 늦게 시작해 앞부분이 잘리지 않게 (초)
const DISABLE_FADE = 0.03; // 끌 때 소리가 줄어드는 빠르기 (초)

export const SOUND_NAMES = Object.keys(FIGHT_SOUNDS);

// ── 어떤 소식에 어떤 소리를 낼지 ──
// '소리 이름' | ['이름', ['이름', 몇 초 뒤]] | (소식 내용) => 위의 것
const EVENT_SOUNDS = {
  shot: ({ team }) => (team === 'enemy' ? 'enemyPew' : 'pew'),
  swing: 'swish',
  hit: ({ team }) => (team === 'player' ? ['thock', 'ouch'] : 'thock'), // team = 맞은 쪽
  earPop: ({ count = 1 }) => (count >= 3 ? ['pop', ['pop', 0.05], ['pop', 0.1]] : count === 2 ? ['pop', ['pop', 0.06]] : 'pop'),
  rabbitPopped: 'bigPop',
  bulletBlocked: ({ surface }) => (surface === 'deflect' ? 'clink' : surface === 'crate' ? null : 'tick'), // 상자는 crateHit 이 냄
  reloadStart: 'reload',
  reloadDone: 'ready',
  dryFire: 'dry',
  roll: 'roll',
  weaponSwitched: ({ weapon }) => (weapon === 'sword' ? 'clink' : 'ready'),
  enemyAlert: 'alert',
  enemyWindup: 'windup',
  slam: 'slam',
  crateHit: 'crate',
  crateBroken: 'crateBreak',
  carrotSpawned: 'pop',
  carrotEaten: 'munch',
  gameStarted: 'start',
  gameWon: [['win', 0.35]], // 마지막 '펑!' 을 먼저 듣고
  gameLost: [['lose', 0.8]],
};

export function createFightSounds({ volume = MASTER_VOLUME } = {}) {
  let ctx = null; // 처음 켤 때 만듦 (사용자가 버튼을 누른 순간)
  let master = null;
  let noiseBuffer = null;
  let enabled = false;
  let activeVoices = 0;
  let suspendTimer = null;
  let listening = false;
  const lastPlayed = new Map(); // 소리 이름 → 마지막으로 울릴 시각 (밀리초)

  function ensureAudio() {
    if (ctx && ctx.state !== 'closed') return true;
    try {
      const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AudioContextClass) return false;
      ctx = new AudioContextClass({ latencyHint: 'interactive' });
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
    if (listening) return;
    listening = true;
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
    const sound = FIGHT_SOUNDS[name];
    if (!sound) return false;
    if (ctx.state !== 'running') {
      resume(); // 깨어나기 전 소리는 건너뜀 (나중에 한꺼번에 몰려 나오지 않게)
      return false;
    }
    const wait = Math.max(0, delay);
    const when = nowMs() + wait * 1000; // 같은 소리끼리 '울리는 시각'으로 간격을 잼 (톡-톡-톡 예약도 되게)
    if (Math.abs(when - (lastPlayed.get(name) ?? -Infinity)) < sound.gap) return false;
    if (!sound.important && activeVoices >= MAX_VOICES) return false;
    lastPlayed.set(name, when);
    activeVoices += 1;
    try {
      scheduleSound(name, {
        context: ctx,
        destination: master,
        noise: noiseBuffer,
        at: ctx.currentTime + START_LEAD + wait,
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
export function connectFightSounds(events, sounds) {
  const unsubscribers = Object.entries(EVENT_SOUNDS).map(([eventName, rule]) =>
    events.on(eventName, (payload = {}) => {
      // 소리 때문에 게임이 멈추면 안 되니 어떤 오류도 밖으로 내보내지 않음
      safely(() => {
        for (const [name, delay] of soundsFor(rule, payload ?? {})) sounds.play(name, delay ? { delay } : undefined);
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
  const sound = FIGHT_SOUNDS[name];
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

export { createMasterChain };

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
