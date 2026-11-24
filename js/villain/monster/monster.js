// 괴수 한 마리 (그림 → 블록 괴수가 되어 걷고, 부수고, 맞고, 터짐)
// 그림은 늘 카메라를 보고 서 있고(종이 인형처럼), 어느 쪽으로든 뒤뚱뒤뚱 걸어갑니다.
// 상대를 정해 주면(command) 알아서 다가가 쓸 수 있는 공격을 골라 씁니다: 뿔 돌진 → 레이저 눈 → 꼬리 철퇴 → 불 뿜기 → 집게발 → 박치기.
// (공격마다 쓰기 알맞은 때는 monsterAttacks.js 의 attackFits: 레이저는 멀거나 한 줄일 때, 꼬리는 둘러싸였거나 영웅일 때)
//
//   const monster = createMonster(scene, design, { debris, fx, events, getTargets?, bounds?, start?, hpMul?, dmgMul?, partDmgMul?, smashMul? })
//       getTargets: () => 상대 목록 (건물·영웅). 주면 불·돌진·집게가 주변 것도 같이 때리고, 길을 막는 건물부터 부숨
//       bounds: { minX, maxX, minZ, maxZ } 걸어 다닐 수 있는 범위 (안 주면 마을 바닥판)
//       start: [x, z] 나타나는 자리 (안 주면 villainConfig 의 town.monsterStart)
//       hpMul / dmgMul / partDmgMul / smashMul: 소굴 효과 배율 (체력, 모든 공격, 부품 공격만, 건물 부수는 힘). 안 주면 1
//   monster.build(초?)            블록이 쏟아져 쌓이며 등장 (끝나면 'monsterBuilt' 소식)
//   monster.isBuilt / alive / hp / maxHp / speed / position / radius / height / team('villain')
//   monster.command(target | null)   노릴 상대 정하기 (null 이면 제자리에서 쉼)
//   monster.setTargets(fn)           getTargets 를 나중에 정하기
//   monster.takeDamage({ amount, from, kind, slow? }) → { dead }
//       slow: { factor, seconds } 얼음에 맞아 그 시간 동안 걷기·공격 준비가 factor 배로 느려짐 (하늘색으로 꽁꽁)
//   monster.slowed / speedNow       지금 느려졌는지 / 지금 걷는 빠르기
//   monster.update(dt) ; monster.dispose()
//   monster.attacks                  지금 쓸 수 있는 공격 이름 목록 (부품이 떨어지면 줄어듦) ; monster.partTypes 처음 붙은 부품 이름 (자동 순서)
//   (C) 직접 조종 (monsterManual.js · raid/monsterControl.js): setManual(참/거짓) 켜면 자동 판단이 쉼, steer({ x, z } | null) 걷기,
//       aimAt(상대) 노릴 것, useAttack(type, mustHit?) → false 면 식는 중 · 부품 없음 · 다른 공격 중, cooldownOf(type) → 0~1, manual, aim
//   monsterStats(design) → { blocks, hp, speed }   화면에 숫자를 보여 줄 때
//
// 보내는 소식: monsterBuilt, attack, hit, blocksBroken(source 'monster'), monsterPopped
//            + monsterStep { position } (발걸음 쿵), buildTick { progress, position } (블록 쌓이는 딸깍), partLost { type, position }
//            + monsterSlowed { position, seconds } (얼음에 맞아 새로 느려졌을 때)
// 체력·빠르기·공격 숫자는 villainConfig.js, 맞을 때 떨어지는 블록 비율 등은 아래 상수에서 바꿉니다.

import * as THREE from '../../lib/three.js';
import { VILLAIN } from '../villainConfig.js';
import { createMonsterFigure } from './monsterFigure.js';
import { createMonsterMotion } from './monsterMotion.js';
import { createBuildRain } from './monsterBuild.js';
import { designStats } from './monsterPower.js';
import { startAttack, attackCooldown, attackFits, idlePart } from './monsterAttacks.js';
import { createManualDrive } from './monsterManual.js';

