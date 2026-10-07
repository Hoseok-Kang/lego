// 부딪힘 계산 (땅 위 평면 x·z 에서만 계산)
// 벽·상자·나무·바위·울타리 같은 '움직이지 않는 장애물'을 모아 두고,
//   - 토끼(동그라미)가 움직일 때 장애물을 뚫지 않고 미끄러지듯 비켜 가게 하고
//   - 총알 길(선분)이 처음 부딪히는 장애물을 정확히 찾습니다.
// three.js 를 쓰지 않아서 node 에서도 바로 시험할 수 있습니다. 위치는 { x, z } 만 있으면 됩니다.
//
//   const world = createCollisionWorld({ bounds: { minX, maxX, minZ, maxZ } })   bounds: 전장 바깥 경계
//   world.addBox({ minX, maxX, minZ, maxZ, height, kind, owner }) → id     네모 장애물 (벽·상자·울타리)
//   world.addCircle({ x, z, radius, height, kind, owner }) → id           동그란 장애물 (나무·바위)
//   world.remove(id)                                                      장애물 빼기 (부서진 상자)
//   world.moveCircle(position, radius, delta) → { blocked, normal }
//        position 을 delta { x, z } 만큼 옮김 (position 을 직접 고침). 장애물·경계에 닿으면 미끄러짐
//        blocked: 가려던 거리의 절반도 못 감 / normal: 밀려난 방향 { x, z } (안 닿았으면 null)
//   world.raycast(from, to, { radius = 0, ignoreKinds = [], out }) → { hit, point, distance, obstacle, normal }
//        from → to 선분이 처음 닿는 장애물 (radius 를 주면 그 굵기의 동그라미가 지나가는 길)
//        point: 닿았을 때 (동그라미) 가운데 위치, normal: 닿은 면이 바라보는 방향
//   world.lineOfSight(a, b) → 참/거짓      a 에서 b 가 보이는지 ('bush' 는 무시)
//   world.overlapsCircle(x, z, radius) → 장애물 | null
//   world.randomFreePoint(radius, rng = Math.random) → { x, z }   장애물과 겹치지 않는 빈자리
//   world.get(id) / world.obstacles (목록) / world.bounds / world.clear()
//
// 장애물 종류(kind): 'wall' | 'crate' | 'tree' | 'rock' | 'fence' ('bush' 는 lineOfSight 가 무시)
// 높이(height)는 적어 두기만 합니다. 총알은 모든 장애물에 막힌다고 봅니다. (간단하게)
//
// 뚫고 지나가지 않게: 한 번에 멀리 움직이면 반지름의 절반보다 짧은 걸음으로 나눠서 움직입니다.
// 떨지 않게: 이미 닿아 있는 면 쪽으로 가는 걸음은 미리 깎고, 새로 파고든 만큼만 밀어냅니다.

import { penetration, rayCircle, sweptBox, surfaceNormal } from '../world/collisionMath.js';

const STEP_FRACTION = 0.45; // 한 걸음 = 반지름 × 이 값 (작을수록 정확하지만 계산이 늘어남)
const MAX_STEPS = 2048; // 한 번에 나누는 걸음 수 최대 (순간이동처럼 아주 먼 이동 대비)
const RESOLVE_PASSES = 8; // 겹침을 풀 때 되풀이 횟수 (한 번에 가장 깊이 파고든 장애물 하나씩)
const SKIN = 1e-4; // 밀어낼 때 살짝 더 밀어서 다음에 바로 다시 닿지 않게
const STUCK_DEPTH = 0.001; // 이보다 많이 겹친 채로 남으면 이번 걸음을 취소함 (좁은 틈에 끼어 떨지 않게)
const BLOCKED_PROGRESS = 0.5; // 가려던 거리 중 이만큼도 못 가면 blocked
const CONTACT_GAP = 0.01; // 이만큼 가까우면 '닿아 있음'으로 봄 (그쪽으로는 더 움직이지 않음)
const MAX_CONTACTS = 8; // 한꺼번에 닿을 수 있는 면 수
const SLIDE_TRIES = 3; // 한 걸음 안에서 '닿고 → 깎고 → 다시 가기' 최대 횟수

