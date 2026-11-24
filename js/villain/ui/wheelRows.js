// ─────────────────────────────────────────────────────────────
// 악당 타이쿤: 마우스 휠로 옆으로 미는 목록 넘기기
// 낮은 화면의 부품 상점처럼 카드가 한 줄로 늘어선 목록(옆으로만 스크롤)은 마우스 휠(위아래)로는 안 넘어가요.
// 그런 목록 위에서 휠을 굴리면 옆으로 카드 몇 장씩 넘겨 줍니다. 손가락으로 미는 것은 그대로예요.
//
// 쓰는 법
//   enableWheelRows()   처음 한 번 (ui/boot.js 가 부름). 페이지 전체에서 알아서 찾아 줌
//
// 한 번에 넘기는 양 · 쉬는 시간은 아래 상수에서 바꿉니다.
// ─────────────────────────────────────────────────────────────

const PAGE = 0.8; // 휠 한 번에 목록 너비의 이만큼 넘김
const REST_MS = 220; // 휠이 빠르게 여러 번 와도 이 시간에 한 번만 넘김

// 옆으로만 스크롤되는 상자인지 (세로는 숨김, 가로는 넘침)
function rowOf(target) {
  for (let el = target; el && el !== document.body; el = el.parentElement) {
    if (el.scrollWidth <= el.clientWidth + 1) continue;
    const style = getComputedStyle(el);
    if (/(auto|scroll)/.test(style.overflowX) && style.overflowY === 'hidden') return el;
  }
  return null;
}

export function enableWheelRows() {
  let last = 0;
  document.addEventListener(
    'wheel',
    (event) => {
      if (event.ctrlKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return; // 확대 · 이미 옆으로 굴림
      const row = event.target instanceof Element ? rowOf(event.target) : null;
      if (!row) return;
      event.preventDefault();
      const now = performance.now();
      if (now - last < REST_MS) return;
      last = now;
      row.scrollBy({ left: Math.sign(event.deltaY) * row.clientWidth * PAGE, behavior: 'smooth' });
    },
    { passive: false },
  );
}
