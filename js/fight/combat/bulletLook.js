// 총알 모양 그리기 (bullets.js 가 씀)
// 총알 = 날아가는 방향으로 살짝 길쭉한 작은 블록 하나 (빙글 돌며 날아감)
//      + 뒤따르는 더 작은 블록 몇 개 + 뒤로 갈수록 뾰족하고 투명해지는 꼬리
// 블록은 묶음 하나(InstancedMesh), 꼬리는 반투명 판 묶음 하나로 한꺼번에 그려서 가볍습니다.
//
//   const look = createBulletLook(scene, capacity)
//   look.draw(list)       list: 날아가는 총알 기록 [{ position, dir, spin, traveled, rangeLeft, color }]
//   look.markColors()     총알이 생기거나 사라졌을 때 (다음 draw 에서 색을 다시 보냄)
//
// 크기·꼬리 길이·투명도는 아래 상수에서 바꿉니다. (색은 쏘는 쪽이 fightConfig.js 에서 정함)

import * as THREE from '../../lib/three.js';
import { createBlockBatch } from '../../game/core/blockAssets.js';

const BULLET_SIZE = 0.7; // 총알 블록 크기 (블록 한 칸 = 1)
const BULLET_STRETCH = 1.3; // 날아가는 방향으로 길쭉한 정도
// 뒤따르는 작은 블록 [총알에서 떨어진 거리, 크기]
const GHOSTS = [
  [1.0, 0.46],
  [1.85, 0.32],
  [2.55, 0.2],
];
const STREAK_LENGTH = 4.2; // 흐려지는 꼬리 길이
const STREAK_WIDTH = 0.75; // 꼬리 굵기
const STREAK_OPACITY = 0.85;
const STREAK_WHITEN = 0.25; // 꼬리는 총알 색보다 조금 밝게
const FADE_DISTANCE = 3; // 사거리 끝에서 이 거리 동안 작아지며 사라짐
const GHOST_COUNT = GHOSTS.length;
const PER_BULLET = 1 + GHOST_COUNT; // 총알 하나가 쓰는 블록 칸 수

export function createBulletLook(scene, capacity) {
  const batch = createBlockBatch(capacity * PER_BULLET, { castShadow: true, receiveShadow: false });
  const blocks = batch.bodies;
  blocks.name = 'bullets';
  scene.add(blocks);

  const streaks = new THREE.InstancedMesh(
    createStreakGeometry(),
    new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: STREAK_OPACITY, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
    capacity,
  );
  streaks.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  streaks.frustumCulled = false;
  streaks.count = 0;
  streaks.renderOrder = 2;
  streaks.setColorAt(0, new THREE.Color(1, 1, 1));
  streaks.name = 'bulletStreaks';
  scene.add(streaks);

  const matrix = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const yawQuat = new THREE.Quaternion();
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  const at = new THREE.Vector3();
  const size = new THREE.Vector3();
  const white = new THREE.Color('#FFFFFF');
  const tint = new THREE.Color();
  let colorsDirty = false;
  let drawn = 0;

  function draw(list) {
    const n = Math.min(list.length, capacity);
    for (let i = 0; i < n; i++) {
      const r = list[i];
      const fade = Math.max(0.15, Math.min(1, r.rangeLeft / FADE_DISTANCE));
      const yaw = Math.atan2(r.dir.x, r.dir.z);
      euler.set(0, yaw, r.spin, 'YXZ');
      quat.setFromEuler(euler);
      const base = i * PER_BULLET;
      const s = BULLET_SIZE * fade;
      size.set(s, s, s * BULLET_STRETCH);
      matrix.compose(r.position, quat, size);
      blocks.setMatrixAt(base, matrix);
      // 뒤따르는 작은 블록 (쏜 곳보다 뒤에는 안 그림)
      for (let g = 0; g < GHOST_COUNT; g++) {
        const back = GHOSTS[g][0];
        const gs = r.traveled >= back ? GHOSTS[g][1] * fade : 0;
        at.set(r.position.x - r.dir.x * back, r.position.y, r.position.z - r.dir.z * back);
        size.set(gs, gs, gs);
        euler.set(0, yaw, -r.spin * 0.7 + g, 'YXZ');
        quat.setFromEuler(euler);
        matrix.compose(at, quat, size);
        blocks.setMatrixAt(base + 1 + g, matrix);
      }
      // 꼬리 (처음엔 짧게 → 날아간 만큼 길어짐)
      const length = Math.min(r.traveled + BULLET_SIZE, STREAK_LENGTH) * fade;
      euler.set(0, yaw, 0, 'YXZ');
      yawQuat.setFromEuler(euler);
      size.set(STREAK_WIDTH * fade, STREAK_WIDTH * fade, length);
      matrix.compose(r.position, yawQuat, size);
      streaks.setMatrixAt(i, matrix);
    }
    if (colorsDirty) {
      for (let i = 0; i < n; i++) {
        const color = list[i].color;
        const base = i * PER_BULLET;
        for (let g = 0; g < PER_BULLET; g++) blocks.setColorAt(base + g, color);
        streaks.setColorAt(i, tint.copy(color).lerp(white, STREAK_WHITEN));
      }
      if (blocks.instanceColor) blocks.instanceColor.needsUpdate = true;
      if (streaks.instanceColor) streaks.instanceColor.needsUpdate = true;
      colorsDirty = false;
    }
    if (n === 0 && drawn === 0) return;
    drawn = n;
    blocks.count = n * PER_BULLET;
    streaks.count = n;
    blocks.visible = n > 0;
    streaks.visible = n > 0;
    blocks.instanceMatrix.needsUpdate = true;
    streaks.instanceMatrix.needsUpdate = true;
  }

  return {
    draw,
    markColors() {
      colorsDirty = true;
    },
  };
}

// 꼬리 모양: 앞(z = 0)은 폭 1, 뒤(z = -1)로 갈수록 뾰족하고 투명해짐
// 가로 판 + 세로 판을 겹쳐서 위에서도 옆에서도 보임
function createStreakGeometry() {
  const geometry = new THREE.BufferGeometry();
  const positions = [-0.5, 0, 0, 0.5, 0, 0, 0, 0, -1, 0, -0.5, 0, 0, 0.5, 0, 0, 0, -1];
  const colors = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0];
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 4));
  geometry.computeBoundingSphere();
  return geometry;
}
