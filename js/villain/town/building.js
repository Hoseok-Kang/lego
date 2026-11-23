// 건물 하나 (맞은 자리부터 블록이 떨어져 나가고, 받침을 잃은 블록은 와르르 떨어지고, 마지막엔 통째로 무너짐)
// 블록은 한 번에 그립니다(InstancedMesh). 건물 묶음(group)을 살짝 기울여 '흔들' 하는 느낌을 냅니다.
//
//   const b = createBuilding(scene, art, { x0, z0, debris, events, fx, hpPerBlock })
//       art: buildingArt.js 의 makeBuilding() 결과, (x0, z0): 건물 왼쪽 뒤 모서리 칸 (정수)
//   b.team('town') / position(바닥 가운데) / radius / height / alive
//   b.kind / name / totalBlocks / remaining
//   b.takeDamage({ amount, from, kind }) → { dead, broken }   from: 때린 쪽 위치 (그쪽 벽부터 떨어져 나감)
//   b.collapse(from?)                 남은 블록을 위에서부터 와르르 무너뜨림
//   b.update(dt) ; b.reset() ; b.dispose()
//   b.topAt(x, z) → 그 칸에 남아 있는 블록 중 가장 높은 윗면 (없으면 0)
//   art.rotor.axis 가 'y' 면 날개가 세로축으로 돎 (등대 불빛), art.bob 이 있으면 물 위 배처럼 둥실둥실 흔들림
//
// 보내는 소식: blocksBroken { count, source: 'building', position, building }, buildingDestroyed { building }
// 느낌 숫자(무너지는 기준, 흔들림 세기 등)는 아래 상수에서 바꿉니다.

import * as THREE from '../../lib/three.js';
import { createBlockBatch } from '../../game/core/blockAssets.js';

const COLLAPSE_RATIO = 0.25; // 블록이 이 비율보다 적게 남으면 나머지가 한꺼번에 무너짐
const COLLAPSE_SECONDS = 0.5; // 위에서부터 다 무너지는 데 걸리는 시간
const HIT_HEIGHT = [1.5, 5.5]; // 맞는 높이 범위 (칸) — 이 사이 아무 높이나 맞음
const CHIP_POWER = 7; // 떨어져 나간 블록이 옆으로 튀는 세기
const CHIP_UP = 8; // 위로 튀는 세기
const WOBBLE_KICK = 0.9; // 맞았을 때 기우뚱하는 세기
const WOBBLE_MAX = 0.07; // 가장 많이 기우는 각도 (라디안)
const WOBBLE_SPRING = 150; // 되돌아오는 힘
const WOBBLE_DAMP = 7; // 흔들림이 잦아드는 빠르기
const SQUASH_KICK = 1.4; // 맞았을 때 꾹 눌리는 세기
const NEIGHBORS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const PAD = 8; // 칸 번호를 만들 때 처마(음수 칸)를 위한 여유
const SPAN = 64;

const cellKey = (x, y, z) => x + PAD + (y + 1) * SPAN + (z + PAD) * SPAN * SPAN;

