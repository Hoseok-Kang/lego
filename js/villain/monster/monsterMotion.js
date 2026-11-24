// 괴수 몸짓 (뒤뚱뒤뚱 걷기, 통통 튀기, 눌렸다 펴지기, 움찔, 숨쉬기)
// 괴수 그림은 늘 카메라를 보고 서 있고, 몸 전체를 기울이고 띄우고 눌러서 살아 있는 느낌을 냅니다.
// 걸을 때는 왼발·오른발 가장자리를 번갈아 축으로 삼아 뒤뚱거리고, 발이 닿을 때마다 살짝 눌립니다.
//
//   const motion = createMonsterMotion(model)
//   motion.step(dt, move) → 발이 땅에 닿았으면 -1(왼발) / +1(오른발), 아니면 0
//       move: 걷는 중이면 { x, z, speed } (방향은 길이 1), 서 있으면 null
//   motion.act                  공격 동작이 직접 쓰는 값 { x, y, z, tiltX, tiltZ, squash, shake, spin, charge } (매 장면 0 으로 스르르 돌아감)
//       spin: 몸을 세로축으로 돌리는 각도 (라디안, 꼬리 철퇴 한 바퀴. 다 돌면 0 으로 되돌려 놓을 것)
//       charge: 0~1 힘 모으기 (레이저 눈: 살짝 떠오르고 길쭉해지며 부르르)
//   motion.bounce(세기)          몸이 꾹 눌렸다 튕김 (착지, 맞았을 때)
//   motion.flinch(dx, dz, 세기)  (dx, dz) 쪽으로 휘청
//   motion.apply(bodyNode)      계산한 자세를 몸 손잡이에 적용
//   motion.footHalf             발 축까지 거리 (먼지 위치용)
//
// 뒤뚱거림 크기·빠르기는 아래 상수에서 바꿉니다.

const ROCK_ANGLE = 0.2; // 좌우로 기우는 각도 (라디안, 클수록 우스꽝스럽게 뒤뚱)
const HOP_HEIGHT = 0.55; // 걸음마다 뜨는 높이 (칸)
const STEPS_PER_SECOND = 2.3; // 느린 괴수도 1초에 이만큼은 발을 구름
const STEPS_PER_SPEED = 0.16; // 빠른 괴수는 더 종종걸음 (빠르기 1 마다 더해지는 걸음 수)
const LEAN = 0.07; // 가는 쪽으로 몸을 숙이는 각도
const LAND_SQUASH = 2.6; // 발이 닿을 때 눌리는 세기
const SPRING = 260; // 눌렸다 펴지는 탄성 (클수록 빨리 튕김)
const DAMPING = 13; // 출렁임이 잦아드는 빠르기
const BREATHE = 0.022; // 숨쉬기 크기
const CHARGE_LIFT = 0.6; // 힘을 다 모았을 때 떠오르는 높이 (칸)
const CHARGE_STRETCH = 0.1; // 힘을 다 모았을 때 길쭉해지는 정도
const CHARGE_BUZZ = 0.07; // 힘을 모을 때 부르르 떨리는 크기 (칸)

export function createMonsterMotion(model) {
  const footHalf = Math.max(0.5, Math.min(model.width * 0.5, 3.4) * 0.8);
  const act = { x: 0, y: 0, z: 0, tiltX: 0, tiltZ: 0, squash: 0, shake: 0, spin: 0, charge: 0 };
  let time = Math.random() * 10;
  let phase = 0;
  let walk = 0; // 0 서 있음 ~ 1 걷는 중 (부드럽게 바뀜)
  let leanX = 0, leanZ = 0;
  let squash = 0, squashV = 0;
  let flinchX = 0, flinchZ = 0, flinchVX = 0, flinchVZ = 0;

  function step(dt, move) {
    time += dt;
    const ease = Math.min(1, dt * 9);
    walk += ((move ? 1 : 0) - walk) * ease;
    leanX += ((move ? move.x : 0) - leanX) * ease;
    leanZ += ((move ? move.z : 0) - leanZ) * ease;
    let landed = 0;
    if (move) {
      const before = Math.floor(phase / Math.PI);
      phase += (STEPS_PER_SECOND + move.speed * STEPS_PER_SPEED) * dt * Math.PI;
      const after = Math.floor(phase / Math.PI);
      if (after !== before) {
        landed = after % 2 ? 1 : -1;
        squashV -= LAND_SQUASH;
      }
    } else if (walk < 0.02) {
      phase = 0;
    }
    // 눌림·휘청 용수철
    squashV += (-SPRING * squash - DAMPING * squashV) * dt;
    squash += squashV * dt;
    flinchVX += (-SPRING * 0.7 * flinchX - DAMPING * flinchVX) * dt;
    flinchVZ += (-SPRING * 0.7 * flinchZ - DAMPING * flinchVZ) * dt;
    flinchX += flinchVX * dt;
    flinchZ += flinchVZ * dt;
    return landed;
  }

  function apply(body) {
    const rock = Math.sin(phase) * ROCK_ANGLE * walk;
    const hop = Math.abs(Math.sin(phase)) * HOP_HEIGHT * walk;
    const charge = Math.max(0, Math.min(1, act.charge || 0));
    const jitter = (act.shake ? Math.sin(time * 97) * act.shake : 0) + (charge ? Math.sin(time * 131) * CHARGE_BUZZ * charge : 0);
    // 기우는 쪽 반대 발 가장자리를 축으로 돌림 → 한쪽 발이 들림
    const pivotX = rock > 0 ? -footHalf : footHalf;
    body.position.set(
      act.x + pivotX * (1 - Math.cos(rock)) + jitter,
      act.y + hop + footHalf * Math.abs(Math.sin(rock)) + CHARGE_LIFT * charge * charge,
      act.z + (charge ? Math.cos(time * 113) * CHARGE_BUZZ * 0.6 * charge : 0),
    );
    // 위쪽을 (dx, dz) 쪽으로 기울이려면: z축 회전 = -dx, x축 회전 = +dz
    body.rotation.set(
      (leanZ * LEAN * walk + flinchZ + act.tiltZ),
      act.spin || 0,
      rock - (leanX * LEAN * walk + flinchX + act.tiltX),
    );
    const tall = Math.max(0.55, 1 + squash + act.squash + CHARGE_STRETCH * charge + Math.sin(time * 2.3) * BREATHE);
    const wide = 1 / Math.sqrt(tall);
    body.scale.set(wide, tall, wide);
  }

  // 공격 동작 값은 동작이 끝나면 스르르 0 으로
  function relax(dt) {
    const k = Math.max(0, 1 - dt * 12);
    for (const key of Object.keys(act)) act[key] *= k;
  }

  return {
    act,
    footHalf,
    step,
    apply,
    relax,
    bounce(strength = 1) {
      squashV -= LAND_SQUASH * strength;
    },
    flinch(dx, dz, strength = 1) {
      flinchVX += dx * 3.2 * strength;
      flinchVZ += dz * 3.2 * strength;
    },
  };
}
