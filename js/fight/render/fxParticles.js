// 작은 네모 조각 효과 (불꽃·연기·반짝이)
// 총구 불꽃, 맞은 자리 불티, '펑' 연기 같은 짧은 효과를 작은 네모 조각으로 그립니다.
// 조각은 미리 만들어 둔 묶음 하나(InstancedMesh)에서 돌려 써서 매 장면 새로 만들지 않습니다.
//
//   const particles = createParticles(scene, { capacity = 420, geometry, material })
//       geometry/material 을 안 주면 빛을 받지 않는 밝은 네모 (불꽃용)
//   particles.spawn(x, y, z, vx, vy, vz, 크기, 수명초, 색(Color), 중력 = 0, 공기저항 = 0, 모양 = SPARK)
//       모양: SPARK (점점 작아짐) | PUFF (부풀었다 사라짐, 연기) | FLASH (크게 번쩍 → 빨리 사라짐)
//             RAY (날아가는 방향으로 길쭉한 불티, 크기 = 길이)
//   particles.update(dt) ; particles.clear()
//
// 조각이 너무 많으면 새 조각은 그냥 건너뜁니다. (capacity 를 키우면 더 많이)

import * as THREE from '../../lib/three.js';

export const SPARK = 0;
export const PUFF = 1;
export const FLASH = 2;
export const RAY = 3;
const RAY_WIDTH = 0.22; // 길쭉한 불티의 굵기 (길이에 대한 비율)

