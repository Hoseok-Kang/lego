// 마을 사람의 특별한 몸짓 (꽈당 넘어지기 · 허둥지둥 일어나기 · 문으로 쏙 · 건물에서 붕 튀어나오기 · 응원 · 만세 · 으앙~)
// 보통 움직임(서성임·도망·숨으러 가기)은 villagerBrain.js 에 있고, 상태가 바뀔 때 여기 함수를 부릅니다.
// 사람은 절대 다치지 않아요: 넘어져도 바로 일어나고, 무너지는 건물에서는 밖으로 튀어나옵니다.
//
//   tripping / gettingUp / entering / flyOut / wailing (v, dt, world)   그 상태의 한 장면 (entering 이 끝나면 hideSeconds 동안 숨음)
//   celebrate(v, dt, 영웅 위치 | null)   응원 (영웅을 봄) · 만세 (영웅이 없으면 카메라 쪽을 봄)
//   startBurst(v, 건물, 문, rnd, delay)   건물에서 붕 뛰쳐나오기 (delay 초 뒤에)
//   startWail(v, bounds)   가장자리에서 으앙~ ;  startParty(v)   만세 ;  toRun(v)  다시 도망 ;  still(v)  가만히 선 자세
//
// 몸짓 느낌(튀어나오는 세기, 넘어지는 시간 등)은 아래 상수에서 바꿉니다. 게임 숫자는 villainConfig.js 의 villagers.

import { move, face, jump } from './villagerMoves.js';

const BURST_UP = [6.5, 9.5]; // 건물에서 튀어나올 때 위로 (가장 약하게, 가장 세게)
const BURST_OUT = [4, 7.5]; // 옆으로
const CHEER_JUMP = 5.5; // 응원 점프 세기
const FALL_SECONDS = 0.16; // 꽈당 넘어지는 데 걸리는 시간
const TRIP_SLIDE = 6; // 넘어지며 앞으로 미끄러지는 빠르기
const GETUP_SECONDS = 0.4; // 허둥지둥 일어나는 시간
const ENTER_SECONDS = 0.3; // 문으로 쏙 들어가는 시간
const SAFE_AFTER_GETUP = 1.2; // 일어난 뒤 이 시간 동안은 다시 안 넘어짐
const LIE_LIFT = 0.36; // 엎드렸을 때 몸이 땅에 묻히지 않게 올리는 높이 (칸)

// 응원 · 만세: 제자리에서 폴짝폴짝, 두 팔을 번갈아 흔듦 (만세는 카메라 쪽을 봄)
export function celebrate(v, dt, hero) {
  if (!hero && v.state === 'party') face(v, 0, 1, dt);
  jump(v, dt);
  if (v.lift <= 0) {
    v.jumpWait -= dt;
    if (v.jumpWait <= 0) {
      v.vy = CHEER_JUMP * (v.kid ? 1.1 : 1);
      v.jumpWait = 0.18 + (v.seed % 1) * 0.35;
    }
  }
  const wave = Math.sin(v.clock * 13 + v.seed);
  Object.assign(v, { leg: v.lift > 0 ? 0.35 : 0, armL: 2.75 + wave * 0.3, armR: 2.75 - wave * 0.3, armSwing: 0, pitch: -0.08, roll: wave * 0.05, hop: 0, armTogether: false });
}

// 꽈당: 앞으로 엎어져 미끄러지고, 다리를 버둥버둥
export function tripping(v, dt, w) {
  v.timer += dt;
  const t = v.timer;
  const slide = Math.max(0, 1 - t / 0.4) * TRIP_SLIDE * v.speedMul;
  move(v, dt, slide, w);
  const fall = Math.min(1, t / FALL_SECONDS);
  const kick = t > FALL_SECONDS ? Math.sin(t * 24) : 0;
  Object.assign(v, {
    pitch: fall * Math.PI * 0.5,
    lift: Math.sin(fall * Math.PI * 0.5) * LIE_LIFT * v.bodyScale,
    hop: fall < 1 ? Math.sin(fall * Math.PI) * 0.4 : 0,
    leg: kick * 0.55,
    armSwing: -2.9 * fall,
    armL: 0.25 + kick * 0.15,
    armR: 0.25 - kick * 0.15,
    roll: 0,
    armTogether: true,
  });
  if (t >= w.rules.tripSeconds) {
    v.state = 'getup';
    v.timer = 0;
  }
}

// 허둥지둥 일어나서 다시 뜀
export function gettingUp(v, dt, w) {
  v.timer += dt;
  const t = Math.min(1, v.timer / GETUP_SECONDS);
  const ease = 1 - (1 - t) * (1 - t);
  const scramble = Math.sin(v.timer * 38);
  Object.assign(v, {
    pitch: (1 - ease) * Math.PI * 0.5,
    lift: Math.sin((1 - ease) * Math.PI * 0.5) * LIE_LIFT * v.bodyScale,
    hop: Math.sin(t * Math.PI) * 0.35,
    roll: scramble * 0.18 * (1 - t),
    leg: scramble * 0.7,
    armSwing: -2.9 * (1 - ease),
    armL: 1.2 * ease,
    armR: 1.2 * ease,
    armTogether: false,
  });
  if (t >= 1) {
    toRun(v);
    v.panic = Math.max(v.panic, w.rules.calmSeconds);
    v.safeUntil = v.clock + SAFE_AFTER_GETUP;
    v.lift = 0;
  }
}

