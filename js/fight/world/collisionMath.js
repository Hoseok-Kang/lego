// 부딪힘 계산에 쓰는 도형 수학 (collision.js 가 씀)
// 동그라미·네모 장애물과 동그라미·선분 사이의 겹침, 처음 닿는 곳을 정확히 계산합니다.
// three.js 를 쓰지 않아서 node 에서도 바로 시험할 수 있습니다.
// 장애물 모양: { shape: 'box', minX, maxX, minZ, maxZ } 또는 { shape: 'circle', x, z, radius, (minX…maxZ 둘레 네모) }
//
//   penetration(o, px, pz, r, out) → 참/거짓      동그라미가 장애물에 파고든 방향·깊이 → out { x, z, depth }
//   rayCircle(fx, fz, dx, dz, cx, cz, R) → t      선분(시작 f, 길이·방향 d)이 동그라미에 처음 들어가는 비율 (0~1, 없으면 Infinity)
//   slab(fx, fz, dx, dz, minX, maxX, minZ, maxZ) → t   선분이 네모에 처음 들어가는 비율
//   sweptBox(fx, fz, dx, dz, o, r) → t            굵기 r 인 동그라미가 네모 o 에 처음 닿는 비율
//   surfaceNormal(o, px, pz, dx, dz, out) → out    닿은 곳에서 장애물 겉면이 바라보는 방향 { x, z }
//   (시작점이 이미 안에 있으면 t = 0)

// 동그라미(가운데 px,pz 반지름 r)가 장애물 o 에 파고들었으면 true, push 에 { x, z 밀어낼 방향, depth 깊이 }
export function penetration(o, px, pz, r, push) {
  if (px + r <= o.minX || px - r >= o.maxX || pz + r <= o.minZ || pz - r >= o.maxZ) return false;
  if (o.shape === 'circle') {
    const dx = px - o.x;
    const dz = pz - o.z;
    const sum = o.radius + r;
    const d2 = dx * dx + dz * dz;
    if (d2 >= sum * sum) return false;
    const d = Math.sqrt(d2);
    if (d > 1e-9) {
      push.x = dx / d;
      push.z = dz / d;
    } else {
      push.x = 1;
      push.z = 0;
    }
    push.depth = sum - d;
    return true;
  }
  // 네모: 네모 안에서 동그라미 가운데와 가장 가까운 점
  const cx = px < o.minX ? o.minX : px > o.maxX ? o.maxX : px;
  const cz = pz < o.minZ ? o.minZ : pz > o.maxZ ? o.maxZ : pz;
  const dx = px - cx;
  const dz = pz - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return false;
  if (d2 > 1e-12) {
    const d = Math.sqrt(d2);
    push.x = dx / d;
    push.z = dz / d;
    push.depth = r - d;
    return true;
  }
  // 가운데가 네모 안에 들어감 → 가장 가까운 면 쪽으로 밀어냄
  const left = px - o.minX;
  const right = o.maxX - px;
  const back = pz - o.minZ;
  const front = o.maxZ - pz;
  const least = Math.min(left, right, back, front);
  push.x = least === left ? -1 : least === right ? 1 : 0;
  push.z = push.x !== 0 ? 0 : least === back ? -1 : 1;
  push.depth = least + r;
  return true;
}

// 선분이 동그라미(반지름 R)에 처음 들어가는 비율 t (0~1). 시작점이 이미 안이면 0, 안 닿으면 Infinity
export function rayCircle(fx, fz, dx, dz, cx, cz, R) {
  const mx = fx - cx;
  const mz = fz - cz;
  const c = mx * mx + mz * mz - R * R;
  if (c <= 0) return 0;
  const a = dx * dx + dz * dz;
  if (a < 1e-12) return Infinity;
  const b = mx * dx + mz * dz;
  if (b >= 0) return Infinity; // 멀어지는 쪽
  const disc = b * b - a * c;
  if (disc < 0) return Infinity;
  const t = (-b - Math.sqrt(disc)) / a;
  return t <= 1 ? t : Infinity;
}

