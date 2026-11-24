// ─────────────────────────────────────────────────────────────
// 악당 타이쿤: 3D 확대 단추 묶음 [처음 보기] [−] [+]  (소굴 3D 칸 · 습격 정보판에서 씀)
// 단추만 만들고, 누르면 알려 주기만 합니다. 실제 확대는 부른 쪽이 합니다 (lair/lairZoom.js, raid 는 game.js → stage.view).
//
// 쓰는 법
//   const zoom = createZoomButtons({ onZoom(방향), onReset(), className })
//       onZoom(+1) 가까이 · onZoom(-1) 멀리,  onReset() 처음 보기로
//       className: 붙일 자리 이름 (예: 'lair-zoom') → 위치는 그 화면 CSS 에서 정함
//   zoom.el                 단추 묶음 상자 (원하는 곳에 append)
//   zoom.setLevel(배율)      지금 확대 배율 → 1 이 아니면 [처음 보기] 단추가 보임, 한도에 닿으면 그 단추가 흐려짐
//
// 글자(소리 내어 읽어 주는 이름)는 아래 TEXT, 모양은 css/villain.css 의 .vt-zoom 에서 바꿉니다.
// ─────────────────────────────────────────────────────────────

import { el } from './uiKit.js';

const TEXT = {
  in: '가까이 보기',
  out: '멀리 보기',
  reset: '처음 보기로',
};

const line = 'fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"';
const ICON = {
  in: `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 5v14M5 12h14" ${line}/></svg>`,
  out: `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12h14" ${line}/></svg>`,
  reset: `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" ${line} stroke-width="2.6"/><circle cx="12" cy="12" r="2.6" fill="currentColor"/></svg>`,
};

export function createZoomButtons({ onZoom, onReset, className = '', min = 0.85, max = 2.8 } = {}) {
  const box = el(`
    <div class="vt-zoom ${className}" role="group" aria-label="확대">
      <button type="button" class="vt-zoom-btn" data-zoom="reset" aria-label="${TEXT.reset}" title="${TEXT.reset}" hidden>${ICON.reset}</button>
      <button type="button" class="vt-zoom-btn" data-zoom="out" aria-label="${TEXT.out}" title="${TEXT.out}">${ICON.out}</button>
      <button type="button" class="vt-zoom-btn" data-zoom="in" aria-label="${TEXT.in}" title="${TEXT.in}">${ICON.in}</button>
    </div>`);
  const resetBtn = box.querySelector('[data-zoom="reset"]');
  const inBtn = box.querySelector('[data-zoom="in"]');
  const outBtn = box.querySelector('[data-zoom="out"]');

  box.addEventListener('click', (event) => {
    const button = event.target.closest('[data-zoom]');
    if (!button) return;
    event.stopPropagation(); // 3D 칸 누름(시설 고르기 등)으로 번지지 않게
    if (button.dataset.zoom === 'reset') onReset?.();
    else onZoom?.(button.dataset.zoom === 'in' ? 1 : -1);
  });
  // 단추를 눌러도 3D 칸이 손가락을 잡지 않게
  box.addEventListener('pointerdown', (event) => event.stopPropagation());

  return {
    el: box,
    setLevel(level) {
      resetBtn.hidden = Math.abs(level - 1) < 0.02;
      inBtn.classList.toggle('is-limit', level >= max - 0.001);
      outBtn.classList.toggle('is-limit', level <= min + 0.001);
    },
  };
}
