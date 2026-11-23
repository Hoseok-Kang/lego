// 블록이 하늘에서 촤르륵 떨어져 괴수가 쌓이는 모션
// 아래 줄부터 블록이 비처럼 떨어져 제자리에 '톡' 붙고 살짝 튕깁니다. 다 쌓이면 진짜 괴수 인형과 바꿔치기합니다.
//
//   const rain = createBuildRain(scene, model, origin, seconds)   origin: 괴수가 설 자리 (Vector3)
//   rain.update(dt) → { done, landed }     landed: 이번 장면에 제자리에 붙은 블록 수 (소리·먼지용)
//   rain.progress                          0 ~ 1
//   rain.dispose()
//
// 떨어지는 높이·빠르기·튕김은 아래 상수에서 바꿉니다.

import * as THREE from '../../lib/three.js';
import { createBlockBatch } from '../../game/core/blockAssets.js';

const DROP_HEIGHT = 13; // 블록이 떨어지기 시작하는 높이 (제자리보다 이만큼 위)
const FALL_SECONDS = 0.34; // 블록 하나가 떨어지는 시간
const BOUNCE_SECONDS = 0.2; // 붙은 뒤 톡 튀는 시간
const BOUNCE_HEIGHT = 0.4; // 톡 튀는 높이
const SIDE_SCATTER = 1.6; // 떨어지기 시작할 때 옆으로 흩어진 정도 (칸)
const SPIN = 2.2; // 떨어지며 도는 정도 (라디안)

export function createBuildRain(scene, model, origin, seconds) {
  const voxels = model.parts.body.voxels;
  const order = model.buildOrder;
  const total = order.length;
  const batch = createBlockBatch(Math.max(1, total));
  const mesh = batch.bodies;
  scene.add(mesh);

  // 블록마다: 출발 시각, 시작할 때 흩어짐·기울기
  const spread = Math.max(0.05, seconds - FALL_SECONDS - BOUNCE_SECONDS);
  const start = new Float32Array(total);
  const scatter = new Float32Array(total * 4);
  const color = new THREE.Color();
  for (let k = 0; k < total; k++) {
    const u = total > 1 ? k / (total - 1) : 0;
    start[k] = spread * Math.pow(u, 0.85); // 처음엔 후두둑, 끝으로 갈수록 살짝 느긋하게
    scatter[k * 4] = (Math.random() - 0.5) * SIDE_SCATTER;
    scatter[k * 4 + 1] = (Math.random() - 0.5) * SIDE_SCATTER;
    scatter[k * 4 + 2] = (Math.random() - 0.5) * SPIN;
    scatter[k * 4 + 3] = (Math.random() - 0.5) * SPIN;
    mesh.setColorAt(k, color.set(voxels[order[k]].hex));
  }
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const scale = new THREE.Vector3();
  let time = 0;
  let landedCount = 0;

  function update(dt) {
    time += dt;
    let landedNow = 0;
    let settled = 0;
    for (let k = 0; k < total; k++) {
      const voxel = voxels[order[k]];
      const t = time - start[k];
      let y = 0, size = 1, sx = 0, sz = 0, rx = 0, rz = 0;
      if (t < 0) {
        size = 0;
      } else if (t < FALL_SECONDS) {
        const p = t / FALL_SECONDS;
        const fall = 1 - p * p; // 점점 빨라지며 떨어짐
        y = DROP_HEIGHT * fall;
        sx = scatter[k * 4] * fall;
        sz = scatter[k * 4 + 1] * fall;
        rx = scatter[k * 4 + 2] * fall;
        rz = scatter[k * 4 + 3] * fall;
        size = Math.min(1, 0.4 + p * 1.4);
      } else if (t < FALL_SECONDS + BOUNCE_SECONDS) {
        const q = (t - FALL_SECONDS) / BOUNCE_SECONDS;
        const bump = Math.sin(Math.PI * q);
        y = BOUNCE_HEIGHT * bump * (1 - q);
        size = 1 + 0.25 * bump * (1 - q);
        settled++;
      } else {
        settled++;
      }
      if (size === 0) {
        matrix.makeScale(0, 0, 0);
      } else {
        position.set(origin.x + voxel.x + sx, origin.y + voxel.y + y, origin.z + voxel.z + sz);
        rotation.setFromEuler(euler.set(rx, 0, rz));
        scale.setScalar(size);
        matrix.compose(position, rotation, scale);
      }
      mesh.setMatrixAt(k, matrix);
    }
    mesh.count = total;
    mesh.instanceMatrix.needsUpdate = true;
    landedNow = settled - landedCount;
    landedCount = settled;
    return { done: time >= seconds, landed: landedNow };
  }

  return {
    update,
    get progress() {
      return total ? landedCount / total : 1;
    },
    dispose() {
      scene.remove(mesh);
      mesh.dispose();
    },
  };
}
