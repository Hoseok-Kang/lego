// 영웅 '얼음 마법사' (바닷가 마을의 영웅: 하늘빛 기둥을 타고 내려와 멀리서 얼음을 던짐)
// 괴수와 거리를 두고 서서 지팡이로 얼음 화살을 쏩니다. 얼음에 맞은 괴수는 잠깐 꽁꽁 얼어 느려져요.
// 괴수가 너무 가까이 오면 잠깐 반짝이며 힘을 모았다가 '휙!' 사라져 멀리 다시 나타납니다 (순간 이동, 한참 쉬었다 다시 씀).
// 약점: 빠른 괴수, 멀리서 단숨에 들이받는 돌진 뿔, 멀리까지 닿는 불. 맞으면 모자 끝·수염부터 떨어지고 0 이면 '펑'.
// 바깥에서는 hero.js 의 createHero(scene, { kind: 'iceMage' }) 로 만듭니다. (과녁·소식 설명은 hero.js 맨 위)
//
//   createIceMage(scene, { stats, hpMul, debris, fx, events, bounds, obstacles }) → 영웅
//       stats: VILLAIN.heroes.iceMage (maxHp, speed, damage·interval·range = 얼음 화살, keepDistance, tooFar, boltSpeed,
//              slowMul, slowSeconds = 느려짐, blinkGap, blinkEvery, blinkDistance = 순간 이동, engage …)
//   보내는 소식(더): attack { kind: 'ice' }, heroBlink { from, to }
//
// 몸짓 느낌(쏘는 동작 시간, 사라지는 시간)은 아래 상수에서 바꿉니다.

import * as THREE from '../../lib/three.js';
import { buildIceMageModel, ICE_MAGE_SCALE } from './iceMageArt.js';
import { createIceMageRig, ICE_CAST_FIRE_AT } from './iceMageRig.js';
import { createIceShards } from './iceShards.js';
import { createHeroBody, clamp } from './heroBody.js';

const CAST_SECONDS = 0.75; // 지팡이를 들었다 쏘고 돌아오는 시간 (쏘는 순간은 iceMageRig 의 CAST_FIRE_AT)
const BLINK_CHARGE = 0.4; // 사라지기 전 반짝이며 힘을 모으는 시간 (이때는 맞음 — 가까이 붙은 괴수의 기회)
const BLINK_OUT = 0.22; // 빙글 돌며 사라지는 시간
const BLINK_IN = 0.26; // 새 자리에 뿅 나타나는 시간
const BLINK_TRIES = 16; // 나타날 자리를 찾는 방향 수
const EDGE_MARGIN = 3.5; // 바닥판 가장자리에서 이만큼은 안쪽에 나타남
const WALL_FEAR = 7; // 가장자리에 이만큼 가까우면 벽을 따라 옆으로 도망
const STRAFE_SPEED = 0.35; // 알맞은 거리에서 옆으로 걷는 빠르기 (달리기의 몇 배)
const SPARKLE_HEX = ['#F4F4F4', '#9FC3E9', '#36AEBF'];
const ICE_HEX = '#9FC3E9';
const TURN_SPEED = 10;

