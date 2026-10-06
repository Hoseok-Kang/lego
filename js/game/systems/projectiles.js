// 발사체 (화살, 대포알, 얼음)
// 타워가 쏜 발사체가 날아가 몬스터를 맞힙니다. 발사체는 모두 블록 한 개 모양이고, 한 묶음으로 한꺼번에 그립니다.
//   화살   'arrow'       몬스터를 따라가며 살짝 포물선을 그리고, 나는 방향으로 길쭉하게 누워 날아감
//   대포알 'cannonball'  몬스터가 갈 자리를 미리 계산해서 높은 포물선으로 던짐. 떨어진 곳 둘레의 몬스터가 모두 맞음
//   얼음   'ice'         몬스터를 따라가며 빙글빙글 돌고, 맞은 몬스터를 잠깐 느리게 만듦
// 날아가는 중에 몬스터가 쓰러지면, 마지막으로 본 자리까지 날아가서 '퐁' 하고 사라집니다.
// 발사체 색·크기·포물선 높이는 아래 '발사체 모양' 숫자를 바꾸면 됩니다.
//
//   projectiles.fire({ kind, from, target, damage, splashRadius, slow, slowSeconds, speed })   한 발 쏘기
//        kind: 'arrow' | 'cannonball' | 'ice', from: 쏘는 위치, target: 몬스터, speed: 1초에 날아가는 칸 수
//   projectiles.update(dt)    매 장면마다 움직이기
//   projectiles.clear()       모두 지우기 (다시 하기)
//   projectiles.count         지금 날아가는 발사체(+작은 조각) 수

import * as THREE from '../../lib/three.js';
import { createBlockBatch } from '../core/blockAssets.js';

// ── 발사체 모양 ──
// color: 블록 색, size: [가로, 세로, 길이] 크기 배율, arc: 포물선 높이 (날아갈 거리 × 이 값), maxArc: 포물선 최고 높이,
// spin: 1초에 도는 각도 (라디안)
const STYLES = {
  arrow: { color: '#582A12', size: [0.3, 0.3, 1.4], arc: 0.1, maxArc: 1.6, spin: 0 },
  cannonball: { color: '#1B2A34', size: [0.8, 0.8, 0.8], arc: 0.35, maxArc: 12, spin: 7 },
  ice: { color: '#9FC3E9', size: [0.55, 0.55, 0.55], arc: 0.06, maxArc: 1, spin: 12 },
};

// ── 바꿔도 되는 숫자 ──
const CAPACITY = 300; // 한꺼번에 날아다닐 수 있는 발사체 + 작은 조각 수
const SPARK_RESERVE = 60; // 발사체 자리가 모자라지 않게 작은 조각은 이만큼 자리를 남겨 두고 만듦
const HIT_DISTANCE = 0.9; // 몬스터 몸 한가운데에서 이 거리 안에 들어오면 맞음
const MAX_FLIGHT_SECONDS = 4; // 이보다 오래 날면 그냥 사라짐 (안전장치)
const CANNON_MIN_FLIGHT = 0.45; // 대포알이 날아가는 최소 시간 (아주 가까워도 포물선이 보이게)
const CANNON_LAND_Y = 0.4; // 대포알이 땅에 닿는 높이
const CANNON_RUBBLE = 6; // 대포알이 떨어진 곳에서 튀는 회색 블록 수
const CANNON_RUBBLE_COLORS = ['#6C6E68', '#A0A5A9'];
const CANNON_SMOKE = 3; // 대포를 쏠 때 포구에서 나오는 작은 연기 조각 수
const CANNON_SMOKE_COLOR = '#A0A5A9';
const ICE_SHARDS = 3; // 얼음이 맞았을 때 튀는 흰색·하늘색 블록 수
const ICE_SHARD_COLORS = ['#F4F4F4', '#9FC3E9'];
const PUFF_PIECES = 4; // 몬스터가 먼저 쓰러져서 허공에서 사라질 때 '퐁' 조각 수
const PUFF_COLOR = '#F4F4F4';
const SPARK_SECONDS = 0.35; // 작은 조각이 사라지는 데 걸리는 시간
const SPARK_SIZE = 0.3; // 작은 조각 크기 (블록 한 칸 = 1)
const SPARK_SPEED = 3.5; // 작은 조각이 퍼지는 빠르기
const SPARK_GRAVITY = 9; // 작은 조각이 떨어지는 힘
const SHOCKWAVE_SECONDS = 0.35; // 대포알이 떨어진 곳에 퍼지는 동그라미가 사라지는 시간
const SHOCKWAVE_COLOR = '#F4F4F4';
const SHOCKWAVE_OPACITY = 0.6;
const SHOCKWAVE_POOL = 6; // 동시에 보일 수 있는 동그라미 수

