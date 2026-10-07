// 미친토끼 길 찾기와 걷기
// 전장을 2칸짜리 바둑판으로 나눠 '내 토끼까지 몇 걸음인지' 지도를 만들어 두고(벽·상자·나무를 돌아가는 길),
// 미친토끼는 그 지도를 따라 걷습니다. 앞이 훤히 트였으면 지도 없이 곧장 갑니다.
// 걸을 때는 친구 토끼와 너무 붙지 않게 살짝 비키고, 벽에 막혀 잠깐(0.4초) 못 가면 옆으로 비켜 걸어 봅니다.
// 움직임은 언제나 collision.moveCircle 로 해서 벽을 뚫거나 전장 밖으로 나가지 않습니다.
// three.js 를 쓰지 않아서 node 에서도 시험할 수 있습니다.
//
//   const nav = createEnemyNav(collision)
//   nav.toward(위치, 반지름, 목표, out) → out { x, z }   목표 쪽으로 가는 방향 (길이 1, 갈 길이 없으면 0)
//                                                       벽 너머 목표면 돌아가는 길 쪽을 알려 줌
//   nav.clear()                                         길 지도를 버림 (다시 하기, 장애물이 크게 바뀌었을 때)
//
//   moveEnemy(enemy, ctx, 방향x, 방향z, 빠르기, dt) → 이번에 실제로 걸은 빠르기 (초당 칸)
//       enemy: 미친토끼 (position, radius, knockDelta, knockScale, steer 기억 칸), ctx: { collision, list(미친토끼 목록), player }
//       방향은 길이 1 (0 이면 제자리). 친구와 떨어지기·밀려나기(knockDelta)·옆으로 비키기를 함께 처리
//   createSteerMemory() → 미친토끼마다 하나씩 들고 있는 걷기 기억 (막힌 시간, 비켜 걷기)
//   separateEnemies(list, ctx)                          서로 겹친 미친토끼를 떼어 놓음 (매 장면 한 번, 작은 토끼가 더 비킴)
//
// 바둑판 크기·비켜 걷는 각도 같은 숫자는 아래 상수에서 바꿉니다. (친구와 떨어지는 거리는 fightConfig.js 의 enemies.separation)

import { FIGHT } from '../fightConfig.js';

const CELL = 2; // 길 지도 한 칸 크기 (칸)
const LOOK_AHEAD = 6; // 지도에서 이만큼 앞 칸까지 곧장 갈 수 있으면 그쪽으로 (길이 부드러워짐)
const SEED_REACH = 16; // 목표 칸이 막혔을 때 목표에서 걸어서 이만큼 (칸) 안의 설 수 있는 곳을 찾음
const NARROW_RADIUS = 1; // 그 '걸어서' 를 잴 때 쓰는 아주 작은 몸 크기
const CLEAR_SHRINK = 0.92; // 곧장 갈 수 있는지 볼 때 몸 크기를 이만큼 줄여서 봄 (벽에 붙어 있어도 판단되게)
const BLOCKED_FRACTION = 0.35; // 가려던 거리의 이만큼도 못 가면 '막힘'
const BLOCKED_SECONDS = 0.4; // 이만큼 막혀 있으면 옆으로 비켜 걷기
const SIDESTEP_SECONDS = 0.5; // 옆으로 비켜 걷는 시간
const SIDESTEP_ANGLES = [60, 100]; // 비켜 걷는 각도 (도) — 번갈아 가며 크게
const SEPARATION_WEIGHT = 1.1; // 친구에게서 떨어지려는 힘 (가려는 방향 = 1)
const OVERLAP_PUSH = 0.5; // 겹친 친구끼리 한 장면에 겹친 만큼의 이 비율씩 떨어짐
const PLAYER_GAP = 0.2; // 내 토끼와 이보다 더 붙지 않음 (몸끼리)
const INF = 1e9;
const DEG = Math.PI / 180;

