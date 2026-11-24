// 마을 사람 외치기 감독 (누가 언제 무슨 말을 외칠지, 말풍선이 너무 많아지지 않게)
// 말풍선 하나 = { text, kind, age, life, anchor: { x, y, z }, priority, done } — 게임 시간(update 의 dt)으로만 나이를 먹어서,
// ?capture 로 한 장면씩 넘겨도 똑같이 나옵니다. 화면에 그리는 일은 villagerShouts.js (말풍선 상자) 가 맡습니다.
//
//   const talk = createVillagerTalk({ events, rules, rnd, townId, headHeight })
//       rules: villainConfig.js 의 villagers.shout,  rnd: 정해진 순서의 주사위 (0 ~ 1),  headHeight: 머리 꼭대기 높이
//   talk.say(사람, 상황, { priority })  → 외쳤으면 true. 상황: data/villagerLines.js 의 이름 (panic, burst, home …)
//       priority 0 = 보통 (자리 없으면 안 외침), 1 이상 = 중요 (자리가 꽉 차면 덜 중요한 오래된 말풍선을 빨리 지움)
//   talk.later(몇 초 뒤, 사람, 상황, { priority })   잠깐 뒤에 외치기 (만세·울음을 차례로)
//   talk.hush(초)       그동안 보통 말은 안 외침 (건물이 와르르 무너지는 큰 장면에서 말이 쏟아지지 않게)
//   talk.setContext({ town, heroKind, heroName })   그 판 마을·영웅 (raidStarted 소식에서)
//   talk.tick(dt) ; talk.clear() ; talk.bubbles (지금 떠 있는 말풍선 목록)
//
// 보내는 소식: villagerShout { bubble, text, kind, position, voice, kid }   (말풍선 상자와 소리가 들음)
// 말풍선 수·간격 숫자는 villainConfig.js 의 villagers.shout, 외치는 말은 data/villagerLines.js 에서 바꿉니다.

import { VILLAGER_LINES, LOCAL_SHARE } from '../data/villagerLines.js';

const DEFAULT_RULES = { maxOnScreen: 3, seconds: 1.7, cooldown: 4, gap: 0.35, hush: 0.6 };
const LONG_KINDS = { hero: 1.25, saved: 1.3, wail: 1.45, home: 1.2 }; // 이 상황 말풍선은 조금 더 오래 (배)
const ABOVE_HEAD = 0.5; // 말풍선 꼬리 끝이 머리 위로 이만큼 (칸)
const QUICK_FADE = 0.18; // 자리를 비켜 주는 말풍선이 사라지는 시간 (초)
const RETRIES = 6; // later() 로 미룬 말이 자리가 없으면 다시 해 보는 횟수
const RETRY_GAP = 0.2; // 다시 해 보는 간격 (초)

// 상황 → 말 하나 고르기 ({hero} 는 영웅 이름으로)
export function pickLine(kind, { town = null, heroKind = null, heroName = '' } = {}, rnd = Math.random) {
  const group = VILLAGER_LINES[kind];
  if (!group) return '';
  const local = [...(group[town] || []), ...(group[heroKind] || [])];
  const common = group.all || [];
  const list = local.length && (rnd() < LOCAL_SHARE || !common.length) ? local : common;
  if (!list.length) return '';
  const line = list[Math.min(list.length - 1, Math.floor(rnd() * list.length))];
  return String(line).replace(/\{hero\}/g, heroName || '영웅');
}

export function createVillagerTalk({ events = null, rules = {}, rnd = Math.random, townId = null, headHeight = 2 } = {}) {
  const r = { ...DEFAULT_RULES, ...rules };
  const bubbles = [];
  const queue = []; // { at, v, kind, priority }
  const context = { town: townId, heroKind: null, heroName: '' };
  let clock = 0;
  let lastAt = -Infinity;
  let hushUntil = 0;
  let lastText = '';

  function anchorOf(v, target) {
    target.x = v.x;
    target.y = (v.y || 0) + headHeight * (v.scale ?? 1) + ABOVE_HEAD;
    target.z = v.z;
    return target;
  }

  function say(v, kind, { priority = 0 } = {}) {
    if (!v || v.hidden) return false;
    if (priority < 1) {
      if (clock < hushUntil || clock - lastAt < r.gap || clock < (v.talkAt ?? 0)) return false;
    } else if (clock < (v.talkAt ?? 0) - r.cooldown + 0.8) return false; // 중요한 말도 같은 사람이 연달아 외치지는 않게
    const live = bubbles.filter((b) => !b.leaving);
    if (live.length >= r.maxOnScreen) {
      if (priority < 1) return false;
      // 덜 중요한 말풍선 중 가장 오래된 것을 빨리 지워 자리를 냄
      let victim = null;
      for (const b of live) if (b.priority < priority && (!victim || b.age > victim.age)) victim = b;
      if (!victim) return false;
      victim.leaving = true;
      victim.life = Math.min(victim.life, victim.age + QUICK_FADE);
    }
    // 바로 앞이나 지금 떠 있는 말과 같으면 몇 번 더 고름 (같은 말풍선이 나란히 뜨지 않게)
    let text = pickLine(kind, context, rnd);
    for (let k = 0; k < 3 && (text === lastText || bubbles.some((b) => b.text === text)); k++) text = pickLine(kind, context, rnd);
    if (!text) return false;
    lastText = text;
    const bubble = { text, kind, age: 0, life: r.seconds * (LONG_KINDS[kind] ?? 1), anchor: anchorOf(v, { x: 0, y: 0, z: 0 }), priority, done: false, leaving: false, villager: v };
    bubbles.push(bubble);
    v.talkAt = clock + r.cooldown;
    lastAt = clock;
    events?.emit('villagerShout', { bubble, text, kind, position: bubble.anchor, voice: v.voice, kid: !!v.kid });
    return true;
  }

  function tick(dt) {
    clock += dt;
    for (let i = queue.length - 1; i >= 0; i--) {
      const q = queue[i];
      if (q.at > clock) continue;
      queue.splice(i, 1);
      // 자리가 없어 못 외쳤으면 잠깐 뒤 다시 (몇 번까지만)
      if (!say(q.v, q.kind, { priority: q.priority }) && (q.tries = (q.tries || 0) + 1) < RETRIES) queue.push({ ...q, at: clock + RETRY_GAP });
    }
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      b.age += dt;
      // 사람이 보이는 동안은 머리 위를 따라감 (건물 안으로 숨으면 그 자리에 남음)
      if (b.villager && !b.villager.hidden) anchorOf(b.villager, b.anchor);
      if (b.age >= b.life) {
        b.done = true;
        b.villager = null;
        bubbles.splice(i, 1);
      }
    }
  }

  function clear() {
    for (const b of bubbles) {
      b.done = true;
      b.villager = null;
    }
    bubbles.length = 0;
    queue.length = 0;
    clock = 0;
    lastAt = -Infinity;
    hushUntil = 0;
    lastText = '';
  }

  return {
    say,
    tick,
    clear,
    later(delay, v, kind, { priority = 1 } = {}) {
      queue.push({ at: clock + Math.max(0, delay), v, kind, priority });
    },
    hush(seconds = r.hush) {
      hushUntil = Math.max(hushUntil, clock + seconds);
    },
    setContext({ town, heroKind, heroName } = {}) {
      if (town) context.town = town;
      if (heroKind) context.heroKind = heroKind;
      if (heroName) context.heroName = heroName;
    },
    get context() {
      return context;
    },
    get bubbles() {
      return bubbles;
    },
  };
}
