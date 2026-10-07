// 미친토끼 공격 예고 모양 (총구 반짝임, 망치 내려칠 때 튀는 땅 블록)
// 총 토끼가 쏘기 전에 총구 앞에 노랑·분홍 블록 빛이 점점 커지며 깜빡여서 "곧 쏜다!" 를 알려 줍니다.
// 망치 토끼가 쾅 내려치면 잔디·흙 블록이 동그랗게 튀어 오릅니다. (잔해로 남지 않고 사라짐)
//
//   const look = createEnemyLook(scene)
//   look.glow(번호, 위치, 세기 0~1)      총구 빛 하나 그리기 (번호 = 총 토끼마다 다른 수, 세기 0 이면 숨김)
//   look.slamBurst(debris, 위치, 반지름)  망치 자리에서 땅 블록이 튀어 오름 + 바닥에 충격 고리가 퍼짐
//   look.update(dt)                      매 장면 한 번 (이번 장면에 부르지 않은 빛은 숨김)
//   look.clear() / look.dispose()
//
// 빛 크기·색, 튀는 블록 수·세기는 아래 상수에서 바꿉니다. (색은 장난감 블록 색 목록에서 고름)

import * as THREE from '../../lib/three.js';

const GLOW_COUNT = 8; // 동시에 보일 수 있는 총구 빛 수
const GLOW_CORE = 1.3; // 가운데 빛 블록 크기 (세기 1 일 때)
const GLOW_HALO = 2.9; // 바깥 빛 블록 크기
const GLOW_BLINK = 26; // 깜빡이는 빠르기
const GLOW_SPIN = 7; // 빛 블록이 도는 빠르기
const CORE_HEX = '#FFF03A'; // 연노랑
const HALO_HEX = '#FF698F'; // 코랄
const BURST_BLOCKS = 24; // 내려칠 때 튀는 땅 블록 수
const BURST_UP = 17; // 위로 튀는 세기
const BURST_OUT = 11; // 바깥으로 튀는 세기
const RING_COUNT = 3; // 동시에 보일 수 있는 충격 고리 수
const RING_SECONDS = 0.38; // 충격 고리가 퍼지는 시간
const RING_START = 0.25; // 고리 처음 크기 (반지름의 비율)
const RING_END = 1.15; // 고리 마지막 크기 (반지름의 비율)
const RING_Y = 0.3; // 고리 높이 (바닥 돌기 위)
const RING_HEX = '#F4F4F4'; // 흰색
const RING_INNER_HEX = '#E4CD9E'; // 모래색 (안쪽 먼지 원)
const BURST_LIFE = 0.9; // 튄 블록이 사라지기까지 (초)
const BURST_HEXES = ['#4B9F4A', '#237841', '#958A73', '#E4CD9E', '#4B9F4A'];