export function createEnemyNav(collision) {
  const bounds = collision.bounds;
  const cols = Math.max(1, Math.ceil((bounds.maxX - bounds.minX) / CELL));
  const rows = Math.max(1, Math.ceil((bounds.maxZ - bounds.minZ) / CELL));
  const count = cols * rows;
  const fields = new Map(); // 반지름 → 길 지도
  const queue = new Int32Array(count);
  const queued = new Uint8Array(count);
  const seedDist = new Float64Array(count);
  const near = new Uint8Array(count); // 장애물 가까운 칸 표시 (막힌 칸 계산용)
  let qHead = 0;
  let qSize = 0;
  const ray = { hit: false, point: { x: 0, z: 0 }, distance: 0, obstacle: null, normal: { x: 0, z: 0 } };
  const from = { x: 0, z: 0 };
  const to = { x: 0, z: 0 };

  const centerX = (c) => bounds.minX + ((c % cols) + 0.5) * CELL;
  const centerZ = (c) => bounds.minZ + (Math.floor(c / cols) + 0.5) * CELL;
  function cellOf(x, z) {
    const i = Math.min(cols - 1, Math.max(0, Math.floor((x - bounds.minX) / CELL)));
    const j = Math.min(rows - 1, Math.max(0, Math.floor((z - bounds.minZ) / CELL)));
    return j * cols + i;
  }

  function fieldFor(radius) {
    const key = Math.round(radius * 10);
    let field = fields.get(key);
    if (!field) {
      field = { radius, blocked: new Uint8Array(count), dist: new Float64Array(count), obstacles: null, goal: -1 };
      fields.set(key, field);
    }
    // 장애물이 바뀌었으면 (상자가 부서짐) 막힌 칸을 다시 계산
    // 장애물 둘레 네모 안의 칸만 자세히 검사 (나머지 칸은 바로 '열림' → 가벼움)
    if (field.obstacles !== collision.obstacles) {
      const obstacles = collision.obstacles;
      field.obstacles = obstacles;
      const r = field.radius;
      near.fill(0);
      for (let k = 0; k < obstacles.length; k++) {
        const o = obstacles[k];
        const i0 = Math.max(0, Math.floor((o.minX - r - bounds.minX) / CELL));
        const i1 = Math.min(cols - 1, Math.floor((o.maxX + r - bounds.minX) / CELL));
        const j0 = Math.max(0, Math.floor((o.minZ - r - bounds.minZ) / CELL));
        const j1 = Math.min(rows - 1, Math.floor((o.maxZ + r - bounds.minZ) / CELL));
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) near[j * cols + i] = 1;
      }
      for (let c = 0; c < count; c++) {
        const x = centerX(c);
        const z = centerZ(c);
        const outside = x - r < bounds.minX || x + r > bounds.maxX || z - r < bounds.minZ || z + r > bounds.maxZ;
        field.blocked[c] = outside || (near[c] && collision.overlapsCircle(x, z, r)) ? 1 : 0;
      }
      field.goal = -1;
    }
    return field;
  }

  // 목표 칸에서부터 걸음 수 퍼뜨리기 (곧게 2, 대각선 3 → 걸음 수 ≈ 칸 거리)
  // 목표 칸이 막혀 있으면 (내 토끼가 이 토끼 몸보다 좁은 틈에 있음): 먼저 '아주 작은 몸' 으로 목표에서
  // 걸어서 SEED_REACH 안에 닿는 칸을 찾고, 그중 이 토끼가 설 수 있는 칸들에서 퍼뜨림
  // → 벽 반대편이 아니라 틈 입구 쪽으로 와서, 들어갈 수 있는 만큼 들어가 공격함
  function plan(field, goal) {
    const { dist, blocked } = field;
    dist.fill(INF);
    if (!blocked[goal]) {
      dist[goal] = 0;
      push(goal);
      spread(dist, blocked, INF);
    } else {
      const narrow = fieldFor(NARROW_RADIUS).blocked;
      seedDist.fill(INF);
      seedDist[goal] = 0;
      push(goal);
      spread(seedDist, narrow, SEED_REACH);
      for (let c = 0; c < count; c++) {
        if (seedDist[c] >= INF || blocked[c]) continue;
        dist[c] = seedDist[c];
        push(c);
      }
      spread(dist, blocked, INF);
    }
    field.goal = goal;
  }

  function push(c) {
    if (queued[c]) return;
    queued[c] = 1;
    queue[(qHead + qSize) % count] = c;
    qSize++;
  }

  // 줄에 있는 칸들에서 이웃으로 걸음 수 퍼뜨리기 (limit 보다 먼 곳은 안 감)
  function spread(dist, blocked, limit) {
    while (qSize > 0) {
      const c = queue[qHead];
      qHead = (qHead + 1) % count;
      qSize--;
      queued[c] = 0;
      const ci = c % cols;
      const cj = Math.floor(c / cols);
      const base = dist[c];
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const ni = ci + di;
          const nj = cj + dj;
          if (ni < 0 || nj < 0 || ni >= cols || nj >= rows) continue;
          const n = nj * cols + ni;
          if (blocked[n]) continue;
          // 대각선은 양옆 칸이 모두 비어 있을 때만 (모서리를 깎아 지나가지 않게)
          if (di && dj && (blocked[cj * cols + ni] || blocked[nj * cols + ci])) continue;
          const next = base + (di && dj ? 3 : 2);
          if (next < dist[n] && next <= limit) {
            dist[n] = next;
            push(n);
          }
        }
      }
    }
  }

  // 이웃 칸 중 목표에 가장 가까운 칸 (없으면 -1)
  function bestNeighbor(field, c, reach = 1) {
    const { dist, blocked } = field;
    const ci = c % cols;
    const cj = Math.floor(c / cols);
    let best = -1;
    let bestDist = dist[c];
    for (let dj = -reach; dj <= reach; dj++) {
      for (let di = -reach; di <= reach; di++) {
        if (!di && !dj) continue;
        const ni = ci + di;
        const nj = cj + dj;
        if (ni < 0 || nj < 0 || ni >= cols || nj >= rows) continue;
        const n = nj * cols + ni;
        if (blocked[n] || dist[n] >= bestDist) continue;
        if (reach === 1 && di && dj && (blocked[cj * cols + ni] || blocked[nj * cols + ci])) continue;
        best = n;
        bestDist = dist[n];
      }
    }
    return best;
  }

  function clearPath(x0, z0, x1, z1, radius) {
    from.x = x0;
    from.z = z0;
    to.x = x1;
    to.z = z1;
    return !collision.raycast(from, to, { radius: radius * CLEAR_SHRINK, out: ray }).hit;
  }

  function toward(position, radius, goal, out) {
    out.x = 0;
    out.z = 0;
    const dx = goal.x - position.x;
    const dz = goal.z - position.z;
    const d = Math.hypot(dx, dz);
    if (d < 1e-6) return out;
    // 1) 곧장 갈 수 있으면 곧장
    if (clearPath(position.x, position.z, goal.x, goal.z, radius)) {
      out.x = dx / d;
      out.z = dz / d;
      return out;
    }
    // 2) 길 지도 따라가기 (내 토끼가 다른 칸으로 옮겼을 때만 다시 계산 — 아주 가벼움)
    const field = fieldFor(radius);
    const goalCell = cellOf(goal.x, goal.z);
    if (field.goal !== goalCell) plan(field, goalCell);
    let start = cellOf(position.x, position.z);
    if (field.dist[start] >= INF) {
      // 벽에 바짝 붙어 막힌 칸에 서 있음 → 둘레에서 가장 가까운 열린 칸
      start = bestNeighbor(field, start, 2);
      if (start < 0) return directTo(out, dx, dz, d);
      return directTo(out, centerX(start) - position.x, centerZ(start) - position.z);
    }
    let target = -1;
    let cur = start;
    for (let k = 0; k < LOOK_AHEAD; k++) {
      const next = bestNeighbor(field, cur);
      if (next < 0) break;
      cur = next;
      if (clearPath(position.x, position.z, centerX(cur), centerZ(cur), radius)) target = cur;
      else if (target >= 0) break;
    }
    if (target < 0) target = bestNeighbor(field, start);
    if (target < 0) return directTo(out, dx, dz, d); // 갈 길 없음 (막힌 곳) → 그냥 목표 쪽 (미끄러지며 감)
    return directTo(out, centerX(target) - position.x, centerZ(target) - position.z);
  }

  return {
    toward,
    clear() {
      fields.clear();
    },
    cellOf,
    get cols() {
      return cols;
    },
    get rows() {
      return rows;
    },
  };
}