// 문으로 쏙: 건물 쪽으로 다이빙하듯 작아지며 사라짐
export function entering(v, dt, w) {
  v.timer += dt;
  const t = Math.min(1, v.timer / ENTER_SECONDS);
  const b = v.target?.building;
  if (b) {
    v.x += (b.position.x - v.x) * Math.min(1, dt * 5);
    v.z += (b.position.z - v.z) * Math.min(1, dt * 5);
    face(v, b.position.x - v.x, b.position.z - v.z, dt);
  }
  Object.assign(v, { appear: 1 - t, pitch: 0.7 * t, hop: Math.sin(t * Math.PI) * 0.5, leg: 0.6, armL: 2.6, armR: 2.6, armSwing: -1, armTogether: true });
  if (t >= 1) {
    v.state = 'inside';
    v.hideLeft = w.rules.hideSeconds; // 이만큼 숨어 있다가 괴수가 멀면 다시 나옴
    v.hidden = true;
    v.shelter = b || null;
    v.target = null;
    v.appear = 1;
  }
}

// 건물에서 붕 튀어나와 빙글 돌며 떨어지고, 땅에 닿으면 바로 도망 (괴수가 터진 뒤면 만세)
export function startBurst(v, building, door, rnd, delay = 0) {
  const ox = door.x - building.position.x;
  const oz = door.z - building.position.z;
  const len = Math.hypot(ox, oz) || 1;
  const turn = (rnd() - 0.5) * 1.3;
  const dirX = (ox / len) * Math.cos(turn) - (oz / len) * Math.sin(turn);
  const dirZ = (oz / len) * Math.cos(turn) + (ox / len) * Math.sin(turn);
  const out = BURST_OUT[0] + rnd() * (BURST_OUT[1] - BURST_OUT[0]);
  Object.assign(v, {
    state: 'burst', hidden: true, timer: -delay, x: door.x, z: door.z, lift: 0.3,
    vx: dirX * out, vz: dirZ * out, vy: BURST_UP[0] + rnd() * (BURST_UP[1] - BURST_UP[0]),
    spin: (rnd() - 0.5) * 12, dirX, dirZ, appear: 0.3, shelter: null, target: null,
  });
}

export function flyOut(v, dt, w) {
  v.timer += dt;
  if (v.timer < 0) return; // 차례를 기다림 (건물 안)
  v.hidden = false;
  v.clock += dt;
  v.appear = Math.min(1, 0.3 + v.timer * 6);
  const bx = v.x;
  const bz = v.z;
  v.x += v.vx * dt;
  v.z += v.vz * dt;
  if (w.walkable && !w.walkable(v.x, v.z)) {
    v.x = bx;
    v.z = bz;
    v.vx = v.vz = 0;
  }
  jump(v, dt);
  v.yaw += v.spin * dt;
  const flail = Math.sin(v.timer * 30);
  Object.assign(v, { pitch: -0.3, roll: flail * 0.12, leg: flail * 0.8, armL: 2.7 + flail * 0.3, armR: 2.7 - flail * 0.3, armSwing: 0, hop: 0, armTogether: false });
  if (v.lift <= 0 && v.timer > 0.1) {
    if (v.partyAfter) startParty(v);
    else {
      toRun(v);
      v.panic = w.rules.calmSeconds + 1;
      v.safeUntil = v.clock + 0.8;
    }
  }
}

// 괴수가 이겼을 때: 마을 가장자리(떠났던 사람은 떠난 자리 바로 안쪽)에서 으앙~
export function startWail(v, bounds) {
  const pad = 2;
  v.x = Math.min(bounds.maxX - pad, Math.max(bounds.minX + pad, v.x));
  v.z = Math.min(bounds.maxZ - pad, Math.max(bounds.minZ + pad, v.z));
  Object.assign(v, { state: 'wail', hidden: false, appear: 1, lift: 0, vy: 0, target: null, shelter: null });
}

export function wailing(v, dt) {
  face(v, 0, 1, dt); // 카메라 쪽을 보고
  const sob = Math.sin(v.clock * 7 + v.seed);
  Object.assign(v, { roll: Math.sin(v.clock * 2.6) * 0.16, pitch: 0.12, hop: Math.abs(sob) * 0.12, leg: 0, armSwing: -2.2 + sob * 0.25, armL: 0.35, armR: 0.35, armTogether: true });
}

export function startParty(v) {
  Object.assign(v, { state: 'party', hidden: false, appear: 1, target: null, partyAfter: false });
  v.jumpWait = (v.seed % 1) * 0.5;
}

export function still(v) {
  Object.assign(v, { leg: 0, armSwing: 0, armL: 0.1, armR: 0.1, pitch: 0, roll: 0, hop: 0, armTogether: false });
}

export function toRun(v) {
  v.state = 'run';
  v.target = null;
  v.timer = 0;
}
