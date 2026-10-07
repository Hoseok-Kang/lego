// 싸움 계산 도우미 (three.js 없이 숫자만 계산 → node 에서 바로 시험할 수 있음)
// 총알이 토끼를 맞혔는지, 칼 부채꼴 안에 들어왔는지, 각도 돌리기 같은 작은 계산을 모아 둡니다.
// 위치는 땅 위 평면 { x, z } 만 씁니다.
//
//   wrapAngle(각도) → -π ~ π                       각도를 한 바퀴 안으로
//   facingFromDir(x, z) → 각도                     방향 → facing (0 = +z = 화면 아래쪽)
//   turnToward(지금, 목표, 최대회전) → 새 각도        최대회전(라디안)까지만 목표 쪽으로 돌기
//   segmentCircle(x0, z0, dx, dz, cx, cz, R) → t   선분 (x0,z0)→(x0+dx, z0+dz) 가 동그라미(반지름 R)에
//                                                  처음 들어가는 비율 0~1. 시작이 이미 안이면 0, 안 닿으면 Infinity
//                                                  (한 장면에 멀리 날아가도 뚫고 지나가지 않음)
//   inArc(ox, oz, facing, 부채꼴각도, 닿는거리, tx, tz, tr) → 참/거짓
//                                                  (ox,oz) 에서 facing 쪽 부채꼴 안에 동그라미(tx,tz,반지름 tr)가 닿는지
//
// 바꿀 숫자는 없습니다. (게임 숫자는 fightConfig.js)

const TAU = Math.PI * 2;

export function wrapAngle(angle) {
  let a = (angle + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
}

export function facingFromDir(x, z) {
  return Math.atan2(x, z);
}

export function turnToward(current, target, maxStep) {
  const diff = wrapAngle(target - current);
  if (Math.abs(diff) <= maxStep) return wrapAngle(target);
  return wrapAngle(current + Math.sign(diff) * maxStep);
}

export function segmentCircle(x0, z0, dx, dz, cx, cz, R) {
  const mx = x0 - cx;
  const mz = z0 - cz;
  const c = mx * mx + mz * mz - R * R;
  if (c <= 0) return 0; // 이미 동그라미 안에서 출발
  const a = dx * dx + dz * dz;
  if (a < 1e-12) return Infinity;
  const b = mx * dx + mz * dz;
  if (b >= 0) return Infinity; // 멀어지는 쪽으로 감
  const disc = b * b - a * c;
  if (disc < 0) return Infinity; // 옆으로 비껴감
  const t = (-b - Math.sqrt(disc)) / a;
  return t <= 1 ? t : Infinity;
}

export function inArc(ox, oz, facing, arcRad, range, tx, tz, tr = 0) {
  const dx = tx - ox;
  const dz = tz - oz;
  const d = Math.hypot(dx, dz);
  if (d > range + tr) return false; // 너무 멂
  if (d <= tr) return true; // 바로 겹쳐 있음
  const diff = Math.abs(wrapAngle(Math.atan2(dx, dz) - facing));
  const margin = Math.asin(Math.min(1, tr / d)); // 몸 크기만큼 부채꼴을 넓게 봄
  return diff <= arcRad / 2 + margin;
}
