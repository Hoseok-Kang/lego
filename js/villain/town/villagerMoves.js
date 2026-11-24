// 마을 사람 발걸음 도구 (움직이기 · 건물 비켜 가기 · 방향 틀기 · 점프)
// villagerBrain.js (보통 움직임) 와 villagerStunts.js (꽈당 · 튀어나오기 같은 특별한 몸짓) 가 같이 씁니다.
//
//   move(v, dt, 빠르기, world)   v.dirX/dirZ 쪽으로 걸음. 물이면 되돌아서고, 건물은 밀어내고, 바닥판 가장자리에서 돌아섬
//                                (v.state 가 'toEdge' 면 바닥판 밖으로 나갈 수 있음, v.target.building 은 통과)
//   pushOut(v, 건물 목록, 통과할 건물) ; outside(v, bounds) → 바닥판 밖으로 EDGE_MARGIN 넘게 나갔는지
//   steer(v, ax, az, dt)  그쪽으로 방향을 조금씩 틈 ;  face(v, dx, dz, dt)  몸을 그쪽으로 돌림 ;  jump(v, dt)  v.lift / v.vy 로 폴짝
//
// 느낌 숫자는 아래 상수에서 바꿉니다.

export const GRAVITY = 30; // 뛰쳐나오기·응원 점프가 떨어지는 힘
export const EDGE_MARGIN = 2.5; // 바닥판 밖으로 이만큼 나가면 떠남
const EDGE_TURN = 1.5; // 바닥판 가장자리에서 이만큼 안쪽에서 돌아섬
const STEER = 6; // 방향을 트는 빠르기
const TURN = 12; // 몸을 돌리는 빠르기

// ── 움직이기 (물·건물·바닥판 가장자리) ──
export function move(v, dt, speed, w) {
  const len = Math.hypot(v.dirX, v.dirZ) || 1;
  v.dirX /= len;
  v.dirZ /= len;
  if (speed <= 0) return;
  const bx = v.x;
  const bz = v.z;
  v.x += v.dirX * speed * dt;
  v.z += v.dirZ * speed * dt;
  if (w.walkable && !w.walkable(v.x, v.z)) {
    // 못 가는 곳(바다)이면 되돌아서 돌아감
    v.x = bx;
    v.z = bz;
    v.dirX = -v.dirX + (w.rnd() - 0.5) * 0.6;
    v.dirZ = -v.dirZ;
  }
  pushOut(v, w.buildings, v.target?.building);
  if (v.state === 'toEdge') return; // 바닥판 밖으로 나가는 중
  const b = w.bounds;
  const edge = EDGE_TURN;
  if (v.x < b.minX + edge) (v.x = b.minX + edge), (v.dirX = Math.abs(v.dirX) + 0.3);
  if (v.x > b.maxX - edge) (v.x = b.maxX - edge), (v.dirX = -Math.abs(v.dirX) - 0.3);
  if (v.z < b.minZ + edge) (v.z = b.minZ + edge), (v.dirZ = Math.abs(v.dirZ) + 0.3);
  if (v.z > b.maxZ - edge) (v.z = b.maxZ - edge), (v.dirZ = -Math.abs(v.dirZ) - 0.3);
}

// 건물 밖으로 밀어내고, 벽을 따라 옆으로 미끄러지게 (숨으러 가는 건물은 통과)
export function pushOut(v, buildings, skip) {
  for (const b of buildings) {
    if (!b.alive || b === skip) continue;
    const dx = v.x - b.position.x;
    const dz = v.z - b.position.z;
    const d = Math.hypot(dx, dz) || 1e-3;
    const min = b.radius + 0.8;
    if (d < min) {
      v.x = b.position.x + (dx / d) * min;
      v.z = b.position.z + (dz / d) * min;
      v.dirX += (-dz / d) * 0.5;
      v.dirZ += (dx / d) * 0.5;
    }
  }
}

export function outside(v, b) {
  return v.x < b.minX - EDGE_MARGIN || v.x > b.maxX + EDGE_MARGIN || v.z < b.minZ - EDGE_MARGIN || v.z > b.maxZ + EDGE_MARGIN;
}

export function steer(v, ax, az, dt) {
  const len = Math.hypot(ax, az) || 1;
  const k = Math.min(1, dt * STEER);
  v.dirX += (ax / len - v.dirX) * k;
  v.dirZ += (az / len - v.dirZ) * k;
}

export function face(v, dx, dz, dt) {
  const want = Math.atan2(dx, dz);
  const diff = Math.atan2(Math.sin(want - v.yaw), Math.cos(want - v.yaw));
  v.yaw += diff * Math.min(1, dt * TURN);
}

export function jump(v, dt) {
  v.vy -= GRAVITY * dt;
  v.lift += v.vy * dt;
  if (v.lift <= 0) {
    v.lift = 0;
    v.vy = 0;
  }
}
