// 부서진 블록 조각
// 몬스터가 맞거나 성이 공격받을 때 떨어져 나간 블록이 튀어 올랐다가 바닥에 통통 튑니다.
// 바닥에 멈춘 조각은 사라지지 않고 '잔해'로 전장에 남아 있다가, 대장 몬스터가 나올 때 모여서 대장이 됩니다.
// (잔해가 가득 차면 새 조각은 잠깐 뒤에 작아지며 사라집니다)
//
//   debris.burst(blocks, { from, power, upward })   blocks: [{ position, color }] (BlockFigure.removeBlocks 결과)
//   debris.spawn(position, color, velocity, { lifetime, settle })  조각 하나 띄우기 (settle: false 면 잔해로 남지 않음)
//   debris.takeRubble(n)                            바닥에 남은 잔해 n개를 가져감 → [{ position, quaternion, color }]
//   debris.setGroundHeight((x, z) => 높이)           바닥 높이 알려 주기 (성 돌바닥·타워 자리 위는 1)
//   debris.update(dt)
//   debris.clear()
//   debris.count / debris.rubbleCount                날아다니는 조각 수 / 바닥에 남은 잔해 수

import * as THREE from '../../lib/three.js';
import { createBlockBatch } from './blockAssets.js';

const HALF = 0.48; // 블록 절반 높이 (바닥에 닿는 높이)
const SETTLE_SPEED = 0.25; // 이보다 느리게 바닥에 누워 있으면 잔해가 됨
const SETTLE_AGE = 0.35; // 튀어나온 뒤 최소 이만큼은 날아다님 (초)

