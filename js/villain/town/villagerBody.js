// 마을 사람 몸 그리기 (블록 7개짜리 꼬마 사람: 다리 둘 · 몸 · 얼굴 · 머리카락 · 팔 둘)
// 모든 사람을 한 묶음(InstancedMesh)으로 한 번에 그려서 휴대폰에서도 가볍습니다.
// 움직임(어디로 뛰는지)은 villagerBrain.js, 사람 무리 관리는 villagers.js 가 맡고, 여기서는 '자세'대로 블록만 놓습니다.
//
//   const bodies = createVillagerBodies(scene, 사람 수, { size })     size: 블록 사람 크기 (villainConfig.js 의 villagers.size)
//   bodies.paint(i, [바지, 윗옷, 피부, 머리카락])   옷 색 칠하기 (처음 한 번)
//   bodies.pose(i, v)     v: { x, y, z, yaw, pitch, roll, scale, leg, armL, armR, armSwing }
//       yaw: 바라보는 방향, pitch: 앞으로 숙임 (π/2 = 엎드려 꽈당), roll: 옆으로 기우뚱, scale: 크기 배율 (0 이면 안 보임)
//       leg: 다리 흔들기 각도, armL / armR: 팔을 옆으로 들어 올린 각도 (0 = 내림, 약 2.8 = 만세, π = 똑바로 위)
//       armSwing: 팔 앞뒤 흔들기 (음수 = 앞으로 들어 올림), armTogether: true 면 두 팔이 같이 (눈물 닦기 등)
//   bodies.hide(i) ; bodies.commit() (매 장면 끝에 한 번) ; bodies.dispose()
//   bodies.headHeight → 서 있을 때 머리 꼭대기 높이 (크기 배율 1 기준, 말풍선 자리)
//
// 몸 비율(팔 길이·머리 크기)은 아래 PARTS 표에서 바꿉니다. 단위는 '사람 블록 한 칸' (= size).

import * as THREE from '../../lib/three.js';
import { createBlockBatch } from '../../game/core/blockAssets.js';

// 몸 조각: pivot = 도는 축(엉덩이·어깨) 자리, offset = 축에서 조각 가운데까지, scale = 조각 크기, color = paint 색 번호
// turn: 'legL' | 'legR' | 'armL' | 'armR' 이면 자세에 따라 돌아감
const PARTS = [
  { turn: 'legL', pivot: [-0.21, 0.9, 0], offset: [0, -0.45, 0], scale: [0.38, 0.9, 0.5], color: 0 },
  { turn: 'legR', pivot: [0.21, 0.9, 0], offset: [0, -0.45, 0], scale: [0.38, 0.9, 0.5], color: 0 },
  { pivot: [0, 0.9, 0], offset: [0, 0.5, 0], scale: [0.95, 1.0, 0.62], color: 1 }, // 몸
  { pivot: [0, 1.9, 0], offset: [0, 0.4, 0], scale: [0.8, 0.8, 0.8], color: 2 }, // 얼굴
  { pivot: [0, 1.9, 0], offset: [0, 0.9, -0.04], scale: [0.86, 0.26, 0.86], color: 3 }, // 머리카락 · 모자
  { turn: 'armL', pivot: [-0.62, 1.8, 0], offset: [0, -0.42, 0], scale: [0.3, 0.84, 0.38], color: 1 },
  { turn: 'armR', pivot: [0.62, 1.8, 0], offset: [0, -0.42, 0], scale: [0.3, 0.84, 0.38], color: 1 },
];
export const BLOCKS_PER_PERSON = PARTS.length;
const HEAD_TOP = 2.95; // 머리 꼭대기 (돌기 포함, 사람 블록 칸)

export function createVillagerBodies(scene, count, { size = 0.72 } = {}) {
  const total = Math.max(1, count * PARTS.length);
  const mesh = createBlockBatch(total).bodies;
  mesh.name = 'villagers';
  mesh.count = count * PARTS.length;
  scene.add(mesh);

  const ZERO = new THREE.Matrix4().set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
  const root = new THREE.Matrix4();
  const part = new THREE.Matrix4();
  const tail = new THREE.Matrix4();
  const out = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const color = new THREE.Color();
  // 돌지 않는 조각은 미리 계산 (pivot + offset, 크기)
  const fixed = PARTS.map((p) => (p.turn ? null : new THREE.Matrix4().makeTranslation(p.pivot[0] + p.offset[0], p.pivot[1] + p.offset[1], p.pivot[2] + p.offset[2]).scale(scl.set(...p.scale))));
  // 도는 조각: 축에서 조각 가운데까지 + 크기
  const tails = PARTS.map((p) => new THREE.Matrix4().makeTranslation(...p.offset).scale(scl.set(...p.scale)));

  function paint(i, colors) {
    PARTS.forEach((p, k) => mesh.setColorAt(i * PARTS.length + k, color.set(colors[p.color] || '#ffffff')));
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  function hide(i) {
    for (let k = 0; k < PARTS.length; k++) mesh.setMatrixAt(i * PARTS.length + k, ZERO);
  }

  function pose(i, v) {
    const s = size * (v.scale ?? 1);
    if (!(s > 0.001)) return hide(i);
    quat.setFromEuler(euler.set(v.pitch || 0, v.yaw || 0, v.roll || 0, 'YXZ'));
    root.compose(pos.set(v.x, v.y || 0, v.z), quat, scl.set(s, s, s));
    for (let k = 0; k < PARTS.length; k++) {
      const p = PARTS[k];
      if (!p.turn) {
        out.multiplyMatrices(root, fixed[k]);
      } else {
        const isLeg = p.turn === 'legL' || p.turn === 'legR';
        const sign = p.turn === 'legL' || p.turn === 'armL' ? 1 : -1;
        // 다리: 앞뒤로 엇갈려 흔듦. 팔: 옆으로 들어 올림(armL/armR) + 앞뒤 흔들기(armSwing, 왼팔·오른팔 엇갈림)
        const rx = isLeg ? (v.leg || 0) * sign : (v.armSwing || 0) * (v.armTogether ? 1 : sign);
        const rz = isLeg ? 0 : sign > 0 ? -(v.armL || 0) : v.armR || 0; // 왼팔은 반대쪽으로 돌아야 바깥으로 들림
        part.makeRotationFromEuler(euler.set(rx, 0, rz, 'XYZ')).setPosition(p.pivot[0], p.pivot[1], p.pivot[2]);
        tail.multiplyMatrices(part, tails[k]);
        out.multiplyMatrices(root, tail);
      }
      mesh.setMatrixAt(i * PARTS.length + k, out);
    }
  }

  return {
    paint,
    pose,
    hide,
    headHeight: HEAD_TOP * size,
    commit() {
      mesh.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      mesh.removeFromParent();
      mesh.dispose();
    },
  };
}
