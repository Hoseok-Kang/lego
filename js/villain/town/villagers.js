// 꼬마 마을 사람들 (블록 사람 — 괴수가 오면 '으악!' 하며 도망치고, 넘어지고, 건물로 숨고, 영웅이 오면 응원)
// 구경거리일 뿐이라 사람은 절대 다치지 않아요: 맞지도 부딪히지도 않고, 건물이 무너지면 안에 있던 사람은 밖으로 튀어나옵니다.
// 전부 한 묶음으로 그려서 가볍습니다. 몸 그리기 = villagerBody.js, 한 사람의 움직임 = villagerBrain.js,
// 말풍선 고르기 = villagerTalk.js (화면에 띄우기는 villagerShouts.js), 외치는 말 = data/villagerLines.js
//
//   const villagers = createVillagers(scene, { count, bounds, buildings, style?, street?, walkable?, events?, townId?, road? })
//       count: 밖에 나와 있는 사람 수 (배치도의 villagers), 건물 안에도 몇 명씩 숨어 있음 (villainConfig.js 의 villagers.inside*)
//       style: 옷 모음 ('village' 마을 사람 | 'harbor' 뱃사람 | 'castle' 병사·귀족), street: [z0, z1] 평소 서성이는 줄
//       walkable(x, z) → false 면 그 자리로는 안 감 (예: 바다),  events: 게임 소식 (아래),  road: 큰길 가운데 z (건물 문 방향)
//   villagers.update(dt, threat)     threat: 괴수 위치 { x, z } 또는 null
//   villagers.reset() ; villagers.dispose() ; villagers.list ([{ x, z, panic, state, hidden }])
//   villagers.talk  말풍선 감독 (villagerTalk.js) ; villagers.debugStats() → { 상태별 사람 수, bubbles }
//
// 듣는 소식: raidStarted (마을·영웅 이름), blocksBroken (건물이 세게 맞으면 안에서 1~3명 튀어나옴),
//            buildingDestroyed ('내 집!!', 안에 남은 사람 모두 탈출), heroArrived (영웅 근처 응원), heroPopped,
//            monsterPopped (모두 만세!), raidEnded (괴수가 이기면 가장자리에서 으앙~)
// 보내는 소식: villagerShout (villagerTalk.js 참고)
// 크기·빠르기·확률 숫자는 villainConfig.js 의 villagers, 옷 색은 아래 STYLES 에서 바꿉니다.

import { VILLAIN } from '../villainConfig.js';
import { createVillagerBodies } from './villagerBody.js';
import { createVillagerTalk } from './villagerTalk.js';
import { stepVillager } from './villagerBrain.js';
import { startBurst, startWail, startParty } from './villagerStunts.js';

const SKIN = '#F6D7B3';
const STYLES = {
  // 뱃사람: 줄무늬 셔츠 느낌 (흰·파랑), 노란 비옷
  harbor: [
    ['#0A3463', '#F4F4F4', '#0055BF'],
    ['#582A12', '#F2CD37', '#F2CD37'],
    ['#0055BF', '#C91A09', '#1B2A34'],
    ['#6C6E68', '#36AEBF', '#F4F4F4'],
    ['#0A3463', '#FE8A18', '#582A12'],
  ],
  // 병사(은 투구)·귀족(보라·금)
  castle: [
    ['#6C6E68', '#C91A09', '#A0A5A9'],
    ['#6C6E68', '#0055BF', '#A0A5A9'],
    ['#3F3691', '#AC78BA', '#F2CD37'],
    ['#1B2A34', '#F2CD37', '#582A12'],
    ['#6C6E68', '#C91A09', '#A0A5A9'],
    ['#923978', '#E4ADC8', '#F2CD37'],
  ],
};
const OUTFITS = [
  ['#0055BF', '#C91A09', '#582A12'], // 바지, 윗옷, 머리
  ['#582A12', '#F2CD37', '#1B2A34'],
  ['#6C6E68', '#4B9F4A', '#FE8A18'],
  ['#0A3463', '#E4ADC8', '#F2CD37'],
  ['#1B2A34', '#36AEBF', '#A95500'],
  ['#923978', '#F4F4F4', '#582A12'],
  ['#237841', '#FE8A18', '#1B2A34'],
];
const VOICES = ['high', 'low']; // 어른 목소리 (꼬마는 'kid')
const NO_DOOR = new Set(['wallX', 'wallZ', 'statue', 'fountain', 'well', 'fishingBoat', 'sailboat']); // 문이 없어 숨을 수 없는 것
const ALARM_KINDS = new Set(['panic', 'burst', 'home']); // 이 말을 들으면 옆 사람도 놀람
const BIG_HIT = 28; // 이 피해 이상 맞으면 잠깐 조용 (raidFeedback 의 '센 타격' 과 같음)
const DEFAULTS = {
  size: 0.95, kidChance: 0.3, kidSize: 0.75, walkSpeed: 1.6, runSpeed: 9, scareDistance: 22, calmSeconds: 2.5, zigzag: 0.75,
  tripPerSecond: 0.1, tripSeconds: 1, hidePerSecond: 0.07, hideSearch: 18, hideSeconds: 5, edgePerSecond: 0.05,
  insidePerBuilding: 2, insideTotal: 14, burst: [1, 3], burstBlocks: 3, cheerDistance: 14, braveDistance: 8, alarmDistance: 14,
  shout: { maxOnScreen: 3, seconds: 1.7, cooldown: 4, gap: 0.35, perSecond: 0.8, hush: 0.6 },
};

