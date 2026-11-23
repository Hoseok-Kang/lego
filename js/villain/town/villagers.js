// 꼬마 마을 사람들 (작은 블록 사람 — 괴수가 가까이 오면 폴짝폴짝 도망다님)
// 구경거리일 뿐이라 부딪히지도, 맞지도 않습니다. 전부 한 번에 그려서 가볍습니다.
//
//   const villagers = createVillagers(scene, { count, bounds, buildings, style?, street?, walkable? })
//       style: 옷 모음 ('village' 마을 사람 | 'harbor' 뱃사람 | 'castle' 병사·귀족), street: [z0, z1] 평소 서성이는 줄
//       walkable(x, z) → false 면 그 자리로는 안 감 (예: 바다)
//   villagers.update(dt, threat)     threat: 괴수 위치(Vector3) 또는 null
//   villagers.reset() ; villagers.dispose() ; villagers.list ([{ x, z, panic }])
//
// 걷는 빠르기·놀라는 거리 등은 아래 상수에서 바꿉니다.

import * as THREE from '../../lib/three.js';
import { createBlockBatch } from '../../game/core/blockAssets.js';

const SIZE = 0.5; // 사람 블록 크기 (건물 블록의 절반)
const WALK_SPEED = 1.6; // 평소 걷는 빠르기 (초당 칸)
const RUN_SPEED = 8.5; // 도망치는 빠르기
const SCARE_DISTANCE = 15; // 괴수가 이만큼 가까우면 도망
const CALM_SECONDS = 1.2; // 괴수가 멀어진 뒤에도 이만큼은 더 뜀
const SKIN = '#F6D7B3';
const STYLES = {
  // 뱃사람: 줄무늬 셔츠 느낌 (흰·파랑), 노란 비옷
  harbor: [
    ['#0A3463', '#F4F4F4', '#0055BF'],
    ['#582A12', '#F2CD37', '#F2CD37'],
    ['#0055BF', '#C91A09', '#1B2A34'],
    ['#6C6E68', '#36AEBF', '#F4F4F4'],
    ['#0A3463', '#FE8A18', '#582A12'],
  ],
  // 병사(은 투구)·귀족(보라·금)
  castle: [
    ['#6C6E68', '#C91A09', '#A0A5A9'],
    ['#6C6E68', '#0055BF', '#A0A5A9'],
    ['#3F3691', '#AC78BA', '#F2CD37'],
    ['#1B2A34', '#F2CD37', '#582A12'],
    ['#6C6E68', '#C91A09', '#A0A5A9'],
    ['#923978', '#E4ADC8', '#F2CD37'],
  ],
};
const OUTFITS = [
  ['#0055BF', '#C91A09', '#582A12'], // 바지, 윗옷, 머리
  ['#582A12', '#F2CD37', '#1B2A34'],
  ['#6C6E68', '#4B9F4A', '#FE8A18'],
  ['#0A3463', '#E4ADC8', '#F2CD37'],
  ['#1B2A34', '#36AEBF', '#A95500'],
  ['#923978', '#F4F4F4', '#582A12'],
  ['#237841', '#FE8A18', '#1B2A34'],
];
const BLOCKS_EACH = 4; // 다리, 몸, 얼굴, 머리카락(모자)

