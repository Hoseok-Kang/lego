// 당근 (먹으면 체력 회복 + 터졌던 귀 블록이 다시 쌓임)
// 미친토끼가 터지거나 상자가 부서지면 당근이 '톡' 튀어나와 통통 튀고, 바닥 위에 둥실 떠서 빙글 돕니다.
// 내 토끼가 가까이 오면 입으로 쏙 빨려 들어가며 먹힙니다. (체력이 가득이면 먹지 않고 남겨 둠)
// 당근 모양은 propArt.js 의 'carrot' (블록), 발밑에는 노랗게 빛나는 동그라미.
//
//   const pickups = createPickups(scene, { events, collision, fx })   collision·fx 는 없어도 됨
//   pickups.spawn(x, z, { pop = true }) → 당근    pop: 튀어나오는 모션 (false 면 처음부터 제자리)
//   pickups.update(dt, player)                     매 장면 (player: 내 토끼 fighter, 먹기 검사)
//   pickups.clear()                                (다시 하기)
//   pickups.list                                   지금 있는 당근 [{ id, position, state }]
//
// 소식: carrotSpawned { carrot, position }, carrotEaten { position, healed }
// 회복량·먹는 거리는 fightConfig.js 의 carrots 에서 바꿉니다. 아래는 모양(보이는 느낌) 숫자.

import * as THREE from '../../lib/three.js';
import { FIGHT } from '../fightConfig.js';
import { createBlockBatch } from '../../game/core/blockAssets.js';
import { createPropModel } from '../art/propArt.js';

const MAX_CARROTS = 24; // 동시에 있을 수 있는 당근 수
const CARROT_SCALE = 0.8; // 당근 크기
const FLOAT_HEIGHT = 0.9; // 바닥에서 떠 있는 높이
const BOB_HEIGHT = 0.7; // 둥실둥실 위아래 크기
const BOB_SPEED = 3.4; // 둥실 빠르기
const SPIN_SPEED = 1.9; // 빙글 도는 빠르기 (라디안/초)
const WOBBLE = 0.16; // 살랑 기울어지는 각도
const POP_START = 3; // 튀어나올 때 시작 높이
const POP_UP = 17; // 튀어오르는 빠르기
const POP_GRAVITY = 60;
const POP_SIDE = 3.5; // 튀어나가는 옆 거리 (대략)
const POP_SPIN = 9; // 튀어나올 때 빙글 도는 빠르기
const BOUNCE = 0.42; // 땅에 닿으면 이만큼 다시 튐
const SQUASH = 0.35; // 땅에 닿을 때 납작해지는 정도
const EAT_DELAY = 0.35; // 튀어나온 뒤 이 시간이 지나야 먹을 수 있음
const SUCK_SECONDS = 0.18; // 먹힐 때 입으로 빨려 들어가는 시간
const MOUTH_HEIGHT = 7; // 내 토끼 입 높이
const GLOW_HEX = '#FFF03A'; // 발밑 빛 색 (연노랑)
const GLOW_RADIUS = 2.1;
const GLOW_OPACITY = 0.38;
const GLOW_Y = 0.22; // 바닥 돌기 위로 살짝