// 정해진 순서의 주사위 (같은 마을이면 매번 같은 순서 → 다시 찍어도 똑같음)
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const seedOf = (text) => [...String(text)].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0, 2166136261);

export function createVillagers(scene, { count = 6, bounds, buildings = [], style = 'village', street = [1, 8], walkable = null, events = null, townId = null, road = null } = {}) {
  const cfg = { ...DEFAULTS, ...(VILLAIN.villagers || {}) };
  const rules = { ...cfg, shoutPerSecond: cfg.shout?.perSecond ?? DEFAULTS.shout.perSecond };
  const outfits = STYLES[style] || OUTFITS;
  const roadZ = road ?? (street[0] + street[1]) / 2;
  const seed = seedOf(townId || style);
  let rnd = seeded(seed);

  // 건물 문 앞 자리 (큰길 쪽 벽 가운데). 문이 없거나 물 위면 null
  const doors = new Map();
  for (const b of buildings) {
    if (NO_DOOR.has(b.kind)) continue;
    const side = Math.sign(roadZ - b.position.z) || 1;
    const door = { x: b.position.x, z: b.position.z + side * b.radius * 0.9 };
    if (!walkable || walkable(door.x, door.z)) doors.set(b, door);
  }
  const doorOf = (b) => doors.get(b) || null;

  // 건물 안에 숨어 있는 사람 (큰 건물은 더 많이)
  const shelters = [];
  for (const b of doors.keys()) {
    const n = Math.min(cfg.insidePerBuilding, b.radius > 3.4 ? cfg.insidePerBuilding : 1);
    for (let k = 0; k < n && shelters.length < cfg.insideTotal; k++) shelters.push(b);
  }
  const total = count + shelters.length;
  const bodies = createVillagerBodies(scene, total, { size: cfg.size });
  const talk = createVillagerTalk({ events, rules: cfg.shout, rnd: () => rnd(), townId, headHeight: bodies.headHeight });

  // 사람마다 정해지는 것 (옷·꼬마·목소리)은 처음 한 번 (주사위는 마을 이름으로 정해짐)
  const look = seeded(seed ^ 0x9e3779b9);
  const list = [];
  for (let i = 0; i < total; i++) {
    const outfit = outfits[i % outfits.length];
    bodies.paint(i, [outfit[0], outfit[1], SKIN, outfit[2]]);
    const kid = look() < cfg.kidChance;
    list.push({
      index: i,
      kid,
      voice: kid ? 'kid' : VOICES[Math.floor(look() * VOICES.length)],
      bodyScale: kid ? cfg.kidSize : 1,
      speedMul: (kid ? 0.85 : 1) * (0.85 + look() * 0.3),
      windmill: look() < 0.3,
      zigRate: 2.4 + look() * 2,
      seed: look() * 6.28,
      shelterStart: i >= count ? shelters[i - count] : null,
    });
  }

  let hero = null; // 마을에 내려온 영웅 (응원할 상대)
  let clock = 0;
  let mood = 'normal'; // 'normal' | 'saved' (괴수가 터짐) | 'lost' (괴수가 이김)
  const shaken = new Map(); // 건물 → { broken, coolUntil }

  function reset() {
    rnd = seeded(seed);
    hero = null;
    clock = 0;
    mood = 'normal';
    shaken.clear();
    talk.clear();
    list.forEach((v, i) => {
      const inside = !!v.shelterStart;
      // 평소 서성이는 자리: 큰길 위 (street 줄) 에 고르게
      const x = bounds.minX + 8 + ((bounds.maxX - bounds.minX - 16) * (i + 0.5)) / Math.max(1, count);
      const z = street[0] + 1 + (((i * 37) % 50) / 50) * Math.max(0.5, street[1] - street[0] - 2);
      const door = inside ? doorOf(v.shelterStart) : null;
      const a = i * 2.4;
      Object.assign(v, {
        x: door ? door.x : x, z: door ? door.z : z, dirX: Math.cos(a), dirZ: Math.sin(a), yaw: 0, phase: v.seed, clock: 0,
        turn: 1 + (i % 3), pause: 0, panic: 0, timer: 0, safeUntil: 0, jumpWait: 0,
        state: inside ? 'inside' : 'idle', hidden: inside, shelter: v.shelterStart, home: v.shelterStart || nearestHome(x, z),
        target: null, appear: 1, lift: 0, hop: 0, vy: 0, vx: 0, vz: 0, spin: 0, partyAfter: false, talkAt: 0,
        leg: 0, armL: 0.1, armR: 0.1, armSwing: 0, pitch: 0, roll: 0, armTogether: false, hideLeft: 0,
      });
    });
    draw();
  }

  function nearestHome(x, z) {
    let best = null;
    let gap = Infinity;
    for (const b of doors.keys()) {
      const d = Math.hypot(b.position.x - x, b.position.z - z);
      if (d < gap) (gap = d), (best = b);
    }
    return best;
  }

  const world = { threat: null, hero: null, buildings, bounds, walkable, rules, rnd: () => rnd(), say, doorOf };

  // 외치기. 놀란 비명은 옆 사람에게 옮아서, 가까이 서성이던 사람도 같이 뛰기 시작함
  function say(v, kind, opts) {
    const ok = talk.say(v, kind, opts);
    if (ok && ALARM_KINDS.has(kind)) alarm(v);
    return ok;
  }

  function alarm(from) {
    if (mood !== 'normal') return;
    for (const o of list) {
      if (o === from || o.state !== 'idle') continue;
      if (Math.hypot(o.x - from.x, o.z - from.z) < cfg.alarmDistance) o.panic = Math.max(o.panic, cfg.calmSeconds * 1.5);
    }
  }

  function update(dt, threat) {
    if (!(dt > 0)) return;
    clock += dt;
    world.threat = mood === 'saved' ? null : threat;
    world.hero = hero && hero.alive !== false && hero.position ? hero.position : null;
    for (const v of list) stepVillager(v, dt, world);
    talk.tick(dt);
    draw();
  }

  function draw() {
    for (const v of list) {
      v.scale = v.bodyScale * v.appear;
      v.y = v.lift + v.hop;
      if (v.hidden) bodies.hide(v.index);
      else bodies.pose(v.index, v);
    }
    bodies.commit();
  }

  // ── 건물이 흔들리면 안에 있던 사람이 1~3명 튀어나옴 ──
  function burstFrom(b, howMany, kind) {
    const door = doorOf(b) || { x: b.position.x, z: b.position.z + b.radius };
    const inside = list.filter((v) => v.state === 'inside' && v.shelter === b).slice(0, howMany);
    inside.forEach((v, k) => {
      const delay = k * 0.14;
      startBurst(v, b, door, world.rnd, delay);
      if (mood === 'saved') v.partyAfter = true;
      // 첫 사람이 외침: 자기 집이 무너지면 '내 집!!', 그 밖에는 '으아아!' 같은 탈출 말
      const say = kind === 'home' && v.home !== b ? 'burst' : kind;
      if (k === 0 && kind) talk.later(delay + 0.12, v, say, { priority: say === 'home' ? 2 : 1 });
    });
    return inside.length;
  }

  function onBroken({ count: n = 0, source, building } = {}) {
    if (source !== 'building' || !building || mood !== 'normal') return;
    const st = shaken.get(building) || { broken: 0, coolUntil: 0 };
    shaken.set(building, st);
    st.broken += n;
    if (st.broken < cfg.burstBlocks || clock < st.coolUntil) return;
    st.broken = 0;
    st.coolUntil = clock + 2.5;
    const [lo, hi] = cfg.burst;
    burstFrom(building, lo + Math.floor(rnd() * (hi - lo + 1)), 'burst');
  }

  function onDestroyed({ building } = {}) {
    if (!building) return;
    talk.hush();
    // 안에 남은 사람은 모두 탈출 (다치는 사람 없음)
    const out = burstFrom(building, Infinity, 'home');
    if (!out) {
      const owner = closest(list.filter((v) => !v.hidden && v.home === building), building.position);
      if (owner) talk.later(0.25, owner, 'home', { priority: 2 });
    }
    if (mood === 'normal' && buildings.every((b) => !b.alive)) lose();
  }

  function closest(candidates, p) {
    let best = null;
    let gap = Infinity;
    for (const v of candidates) {
      const d = Math.hypot(v.x - p.x, v.z - p.z);
      if (d < gap) (gap = d), (best = v);
    }
    return best;
  }

  function onHero({ hero: h } = {}) {
    if (!h) return;
    hero = h;
    talk.setContext({ heroName: h.name });
    // 영웅 가까운 사람 둘이 차례로 응원
    const near = list.filter((v) => !v.hidden && Math.hypot(v.x - h.position.x, v.z - h.position.z) < cfg.cheerDistance * 1.6);
    near.sort((a, b) => Math.hypot(a.x - h.position.x, a.z - h.position.z) - Math.hypot(b.x - h.position.x, b.z - h.position.z));
    near.slice(0, 2).forEach((v, k) => talk.later(0.35 + k * 0.7, v, 'hero', { priority: 2 }));
  }

  // 괴수가 펑! → 모두 만세, 건물 안 사람도 나와서 만세
  function onSaved() {
    if (mood !== 'normal') return;
    mood = 'saved';
    const seen = list.filter((v) => !v.hidden && v.state !== 'burst');
    for (const v of seen) startParty(v);
    seen.sort((a, b) => b.z - a.z); // 카메라 가까운 사람부터
    seen.slice(0, 2).forEach((v, k) => talk.later(0.5 + k * 0.8, v, 'saved', { priority: 2 }));
    let delay = 0.6;
    for (const b of doors.keys()) {
      if (!b.alive) continue;
      const door = doorOf(b);
      for (const v of list) {
        if (v.state !== 'inside' || v.shelter !== b) continue;
        startBurst(v, b, door, world.rnd, delay);
        v.partyAfter = true;
        delay += 0.1;
      }
    }
  }

  // 괴수가 이김 → 가장자리에서 마지막 으앙~ (떠났던 사람이 먼저 돌아와서)
  function lose() {
    if (mood !== 'normal') return;
    mood = 'lost';
    const edgeGap = (v) => Math.min(v.x - bounds.minX, bounds.maxX - v.x, v.z - bounds.minZ, bounds.maxZ - v.z);
    const gone = list.filter((v) => v.state === 'gone');
    const seen = list.filter((v) => !v.hidden && v.state !== 'burst').sort((a, b) => edgeGap(a) - edgeGap(b));
    [...gone, ...seen].slice(0, 3).forEach((v, k) => {
      startWail(v, bounds);
      talk.later(0.2 + k * 0.6, v, 'wail', { priority: 2 });
    });
  }

  const offs = events
    ? [
        events.on('raidStarted', ({ town, heroKind, heroName } = {}) => talk.setContext({ town: town?.id ?? townId, heroKind, heroName })),
        events.on('monsterBuilt', ({ monster } = {}) => {
          // 괴수가 다 만들어지면 가장 가까운 사람이 먼저 비명 (그 비명에 옆 사람들도 놀람)
          const p = monster?.position;
          const first = p ? closest(list.filter((v) => !v.hidden), p) : null;
          if (first) {
            first.panic = cfg.calmSeconds;
            talk.later(0.15, first, 'panic', { priority: 1 });
            alarm(first);
          }
        }),
        events.on('blocksBroken', onBroken),
        events.on('buildingDestroyed', onDestroyed),
        events.on('hit', ({ amount = 0 } = {}) => {
          if (amount >= BIG_HIT) talk.hush(cfg.shout.hush * 0.5);
        }),
        events.on('heroArrived', onHero),
        events.on('heroPopped', () => {
          hero = null;
        }),
        events.on('monsterPopped', onSaved),
        events.on('raidEnded', ({ result } = {}) => {
          if (result?.win) lose();
        }),
      ]
    : [];

  reset();
  return {
    list,
    talk,
    update,
    reset,
    debugStats() {
      const states = {};
      for (const v of list) states[v.state] = (states[v.state] || 0) + 1;
      return { total: list.length, states, bubbles: talk.bubbles.map((b) => b.text) };
    },
    dispose() {
      for (const off of offs) off?.();
      talk.clear();
      bodies.dispose();
    },
  };
}
