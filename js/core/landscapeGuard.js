// ─────────────────────────────────────────────────────────────
// "휴대폰을 가로로 돌려 주세요" 안내판 (모든 게임이 함께 씀)
// 우리 게임은 컴퓨터 모니터와 휴대폰 가로 화면 전용입니다. 휴대폰 · 태블릿을 세로로 들면
// 화면 전체를 덮는 안내판(빙글 도는 휴대폰 그림 + 안내 글 + 전체 화면 단추)을 띄우고, 게임에게 '멈춰' 라고 알립니다.
// 모양(CSS)도 이 파일이 스스로 페이지에 넣으므로, 어느 게임이든 import 한 줄이면 됩니다.
//
// 언제 막나요? (규칙)
//   화면이 세로(높이 ≥ 너비)이면서, 아래 둘 중 하나일 때만 막습니다.
//     ① 손가락으로 누르는 기기 (pointer: coarse → 휴대폰 · 태블릿)
//     ② 화면 너비가 600px 이하 (아주 좁은 창)
//   그래서 보통 컴퓨터 창은 절대 막지 않습니다 (세로로 세운 모니터도 너비가 600px 넘으면 그대로).
//   규칙을 바꾸려면 아래 BLOCK_QUERY 를 고치세요.
//
// 쓰는 법
//   import { installLandscapeGuard } from '../core/landscapeGuard.js';
//   const guard = installLandscapeGuard({ onChange(blocked) { 게임 멈춤 = blocked }, lang? })
//       lang: 'ko' | 'en' (안 주면 <html lang="…"> 을 따름)
//       onChange 는 처음 한 번(지금 상태) 불리고, 그 뒤 막힘 ↔풀림이 바뀔 때마다 불립니다.
//       여러 번 불러도 안내판은 하나만 생기고, onChange 만 하나씩 더해집니다.
//   guard.blocked     지금 막혀 있는지
//   guard.el          안내판 상자
//   guard.off()       이 onChange 그만 듣기
//
// 안내판이 떠 있는 동안 <html> 에 class="lscape-blocked" 가 붙습니다 (게임 CSS 에서 쓸 수 있음).
// 글자는 아래 TEXTS (ko · en), 색은 아래 CSS 의 --lg-* 값(또는 게임 CSS 에서 .lscape-guard { --lg-bg: … } 로 덮어쓰기)에서 바꿉니다.
// 전체 화면 단추는 js/core/fullscreen.js 가 만들고, 전체 화면을 못 쓰는 곳(아이폰 사파리 등)에서는 숨습니다.
// ─────────────────────────────────────────────────────────────

import { fullscreenButton } from './fullscreen.js';

// 글자: 페이지의 말(<html lang="…">)이 en 으로 시작하면 영어, 아니면 한국어 (악당 타이쿤은 js/villain/lang/lang.js 가 정해 줌)
// installLandscapeGuard({ lang: 'en' }) 처럼 직접 정할 수도 있어요.
const TEXTS = {
  ko: {
    title: '휴대폰을 가로로 돌려 주세요',
    sub: '이 게임은 가로 화면에서 해요. 돌리면 바로 이어져요!',
    fullscreen: '전체 화면으로 하기',
  },
  en: {
    title: 'Please turn your phone sideways',
    sub: 'This game is played in landscape. Turn it and keep playing!',
    fullscreen: 'Go full screen',
  },
};
const pickText = (lang) => (String(lang || document.documentElement.lang || 'ko').toLowerCase().startsWith('en') ? TEXTS.en : TEXTS.ko);

// 막는 규칙: 세로 화면 + (손가락 기기 또는 너비 600px 이하)
const BLOCK_QUERY = '(orientation: portrait) and (pointer: coarse), (orientation: portrait) and (max-width: 600px)';