export function createDebris(scene, { capacity, gravity, lifeSeconds, rubbleCapacity = 0 }) {
  const batch = createBlockBatch(capacity);
  const mesh = batch.bodies;
  scene.add(mesh);
  const rubbleBatch = createBlockBatch(Math.max(1, rubbleCapacity), { castShadow: false });
  const rubbleMesh = rubbleBatch.bodies;
  scene.add(rubbleMesh);
  let lastCount = 0;
  let colorsDirty = false;

  // 날아다니는 조각
  const pos = new Float32Array(capacity * 3);
  const vel = new Float32Array(capacity * 3);
  const rot = new Float32Array(capacity * 3);
  const spin = new Float32Array(capacity * 3);
  const age = new Float32Array(capacity);
  const life = new Float32Array(capacity);
  const canSettle = new Uint8Array(capacity); // 1이면 바닥에 멈췄을 때 잔해로 남음 (스킬 반짝이 등은 0)
  let count = 0;

  // 바닥에 남은 잔해
  const rubblePos = new Float32Array(Math.max(1, rubbleCapacity) * 3);
  const rubbleQuat = new Float32Array(Math.max(1, rubbleCapacity) * 4);
  let rubbleCount = 0;
  let rubbleDirty = false;
  let groundHeight = () => 0;

  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const scale = new THREE.Vector3();
  const color = new THREE.Color();
  const unit = new THREE.Vector3(1, 1, 1);

  function spawn(at, blockColor, velocity, { lifetime = lifeSeconds, settle = true } = {}) {
    if (count >= capacity) return; // 너무 많으면 새 조각은 생략
    const i = count++;
    pos.set([at.x, at.y, at.z], i * 3);
    vel.set([velocity.x, velocity.y, velocity.z], i * 3);
    rot.set([0, 0, 0], i * 3);
    spin.set([(Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14], i * 3);
    age[i] = 0;
    life[i] = lifetime * (0.75 + Math.random() * 0.5);
    canSettle[i] = settle ? 1 : 0;
    mesh.setColorAt(i, blockColor);
    colorsDirty = true;
  }

  function burst(blocks, { from = null, power = 6, upward = 7 } = {}) {
    const direction = new THREE.Vector3();
    for (const block of blocks) {
      if (from) direction.subVectors(block.position, from).setY(0);
      if (!from || direction.lengthSq() < 1e-4) direction.set(Math.random() - 0.5, 0, Math.random() - 0.5);
      direction.normalize().multiplyScalar(power * (0.5 + Math.random()));
      direction.y = upward * (0.6 + Math.random() * 0.8);
      direction.x += (Math.random() - 0.5) * power * 0.6;
      direction.z += (Math.random() - 0.5) * power * 0.6;
      spawn(block.position, block.color, direction);
    }
  }

  function update(dt) {
    if (rubbleDirty) flushRubble();
    if (count === 0 && lastCount === 0) return; // 날아다니는 조각이 없으면 할 일 없음
    let i = 0;
    while (i < count) {
      age[i] += dt;
      const b = i * 3;
      const floor = groundHeight(pos[b], pos[b + 2]) + HALF;
      const resting = vel[b + 1] === 0 && Math.abs(vel[b]) + Math.abs(vel[b + 2]) < SETTLE_SPEED;
      if (resting && canSettle[i] && age[i] > SETTLE_AGE && pos[b + 1] <= floor + 0.01 && rubbleCount < rubbleCapacity) {
        settle(i, floor);
        continue;
      }
      if (age[i] >= life[i]) {
        removeAt(i);
        continue;
      }
      vel[b + 1] -= gravity * dt;
      pos[b] += vel[b] * dt;
      pos[b + 1] += vel[b + 1] * dt;
      pos[b + 2] += vel[b + 2] * dt;
      if (pos[b + 1] < floor) {
        pos[b + 1] = floor;
        // 한 장면이 길면(느린 기기·빠른 속도) 한 번에 더 빨리 떨어지므로 '멈춤' 기준도 같이 키움
        const restSpeed = Math.max(1.5, gravity * dt * 1.6);
        vel[b + 1] = Math.abs(vel[b + 1]) < restSpeed ? 0 : -vel[b + 1] * 0.35;
        vel[b] *= 0.6;
        vel[b + 2] *= 0.6;
        spin[b] *= 0.5;
        spin[b + 1] *= 0.5;
        spin[b + 2] *= 0.5;
        if (vel[b + 1] === 0) {
          // 바닥에 누우면 가장 가까운 평평한 면으로 천천히 바로 눕힘
          for (let k = 0; k < 3; k++) rot[b + k] += (snapAngle(rot[b + k]) - rot[b + k]) * Math.min(1, dt * 8);
        }
      }
      rot[b] += spin[b] * dt;
      rot[b + 1] += spin[b + 1] * dt;
      rot[b + 2] += spin[b + 2] * dt;

      const remaining = life[i] - age[i];
      const s = remaining < 0.35 ? Math.max(0.01, remaining / 0.35) : 1;
      position.set(pos[b], pos[b + 1], pos[b + 2]);
      rotation.setFromEuler(euler.set(rot[b], rot[b + 1], rot[b + 2]));
      scale.set(s, s, s);
      matrix.compose(position, rotation, scale);
      mesh.setMatrixAt(i, matrix);
      i++;
    }
    mesh.count = count;
    mesh.visible = count > 0;
    lastCount = count;
    // 살아 있는 조각 부분만 그래픽 카드로 보냄
    mesh.instanceMatrix.clearUpdateRanges();
    mesh.instanceMatrix.addUpdateRange(0, Math.max(1, count) * 16);
    mesh.instanceMatrix.needsUpdate = true;
    if (colorsDirty && mesh.instanceColor) {
      mesh.instanceColor.clearUpdateRanges();
      mesh.instanceColor.addUpdateRange(0, Math.max(1, count) * 3);
      mesh.instanceColor.needsUpdate = true;
      colorsDirty = false;
    }
    if (rubbleDirty) flushRubble();
  }

  // 바닥에 멈춘 조각을 잔해로 옮김 (평평하게 눕히고 더 이상 움직이지 않음)
  function settle(i, floor) {
    const b = i * 3;
    const r = rubbleCount++;
    rotation.setFromEuler(euler.set(snapAngle(rot[b]), snapAngle(rot[b + 1]), snapAngle(rot[b + 2])));
    rubblePos.set([pos[b], floor, pos[b + 2]], r * 3);
    rubbleQuat.set([rotation.x, rotation.y, rotation.z, rotation.w], r * 4);
    position.set(pos[b], floor, pos[b + 2]);
    matrix.compose(position, rotation, unit);
    mesh.getColorAt(i, color);
    rubbleMesh.setMatrixAt(r, matrix);
    rubbleMesh.setColorAt(r, color);
    rubbleDirty = true;
    removeAt(i);
  }

  // 잔해 n개 가져가기 (뒤에서부터 → 다른 잔해는 그대로 둠)
  function takeRubble(n) {
    const taken = [];
    const amount = Math.min(n, rubbleCount);
    for (let k = 0; k < amount; k++) {
      const r = --rubbleCount;
      rubbleMesh.getColorAt(r, color);
      taken.push({
        position: new THREE.Vector3(rubblePos[r * 3], rubblePos[r * 3 + 1], rubblePos[r * 3 + 2]),
        quaternion: new THREE.Quaternion(rubbleQuat[r * 4], rubbleQuat[r * 4 + 1], rubbleQuat[r * 4 + 2], rubbleQuat[r * 4 + 3]),
        color: color.clone(),
      });
    }
    if (amount > 0) rubbleDirty = true;
    return taken;
  }

  function flushRubble() {
    rubbleDirty = false;
    rubbleMesh.count = rubbleCount;
    rubbleMesh.visible = rubbleCount > 0;
    rubbleMesh.instanceMatrix.needsUpdate = true;
    if (rubbleMesh.instanceColor) rubbleMesh.instanceColor.needsUpdate = true;
  }

  // i번째 조각을 지우고 맨 끝 조각을 그 자리로 옮김
  function removeAt(i) {
    const last = count - 1;
    if (i !== last) {
      for (const arr of [pos, vel, rot, spin]) arr.copyWithin(i * 3, last * 3, last * 3 + 3);
      age[i] = age[last];
      life[i] = life[last];
      canSettle[i] = canSettle[last];
      mesh.getColorAt(last, color);
      mesh.setColorAt(i, color);
      colorsDirty = true;
    }
    count = last;
  }

  function clear() {
    count = 0;
    lastCount = 0;
    mesh.count = 0;
    mesh.visible = false;
    rubbleCount = 0;
    flushRubble();
  }

  return {
    spawn,
    burst,
    update,
    clear,
    takeRubble,
    setGroundHeight(fn) {
      groundHeight = fn;
    },
    get count() {
      return count;
    },
    get rubbleCount() {
      return rubbleCount;
    },
  };
}

function snapAngle(angle) {
  return Math.round(angle / (Math.PI / 2)) * (Math.PI / 2);
}