// 선분이 네모에 처음 들어가는 비율 t (평면 두 쌍의 '판' 사이를 지나는 구간으로 계산)
export function slab(fx, fz, dx, dz, minX, maxX, minZ, maxZ) {
  let tMin = 0;
  let tMax = 1;
  if (Math.abs(dx) < 1e-12) {
    if (fx < minX || fx > maxX) return Infinity;
  } else {
    let t1 = (minX - fx) / dx;
    let t2 = (maxX - fx) / dx;
    if (t1 > t2) [t1, t2] = [t2, t1];
    if (t1 > tMin) tMin = t1;
    if (t2 < tMax) tMax = t2;
    if (tMin > tMax) return Infinity;
  }
  if (Math.abs(dz) < 1e-12) {
    if (fz < minZ || fz > maxZ) return Infinity;
  } else {
    let t1 = (minZ - fz) / dz;
    let t2 = (maxZ - fz) / dz;
    if (t1 > t2) [t1, t2] = [t2, t1];
    if (t1 > tMin) tMin = t1;
    if (t2 < tMax) tMax = t2;
    if (tMin > tMax) return Infinity;
  }
  return tMin;
}

// 굵기 r 인 동그라미가 네모에 처음 닿는 비율 t
// = 선분이 '모서리가 둥근 네모'(네모를 r 만큼 부풀린 모양)에 처음 들어가는 곳
//   (가로로 부풀린 네모 + 세로로 부풀린 네모 + 네 모서리 동그라미 중 가장 먼저 닿는 곳)
export function sweptBox(fx, fz, dx, dz, o, r) {
  if (r <= 0) return slab(fx, fz, dx, dz, o.minX, o.maxX, o.minZ, o.maxZ);
  let t = slab(fx, fz, dx, dz, o.minX - r, o.maxX + r, o.minZ, o.maxZ);
  const t2 = slab(fx, fz, dx, dz, o.minX, o.maxX, o.minZ - r, o.maxZ + r);
  if (t2 < t) t = t2;
  if (t === 0) return 0;
  const corners = [o.minX, o.minZ, o.maxX, o.minZ, o.minX, o.maxZ, o.maxX, o.maxZ];
  for (let i = 0; i < 8; i += 2) {
    const tc = rayCircle(fx, fz, dx, dz, corners[i], corners[i + 1], r);
    if (tc < t) t = tc;
  }
  return t;
}

// 닿은 곳에서 장애물 겉면이 바라보는 방향 (총알 튕김 불꽃 방향 등에 씀)
export function surfaceNormal(o, px, pz, dx, dz, out) {
  let nx;
  let nz;
  if (o.shape === 'circle') {
    nx = px - o.x;
    nz = pz - o.z;
  } else {
    const cx = px < o.minX ? o.minX : px > o.maxX ? o.maxX : px;
    const cz = pz < o.minZ ? o.minZ : pz > o.maxZ ? o.maxZ : pz;
    nx = px - cx;
    nz = pz - cz;
    if (nx * nx + nz * nz < 1e-10) {
      // 점이 네모 겉면 위(또는 안): 가장 가까운 면
      const left = px - o.minX;
      const right = o.maxX - px;
      const back = pz - o.minZ;
      const front = o.maxZ - pz;
      const least = Math.min(left, right, back, front);
      nx = least === left ? -1 : least === right ? 1 : 0;
      nz = nx !== 0 ? 0 : least === back ? -1 : 1;
    }
  }
  const length = Math.hypot(nx, nz);
  if (length > 1e-9) {
    out.x = nx / length;
    out.z = nz / length;
  } else {
    const d = Math.hypot(dx, dz) || 1;
    out.x = -dx / d;
    out.z = -dz / d;
  }
  return out;
}
