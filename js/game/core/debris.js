// 부서진 블록 조각
// 몬스터가 맞거나 성이 공격받을 때 떨어져 나간 블록이 튀어 올랐다가 바닥에 통통 튑니다.
// 바닥에 멈춘 조각은 사라지지 않고 '잔해'로 전장에 남아 있다가, 대장 몬스터가 나올 때 모여서 대장이 됩니다.
// (잔해가 가득 차면 새 조각은 잠깐 뒤에 작아지며 사라집니다)
//
//   const debris = createDebris(scene, { capacity, gravity, lifeSeconds, rubbleCapacity, stack, bounds })
//       stack: true  → 잔해가 블록 크기 칸에 맞춰 반듯하게(돌기가 위로) 놓이고 서로 위에 쌓임 (펑펑 토끼)
//              false → 예전처럼 바닥에 흩어져 누움 (기본, 성 지키기)
//       bounds: { minX, maxX, minZ, maxZ } → 날아가던 조각이 이 벽에 부딪혀 튕겨 돌아옴
//               조각 가장자리가 벽을 넘지 않음 (울타리 안쪽 면 값을 주면 잔해가 울타리 밖·울타리 줄에 남지 않음)
//               null → 벽 없음 (기본, 성 지키기)
//   debris.burst(blocks, { from, power, upward, scale })   blocks: [{ position, color }] (BlockFigure.removeBlocks 결과)
//   debris.spawn(position, color, velocity, { lifetime, settle, scale })  조각 하나 띄우기 (settle: false 면 잔해로 남지 않음)
//                                                   scale: 조각 크기 (1 = 블록 한 칸, 작은 블록 인형에서 떨어진 조각은 더 작게)
//   debris.takeRubble(n)                            바닥에 남은 잔해 n개를 가져감 → [{ position, quaternion, color, scale }]
//   debris.setGroundHeight((x, z) => 높이)           바닥 높이 알려 주기 (성 돌바닥·타워 자리 위는 1)
//   debris.update(dt)
//   debris.clear()
//   debris.count / debris.rubbleCount                날아다니는 조각 수 / 바닥에 남은 잔해 수
//
// 쌓기(stack) 방법: 땅을 반 칸(STACK_CELL) 짜리 칸으로 나누고 칸마다 '쌓인 잔해 윗면 높이'를 숫자 하나로 기억합니다.
//   크기 s 블록은 한 변에 s ÷ 반 칸 개의 칸을 덮고(0.5 블록 → 1칸, 1 블록 → 2×2칸), 땅과 덮는 칸 중 가장 높은 곳에 얹힌 뒤
//   그 칸들을 '얹힌 높이 + s' 로 올립니다. 날아다니는 조각도 '땅과 더미 중 높은 쪽' 을 바닥으로 보고 그 위에서 튑니다.
//   더미 위에 얹힌 조각은 옆 칸이 많이 낮으면 그쪽으로 미끄러져 내려가서, 가는 탑 대신 소복한 더미가 됩니다.
//   잔해를 가져가면(takeRubble) 남은 잔해로 더미 높이를 처음부터 다시 셉니다 (가끔 한 번이라 가볍고, 늘 정확함).

import * as THREE from '../../lib/three.js';
import { createBlockBatch } from './blockAssets.js';

const HALF = 0.48; // 블록 절반 높이 (바닥에 닿는 높이)
const SETTLE_SPEED = 0.25; // 이보다 느리게 바닥에 누워 있으면 잔해가 됨
const SETTLE_AGE = 0.35; // 튀어나온 뒤 최소 이만큼은 날아다님 (초)
const STACK_CELL = 0.5; // 쌓기 칸 크기 (가장 작은 토끼 블록 하나 = 반 칸)
const STACK_REACH = 64; // 벽(bounds)이 없을 때 쌓기 칸을 만드는 범위 (가운데에서 ± 이만큼)
const STACK_STEP = 0.2; // 옆 칸 더미가 이보다 높으면 '옆면'에 부딪힌 것 → 뚫고 올라타지 않고 튕겨 나옴
const SLIDE_DROP = 1.5; // 더미 위 조각 옆 칸이 블록 이만큼(개)보다 낮으면 그쪽으로 미끄러져 내려감 (작을수록 납작한 더미)
const SLIDE_SPEED = 3; // 더미에서 미끄러져 내려가는 빠르기 (초당 칸)
const BOUNCE_BACK = 0.3; // 벽·더미 옆면에 부딪힌 조각이 튕겨 돌아오는 세기 (1 = 그대로)
const TWO_PI = Math.PI * 2;

