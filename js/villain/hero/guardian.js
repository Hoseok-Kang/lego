// 영웅 '황금 수호자' (왕궁 성곽의 영웅: 금빛 기둥을 타고 쿵 내려오는 커다란 갑옷 기사)
// 느리지만 튼튼합니다. 쿵쿵 걸어와 망치로 내려치고, 몇 초마다 큰 방패를 앞으로 들어 앞쪽에서 오는 피해를 절반만 받아요.
// 가끔 망치를 두 손으로 번쩍 들어 힘을 모은 뒤(바닥에 빨간 원) 땅을 쾅! 내려찍어 둘레를 모두 칩니다.
// 약점: 멀리서 뿜는 불 (느려서 다가오는 동안 계속 탐), 한 방이 아주 센 공격(돌진 뿔)은 방패를 깨뜨려 비틀거리게 함.
// 바깥에서는 hero.js 의 createHero(scene, { kind: 'guardian' }) 로 만듭니다. (과녁·소식 설명은 hero.js 맨 위)
//
//   createGuardian(scene, { stats, hpMul, debris, fx, events, bounds, obstacles }) → 영웅
//       stats: VILLAIN.heroes.guardian (maxHp, speed, damage, interval, range, shieldEvery, shieldSeconds, shieldBlock,
//              shieldBreak, slamEvery, slamTelegraph, slamRadius, slamDamage …)
//   보내는 소식(더): attack { kind: 'hammer' | 'slam' }, heroShield { on, hero }, heroBlocked { position, amount }, heroShieldBroken { position }
//
// 몸짓 느낌(휘두르는 시간, 비틀거리는 시간, 방패 빛 크기)은 아래 상수에서 바꿉니다.

import * as THREE from '../../lib/three.js';
import { buildGuardianModel, GUARDIAN_SCALE } from './guardianArt.js';
import { createGuardianRig } from './guardianRig.js';
import { createHeroBody } from './heroBody.js';

const SWING_SECONDS = 0.7; // 망치 한 번 내려치는 시간
const SWING_HIT_AT = 0.5; // 내려치기 중 이때 맞음 (0~1)
const RAISE_SECONDS = 0.35; // 방패를 드는·내리는 시간
const GUARD_WALK = 0.45; // 방패 들고 걷는 빠르기 (보통의 몇 배)
const IMPACT_SECONDS = 0.6; // 내려찍은 뒤 웅크리는 시간
const STAGGER_SECONDS = 1.0; // 방패가 깨져 비틀거리는 시간
const SHIELD_ARC = 1.15; // 앞쪽으로 치는 범위 (라디안, 정면에서 좌우로 이만큼)
const GUARD_REACH = 18; // 괴수가 이보다 가까울 때만 방패를 듦
const KNOCK = 0.35; // 무거워서 덜 밀려남 (기사의 몇 배)
const TURN_SPEED = 5; // 몸을 돌리는 빠르기 (무거워서 느림)
const BARRIER_HEX = '#FFF03A'; // 방패 빛 색
const BARRIER_SIZE = [7.5, 8.5, 0.3]; // 방패 빛 크기 (가로, 높이, 두께)
const BARRIER_AHEAD = 3.4; // 몸 앞으로 이만큼 떨어진 곳
const GOLD = '#F2CD37';

