// ─────────────────────────────────────────────────────────────
// 전체 화면 켜고 끄기 (모든 게임이 함께 씀)
// 전체 화면이 되면 휴대폰을 가로로 고정해 달라고 브라우저에 부탁합니다 (안 되는 브라우저는 그냥 넘어감).
// 전체 화면을 못 쓰는 곳(아이폰 사파리, allowfullscreen 이 없는 iframe 등)에서는 단추가 저절로 숨습니다.
//
// 쓰는 법
//   canFullscreen()          이 브라우저 · 이 페이지에서 전체 화면을 쓸 수 있는지 (document.fullscreenEnabled)
//   isFullscreen()           지금 전체 화면인지
//   enterFullscreen()        전체 화면 켜기 + 가로 고정 시도 → Promise<성공?>
//   exitFullscreen()         전체 화면 끄기
//   toggleFullscreen()       켜져 있으면 끄고, 꺼져 있으면 켬
//   onFullscreenChange(fn)   켜고 끌 때마다 fn(켜짐?) → 그만 듣기 함수
//   fullscreenButton({ className, label?, showLabel? })
//       누르면 켜고 끄는 <button> 을 만들어 줌. 못 쓰는 곳이면 hidden.
//       className 으로 각 게임의 단추 모양을 입힘 (예: 'vt-btn vt-btn--icon').
//       showLabel: true 면 아이콘 옆에 글자도 보여 줌 (가로로 돌려 주세요 안내판에서 씀)
//   FULLSCREEN_ICONS.enter / .exit   아이콘 SVG 글자 (글자색을 따라감)
//
// 단추 글자는 아래 TEXT 에서 바꿉니다.
// ─────────────────────────────────────────────────────────────

const TEXT = {
  enter: '전체 화면',
  exit: '전체 화면 끄기',
};

const line = 'fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"';
const svg = (body) => `<svg class="ico" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">${body}</svg>`;

// 네 귀퉁이가 밖으로(켜기) / 안으로(끄기) 꺾인 굵은 아이콘
export const FULLSCREEN_ICONS = {
  enter: svg(`<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" ${line}/>`),
  exit: svg(`<path d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5" ${line}/>`),
};

export function canFullscreen() {
  return !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);
}

export function isFullscreen() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement);
}

// 가로 고정은 전체 화면일 때만 되는 브라우저가 많아서, 전체 화면이 된 다음에 부탁함 (실패해도 괜찮음)
function lockLandscape() {
  try {
    const result = screen.orientation?.lock?.('landscape');
    result?.catch?.(() => {});
  } catch {
    // 가로 고정을 못 하는 브라우저 (데스크톱, 아이패드 등)
  }
}

export async function enterFullscreen(target = document.documentElement) {
  if (!canFullscreen()) return false;
  try {
    if (target.requestFullscreen) await target.requestFullscreen({ navigationUI: 'hide' });
    else if (target.webkitRequestFullscreen) target.webkitRequestFullscreen();
    else return false;
  } catch {
    return false;
  }
  lockLandscape();
  return true;
}

export async function exitFullscreen() {
  try {
    screen.orientation?.unlock?.();
  } catch {
    // 고정을 안 했으면 그냥 넘어감
  }
  try {
    if (document.exitFullscreen) await document.exitFullscreen();
    else document.webkitExitFullscreen?.();
  } catch {
    // 이미 꺼져 있음
  }
}

export function toggleFullscreen() {
  return isFullscreen() ? exitFullscreen() : enterFullscreen();
}

export function onFullscreenChange(fn) {
  const handler = () => fn(isFullscreen());
  document.addEventListener('fullscreenchange', handler);
  document.addEventListener('webkitfullscreenchange', handler);
  return () => {
    document.removeEventListener('fullscreenchange', handler);
    document.removeEventListener('webkitfullscreenchange', handler);
  };
}

export function fullscreenButton({ className = '', label = null, showLabel = false } = {}) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.dataset.fullscreen = '';
  button.hidden = !canFullscreen();
  const paint = () => {
    const on = isFullscreen();
    const text = on ? TEXT.exit : label ?? TEXT.enter;
    button.innerHTML = (on ? FULLSCREEN_ICONS.exit : FULLSCREEN_ICONS.enter) + (showLabel ? `<span>${text}</span>` : '');
    button.setAttribute('aria-label', text);
    button.setAttribute('aria-pressed', String(on));
    button.title = text;
  };
  button.addEventListener('click', () => toggleFullscreen());
  onFullscreenChange(paint);
  paint();
  return button;
}
