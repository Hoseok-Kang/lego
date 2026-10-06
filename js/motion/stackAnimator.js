// 쌓기 모션
// 블록이 쌓기 순서대로 하나씩 위에서 떨어져서, 톡 하고 눌렸다가 살짝 튀며 제자리에 앉습니다.
// 한 블록의 움직임: [위에서 떨어짐] → [착지하며 눌림] → [살짝 튀었다 앉음]

import { clamp01, easeInQuad, easeOutCubic } from './easing.js';

export function createStackAnimator(meshes, motion, { onLand, onComplete } = {}) {
  let count = 0;
  let interval = 0; // 블록이 출발하는 간격(초)
  let time = 0;
  let started = 0; // 출발한 블록 수
  let landed = 0; // 자리에 앉은 블록 수
  let done = true;
  let speed = motion.speed;
  let tilts = new Float32Array(0);

  const life = motion.fallSeconds + motion.bounceSeconds; // 블록 하나가 움직이는 총 시간

  function start(plan) {
    count = plan.blocks.length;
    const total = clamp(count * motion.secondsPerBlock, motion.minBuildSeconds, motion.maxBuildSeconds);
    interval = count > 1 ? Math.max(0, total - life) / (count - 1) : 0;
    time = 0;
    started = 0;
    landed = 0;
    done = count === 0;
    tilts = Float32Array.from({ length: count }, () => (Math.random() * 2 - 1) * motion.maxTilt);
    meshes.setVisibleCount(0);
  }

  function update(dt) {
    if (done) return;
    time += dt * speed;

    while (started < count && started * interval <= time) started++;
    meshes.setVisibleCount(started);

    for (let i = landed; i < started; i++) {
      const local = time - i * interval;
      if (local >= life) {
        meshes.setFinal(i);
        if (i === landed) {
          landed++;
          onLand?.(i);
        }
      } else {
        pose(i, local);
      }
    }
    meshes.commit();

    if (landed >= count) {
      done = true;
      onComplete?.();
    }
  }

  function pose(i, local) {
    const size = meshes.blockSize;
    if (local < motion.fallSeconds) {
      // 떨어지는 중: 점점 빨라지며 내려오고, 기울기는 점점 바로잡힘
      const p = local / motion.fallSeconds;
      const drop = motion.dropHeight * size * (1 - easeInQuad(p));
      const grow = easeOutCubic(clamp01(p / 0.25)); // 처음 나타날 때 작게 시작
      const tilt = tilts[i] * (1 - easeOutCubic(p));
      meshes.setPose(i, 0, drop, 0, tilt, grow, grow, grow);
      return;
    }
    const q = (local - motion.fallSeconds) / motion.bounceSeconds;
    if (q < 0.35) {
      // 착지: 아래가 바닥에 붙은 채 납작하게 눌렸다가 돌아옴
      const squash = motion.squash * Math.sin((Math.PI * q) / 0.35);
      const scaleY = 1 - squash;
      const scaleXZ = 1 + squash * 0.5;
      meshes.setPose(i, 0, -((1 - scaleY) * size) / 2, 0, 0, scaleXZ, scaleY, scaleXZ);
      return;
    }
    // 살짝 튀었다가 앉음
    const h = (q - 0.35) / 0.65;
    meshes.setPose(i, 0, motion.bounceHeight * size * Math.sin(Math.PI * h), 0, 0, 1, 1, 1);
  }

  // 기다리지 않고 바로 완성된 모습 보여 주기
  function finish() {
    for (let i = landed; i < count; i++) meshes.setFinal(i);
    meshes.setVisibleCount(count);
    meshes.commit();
    started = count;
    landed = count;
    if (!done) {
      done = true;
      onComplete?.();
    }
  }

  return {
    start,
    update,
    finish,
    setSpeed: (value) => {
      speed = value;
    },
    isDone: () => done,
    progress: () => (count === 0 ? 1 : landed / count),
    landedCount: () => landed,
    startedCount: () => started,
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
