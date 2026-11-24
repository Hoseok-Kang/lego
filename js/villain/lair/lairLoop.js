// 소굴 3D 장면 반복 (requestAnimationFrame)
// 보일 때만 돌고, 탭을 떠나 있거나(document.hidden) 휴대폰을 세로로 들어 "가로로 돌려 주세요" 안내판이 떠 있으면 멈춥니다.
// 멈췄다가 다시 돌 때 한 번에 크게 튀지 않게 시간을 새로 셉니다.
//
//   const loop = createLairLoop(step, canRun)
//       step(지난 시간 초)   한 장면 움직이고 그리기
//       canRun() → 지금 돌아도 되는지 (보임 · 버리지 않음 · 수동 모드 아님 등, 부른 쪽 사정)
//   loop.wake()      돌기 시작 (이미 돌거나 돌면 안 되면 아무 일도 안 함)
//   loop.stop()      멈춤
//   loop.dispose()

import { installLandscapeGuard } from '../../core/landscapeGuard.js';

export function createLairLoop(step, canRun) {
  let raf = 0;
  let last = 0;
  let blocked = false; // 세로 화면 안내판이 떠 있는 동안

  const running = () => canRun() && !blocked && !document.hidden;

  function frame(now) {
    raf = 0;
    if (!running()) return;
    raf = requestAnimationFrame(frame);
    step((now - last) / 1000);
    last = now;
  }

  function wake() {
    if (raf || !running()) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  document.addEventListener('visibilitychange', wake);
  const guard = installLandscapeGuard({
    onChange(on) {
      blocked = on;
      wake();
    },
  });

  return {
    wake,
    stop,
    dispose() {
      stop();
      document.removeEventListener('visibilitychange', wake);
      guard.off();
    },
  };
}
