// ─────────────────────────────────────────────────────────────
// 소굴 3D 확대 · 옮겨 보기
//   두 손가락 오므리기 · 펴기 = 확대,  두 손가락 끌기 = 옮기기,  (확대했을 때) 한 손가락 · 마우스 끌기 = 옮기기
//   마우스 휠 = 확대 (마우스가 있는 곳을 중심으로),  3D 칸 오른쪽 아래 [처음 보기] [−] [+] 단추
// 두 손가락이 닿는 순간 한 손가락 누름은 없던 일로 해서, 두 손가락으로는 절대 시설을 고르거나 짓거나 옮기지 않아요.
// 짓는 중(유령이 있을 때)의 한 손가락 끌기는 지금처럼 유령을 옮기고, 화면 옮기기는 두 손가락으로만 해요.
//
//   const zoom = createLairZoom(container, canvas, { cam, pointer, isPlacing, onChange })
//       cam: lairCamera (zoomBy · panBy · resetZoom · zoom),  pointer: lairPointer (cancelGesture)
//       isPlacing() → 짓는 중인지,  onChange() → 확대가 바뀜 (3D 를 다시 그려 달라는 뜻)
//   zoom.reset() / zoom.dispose()
//
// 빠르기 · 한 번에 확대하는 양은 아래 상수에서 바꿉니다. (확대 한도는 lairCamera.js 의 ZOOM_MIN · ZOOM_MAX)
// ─────────────────────────────────────────────────────────────

import { createZoomButtons } from '../ui/zoomButtons.js';

const STEP = 1.3; // [+] [−] 단추 한 번에 확대하는 배
const STEP_SECONDS = 0.18; // 단추 확대가 부드럽게 바뀌는 시간
const WHEEL_SPEED = 0.0015; // 마우스 휠 한 칸(px)마다 확대 정도
const PAN_SLOP = 8; // 한 손가락이 이만큼(px) 움직이면 끌기로 봄

export function createLairZoom(container, canvas, { cam, pointer, isPlacing = () => false, onChange = () => {} } = {}) {
  const buttons = createZoomButtons({
    className: 'lair-zoom',
    onZoom: (dir) => animateTo(dir > 0 ? STEP : 1 / STEP),
    onReset: () => {
      cam.resetZoom();
      changed();
    },
  });
  container.append(buttons.el);

  const points = new Map(); // 닿아 있는 손가락 id → { x, y }
  let pinch = null; // { dist, x, y } 두 손가락 사이 거리 · 가운데
  let pan = null; // { id, x, y, moving }
  let tween = 0;

  function changed() {
    buttons.setLevel(cam.zoom);
    onChange();
  }

  // 단추: 화면 가운데를 중심으로 부드럽게
  function animateTo(factor) {
    cancelAnimationFrame(tween);
    const rect = canvas.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const start = performance.now();
    let done = 0; // 지금까지 적용한 비율 (log)
    const total = Math.log(factor);
    const frame = (now) => {
      const t = Math.min(1, (now - start) / (STEP_SECONDS * 1000));
      const e = 1 - (1 - t) * (1 - t);
      cam.zoomBy(Math.exp(total * e - done), cx, cy);
      done = total * e;
      changed();
      if (t < 1) tween = requestAnimationFrame(frame);
    };
    tween = requestAnimationFrame(frame);
  }

  function twoFinger() {
    const [a, b] = [...points.values()];
    return { dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  function down(event) {
    points.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (points.size === 2) {
      pointer.cancelGesture(); // 첫 손가락의 톡 · 끌기는 없던 일로
      pinch = twoFinger();
      pan = null;
    } else if (points.size === 1 && !isPlacing() && (event.pointerType !== 'mouse' || event.button === 0)) {
      pan = { id: event.pointerId, x: event.clientX, y: event.clientY, moving: false };
    }
  }

  function move(event) {
    const p = points.get(event.pointerId);
    if (!p) return;
    p.x = event.clientX;
    p.y = event.clientY;
    if (pinch && points.size >= 2) {
      const now = twoFinger();
      cam.zoomBy(now.dist / pinch.dist, now.x, now.y);
      cam.panBy(now.x - pinch.x, now.y - pinch.y);
      pinch = now;
      changed();
      return;
    }
    if (pan && pan.id === event.pointerId && cam.zoom > 1.001) {
      if (!pan.moving && Math.hypot(event.clientX - pan.x, event.clientY - pan.y) < PAN_SLOP) return;
      pan.moving = true;
      cam.panBy(event.clientX - pan.x, event.clientY - pan.y);
      pan.x = event.clientX;
      pan.y = event.clientY;
      canvas.style.cursor = 'grabbing';
      changed();
    }
  }

  function up(event) {
    points.delete(event.pointerId);
    if (points.size < 2) pinch = null;
    if (pan && pan.id === event.pointerId) {
      pan = null;
      canvas.style.cursor = '';
    }
  }

  function wheel(event) {
    event.preventDefault();
    const speed = event.deltaMode === 1 ? 0.05 : event.ctrlKey ? 0.01 : WHEEL_SPEED; // 줄 단위 휠 · 터치패드 오므리기
    cam.zoomBy(Math.exp(-event.deltaY * speed), event.clientX, event.clientY);
    changed();
  }

  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', wheel, { passive: false });
  buttons.setLevel(cam.zoom);

  return {
    reset() {
      cam.resetZoom();
      changed();
    },
    dispose() {
      cancelAnimationFrame(tween);
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
      canvas.removeEventListener('wheel', wheel);
      buttons.el.remove();
    },
  };
}
