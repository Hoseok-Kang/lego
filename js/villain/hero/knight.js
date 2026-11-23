// 영웅 '번개 기사' (꼬마 마을의 영웅: 하늘에서 번개와 함께 내려와 칼로 싸움)
// 알아서 괴수를 쫓아가 칼을 휘두르고, 몇 초마다 높이 뛰어올라 내려찍습니다. 맞으면 망토·방패·깃털부터 떨어지고 체력이 0 이면 '펑'.
// 바깥에서는 hero.js 의 createHero(scene, { kind: 'knight' }) 로 만듭니다. (과녁·소식 설명은 hero.js 맨 위)
//
//   createKnight(scene, { stats, hpMul, debris, fx, events, bounds, obstacles }) → 영웅
//       stats: VILLAIN.heroes.knight 숫자 (maxHp, speed, damage, interval, range, leapEvery, leapDamage …)
//
// 몸짓 느낌(휘두르는 시간, 뛰는 높이, 옆으로 도는 빠르기)은 아래 상수에서 바꿉니다.

import * as THREE from '../../lib/three.js';
import { buildHeroModel, HERO_SCALE } from './heroArt.js';
import { createHeroRig } from './heroRig.js';
import { createHeroBody, clamp, smooth } from './heroBody.js';

const SWING_SECONDS = 0.34; // 칼 한 번 휘두르는 시간
const SWING_HIT_AT = 0.42; // 휘두르기 중 이때 맞음 (0~1)
const LEAP_SECONDS = 0.8; // 뛰어올라 내려찍는 시간
const LEAP_HEIGHT = 9; // 뛰어오르는 높이
const LEAP_REACH = 20; // 괴수가 이보다 멀면 뛰지 않고 달려감
const SLAM_RADIUS = 3.4; // 내려찍기가 닿는 둘레 (괴수 몸 둘레에 더함)
const RECOVER_SECONDS = 0.3; // 내려찍은 뒤 잠깐 멈춤
const CIRCLE_SPEED = 0.4; // 가까이서 옆으로 도는 빠르기 (달리기의 몇 배)
const SIDE_SLOPE = 0.6; // 괴수의 앞·뒤쪽으로 이만큼 넘어가면 옆구리 쪽으로 되돌아감
const SIDE_SPEED = 0.75; // 옆구리로 되돌아가는 빠르기 (달리기의 몇 배)
const TURN_SPEED = 12;

