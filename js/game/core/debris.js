// 부서진 블록 조각
// 몬스터가 맞거나 성이 공격받을 때 떨어져 나간 블록이 튀어 올랐다가 바닥에 통통 튀고 사라집니다.
//
//   debris.burst(blocks, { from, power, upward })   blocks: [{ position, color }] (BlockFigure.removeBlocks 결과)
//   debris.spawn(position, color, velocity)         조각 하나 띄우기
//   debris.update(dt)
//   debris.clear()

import * as THREE from '../../lib/three.js';
import { createBlockBatch } from './blockAssets.js';

const GROUND_Y = 0.48; // 블록 절반 높이 (바닥에 닿는 높이)

export function createDebris(scene, { capacity, gravity, lifeSeconds }) {
  const batch = createBlockBatch(capacity);
  scene.add(batch.bodies, batch.studs);

  const pos = new Float32Array(capacity * 3);
  const vel = new Float32Array(capacity * 3);
  const rot = new Float32Array(capacity * 3);
  const spin = new Float32Array(capacity * 3);
  const age = new Float32Array(capacity);
  const life = new Float32Array(capacity);
  let count = 0;

  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const scale = new THREE.Vector3();
  const color = new THREE.Color();

  function spawn(at, blockColor, velocity, { lifetime = lifeSeconds } = {}) {
    if (count >= capacity) return; // 너무 많으면 새 조각은 생략
    const i = count++;
    pos.set([at.x, at.y, at.z], i * 3);
    vel.set([velocity.x, velocity.y, velocity.z], i * 3);
    rot.set([0, 0, 0], i * 3);
    spin.set([(Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14], i * 3);
    age[i] = 0;
    life[i] = lifetime * (0.75 + Math.random() * 0.5);
    batch.bodies.setColorAt(i, blockColor);
    batch.studs.setColorAt(i, blockColor);
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
    let i = 0;
    while (i < count) {
      age[i] += dt;
      if (age[i] >= life[i]) {
        removeAt(i);
        continue;
      }
      const b = i * 3;
      vel[b + 1] -= gravity * dt;
      pos[b] += vel[b] * dt;
      pos[b + 1] += vel[b + 1] * dt;
      pos[b + 2] += vel[b + 2] * dt;
      if (pos[b + 1] < GROUND_Y) {
        pos[b + 1] = GROUND_Y;
        vel[b + 1] = Math.abs(vel[b + 1]) < 1.5 ? 0 : -vel[b + 1] * 0.35;
        vel[b] *= 0.6;
        vel[b + 2] *= 0.6;
        spin[b] *= 0.5;
        spin[b + 1] *= 0.5;
        spin[b + 2] *= 0.5;
        if (vel[b + 1] === 0) {
          // 바닥에 누우면 가장 가까운 평평한 면으로 천천히 바로 눕힘
          for (let k = 0; k < 3; k++) rot[b + k] += (Math.round(rot[b + k] / (Math.PI / 2)) * (Math.PI / 2) - rot[b + k]) * Math.min(1, dt * 8);
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
      batch.bodies.setMatrixAt(i, matrix);
      batch.studs.setMatrixAt(i, matrix);
      i++;
    }
    batch.bodies.count = count;
    batch.studs.count = count;
    batch.bodies.instanceMatrix.needsUpdate = true;
    batch.studs.instanceMatrix.needsUpdate = true;
    if (batch.bodies.instanceColor) batch.bodies.instanceColor.needsUpdate = true;
    if (batch.studs.instanceColor) batch.studs.instanceColor.needsUpdate = true;
  }

  // i번째 조각을 지우고 맨 끝 조각을 그 자리로 옮김
  function removeAt(i) {
    const last = count - 1;
    if (i !== last) {
      for (const arr of [pos, vel, rot, spin]) arr.copyWithin(i * 3, last * 3, last * 3 + 3);
      age[i] = age[last];
      life[i] = life[last];
      batch.bodies.getColorAt(last, color);
      batch.bodies.setColorAt(i, color);
      batch.studs.setColorAt(i, color);
    }
    count = last;
  }

  function clear() {
    count = 0;
    batch.bodies.count = 0;
    batch.studs.count = 0;
  }

  return { spawn, burst, update, clear, get count() { return count; } };
}
