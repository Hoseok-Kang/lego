// 마을 사람 한 명의 머리 (어디로 뛸지, 꽈당 넘어질지, 건물로 숨을지, 영웅을 응원할지)
// 사람은 절대 다치지 않아요: 도망치고, 넘어졌다 허둥지둥 일어나고, 숨고, 마을 밖으로 달아나고, 응원만 합니다.
// 주사위는 villagers.js 가 주는 정해진 순서의 주사위(rnd)만 써서, ?capture 로 한 장면씩 넘겨도 똑같이 움직입니다.
//
//   stepVillager(v, dt, world)    한 사람 한 장면.  world = { threat, hero, buildings, bounds, walkable, rules, rnd, say, doorOf }
//       threat / hero: 괴수 / 영웅 위치 { x, z } 또는 null,  say(v, 상황): 외치기 (villagerTalk.js),  doorOf(건물) → 문 앞 { x, z } 또는 null
//   특별한 몸짓 (꽈당 · 튀어나오기 · 만세 · 으앙~) 은 villagerStunts.js, 움직이기 도구는 villagerMoves.js
//
// 상태 (v.state): idle 서성임 · run 도망 · trip 꽈당 · getup 허둥지둥 일어남 · toDoor 숨으러 감 · enter 문으로 쏙
//                inside 건물 안 (안 보임) · toEdge 마을 밖으로 · gone 떠남 (안 보임) · burst 건물에서 튀어나옴
//                cheer 영웅 응원 · party 만세 · wail 으앙~
// 빠르기·확률 같은 게임 숫자는 villainConfig.js 의 villagers, 몸짓 느낌은 villagerStunts.js 의 상수에서 바꿉니다.

import { move, steer, face, outside, EDGE_MARGIN } from './villagerMoves.js';
import { celebrate, tripping, gettingUp, entering, flyOut, wailing, still, toRun } from './villagerStunts.js';

const DOOR_REACH = 1.0; // 문 앞 이만큼 가까우면 들어감
const GIVE_UP_SECONDS = 6; // 숨거나 달아나다 이만큼 못 가면 다시 그냥 도망
const CHEER_SHOUT = 0.15; // 응원하는 사람이 외치는 빈도 (도망칠 때 외치는 빈도의 이만큼)
const HIDDEN = new Set(['inside', 'gone']);

export function stepVillager(v, dt, w) {
  if (v.state === 'burst') return flyOut(v, dt, w);
  if (v.state === 'inside') return waitInside(v, dt, w);
  if (v.state === 'gone') return waitOutside(v, dt, w);
  if (HIDDEN.has(v.state)) return;
  v.clock += dt;
  if (v.state === 'trip') return tripping(v, dt, w);
  if (v.state === 'getup') return gettingUp(v, dt, w);
  if (v.state === 'enter') return entering(v, dt, w);
  if (v.state === 'wail') return wailing(v, dt);
  if (v.state === 'party') return celebrate(v, dt, null);
  return roam(v, dt, w);
}

// 스스로 숨은 사람은 hideSeconds 뒤 괴수가 멀면 살금살금 다시 나옴 (원래 살던 사람은 건물이 흔들릴 때까지 안에 있음)
function waitInside(v, dt, w) {
  if (!(v.hideLeft > 0)) return;
  v.hideLeft -= dt;
  if (v.hideLeft > 0) return;
  const door = v.shelter ? w.doorOf(v.shelter) : null;
  if (!door || !v.shelter.alive) return;
  if (w.threat && Math.hypot(door.x - w.threat.x, door.z - w.threat.z) < w.rules.scareDistance) {
    v.hideLeft = 1; // 아직 무서움 — 1초 뒤 다시 살핌
    return;
  }
  Object.assign(v, { state: 'idle', hidden: false, x: door.x, z: door.z, appear: 0.2, shelter: null, panic: 0, turn: 0, pause: 0 });
}

// 마을 밖으로 달아난 사람은 returnSeconds 뒤 괴수가 멀면 떠난 자리로 슬금슬금 돌아옴 (구경하고 응원하려고)
function waitOutside(v, dt, w) {
  if (!(v.goneLeft > 0)) return;
  v.goneLeft -= dt;
  if (v.goneLeft > 0) return;
  const b = w.bounds;
  const pad = 2;
  const x = Math.min(b.maxX - pad, Math.max(b.minX + pad, v.x));
  const z = Math.min(b.maxZ - pad, Math.max(b.minZ + pad, v.z));
  if ((w.walkable && !w.walkable(x, z)) || (w.threat && Math.hypot(x - w.threat.x, z - w.threat.z) < w.rules.scareDistance)) {
    v.goneLeft = 1.5; // 아직 무서움 — 조금 뒤 다시 살핌
    return;
  }
  Object.assign(v, { state: 'idle', hidden: false, x, z, dirX: x - v.x, dirZ: z - v.z, appear: 0.2, panic: 0, turn: 1, pause: 0, target: null });
}