function directTo(out, dx, dz, d = Math.hypot(dx, dz)) {
  if (d < 1e-6) {
    out.x = 0;
    out.z = 0;
  } else {
    out.x = dx / d;
    out.z = dz / d;
  }
  return out;
}

export function createSteerMemory() {
  return { blockedTime: 0, sidestep: 0, sideSign: 1, tries: 0, lastBlocked: 99, delta: { x: 0, z: 0 } };
}

// 한 장면 걷기: 가려는 방향 + 친구에게서 떨어지기 + 옆으로 비켜 걷기 → collision.moveCircle
export function moveEnemy(e, ctx, dirX, dirZ, speed, dt) {
  const memory = e.steer;
  const delta = memory.delta;
  if (dt <= 0) return 0;
  let wx = dirX;
  let wz = dirZ;
  const wanting = speed > 0 && (wx !== 0 || wz !== 0);

  if (wanting) {
    // 친구 토끼에게서 살짝 떨어지기
    let sx = 0;
    let sz = 0;
    const list = ctx.list;
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      if (o === e || !o.alive) continue;
      const keep = Math.max(FIGHT.enemies.separation, e.radius + o.radius + 0.3);
      const ox = e.position.x - o.position.x;
      const oz = e.position.z - o.position.z;
      const d = Math.hypot(ox, oz);
      if (d >= keep) continue;
      const strength = ((keep - d) / keep) * (o.radius / e.radius); // 작은 토끼가 큰 토끼에게 더 많이 비켜 줌
      if (d < 1e-4) {
        sx += strength;
        continue;
      }
      sx += (ox / d) * strength;
      sz += (oz / d) * strength;
    }
    wx += sx * SEPARATION_WEIGHT;
    wz += sz * SEPARATION_WEIGHT;
    // 막혔을 때: 옆으로 비켜 걷기
    if (memory.sidestep > 0) {
      memory.sidestep -= dt;
      const angle = memory.sideSign * SIDESTEP_ANGLES[memory.tries % SIDESTEP_ANGLES.length] * DEG;
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      const rx = wx * c + wz * s;
      const rz = -wx * s + wz * c;
      wx = rx;
      wz = rz;
    }
    const length = Math.hypot(wx, wz);
    if (length > 1) {
      wx /= length;
      wz /= length;
    }
  }

  const wantX = wanting ? wx * speed * dt : 0;
  const wantZ = wanting ? wz * speed * dt : 0;
  const startX = e.position.x;
  const startZ = e.position.z;
  // 밀려나기 (무거운 망치 토끼는 덜 밀림: enemy.knockScale)
  const knock = e.knockScale ?? 1;
  delta.x = wantX + e.knockDelta.x * knock;
  delta.z = wantZ + e.knockDelta.z * knock;
  ctx.collision.moveCircle(e.position, e.radius, delta); // 가만히 있어도 부름 → 장애물에 겹쳐 있으면 밖으로 밀려남
  keepOffPlayer(e, ctx);

  // 얼마나 갔는지 보고 '막힘' 판단
  const movedX = e.position.x - startX;
  const movedZ = e.position.z - startZ;
  const wanted2 = wantX * wantX + wantZ * wantZ;
  memory.lastBlocked += dt;
  if (wanting && wanted2 > 1e-10) {
    const progress = (movedX * wantX + movedZ * wantZ) / wanted2;
    if (progress < BLOCKED_FRACTION) memory.blockedTime += dt;
    else memory.blockedTime = Math.max(0, memory.blockedTime - dt * 2);
    if (memory.blockedTime > BLOCKED_SECONDS && memory.sidestep <= 0) {
      // 방금도 막혔으면 반대쪽·더 크게 비켜 봄
      memory.tries = memory.lastBlocked < SIDESTEP_SECONDS * 3 ? memory.tries + 1 : 0;
      memory.sideSign = memory.tries % 2 ? -memory.sideSign : memory.sideSign;
      memory.sidestep = SIDESTEP_SECONDS;
      memory.blockedTime = 0;
      memory.lastBlocked = 0;
    }
  } else {
    memory.blockedTime = 0;
  }
  return dt > 0 ? Math.hypot(movedX, movedZ) / dt : 0;
}