const UP = new THREE.Vector3(0, 1, 0);
const ORIGIN = new THREE.Vector3();

export function createProjectileManager({ scene, events, enemies, debris }) {
  const batch = createBlockBatch(CAPACITY, { castShadow: true, receiveShadow: false });
  scene.add(batch.bodies, batch.studs);

  const records = Array.from({ length: CAPACITY }, createRecord);
  let count = 0;
  let colorsDirty = false;

  const colors = {
    arrow: new THREE.Color(STYLES.arrow.color),
    cannonball: new THREE.Color(STYLES.cannonball.color),
    ice: new THREE.Color(STYLES.ice.color),
    puff: new THREE.Color(PUFF_COLOR),
    smoke: new THREE.Color(CANNON_SMOKE_COLOR),
    rubble: CANNON_RUBBLE_COLORS.map((hex) => new THREE.Color(hex)),
    shards: ICE_SHARD_COLORS.map((hex) => new THREE.Color(hex)),
  };

  // 매 장면 재사용하는 값
  const matrix = new THREE.Matrix4();
  const lookMatrix = new THREE.Matrix4();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const toAim = new THREE.Vector3();
  const heading = new THREE.Vector3();
  const hitFrom = new THREE.Vector3();
  const velocity = new THREE.Vector3();
  const spot = new THREE.Vector3();

  const shockwaves = createShockwaves(scene);

  // ── 쏘기 ──
  function fire({ kind, from, target, damage = 0, splashRadius = 0, slow = 0, slowSeconds = 0, speed = 20 } = {}) {
    const style = STYLES[kind];
    if (!style || !from || !target) return false;
    events.emit('projectileFired', { kind, position: from.clone() });
    if (count >= CAPACITY) {
      // 자리가 없으면 그리지 않고 바로 맞힘 (게임 결과는 같게)
      strikeNow(kind, target, damage, splashRadius, slow, slowSeconds);
      return false;
    }
    const r = take(kind, colors[kind]);
    r.style = style;
    r.target = target;
    r.damage = damage;
    r.splashRadius = splashRadius;
    r.slow = slow;
    r.slowSeconds = slowSeconds;
    r.speed = Math.max(1, speed);
    r.position.copy(from);
    randomAxis(r.spinAxis);
    r.angle = Math.random() * Math.PI * 2;
    if (kind === 'cannonball') {
      launchBallistic(r, from, target);
      puff(from, colors.smoke, CANNON_SMOKE, 0.6);
    } else {
      launchHoming(r, from, target);
    }
    return true;
  }

  // 따라가는 발사체 (화살, 얼음): 곧게 따라가는 길(base) 위에 포물선 높이를 더해서 그림
  function launchHoming(r, from, target) {
    r.mode = 'homing';
    r.lost = !isAlive(target);
    r.aim.copy(target.center ?? target.position);
    r.base.copy(from);
    r.previous.copy(from);
    r.traveled = 0;
    const distance = r.base.distanceTo(r.aim);
    r.arc = Math.min(r.style.maxArc, r.style.arc * distance);
    r.direction.subVectors(r.aim, r.base);
    if (r.direction.lengthSq() < 1e-8) r.direction.set(0, 0, 1);
    r.direction.normalize();
  }

  // 대포알: 몬스터가 날아가는 동안 걸어갈 자리를 미리 계산해서 그곳으로 던짐
  function launchBallistic(r, from, target) {
    r.mode = 'ballistic';
    r.start.copy(from);
    const ground = target.position ?? target.center;
    const move = target.velocity;
    let seconds = flightSeconds(r, from, ground.x, ground.z);
    let x = ground.x;
    let z = ground.z;
    for (let i = 0; i < 2 && move; i++) {
      x = ground.x + move.x * seconds;
      z = ground.z + move.z * seconds;
      seconds = flightSeconds(r, from, x, z);
    }
    r.end.set(x, CANNON_LAND_Y, z);
    r.duration = seconds;
    r.time = 0;
    r.arc = Math.min(r.style.maxArc, r.style.arc * Math.hypot(x - from.x, z - from.z));
  }

  function flightSeconds(r, from, x, z) {
    return Math.max(CANNON_MIN_FLIGHT, Math.hypot(x - from.x, z - from.z) / r.speed);
  }

  // ── 매 장면마다 ──
  let lastDrawn = 0;
  function update(dt) {
    let i = 0;
    while (i < count) {
      const r = records[i];
      const keep = r.mode === 'homing' ? stepHoming(r, dt) : r.mode === 'ballistic' ? stepBallistic(r, dt) : stepSpark(r, dt);
      if (!keep) {
        removeAt(i);
        continue;
      }
      draw(i, r);
      i++;
    }
    shockwaves.update(dt);
    if (count === 0 && lastDrawn === 0) return; // 날아가는 게 없으면 그래픽 카드로 보낼 것도 없음
    lastDrawn = count;
    const mesh = batch.bodies; // 몸통과 돌기가 한 덩어리
    mesh.count = count;
    mesh.visible = count > 0;
    mesh.instanceMatrix.needsUpdate = true;
    if (colorsDirty) {
      for (let k = 0; k < count; k++) mesh.setColorAt(k, records[k].color);
      mesh.instanceColor.needsUpdate = true;
      colorsDirty = false;
    }
  }

  // 따라가기: 몬스터가 살아 있으면 지금 위치를, 쓰러졌으면 마지막으로 본 위치를 향해 날아감
  function stepHoming(r, dt) {
    if (!r.lost) {
      if (isAlive(r.target)) r.aim.copy(r.target.center);
      else r.lost = true;
    }
    r.age += dt;
    toAim.subVectors(r.aim, r.base);
    const remaining = toAim.length();
    const step = r.speed * dt;
    if (r.lost ? remaining <= step + 0.05 : remaining <= Math.max(HIT_DISTANCE, step)) {
      if (r.lost) {
        puff(r.aim, colors.puff, PUFF_PIECES, 1);
      } else {
        r.position.copy(r.aim);
        hitTarget(r);
      }
      return false;
    }
    if (r.age > MAX_FLIGHT_SECONDS) {
      puff(r.position, colors.puff, PUFF_PIECES, 1);
      return false;
    }
    r.base.addScaledVector(toAim, step / remaining);
    r.traveled += step;
    const u = r.traveled / (r.traveled + remaining - step); // 0 = 막 쏨, 1 = 도착
    r.previous.copy(r.position);
    r.position.copy(r.base);
    r.position.y += r.arc * 4 * u * (1 - u);
    heading.subVectors(r.position, r.previous);
    if (heading.lengthSq() > 1e-8) r.direction.copy(heading).normalize();
    r.angle += r.style.spin * dt;
    return true;
  }

  // 대포알: 정해진 포물선을 따라 날아가서 땅에 닿으면 둘레를 모두 때림
  function stepBallistic(r, dt) {
    r.time += dt;
    const u = Math.min(1, r.time / r.duration);
    r.position.lerpVectors(r.start, r.end, u);
    r.position.y += r.arc * 4 * u * (1 - u);
    r.angle += r.style.spin * dt;
    if (u < 1) return true;
    land(r);
    return false;
  }

  // 작은 조각 (연기, 퐁): 퍼지면서 작아지다 사라짐
  function stepSpark(r, dt) {
    r.age += dt;
    if (r.age >= r.life) return false;
    r.velocity.y -= SPARK_GRAVITY * dt;
    r.position.addScaledVector(r.velocity, dt);
    r.angle += r.spin * dt;
    return true;
  }

  // ── 맞았을 때 ──
  function hitTarget(r) {
    // 맞은 블록이 화살이 날아온 방향으로 튀도록, 조금 뒤쪽을 '맞은 쪽'으로 알려 줌
    hitFrom.copy(r.position).addScaledVector(r.direction, -1.5);
    if (r.kind === 'ice') {
      enemies.damage(r.target, r.damage, { slow: r.slow, slowSeconds: r.slowSeconds, from: hitFrom });
      shards(r.position);
    } else {
      enemies.damage(r.target, r.damage, { from: hitFrom });
    }
    events.emit('projectileHit', { kind: r.kind, position: r.position.clone() });
  }

  function land(r) {
    const point = r.end.clone();
    enemies.damageArea(point, r.splashRadius, r.damage, { from: point });
    rubble(point);
    shockwaves.start(point, r.splashRadius);
    events.emit('projectileHit', { kind: r.kind, position: point.clone() });
  }

  // 자리가 모자랄 때: 날아가는 모습 없이 바로 맞힘
  function strikeNow(kind, target, damage, splashRadius, slow, slowSeconds) {
    if (!isAlive(target)) return;
    if (kind === 'cannonball') {
      const point = (target.position ?? target.center).clone();
      enemies.damageArea(point, splashRadius, damage, { from: point });
      events.emit('projectileHit', { kind, position: point });
      return;
    }
    if (kind === 'ice') enemies.damage(target, damage, { slow, slowSeconds });
    else enemies.damage(target, damage);
    events.emit('projectileHit', { kind, position: target.center.clone() });
  }

  // 대포알이 떨어진 곳에서 회색 블록이 튐 (부서진 조각 모듈 사용)
  function rubble(point) {
    for (let k = 0; k < CANNON_RUBBLE; k++) {
      const angle = (k / CANNON_RUBBLE) * Math.PI * 2 + Math.random() * 0.8;
      const push = 3 + Math.random() * 3;
      spot.set(point.x + Math.cos(angle) * 0.6, 0.5, point.z + Math.sin(angle) * 0.6);
      velocity.set(Math.cos(angle) * push, 6 + Math.random() * 4, Math.sin(angle) * push);
      debris.spawn(spot, colors.rubble[k % colors.rubble.length], velocity);
    }
  }

  // 얼음이 맞은 곳에서 흰색·하늘색 블록이 튐
  function shards(point) {
    for (let k = 0; k < ICE_SHARDS; k++) {
      velocity.set((Math.random() - 0.5) * 5, 3 + Math.random() * 3, (Math.random() - 0.5) * 5);
      debris.spawn(point, colors.shards[k % colors.shards.length], velocity);
    }
  }

  // 작은 조각 여러 개를 퐁 하고 흩뿌림 (발사체 묶음에 같이 그림)
  function puff(point, color, pieces, sizeScale) {
    for (let k = 0; k < pieces; k++) {
      if (count >= CAPACITY - SPARK_RESERVE) return;
      const r = take('spark', color);
      r.mode = 'spark';
      r.position.copy(point);
      randomAxis(r.velocity).multiplyScalar(SPARK_SPEED * (0.6 + Math.random() * 0.6));
      r.velocity.y = Math.abs(r.velocity.y) + 1;
      randomAxis(r.spinAxis);
      r.angle = Math.random() * Math.PI;
      r.spin = (Math.random() - 0.5) * 16;
      r.life = SPARK_SECONDS * (0.7 + Math.random() * 0.6);
      r.size = SPARK_SIZE * sizeScale;
    }
  }

  // ── 그리기 ──
  function draw(slot, r) {
    if (r.mode === 'spark') {
      const s = r.size * (1 - r.age / r.life);
      rotation.setFromAxisAngle(r.spinAxis, r.angle);
      scale.set(s, s, s);
    } else if (r.kind === 'arrow') {
      // 나는 방향으로 길쭉하게 눕힘 (돌기는 위쪽)
      lookMatrix.lookAt(r.direction, ORIGIN, UP);
      rotation.setFromRotationMatrix(lookMatrix);
      scale.set(r.style.size[0], r.style.size[1], r.style.size[2]);
    } else {
      rotation.setFromAxisAngle(r.spinAxis, r.angle);
      scale.set(r.style.size[0], r.style.size[1], r.style.size[2]);
    }
    matrix.compose(r.position, rotation, scale);
    batch.bodies.setMatrixAt(slot, matrix);
    batch.studs.setMatrixAt(slot, matrix);
  }

  // ── 묶음 칸 관리 ──
  function take(kind, color) {
    const r = records[count];
    resetRecord(r);
    r.kind = kind;
    r.color = color;
    batch.bodies.setColorAt(count, color);
    batch.studs.setColorAt(count, color);
    batch.bodies.instanceColor.needsUpdate = true;
    batch.studs.instanceColor.needsUpdate = true;
    count++;
    return r;
  }

  // i번째를 지우고 맨 끝 것을 그 자리로 옮김 (빈칸 없이)
  function removeAt(i) {
    const last = count - 1;
    if (i !== last) {
      const removed = records[i];
      records[i] = records[last];
      records[last] = removed;
      colorsDirty = true;
    }
    records[last].target = null;
    count = last;
  }

  function clear() {
    for (let i = 0; i < count; i++) records[i].target = null;
    count = 0;
    batch.bodies.count = 0;
    batch.studs.count = 0;
    shockwaves.clear();
  }

  // ── 대포알이 떨어진 곳에 퍼지는 동그라미 (맞는 범위를 보여 줌) ──
  function createShockwaves(parent) {
    const geometry = new THREE.RingGeometry(0.72, 1, 48).rotateX(-Math.PI / 2);
    const pool = [];
    for (let k = 0; k < SHOCKWAVE_POOL; k++) {
      const mesh = new THREE.Mesh(
        geometry,
        new THREE.MeshBasicMaterial({ color: SHOCKWAVE_COLOR, transparent: true, opacity: 0, depthWrite: false }),
      );
      mesh.visible = false;
      mesh.renderOrder = 3;
      parent.add(mesh);
      pool.push({ mesh, time: 0, radius: 1 });
    }
    let next = 0;
    return {
      start(point, radius) {
        if (!(radius > 0)) return;
        const wave = pool[next];
        next = (next + 1) % pool.length;
        wave.time = 0;
        wave.radius = radius;
        wave.mesh.position.set(point.x, 0.22, point.z);
        wave.mesh.visible = true;
      },
      update(dt) {
        for (const wave of pool) {
          if (!wave.mesh.visible) continue;
          wave.time += dt;
          const t = wave.time / SHOCKWAVE_SECONDS;
          if (t >= 1) {
            wave.mesh.visible = false;
            continue;
          }
          const grow = wave.radius * (0.35 + 0.65 * (1 - (1 - t) * (1 - t)));
          wave.mesh.scale.set(grow, 1, grow);
          wave.mesh.material.opacity = SHOCKWAVE_OPACITY * (1 - t);
        }
      },
      clear() {
        for (const wave of pool) wave.mesh.visible = false;
      },
    };
  }

  return {
    fire,
    update,
    clear,
    get count() {
      return count;
    },
  };
}