// ── 걸어 다니는 상태들 (서성임 · 도망 · 숨으러 감 · 달아남 · 응원) ──
function roam(v, dt, w) {
  const R = w.rules;
  if (v.appear < 1) v.appear = Math.min(1, v.appear + dt * 5); // 문에서 막 나온 사람은 뿅 커짐
  const far = w.threat ? Math.hypot(v.x - w.threat.x, v.z - w.threat.z) : Infinity;
  if (far < R.scareDistance) v.panic = R.calmSeconds;
  else v.panic = Math.max(0, v.panic - dt);
  const heroGap = w.hero ? Math.hypot(v.x - w.hero.x, v.z - w.hero.z) : Infinity;
  const brave = heroGap < R.cheerDistance && far > R.braveDistance;

  if (brave && v.state !== 'toEdge' && v.state !== 'cheer') {
    v.state = 'cheer';
    v.jumpWait = w.rnd() * 0.4;
    if (w.rnd() < 0.35) w.say(v, 'hero');
  } else if (v.state === 'cheer' && !brave) v.state = v.panic > 0 ? 'run' : 'idle';
  else if (v.state === 'idle' && v.panic > 0) {
    v.state = 'run';
    if (w.rnd() < 0.5) w.say(v, 'panic');
  } else if (v.state === 'run' && v.panic <= 0) v.state = 'idle';
  else if ((v.state === 'toDoor' || v.state === 'toEdge') && (v.timer += dt) > GIVE_UP_SECONDS) toRun(v);
  else if (v.state === 'toDoor' && !v.target?.building?.alive) toRun(v);

  let speed = 0;
  if (v.state === 'idle') speed = wander(v, dt, w);
  else if (v.state === 'run') speed = flee(v, dt, w, far);
  else if (v.state === 'toDoor' || v.state === 'toEdge') {
    steer(v, v.target.x - v.x, v.target.z - v.z, dt);
    speed = R.runSpeed * v.speedMul;
  } else if (v.state === 'cheer') {
    if (w.hero) face(v, w.hero.x - v.x, w.hero.z - v.z, dt);
    if (w.rnd() < R.shoutPerSecond * CHEER_SHOUT * dt) w.say(v, 'hero'); // 구경꾼이 가끔 '영웅이다!'
    return celebrate(v, dt, w.hero);
  }
  move(v, dt, speed, w);

  if (v.state === 'toDoor' && Math.hypot(v.target.x - v.x, v.target.z - v.z) < DOOR_REACH) {
    v.state = 'enter';
    v.timer = 0;
  } else if (v.state === 'toEdge' && outside(v, w.bounds)) {
    v.state = 'gone';
    v.hidden = true;
    v.goneLeft = R.returnSeconds;
  }
  animateMove(v, dt, speed);
}


// 평소: 가끔 방향을 바꾸고 가끔 멈춰 섬
function wander(v, dt, w) {
  v.turn -= dt;
  if (v.turn <= 0) {
    const a = w.rnd() * Math.PI * 2;
    v.dirX = Math.cos(a);
    v.dirZ = Math.sin(a) * 0.5;
    v.turn = 1.5 + w.rnd() * 2.5;
    v.pause = w.rnd() < 0.4 ? 0.8 + w.rnd() : 0;
  }
  if (v.pause > 0) {
    v.pause -= dt;
    return 0;
  }
  return w.rules.walkSpeed * v.speedMul;
}

// 도망: 괴수 반대쪽으로 지그재그. 가끔 꽈당 · 숨으러 감 · 마을 밖으로
function flee(v, dt, w, far) {
  const R = w.rules;
  // 괴수 반대쪽으로 (멀리 있으면 덜 급하게 틈). 괴수가 없으면 하던 쪽으로 지그재그
  const wig = Math.sin(v.clock * v.zigRate + v.seed) * R.zigzag;
  const len = far || 1;
  const ax = w.threat ? (v.x - w.threat.x) / len : v.dirX;
  const az = w.threat ? (v.z - w.threat.z) / len : v.dirZ;
  steer(v, ax - az * wig, az + ax * wig, far < R.scareDistance * 1.3 ? dt : dt * 0.4);
  if (v.clock > v.safeUntil) {
    const roll = w.rnd();
    const trip = R.tripPerSecond * dt;
    const hide = trip + R.hidePerSecond * dt;
    const edge = hide + R.edgePerSecond * dt;
    if (roll < trip) {
      startTrip(v, w);
      return 0;
    }
    if (roll < hide) tryHide(v, w);
    else if (roll < edge) tryEdge(v, w);
    else if (w.rnd() < R.shoutPerSecond * dt) w.say(v, 'panic');
  }
  return R.runSpeed * v.speedMul;
}

