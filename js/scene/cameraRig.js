// 카메라
// 쌓는 동안에는 쌓인 높이를 따라 올라가며 옆에서 정면 쪽으로 천천히 돌아오고,
// 다 쌓으면 전체가 보이게 물러나서 살짝 좌우로 흔들립니다.
// 화면을 끌면(드래그) 직접 돌려 볼 수 있고, 휠이나 두 손가락으로 확대/축소할 수 있습니다.

import { easeInOutSine } from '../motion/easing.js';

const DEG = Math.PI / 180;

export function createCameraRig(camera, element, config, { reduceMotion = false } = {}) {
  const startYaw = config.startYawDeg * DEG;
  const endYaw = config.endYawDeg * DEG;
  const pitch = config.pitchDeg * DEG;
  const sway = reduceMotion ? 0 : config.idleSwayDeg * DEG;

  const current = { yaw: startYaw, pitch, zoom: 1, viewHeight: 1 };
  const goal = { ...current };
  let figure = { width: 1, height: 1, depth: 1 };
  let manual = false;
  let completeTime = null;
  let time = 0;

  // 새 그림을 쌓기 시작할 때: 카메라를 시작 위치로 바로 옮김
  function restart(size) {
    figure = size;
    manual = false;
    completeTime = null;
    Object.assign(goal, { yaw: startYaw, pitch, zoom: 1, viewHeight: viewHeightFor(0, false) });
    Object.assign(current, goal);
  }

  // builtHeight: 지금까지 쌓기 시작한 가장 높은 곳
  function update(dt, progress, complete, builtHeight) {
    time += dt;
    if (!manual) {
      if (complete && completeTime === null) completeTime = time;
      const idle = completeTime === null ? 0 : Math.sin((time - completeTime) * 0.35) * sway;
      goal.yaw = startYaw + (endYaw - startYaw) * easeInOutSine(progress) + idle;
      goal.pitch = pitch;
      goal.zoom = 1;
      goal.viewHeight = viewHeightFor(builtHeight, complete);
    }
    const follow = 1 - Math.exp(-dt * (manual ? 12 : 3));
    for (const key of Object.keys(goal)) current[key] += (goal[key] - current[key]) * follow;
    apply();
  }

  // 화면에 담을 높이: 쌓는 중에는 쌓인 곳 + 떨어지는 블록까지, 다 쌓으면 전체
  function viewHeightFor(builtHeight, complete) {
    if (complete) return figure.height;
    const wanted = (builtHeight ?? 0) + config.headroom;
    return Math.min(figure.height, Math.max(figure.height * 0.3, wanted));
  }

  function apply() {
    const viewHeight = current.viewHeight;
    const targetY = viewHeight / 2;
    const distance = fitDistance(viewHeight) * current.zoom;
    const cosPitch = Math.cos(current.pitch);
    camera.position.set(
      Math.sin(current.yaw) * cosPitch * distance,
      targetY + Math.sin(current.pitch) * distance,
      Math.cos(current.yaw) * cosPitch * distance,
    );
    camera.lookAt(0, targetY, 0);
  }

  // 주어진 높이와 그림 폭이 화면에 다 들어오는 거리 계산
  function fitDistance(viewHeight) {
    const halfV = Math.tan((camera.fov * DEG) / 2);
    const halfH = halfV * camera.aspect;
    const needV = (viewHeight / 2 + 1.5) / halfV;
    const needH = (figure.width / 2 + 2) / halfH;
    return Math.max(needV, needH) * config.fitPadding + figure.depth;
  }

  // ── 마우스/터치로 직접 돌려 보기 ──
  const pointers = new Map();
  let pinchDistance = 0;
  element.style.touchAction = 'none';

  element.addEventListener('pointerdown', (event) => {
    element.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 2) pinchDistance = currentPinchDistance();
    takeControl();
  });
  element.addEventListener('pointermove', (event) => {
    const last = pointers.get(event.pointerId);
    if (!last) return;
    const dx = event.clientX - last.x;
    const dy = event.clientY - last.y;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 1) {
      goal.yaw -= dx * 0.008;
      goal.pitch = clamp(goal.pitch + dy * 0.006, -0.1, 1.35);
    } else if (pointers.size === 2) {
      const distanceNow = currentPinchDistance();
      if (pinchDistance > 0) goal.zoom = clamp((goal.zoom * pinchDistance) / distanceNow, 0.35, 2.5);
      pinchDistance = distanceNow;
    }
  });
  const release = (event) => {
    pointers.delete(event.pointerId);
    pinchDistance = pointers.size === 2 ? currentPinchDistance() : 0;
  };
  element.addEventListener('pointerup', release);
  element.addEventListener('pointercancel', release);
  element.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      takeControl();
      goal.zoom = clamp(goal.zoom * Math.exp(event.deltaY * 0.001), 0.35, 2.5);
    },
    { passive: false },
  );

  function takeControl() {
    if (manual) return;
    manual = true;
    Object.assign(goal, current);
  }

  function currentPinchDistance() {
    const [a, b] = Array.from(pointers.values());
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  return { restart, update };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