const POP_SHARE = 0.6; // 체력이 0 이 될 때까지 떨어져 나가는 블록 비율 (나머지는 '펑' 할 때 한꺼번에)
const PART_HOLD = 0.85; // 부품이 붙은 칸은 맨 나중에 떨어짐: 떨어질 블록의 이만큼이 사라질 때까지 버팀 (체력이 약 15% 남을 때 부품이 떨어짐)
const CLOSE_GAP = 0.5; // 상대에게 이만큼 가까워지면 더 다가가지 않음 (칸)
const FLASH_SECONDS = 0.16; // 맞았을 때 하얗게 번쩍이는 시간
const PRIORITY = ['horn', 'laserEye', 'tailMace', 'fireMouth', 'claw']; // 쓸 수 있으면 먼저 쓰는 순서 (마지막은 박치기)
const TICK_GAP = 0.055; // 쌓이는 딸깍 소식 간격 (초)
const CHILL_HEX = '#9FC3E9'; // 느려졌을 때 물드는 색 (연하늘)
const CHILL_TINT = 0.36; // 느려졌을 때 물드는 정도
const CHILL_COOLDOWN = 0.75; // 느려진 동안 공격 준비가 덜 느려지게 (factor 와 1 사이, 0 = factor 그대로)

// (S) 칸 수 대신 '몸집 점수' (두께 · 3D 블록까지 셈, monsterPower.js). 두께를 안 건드린 그림은 예전과 같은 숫자
export function monsterStats(design) {
  const { power, hp, speed } = designStats(design);
  return { blocks: power, hp, speed };
}