function startTrip(v, w) {
  v.state = 'trip';
  v.timer = 0;
  if (w.rnd() < 0.7) w.say(v, 'trip');
}

// 괴수에게서 멀고 아직 멀쩡한 건물 문으로 숨으러 감
function tryHide(v, w) {
  const R = w.rules;
  const myGap = w.threat ? Math.hypot(v.x - w.threat.x, v.z - w.threat.z) : Infinity;
  let best = null;
  let bestGap = R.hideSearch;
  for (const b of w.buildings) {
    if (!b.alive || b.remaining < b.totalBlocks * 0.85) continue;
    const door = w.doorOf(b);
    if (!door) continue;
    const gap = Math.hypot(door.x - v.x, door.z - v.z);
    const safe = !w.threat || Math.hypot(door.x - w.threat.x, door.z - w.threat.z) > Math.max(R.braveDistance, myGap * 0.8);
    if (safe && gap < bestGap) {
      bestGap = gap;
      best = { x: door.x, z: door.z, building: b };
    }
  }
  if (!best) return;
  v.state = 'toDoor';
  v.target = best;
  v.timer = 0;
  if (w.rnd() < 0.5) w.say(v, 'hide');
}

// 가장 가까운 바닥판 가장자리 중 괴수 반대쪽으로 달아남 (물 쪽은 안 감)
function tryEdge(v, w) {
  const b = w.bounds;
  const m = EDGE_MARGIN + 1;
  const exits = [
    [b.minX - m, v.z, b.minX + 1, v.z],
    [b.maxX + m, v.z, b.maxX - 1, v.z],
    [v.x, b.minZ - m, v.x, b.minZ + 1],
    [v.x, b.maxZ + m, v.x, b.maxZ - 1],
  ];
  let best = null;
  let bestScore = Infinity;
  for (const [x, z, ix, iz] of exits) {
    if (w.walkable && !w.walkable(ix, iz)) continue;
    const gap = Math.hypot(x - v.x, z - v.z) || 1;
    let away = 0;
    if (w.threat) {
      const tl = Math.hypot(v.x - w.threat.x, v.z - w.threat.z) || 1;
      away = ((x - v.x) / gap) * ((v.x - w.threat.x) / tl) + ((z - v.z) / gap) * ((v.z - w.threat.z) / tl);
    }
    if (away < -0.2) continue;
    const score = gap - away * 12;
    if (score < bestScore) {
      bestScore = score;
      best = { x, z, building: null };
    }
  }
  if (!best) return;
  v.state = 'toEdge';
  v.target = best;
  v.timer = 0;
}






// ── 자세 ──
function animateMove(v, dt, speed) {
  v.phase += dt * (speed > 0 ? 4 + speed * 1.4 : 0);
  if (speed > 0) face(v, v.dirX, v.dirZ, dt);
  const s = Math.sin(v.phase);
  v.lift = 0;
  v.vy = 0;
  if (speed <= 0) return still(v);
  if (v.state === 'idle') {
    Object.assign(v, { leg: s * 0.5, armSwing: -s * 0.45, armL: 0.12, armR: 0.12, pitch: 0, roll: s * 0.04, hop: Math.abs(s) * 0.06, armTogether: false });
    return;
  }
  // 도망: 만세하듯 팔을 들고 허우적 (windmill 인 사람은 팔을 앞뒤로 마구 휘저음)
  const flail = Math.sin(v.phase * 0.9);
  if (v.windmill) Object.assign(v, { armL: 0.5, armR: 0.5, armSwing: flail * 1.6 });
  else Object.assign(v, { armL: 2.55 + flail * 0.35, armR: 2.55 + Math.sin(v.phase * 0.9 + 1.7) * 0.35, armSwing: 0 });
  Object.assign(v, { leg: s * 0.95, pitch: 0.24, roll: Math.sin(v.phase * 0.5) * 0.14, hop: Math.abs(s) * 0.42 * v.bodyScale, armTogether: false });
}











