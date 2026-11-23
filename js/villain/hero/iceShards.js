// 얼음 화살 (얼음 마법사가 지팡이 끝에서 쏘는 뾰족한 얼음 덩어리)
// 괴수를 따라 휘어 날아가고, 지나간 자리에 반짝이 부스러기를 남깁니다. 맞으면 얼음 조각이 와장창 흩어져요.
// 피해와 '느려짐' 은 쏜 쪽(iceMage.js)이 onHit 에서 줍니다. 여기는 날아가는 모양과 맞았는지만 맡아요.
//
//   const shards = createIceShards(scene, { debris })
//   shards.launch(from, target, { speed, life, onHit(target, position) })   from: Vector3 (지팡이 끝), target: 과녁
//   shards.update(dt) ; shards.clear() ; shards.dispose() ; shards.count (날아가는 수)
//
// 크기·색·반짝이 간격은 아래 상수에서 바꿉니다. (색은 js/bricks/brickColors.js 의 색만)

import * as THREE from '../../lib/three.js';

const POOL = 8; // 한 번에 날아갈 수 있는 얼음 수
const SIZE = 1.6; // 얼음 덩어리 크기 배율 (클수록 멀리서도 잘 보임)
const CORE_HEX = '#F4F4F4'; // 가운데 (흰색)
const SIDE_HEX = '#9FC3E9'; // 둘레 (연하늘)
const DEEP_HEX = '#36AEBF'; // 속 (청록)
const TRAIL_GAP = 0.035; // 반짝이 부스러기 간격 (초)
const SPIN = 9; // 날아가며 도는 빠르기
const HIT_PAD = 0.7; // 과녁 반지름에 더해 닿았다고 보는 거리
const TRAIL_COLORS = [CORE_HEX, SIDE_HEX, SIDE_HEX].map((hex) => new THREE.Color(hex));
const SHATTER_COLORS = [CORE_HEX, SIDE_HEX, DEEP_HEX].map((hex) => new THREE.Color(hex));

export function createIceShards(scene, { debris = null } = {}) {
  const group = new THREE.Group();
  group.name = 'iceShards';
  scene.add(group);
  const box = new THREE.BoxGeometry(1, 1, 1);
  const glow = (hex, strength) => new THREE.MeshStandardMaterial({ color: hex, emissive: hex, emissiveIntensity: strength, roughness: 0.25, metalness: 0 });
  const mats = [glow(CORE_HEX, 0.55), glow(SIDE_HEX, 0.45), glow(DEEP_HEX, 0.35)];
  const pool = [];
  for (let i = 0; i < POOL; i++) {
    const node = new THREE.Group();
    node.scale.setScalar(SIZE);
    const spin = new THREE.Group();
    node.add(spin);
    // 앞(+z)으로 뾰족한 얼음: 긴 흰 심 + 옆 결정 넷 + 뒤쪽 청록
    const add = (mat, sx, sy, sz, x, y, z) => {
      const mesh = new THREE.Mesh(box, mat);
      mesh.scale.set(sx, sy, sz);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      spin.add(mesh);
    };
    add(mats[0], 0.5, 0.5, 1.9, 0, 0, 0.2);
    add(mats[1], 0.36, 0.36, 0.8, 0.42, 0, -0.1);
    add(mats[1], 0.36, 0.36, 0.8, -0.42, 0, -0.1);
    add(mats[1], 0.36, 0.36, 0.8, 0, 0.42, -0.1);
    add(mats[1], 0.36, 0.36, 0.8, 0, -0.42, -0.1);
    add(mats[2], 0.42, 0.42, 0.5, 0, 0, -0.75);
    node.visible = false;
    group.add(node);
    pool.push({ node, spin, active: false, position: new THREE.Vector3(), velocity: new THREE.Vector3(), target: null, age: 0, life: 0, speed: 0, trail: 0, onHit: null });
  }
  const aim = new THREE.Vector3();
  const look = new THREE.Vector3();
  const drift = new THREE.Vector3();

  function launch(from, target, { speed = 24, life = 1.2, onHit = null } = {}) {
    const shard = pool.find((s) => !s.active) || pool[0];
    shard.active = true;
    shard.position.copy(from);
    shard.target = target;
    shard.speed = speed;
    shard.age = 0;
    shard.life = life;
    shard.trail = 0;
    shard.onHit = onHit;
    aimAt(shard);
    shard.velocity.copy(aim).sub(from).normalize().multiplyScalar(speed);
    shard.node.visible = true;
    orient(shard);
    return shard;
  }

  function aimAt(shard) {
    const t = shard.target;
    if (t && t.alive) aim.set(t.position.x, Math.max(1.2, (t.height || 4) * 0.45), t.position.z);
    else aim.copy(shard.position).addScaledVector(shard.velocity, 0.1);
    return aim;
  }

  function orient(shard) {
    shard.node.position.copy(shard.position);
    look.copy(shard.position).add(shard.velocity);
    shard.node.lookAt(look);
  }

  function shatter(shard, power) {
    if (!debris) return;
    for (let i = 0; i < 7; i++) {
      drift.set((Math.random() - 0.5) * power, 2 + Math.random() * power * 0.6, (Math.random() - 0.5) * power);
      debris.spawn(shard.position, SHATTER_COLORS[i % SHATTER_COLORS.length], drift, { lifetime: 0.5 + Math.random() * 0.3, settle: false, scale: 0.35 + Math.random() * 0.25 });
    }
  }

  function retire(shard) {
    shard.active = false;
    shard.node.visible = false;
    shard.target = null;
    shard.onHit = null;
  }

  function update(dt) {
    for (const shard of pool) {
      if (!shard.active) continue;
      shard.age += dt;
      const t = shard.target;
      // 과녁을 따라 휘어 날아감 (과녁이 사라지면 곧장)
      if (t && t.alive) {
        aimAt(shard);
        shard.velocity.lerp(aim.sub(shard.position).normalize().multiplyScalar(shard.speed), Math.min(1, dt * 10));
      }
      shard.position.addScaledVector(shard.velocity, dt);
      shard.spin.rotation.z += SPIN * dt;
      orient(shard);
      shard.trail -= dt;
      if (shard.trail <= 0 && debris) {
        shard.trail = TRAIL_GAP;
        drift.set((Math.random() - 0.5) * 2, 0.5 + Math.random(), (Math.random() - 0.5) * 2);
        debris.spawn(shard.position, TRAIL_COLORS[(Math.random() * TRAIL_COLORS.length) | 0], drift, { lifetime: 0.32, settle: false, scale: 0.28 });
      }
      if (t && t.alive) {
        const flat = Math.hypot(t.position.x - shard.position.x, t.position.z - shard.position.z);
        if (flat <= (t.radius || 1) * 0.85 + HIT_PAD && shard.position.y <= (t.height || 4) + 1.5) {
          const hit = shard.onHit;
          const at = shard.position.clone();
          shatter(shard, 9);
          retire(shard);
          hit?.(t, at);
          continue;
        }
      }
      if (shard.age >= shard.life || shard.position.y < 0.2) {
        shatter(shard, 5);
        retire(shard);
      }
    }
  }

  return {
    launch,
    update,
    clear() {
      for (const shard of pool) retire(shard);
    },
    dispose() {
      group.removeFromParent();
      box.dispose();
      for (const m of mats) m.dispose();
    },
    get count() {
      return pool.filter((s) => s.active).length;
    },
  };
}
