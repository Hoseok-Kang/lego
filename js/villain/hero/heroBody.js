// 영웅 공통 몸 (번개 기사·얼음 마법사·황금 수호자가 같이 씀)
// 하늘에서 빛줄기와 함께 떨어지는 등장, 착지 충격, 맞으면 번쩍·움찔·밀려남, 체력만큼 블록이 조금씩 떨어지다 0 이면 '펑'.
// 영웅마다 다른 싸움 방식(쫓아가기·거리 두기·방패 들기)은 각 영웅 파일이 맡고, 여기 도구를 가져다 씁니다.
//
//   const body = createHeroBody(scene, { model, scale, stats, hpMul, weapons, popExtra, radius, beam, debris, fx, events, bounds, obstacles })
//       model: 그림 설계도 { parts, parents, popOrder, height },  weapons: [{ name, voxels, parent, pivot, at }] 손에 드는 것
//       stats: 영웅 숫자 (maxHp 등),  hpMul: 체력 배율 (소굴의 함정 효과, 1 = 그대로),  beam: 등장 빛줄기 색 { core, glow, width }
//   body.fig / rig 가 쓸 값: position, facing, y, state, stateTime, time, target, flash, hurtLevel, squash
//   body.enter(at) ; body.reset() ; body.setState(이름)
//   body.begin(dt) → false 면 이번 장면은 쉼 (아직 안 나왔거나 터짐)
//   body.entrance(dt, pose) → 떨어지는 중·착지 중이면 true (자세 값을 대신 채움)
//   body.gapTo(상대) ; body.turnTo(x, z, dt, 빠르기?) ; body.strike(피해, kind, { color, slow, target? })   상대를 때림 (안 주면 지금 상대)
//   body.hurt({ amount, from, flashHex }) → { dead }    (방패처럼 피해를 줄이는 계산은 각 영웅이 먼저 하고 넘김)
//   body.settle(dt, 미끄러짐)    밀려남 + 건물 피해 가기 + 바닥판 안으로
//   body.landFx('enter' | 'leap' | 'slam') ; body.place(크기배율?) ; body.dispose()
//   body.alive / hp / maxHp / airborne
//
// 보내는 소식: heroArrived { hero }, heroLanded { position, kind }, hit, blocksBroken { source: 'hero' }, heroPopped { hero }
// 떨어지는 높이·시간, 밀려나는 세기 같은 느낌 숫자는 아래 상수에서 바꿉니다.

import * as THREE from '../../lib/three.js';
import { VILLAIN } from '../villainConfig.js';
import { createVoxelFigure } from '../../fight/render/voxelFigure.js';
import { createHealth } from '../../fight/combat/health.js';
import { createBolt } from './heroBolt.js';

const DROP_HEIGHT = 42; // 등장할 때 떨어지기 시작하는 높이 (칸)
const DROP_SECONDS = 0.5; // 떨어지는 시간
const LAND_SECONDS = 0.55; // 착지해서 웅크렸다 일어나는 시간
const CHEER_SECONDS = 0.5; // 무기를 번쩍 드는 시간
const KNOCKBACK = 7; // 맞았을 때 밀려나는 빠르기
const FLASH_SECONDS = 0.16; // 맞았을 때 번쩍이는 시간
const TURN_SPEED = 12; // 몸을 돌리는 빠르기

