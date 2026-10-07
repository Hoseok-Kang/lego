// 나무 상자 (총·칼에 맞으면 블록이 톡톡 떨어져 나가다가, 체력이 다 닳으면 와르르 부서짐)
// 상자 블록은 모두 한 묶음(InstancedMesh)으로 그립니다. 떨어진 블록은 크기 0 으로 숨겨서 번호가 바뀌지 않게 합니다.
//
//   const crates = createCrates(scene, { collision, debris, events, list })
//        list: propPlacement.js 의 crates ([{ spec, voxels, box }])
//   crates.list → [{ id, position, hp, maxHp, alive }]       position: 상자 바닥 가운데 (Vector3)
//   crates.damage(crate, 양, 맞은곳) → { broken }
//        맞은 곳 가까이에서 블록 1~3개가 떨어져 나가고(debris), 상자가 움찔 + 하얗게 반짝
//        체력 0 → 남은 블록이 모두 터져 날아가고, 부딪힘이 사라지고, 'crateBroken' 소식
//   crates.update(dt)        움찔 모션
//   crates.reset()           모든 상자를 처음 모습으로 (다시 하기)
//   crates.dispose()
//
// 소식: 'crateHit' { crate, position: 맞은 곳 }, 'crateBroken' { crate, position: 상자 바닥 가운데 }
// 상자 체력은 fightConfig.js 의 crates.hp. 튀는 세기·움찔 크기는 아래 상수에서 바꿉니다.

import * as THREE from '../../lib/three.js';
import { FIGHT } from '../fightConfig.js';
import { createBlockBatch } from '../../game/core/blockAssets.js';

const CHIP_DAMAGE_STEP = 9; // 피해 이만큼마다 블록 한 개 더 떨어짐 (최소 1개, 최대 CHIP_MAX)
const CHIP_MAX = 3;
const CHIP_POWER = 5; // 떨어진 블록이 튀는 세기
const CHIP_UPWARD = 8;
const BREAK_POWER = 9; // 부서질 때 블록이 흩어지는 세기
const BREAK_UPWARD = 11;
const HIT_SECONDS = 0.2; // 맞았을 때 움찔하는 시간
const HIT_SQUASH = 0.14; // 움찔할 때 납작해지는 정도
const HIT_PUSH = 0.35; // 맞은 반대쪽으로 밀리는 거리 (칸)
const HIT_TILT = 0.12; // 맞은 반대쪽으로 기우는 각도 (라디안)
const HIT_FLASH = 0.55; // 하얗게 반짝이는 정도 (0~1)
const AIM_HEIGHT_MAX = 3.5; // 총알이 상자보다 높이 날아와도 이 높이에서 맞은 걸로 봄 (윗줄 블록부터 떨어짐)