export function createEnemyLook(scene) {
  const box = new THREE.BoxGeometry(1, 1, 1);
  // 가운데 빛은 바깥 빛 위에 그려서 (renderOrder) 또렷한 노랑으로 보이게
  const coreMaterial = new THREE.MeshBasicMaterial({ color: new THREE.Color(CORE_HEX), transparent: true, opacity: 1, toneMapped: false });
  const haloMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color(HALO_HEX),
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
    toneMapped: false,
  });
  const core = new THREE.InstancedMesh(box, coreMaterial, GLOW_COUNT);
  const halo = new THREE.InstancedMesh(box, haloMaterial, GLOW_COUNT);
  for (const mesh of [core, halo]) {
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.count = 0;
    scene.add(mesh);
  }
  halo.renderOrder = 5;
  core.renderOrder = 6;

  // 충격 고리: 바깥 흰 고리 + 안쪽 모래색 원 (돌려 씀)
  const ringGeometry = new THREE.RingGeometry(0.82, 1, 48).rotateX(-Math.PI / 2);
  const discGeometry = new THREE.CircleGeometry(1, 40).rotateX(-Math.PI / 2);
  const rings = Array.from({ length: RING_COUNT }, () => {
    const make = (geometry, hex) => {
      const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: new THREE.Color(hex), transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
      mesh.visible = false;
      mesh.renderOrder = 4;
      scene.add(mesh);
      return mesh;
    };
    return { edge: make(ringGeometry, RING_HEX), fill: make(discGeometry, RING_INNER_HEX), age: 0, radius: 1, active: false };
  });
  core.name = 'enemyGlowCore';
  halo.name = 'enemyGlowHalo';

  const slots = Array.from({ length: GLOW_COUNT }, () => ({ x: 0, y: 0, z: 0, amount: 0, used: false }));
  const matrix = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const euler = new THREE.Euler();
  const pos = new THREE.Vector3();
  const scl = new THREE.Vector3();
  const burstColors = BURST_HEXES.map((hex) => new THREE.Color(hex));
  const at = new THREE.Vector3();
  const velocity = new THREE.Vector3();
  let time = 0;

  function glow(index, position, amount) {
    const slot = slots[index % GLOW_COUNT];
    slot.x = position.x;
    slot.y = position.y;
    slot.z = position.z;
    slot.amount = Math.max(0, Math.min(1, amount));
    slot.used = true;
  }

  function update(dt) {
    time += dt;
    updateRings(dt);
    let n = 0;
    for (let i = 0; i < GLOW_COUNT; i++) {
      const slot = slots[i];
      if (!slot.used || slot.amount <= 0.01) {
        slot.used = false;
        continue;
      }
      slot.used = false;
      const blink = 0.75 + 0.25 * Math.sin(time * GLOW_BLINK + i);
      const k = slot.amount * blink;
      euler.set(time * GLOW_SPIN * 0.7 + i, time * GLOW_SPIN + i, 0.6);
      quat.setFromEuler(euler);
      pos.set(slot.x, slot.y, slot.z);
      scl.setScalar(GLOW_CORE * k);
      matrix.compose(pos, quat, scl);
      core.setMatrixAt(n, matrix);
      scl.setScalar(GLOW_HALO * Math.sqrt(k));
      matrix.compose(pos, quat, scl);
      halo.setMatrixAt(n, matrix);
      n++;
    }
    core.count = n;
    halo.count = n;
    core.visible = halo.visible = n > 0;
    if (n > 0) {
      core.instanceMatrix.needsUpdate = true;
      halo.instanceMatrix.needsUpdate = true;
    }
  }

  function updateRings(dt) {
    for (const ring of rings) {
      if (!ring.active) continue;
      ring.age += dt;
      const k = Math.min(1, ring.age / RING_SECONDS);
      const ease = 1 - (1 - k) * (1 - k) * (1 - k);
      const r = ring.radius * (RING_START + (RING_END - RING_START) * ease);
      ring.edge.scale.set(r, 1, r);
      ring.fill.scale.set(r * 0.95, 1, r * 0.95);
      ring.edge.material.opacity = 0.9 * (1 - k);
      ring.fill.material.opacity = 0.35 * (1 - k) * (1 - k);
      if (k >= 1) {
        ring.active = false;
        ring.edge.visible = ring.fill.visible = false;
      }
    }
  }

  function shockwave(position, radius) {
    let ring = rings.find((r) => !r.active);
    if (!ring) ring = rings.reduce((a, b) => (a.age > b.age ? a : b));
    ring.active = true;
    ring.age = 0;
    ring.radius = radius;
    for (const mesh of [ring.edge, ring.fill]) {
      mesh.position.set(position.x, RING_Y, position.z);
      mesh.visible = true;
    }
    updateRings(0);
  }

  function slamBurst(debris, position, radius) {
    shockwave(position, radius);
    if (!debris) return;
    for (let i = 0; i < BURST_BLOCKS; i++) {
      const angle = (i / BURST_BLOCKS) * Math.PI * 2 + Math.random() * 0.4;
      const r = radius * (0.25 + Math.random() * 0.55);
      at.set(position.x + Math.sin(angle) * r, 0.6, position.z + Math.cos(angle) * r);
      const out = BURST_OUT * (0.5 + Math.random() * 0.8);
      velocity.set(Math.sin(angle) * out, BURST_UP * (0.6 + Math.random() * 0.7), Math.cos(angle) * out);
      debris.spawn(at, burstColors[i % burstColors.length], velocity, { lifetime: BURST_LIFE, settle: false });
    }
  }

  function clear() {
    for (const ring of rings) {
      ring.active = false;
      ring.edge.visible = ring.fill.visible = false;
    }
    for (const slot of slots) slot.used = false;
    core.count = halo.count = 0;
    core.visible = halo.visible = false;
  }

  function dispose() {
    clear();
    scene.remove(core);
    scene.remove(halo);
    for (const ring of rings) {
      scene.remove(ring.edge);
      scene.remove(ring.fill);
      ring.edge.material.dispose();
      ring.fill.material.dispose();
    }
    ringGeometry.dispose();
    discGeometry.dispose();
    box.dispose();
    coreMaterial.dispose();
    haloMaterial.dispose();
  }

  return { glow, slamBurst, update, clear, dispose };
}