export function createHeroBody(scene, options) {
  const { model, scale = 0.5, stats, hpMul = 1, weapons = [], popExtra = 14, radius = 1.3, beam = {} } = options;
  const { debris = null, fx = null, events = null, bounds = null } = options;
  const town = VILLAIN.town;
  const area = bounds || { minX: -town.width / 2 + 1, maxX: town.width / 2 - 1, minZ: -town.depth / 2 + 1, maxZ: town.depth / 2 - 1 };
  const fig = createVoxelFigure(scene, model, { scale, parents: model.parents });
  for (const w of weapons) fig.addPart(w.name, w.voxels, { parent: w.parent, pivot: w.pivot, at: w.at });
  fig.setVisible(false);
  const bolt = createBolt(scene, beam);
  const maxHp = Math.max(1, Math.round(stats.maxHp * (hpMul > 0 ? hpMul : 1)));
  const health = createHealth({ maxHp, popTotal: Math.min(fig.popTotal + popExtra, fig.totalCount) });
  const tmp = new THREE.Vector3();
  const push = new THREE.Vector3();
  let flashHex = '#FFFFFF';

  const body = {
    fig,
    area,
    scale,
    radius,
    position: new THREE.Vector3(), // 바닥 점 (과녁 위치)
    facing: Math.PI / 2,
    y: 0, // 발 높이
    state: 'away', // away | drop | land | dead | (영웅마다 다른 상태)
    stateTime: 0,
    time: 0,
    target: null,
    obstacles: options.obstacles || null,
    flash: 0,
    hurtLevel: 0,
    squash: 0,
    warning: null,
    api: null, // 영웅 파일이 만든 바깥 모습 (소식에 실어 보냄)
    emit: (name, payload) => events?.emit(name, payload),
    setState(next) {
      body.state = next;
      body.stateTime = 0;
    },
    get alive() {
      return body.state !== 'away' && body.state !== 'dead';
    },
    get hp() {
      return health.hp;
    },
    maxHp,
    get airborne() {
      return body.y > 1.5;
    },

    enter(at) {
      body.reset();
      body.position.set(clamp(at.x, area.minX, area.maxX), 0, clamp(at.z, area.minZ, area.maxZ));
      body.avoidObstacles(); // 건물 지붕 위가 아니라 옆 빈 땅에 내려앉게
      body.y = DROP_HEIGHT;
      fig.setVisible(true);
      body.warning = fx?.telegraph?.(body.position, 3.2, DROP_SECONDS) || null;
      bolt.strike(body.position, DROP_SECONDS + 0.25);
      if (body.target) body.facing = Math.atan2(body.target.position.x - body.position.x, body.target.position.z - body.position.z);
      body.setState('drop');
      body.place();
    },

    reset() {
      body.warning?.cancel?.();
      body.warning = null;
      fig.reset();
      fig.setFlash(0);
      fig.setVisible(false);
      health.reset();
      push.set(0, 0, 0);
      body.flash = body.hurtLevel = body.squash = 0;
      body.y = 0;
      body.setState('away');
    },

    begin(dt) {
      bolt.update(dt);
      if (body.state === 'away') return false;
      body.time += dt;
      body.stateTime += dt;
      body.flash = Math.max(0, body.flash - dt);
      body.hurtLevel = Math.max(0, body.hurtLevel - dt * 4);
      body.squash = Math.max(0, body.squash - dt * 5);
      if (body.state === 'dead') return false;
      fig.setFlash(body.flash > 0 ? Math.min(1, body.flash / FLASH_SECONDS) : 0, flashHex);
      return true;
    },

    // 떨어지기 → 착지해서 웅크림 → 무기 번쩍 (끝나면 'fight')
    entrance(dt, pose) {
      if (body.state === 'drop') {
        const p = Math.min(1, body.stateTime / DROP_SECONDS);
        body.y = DROP_HEIGHT * (1 - p * p);
        pose.fall = 1;
        if (p >= 1) {
          body.y = 0;
          body.warning = null;
          body.landFx('enter');
          body.setState('land');
          body.emit('heroArrived', { hero: body.api });
        }
        return true;
      }
      if (body.state === 'land') {
        const total = LAND_SECONDS + CHEER_SECONDS;
        const t = body.stateTime;
        pose.crouch = t < LAND_SECONDS ? 1 - smooth(Math.max(0, t / LAND_SECONDS - 0.45) / 0.55) : 0;
        pose.cheer = t > LAND_SECONDS * 0.7 ? Math.sin(Math.min(1, (t - LAND_SECONDS * 0.7) / (total - LAND_SECONDS * 0.7)) * Math.PI) : 0;
        if (t >= total) body.setState('fight');
        return true;
      }
      return false;
    },

    // 착지 충격: 고리 + 먼지 + 번쩍
    landFx(kind) {
      body.squash = 1;
      const big = kind === 'enter' || kind === 'slam';
      fx?.popRing?.(body.position, big ? 0.75 : 0.5);
      fx?.dust?.(body.position, big ? 1.3 : 1);
      if (kind === 'enter') bolt.strike(body.position, 0.22);
      body.emit('heroLanded', { position: body.position.clone(), kind });
    },

    gapTo(other) {
      return Math.hypot(other.position.x - body.position.x, other.position.z - body.position.z) - (other.radius || 0) - radius;
    },

    turnTo(x, z, dt, speed = TURN_SPEED) {
      const want = Math.atan2(x - body.position.x, z - body.position.z);
      body.facing += Math.atan2(Math.sin(want - body.facing), Math.cos(want - body.facing)) * Math.min(1, dt * speed);
    },

    // 지금 상대를 때림 (맞은 자리에 불티)
    strike(amount, kind, { color = '#FFF03A', slow = null, from = null, target: who = null } = {}) {
      const target = who || body.target;
      if (!target || !target.alive) return {};
      const src = from || body.position;
      const dx = src.x - target.position.x;
      const dz = src.z - target.position.z;
      const d = Math.hypot(dx, dz) || 1;
      const reach = (target.radius || 1) * 0.7;
      const at = new THREE.Vector3(target.position.x + (dx / d) * reach, Math.min(3, (target.height || 4) * 0.4), target.position.z + (dz / d) * reach);
      const result = target.takeDamage?.({ amount, from: body.position.clone(), kind, slow }) || {};
      fx?.hitSpark?.(at, color);
      body.emit('hit', { target, amount, position: at, kind, dead: !!result.dead });
      return result;
    },

    // 피해 받기: 번쩍 + 움찔 + 밀려남, 체력만큼 블록이 떨어짐, 0 이면 '펑'
    hurt({ amount = 0, from = null, flashHex: hex = '#FFFFFF', knock = 1 } = {}) {
      if (!body.alive || body.state === 'drop' || amount <= 0) return { dead: false };
      const { popped, dead } = health.damage(amount);
      body.flash = FLASH_SECONDS;
      flashHex = hex;
      body.hurtLevel = 1;
      if (from) {
        tmp.set(body.position.x - from.x, 0, body.position.z - from.z);
        if (tmp.lengthSq() < 1e-4) tmp.set(1, 0, 0);
        push.copy(tmp.normalize().multiplyScalar(KNOCKBACK * knock));
      }
      const at = new THREE.Vector3(body.position.x, body.y + 3, body.position.z);
      const fromAt = from ? new THREE.Vector3(from.x, 2, from.z) : null;
      if (dead) {
        const blocks = fig.explode();
        debris?.burst(blocks, { from: fromAt, power: 9, upward: 11, scale });
        fx?.popRing?.(body.position, 0.8 * Math.max(1, scale * 2));
        body.warning?.cancel?.();
        body.warning = null;
        body.setState('dead');
        body.emit('blocksBroken', { count: blocks.length, source: 'hero', position: at });
        body.emit('heroPopped', { hero: body.api });
        return { dead: true };
      }
      if (popped > 0) {
        const blocks = fig.popBlocks(popped);
        debris?.burst(blocks, { from: fromAt, power: 6, upward: 8, scale });
        if (blocks.length) body.emit('blocksBroken', { count: blocks.length, source: 'hero', position: at });
      }
      return { dead: false };
    },

    // 밀려남 + 건물 피하기 + 바닥판 안으로
    settle(dt, slide = 0) {
      body.position.x += push.x * dt;
      body.position.z += push.z * dt;
      push.multiplyScalar(Math.max(0, 1 - dt * 7));
      body.avoidObstacles(slide);
      body.position.x = clamp(body.position.x, area.minX, area.maxX);
      body.position.z = clamp(body.position.z, area.minZ, area.maxZ);
    },

    avoidObstacles(slide = 0) {
      const { position, target } = body;
      for (const o of body.obstacles ? body.obstacles() : []) {
        if (!o || !o.alive || o === target) continue;
        let dx = position.x - o.position.x;
        let dz = position.z - o.position.z;
        if (Math.abs(dx) + Math.abs(dz) < 1e-3) dz = 1; // 딱 한가운데면 앞쪽(카메라 쪽)으로 밀어냄
        const d = Math.hypot(dx, dz);
        const min = (o.radius || 0) + radius + 0.3;
        if (d >= min) continue;
        position.x = o.position.x + (dx / d) * min;
        position.z = o.position.z + (dz / d) * min;
        // 건물 뒤에 끼지 않게, 상대가 있는 쪽으로 벽을 따라 미끄러짐
        if (target && slide > 0) {
          const side = (-dz / d) * (target.position.x - position.x) + (dx / d) * (target.position.z - position.z) >= 0 ? 1 : -1;
          position.x += (-dz / d) * side * slide;
          position.z += (dx / d) * side * slide;
        }
      }
    },

    // 인형을 지금 자리·방향·찌그러짐대로 놓음
    place(grow = 1) {
      fig.root.position.set(body.position.x, body.y, body.position.z);
      fig.root.rotation.y = body.facing;
      const s = body.squash * 0.3;
      const k = scale * grow;
      fig.root.scale.set(k * (1 + s), k * (1 - s), k * (1 + s));
      fig.update();
    },

    dispose() {
      body.warning?.cancel?.();
      fig.dispose();
      bolt.dispose();
    },
  };
  return body;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function smooth(t) {
  const c = clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
}
