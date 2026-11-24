// ─────────────────────────────────────────────────────────────
// 습격 화면 확대 (놀이하는 사람이 정함)
// 자동으로 괴수를 따라가는 카메라(townCamera.js) 위에 '더 가까이 / 더 멀리' 를 곱합니다.
//   두 손가락 오므리기 · 펴기, 마우스 휠, 정보판의 [−] [+] 단추, [처음 보기] 단추로 되돌리기
//   멀리 하면 마을 전체가 보이고, 다음 습격에도 그대로 기억해요 (localStorage 'villainTycoon.raidZoom').
// 마을을 끌어서 옮기는 기능은 없어요 (카메라가 괴수를 따라다니므로).
//
//   const zoom = createRaidZoom(canvas, view, { onChange })
//       canvas: 3D 마을 그림판 (stage.renderer.domElement),  view: 마을 카메라 (stage.view)
//       onChange(배율)   확대가 바뀔 때 (정보판 단추 모양 맞추기)
//   zoom.step(+1 | -1)   단추 한 번 (가까이 / 멀리)
//   zoom.reset()         자동 카메라 그대로 (배율 1)
//   zoom.level           지금 배율
//   zoom.dispose()
//
// 한 번에 바뀌는 양 · 휠 빠르기는 아래 상수, 한도는 townCamera.js 의 USER_ZOOM 에서 바꿉니다.
// ─────────────────────────────────────────────────────────────

const KEY = 'villainTycoon.raidZoom';
const STEP = 1.3; // 단추 한 번에 바뀌는 배
const WHEEL_SPEED = 0.0015;

function readSaved() {
  try {
    const value = Number(localStorage.getItem(KEY));
    return Number.isFinite(value) && value > 0 ? value : 1;
  } catch {
    return 1;
  }
}

export function createRaidZoom(canvas, view, { onChange = () => {} } = {}) {
  const points = new Map();
  let pinch = 0; // 두 손가락 사이 거리
  let saveTimer = 0;

  function set(value) {
    const level = view.setUserZoom(value);
    onChange(level);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(KEY, String(Math.round(level * 1000) / 1000));
      } catch {
        // 기억을 못 해도 이번 습격에는 적용됨
      }
    }, 300);
    return level;
  }

  const distance = () => {
    const [a, b] = [...points.values()];
    return Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
  };

  function down(event) {
    points.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (points.size === 2) pinch = distance();
  }

  function move(event) {
    const p = points.get(event.pointerId);
    if (!p) return;
    p.x = event.clientX;
    p.y = event.clientY;
    if (points.size >= 2 && pinch) {
      const now = distance();
      set(view.userZoom * (now / pinch));
      pinch = now;
    }
  }

  function up(event) {
    points.delete(event.pointerId);
    if (points.size < 2) pinch = 0;
  }

  function wheel(event) {
    event.preventDefault();
    const speed = event.deltaMode === 1 ? 0.05 : event.ctrlKey ? 0.01 : WHEEL_SPEED;
    set(view.userZoom * Math.exp(-event.deltaY * speed));
  }

  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', wheel, { passive: false });
  view.setUserZoom(readSaved());

  return {
    step: (dir) => set(view.userZoom * (dir > 0 ? STEP : 1 / STEP)),
    reset: () => set(1),
    get level() {
      return view.userZoom;
    },
    dispose() {
      clearTimeout(saveTimer);
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', up);
      canvas.removeEventListener('wheel', wheel);
    },
  };
}
