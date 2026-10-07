// 총알 (내 블록 총 + 미친토끼 총이 같이 씀)
// 총알은 작은 블록 하나. 날아가는 방향으로 빙글 돌고, 뒤로 작은 블록 몇 개와 흐려지는 꼬리가 따라갑니다.
// 매 장면 '지난 자리 → 새 자리' 선분 전체로 맞았는지 계산해서, 빨라도 토끼·벽을 뚫고 지나가지 않습니다.
//   - 총알 하나는 토끼 한 마리만 맞힘. 구르는 중(무적)인 토끼는 그냥 지나감, 맞은 직후 무적이면 '톡' 막힘
//   - 벽·나무·바위에 맞으면 불꽃 + 총알 블록이 튕겨 나감, 나무 상자는 부서짐 (props.damageCrate)
//     소식 bulletBlocked { position, surface: 'wall'|'crate'|'tree'|'deflect', kind: 장애물 종류 그대로 }
//     (바위 → 'wall', 나무 울타리 → 'tree')
//   - 칼을 휘두르면 그 부채꼴 안의 적 총알이 지워짐 (deflect)
//
//   const bullets = createBullets(scene, { collision, props, debris, fx, events })
//   bullets.fire({ from, dir, speed, damage, range, team, hex, knockback, origin }) → 총알 | null
//       from: 총구 위치 (Vector3, 높이 ≈ 5), dir: { x, z } 방향, team: 'player' | 'enemy', hex: 블록 색
//       origin (없어도 됨): 쏜 토끼 가운데 { x, z }. 주면 총알은 '토끼 가운데에서 dir 쪽으로 난 길' 을 날아감
//               (맞았는지는 이 길로 계산, 총구에서 나온 총알 모습은 몇 칸 안에 이 길로 스르륵 모임)
//               → 손에 든 총이 옆에 있어도 겨눈 곳에 맞고, 코앞의 적·벽도 정확히 맞음
//   bullets.update(dt, fighters)       fighters: 내 토끼 + 미친토끼 목록 (죽은 토끼는 알아서 건너뜀)
//   bullets.deflect(origin, facing, 부채꼴각도, 닿는거리, team) → 지운 수   team 이 아닌 총알만 지움
//   bullets.clear()                    (다시 하기)
//   bullets.list                       날아가는 총알 목록 [{ team, position, dir, speed, damage, ... }]
//   bullets.props                      만들 때 받은 props (칼이 상자를 부술 때 씀)
//
// 데미지·빠르기·사거리는 쏘는 쪽(fightConfig.js)에서 정합니다. 아래는 모양(보이는 느낌) 숫자.

import * as THREE from '../../lib/three.js';
import { segmentCircle, wrapAngle } from './combatMath.js';
import { createBulletLook } from './bulletLook.js';

const CAPACITY = 160; // 동시에 날아갈 수 있는 총알 수
const SPIN_SPEED = 11; // 총알이 날아가며 빙글 도는 빠르기 (라디안/초)
const HIT_RADIUS = 0.35; // 총알 굵기 (부딪힘 계산)
const MERGE_DISTANCE = 7; // 총구에서 나온 총알 모습이 이 거리 동안 '토끼 가운데 길' 로 모임
const BOUNCE_SPEED = 8; // 부딪힌 총알 블록이 튕겨 나가는 빠르기
const BOUNCE_UP = 10;
const BOUNCE_LIFE = 0.5; // 튕긴 총알 블록이 사라지기까지 (초, 잔해로 남지 않음)
const DEFLECT_HEX = '#F4F4F4'; // 칼에 막힌 총알 불꽃 색
const DEFLECT_NEAR = 1.5; // 칼 휘두르는 토끼에 이보다 가까운 총알은 방향 상관없이 막음
const CRATE_SEARCH = 4; // 상자 장애물에 주인이 없을 때 이 거리 안의 상자를 찾음
const PASS_MEMORY = 4; // 총알 하나가 기억하는 '피한(구른) 토끼' 수