export function createCollisionWorld({ bounds }) {
  const area = { ...bounds };
  const byId = new Map();
  let list = [];
  let nextId = 1;

  // 매번 새 물건을 만들지 않으려고 돌려 쓰는 칸
  const push = { x: 0, z: 0, depth: 0 };
  const deep = { x: 0, z: 0, depth: 0 };
  const contact = { x: 0, z: 0, any: false };
  const step = { x: 0, z: 0 };
  const normals = new Float64Array(MAX_CONTACTS * 2);
  let normalCount = 0;
  const scratchHit = { hit: false, point: { x: 0, z: 0 }, distance: 0, obstacle: null, normal: { x: 0, z: 0 } };

  function add(obstacle) {
    obstacle.id = nextId++;
    obstacle.kind = obstacle.kind ?? 'wall';
    obstacle.owner = obstacle.owner ?? null;
    obstacle.height = obstacle.height ?? 3;
    byId.set(obstacle.id, obstacle);
    list = Array.from(byId.values());
    return obstacle.id;
  }

  function addBox({ minX, maxX, minZ, maxZ, height, kind, owner }) {
    return add({
      shape: 'box',
      minX: Math.min(minX, maxX),
      maxX: Math.max(minX, maxX),
      minZ: Math.min(minZ, maxZ),
      maxZ: Math.max(minZ, maxZ),
      height,
      kind,
      owner,
    });
  }

  function addCircle({ x, z, radius, height, kind, owner }) {
    return add({ shape: 'circle', x, z, radius, minX: x - radius, maxX: x + radius, minZ: z - radius, maxZ: z + radius, height, kind, owner });
  }

  function remove(id) {
    if (!byId.delete(id)) return false;
    list = Array.from(byId.values());
    return true;
  }

  // 겹친 장애물·경계에서 밀어냄. 다 풀지 못하고 남은 겹침 깊이(가장 큰 값)를 돌려줌
  // 가장 깊이 파고든 장애물부터 하나씩 밀어냄 → 나란히 붙은 상자 이음매에서 옆으로 튀지 않음
  function resolve(p, r) {
    for (let pass = 0; pass < RESOLVE_PASSES; pass++) {
      if (!deepest(p.x, p.z, r)) {
        if (!clampToBounds(p, r)) return 0;
        continue;
      }
      p.x += deep.x * (deep.depth + SKIN);
      p.z += deep.z * (deep.depth + SKIN);
      contact.x += deep.x;
      contact.z += deep.z;
      contact.any = true;
      clampToBounds(p, r);
    }
    return deepest(p.x, p.z, r) ? deep.depth : 0;
  }

  // 가장 깊이 파고든 장애물 → deep 에 { 방향, 깊이 } (없으면 false)
  function deepest(px, pz, r) {
    deep.depth = 0;
    for (let i = 0; i < list.length; i++) {
      if (!penetration(list[i], px, pz, r, push) || push.depth <= deep.depth) continue;
      deep.x = push.x;
      deep.z = push.z;
      deep.depth = push.depth;
    }
    return deep.depth > 0;
  }

  // 경계 밖으로 나가지 않게 붙잡음 (붙잡았으면 true)
  function clampToBounds(p, r) {
    let moved = false;
    const lowX = area.minX + r;
    const highX = area.maxX - r;
    const lowZ = area.minZ + r;
    const highZ = area.maxZ - r;
    if (lowX > highX) p.x = (area.minX + area.maxX) / 2;
    else if (p.x < lowX) {
      p.x = lowX;
      contact.x += 1;
      moved = true;
    } else if (p.x > highX) {
      p.x = highX;
      contact.x -= 1;
      moved = true;
    }
    if (lowZ > highZ) p.z = (area.minZ + area.maxZ) / 2;
    else if (p.z < lowZ) {
      p.z = lowZ;
      contact.z += 1;
      moved = true;
    } else if (p.z > highZ) {
      p.z = highZ;
      contact.z -= 1;
      moved = true;
    }
    if (moved) contact.any = true;
    return moved;
  }

  function moveCircle(position, radius, delta) {
    const dx = delta?.x || 0;
    const dz = delta?.z || 0;
    const wanted = Math.hypot(dx, dz);
    const startX = position.x;
    const startZ = position.z;
    contact.x = 0;
    contact.z = 0;
    contact.any = false;

    const stepLength = Math.max(1e-3, radius * STEP_FRACTION);
    const steps = Math.min(MAX_STEPS, Math.max(1, Math.ceil(wanted / stepLength)));
    // 처음부터 겹쳐 있었는지 (그렇다면 걸음을 취소하지 않고 밖으로 밀려나게 둠)
    let wasFree = !overlapsCircle(position.x, position.z, radius - STUCK_DEPTH);
    for (let s = 0; s < steps; s++) {
      const prevX = position.x;
      const prevZ = position.z;
      slide(position, radius, dx / steps, dz / steps);
      const left = resolve(position, radius);
      if (left > STUCK_DEPTH && wasFree) {
        // 그래도 다 풀리지 않으면 이번 걸음은 없던 일로
        position.x = prevX;
        position.z = prevZ;
        contact.any = true;
        break;
      }
      if (left <= STUCK_DEPTH) wasFree = true;
    }

    let normal = null;
    if (contact.any) {
      const length = Math.hypot(contact.x, contact.z);
      normal = length > 1e-9 ? { x: contact.x / length, z: contact.z / length } : { x: wanted > 0 ? -dx / wanted : 0, z: wanted > 0 ? -dz / wanted : 0 };
    }
    let blocked = false;
    if (contact.any && wanted > 1e-9) {
      const progress = ((position.x - startX) * dx + (position.z - startZ) * dz) / (wanted * wanted);
      blocked = progress < BLOCKED_PROGRESS;
    }
    return { blocked, normal };
  }

  // 한 걸음 미끄러지기: 닿아 있는 면 쪽은 깎고 → 처음 닿는 곳까지만 가고 → 남은 걸음을 다시 깎아서 계속 (최대 3번)
  // 양쪽이 막힌 구석·좁은 틈에서는 걸음이 0 이 되어 떨지 않음
  function slide(position, r, sx, sz) {
    let restX = sx;
    let restZ = sz;
    for (let k = 0; k < SLIDE_TRIES; k++) {
      clipStep(position, r, restX, restZ);
      if (step.x * step.x + step.z * step.z < 1e-14) return;
      // 깎은 걸음이 처음 가려던 쪽과 반대로 가면 멈춤 (구석에서 앞뒤로 흔들리지 않게)
      if (step.x * sx + step.z * sz <= 0) return;
      const t = sweep(position.x, position.z, r, step.x, step.z);
      if (t >= 1) {
        position.x += step.x;
        position.z += step.z;
        return;
      }
      // 닿기 직전(SKIN 만큼 앞)에서 멈춤 → 다음 걸음이 '이미 안에 있음'으로 잘못 걸리지 않게
      const length = Math.sqrt(step.x * step.x + step.z * step.z);
      const go = Math.max(0, t - SKIN / length);
      position.x += step.x * go;
      position.z += step.z * go;
      contact.any = true;
      restX = step.x * (1 - go);
      restZ = step.z * (1 - go);
    }
  }

  // 동그라미가 (sx, sz) 만큼 갈 때 처음 무언가(장애물·경계)에 닿는 비율 t (0~1, 안 닿으면 1)
  function sweep(px, pz, r, sx, sz) {
    let best = 1;
    const lowX = Math.min(px, px + sx) - r;
    const highX = Math.max(px, px + sx) + r;
    const lowZ = Math.min(pz, pz + sz) - r;
    const highZ = Math.max(pz, pz + sz) + r;
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      if (o.maxX < lowX || o.minX > highX || o.maxZ < lowZ || o.minZ > highZ) continue;
      // 이미 닿아 있고 그 안쪽으로 가지 않는 장애물은 건너뜀 (장애물은 모두 볼록해서 다시 닿을 수 없음)
      if (penetration(o, px, pz, r + CONTACT_GAP, push) && sx * push.x + sz * push.z >= 0) continue;
      const t = o.shape === 'circle' ? rayCircle(px, pz, sx, sz, o.x, o.z, o.radius + r) : sweptBox(px, pz, sx, sz, o, r);
      if (t < best) best = t;
    }
    if (sx < 0 && px + sx < area.minX + r) best = Math.min(best, Math.max(0, (area.minX + r - px) / sx));
    if (sx > 0 && px + sx > area.maxX - r) best = Math.min(best, Math.max(0, (area.maxX - r - px) / sx));
    if (sz < 0 && pz + sz < area.minZ + r) best = Math.min(best, Math.max(0, (area.minZ + r - pz) / sz));
    if (sz > 0 && pz + sz > area.maxZ - r) best = Math.min(best, Math.max(0, (area.maxZ - r - pz) / sz));
    return best;
  }

  // 지금 닿아 있는 면들(장애물·경계)의 방향을 모음 → normals[0 .. normalCount-1]
  function gatherContacts(px, pz, r) {
    normalCount = 0;
    const reach = r + CONTACT_GAP;
    for (let i = 0; i < list.length && normalCount < MAX_CONTACTS; i++) {
      if (!penetration(list[i], px, pz, reach, push)) continue;
      normals[normalCount * 2] = push.x;
      normals[normalCount * 2 + 1] = push.z;
      normalCount++;
    }
    const addBound = (nx, nz) => {
      if (normalCount >= MAX_CONTACTS) return;
      normals[normalCount * 2] = nx;
      normals[normalCount * 2 + 1] = nz;
      normalCount++;
    };
    if (px - r <= area.minX + CONTACT_GAP) addBound(1, 0);
    if (px + r >= area.maxX - CONTACT_GAP) addBound(-1, 0);
    if (pz - r <= area.minZ + CONTACT_GAP) addBound(0, 1);
    if (pz + r >= area.maxZ - CONTACT_GAP) addBound(0, -1);
  }

  // 걸음 (sx, sz) 에서 닿은 면 안쪽으로 들어가는 부분을 깎아 step 에 넣음
  // 한 면만 깎아서 다른 면도 모두 괜찮으면 그 걸음, 아니면 (구석) 걸음 0  — 평면에서는 이것으로 충분
  function clipStep(position, r, sx, sz) {
    step.x = sx;
    step.z = sz;
    gatherContacts(position.x, position.z, r);
    if (normalCount === 0) return;
    let opposing = false;
    for (let i = 0; i < normalCount; i++) if (sx * normals[i * 2] + sz * normals[i * 2 + 1] < 0) opposing = true;
    if (!opposing) return;
    contact.any = true;
    let bestLength = -1;
    let bestX = 0;
    let bestZ = 0;
    for (let i = 0; i < normalCount; i++) {
      const nx = normals[i * 2];
      const nz = normals[i * 2 + 1];
      const d = sx * nx + sz * nz;
      if (d >= 0) continue;
      contact.x += nx;
      contact.z += nz;
      const cx = sx - d * nx;
      const cz = sz - d * nz;
      let ok = true;
      for (let j = 0; j < normalCount && ok; j++) {
        if (j !== i && cx * normals[j * 2] + cz * normals[j * 2 + 1] < -1e-9) ok = false;
      }
      const length = cx * cx + cz * cz;
      if (ok && length > bestLength) {
        bestLength = length;
        bestX = cx;
        bestZ = cz;
      }
    }
    step.x = bestLength >= 0 ? bestX : 0;
    step.z = bestLength >= 0 ? bestZ : 0;
  }

  // ── 선분 / 굵은 선분(지나가는 동그라미) 이 처음 닿는 곳 ──
  function raycast(from, to, { radius = 0, ignoreKinds = null, out = null } = {}) {
    const result = out ?? { hit: false, point: { x: 0, z: 0 }, distance: 0, obstacle: null, normal: { x: 0, z: 0 } };
    if (!result.point) result.point = { x: 0, z: 0 };
    if (!result.normal) result.normal = { x: 0, z: 0 };
    const fx = from.x;
    const fz = from.z;
    const dx = to.x - fx;
    const dz = to.z - fz;
    const length = Math.hypot(dx, dz);
    const r = Math.max(0, radius);
    // 선분이 지나가는 네모 범위 (굵기 포함) — 멀리 있는 장애물은 바로 건너뜀
    const lowX = Math.min(fx, to.x) - r;
    const highX = Math.max(fx, to.x) + r;
    const lowZ = Math.min(fz, to.z) - r;
    const highZ = Math.max(fz, to.z) + r;

    let best = Infinity;
    let bestObstacle = null;
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      if (ignoreKinds && ignoreKinds.includes(o.kind)) continue;
      if (o.maxX < lowX || o.minX > highX || o.maxZ < lowZ || o.minZ > highZ) continue;
      const t = o.shape === 'circle' ? rayCircle(fx, fz, dx, dz, o.x, o.z, o.radius + r) : sweptBox(fx, fz, dx, dz, o, r);
      if (t < best) {
        best = t;
        bestObstacle = o;
      }
    }

    if (!bestObstacle) {
      result.hit = false;
      result.point.x = to.x;
      result.point.z = to.z;
      result.distance = length;
      result.obstacle = null;
      result.normal.x = 0;
      result.normal.z = 0;
      return result;
    }
    result.hit = true;
    result.point.x = fx + dx * best;
    result.point.z = fz + dz * best;
    result.distance = length * best;
    result.obstacle = bestObstacle;
    surfaceNormal(bestObstacle, result.point.x, result.point.z, dx, dz, result.normal);
    return result;
  }

  function lineOfSight(a, b) {
    return !raycast(a, b, { ignoreKinds: SIGHT_IGNORES, out: scratchHit }).hit;
  }

  function overlapsCircle(x, z, radius) {
    for (let i = 0; i < list.length; i++) if (penetration(list[i], x, z, radius, push)) return list[i];
    return null;
  }

  function randomFreePoint(radius, rng = Math.random) {
    const width = Math.max(0, area.maxX - area.minX - radius * 2);
    const depth = Math.max(0, area.maxZ - area.minZ - radius * 2);
    for (let tries = 0; tries < 400; tries++) {
      const x = area.minX + radius + rng() * width;
      const z = area.minZ + radius + rng() * depth;
      if (!overlapsCircle(x, z, radius)) return { x, z };
    }
    return { x: (area.minX + area.maxX) / 2, z: (area.minZ + area.maxZ) / 2 };
  }

  return {
    addBox,
    addCircle,
    remove,
    moveCircle,
    raycast,
    lineOfSight,
    overlapsCircle,
    randomFreePoint,
    get: (id) => byId.get(id) ?? null,
    clear() {
      byId.clear();
      list = [];
    },
    get obstacles() {
      return list;
    },
    get bounds() {
      return area;
    },
  };
}

const SIGHT_IGNORES = ['bush'];
