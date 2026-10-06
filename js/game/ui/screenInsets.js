// 화면 가림 재기
// 위쪽 정보판과 아래쪽 단추(속도·멈춤·소리·그림, 스킬)가 화면을 얼마나 가리는지 잽니다.
// 카메라가 이 값을 받아서, 가려지지 않은 가운데 빈 곳에 전장 전체가 들어오게 맞춥니다.
//
//   measureScreenInsets() → { top, bottom }   가려지는 높이(px)

const MAX_SHARE = 0.4; // 위아래를 합쳐 화면 높이의 이 비율까지만 비켜 줌 (너무 작아지지 않게)

export function measureScreenInsets() {
  const height = window.innerHeight || 1;
  let top = 0;
  let bottom = 0;

  // 위쪽 정보판 아래 끝
  const hudTop = visibleRect(document.querySelector('.hud-top'));
  if (hudTop && hudTop.top < height / 2) top = Math.max(0, hudTop.bottom);

  // 아래쪽 단추들 중 가장 높이 올라온 곳
  for (const selector of ['.hud-controls', '#skillButtons']) {
    const rect = visibleRect(document.querySelector(selector));
    if (rect && rect.bottom > height / 2) bottom = Math.max(bottom, height - rect.top);
  }

  // 위아래 가림이 너무 크면 같은 비율로 줄임
  const total = top + bottom;
  const limit = height * MAX_SHARE;
  if (total > limit) {
    top *= limit / total;
    bottom *= limit / total;
  }
  return { top: Math.round(top), bottom: Math.round(bottom) };
}

// 화면에 보이는 요소의 위치 (숨겨져 있으면 null)
function visibleRect(element) {
  if (!element || element.closest('[hidden]')) return null;
  const rect = element.getBoundingClientRect();
  if (rect.width < 1 || rect.height < 1) return null;
  return rect;
}