// 내 토끼 몸을 파고들지 않게 (내 토끼는 player.js 가 알아서 밀려남, 미친토끼도 반쯤 비켜 줌)
// 내 토끼가 점프해서 머리 위로 지나가는 동안은 비키지 않음
function keepOffPlayer(e, ctx) {
  const p = ctx.player;
  if (!p || !p.alive || p.jumping) return;
  const dx = e.position.x - p.position.x;
  const dz = e.position.z - p.position.z;
  const d = Math.hypot(dx, dz);
  const overlap = e.radius + p.radius + PLAYER_GAP - d;
  if (overlap <= 0 || d < 1e-4) return;
  const push = e.steer.delta;
  push.x = (dx / d) * overlap * OVERLAP_PUSH;
  push.z = (dz / d) * overlap * OVERLAP_PUSH;
  ctx.collision.moveCircle(e.position, e.radius, push);
}

// 서로 겹친 미친토끼 떼어 놓기 (양쪽이 반씩 비킴, 벽은 뚫지 않음)
export function separateEnemies(list, ctx) {
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (!a.alive) continue;
    for (let j = i + 1; j < list.length; j++) {
      const b = list[j];
      if (!b.alive) continue;
      const dx = b.position.x - a.position.x;
      const dz = b.position.z - a.position.z;
      const d = Math.hypot(dx, dz);
      const overlap = a.radius + b.radius - d;
      if (overlap <= 0) continue;
      const nx = d > 1e-4 ? dx / d : 1;
      const nz = d > 1e-4 ? dz / d : 0;
      // 큰 토끼는 덜, 작은 토끼는 더 많이 밀려남
      const push = overlap * OVERLAP_PUSH;
      const shareA = b.radius / (a.radius + b.radius);
      const da = a.steer.delta;
      da.x = -nx * push * shareA;
      da.z = -nz * push * shareA;
      ctx.collision.moveCircle(a.position, a.radius, da);
      const db = b.steer.delta;
      db.x = nx * push * (1 - shareA);
      db.z = nz * push * (1 - shareA);
      ctx.collision.moveCircle(b.position, b.radius, db);
    }
  }
}