export function createIceMage(scene, { stats, hpMul = 1, ...options } = {}) {
  const model = buildIceMageModel();
  const body = createHeroBody(scene, {
    ...options,
    model,
    scale: ICE_MAGE_SCALE,
    stats,
    hpMul,
    radius: 1.3,
    popExtra: 14,
    beam: { core: '#9FC3E9', glow: '#F4F4F4', width: 1.1 },
    weapons: [{ name: 'staff', voxels: model.staff.voxels, parent: 'armR', pivot: model.staff.grip, at: model.staff.at }],
  });
  const rig = createIceMageRig(body.fig);
  const { fx, debris } = options;
  const shards = createIceShards(scene, { debris });
  const position = body.position;
  const tipLocal = new THREE.Vector3(...model.staff.tip).sub(new THREE.Vector3(...model.staff.grip));
  const tip = new THREE.Vector3();
  const blinkFrom = new THREE.Vector3();
  const blinkTo = new THREE.Vector3();
  const sparkleColors = SPARKLE_HEX.map((hex) => new THREE.Color(hex));
  const drift = new THREE.Vector3();
  let runPhase = 0;
  let runBlend = 0;
  let boltCd = 0;
  let blinkCd = 0;
  let fired = false;
  let strafeDir = 1;
  let strafeClock = 0;

  function reset() {
    body.reset();
    shards.clear();
    boltCd = 0.5; // 내려오자마자 곧 한 방
    blinkCd = 0;
    runBlend = 0;
  }

  // ── 얼음 화살 ──
  function startCast() {
    fired = false;
    boltCd = stats.interval;
    body.setState('cast');
  }

  function fire() {
    fired = true;
    const target = body.target;
    if (!target || !target.alive) return;
    body.fig.update();
    tip.copy(tipLocal);
    body.fig.parts.staff.localToWorld(tip);
    fx?.hitSpark?.(tip, ICE_HEX);
    const flight = Math.max(0.6, (stats.range + 6) / stats.boltSpeed);
    shards.launch(tip, target, {
      speed: stats.boltSpeed,
      life: flight,
      onHit: (who) => body.strike(stats.damage, 'ice', { color: ICE_HEX, target: who, slow: { factor: stats.slowMul, seconds: stats.slowSeconds } }),
    });
    body.emit('attack', { who: api, kind: 'ice', position });
  }

  // ── 순간 이동: 괴수에게서 멀고, 가장자리·건물에서 떨어진 자리 ──
  function pickBlinkSpot(target) {
    const a = body.area;
    let best = null;
    let bestScore = -Infinity;
    const turn = Math.random() * Math.PI * 2;
    for (let i = 0; i < BLINK_TRIES; i++) {
      const angle = turn + (i / BLINK_TRIES) * Math.PI * 2;
      const x = clamp(target.position.x + Math.cos(angle) * stats.blinkDistance, a.minX + EDGE_MARGIN, a.maxX - EDGE_MARGIN);
      const z = clamp(target.position.z + Math.sin(angle) * stats.blinkDistance, a.minZ + EDGE_MARGIN, a.maxZ - EDGE_MARGIN);
      const away = Math.hypot(x - target.position.x, z - target.position.z);
      const edge = Math.min(x - a.minX, a.maxX - x, z - a.minZ, a.maxZ - z);
      let blocked = 0;
      for (const o of body.obstacles ? body.obstacles() : []) {
        if (o && o.alive && Math.hypot(o.position.x - x, o.position.z - z) < (o.radius || 0) + 2) blocked = 1;
      }
      // 멀수록, 가장자리에서 떨어질수록, 카메라 쪽(+z, 잘 보이는 곳)일수록 좋음
      const score = Math.min(away, stats.blinkDistance) * 1.5 + Math.min(edge, 10) + z * 0.05 - blocked * 40;
      if (score > bestScore) {
        bestScore = score;
        best = [x, z];
      }
    }
    return best;
  }

  function sparkle(at, count, power) {
    if (!debris) return;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      drift.set(Math.cos(angle) * power, 3 + Math.random() * power, Math.sin(angle) * power);
      debris.spawn(at, sparkleColors[i % sparkleColors.length], drift, { lifetime: 0.45 + Math.random() * 0.25, settle: false, scale: 0.3 + Math.random() * 0.2 });
    }
  }

  function startBlink() {
    blinkCd = stats.blinkEvery;
    body.setState('blinkCharge');
    return true;
  }

  // 힘을 다 모으면 사라질 자리를 정하고 휙
  function vanish() {
    const target = body.target;
    const spot = target && target.alive ? pickBlinkSpot(target) : null;
    if (!spot) return body.setState('fight');
    blinkFrom.copy(position);
    blinkTo.set(spot[0], 0, spot[1]);
    body.setState('blinkOut');
    sparkle(tip.set(position.x, 2.5, position.z), 12, 7);
    fx?.hitSpark?.(tip, ICE_HEX);
    body.emit('heroBlink', { from: blinkFrom.clone(), to: blinkTo.clone(), hero: api });
  }

  // ── 거리 두기: 가까우면 물러나고, 멀면 다가가고, 알맞으면 옆으로 걸음 ──
  function fight(dt) {
    const target = body.target;
    boltCd -= dt;
    blinkCd -= dt;
    if (!target || !target.alive) {
      runBlend += (0 - runBlend) * Math.min(1, dt * 10);
      return;
    }
    const gap = body.gapTo(target);
    body.turnTo(target.position.x, target.position.z, dt, TURN_SPEED);
    if (gap < stats.blinkGap && blinkCd <= 0 && startBlink()) return;
    if (boltCd <= 0 && gap <= stats.range) {
      startCast();
      return;
    }
    let ax = position.x - target.position.x;
    let az = position.z - target.position.z;
    const d = Math.hypot(ax, az) || 1e-3;
    ax /= d;
    az /= d;
    let mx = 0;
    let mz = 0;
    let speed = 0;
    strafeClock -= dt;
    if (strafeClock <= 0) {
      strafeClock = 1.5 + Math.random() * 1.5;
      strafeDir = Math.random() < 0.5 ? -1 : 1;
    }
    if (gap < stats.keepDistance - 1) {
      // 물러나기 (가장자리에 몰리면 벽을 따라 옆으로)
      mx = ax;
      mz = az;
      const a = body.area;
      const walls = [[position.x - a.minX, 1, 0], [a.maxX - position.x, -1, 0], [position.z - a.minZ, 0, 1], [a.maxZ - position.z, 0, -1]];
      for (const [dist, nx, nz] of walls) {
        if (dist >= WALL_FEAR) continue;
        const k = ((WALL_FEAR - dist) / WALL_FEAR) * 1.6;
        mx += nx * k - az * strafeDir * k * 0.8;
        mz += nz * k + ax * strafeDir * k * 0.8;
      }
      speed = stats.speed;
    } else if (gap > stats.tooFar) {
      mx = -ax;
      mz = -az;
      speed = stats.speed * 0.8;
    } else {
      mx = -az * strafeDir;
      mz = ax * strafeDir;
      speed = stats.speed * STRAFE_SPEED;
    }
    const len = Math.hypot(mx, mz) || 1;
    position.x += (mx / len) * speed * dt;
    position.z += (mz / len) * speed * dt;
    runBlend += ((speed > 0 ? Math.min(1, speed / stats.speed + 0.3) : 0) - runBlend) * Math.min(1, dt * 10);
    runPhase += dt * (4 + speed * 0.9);
  }

  function update(dt) {
    shards.update(dt);
    if (!body.begin(dt)) return;
    const pose = { time: body.time, run: 0, runPhase, cast: -1, fall: 0, crouch: 0, cheer: 0, hurt: body.hurtLevel };
    let grow = 1;
    if (body.entrance(dt, pose)) {
      // 떨어지는 중·착지 중
    } else if (body.state === 'cast') {
      const p = body.stateTime / CAST_SECONDS;
      pose.cast = Math.min(1, p);
      const target = body.target;
      if (target && target.alive) body.turnTo(target.position.x, target.position.z, dt, TURN_SPEED);
      if (!fired && p >= ICE_CAST_FIRE_AT) fire();
      // 얼음을 모으는 동안 지팡이 끝에 반짝이
      if (!fired && debris && Math.random() < dt * 30) {
        tip.copy(tipLocal);
        body.fig.parts.staff.localToWorld(tip);
        drift.set((Math.random() - 0.5) * 3, 1 + Math.random() * 2, (Math.random() - 0.5) * 3);
        debris.spawn(tip, sparkleColors[(Math.random() * 3) | 0], drift, { lifetime: 0.3, settle: false, scale: 0.25 });
      }
      body.settle(dt, 0);
      if (p >= 1) body.setState('fight');
      boltCd -= dt;
      blinkCd -= dt;
    } else if (body.state === 'blinkCharge') {
      // 지팡이를 번쩍 들고 발밑에 얼음 반짝이가 빙글
      pose.cheer = Math.min(1, body.stateTime / 0.15);
      grow = 1 + 0.06 * Math.sin(body.time * 40);
      if (debris && Math.random() < dt * 40) {
        const a = Math.random() * Math.PI * 2;
        tip.set(position.x + Math.cos(a) * 1.8, 0.4, position.z + Math.sin(a) * 1.8);
        drift.set(-Math.sin(a) * 3, 4 + Math.random() * 3, Math.cos(a) * 3);
        debris.spawn(tip, sparkleColors[(Math.random() * 3) | 0], drift, { lifetime: 0.35, settle: false, scale: 0.3 });
      }
      body.settle(dt, 0);
      if (body.stateTime >= BLINK_CHARGE) vanish();
    } else if (body.state === 'blinkOut') {
      const p = Math.min(1, body.stateTime / BLINK_OUT);
      grow = 1 - p * p;
      body.facing += dt * 25 * p;
      if (p >= 1) {
        position.copy(blinkTo);
        body.setState('blinkIn');
        sparkle(tip.set(position.x, 2.5, position.z), 14, 8);
        fx?.dust?.(position, 0.8);
      }
    } else if (body.state === 'blinkIn') {
      const p = Math.min(1, body.stateTime / BLINK_IN);
      grow = p < 0.7 ? (p / 0.7) * 1.2 : 1.2 - ((p - 0.7) / 0.3) * 0.2; // 뿅! 살짝 커졌다 제 크기
      const target = body.target;
      if (target && target.alive) body.turnTo(target.position.x, target.position.z, dt, TURN_SPEED * 2);
      if (p >= 1) body.setState('fight');
    } else if (body.state === 'fight') {
      fight(dt);
      body.settle(dt, stats.speed * 0.5 * dt);
      pose.run = runBlend;
      body.y = Math.abs(Math.sin(runPhase)) * 0.3 * runBlend;
      if (!body.target || !body.target.alive) pose.cheer = 0.6 + 0.4 * Math.sin(body.time * 6); // 이겼다!
    }
    rig.pose(pose);
    body.place(Math.max(0.001, grow));
  }

  const api = {
    team: 'town',
    kind: 'iceMage',
    name: stats.name,
    position,
    radius: body.radius,
    height: model.height,
    maxHp: body.maxHp,
    engage: stats.engage,
    enter: (at) => {
      reset();
      body.enter(at);
    },
    setTarget(next) {
      body.target = next || null;
    },
    setObstacles(fn) {
      body.obstacles = fn || null;
    },
    // 사라지는 동안에는 안 맞음
    takeDamage: ({ amount = 0, from = null } = {}) => (body.state === 'blinkOut' || body.state === 'blinkIn' ? { dead: false } : body.hurt({ amount, from })),
    update,
    reset,
    dispose() {
      body.dispose();
      shards.dispose();
    },
    get alive() {
      return body.alive;
    },
    get active() {
      return body.alive;
    },
    get state() {
      return body.state;
    },
    get hp() {
      return body.hp;
    },
    get airborne() {
      return body.airborne;
    },
  };
  body.api = api;
  return api;
}