export function createBuilding(scene, art, { x0 = 0, z0 = 0, debris = null, events = null, fx = null, hpPerBlock = 1 } = {}) {
  const voxels = art.voxels;
  const count = voxels.length;
  const centerX = x0 + art.w / 2;
  const centerZ = z0 + art.d / 2;
  const position = new THREE.Vector3(centerX, 0, centerZ);
  const height = voxels.reduce((top, v) => Math.max(top, v.y + 1), 0);
  const radius = (art.w + art.d) / 4 + 0.3;
  const bob = art.bob || null; // { height, roll, speed } 물 위 흔들림
  const bobPhase = (x0 * 0.37 + z0 * 0.61) % (Math.PI * 2); // 배마다 박자가 조금씩 다르게
  let bobTime = 0;

  // 묶음: 흔들 때 바닥 가운데를 축으로 기울임
  const group = new THREE.Group();
  group.name = `building:${art.kind}`;
  group.position.copy(position);
  scene.add(group);
  const mesh = createBlockBatch(count).bodies;
  mesh.count = count;
  group.add(mesh);

  const gx = new Int16Array(count);
  const gy = new Int16Array(count);
  const gz = new Int16Array(count);
  const alive = new Uint8Array(count);
  const colors = voxels.map((v) => new THREE.Color(v.hex));
  const indexOf = new Map();
  voxels.forEach((v, i) => {
    gx[i] = v.x;
    gy[i] = v.y;
    gz[i] = v.z;
    indexOf.set(cellKey(v.x, v.y, v.z), i);
    mesh.setColorAt(i, colors[i]);
  });
  const matrix = new THREE.Matrix4();
  const ZERO = new THREE.Matrix4().set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
  const localX = (i) => x0 + gx[i] + 0.5 - centerX;
  const localZ = (i) => z0 + gz[i] + 0.5 - centerZ;
  const worldOf = (i) => new THREE.Vector3(x0 + gx[i] + 0.5, gy[i] + 0.5, z0 + gz[i] + 0.5);

  // 돌아가는 날개 (풍차)
  const rotor = art.rotor ? createRotor(art.rotor) : null;
  const totalBlocks = count + (rotor ? rotor.count : 0);

  let remaining = totalBlocks;
  let isAlive = true;
  let bank = 0; // 아직 블록 하나를 못 뗀 남은 피해
  let collapsing = null; // { time, from }
  let tiltX = 0;
  let tiltZ = 0;
  let tiltVX = 0;
  let tiltVZ = 0;
  let squash = 0;
  let squashV = 0;
  let wobbling = false;
  const seen = new Uint8Array(count);
  const stack = new Int32Array(count);
  const order = [];

  function createRotor(def) {
    const pivot = new THREE.Group();
    pivot.position.set(x0 + def.pivot[0] + 0.5 - centerX, def.pivot[1] + 0.5, z0 + def.pivot[2] + 0.5 - centerZ);
    group.add(pivot);
    const blades = createBlockBatch(def.voxels.length).bodies;
    blades.count = def.voxels.length;
    def.voxels.forEach((v, i) => {
      blades.setMatrixAt(i, matrix.makeTranslation(v.x, v.y, v.z));
      blades.setColorAt(i, new THREE.Color(v.hex));
    });
    pivot.add(blades);
    return { def, pivot, mesh: blades, count: def.voxels.length, attached: true, anchor: indexOf.get(cellKey(...def.anchor)) ?? -1 };
  }

  function writeAll() {
    for (let i = 0; i < count; i++) mesh.setMatrixAt(i, alive[i] ? matrix.makeTranslation(localX(i), gy[i] + 0.5, localZ(i)) : ZERO);
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  function reset() {
    alive.fill(1);
    remaining = totalBlocks;
    isAlive = true;
    bank = 0;
    collapsing = null;
    tiltX = tiltZ = tiltVX = tiltVZ = squash = squashV = 0;
    group.rotation.set(0, 0, 0);
    group.scale.set(1, 1, 1);
    group.position.y = 0;
    bobTime = 0;
    mesh.visible = true;
    writeAll();
    if (rotor) {
      rotor.attached = true;
      rotor.mesh.visible = true;
      rotor.mesh.instanceMatrix.needsUpdate = true;
      if (rotor.mesh.instanceColor) rotor.mesh.instanceColor.needsUpdate = true;
    }
  }

  // 블록 i 를 떼어 목록에 담음
  function take(i, list) {
    alive[i] = 0;
    mesh.setMatrixAt(i, ZERO);
    list.push({ position: worldOf(i), color: colors[i] });
  }

  // 바닥 층에서부터 이어진 블록을 표시하고, 이어지지 않은(공중에 뜬) 블록을 모두 떼어 냄
  function dropUnsupported(list) {
    seen.fill(0);
    let top = 0;
    for (let i = 0; i < count; i++) {
      if (alive[i] && gy[i] === 0) {
        seen[i] = 1;
        stack[top++] = i;
      }
    }
    while (top > 0) {
      const i = stack[--top];
      for (const [dx, dy, dz] of NEIGHBORS) {
        const j = indexOf.get(cellKey(gx[i] + dx, gy[i] + dy, gz[i] + dz));
        if (j !== undefined && alive[j] && !seen[j]) {
          seen[j] = 1;
          stack[top++] = j;
        }
      }
    }
    for (let i = 0; i < count; i++) if (alive[i] && !seen[i]) take(i, list);
  }

  // 날개 받침이 사라졌으면 날개를 통째로 떨어뜨림
  function dropRotor(list, force = false) {
    if (!rotor || !rotor.attached) return;
    if (!force && rotor.anchor >= 0 && alive[rotor.anchor]) return;
    rotor.attached = false;
    rotor.mesh.visible = false;
    rotor.pivot.updateWorldMatrix(true, false);
    rotor.def.voxels.forEach((v) => {
      list.push({ position: new THREE.Vector3(v.x, v.y, v.z).applyMatrix4(rotor.pivot.matrixWorld), color: new THREE.Color(v.hex) });
    });
  }

  function report(broken, at) {
    remaining -= broken;
    events?.emit('blocksBroken', { count: broken, source: 'building', position: at, building: api });
  }

  function takeDamage({ amount = 0, from = null } = {}) {
    if (!isAlive || amount <= 0) return { dead: !isAlive, broken: 0 };
    bank += amount;
    const want = Math.floor(bank / hpPerBlock);
    kick(from, Math.min(1, 0.25 + want / 12));
    if (want <= 0) return { dead: false, broken: 0 };
    bank -= want * hpPerBlock;

    // 맞은 점: 때린 쪽에서 가장 가까운 블록 (높이는 아무 데나) → 그 둘레로 want 개
    const hitY = Math.min(height - 0.5, HIT_HEIGHT[0] + Math.random() * (HIT_HEIGHT[1] - HIT_HEIGHT[0]));
    const fx0 = from ? from.x : centerX + (Math.random() - 0.5) * art.w * 2;
    const fz0 = from ? from.z : centerZ + art.d;
    const fy0 = from && from.y > 0.5 ? from.y : hitY;
    let seed = -1;
    let best = Infinity;
    for (let i = 0; i < count; i++) {
      if (!alive[i]) continue;
      const dx = x0 + gx[i] + 0.5 - fx0;
      const dy = (gy[i] + 0.5 - fy0) * 0.8;
      const dz = z0 + gz[i] + 0.5 - fz0;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < best) {
        best = d2;
        seed = i;
      }
    }
    const removed = [];
    if (seed >= 0) {
      order.length = 0;
      for (let i = 0; i < count; i++) {
        if (!alive[i]) continue;
        const dx = gx[i] - gx[seed];
        const dy = gy[i] - gy[seed];
        const dz = gz[i] - gz[seed];
        order.push({ i, d: dx * dx + dy * dy + dz * dz + Math.random() * 1.6 });
      }
      order.sort((a, b) => a.d - b.d);
      for (let k = 0; k < want && k < order.length; k++) take(order[k].i, removed);
    }
    const impact = seed >= 0 ? worldOf(seed) : position.clone();
    const origin = from ? new THREE.Vector3(from.x, impact.y, from.z) : null;
    debris?.burst(removed, { from: origin, power: CHIP_POWER, upward: CHIP_UP });

    // 받침을 잃은 블록·날개는 힘없이 아래로
    const fallen = [];
    dropUnsupported(fallen);
    dropRotor(fallen);
    tumble(fallen, impact);
    mesh.instanceMatrix.needsUpdate = true;
    const broken = removed.length + fallen.length;
    report(broken, impact);
    fx?.hitSpark?.(impact, colors[seed >= 0 ? seed : 0].getStyle());

    if (remaining / totalBlocks < COLLAPSE_RATIO) collapse(from);
    return { dead: !isAlive, broken };
  }

  // 힘없이 떨어지는 블록: 살짝 바깥으로 밀리며 그대로 떨어짐
  function tumble(list, around, push = 2.2) {
    if (!debris) return;
    const velocity = new THREE.Vector3();
    for (const block of list) {
      velocity.set(block.position.x - around.x, 0, block.position.z - around.z);
      if (velocity.lengthSq() < 1e-4) velocity.set(Math.random() - 0.5, 0, Math.random() - 0.5);
      velocity.normalize().multiplyScalar(push * (0.3 + Math.random()));
      velocity.y = 1 + Math.random() * 3;
      debris.spawn(block.position, block.color, velocity);
    }
  }

  function kick(from, strength) {
    const dx = from ? centerX - from.x : Math.random() - 0.5;
    const dz = from ? centerZ - from.z : Math.random() - 0.5;
    const len = Math.hypot(dx, dz) || 1;
    const size = Math.max(4, height); // 높은 건물은 덜 기울어야 같은 만큼 흔들려 보임
    const k = (WOBBLE_KICK * strength * 6) / size;
    tiltVZ += (-dx / len) * k; // z 축으로 돌리면 x 쪽으로 기움
    tiltVX += (dz / len) * k;
    squashV -= SQUASH_KICK * strength;
    wobbling = true;
  }

  function collapse(from = null) {
    if (!isAlive) return;
    isAlive = false;
    collapsing = { time: 0, top: height };
    kick(from, 1);
    events?.emit('buildingDestroyed', { building: api });
  }

  function stepCollapse(dt) {
    collapsing.time += dt;
    const p = Math.min(1, collapsing.time / COLLAPSE_SECONDS);
    const level = Math.floor(height * (1 - p * p)); // 이 높이 위의 블록은 모두 떨어짐 (점점 빨리)
    const fallen = [];
    for (let i = 0; i < count; i++) if (alive[i] && (gy[i] >= level || p >= 1)) take(i, fallen);
    dropRotor(fallen, true);
    if (fallen.length) {
      tumble(fallen, position, 4.5);
      mesh.instanceMatrix.needsUpdate = true;
      report(fallen.length, position.clone().setY(Math.max(0.5, level)));
    }
    if (p >= 1) {
      collapsing = null;
      mesh.visible = false;
      fx?.dust?.(position, Math.max(0.8, radius / 2.5));
    }
  }

  function update(dt) {
    if (rotor && rotor.attached) {
      if (rotor.def.axis === 'y') rotor.pivot.rotation.y += rotor.def.speed * dt;
      else rotor.pivot.rotation.z -= rotor.def.speed * dt;
    }
    if (collapsing) stepCollapse(dt);
    if (bob && isAlive) {
      bobTime += dt;
      const t = bobTime * bob.speed + bobPhase;
      group.position.y = Math.sin(t) * bob.height;
      if (!wobbling) group.rotation.set(Math.sin(t * 0.8) * bob.roll * 0.5, 0, Math.sin(t) * bob.roll);
    }
    if (!wobbling) return;
    // 스프링: 기울었다가 되돌아오며 잦아듦
    const step = Math.min(dt, 1 / 30);
    tiltVX += (-WOBBLE_SPRING * tiltX - WOBBLE_DAMP * tiltVX) * step;
    tiltVZ += (-WOBBLE_SPRING * tiltZ - WOBBLE_DAMP * tiltVZ) * step;
    squashV += (-WOBBLE_SPRING * 1.6 * squash - WOBBLE_DAMP * 1.5 * squashV) * step;
    tiltX = clamp(tiltX + tiltVX * step, -WOBBLE_MAX, WOBBLE_MAX);
    tiltZ = clamp(tiltZ + tiltVZ * step, -WOBBLE_MAX, WOBBLE_MAX);
    squash = clamp(squash + squashV * step, -0.08, 0.08);
    if (Math.abs(tiltX) + Math.abs(tiltZ) + Math.abs(squash) < 0.0015 && Math.abs(tiltVX) + Math.abs(tiltVZ) + Math.abs(squashV) < 0.02) {
      tiltX = tiltZ = tiltVX = tiltVZ = squash = squashV = 0;
      wobbling = false;
    }
    group.rotation.set(tiltX, 0, tiltZ);
    group.scale.set(1 - squash * 0.5, 1 + squash, 1 - squash * 0.5);
  }

  function topAt(x, z) {
    const cx = Math.floor(x) - x0;
    const cz = Math.floor(z) - z0;
    let top = 0;
    for (let y = height - 1; y >= 0; y--) {
      const i = indexOf.get(cellKey(cx, y, cz));
      if (i !== undefined && alive[i]) {
        top = y + 1;
        break;
      }
    }
    return top;
  }

  function dispose() {
    group.removeFromParent();
    mesh.dispose();
    rotor?.mesh.dispose();
  }

  const api = {
    team: 'town',
    kind: art.kind,
    name: art.name,
    position,
    radius,
    height,
    totalBlocks,
    size: { w: art.w, d: art.d },
    origin: { x0, z0 },
    takeDamage,
    collapse,
    update,
    reset,
    topAt,
    dispose,
    get alive() {
      return isAlive;
    },
    get remaining() {
      return remaining;
    },
    get collapsing() {
      return !!collapsing;
    },
  };
  reset();
  return api;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