export function createMonster(scene, design, options = {}) {
  const { debris = null, fx = null, events = null, bounds = null, start = null } = options;
  let getTargets = options.getTargets || null;
  const mul = (v) => (Number.isFinite(v) && v > 0 ? v : 1);
  const hpMul = mul(options.hpMul);
  const dmgMul = mul(options.dmgMul);
  const partDmgMul = mul(options.partDmgMul);
  const smashMul = mul(options.smashMul);
  const bus = events || { emit() {} };
  const figure = createMonsterFigure(scene, design, { partHold: POP_SHARE * PART_HOLD });
  const { fig, model, mounts } = figure;
  const motion = createMonsterMotion(model);
  const stats = monsterStats(design);
  const town = VILLAIN.town;
  const area = bounds || { minX: -town.width / 2 + 1, maxX: town.width / 2 - 1, minZ: -town.depth / 2 + 1, maxZ: town.depth / 2 - 1 };
  const position = fig.root.position;
  const startAt = Array.isArray(start) ? start : town.monsterStart;
  position.set(startAt[0], 0, startAt[1]);
  fig.setVisible(false); // build() 를 부를 때까지 숨김

  const maxHp = Math.max(1, Math.round(stats.hp * hpMul));
  const popTotal = Math.floor(model.popOrder.length * POP_SHARE);
  const cellLeft = model.cells.map((cell) => cell.count);
  const rz = model.depth / 2 + 0.4; // 앞뒤 반 두께
  let hp = maxHp;
  let popped = 0;
  let alive = true;
  let built = false;
  let rain = null;
  let tickTimer = 0;
  let target = null;
  let action = null;
  let flash = 0;
  let clock = 0;
  let disposed = false;
  let slowLeft = 0; // 얼음으로 느려진 남은 시간
  let slowFactor = 1;

  // 공격 목록: 부품마다 하나 + 박치기
  const attacks = mounts.map((mount, i) => ({ type: mount.type, mount, cd: 0.25 + i * 0.3, range: VILLAIN.parts.types[mount.type].range }));
  attacks.sort((a, b) => PRIORITY.indexOf(a.type) - PRIORITY.indexOf(b.type));
  attacks.push({ type: 'headbutt', mount: null, cd: 0.2, range: VILLAIN.monster.headbutt.range });

  // ── 거리 계산 도우미 ──
  const dirResult = { x: 0, z: 1, dist: 0 };
  function dirTo(other) {
    const dx = other.position.x - position.x;
    const dz = other.position.z - position.z;
    const dist = Math.hypot(dx, dz);
    dirResult.x = dist > 1e-4 ? dx / dist : 0;
    dirResult.z = dist > 1e-4 ? dz / dist : 1;
    dirResult.dist = dist;
    return dirResult;
  }
  // 그 방향으로 몸이 차지하는 거리 (옆으로 넓고 앞뒤로 얇은 타원)
  const extent = (dx, dz) => (model.radius * rz) / Math.hypot(rz * dx, model.radius * dz || 1e-4);
  function gapTo(other) {
    const d = dirTo(other);
    return d.dist - (other.radius || 0) - extent(d.x, d.z);
  }
  function others() {
    const list = (getTargets ? getTargets() : []).filter((t) => t && t !== api && t.alive && t.team !== 'villain');
    if (target && target.alive && !list.includes(target)) list.push(target);
    return list;
  }
  function moveBy(dx, dz) {
    const beforeX = position.x;
    const beforeZ = position.z;
    position.x = Math.min(area.maxX, Math.max(area.minX, position.x + dx));
    position.z = Math.min(area.maxZ, Math.max(area.minZ, position.z + dz));
    return Math.hypot(position.x - beforeX, position.z - beforeZ);
  }
  // 건물을 칠 때는 몸집만큼 더 세게 (큰 괴수가 더 많이 부수고 더 많이 벌게) + 소굴 효과 배율
  const smash = VILLAIN.monster.smashPower;
  const smashScale = (smash ? smash.base + stats.blocks * smash.perBlock : 1) * smashMul;
  function strike(other, hitAmount, kind, point, sparkHex) {
    const base = hitAmount * dmgMul * (kind === 'headbutt' ? 1 : partDmgMul); // 박치기 말고는 부품 공격
    const amount = other.totalBlocks ? base * smashScale : base; // totalBlocks 가 있으면 건물
    const at = point.clone();
    const result = other.takeDamage?.({ amount, from: position.clone(), kind }) || {};
    fx?.hitSpark?.(at, sparkHex);
    bus.emit('hit', { target: other, amount, position: at, kind, dead: !!result.dead });
    return result;
  }
  const ctx = { self: null, position, motion, figure, model, debris, fx, events: bus, dirTo, gapTo, extent, others, moveBy, strike };
  const drive = createManualDrive(ctx, attacks, stats.speed); // (C) 직접 조종
  const partTypes = [...new Set(attacks.filter((attack) => attack.mount).map((attack) => attack.type))];

  // ── 등장: 블록이 쏟아져 쌓임 ──
  function build(seconds = VILLAIN.monster.buildSeconds) {
    if (built || rain || !alive) return;
    if (seconds <= 0 || model.popOrder.length === 0) return finishBuild();
    rain = createBuildRain(scene, model, position, seconds);
  }
  function finishBuild() {
    rain?.dispose();
    rain = null;
    built = true;
    fig.setVisible(true);
    figure.attachAll();
    for (const mount of mounts) mount.pop = 0.0001; // 부품이 뿅 하고 커지며 붙음
    motion.bounce(2.4);
    fx?.dust?.(position, Math.max(0.8, model.radius / 3));
    bus.emit('monsterBuilt', { monster: api });
  }

  // ── 맞기 ──
  function takeDamage({ amount = 0, from = null, kind = '', slow = null } = {}) {
    if (!alive || !built || amount <= 0) return { dead: false };
    if (slow && slow.seconds > 0) chill(slow);
    hp = Math.max(0, hp - amount);
    flash = 1;
    let dx = 0, dz = 0;
    if (from) {
      dx = position.x - from.x;
      dz = position.z - from.z;
      const d = Math.hypot(dx, dz) || 1;
      dx /= d;
      dz /= d;
    }
    motion.flinch(dx, dz, Math.min(1.6, 0.5 + amount / 20));
    motion.bounce(0.5);
    if (hp <= 0) return pop(from);

    // 체력이 준 만큼 겉 블록부터 떨어져 나감
    const shouldBeGone = popTotal - Math.ceil((popTotal * hp) / maxHp);
    const count = shouldBeGone - popped;
    if (count > 0) {
      for (let k = popped; k < popped + count; k++) cellLeft[model.cellOfVoxel[model.popOrder[k].index]]--;
      popped += count;
      const blocks = fig.popBlocks(count);
      debris?.burst(blocks, { from: from || position, power: 7, upward: 8 });
      bus.emit('blocksBroken', { count: blocks.length, source: 'monster', position: position.clone() });
      // 밑의 칸이 사라진 부품은 떨어져 나감 → 그 공격을 잃음
      for (const mount of mounts) {
        if (!mount.attached || cellLeft[mount.cell] > 0) continue;
        debris?.burst(figure.detach(mount), { from: position, power: 8, upward: 11 });
        const index = attacks.findIndex((attack) => attack.mount === mount);
        if (index >= 0) attacks.splice(index, 1);
        bus.emit('partLost', { type: mount.type, position: position.clone(), kind });
      }
    }
    return { dead: false };
  }

  // 얼음: 정해진 시간 동안 느려짐 (더 센 얼음이 오면 그 값으로)
  function chill({ factor = 0.6, seconds = 2 }) {
    const fresh = slowLeft <= 0;
    slowLeft = Math.max(slowLeft, seconds);
    slowFactor = fresh ? factor : Math.min(slowFactor, factor);
    if (fresh) bus.emit('monsterSlowed', { position: position.clone(), seconds, monster: api });
  }

  // '펑!' 남은 블록이 전부 흩어짐
  function pop(from) {
    alive = false;
    action?.cancel?.(); // 레이저 빛 · 바닥 원 같은 남은 효과 지우기
    action = null;
    hp = 0;
    fig.root.updateMatrixWorld(true);
    const blocks = fig.explode();
    debris?.burst(blocks, { from: from ? new THREE.Vector3(from.x, 0, from.z).lerp(position, 0.8) : position, power: 10, upward: 14 });
    fx?.popRing?.(position, Math.min(1.7, Math.max(0.6, model.height / 10)));
    bus.emit('blocksBroken', { count: blocks.length, source: 'monster', position: position.clone() });
    bus.emit('monsterPopped', { monster: api });
    return { dead: true };
  }

  // ── 매 장면 ──
  function update(dt) {
    if (disposed || !alive) return;
    clock += dt;
    if (!built) {
      if (!rain) return;
      const { done, landed } = rain.update(dt);
      tickTimer -= dt;
      if (landed > 0 && tickTimer <= 0) {
        tickTimer = TICK_GAP;
        bus.emit('buildTick', { progress: rain.progress, position });
      }
      if (done) finishBuild();
      else return;
    }
    if (slowLeft > 0) {
      slowLeft = Math.max(0, slowLeft - dt);
      if (slowLeft <= 0) slowFactor = 1;
    }
    const pace = slowLeft > 0 ? slowFactor : 1; // 걷기 빠르기 배율
    const ready = slowLeft > 0 ? slowFactor + (1 - slowFactor) * CHILL_COOLDOWN : 1; // 공격 준비 빠르기 배율
    for (const attack of attacks) attack.cd -= dt * ready;

    let move = null;
    if (action) {
      if (action.update(dt)) action = null;
    } else if (drive.on) {
      motion.relax(dt);
      move = drive.walk(dt, pace); // (C) 직접 조종: 걷기만 (공격은 단추를 누를 때 useAttack)
    } else {
      motion.relax(dt);
      const foe = pickFoe();
      if (foe) {
        const gap = gapTo(foe);
        const ready = attacks.find((attack) => attack.cd <= 0 && gap <= attack.range && attackFits(attack.type, ctx, foe, gap, attacks));
        if (ready) {
          ready.cd = attackCooldown(ready.type);
          action = startAttack(ready.type, ctx, foe, ready.mount);
        } else if (gap > CLOSE_GAP) {
          const d = dirTo(foe);
          const stepLength = Math.min(stats.speed * pace * dt, gap - CLOSE_GAP + 0.01);
          moveBy(d.x * stepLength, d.z * stepLength);
          move = { x: d.x, z: d.z, speed: stats.speed * pace };
          drive.face(d.x, d.z);
        }
      }
    }

    const landed = motion.step(dt, move);
    if (landed) {
      const foot = new THREE.Vector3(position.x + landed * motion.footHalf, 0, position.z);
      fx?.dust?.(foot, 0.55);
      bus.emit('monsterStep', { position: foot });
    }
    animateParts(dt);
    motion.apply(fig.parts.body);
    // 맞으면 하얗게 번쩍, 얼어 있으면 하늘색으로 물듦
    if (flash > 0) flash = Math.max(0, flash - dt / FLASH_SECONDS);
    if (flash > 0.05) fig.setFlash(flash * 0.85);
    else if (slowLeft > 0) fig.setFlash(CHILL_TINT * Math.min(1, slowLeft / 0.4) * (0.85 + 0.15 * Math.sin(clock * 9)), CHILL_HEX);
    else fig.setFlash(0);
    fig.update();
  }

  // 노릴 상대: 정해 준 상대. 가는 길을 다른 건물이 막고 있으면 그것부터
  function pickFoe() {
    if (!target || !target.alive) return null;
    if (!getTargets) return target;
    const want = { ...dirTo(target) };
    let blocker = null;
    let nearest = Infinity;
    for (const other of others()) {
      if (other === target) continue;
      const d = dirTo(other);
      if (d.dist >= want.dist || d.x * want.x + d.z * want.z < 0.5) continue;
      if (gapTo(other) > CLOSE_GAP + 0.3 || d.dist >= nearest) continue;
      nearest = d.dist;
      blocker = other;
    }
    return blocker || target;
  }

  // 부품의 작은 몸짓: 붙을 때 뿅, 평소에는 까딱까딱
  function animateParts(dt) {
    mounts.forEach((mount, i) => {
      if (!mount.attached) return;
      const acting = action && action.type === mount.type && attacks.some((attack) => attack.mount === mount);
      if (mount.pop > 0 && mount.pop < 1) {
        mount.pop = Math.min(1, mount.pop + dt / 0.35);
        const p = mount.pop;
        mount.node.scale.setScalar(p < 0.6 ? (p / 0.6) * 1.5 : 1.5 - ((p - 0.6) / 0.4) * 0.5);
      } else if (!acting) {
        const rest = mount.art.rest;
        if (mount.type === 'claw') mount.node.rotation.z = rest.z + Math.sin(clock * 3.1 + i * 2) * 0.16 * mount.side;
        else if (mount.type === 'fireMouth') mount.node.scale.setScalar(1 + Math.sin(clock * 4 + i) * 0.04);
        else idlePart(mount, clock, i);
      }
    });
  }

  const api = {
    team: 'villain',
    kind: 'monster',
    design,
    position,
    radius: model.radius,
    height: model.height,
    maxHp,
    speed: stats.speed,
    figure,
    build,
    update,
    takeDamage,
    command(next) {
      target = next || null;
    },
    setTargets(fn) {
      getTargets = typeof fn === 'function' ? fn : Array.isArray(fn) ? () => fn : null;
    },
    // (C) 직접 조종 (위 설명 참고). 공격 숫자 · 식는 시간은 자동과 같음
    setManual: (on) => drive.setOn(on),
    steer: (vector) => drive.steer(vector),
    aimAt: (other) => drive.aimAt(other),
    cooldownOf: (type) => drive.cooldownOf(type),
    useAttack(type, mustHit = false) {
      if (!alive || !built || action) return false;
      action = drive.start(type, mustHit); // mustHit: 닿는 상대가 있을 때만
      return !!action;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      action?.cancel?.();
      action = null;
      rain?.dispose();
      figure.dispose();
    },
    get alive() {
      return alive;
    },
    get isBuilt() {
      return built;
    },
    get hp() {
      return hp;
    },
    get target() {
      return target;
    },
    get busy() {
      return !!action;
    },
    get attacks() {
      return attacks.map((attack) => attack.type);
    },
    get slowed() {
      return slowLeft > 0;
    },
    get speedNow() {
      return stats.speed * (slowLeft > 0 ? slowFactor : 1);
    },
    get partTypes() {
      return partTypes;
    },
    get manual() {
      return drive.on;
    },
    get aim() {
      return drive.aim;
    },
  };
  ctx.self = api;
  return api;
}