function isAlive(enemy) {
  return Boolean(enemy) && enemy.alive !== false && enemy.state !== 'dead';
}

function randomAxis(out) {
  out.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5);
  if (out.lengthSq() < 1e-6) out.set(0, 1, 0);
  return out.normalize();
}

// 발사체 하나의 정보 (미리 만들어 두고 계속 다시 씀)
function createRecord() {
  return {
    kind: 'arrow',
    mode: 'homing', // 'homing'(따라가기) | 'ballistic'(포물선) | 'spark'(작은 조각)
    style: null,
    color: null,
    target: null,
    damage: 0,
    splashRadius: 0,
    slow: 0,
    slowSeconds: 0,
    speed: 0,
    position: new THREE.Vector3(), // 그리는 위치
    previous: new THREE.Vector3(),
    base: new THREE.Vector3(), // 따라가기: 포물선 높이를 빼고 곧게 따라가는 위치
    aim: new THREE.Vector3(), // 따라가기: 향하는 곳 (몬스터가 쓰러지면 마지막으로 본 곳)
    direction: new THREE.Vector3(0, 0, 1),
    start: new THREE.Vector3(),
    end: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
    spinAxis: new THREE.Vector3(0, 1, 0),
    angle: 0,
    spin: 0,
    arc: 0,
    traveled: 0,
    time: 0,
    duration: 1,
    age: 0,
    life: 1,
    size: 1,
    lost: false,
  };
}

function resetRecord(r) {
  r.target = null;
  r.style = null;
  r.age = 0;
  r.time = 0;
  r.traveled = 0;
  r.lost = false;
  r.spin = 0;
  r.arc = 0;
}