export function createBullets(scene, { collision = null, props = null, debris = null, fx = null, events = null } = {}) {
  const look = createBulletLook(scene, CAPACITY); // 총알 모양 (bulletLook.js)
  const pool = Array.from({ length: CAPACITY }, createRecord);
  const active = [];

  // 돌려 쓰는 값
  const at = new THREE.Vector3();
  const rayOut = { hit: false, point: { x: 0, z: 0 }, distance: 0, obstacle: null, normal: { x: 0, z: 0 } };
  const sweepFrom = { x: 0, z: 0 };
  const sweepTo = { x: 0, z: 0 };
  const knockFrom = new THREE.Vector3();
  const bounce = new THREE.Vector3();
  const colorCache = new Map();

  function colorOf(hex) {
    let color = colorCache.get(hex);
    if (!color) {
      color = new THREE.Color(hex);
      colorCache.set(hex, color);
    }
    return color;
  }

  // 총구에서 나온 모습이 계산용 길로 모이는 정도 (1 → 0)
  function mergeOf(r) {
    const k = Math.min(1, r.traveled / MERGE_DISTANCE);
    return 1 - k * k * (3 - 2 * k);
  }

  function placeVisual(r) {
    const merge = mergeOf(r);
    r.position.x = r.lx + r.ox * merge;
    r.position.z = r.lz + r.oz * merge;
  }

  // ── 쏘기 ──
  function fire({ from, dir, speed = 40, damage = 0, range = 40, team = 'enemy', hex = '#F2CD37', knockback = 0, origin = null }) {
    if (!from || !dir) return null;
    const length = Math.hypot(dir.x, dir.z);
    if (length < 1e-6) return null;
    const r = pool.find((record) => !record.active);
    if (!r) return null;
    r.active = true;
    r.team = team;
    r.dir.x = dir.x / length;
    r.dir.z = dir.z / length;
    // 맞는 계산용 길: origin 이 있으면 토끼 가운데에서 dir 쪽 (총구와 같은 앞 거리부터 시작)
    if (origin) {
      const along = Math.max(0, (from.x - origin.x) * r.dir.x + (from.z - origin.z) * r.dir.z);
      r.lx = origin.x + r.dir.x * along;
      r.lz = origin.z + r.dir.z * along;
    } else {
      r.lx = from.x;
      r.lz = from.z;
    }
    r.ox = from.x - r.lx; // 총구 ↔ 계산용 길 차이 (날아가며 0 이 됨)
    r.oz = from.z - r.lz;
    r.position.set(from.x, from.y ?? 5, from.z);
    r.speed = Math.max(0.01, speed);
    r.damage = damage;
    r.range = Math.max(0.01, range);
    r.rangeLeft = r.range;
    r.traveled = 0;
    r.knockback = knockback;
    r.hex = hex;
    r.color.copy(colorOf(hex));
    r.spin = Math.random() * Math.PI * 2;
    r.age = 0;
    r.passed.length = 0;
    // 첫 장면은 쏜 토끼 가운데부터 검사 (코앞의 적·벽도 맞음)
    r.sweepX = origin ? origin.x : r.lx;
    r.sweepZ = origin ? origin.z : r.lz;
    active.push(r);
    look.markColors();
    return r;
  }

  // ── 매 장면 ──
  function update(dt, fighters = []) {
    let i = 0;
    while (i < active.length) {
      if (step(active[i], dt, fighters)) i++;
      else removeAt(i);
    }
    look.draw(active);
  }

  // 한 장면 날기. 계속 날면 true, 무언가에 맞아 사라지면 false
  function step(r, dt, fighters) {
    r.age += dt;
    r.spin += SPIN_SPEED * dt;
    const travel = Math.min(r.speed * dt, r.rangeLeft);
    const sx = r.sweepX;
    const sz = r.sweepZ;
    const ex = r.lx + r.dir.x * travel;
    const ez = r.lz + r.dir.z * travel;
    const segX = ex - sx;
    const segZ = ez - sz;
    const segLength = Math.hypot(segX, segZ);

    // 벽·나무·상자: 선분이 처음 닿는 곳
    let tWall = Infinity;
    if (collision && segLength > 1e-6) {
      sweepFrom.x = sx;
      sweepFrom.z = sz;
      sweepTo.x = ex;
      sweepTo.z = ez;
      const hit = collision.raycast(sweepFrom, sweepTo, { radius: HIT_RADIUS, out: rayOut });
      if (hit.hit) tWall = hit.distance / segLength;
    }

    // 토끼: 벽보다 먼저 닿는 가장 가까운 토끼 (구르는 토끼는 지나감)
    for (let guard = 0; guard <= PASS_MEMORY; guard++) {
      let best = null;
      let bestT = tWall;
      for (let k = 0; k < fighters.length; k++) {
        const f = fighters[k];
        if (!f || !f.alive || f.team === r.team || r.passed.includes(f)) continue;
        const t = segmentCircle(sx, sz, segX, segZ, f.position.x, f.position.z, (f.radius || 0) + HIT_RADIUS);
        if (t < bestT || (t === bestT && t !== Infinity && best === null)) {
          best = f;
          bestT = t;
        }
      }
      if (!best) break;
      const px = sx + segX * bestT;
      const pz = sz + segZ * bestT;
      if (best.invulnerable?.() && best.extraInvulnerable?.()) {
        // 구르는 중: 그냥 지나감 (이 총알은 이 토끼를 다시 맞히지 않음)
        if (r.passed.length < PASS_MEMORY) r.passed.push(best);
        else break;
        continue;
      }
      // 밀려나는 방향 = 총알이 날아가는 방향
      knockFrom.set(best.position.x - r.dir.x * (best.radius || 1), r.position.y, best.position.z - r.dir.z * (best.radius || 1));
      const result = best.takeDamage({ amount: r.damage, from: knockFrom, knockback: r.knockback, kind: 'bullet' });
      impact(r, px, pz, -r.dir.x, -r.dir.z, result && result.hit ? 1 : 0.5);
      return false;
    }

    if (tWall <= 1) {
      const px = rayOut.point.x;
      const pz = rayOut.point.z;
      const obstacle = rayOut.obstacle;
      impact(r, px, pz, rayOut.normal.x, rayOut.normal.z, 1);
      const merge = mergeOf(r);
      const point = new THREE.Vector3(px + r.ox * merge, r.position.y, pz + r.oz * merge);
      events?.emit('bulletBlocked', { position: point, surface: surfaceOf(obstacle?.kind), kind: obstacle?.kind ?? 'wall' });
      if (obstacle?.kind === 'crate' && r.damage > 0) {
        const crate = crateOf(obstacle, px, pz);
        if (crate) props.damageCrate(crate, r.damage, point.clone());
      }
      return false;
    }

    r.lx = ex;
    r.lz = ez;
    r.sweepX = ex;
    r.sweepZ = ez;
    r.traveled += travel;
    placeVisual(r);
    r.rangeLeft -= travel;
    return r.rangeLeft > 1e-4;
  }

  // 맞은 자리: 불꽃 + 총알 블록이 튕겨 나감 (normal: 튕겨 나갈 쪽)
  function impact(r, px, pz, nx, nz, power, sparkHex = r.hex) {
    const merge = mergeOf(r);
    at.set(px + r.ox * merge, r.position.y, pz + r.oz * merge);
    fx?.hitSpark?.(at, sparkHex);
    if (!debris) return;
    // 들어온 방향을 면에 비춰 튕김 + 옆으로 조금
    const dot = r.dir.x * nx + r.dir.z * nz;
    let bx = r.dir.x - 2 * dot * nx;
    let bz = r.dir.z - 2 * dot * nz;
    bx += (Math.random() - 0.5) * 0.8;
    bz += (Math.random() - 0.5) * 0.8;
    const b = Math.hypot(bx, bz) || 1;
    bounce.set((bx / b) * BOUNCE_SPEED * power, BOUNCE_UP * (0.7 + Math.random() * 0.5) * power, (bz / b) * BOUNCE_SPEED * power);
    debris.spawn(at, r.color, bounce, { lifetime: BOUNCE_LIFE, settle: false });
  }

  // 상자 장애물 → props 의 상자 (장애물 주인이 상자면 그대로, 아니면 가까운 상자)
  function crateOf(obstacle, px, pz) {
    if (!props?.damageCrate) return null;
    const owner = obstacle.owner;
    if (owner && typeof owner === 'object' && ('hp' in owner || 'alive' in owner)) return owner.alive === false ? null : owner;
    const crates = props.crates || [];
    let best = null;
    let bestD = CRATE_SEARCH;
    for (let i = 0; i < crates.length; i++) {
      const c = crates[i];
      if (!c || c.alive === false || !c.position) continue;
      const d = Math.hypot(c.position.x - px, c.position.z - pz);
      if (d < bestD) {
        best = c;
        bestD = d;
      }
    }
    return best;
  }

  // ── 칼로 막기 ──
  function deflect(origin, facing, arcRad, range, team) {
    let count = 0;
    let i = 0;
    while (i < active.length) {
      const r = active[i];
      if (r.team === team || !inSword(r, origin, facing, arcRad, range)) {
        i++;
        continue;
      }
      // 칼 쪽에서 바깥으로 튕겨 냄
      const dx = r.lx - origin.x;
      const dz = r.lz - origin.z;
      const d = Math.hypot(dx, dz) || 1;
      impact(r, r.lx, r.lz, dx / d, dz / d, 1.1, DEFLECT_HEX);
      events?.emit('bulletBlocked', { position: r.position.clone(), surface: 'deflect', kind: 'deflect' });
      removeAt(i);
      count++;
    }
    return count;
  }

  function inSword(r, origin, facing, arcRad, range) {
    const dx = r.lx - origin.x;
    const dz = r.lz - origin.z;
    const d = Math.hypot(dx, dz);
    if (d > range + HIT_RADIUS) return false;
    if (d <= DEFLECT_NEAR) return true;
    return Math.abs(wrapAngle(Math.atan2(dx, dz) - facing)) <= arcRad / 2 + Math.asin(Math.min(1, HIT_RADIUS / d));
  }

  function removeAt(i) {
    const r = active[i];
    r.active = false;
    r.passed.length = 0;
    const last = active.pop();
    if (i < active.length) active[i] = last;
    look.markColors();
  }

  function clear() {
    while (active.length) removeAt(active.length - 1);
    look.draw(active);
  }

  return {
    fire,
    update,
    deflect,
    clear,
    get list() {
      return active;
    },
    get count() {
      return active.length;
    },
    get props() {
      return props;
    },
  };
}

function createRecord() {
  return {
    active: false,
    team: 'enemy',
    position: new THREE.Vector3(),
    dir: { x: 0, z: 1 },
    speed: 0,
    damage: 0,
    range: 0,
    rangeLeft: 0,
    traveled: 0,
    knockback: 0,
    hex: '#F2CD37',
    color: new THREE.Color(),
    spin: 0,
    age: 0,
    sweepX: 0,
    sweepZ: 0,
    lx: 0, // 맞는 계산용 위치
    lz: 0,
    ox: 0, // 보이는 총알 = 계산용 위치 + 이 차이 × (모이는 정도)
    oz: 0,
    passed: [],
  };
}

// 장애물 종류 → 소리용 겉면 이름 ('wall' | 'crate' | 'tree')
function surfaceOf(kind) {
  if (kind === 'crate' || kind === 'tree') return kind;
  if (kind === 'fence') return 'tree'; // 나무 울타리는 나무 소리
  return 'wall';
}
