// 영웅 '번개 기사' (마을이 부서지면 하늘에서 번개와 함께 내려와 괴수와 싸움)
// 알아서 괴수를 쫓아가 칼을 휘두르고, 몇 초마다 높이 뛰어올라 내려찍습니다. 맞으면 망토·방패·깃털부터 떨어지고 체력이 0 이면 '펑'.
//
//   const hero = createHero(scene, { debris, fx, events, bounds? })
//   hero.enter(position)          그 자리에 하늘에서 떨어져 등장 (번개 + 충격 고리). 착지하면 'heroArrived' 소식
//   hero.setTarget(monster)       싸울 상대 (과녁: position, radius, alive, takeDamage)
//   hero.setObstacles(() => 건물 목록)   돌아서 갈 건물들 (안 줘도 됨)
//   hero.update(dt)
//   hero.active                   마을에 나와 있고 살아 있음
//   hero.team('town') / position(바닥 점) / radius / height / alive / hp / maxHp / state
//   hero.takeDamage({ amount, from, kind }) → { dead }     (떨어지는 중에는 안 맞음)
//   hero.reset() (다시 숨김, 새 체력) ; hero.dispose()
//
// 보내는 소식: heroArrived { hero }, attack { who, kind: 'sword' | 'leap', position }, hit { target, amount, position, kind },
//            blocksBroken { count, source: 'hero', position }, heroPopped { hero }, heroLanded { position, kind: 'enter' | 'leap' }
// 체력·빠르기·칼 세기는 villainConfig.js 의 hero, 몸짓 느낌은 아래 상수에서 바꿉니다.

import * as THREE from '../../lib/three.js';
import { VILLAIN } from '../villainConfig.js';
import { createVoxelFigure } from '../../fight/render/voxelFigure.js';
import { createHealth } from '../../fight/combat/health.js';
import { buildHeroModel, HERO_SCALE } from './heroArt.js';
import { createHeroRig } from './heroRig.js';
import { createBolt } from './heroBolt.js';

const DROP_HEIGHT = 42; // 등장할 때 떨어지기 시작하는 높이 (칸)
const DROP_SECONDS = 0.5; // 떨어지는 시간
const LAND_SECONDS = 0.55; // 착지해서 웅크렸다 일어나는 시간
const CHEER_SECONDS = 0.5; // 칼을 번쩍 드는 시간
const SWING_SECONDS = 0.34; // 칼 한 번 휘두르는 시간
const SWING_HIT_AT = 0.42; // 휘두르기 중 이때 맞음 (0~1)
const LEAP_SECONDS = 0.8; // 뛰어올라 내려찍는 시간
const LEAP_HEIGHT = 9; // 뛰어오르는 높이
const LEAP_REACH = 20; // 괴수가 이보다 멀면 뛰지 않고 달려감
const SLAM_RADIUS = 3.4; // 내려찍기가 닿는 둘레 (괴수 몸 둘레에 더함)
const RECOVER_SECONDS = 0.3; // 내려찍은 뒤 잠깐 멈춤
const CIRCLE_SPEED = 0.4; // 가까이서 옆으로 도는 빠르기 (달리기의 몇 배)
const KNOCKBACK = 7; // 맞았을 때 밀려나는 빠르기
const EXTRA_POP = 14; // 망토·방패·깃털 말고도 더 떨어질 수 있는 블록 수
const FLASH_SECONDS = 0.16;
const TURN_SPEED = 12; // 몸을 돌리는 빠르기

