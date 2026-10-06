// 움직임 곡선
// 0~1 사이 진행도를 받아서 '얼마나 움직였는지'를 돌려줍니다.
// 곡선을 바꾸면 떨어지는 느낌(묵직함/가벼움)이 달라집니다.

export const clamp01 = (t) => Math.min(1, Math.max(0, t));

// 처음엔 천천히, 점점 빨라짐 (떨어질 때)
export const easeInQuad = (t) => t * t;

// 처음엔 빠르게, 끝에서 부드럽게 멈춤
export const easeOutCubic = (t) => 1 - (1 - t) ** 3;

// 천천히 시작해서 천천히 끝남 (카메라 이동)
export const easeInOutSine = (t) => -(Math.cos(Math.PI * t) - 1) / 2;