const CSS = `
.lscape-guard {
  --lg-bg: #241640;
  --lg-bg-2: #3f2873;
  --lg-ink: #f4ecff;
  --lg-muted: #c7b6ee;
  --lg-title: #f2cd37;
  --lg-outline: #1b2a34;
  --lg-screen: #bbe90b;
  --lg-go: #bbe90b;
  --lg-go-edge: #7da200;
  --lg-go-ink: #1d2a00;
  position: fixed;
  inset: 0;
  z-index: 2147483000;
  display: grid;
  place-items: center;
  padding: max(20px, env(safe-area-inset-top)) max(20px, env(safe-area-inset-right)) max(20px, env(safe-area-inset-bottom)) max(20px, env(safe-area-inset-left));
  overflow: hidden;
  background:
    radial-gradient(circle at 50% 50%, rgb(255 255 255 / 0.07) 0 2.4px, transparent 3px) 0 0 / 20px 20px,
    radial-gradient(120% 80% at 50% 30%, var(--lg-bg-2) 0%, var(--lg-bg) 70%);
  color: var(--lg-ink);
  font-family: "Jua", "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif;
  text-align: center;
  word-break: keep-all;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  animation: lscape-fade 0.25s ease-out;
}
.lscape-guard[hidden] { display: none !important; }
.lscape-card { display: grid; justify-items: center; gap: 14px; max-width: 340px; }
.lscape-pic { position: relative; width: 150px; height: 150px; }
.lscape-device {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 66px;
  height: 108px;
  margin: -54px 0 0 -33px;
  padding: 9px 6px 15px;
  border: 5px solid var(--lg-outline);
  border-radius: 16px;
  background: #e9e3f7;
  box-shadow: 0 6px 0 rgb(0 0 0 / 0.35);
  animation: lscape-turn 2.6s cubic-bezier(0.5, 0, 0.3, 1.25) infinite;
}
.lscape-device i {
  display: block;
  height: 100%;
  border-radius: 6px;
  background:
    radial-gradient(circle at 50% 50%, rgb(255 255 255 / 0.35) 0 2px, transparent 2.6px) 0 0 / 10px 10px,
    linear-gradient(180deg, #e2ff73 0%, var(--lg-screen) 100%);
  box-shadow: inset 0 -4px 0 rgb(0 0 0 / 0.15);
}
.lscape-device b {
  position: absolute;
  left: 50%;
  bottom: 4px;
  width: 16px;
  height: 5px;
  margin-left: -8px;
  border-radius: 3px;
  background: var(--lg-outline);
}
.lscape-arrow {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  color: var(--lg-title);
  filter: drop-shadow(0 3px 0 rgb(0 0 0 / 0.35));
  animation: lscape-arrow 2.6s ease-in-out infinite;
}
.lscape-title {
  margin: 0;
  color: var(--lg-title);
  font-size: 26px;
  font-weight: 400;
  line-height: 1.2;
  -webkit-text-stroke: 0.12em var(--lg-outline);
  paint-order: stroke fill;
  text-shadow: 0 0.09em 0 var(--lg-outline);
}
.lscape-sub {
  margin: 0;
  color: var(--lg-muted);
  font-family: "IBM Plex Sans KR", "Apple SD Gothic Neo", "Malgun Gothic", system-ui, sans-serif;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.45;
}
.lscape-full {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 50px;
  margin-top: 6px;
  padding: 6px 20px 8px;
  border: 2px solid var(--lg-go-edge);
  border-bottom: 5px solid var(--lg-go-edge);
  border-radius: 15px;
  background: linear-gradient(180deg, #d4f84a 0%, var(--lg-go) 55%);
  color: var(--lg-go-ink);
  font: inherit;
  font-size: 19px;
  cursor: pointer;
  touch-action: manipulation;
}
.lscape-full:active { translate: 0 2px; border-bottom-width: 3px; }
.lscape-full[hidden] { display: none; }
.lscape-full .ico { width: 22px; height: 22px; }
@keyframes lscape-fade { from { opacity: 0; } }
@keyframes lscape-turn {
  0%, 22% { rotate: 0deg; }
  48%, 78% { rotate: -90deg; }
  100% { rotate: 0deg; }
}
@keyframes lscape-arrow {
  0%, 18% { opacity: 0; scale: 0.8; }
  32%, 70% { opacity: 1; scale: 1; }
  86%, 100% { opacity: 0; scale: 0.9; }
}
@media (prefers-reduced-motion: reduce) {
  .lscape-device { animation: none; rotate: -90deg; }
  .lscape-arrow { animation: none; }
}
@media (max-height: 420px) {
  .lscape-pic { width: 110px; height: 110px; }
  .lscape-device { scale: 0.75; }
}
`;

// 빙글 화살표 (휴대폰 둘레를 왼쪽으로 도는 굵은 노란 호)
const ARROW = `<svg class="lscape-arrow" viewBox="0 0 150 150" aria-hidden="true" focusable="false">
  <path d="M118 46A56 56 0 0 0 40 30" fill="none" stroke="currentColor" stroke-width="9" stroke-linecap="round"/>
  <path d="M30 18 44 44 52 18z" fill="currentColor" stroke="currentColor" stroke-width="4" stroke-linejoin="round"/>
</svg>`;

let guard = null; // 안내판은 페이지에 하나만

function createGuard(lang) {
  const TEXT = pickText(lang);
  if (!document.getElementById('lscape-guard-style')) {
    const style = document.createElement('style');
    style.id = 'lscape-guard-style';
    style.textContent = CSS;
    document.head.append(style);
  }

  const box = document.createElement('div');
  box.className = 'lscape-guard';
  box.hidden = true;
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-labelledby', 'lscape-guard-title');
  box.innerHTML = `
    <div class="lscape-card">
      <div class="lscape-pic" aria-hidden="true">${ARROW}<span class="lscape-device"><i></i><b></b></span></div>
      <h2 class="lscape-title" id="lscape-guard-title">${TEXT.title}</h2>
      <p class="lscape-sub">${TEXT.sub}</p>
    </div>`;
  box.querySelector('.lscape-card').append(fullscreenButton({ className: 'lscape-full', label: TEXT.fullscreen, showLabel: true }));
  document.body.append(box);

  const query = window.matchMedia(BLOCK_QUERY);
  const listeners = new Set();
  let blocked = null;

  function update() {
    const now = query.matches;
    if (now === blocked) return;
    blocked = now;
    box.hidden = !now;
    document.documentElement.classList.toggle('lscape-blocked', now);
    if (now && document.activeElement && box.contains(document.activeElement) === false) document.activeElement.blur?.();
    for (const fn of listeners) fn(now);
  }

  if (query.addEventListener) query.addEventListener('change', update);
  else query.addListener?.(update); // 옛 사파리
  window.addEventListener('resize', update); // 혹시 change 가 안 오는 브라우저를 위해
  window.addEventListener('orientationchange', update);
  update();

  return {
    el: box,
    get blocked() {
      return !!blocked;
    },
    listen(fn) {
      listeners.add(fn);
      fn(!!blocked);
      return () => listeners.delete(fn);
    },
  };
}

export function installLandscapeGuard({ onChange, lang } = {}) {
  if (!guard) guard = createGuard(lang);
  const off = onChange ? guard.listen(onChange) : () => {};
  return {
    el: guard.el,
    get blocked() {
      return guard.blocked;
    },
    off,
  };
}
