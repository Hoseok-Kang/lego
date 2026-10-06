// 화면 갱신 반복
// 1초에 약 60번 tick(지난 시간)을 불러서 움직임을 계산하고 화면을 다시 그립니다.

export function startFrameLoop(tick) {
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000); // 탭을 잠깐 떠났다 와도 한 번에 튀지 않게
    last = now;
    tick(dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// 영상 녹화용: 주소 끝에 ?capture 를 붙이면 자동 재생 대신
// 바깥(녹화 도구)에서 한 장면씩 넘기며 찍을 수 있게 합니다.
export function exposeCaptureHook(update, draw, getStatus) {
  window.blockCapture = {
    step(dt, { render = true } = {}) {
      update(dt);
      if (render) draw();
      return getStatus();
    },
    status: getStatus,
  };
}