export function createPickups(scene, { events, collision = null, fx = null } = {}) {
  const model = createPropModel('carrot', 'upright');
  const voxels = model.voxels;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const v of voxels) {
    minY = Math.min(minY, v.y - 0.5);
    maxY = Math.max(maxY, v.y + 0.5);
  }
  const middle = (minY + maxY) / 2; // 당근 가운데를 중심으로 돌림
  const lift = (middle - minY) * CARROT_SCALE; // 가운데가 바닥에서 떠야 하는 높이
  const local = voxels.map((v) => new THREE.Matrix4().makeTranslation(v.x, v.y - middle, v.z));

  const batch = createBlockBatch(MAX_CARROTS * voxels.length, { castShadow: true, receiveShadow: true });
  const mesh = batch.bodies;
  mesh.name = 'carrots';
  scene.add(mesh);
  const color = new THREE.Color();
  for (let i = 0; i < MAX_CARROTS; i++) {
    for (let j = 0; j < voxels.length; j++) mesh.setColorAt(i * voxels.length + j, color.set(voxels[j].hex));
  }
  mesh.instanceColor.needsUpdate = true;

  const glowGeometry = new THREE.CircleGeometry(1, 24);
  glowGeometry.rotateX(-Math.PI / 2);
  const glow = new THREE.InstancedMesh(
    glowGeometry,
    new THREE.MeshBasicMaterial({ color: GLOW_HEX, transparent: true, opacity: GLOW_OPACITY, depthWrite: false, toneMapped: false }),
    MAX_CARROTS,
  );
  glow.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  glow.frustumCulled = false;
  glow.count = 0;
  glow.renderOrder = 1;
  glow.name = 'carrotGlow';
  scene.add(glow);

  const records = Array.from({ length: MAX_CARROTS }, (_, i) => ({
    id: i,
    active: false,
    state: 'idle', // 'pop' 튀어나오는 중 | 'idle' 둥실 | 'eaten' 먹히는 중
    position: new THREE.Vector3(),
    height: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    age: 0,
    spin: 0,
    squash: 0,
    suck: 0,
    from: new THREE.Vector3(),
  }));
  const list = [];
  let nextId = 1;

  const matrix = new THREE.Matrix4();
  const carrotMatrix = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const at = new THREE.Vector3();
  const size = new THREE.Vector3();
  const mouth = new THREE.Vector3();
  let drawn = 0;

  function spawn(x, z, { pop = true } = {}) {
    let r = records.find((record) => !record.active);
    if (!r) r = list.shift(); // 가득 차면 가장 오래된 당근을 다시 씀
    if (!r) return null;
    r.active = true;
    r.id = nextId++;
    r.position.set(x, 0, z);
    r.age = 0;
    r.spin = Math.random() * Math.PI * 2;
    r.squash = 0;
    r.suck = 0;
    if (pop) {
      r.state = 'pop';
      r.height = POP_START;
      r.vy = POP_UP;
      const angle = Math.random() * Math.PI * 2;
      const air = (2 * POP_UP) / POP_GRAVITY;
      r.vx = (Math.sin(angle) * POP_SIDE) / air;
      r.vz = (Math.cos(angle) * POP_SIDE) / air;
    } else {
      r.state = 'idle';
      r.height = FLOAT_HEIGHT;
      r.vx = r.vy = r.vz = 0;
      r.age = EAT_DELAY + Math.random() * 3; // 둥실 박자를 당근마다 다르게
    }
    if (!list.includes(r)) list.push(r);
    events?.emit('carrotSpawned', { carrot: r, position: r.position.clone() });
    return r;
  }

  function update(dt, player = null) {
    for (let i = list.length - 1; i >= 0; i--) {
      const r = list[i];
      r.age += dt;
      r.squash = Math.max(0, r.squash - dt * 5);
      if (r.state === 'pop') stepPop(r, dt);
      else if (r.state === 'idle') {
        r.spin += SPIN_SPEED * dt;
        r.height = FLOAT_HEIGHT + BOB_HEIGHT * (0.5 + 0.5 * Math.sin(r.age * BOB_SPEED));
      } else if (r.state === 'eaten') {
        r.suck += dt / SUCK_SECONDS;
        r.spin += POP_SPIN * dt;
        if (r.suck >= 1) {
          r.active = false;
          list.splice(i, 1);
          continue;
        }
      }
      if (r.state !== 'eaten' && canEat(r, player)) eat(r, player);
    }
    draw(player);
  }

  // 튀어나오기: 포물선 + 통통 튀기
  function stepPop(r, dt) {
    r.spin += POP_SPIN * dt;
    r.vy -= POP_GRAVITY * dt;
    r.height += r.vy * dt;
    const nx = r.position.x + r.vx * dt;
    const nz = r.position.z + r.vz * dt;
    if (collision && collision.overlapsCircle(nx, nz, 1)) {
      r.vx = r.vz = 0; // 벽·상자 쪽으로는 안 감
    } else {
      r.position.x = nx;
      r.position.z = nz;
    }
    if (r.height <= FLOAT_HEIGHT && r.vy < 0) {
      r.height = FLOAT_HEIGHT;
      r.squash = 1;
      if (-r.vy > POP_UP * 0.3) {
        r.vy = -r.vy * BOUNCE;
        r.vx *= 0.5;
        r.vz *= 0.5;
        fx?.dust?.(r.position, 0.45);
      } else {
        r.state = 'idle';
        r.age = (1.5 * Math.PI) / BOB_SPEED; // 둥실 박자를 가장 낮은 곳부터 (끊김 없이)
        r.vx = r.vy = r.vz = 0;
      }
    }
  }

  function canEat(r, player) {
    if (!player || !player.alive || r.age < EAT_DELAY) return false;
    const health = player.health;
    if (health && health.hp >= health.maxHp) return false; // 체력이 가득이면 남겨 둠
    const reach = FIGHT.carrots.radius + (player.radius || 0);
    return Math.hypot(player.position.x - r.position.x, player.position.z - r.position.z) <= reach;
  }

  function eat(r, player) {
    const before = player.health ? player.health.hp : 0;
    player.heal(FIGHT.carrots.heal);
    const healed = player.health ? player.health.hp - before : FIGHT.carrots.heal;
    r.state = 'eaten';
    r.suck = 0;
    r.from.set(r.position.x, r.height, r.position.z);
    events?.emit('carrotEaten', { position: r.position.clone(), healed });
  }

  function draw(player) {
    const n = list.length;
    for (let i = 0; i < n; i++) {
      const r = list[i];
      let scale = CARROT_SCALE;
      let sy = 1 + r.squash * -SQUASH;
      let sxz = 1 + r.squash * SQUASH * 0.6;
      let glowScale = GLOW_RADIUS * (0.9 + 0.1 * Math.sin(r.age * BOB_SPEED * 2));
      at.set(r.position.x, r.height + lift * sy, r.position.z);
      if (r.state === 'eaten') {
        // 내 토끼 입으로 쏙
        const k = r.suck * r.suck;
        if (player) mouth.set(player.position.x, MOUTH_HEIGHT, player.position.z);
        else mouth.copy(r.from);
        at.lerpVectors(r.from, mouth, k);
        at.y += lift * (1 - k) + Math.sin(Math.PI * r.suck) * 2;
        scale *= 1 - k * 0.9;
        glowScale *= 1 - r.suck;
        sy = 1;
        sxz = 1;
      } else if (r.state === 'pop') {
        glowScale *= Math.min(1, r.age * 3);
      }
      euler.set(Math.sin(r.age * 2.3) * WOBBLE, r.spin, Math.cos(r.age * 1.9) * WOBBLE, 'YXZ');
      quat.setFromEuler(euler);
      size.set(scale * sxz, scale * sy, scale * sxz);
      carrotMatrix.compose(at, quat, size);
      const base = i * voxels.length;
      for (let j = 0; j < voxels.length; j++) {
        matrix.multiplyMatrices(carrotMatrix, local[j]);
        mesh.setMatrixAt(base + j, matrix);
      }
      at.set(r.position.x, GLOW_Y, r.position.z);
      quat.identity();
      size.set(glowScale, 1, glowScale);
      matrix.compose(at, quat, size);
      glow.setMatrixAt(i, matrix);
    }
    if (n === 0 && drawn === 0) return;
    drawn = n;
    mesh.count = n * voxels.length;
    glow.count = n;
    mesh.visible = n > 0;
    glow.visible = n > 0;
    mesh.instanceMatrix.needsUpdate = true;
    glow.instanceMatrix.needsUpdate = true;
  }

  function clear() {
    for (const r of list) r.active = false;
    list.length = 0;
    draw(null);
  }

  return {
    spawn,
    update,
    clear,
    get list() {
      return list;
    },
  };
}