export function createKnight(scene, { stats, hpMul = 1, ...options } = {}) {
  const model = buildHeroModel();
  const body = createHeroBody(scene, {
    ...options,
    model,
    scale: HERO_SCALE,
    stats,
    hpMul,
    radius: 1.3,
    weapons: [{ name: 'sword', voxels: model.sword.voxels, parent: 'armR', pivot: model.sword.grip, at: model.sword.at }],
  });
  const rig = createHeroRig(body.fig);
  const { fx } = options;
  const position = body.position;
  const tmp = new THREE.Vector3();
  const leapFrom = new THREE.Vector3();
  const leapTo = new THREE.Vector3();
  let runPhase = 0;
  let runBlend = 0;
  let swing = -1; // 휘두르기 진행 (초), -1 = 안 함
  let swingSide = 1;
  let swingHit = false;
  let cooldown = 0;
  let leapClock = 0;
  let circleDir = 1;
  let circleClock = 0;

  function reset() {
    body.reset();
    swing = -1;
    cooldown = 0.4;
    leapClock = stats.leapEvery * 0.45; // 첫 내려찍기는 조금 일찍
    runBlend = 0;
  }

  function startSwing() {
    swing = 0;
    swingHit = false;
    swingSide = -swingSide;
    cooldown = stats.interval;
    body.emit('attack', { who: api, kind: 'sword', position });
  }

  function startLeap() {
    const target = body.target;
    leapClock = 0;
    leapFrom.copy(position);
    // 괴수 옆구리(지금 내가 있는 쪽)에 내려앉음 — 앞뒤로는 조금만 벗어나게
    const dx = position.x - target.position.x || 1;
    const dz = clamp(position.z - target.position.z, -Math.abs(dx) * 0.4, Math.abs(dx) * 0.4);
    const d = Math.hypot(dx, dz) || 1;
    const stand = (target.radius || 1) + body.radius + 0.4;
    const a = body.area;
    leapTo.set(clamp(target.position.x + (dx / d) * stand, a.minX, a.maxX), 0, clamp(target.position.z + (dz / d) * stand, a.minZ, a.maxZ));
    body.warning = fx?.telegraph?.(leapTo, SLAM_RADIUS, LEAP_SECONDS) || null;
    swing = -1;
    body.setState('leap');
    body.emit('attack', { who: api, kind: 'leap', position });
  }

  // 달리거나 옆으로 돌기 (fight 상태)
  function fight(dt) {
    const target = body.target;
    cooldown -= dt;
    leapClock += dt;
    if (!target || !target.alive) {
      runBlend += (0 - runBlend) * Math.min(1, dt * 10);
      return;
    }
    const dx = target.position.x - position.x;
    const dz = target.position.z - position.z;
    const d = Math.hypot(dx, dz) || 1e-3;
    const gap = body.gapTo(target);
    body.turnTo(target.position.x, target.position.z, dt, TURN_SPEED);

    if (swing < 0 && leapClock >= stats.leapEvery && gap < LEAP_REACH && gap > -1) {
      startLeap();
      return;
    }
    let moveX = 0;
    let moveZ = 0;
    let speed = 0;
    if (gap > stats.range * 0.7) {
      moveX = dx / d;
      moveZ = dz / d;
      speed = stats.speed;
    } else if (swing < 0) {
      // 가까우면 옆으로 빙글 돌며 틈을 봄 (너무 붙었으면 살짝 물러남)
      circleClock -= dt;
      if (circleClock <= 0) {
        circleClock = 1.2 + Math.random() * 1.6;
        circleDir = Math.random() < 0.5 ? -1 : 1;
      }
      // 괴수는 종이 인형처럼 옆으로 넓고 앞뒤로 얇아서, 앞·뒤쪽에 서 있으면 칼이 안 닿아 보임 → 옆구리 쪽으로 돌아감
      const offSide = Math.abs(dz) > Math.abs(dx) * SIDE_SLOPE;
      if (offSide) circleDir = dx * dz >= 0 ? 1 : -1;
      const back = gap < stats.range * 0.25 ? -0.6 : 0;
      moveX = (-dz / d) * circleDir + (dx / d) * back;
      moveZ = (dx / d) * circleDir + (dz / d) * back;
      speed = stats.speed * (offSide ? SIDE_SPEED : CIRCLE_SPEED);
    }
    position.x += moveX * speed * dt;
    position.z += moveZ * speed * dt;
    runBlend += ((speed > 0 ? Math.min(1, speed / stats.speed + 0.35) : 0) - runBlend) * Math.min(1, dt * 12);
    runPhase += dt * (5 + speed * 1.1);
    if (swing < 0 && cooldown <= 0 && gap <= stats.range) startSwing();
  }

  function stepSwing() {
    if (swing < 0) return;
    if (!swingHit && swing >= SWING_SECONDS * SWING_HIT_AT) {
      swingHit = true;
      fx?.slashArc?.(tmp.set(position.x, body.y + 2.4, position.z), body.facing, 2.4, stats.range + 1.2, swingSide);
      const target = body.target;
      if (target && target.alive && body.gapTo(target) <= stats.range + 0.6) body.strike(stats.damage, 'sword');
    }
    if (swing >= SWING_SECONDS) swing = -1;
  }

  function update(dt) {
    if (!body.begin(dt)) return;
    const pose = { time: body.time, run: 0, runPhase, swing: -1, swingSide, air: null, fall: 0, crouch: 0, cheer: 0, hurt: body.hurtLevel };
    if (body.entrance(dt, pose)) {
      // 떨어지는 중·착지 중
    } else if (body.state === 'leap') {
      const p = Math.min(1, body.stateTime / LEAP_SECONDS);
      position.lerpVectors(leapFrom, leapTo, smooth(p));
      body.y = LEAP_HEIGHT * 4 * p * (1 - p);
      pose.air = p * 2 - 1;
      if (leapFrom.distanceToSquared(leapTo) > 0.5) body.turnTo(leapTo.x + (leapTo.x - leapFrom.x), leapTo.z + (leapTo.z - leapFrom.z), dt, TURN_SPEED);
      if (p >= 1) {
        body.y = 0;
        body.warning = null;
        body.landFx('leap');
        const target = body.target;
        if (target && target.alive && body.gapTo(target) <= SLAM_RADIUS) body.strike(stats.leapDamage, 'leap');
        body.setState('recover');
      }
    } else if (body.state === 'recover') {
      pose.crouch = 1 - smooth(body.stateTime / RECOVER_SECONDS);
      if (body.stateTime >= RECOVER_SECONDS) body.setState('fight');
    } else if (body.state === 'fight') {
      fight(dt);
      if (swing >= 0) swing += dt;
      stepSwing();
      body.settle(dt, stats.speed * 0.5 * dt);
      pose.run = runBlend;
      pose.swing = swing >= 0 ? swing / SWING_SECONDS : -1;
      body.y = Math.abs(Math.sin(runPhase)) * 0.45 * runBlend;
      if (!body.target || !body.target.alive) pose.cheer = 0.6 + 0.4 * Math.sin(body.time * 6); // 이겼다!
    }
    rig.pose(pose);
    body.place();
  }

  const api = {
    team: 'town',
    kind: 'knight',
    name: stats.name,
    position,
    radius: body.radius,
    height: model.height,
    maxHp: body.maxHp,
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
    takeDamage: ({ amount = 0, from = null } = {}) => body.hurt({ amount, from }),
    update,
    reset,
    dispose: () => body.dispose(),
    get alive() {
      return body.alive; // 아직 안 나왔거나 터졌으면 과녁이 아님
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
