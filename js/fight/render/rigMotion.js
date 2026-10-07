// 토끼 움직임 계산 도우미 (rabbitRig.js 가 씀)
// 깡충 뛰기 박자, 귀가 출렁이는 용수철, 부드럽게 따라가기 같은 작은 계산들을 모아 둡니다.
//
//   createHop()          깡충 뛰기 박자 → hop.step(dt, 움직임 0~1) 뒤에 hop.height / squash / stretch / air / landed / tookOff
//   createSpring(k, c)   용수철 하나 → s.step(dt, 목표) , s.kick(세기) , s.x(지금 값)
//   approach(지금, 목표, 빠르기, dt) → 새 값    (목표 쪽으로 부드럽게 다가감)
//   wrapAngle(각도) → -π~π                     ease 함수들: easeOutCubic, easeInOutSine
//
// 뛰는 높이·박자는 아래 상수에서 바꿉니다.

const HOP_RATE_FULL = 5; // 최고 속도일 때 1초에 깡충 뛰는 횟수
const HOP_RATE_SLOW = 2.8; // 아주 천천히 걸을 때 1초에 깡충 뛰는 횟수
const HOP_CONTACT = 0.26; // 한 번 뛰는 동안 땅에 닿아 있는 비율 (이때 꾹 눌림)
const SPRING_STEP = 1 / 90; // 용수철 계산 한 걸음 (작을수록 안정적)

export function createHop() {
  const hop = {
    phase: HOP_CONTACT, // 정수 부분 = 몇 번째 뜀, 소수 부분 = 한 번 뛰는 동안 어디쯤
    rate: HOP_RATE_SLOW,
    amp: 0, // 뛰는 세기 (0~1)
    height: 0, // 0~1 (공중에서 가장 높을 때 1)
    squash: 0, // 0~1 (땅에 닿아 꾹 눌린 정도)
    stretch: 0, // 0~1 (뛰어오르거나 내려올 때 길쭉해진 정도)
    air: 0, // 0~1 (공중에 떠 있으면 1)
    tilt: 0, // -1~1 (뛰어오를 때 -1 = 고개 들기, 내려올 때 +1 = 앞으로 숙이기)
    landed: false, // 이번 장면에 땅에 닿았는지
    tookOff: false, // 이번 장면에 뛰어올랐는지
    step(dt, move) {
      const moving = move > 0.05;
      const before = hop.phase;
      if (moving) {
        hop.rate = HOP_RATE_SLOW + (HOP_RATE_FULL - HOP_RATE_SLOW) * Math.min(1, move);
        hop.amp = approach(hop.amp, 0.55 + 0.45 * Math.min(1, move), 10, dt);
        hop.phase += hop.rate * dt;
      } else {
        // 멈출 때는 지금 뛰던 한 번을 끝까지 (착지해서 꾹 눌리는 것까지) 마무리하고 섬
        const rest = Math.ceil(hop.phase - HOP_CONTACT - 1e-6) + HOP_CONTACT;
        hop.phase = Math.min(hop.phase + hop.rate * dt, rest);
        if (hop.phase >= rest - 1e-6) hop.amp = approach(hop.amp, 0, 8, dt);
      }
      hop.landed = Math.floor(hop.phase) > Math.floor(before) && hop.amp > 0.05;
      hop.tookOff = moving && Math.floor(hop.phase - HOP_CONTACT) > Math.floor(before - HOP_CONTACT);
      const frac = hop.phase - Math.floor(hop.phase);
      if (frac < HOP_CONTACT) {
        const g = frac / HOP_CONTACT;
        hop.height = 0;
        hop.squash = Math.sin(Math.PI * g) * hop.amp;
        hop.stretch = 0;
        hop.air = 0;
        hop.tilt = 0;
      } else {
        const f = (frac - HOP_CONTACT) / (1 - HOP_CONTACT);
        hop.height = 4 * f * (1 - f) * hop.amp;
        hop.squash = 0;
        hop.stretch = Math.abs(1 - 2 * f) * hop.amp * Math.min(1, f * 6, (1 - f) * 6);
        hop.air = Math.min(1, f * 5, (1 - f) * 5) * hop.amp;
        hop.tilt = (2 * f - 1) * hop.amp;
      }
    },
    reset() {
      hop.phase = HOP_CONTACT;
      hop.amp = 0;
      hop.height = hop.squash = hop.stretch = hop.air = hop.tilt = 0;
      hop.landed = hop.tookOff = false;
    },
  };
  return hop;
}

// 출렁이는 용수철 (귀, 고개)
// k: 단단함 (클수록 빨리 돌아옴), c: 멈추는 힘 (작을수록 오래 출렁임)
export function createSpring(k, c, limit = 2) {
  const s = {
    x: 0,
    v: 0,
    step(dt, target) {
      let left = Math.min(dt, 0.1);
      while (left > 1e-6) {
        const h = Math.min(SPRING_STEP, left);
        s.v += (-k * (s.x - target) - c * s.v) * h;
        s.x += s.v * h;
        left -= h;
      }
      if (s.x > limit) {
        s.x = limit;
        s.v = Math.min(0, s.v);
      } else if (s.x < -limit) {
        s.x = -limit;
        s.v = Math.max(0, s.v);
      }
    },
    kick(amount) {
      s.v += amount;
    },
    reset() {
      s.x = 0;
      s.v = 0;
    },
  };
  return s;
}

export function approach(current, target, rate, dt) {
  return current + (target - current) * (1 - Math.exp(-rate * dt));
}

export function wrapAngle(angle) {
  return angle - Math.round(angle / (Math.PI * 2)) * Math.PI * 2;
}

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function easeOutCubic(t) {
  const u = 1 - t;
  return 1 - u * u * u;
}

export function easeInOutSine(t) {
  return 0.5 - 0.5 * Math.cos(Math.PI * t);
}