export function createParticles(scene, { capacity = 420, geometry = null, material = null } = {}) {
  const shape = geometry || new THREE.BoxGeometry(1, 1, 1);
  const look = material || new THREE.MeshBasicMaterial({ color: 0xffffff });
  const mesh = new THREE.InstancedMesh(shape, look, capacity);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.count = 0;
  mesh.renderOrder = 3;
  mesh.setColorAt(0, new THREE.Color(1, 1, 1));
  mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
  mesh.name = 'fxParticles';
  scene.add(mesh);

  const pos = new Float32Array(capacity * 3);
  const vel = new Float32Array(capacity * 3);
  const rot = new Float32Array(capacity * 3);
  const spin = new Float32Array(capacity * 3);
  const col = new Float32Array(capacity * 3);
  const size = new Float32Array(capacity);
  const age = new Float32Array(capacity);
  const life = new Float32Array(capacity);
  const grav = new Float32Array(capacity);
  const drag = new Float32Array(capacity);
  const mode = new Uint8Array(capacity);
  const triples = [pos, vel, rot, spin, col]; // 조각마다 숫자 3개씩 들어 있는 목록들
  const matrixRange = { start: 0, count: 0 }; // 그래픽 카드로 보낼 앞쪽 칸 (돌려 씀)
  const colorRange = { start: 0, count: 0 };
  let count = 0;
  let colorsDirty = false;

  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const scale = new THREE.Vector3();
  const zAxis = new THREE.Vector3(0, 0, 1);
  const direction = new THREE.Vector3();

  function spawn(x, y, z, vx, vy, vz, s, lifetime, color, gravity = 0, airDrag = 0, kind = SPARK) {
    if (count >= capacity) return;
    const i = count++;
    const b = i * 3;
    pos[b] = x;
    pos[b + 1] = y;
    pos[b + 2] = z;
    vel[b] = vx;
    vel[b + 1] = vy;
    vel[b + 2] = vz;
    rot[b] = Math.random() * 6.28;
    rot[b + 1] = Math.random() * 6.28;
    rot[b + 2] = Math.random() * 6.28;
    const spinAmount = kind === PUFF ? 2 : kind === SPARK ? 14 : 0;
    spin[b] = (Math.random() - 0.5) * spinAmount;
    spin[b + 1] = (Math.random() - 0.5) * spinAmount;
    spin[b + 2] = (Math.random() - 0.5) * spinAmount;
    if (kind === FLASH) {
      rot[b] = Math.PI / 4;
      rot[b + 1] = Math.PI / 4;
      rot[b + 2] = 0;
    }
    col[b] = color.r;
    col[b + 1] = color.g;
    col[b + 2] = color.b;
    size[i] = s;
    age[i] = 0;
    life[i] = Math.max(0.01, lifetime);
    grav[i] = gravity;
    drag[i] = airDrag;
    mode[i] = kind;
    colorsDirty = true;
  }

  function removeAt(i) {
    const last = --count;
    if (i === last) return;
    const b = i * 3;
    const l = last * 3;
    for (let k = 0; k < triples.length; k++) {
      const arr = triples[k];
      arr[b] = arr[l];
      arr[b + 1] = arr[l + 1];
      arr[b + 2] = arr[l + 2];
    }
    size[i] = size[last];
    age[i] = age[last];
    life[i] = life[last];
    grav[i] = grav[last];
    drag[i] = drag[last];
    mode[i] = mode[last];
    colorsDirty = true;
  }

  function update(dt) {
    if (count === 0 && mesh.count === 0) return;
    let i = 0;
    while (i < count) {
      age[i] += dt;
      const p = age[i] / life[i];
      if (p >= 1) {
        removeAt(i);
        continue;
      }
      const b = i * 3;
      const slow = drag[i] > 0 ? Math.exp(-drag[i] * dt) : 1;
      vel[b] *= slow;
      vel[b + 1] = vel[b + 1] * slow - grav[i] * dt;
      vel[b + 2] *= slow;
      pos[b] += vel[b] * dt;
      pos[b + 1] += vel[b + 1] * dt;
      pos[b + 2] += vel[b + 2] * dt;
      if (grav[i] > 0 && pos[b + 1] < 0.2) {
        pos[b + 1] = 0.2;
        vel[b + 1] = Math.abs(vel[b + 1]) * 0.35;
        vel[b] *= 0.6;
        vel[b + 2] *= 0.6;
      }
      rot[b] += spin[b] * dt;
      rot[b + 1] += spin[b + 1] * dt;
      rot[b + 2] += spin[b + 2] * dt;
      let s = size[i];
      position.set(pos[b], pos[b + 1], pos[b + 2]);
      if (mode[i] === RAY) {
        // 날아가는 방향으로 길쭉하게, 점점 짧고 가늘어짐
        direction.set(vel[b], vel[b + 1], vel[b + 2]);
        if (direction.lengthSq() > 1e-6) quaternion.setFromUnitVectors(zAxis, direction.normalize());
        const k = 1 - p;
        scale.set(Math.max(0.0001, s * RAY_WIDTH * k), Math.max(0.0001, s * RAY_WIDTH * k), Math.max(0.0001, s * (1 - p * p)));
      } else {
        if (mode[i] === SPARK) s *= 1 - p * p;
        else if (mode[i] === PUFF) s *= Math.sin(Math.PI * Math.pow(p, 0.55));
        else s *= (0.7 + 0.8 * Math.min(1, p * 4)) * (1 - p * p * p);
        quaternion.setFromEuler(euler.set(rot[b], rot[b + 1], rot[b + 2]));
        scale.setScalar(Math.max(0.0001, s));
      }
      matrix.compose(position, quaternion, scale);
      matrix.toArray(mesh.instanceMatrix.array, i * 16);
      i++;
    }
    mesh.count = count;
    mesh.visible = count > 0;
    upload(mesh.instanceMatrix, matrixRange, count * 16);
    if (colorsDirty) {
      const array = mesh.instanceColor.array;
      for (let k = 0, n = count * 3; k < n; k++) array[k] = col[k];
      upload(mesh.instanceColor, colorRange, count * 3);
      colorsDirty = false;
    }
  }

  function clear() {
    count = 0;
    mesh.count = 0;
    mesh.visible = false;
  }

  // 앞쪽 n 칸만 보내기 (three.js addUpdateRange 는 부를 때마다 새 물건을 만들어서 range 를 돌려 씀)
  function upload(attribute, range, n) {
    range.count = Math.max(1, n);
    attribute.updateRanges.length = 0;
    attribute.updateRanges.push(range);
    attribute.needsUpdate = true;
  }

  return {
    spawn,
    update,
    clear,
    get count() {
      return count;
    },
  };
}
