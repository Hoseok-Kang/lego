// 소굴 화면 손가락 · 마우스 읽기 (톡 누르기 / 끌기 / 마우스 올리기)
// 화면이 아니라 '무엇을 눌렀는지' 는 lairView.js 가 정하고, 여기서는 누름 · 움직임만 알아냅니다.
// 손가락이 조금(TAP_SLOP px) 이상 움직이면 '끌기', 아니면 '톡' 입니다. 화면이 밀려 올라가지 않게 touch-action 을 끕니다.
//
//   const input = createLairInput(canvas, {
//     onTap(clientX, clientY, pointerType),        톡 (짧게 누르고 뗌)
//     onPress(clientX, clientY, pointerType),      누르는 순간 (짓는 중이면 유령을 바로 그 칸으로)
//     onDrag(clientX, clientY, pointerType),       누른 채 움직임
//     onRelease(clientX, clientY, wasDrag),        뗌
//     onHover(clientX, clientY) / onLeave(),       마우스만: 누르지 않고 움직임 / 화면 밖으로 나감
//   })
//   input.dispose()

const TAP_SLOP = { mouse: 6, pen: 8, touch: 12 };
const TAP_MAX_MS = 700;

export function createLairInput(canvas, handlers) {
  canvas.style.touchAction = 'none';
  let active = null; // { id, x, y, time, drag, type }

  function down(event) {
    if (active || (event.pointerType === 'mouse' && event.button !== 0)) return;
    active = { id: event.pointerId, x: event.clientX, y: event.clientY, time: performance.now(), drag: false, type: event.pointerType || 'mouse' };
    try {
      canvas.setPointerCapture(event.pointerId);
    } catch {
      /* 무시 */
    }
    handlers.onPress?.(event.clientX, event.clientY, active.type);
  }

  function move(event) {
    if (active && event.pointerId === active.id) {
      const slop = TAP_SLOP[active.type] ?? 10;
      if (!active.drag && Math.hypot(event.clientX - active.x, event.clientY - active.y) > slop) active.drag = true;
      if (active.drag) handlers.onDrag?.(event.clientX, event.clientY, active.type);
      return;
    }
    if (!active && event.pointerType === 'mouse') handlers.onHover?.(event.clientX, event.clientY);
  }

  function up(event) {
    if (!active || event.pointerId !== active.id) return;
    const a = active;
    active = null;
    const quick = performance.now() - a.time < TAP_MAX_MS;
    handlers.onRelease?.(event.clientX, event.clientY, a.drag);
    if (!a.drag && quick) handlers.onTap?.(a.x, a.y, a.type);
  }

  function cancel(event) {
    if (active && event.pointerId === active.id) active = null;
  }

  function leave(event) {
    if (event.pointerType === 'mouse' && !active) handlers.onLeave?.();
  }

  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', cancel);
  canvas.addEventListener('pointerleave', leave);
  const noMenu = (event) => event.preventDefault();
  canvas.addEventListener('contextmenu', noMenu);

  return {
    dispose() {
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', cancel);
      canvas.removeEventListener('pointerleave', leave);
      canvas.removeEventListener('contextmenu', noMenu);
    },
  };
}