export function createCrates(scene, { collision, debris, events, list }) {
  const total = list.reduce((sum, item) => sum + item.voxels.length, 0);
  const batch = createBlockBatch(Math.max(1, total), { castShadow: true, receiveShadow: true });
  const mesh = batch.bodies;
  mesh.name = 'crates';
  mesh.count = total;
  scene.add(mesh);

  const white = new THREE.Color('#F4F4F4');
  const matrix = new THREE.Matrix4();
  const crateMatrix = new THREE.Matrix4();
  const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const axis = new THREE.Vector3();
  const color = new THREE.Color();

  let offset = 0;
  const crates = list.map((item, id) => {
    const { box } = item;
    const crate = {
      id,
      position: new THREE.Vector3((box.minX + box.maxX) / 2, 0, (box.minZ + box.maxZ) / 2),
      hp: FIGHT.crates.hp,
      maxHp: FIGHT.crates.hp,
      alive: true,
      box,
      colliderId: 0,
      start: offset,
      blocks: item.voxels.map((v) => ({ x: v.x, y: v.y, z: v.z, color: new THREE.Color(v.hex), shown: true })),
      hit: 0, // 1 → 0 움찔 진행
      hitX: 0, // 밀리는 방향
      hitZ: 0,
    };
    offset += item.voxels.length;
    return crate;
  });

  function addCollider(crate) {
    crate.colliderId = collision.addBox({ ...crate.box, kind: 'crate', owner: crate });
  }

  // 상자 하나의 블록 위치·색을 다시 씀 (움찔 중이면 기울이고 납작하게, 하얗게)
  function writeCrate(crate) {
    const s = crate.hit;
    const wobble = Math.sin(s * Math.PI); // 0 → 1 → 0
    scale.set(1 + HIT_SQUASH * 0.6 * wobble, 1 - HIT_SQUASH * wobble, 1 + HIT_SQUASH * 0.6 * wobble);
    axis.set(crate.hitZ, 0, -crate.hitX);
    if (axis.lengthSq() > 1e-6) axis.normalize();
    else axis.set(1, 0, 0);
    quaternion.setFromAxisAngle(axis, HIT_TILT * wobble);
    position.set(crate.position.x + crate.hitX * HIT_PUSH * wobble, 0, crate.position.z + crate.hitZ * HIT_PUSH * wobble);
    crateMatrix.compose(position, quaternion, scale);
    const flash = HIT_FLASH * s;
    crate.blocks.forEach((block, i) => {
      const index = crate.start + i;
      if (!block.shown) {
        mesh.setMatrixAt(index, hidden);
        return;
      }
      matrix.makeTranslation(block.x - crate.position.x, block.y, block.z - crate.position.z);
      matrix.premultiply(crateMatrix);
      mesh.setMatrixAt(index, matrix);
      mesh.setColorAt(index, flash > 0 ? color.copy(block.color).lerp(white, flash) : block.color);
    });
    markDirty(crate);
  }

  // 바뀐 부분만 그래픽 카드로 보냄
  function markDirty(crate) {
    mesh.instanceMatrix.addUpdateRange(crate.start * 16, crate.blocks.length * 16);
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.addUpdateRange(crate.start * 3, crate.blocks.length * 3);
      mesh.instanceColor.needsUpdate = true;
    }
  }

  // 맞은 곳에서 가장 가까운 '위가 비어 있는' 블록 n 개 (공중에 떠 있는 블록이 생기지 않게)
  function pickChips(crate, point, n) {
    const shownAt = new Set();
    for (const block of crate.blocks) if (block.shown) shownAt.add(`${block.x},${block.y},${block.z}`);
    const px = point?.x ?? crate.position.x;
    const pz = point?.z ?? crate.position.z;
    const py = Math.min(AIM_HEIGHT_MAX, Math.max(0.5, point?.y ?? AIM_HEIGHT_MAX));
    const candidates = [];
    for (const block of crate.blocks) {
      if (!block.shown || shownAt.has(`${block.x},${block.y + 1},${block.z}`)) continue;
      const d = (block.x - px) ** 2 + (block.y - py) ** 2 + (block.z - pz) ** 2;
      candidates.push({ block, d: d + Math.random() * 0.6 }); // 조금 섞어서 늘 같은 자리만 떨어지지 않게
    }
    candidates.sort((a, b) => a.d - b.d);
    return candidates.slice(0, n).map((c) => c.block);
  }

  function worldBlocks(blocks) {
    return blocks.map((block) => ({ position: new THREE.Vector3(block.x, block.y, block.z), color: block.color.clone() }));
  }

  function damage(crate, amount, point) {
    if (!crate || !crate.alive || !(amount > 0)) return { broken: false };
    crate.hp -= amount;
    const hitPoint = new THREE.Vector3(point?.x ?? crate.position.x, Math.min(AIM_HEIGHT_MAX, point?.y ?? 2), point?.z ?? crate.position.z);
    // 밀리는 방향: 맞은 곳 → 상자 가운데
    const dx = crate.position.x - hitPoint.x;
    const dz = crate.position.z - hitPoint.z;
    const length = Math.hypot(dx, dz) || 1;
    crate.hitX = dx / length;
    crate.hitZ = dz / length;
    crate.hit = 1;

    if (crate.hp <= 0) {
      breakCrate(crate, hitPoint);
      return { broken: true };
    }
    const count = Math.min(CHIP_MAX, Math.max(1, Math.round(amount / CHIP_DAMAGE_STEP)));
    const chips = pickChips(crate, hitPoint, count);
    for (const block of chips) block.shown = false;
    if (chips.length) debris.burst(worldBlocks(chips), { from: hitPoint, power: CHIP_POWER, upward: CHIP_UPWARD });
    writeCrate(crate);
    events?.emit('crateHit', { crate, position: hitPoint });
    return { broken: false };
  }

  function breakCrate(crate, hitPoint) {
    crate.alive = false;
    crate.hp = 0;
    crate.hit = 0;
    const rest = crate.blocks.filter((block) => block.shown);
    for (const block of rest) block.shown = false;
    // 맞은 쪽과 상자 가운데 사이에서 터뜨려서, 맞은 반대쪽으로 더 많이 흩어지게
    const from = new THREE.Vector3((hitPoint.x + crate.position.x) / 2, 1, (hitPoint.z + crate.position.z) / 2);
    debris.burst(worldBlocks(rest), { from, power: BREAK_POWER, upward: BREAK_UPWARD });
    collision.remove(crate.colliderId);
    crate.colliderId = 0;
    writeCrate(crate);
    events?.emit('crateBroken', { crate, position: crate.position.clone() });
  }

  function update(dt) {
    for (const crate of crates) {
      if (crate.hit <= 0) continue;
      crate.hit = Math.max(0, crate.hit - dt / HIT_SECONDS);
      writeCrate(crate);
    }
  }

  function reset() {
    for (const crate of crates) {
      crate.hp = crate.maxHp;
      crate.hit = 0;
      for (const block of crate.blocks) block.shown = true;
      if (!crate.alive || !crate.colliderId) {
        if (crate.colliderId) collision.remove(crate.colliderId);
        addCollider(crate);
      }
      crate.alive = true;
      writeCrate(crate);
    }
  }

  for (const crate of crates) {
    addCollider(crate);
    writeCrate(crate);
  }

  return {
    list: crates,
    damage,
    update,
    reset,
    dispose() {
      for (const crate of crates) if (crate.colliderId) collision.remove(crate.colliderId);
      scene.remove(mesh);
      mesh.dispose();
    },
  };
}