export function createDebris(scene, { capacity, gravity, lifeSeconds, rubbleCapacity = 0, stack = false, bounds = null }) {
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
  const size = new Float32Array(capacity); // 조각 크기 (1 = 블록 한 칸)
  let count = 0;

  // 바닥에 남은 잔해
  const rubbleCap = Math.max(1, rubbleCapacity);
  const rubblePos = new Float32Array(rubbleCap * 3);
  const rubbleQuat = new Float32Array(rubbleCap * 4);
  const rubbleSize = new Float32Array(rubbleCap);
  let rubbleCount = 0;
  let rubbleDirty = false;
  let rubbleFirst = Infinity; // 이번에 새로 놓인 잔해 중 가장 앞 번호 (여기부터 끝까지만 그래픽 카드로 보냄)
  let groundHeight = () => 0;

  // 그래픽 카드로 보낼 범위 (three.js 의 addUpdateRange 는 부를 때마다 새 물건을 만들어서, 미리 만든 것을 돌려 씀)
  const flyMatrixRange = { start: 0, count: 0 };
  const flyColorRange = { start: 0, count: 0 };
  const rubbleMatrixRange = { start: 0, count: 0 };
  const rubbleColorRange = { start: 0, count: 0 };

  // 쌓기 칸 (stack 일 때만): 칸마다 쌓인 잔해 윗면 높이 (-Infinity = 아무것도 없음)
  const area = bounds ?? { minX: -STACK_REACH, maxX: STACK_REACH, minZ: -STACK_REACH, maxZ: STACK_REACH };
  const cellX0 = Math.floor(area.minX / STACK_CELL) - 2; // 맨 왼쪽 칸 번호 (가장자리 여유 2칸)
  const cellZ0 = Math.floor(area.minZ / STACK_CELL) - 2;
  const cols = Math.ceil(area.maxX / STACK_CELL) + 2 - cellX0;
  const rows = Math.ceil(area.maxZ / STACK_CELL) + 2 - cellZ0;
  const pile = stack ? new Float32Array(cols * rows).fill(-Infinity) : null;
  const rubbleTop = stack ? new Float32Array(rubbleCap) : null; // 잔해마다 윗면 높이 (더미를 다시 셀 때 씀)
  let uprightX = 0; // uprightAngles() 결과 (새 물건을 만들지 않으려고 여기에 담음)
  let uprightZ = 0;

  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const scale = new THREE.Vector3();
  const color = new THREE.Color();

  function spawn(at, blockColor, velocity, { lifetime = lifeSeconds, settle = true, scale: blockScale = 1 } = {}) {
    if (count >= capacity) return; // 너무 많으면 새 조각은 생략
    const i = count++;
    pos.set([at.x, at.y, at.z], i * 3);
    vel.set([velocity.x, velocity.y, velocity.z], i * 3);
    rot.set([0, 0, 0], i * 3);
    spin.set([(Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14, (Math.random() - 0.5) * 14], i * 3);
    age[i] = 0;
    life[i] = lifetime * (0.75 + Math.random() * 0.5);
    canSettle[i] = settle ? 1 : 0;
    size[i] = blockScale;
    mesh.setColorAt(i, blockColor);
    colorsDirty = true;
  }

  function burst(blocks, { from = null, power = 6, upward = 7, scale: blockScale = 1 } = {}) {
    const direction = new THREE.Vector3();
    for (const block of blocks) {
      if (from) direction.subVectors(block.position, from).setY(0);
      if (!from || direction.lengthSq() < 1e-4) direction.set(Math.random() - 0.5, 0, Math.random() - 0.5);
      direction.normalize().multiplyScalar(power * (0.5 + Math.random()));
      direction.y = upward * (0.6 + Math.random() * 0.8);
      direction.x += (Math.random() - 0.5) * power * 0.6;
      direction.z += (Math.random() - 0.5) * power * 0.6;
      spawn(block.position, block.color, direction, { scale: blockScale });
    }
  }

  function update(dt) {
    if (rubbleDirty) flushRubble();
    if (count === 0 && lastCount === 0) return; // 날아다니는 조각이 없으면 할 일 없음
    let i = 0;
    while (i < count) {
      age[i] += dt;
      const b = i * 3;
      const floor = floorAt(pos[b], pos[b + 2], size[i]);
      const resting = vel[b + 1] === 0 && Math.abs(vel[b]) + Math.abs(vel[b + 2]) < SETTLE_SPEED;
      if (resting && canSettle[i] && age[i] > SETTLE_AGE && pos[b + 1] <= floor + 0.01 && rubbleCount < rubbleCapacity) {
        // 쌓기: 더미가 밑에서 자라 위로 밀려 올라간 조각도, 옆이 많이 낮으면 멈추지 않고 미끄러져 내려감
        if (!pile || !slideOffPile(b, size[i], floor)) {
          settle(i, floor);
          continue;
        }
      }
      if (age[i] >= life[i]) {
        removeAt(i);
        continue;
      }
      const fromX = pos[b];
      const fromY = pos[b + 1];
      const fromZ = pos[b + 2];
      vel[b + 1] -= gravity * dt;
      pos[b] += vel[b] * dt;
      pos[b + 1] += vel[b + 1] * dt;
      pos[b + 2] += vel[b + 2] * dt;
      if (bounds) keepInside(b, size[i]);
      // 쌓기: 옮긴 자리의 바닥(땅 + 더미)을 다시 봄 (안 쌓을 때는 예전처럼 옮기기 전 자리의 바닥)
      const ground = pile ? floorAfterMove(b, size[i], fromX, fromY, fromZ, floor) : floor;
      if (pos[b + 1] < ground) {
        pos[b + 1] = ground;
        // 한 장면이 길면(느린 기기·빠른 속도) 한 번에 더 빨리 떨어지므로 '멈춤' 기준도 같이 키움
        const restSpeed = Math.max(1.5, gravity * dt * 1.6);
        vel[b + 1] = Math.abs(vel[b + 1]) < restSpeed ? 0 : -vel[b + 1] * 0.35;
        vel[b] *= 0.6;
        vel[b + 2] *= 0.6;
        spin[b] *= 0.5;
        spin[b + 1] *= 0.5;
        spin[b + 2] *= 0.5;
        if (vel[b + 1] === 0) {
          // 바닥에 누우면 가장 가까운 평평한 면으로 천천히 바로 눕힘 (쌓을 때는 돌기가 위를 보게 세움)
          const ease = Math.min(1, dt * 8);
          if (pile) {
            uprightAngles(rot[b], rot[b + 2]);
            rot[b] += (uprightX - rot[b]) * ease;
            rot[b + 1] += (snapAngle(rot[b + 1]) - rot[b + 1]) * ease;
            rot[b + 2] += (uprightZ - rot[b + 2]) * ease;
            slideOffPile(b, size[i], ground);
          } else {
            for (let k = 0; k < 3; k++) rot[b + k] += (snapAngle(rot[b + k]) - rot[b + k]) * ease;
          }
        }
      }
      rot[b] += spin[b] * dt;
      rot[b + 1] += spin[b + 1] * dt;
      rot[b + 2] += spin[b + 2] * dt;

      const remaining = life[i] - age[i];
      const s = (remaining < 0.35 ? Math.max(0.01, remaining / 0.35) : 1) * size[i];
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
    markUpload(mesh.instanceMatrix, flyMatrixRange, 0, Math.max(1, count) * 16);
    if (colorsDirty && mesh.instanceColor) {
      markUpload(mesh.instanceColor, flyColorRange, 0, Math.max(1, count) * 3);
      colorsDirty = false;
    }
    if (rubbleDirty) flushRubble();
  }

  // 조각 가운데가 (x, z) 에 있을 때 바닥에 닿는 높이 (땅과 쌓인 더미 중 높은 쪽 + 블록 절반)
  function floorAt(x, z, blockSize) {
    if (!pile) return groundHeight(x, z) + HALF * blockSize;
    return Math.max(groundHeight(x, z), pileUnder(x, z, cellsPerSide(blockSize))) + HALF * blockSize;
  }

  // 쌓기: 잔해 위에 얹힌 조각은 옆 칸이 블록 SLIDE_DROP 개보다 낮으면 그쪽으로 미끄러져 내려감 (뾰족한 탑 대신 소복한 더미)
  //       땅(돌담 위 포함)에 바로 닿은 조각은 그대로. 미끄러지기 시작했으면 true
  function slideOffPile(b, blockSize, floorHere) {
    const x = pos[b];
    const z = pos[b + 2];
    const n = cellsPerSide(blockSize);
    if (pileUnder(x, z, n) <= groundHeight(x, z)) return false;
    const span = n * STACK_CELL;
    const half = HALF * blockSize;
    let best = floorHere - SLIDE_DROP * blockSize;
    let toX = 0;
    let toZ = 0;
    for (let k = 0; k < 4; k++) {
      const dx = k === 0 ? 1 : k === 1 ? -1 : 0;
      const dz = k === 2 ? 1 : k === 3 ? -1 : 0;
      const nx = x + dx * span;
      const nz = z + dz * span;
      if (bounds && (nx < bounds.minX + half || nx > bounds.maxX - half || nz < bounds.minZ + half || nz > bounds.maxZ - half)) continue;
      const there = floorAt(nx, nz, blockSize);
      if (there < best) {
        best = there;
        toX = dx;
        toZ = dz;
      }
    }
    if (toX === 0 && toZ === 0) return false;
    vel[b] = toX * SLIDE_SPEED;
    vel[b + 2] = toZ * SLIDE_SPEED;
    return true;
  }

  // 쌓기: 옆 칸 더미가 지금 조각보다 높으면 더미 옆면에 부딪힌 것 → 옆으로는 못 가고 튕겨 나옴
  //       (위에서 떨어지는 조각은 그대로 더미 위에 얹힘)
  function floorAfterMove(b, blockSize, fromX, fromY, fromZ, floorBefore) {
    const after = floorAt(pos[b], pos[b + 2], blockSize);
    if (after > floorBefore + STACK_STEP && fromY < after - STACK_STEP) {
      pos[b] = fromX;
      pos[b + 2] = fromZ;
      vel[b] *= -BOUNCE_BACK;
      vel[b + 2] *= -BOUNCE_BACK;
      return floorBefore;
    }
    return after;
  }

  // 벽(bounds) 밖으로 나가려는 조각은 벽 안쪽에 세우고 튕겨 돌려보냄
  function keepInside(b, blockSize) {
    const half = HALF * blockSize;
    if (pos[b] < bounds.minX + half) {
      pos[b] = bounds.minX + half;
      if (vel[b] < 0) vel[b] *= -BOUNCE_BACK;
    } else if (pos[b] > bounds.maxX - half) {
      pos[b] = bounds.maxX - half;
      if (vel[b] > 0) vel[b] *= -BOUNCE_BACK;
    }
    if (pos[b + 2] < bounds.minZ + half) {
      pos[b + 2] = bounds.minZ + half;
      if (vel[b + 2] < 0) vel[b + 2] *= -BOUNCE_BACK;
    } else if (pos[b + 2] > bounds.maxZ - half) {
      pos[b + 2] = bounds.maxZ - half;
      if (vel[b + 2] > 0) vel[b + 2] *= -BOUNCE_BACK;
    }
  }

  // 쌓기 칸: (x, z) 에 놓이는 크기 n칸 블록이 덮는 칸들 중 가장 높은 잔해 윗면 (없으면 -Infinity)
  function pileUnder(x, z, n) {
    const span = n * STACK_CELL;
    const col0 = Math.floor(x / span) * n - cellX0;
    const row0 = Math.floor(z / span) * n - cellZ0;
    let top = -Infinity;
    for (let row = row0; row < row0 + n; row++) {
      if (row < 0 || row >= rows) continue;
      for (let col = col0; col < col0 + n; col++) {
        if (col < 0 || col >= cols) continue;
        const h = pile[row * cols + col];
        if (h > top) top = h;
      }
    }
    return top;
  }

  // 쌓기 칸: 블록이 덮는 칸들의 더미 높이를 적어도 top 까지 올림
  function raisePile(x, z, n, top) {
    const span = n * STACK_CELL;
    const col0 = Math.floor(x / span) * n - cellX0;
    const row0 = Math.floor(z / span) * n - cellZ0;
    for (let row = row0; row < row0 + n; row++) {
      if (row < 0 || row >= rows) continue;
      for (let col = col0; col < col0 + n; col++) {
        if (col < 0 || col >= cols) continue;
        if (pile[row * cols + col] < top) pile[row * cols + col] = top;
      }
    }
  }

  // 잔해가 줄면 남은 잔해로 더미 높이를 처음부터 다시 셈 (놓인 순서대로 → 위에 놓인 것이 늘 더 높음)
  function rebuildPile() {
    pile.fill(-Infinity);
    for (let r = 0; r < rubbleCount; r++) raisePile(rubblePos[r * 3], rubblePos[r * 3 + 2], cellsPerSide(rubbleSize[r]), rubbleTop[r]);
  }

  // 블록 크기 칸에 맞춘 가운데 자리 (크기 1 블록 → 바닥 돌기 바로 위). 벽이 있으면 벽 안쪽 칸으로
  function snapToCells(value, span, half, min, max) {
    let snapped = (Math.floor(value / span) + 0.5) * span;
    if (bounds) {
      if (snapped - half < min) snapped += span;
      else if (snapped + half > max) snapped -= span;
    }
    return snapped;
  }

  // 돌기가 위를 보는 가장 가까운 기울기 (x·z 둘 다 0바퀴 또는 둘 다 반 바퀴 = 똑바로 선 블록)
  function uprightAngles(ax, az) {
    const evenX = Math.round(ax / TWO_PI) * TWO_PI;
    const evenZ = Math.round(az / TWO_PI) * TWO_PI;
    const oddX = Math.round((ax - Math.PI) / TWO_PI) * TWO_PI + Math.PI;
    const oddZ = Math.round((az - Math.PI) / TWO_PI) * TWO_PI + Math.PI;
    const even = Math.abs(ax - evenX) + Math.abs(az - evenZ) <= Math.abs(ax - oddX) + Math.abs(az - oddZ);
    uprightX = even ? evenX : oddX;
    uprightZ = even ? evenZ : oddZ;
  }

  // 바닥에 멈춘 조각을 잔해로 옮김 (평평하게 눕히고 더 이상 움직이지 않음)
  // 쌓기: 블록 크기 칸에 맞춰 반듯하게 세우고, 그 칸의 더미 위에 얹은 뒤 더미를 블록 크기만큼 높임
  function settle(i, floor) {
    const b = i * 3;
    const blockSize = size[i];
    const r = rubbleCount++;
    let x = pos[b];
    let y = floor;
    let z = pos[b + 2];
    if (pile) {
      const n = cellsPerSide(blockSize);
      const span = n * STACK_CELL;
      const half = HALF * blockSize;
      x = snapToCells(x, span, half, area.minX, area.maxX);
      z = snapToCells(z, span, half, area.minZ, area.maxZ);
      const base = Math.max(groundHeight(x, z), pileUnder(x, z, n));
      y = base + half;
      rubbleTop[r] = base + blockSize;
      raisePile(x, z, n, rubbleTop[r]);
      uprightAngles(rot[b], rot[b + 2]);
      euler.set(uprightX, snapAngle(rot[b + 1]), uprightZ);
    } else {
      euler.set(snapAngle(rot[b]), snapAngle(rot[b + 1]), snapAngle(rot[b + 2]));
    }
    rotation.setFromEuler(euler);
    rubblePos[r * 3] = x;
    rubblePos[r * 3 + 1] = y;
    rubblePos[r * 3 + 2] = z;
    rubbleQuat[r * 4] = rotation.x;
    rubbleQuat[r * 4 + 1] = rotation.y;
    rubbleQuat[r * 4 + 2] = rotation.z;
    rubbleQuat[r * 4 + 3] = rotation.w;
    rubbleSize[r] = blockSize;
    position.set(x, y, z);
    scale.setScalar(blockSize);
    matrix.compose(position, rotation, scale);
    mesh.getColorAt(i, color);
    rubbleMesh.setMatrixAt(r, matrix);
    rubbleMesh.setColorAt(r, color);
    if (r < rubbleFirst) rubbleFirst = r;
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
        scale: rubbleSize[r],
      });
    }
    if (amount > 0) {
      rubbleDirty = true;
      if (pile) rebuildPile();
    }
    return taken;
  }

  // 잔해 그리기 정보 맞추기: 새로 놓인 잔해(rubbleFirst ~ 끝)만 그래픽 카드로 보냄. 줄기만 했으면 보낼 것 없음
  function flushRubble() {
    rubbleDirty = false;
    rubbleMesh.count = rubbleCount;
    rubbleMesh.visible = rubbleCount > 0;
    if (rubbleFirst < rubbleCount) {
      markUpload(rubbleMesh.instanceMatrix, rubbleMatrixRange, rubbleFirst * 16, rubbleCount * 16);
      if (rubbleMesh.instanceColor) markUpload(rubbleMesh.instanceColor, rubbleColorRange, rubbleFirst * 3, rubbleCount * 3);
    }
    rubbleFirst = Infinity;
  }

  // i번째 조각을 지우고 맨 끝 조각을 그 자리로 옮김
  function removeAt(i) {
    const last = count - 1;
    if (i !== last) {
      pos.copyWithin(i * 3, last * 3, last * 3 + 3);
      vel.copyWithin(i * 3, last * 3, last * 3 + 3);
      rot.copyWithin(i * 3, last * 3, last * 3 + 3);
      spin.copyWithin(i * 3, last * 3, last * 3 + 3);
      age[i] = age[last];
      life[i] = life[last];
      canSettle[i] = canSettle[last];
      size[i] = size[last];
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
    if (pile) pile.fill(-Infinity);
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

// 쌓기: 크기 s 블록이 한 변에 덮는 칸 수 (0.5 → 1칸, 0.675·1 → 2칸. 칸보다 조금 큰 블록은 한 칸 더 써서 옆 블록과 겹치지 않게)
function cellsPerSide(blockSize) {
  return Math.max(1, Math.ceil(blockSize / STACK_CELL - 0.05));
}

// 그래픽 카드로 보낼 칸 [first, end) 표시 (미리 만든 range 하나를 돌려 씀)
// 아직 그리기 전에 또 불리면(보내기 전) 앞의 범위와 합쳐서, 한 번 그릴 때 빠짐없이 보냄
function markUpload(attribute, range, first, end) {
  const ranges = attribute.updateRanges;
  if (ranges.length > 0 && ranges[0] === range) {
    const stop = Math.max(range.start + range.count, end);
    range.start = Math.min(range.start, first);
    range.count = stop - range.start;
  } else {
    range.start = first;
    range.count = end - first;
    ranges.push(range);
  }
  attribute.needsUpdate = true;
}

function snapAngle(angle) {
  return Math.round(angle / (Math.PI / 2)) * (Math.PI / 2);
}