export function createHero(scene, { debris = null, fx = null, events = null, bounds = null } = {}) {
  const config = VILLAIN.hero;
  const town = VILLAIN.town;
  const area = bounds || { minX: -town.width / 2 + 1, maxX: town.width / 2 - 1, minZ: -town.depth / 2 + 1, maxZ: town.depth / 2 - 1 };
  const model = buildHeroModel();
  const fig = createVoxelFigure(scene, model, { scale: HERO_SCALE, parents: model.parents });
  fig.addPart('sword', model.sword.voxels, { parent: 'armR', pivot: model.sword.grip, at: model.sword.at });
  fig.setVisible(false);
  const rig = createHeroRig(fig);
  const bolt = createBolt(scene);
  const health = createHealth({ maxHp: config.maxHp, popTotal: Math.min(fig.popTotal + EXTRA_POP, fig.totalCount) });

  const position = new THREE.Vector3(); // 바닥 점 (과녁 위치)
  const tmp = new THREE.Vector3();
  const push = new THREE.Vector3(); // 맞아서 밀려나는 빠르기
  const leapFrom = new THREE.Vector3();
  const leapTo = new THREE.Vector3();
  let state = 'away'; // away | drop | land | fight | leap | recover | dead
  let stateTime = 0;
  let time = 0;
  let target = null;
  let obstacles = null;
  let facing = Math.PI / 2;
  let y = 0; // 발 높이
  let runPhase = 0;
  let runBlend = 0;
  let swing = -1; // 휘두르기 진행 (초), -1 = 안 함
  let swingSide = 1;
  let swingHit = false;
  let cooldown = 0;
  let leapClock = 0;
  let circleDir = 1;
  let circleClock = 0;
  let flash = 0;
  let hurt = 0;
  let squash = 0;
  let warning = null;

  const emit = (name, payload) => events?.emit(name, payload);

  function setState(next) {
    state = next;
    stateTime = 0;
  }

  function enter(at) {
    reset();
    position.set(clamp(at.x, area.minX, area.maxX), 0, clamp(at.z, area.minZ, area.maxZ));
    y = DROP_HEIGHT;
    fig.setVisible(true);
    warning = fx?.telegraph?.(position, 3.2, DROP_SECONDS) || null;
    bolt.strike(position, DROP_SECONDS + 0.25);
    if (target) facing = Math.atan2(target.position.x - position.x, target.position.z - position.z);
    setState('drop');
    place();
  }

  function reset() {
    warning?.cancel?.();
    warning = null;
    fig.reset();
    fig.setFlash(0);
    fig.setVisible(false);
    health.reset();
    push.set(0, 0, 0);
    swing = -1;
    cooldown = 0.4;
    leapClock = config.leapEvery * 0.45; // 첫 내려찍기는 조금 일찍
    flash = hurt = squash = runBlend = 0;
    y = 0;
    setState('away');
  }

  // 착지 충격: 고리 + 먼지 + 번쩍
  function landFx(kind) {
    squash = 1;
    fx?.popRing?.(position, kind === 'enter' ? 0.75 : 0.5);
    fx?.dust?.(position, kind === 'enter' ? 1.3 : 1);
    if (kind === 'enter') bolt.strike(position, 0.22);
    emit('heroLanded', { position: position.clone(), kind });
  }

  function gapTo(other) {
    return Math.hypot(other.position.x - position.x, other.position.z - position.z) - (other.radius || 0) - api.radius;
  }

  function strike(amount, kind) {
    if (!target || !target.alive) return;
    const dx = position.x - target.position.x;
    const dz = position.z - target.position.z;
    const d = Math.hypot(dx, dz) || 1;
    const reach = (target.radius || 1) * 0.7;
    const at = new THREE.Vector3(target.position.x + (dx / d) * reach, Math.min(3, (target.height || 4) * 0.4), target.position.z + (dz / d) * reach);
    const result = target.takeDamage?.({ amount, from: position.clone(), kind }) || {};
    fx?.hitSpark?.(at, '#FFF03A');
    emit('hit', { target, amount, position: at, kind, dead: !!result.dead });
  }

  function startSwing() {
    swing = 0;
    swingHit = false;
    swingSide = -swingSide;
    cooldown = config.interval;
    emit('attack', { who: api, kind: 'sword', position });
  }

  function startLeap() {
    leapClock = 0;
    leapFrom.copy(position);
    // 괴수 바로 앞(지금 내가 있는 쪽)에 내려앉음
    const dx = position.x - target.position.x;
    const dz = position.z - target.position.z;
    const d = Math.hypot(dx, dz) || 1;
    const stand = (target.radius || 1) + api.radius + 0.4;
    leapTo.set(clamp(target.position.x + (dx / d) * stand, area.minX, area.maxX), 0, clamp(target.position.z + (dz / d) * stand, area.minZ, area.maxZ));
    warning = fx?.telegraph?.(leapTo, SLAM_RADIUS, LEAP_SECONDS) || null;
    swing = -1;
    setState('leap');
    emit('attack', { who: api, kind: 'leap', position });
  }

  function takeDamage({ amount = 0, from = null } = {}) {
    if (!api.alive || state === 'drop' || amount <= 0) return { dead: false };
    const { popped, dead } = health.damage(amount);
    flash = FLASH_SECONDS;
    hurt = 1;
    if (from) {
      tmp.set(position.x - from.x, 0, position.z - from.z);
      if (tmp.lengthSq() < 1e-4) tmp.set(1, 0, 0);
      push.copy(tmp.normalize().multiplyScalar(KNOCKBACK));
    }
    const at = tmp.set(position.x, y + 3, position.z).clone();
    if (dead) {
      const blocks = fig.explode();
      debris?.burst(blocks, { from: from ? new THREE.Vector3(from.x, 2, from.z) : null, power: 9, upward: 11, scale: HERO_SCALE });
      fx?.popRing?.(position, 0.8);
      warning?.cancel?.();
      warning = null;
      setState('dead');
      emit('blocksBroken', { count: blocks.length, source: 'hero', position: at });
      emit('heroPopped', { hero: api });
      return { dead: true };
    }
    if (popped > 0) {
      const blocks = fig.popBlocks(popped);
      debris?.burst(blocks, { from: from ? new THREE.Vector3(from.x, 2, from.z) : null, power: 6, upward: 8, scale: HERO_SCALE });
      if (blocks.length) emit('blocksBroken', { count: blocks.length, source: 'hero', position: at });
    }
    return { dead: false };
  }

  // 달리거나 옆으로 돌기 (fight 상태)
  function fight(dt) {
    cooldown -= dt;
    leapClock += dt;
    if (!target || !target.alive) {
      runBlend += (0 - runBlend) * Math.min(1, dt * 10);
      return;
    }
    const dx = target.position.x - position.x;
    const dz = target.position.z - position.z;
    const d = Math.hypot(dx, dz) || 1e-3;
    const gap = gapTo(target);
    const want = Math.atan2(dx, dz);
    facing += Math.atan2(Math.sin(want - facing), Math.cos(want - facing)) * Math.min(1, dt * TURN_SPEED);

    if (swing < 0 && leapClock >= config.leapEvery && gap < LEAP_REACH && gap > -1) {
      startLeap();
      return;
    }
    let moveX = 0;
    let moveZ = 0;
    let speed = 0;
    if (gap > config.range * 0.7) {
      moveX = dx / d;
      moveZ = dz / d;
      speed = config.speed;
    } else if (swing < 0) {
      // 가까우면 옆으로 빙글 돌며 틈을 봄 (너무 붙었으면 살짝 물러남)
      circleClock -= dt;
      if (circleClock <= 0) {
        circleClock = 1.2 + Math.random() * 1.6;
        circleDir = Math.random() < 0.5 ? -1 : 1;
      }
      const back = gap < config.range * 0.25 ? -0.6 : 0;
      moveX = (-dz / d) * circleDir + (dx / d) * back;
      moveZ = (dx / d) * circleDir + (dz / d) * back;
      speed = config.speed * CIRCLE_SPEED;
    }
    position.x += moveX * speed * dt;
    position.z += moveZ * speed * dt;
    runBlend += ((speed > 0 ? Math.min(1, speed / config.speed + 0.35) : 0) - runBlend) * Math.min(1, dt * 12);
    runPhase += dt * (5 + speed * 1.1);
    if (swing < 0 && cooldown <= 0 && gap <= config.range) startSwing();
  }

  function stepSwing(dt) {
    if (swing < 0) return;
    swing += dt;
    if (!swingHit && swing >= SWING_SECONDS * SWING_HIT_AT) {
      swingHit = true;
      fx?.slashArc?.(tmp.set(position.x, y + 2.4, position.z), facing, 2.4, config.range + 1.2, swingSide);
      if (target && target.alive && gapTo(target) <= config.range + 0.6) strike(config.damage, 'sword');
    }
    if (swing >= SWING_SECONDS) swing = -1;
  }

  function avoidObstacles() {
    for (const o of obstacles ? obstacles() : []) {
      if (!o || !o.alive || o === target) continue;
      const dx = position.x - o.position.x;
      const dz = position.z - o.position.z;
      const d = Math.hypot(dx, dz) || 1e-3;
      const min = (o.radius || 0) + api.radius + 0.3;
      if (d < min) {
        position.x = o.position.x + (dx / d) * min;
        position.z = o.position.z + (dz / d) * min;
      }
    }
  }

  function update(dt) {
    bolt.update(dt);
    if (state === 'away') return;
    time += dt;
    stateTime += dt;
    flash = Math.max(0, flash - dt);
    hurt = Math.max(0, hurt - dt * 4);
    squash = Math.max(0, squash - dt * 5);
    if (state === 'dead') return;
    fig.setFlash(flash > 0 ? Math.min(1, flash / FLASH_SECONDS) : 0);

    const pose = { time, run: 0, runPhase, swing: -1, swingSide, air: null, fall: 0, crouch: 0, cheer: 0, hurt };
    if (state === 'drop') {
      const p = Math.min(1, stateTime / DROP_SECONDS);
      y = DROP_HEIGHT * (1 - p * p);
      pose.fall = 1;
      if (p >= 1) {
        y = 0;
        warning = null;
        landFx('enter');
        setState('land');
        emit('heroArrived', { hero: api });
      }
    } else if (state === 'land') {
      const total = LAND_SECONDS + CHEER_SECONDS;
      pose.crouch = stateTime < LAND_SECONDS ? 1 - smooth(Math.max(0, stateTime / LAND_SECONDS - 0.45) / 0.55) : 0;
      pose.cheer = stateTime > LAND_SECONDS * 0.7 ? Math.sin(Math.min(1, (stateTime - LAND_SECONDS * 0.7) / (total - LAND_SECONDS * 0.7)) * Math.PI) : 0;
      if (stateTime >= total) setState('fight');
    } else if (state === 'leap') {
      const p = Math.min(1, stateTime / LEAP_SECONDS);
      position.lerpVectors(leapFrom, leapTo, smooth(p));
      y = LEAP_HEIGHT * 4 * p * (1 - p);
      pose.air = p * 2 - 1;
      const want = Math.atan2(leapTo.x - leapFrom.x, leapTo.z - leapFrom.z);
      if (leapFrom.distanceToSquared(leapTo) > 0.5) facing += Math.atan2(Math.sin(want - facing), Math.cos(want - facing)) * Math.min(1, dt * TURN_SPEED);
      if (p >= 1) {
        y = 0;
        warning = null;
        landFx('leap');
        if (target && target.alive && gapTo(target) <= SLAM_RADIUS) strike(config.leapDamage, 'leap');
        setState('recover');
      }
    } else if (state === 'recover') {
      pose.crouch = 1 - smooth(stateTime / RECOVER_SECONDS);
      if (stateTime >= RECOVER_SECONDS) setState('fight');
    } else if (state === 'fight') {
      fight(dt);
      stepSwing(dt);
      // 밀려남 (맞았을 때)
      position.x += push.x * dt;
      position.z += push.z * dt;
      push.multiplyScalar(Math.max(0, 1 - dt * 7));
      avoidObstacles();
      position.x = clamp(position.x, area.minX, area.maxX);
      position.z = clamp(position.z, area.minZ, area.maxZ);
      pose.run = runBlend;
      pose.swing = swing >= 0 ? swing / SWING_SECONDS : -1;
      y = Math.abs(Math.sin(runPhase)) * 0.45 * runBlend;
      if (!target || !target.alive) pose.cheer = 0.6 + 0.4 * Math.sin(time * 6); // 이겼다!
    }
    rig.pose(pose);
    place();
  }

  // 인형을 지금 자리·방향·찌그러짐대로 놓음
  function place() {
    fig.root.position.set(position.x, y, position.z);
    fig.root.rotation.y = facing;
    const s = squash * 0.3;
    fig.root.scale.set(HERO_SCALE * (1 + s), HERO_SCALE * (1 - s), HERO_SCALE * (1 + s));
    fig.update();
  }

  const api = {
    team: 'town',
    name: config.name,
    position,
    radius: 1.3,
    height: model.height,
    enter,
    setTarget(next) {
      target = next || null;
    },
    setObstacles(fn) {
      obstacles = fn || null;
    },
    takeDamage,
    update,
    reset,
    dispose() {
      warning?.cancel?.();
      fig.dispose();
      bolt.dispose();
    },
    get alive() {
      return state !== 'away' && state !== 'dead'; // 아직 안 나왔거나 터졌으면 과녁이 아님
    },
    get active() {
      return state !== 'away' && state !== 'dead';
    },
    get state() {
      return state;
    },
    get hp() {
      return health.hp;
    },
    get maxHp() {
      return health.maxHp;
    },
    get airborne() {
      return y > 1.5;
    },
  };
  return api;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function smooth(t) {
  const c = clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
}