export function createGuardian(scene, { stats, hpMul = 1, ...options } = {}) {
  const model = buildGuardianModel();
  const body = createHeroBody(scene, {
    ...options,
    model,
    scale: GUARDIAN_SCALE,
    stats,
    hpMul,
    radius: 2.1,
    popExtra: 20,
    beam: { core: '#F2CD37', glow: '#FFF03A', width: 1.6 },
    weapons: [{ name: 'hammer', voxels: model.hammer.voxels, parent: 'armR', pivot: model.hammer.grip, at: model.hammer.at }],
  });
  const rig = createGuardianRig(body.fig);
  const { fx } = options;
  const position = body.position;
  const tmp = new THREE.Vector3();

  // 방패 빛 (방패를 든 동안 앞에 생기는 반투명 금빛 벽)
  const barrierMat = new THREE.MeshBasicMaterial({ color: BARRIER_HEX, transparent: true, opacity: 0, depthWrite: false });
  const barrier = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), barrierMat);
  barrier.scale.set(...BARRIER_SIZE);
  barrier.visible = false;
  barrier.renderOrder = 4;
  scene.add(barrier);

  let runPhase = 0;
  let runBlend = 0;
  let swing = -1;
  let swingHit = false;
  let cooldown = 0;
  let shieldClock = 0;
  let slamClock = 0;
  let guard = 0; // 방패를 든 정도 0~1
  let blockFlash = 0;

  function reset() {
    body.reset();
    swing = -1;
    cooldown = 0.6;
    shieldClock = stats.shieldEvery * 0.5; // 첫 방패는 조금 일찍
    slamClock = stats.slamEvery * 0.4;
    guard = 0;
    blockFlash = 0;
    runBlend = 0;
    barrier.visible = false;
  }

  function startSwing() {
    swing = 0;
    swingHit = false;
    cooldown = stats.interval;
    body.emit('attack', { who: api, kind: 'hammer', position });
  }

  function stepSwing(dt) {
    if (swing < 0) return;
    swing += dt;
    if (!swingHit && swing >= SWING_SECONDS * SWING_HIT_AT) {
      swingHit = true;
      const f = body.facing;
      tmp.set(position.x + Math.sin(f) * 2.5, 0.3, position.z + Math.cos(f) * 2.5);
      fx?.dust?.(tmp, 0.7);
      const target = body.target;
      if (target && target.alive && body.gapTo(target) <= stats.range + 0.8) body.strike(stats.damage, 'hammer', { color: GOLD });
    }
    if (swing >= SWING_SECONDS) swing = -1;
  }

  function startGuard() {
    shieldClock = 0;
    swing = -1;
    body.setState('guard');
    body.emit('heroShield', { on: true, hero: api });
  }

  function endGuard(next = 'fight') {
    body.setState(next);
    body.emit('heroShield', { on: false, hero: api });
  }

  function startSlam() {
    slamClock = 0;
    swing = -1;
    body.warning = fx?.telegraph?.(position, stats.slamRadius, stats.slamTelegraph) || null;
    body.setState('slamWind');
    body.emit('attack', { who: api, kind: 'slam', position });
  }

  function slamHit() {
    body.warning = null;
    body.landFx('slam');
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      fx?.dust?.(tmp.set(position.x + Math.cos(a) * stats.slamRadius * 0.7, 0.3, position.z + Math.sin(a) * stats.slamRadius * 0.7), 1);
    }
    const target = body.target;
    if (target && target.alive) {
      const dist = Math.hypot(target.position.x - position.x, target.position.z - position.z) - (target.radius || 0);
      if (dist <= stats.slamRadius) body.strike(stats.slamDamage, 'slam', { color: GOLD });
    }
    body.setState('impact');
  }

  // 걸어가 망치로 치기 (fight 상태)
  function fight(dt) {
    const target = body.target;
    cooldown -= dt;
    shieldClock += dt;
    slamClock += dt;
    if (!target || !target.alive) {
      runBlend += (0 - runBlend) * Math.min(1, dt * 8);
      return;
    }
    const gap = body.gapTo(target);
    body.turnTo(target.position.x, target.position.z, dt, TURN_SPEED);
    if (swing < 0) {
      if (slamClock >= stats.slamEvery && gap < stats.slamRadius - 1) return startSlam();
      if (shieldClock >= stats.shieldEvery && gap < GUARD_REACH) return startGuard();
    }
    walk(dt, target, gap > stats.range * 0.7 && swing < 0 ? stats.speed : 0);
    if (swing < 0 && cooldown <= 0 && gap <= stats.range) startSwing();
  }

  function walk(dt, target, speed) {
    if (speed > 0) {
      const dx = target.position.x - position.x;
      const dz = target.position.z - position.z;
      const d = Math.hypot(dx, dz) || 1;
      position.x += (dx / d) * speed * dt;
      position.z += (dz / d) * speed * dt;
    }
    runBlend += ((speed > 0 ? Math.min(1, speed / stats.speed + 0.3) : 0) - runBlend) * Math.min(1, dt * 8);
    runPhase += dt * (3 + speed * 0.9);
  }

  // 방패 빛 자리·밝기
  function updateBarrier(dt) {
    blockFlash = Math.max(0, blockFlash - dt * 4);
    barrier.visible = guard > 0.05 && body.alive;
    if (!barrier.visible) return;
    const f = body.facing;
    barrier.position.set(position.x + Math.sin(f) * BARRIER_AHEAD, BARRIER_SIZE[1] / 2 + 0.3, position.z + Math.cos(f) * BARRIER_AHEAD);
    barrier.rotation.y = f;
    barrierMat.opacity = guard * (0.24 + 0.08 * Math.sin(body.time * 8)) + blockFlash * 0.4;
  }

  function update(dt) {
    if (!body.begin(dt)) {
      barrier.visible = false;
      return;
    }
    const pose = { time: body.time, run: 0, runPhase, swing: -1, guard: 0, slam: -1, impact: 0, stagger: 0, fall: 0, crouch: 0, cheer: 0, hurt: body.hurtLevel };
    const target = body.target;
    const guarding = body.state === 'guard';
    guard = Math.max(0, Math.min(1, guard + (guarding ? dt : -dt) / RAISE_SECONDS));
    if (body.entrance(dt, pose)) {
      // 떨어지는 중·착지 중
    } else if (guarding) {
      // 방패를 들고 천천히 다가감 (앞쪽이 늘 괴수를 보게)
      if (target && target.alive) {
        body.turnTo(target.position.x, target.position.z, dt, TURN_SPEED * 2);
        walk(dt, target, body.gapTo(target) > stats.range * 0.7 ? stats.speed * GUARD_WALK : 0);
      }
      cooldown -= dt;
      slamClock += dt;
      body.settle(dt, stats.speed * 0.3 * dt);
      if (body.stateTime >= stats.shieldSeconds) endGuard();
    } else if (body.state === 'slamWind') {
      pose.slam = body.stateTime / stats.slamTelegraph;
      if (body.stateTime >= stats.slamTelegraph) slamHit();
    } else if (body.state === 'impact') {
      pose.impact = 1 - Math.max(0, body.stateTime - 0.15) / (IMPACT_SECONDS - 0.15);
      if (body.stateTime >= IMPACT_SECONDS) body.setState('fight');
    } else if (body.state === 'stagger') {
      pose.stagger = 1 - body.stateTime / STAGGER_SECONDS;
      body.settle(dt, 0);
      if (body.stateTime >= STAGGER_SECONDS) body.setState('fight');
    } else if (body.state === 'fight') {
      fight(dt);
      stepSwing(dt);
      body.settle(dt, stats.speed * 0.5 * dt);
      if (!target || !target.alive) pose.cheer = 0.6 + 0.4 * Math.sin(body.time * 5); // 이겼다!
    }
    pose.run = runBlend;
    pose.runPhase = runPhase;
    pose.guard = guard;
    pose.swing = swing >= 0 ? swing / SWING_SECONDS : -1;
    if (body.state === 'fight' || guarding) body.y = 0;
    updateBarrier(dt);
    rig.pose(pose);
    body.place();
  }

  // 맞기: 방패를 든 동안 앞쪽에서 온 피해는 줄어듦. 아주 센 한 방은 방패를 깨뜨림
  function takeDamage({ amount = 0, from = null } = {}) {
    if (!body.alive || amount <= 0) return { dead: false };
    if (body.state === 'guard' && guard > 0.5 && from) {
      const toward = Math.atan2(from.x - position.x, from.z - position.z);
      const off = Math.abs(Math.atan2(Math.sin(toward - body.facing), Math.cos(toward - body.facing)));
      if (off <= SHIELD_ARC) {
        if (amount >= stats.shieldBreak) {
          endGuard('stagger');
          guard = 0;
          body.emit('heroShieldBroken', { position: position.clone(), hero: api });
          fx?.hitSpark?.(barrier.position, GOLD);
          return body.hurt({ amount, from, knock: KNOCK * 2 });
        }
        const kept = amount * (1 - stats.shieldBlock);
        blockFlash = 1;
        fx?.hitSpark?.(barrier.position, GOLD);
        body.emit('heroBlocked', { position: barrier.position.clone(), amount: amount - kept, hero: api });
        return body.hurt({ amount: kept, from, flashHex: GOLD, knock: KNOCK * 0.3 });
      }
    }
    return body.hurt({ amount, from, knock: KNOCK });
  }

  const api = {
    team: 'town',
    kind: 'guardian',
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
    takeDamage,
    update,
    reset,
    dispose() {
      body.dispose();
      barrier.removeFromParent();
      barrier.geometry.dispose();
      barrierMat.dispose();
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
    get guarding() {
      return guard > 0.5 && body.state === 'guard';
    },
  };
  body.api = api;
  return api;
}