export function createVillagers(scene, { count = 6, bounds, buildings = [], style = 'village', street = [1, 8], walkable = null } = {}) {
  const outfits = STYLES[style] || OUTFITS;
  const mesh = createBlockBatch(Math.max(1, count * BLOCKS_EACH)).bodies;
  mesh.name = 'villagers';
  mesh.count = count * BLOCKS_EACH;
  scene.add(mesh);
  const list = [];
  const matrix = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const pos = new THREE.Vector3();
  const offset = new THREE.Vector3();
  const scale = new THREE.Vector3(SIZE, SIZE, SIZE);
  const color = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const outfit = outfits[i % outfits.length];
    [outfit[0], outfit[1], SKIN, outfit[2]].forEach((hex, k) => mesh.setColorAt(i * BLOCKS_EACH + k, color.set(hex)));
    list.push({ x: 0, z: 0, dirX: 1, dirZ: 0, yaw: 0, phase: Math.random() * 6, turn: 0, panic: 0, pause: 0 });
  }

  // 평소 서성이는 자리: 큰길 위 (street 줄) 에 고르게
  function reset() {
    list.forEach((v, i) => {
      v.x = bounds.minX + 8 + ((bounds.maxX - bounds.minX - 16) * (i + 0.5)) / Math.max(1, count);
      v.z = street[0] + 1 + (((i * 37) % 50) / 50) * Math.max(0.5, street[1] - street[0] - 2);
      const a = i * 2.4;
      v.dirX = Math.cos(a);
      v.dirZ = Math.sin(a);
      v.turn = 1 + (i % 3);
      v.panic = 0;
      v.pause = 0;
    });
    write();
  }

  function update(dt, threat) {
    for (const v of list) {
      let speed = WALK_SPEED;
      const tx = threat ? v.x - threat.x : 0;
      const tz = threat ? v.z - threat.z : 0;
      const far = threat ? Math.hypot(tx, tz) : Infinity;
      if (far < SCARE_DISTANCE) v.panic = CALM_SECONDS;
      else v.panic = Math.max(0, v.panic - dt);

      if (v.panic > 0) {
        speed = RUN_SPEED;
        if (far < SCARE_DISTANCE) {
          // 괴수 반대쪽으로 (살짝 지그재그)
          const wiggle = Math.sin(v.phase * 0.7) * 0.6;
          const len = far || 1;
          const ax = tx / len - (tz / len) * wiggle;
          const az = tz / len + (tx / len) * wiggle;
          v.dirX += (ax - v.dirX) * Math.min(1, dt * 6);
          v.dirZ += (az - v.dirZ) * Math.min(1, dt * 6);
        }
      } else {
        // 평소: 가끔 방향을 바꾸고 가끔 멈춰 섬
        v.turn -= dt;
        if (v.turn <= 0) {
          const a = Math.random() * Math.PI * 2;
          v.dirX = Math.cos(a);
          v.dirZ = Math.sin(a) * 0.5;
          v.turn = 1.5 + Math.random() * 2.5;
          v.pause = Math.random() < 0.4 ? 0.8 + Math.random() : 0;
        }
        if (v.pause > 0) {
          v.pause -= dt;
          speed = 0;
        }
      }
      const len = Math.hypot(v.dirX, v.dirZ) || 1;
      v.dirX /= len;
      v.dirZ /= len;
      const beforeX = v.x;
      const beforeZ = v.z;
      v.x += v.dirX * speed * dt;
      v.z += v.dirZ * speed * dt;
      // 못 가는 곳(바다)이면 되돌아서 돌아감
      if (walkable && !walkable(v.x, v.z)) {
        v.x = beforeX;
        v.z = beforeZ;
        v.dirX = -v.dirX + (Math.random() - 0.5) * 0.4;
        v.dirZ = -v.dirZ;
      }

      // 건물 밖으로 밀어내기, 바닥판 가장자리에서는 돌아서기
      for (const b of buildings) {
        if (!b.alive) continue;
        const dx = v.x - b.position.x;
        const dz = v.z - b.position.z;
        const d = Math.hypot(dx, dz) || 1e-3;
        const min = b.radius + 0.8;
        if (d < min) {
          v.x = b.position.x + (dx / d) * min;
          v.z = b.position.z + (dz / d) * min;
          // 벽을 따라 옆으로 미끄러지게 방향을 틀어 줌
          v.dirX += (-dz / d) * 0.5;
          v.dirZ += (dx / d) * 0.5;
        }
      }
      const edge = 1.5;
      if (v.x < bounds.minX + edge) (v.x = bounds.minX + edge), (v.dirX = Math.abs(v.dirX) + 0.3);
      if (v.x > bounds.maxX - edge) (v.x = bounds.maxX - edge), (v.dirX = -Math.abs(v.dirX) - 0.3);
      if (v.z < bounds.minZ + edge) (v.z = bounds.minZ + edge), (v.dirZ = Math.abs(v.dirZ) + 0.3);
      if (v.z > bounds.maxZ - edge) (v.z = bounds.maxZ - edge), (v.dirZ = -Math.abs(v.dirZ) - 0.3);

      v.phase += dt * (speed > 0 ? 4 + speed * 1.6 : 0);
      if (speed > 0) {
        const want = Math.atan2(v.dirX, v.dirZ);
        let diff = want - v.yaw;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        v.yaw += diff * Math.min(1, dt * 12);
      }
      v.moving = speed > 0;
    }
    write();
  }

  function write() {
    list.forEach((v, i) => {
      const hop = v.moving ? Math.abs(Math.sin(v.phase)) * (v.panic > 0 ? 0.9 : 0.25) : 0;
      const lean = v.panic > 0 ? 0.3 : 0;
      quat.setFromEuler(euler.set(lean, v.yaw, v.moving ? Math.sin(v.phase) * 0.12 : 0, 'YXZ'));
      for (let k = 0; k < BLOCKS_EACH; k++) {
        offset.set(0, (k + 0.5) * SIZE, 0).applyQuaternion(quat);
        pos.set(v.x + offset.x, hop + offset.y, v.z + offset.z);
        mesh.setMatrixAt(i * BLOCKS_EACH + k, matrix.compose(pos, quat, scale));
      }
    });
    mesh.instanceMatrix.needsUpdate = true;
  }

  reset();
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  return {
    list,
    update,
    reset,
    dispose() {
      mesh.removeFromParent();
      mesh.dispose();
    },
  };
}
