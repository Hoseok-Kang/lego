// ─────────────────────────────────────────────────────────────
// 악당 타이쿤: 화면 설정 작은 창 (소굴 머리줄의 톱니바퀴 단추를 누르면 그 아래에 뜸)
//   화면 크기: [작게] [보통] [크게]   → ui/uiScale.js 가 화면 위의 글자 · 단추 · 판을 한꺼번에 줄이고 키움
//   말: [한국어] [English]            → lang/lang.js 의 setLang 이 고른 말을 기억하고 페이지를 새로 엶
//   3D 확대 안내 한 줄 (두 손가락 · 휠 · +/− 단추)
// 창 밖을 누르거나 Esc 를 누르면 닫혀요.
//
// 쓰는 법
//   const settings = createSettingsPop({ host, button })
//       host: 창을 넣을 화면 상자 (소굴 화면),  button: 톱니바퀴 단추 (누르면 열고 닫음)
//   settings.open() / settings.close() / settings.isOpen
//
// 글자는 아래 TEXT, 모양은 css/villain.css 의 .vt-settings 에서 바꿉니다.
// ─────────────────────────────────────────────────────────────

import { el } from './uiKit.js';
import { UI_SIZES, uiSize, setUiSize, uiScale } from './uiScale.js';
import { L, LANG, LANG_CHOICES, setLang } from '../lang/lang.js';

const TEXT = L({
  ko: {
    title: '화면 설정',
    size: '글자 · 단추 크기',
    lang: '말 · Language',
    zoomHint: '3D 화면은 두 손가락으로 벌리거나 마우스 휠로 확대해요',
    close: '닫기',
  },
  en: {
    title: 'Settings',
    size: 'Text & button size',
    lang: 'Language · 언어',
    zoomHint: 'Zoom the 3D view with two fingers or the mouse wheel',
    close: 'Close',
  },
});

export function createSettingsPop({ host, button }) {
  const pop = el(`
    <div class="vt-settings" role="dialog" aria-label="${TEXT.title}" hidden>
      <b class="vt-settings-title">${TEXT.title}</b>
      <div class="vt-settings-row">
        <span>${TEXT.size}</span>
        <div class="vt-seg" role="group" aria-label="${TEXT.size}">
          ${UI_SIZES.map((s) => `<button type="button" class="vt-seg-btn" data-size="${s.key}" aria-pressed="false">${s.label}</button>`).join('')}
        </div>
      </div>
      <div class="vt-settings-row">
        <span>${TEXT.lang}</span>
        <div class="vt-seg vt-seg--two" role="group" aria-label="${TEXT.lang}">
          ${LANG_CHOICES.map((c) => `<button type="button" class="vt-seg-btn" data-lang="${c.code}" lang="${c.code}" aria-pressed="${c.code === LANG}">${c.label}</button>`).join('')}
        </div>
      </div>
      <p class="vt-settings-hint">${TEXT.zoomHint}</p>
    </div>`);
  host.append(pop);
  button.setAttribute('aria-expanded', 'false');

  function paint() {
    for (const b of pop.querySelectorAll('[data-size]')) b.setAttribute('aria-pressed', String(b.dataset.size === uiSize()));
  }

  // 단추 바로 아래에 (화면 밖으로 나가지 않게). host 안은 화면 크기 배율만큼 줄어 있어서 화면 px 를 나눔
  function place() {
    const k = uiScale() || 1;
    const h = host.getBoundingClientRect();
    const b = button.getBoundingClientRect();
    const width = pop.offsetWidth;
    const bl = (b.left - h.left) / k;
    const br = (b.right - h.left) / k;
    // 단추가 화면 오른쪽 절반이면 단추 오른쪽 끝에, 왼쪽 절반(휴대폰의 왼쪽 기둥)이면 단추 왼쪽 끝에 맞춤
    const want = bl > host.clientWidth / 2 ? br - width : bl;
    pop.style.left = `${Math.round(Math.max(8, Math.min(host.clientWidth - width - 8, want)))}px`;
    const top = Math.round((b.bottom - h.top) / k + 8);
    pop.style.top = `${top}px`;
    pop.style.maxHeight = `${Math.max(140, host.clientHeight - top - 8)}px`; // 낮은 화면에서는 창 안을 밀어 보게 (말 고르기 줄이 늘어서)
  }

  function open() {
    paint();
    pop.hidden = false;
    place();
    button.setAttribute('aria-expanded', 'true');
    button.classList.add('is-on');
  }

  function close() {
    if (pop.hidden) return;
    pop.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    button.classList.remove('is-on');
  }

  button.addEventListener('click', (event) => {
    event.stopPropagation();
    if (pop.hidden) open();
    else close();
  });

  pop.addEventListener('click', (event) => {
    const langChoice = event.target.closest('[data-lang]');
    if (langChoice) {
      if (langChoice.dataset.lang !== LANG) setLang(langChoice.dataset.lang); // 말을 바꾸면 페이지를 새로 엶
      return;
    }
    const choice = event.target.closest('[data-size]');
    if (!choice) return;
    setUiSize(choice.dataset.size);
    paint();
    requestAnimationFrame(place); // 크기가 바뀌면 단추 자리도 바뀜
  });

  // 창 밖을 누르면 닫힘
  document.addEventListener('pointerdown', (event) => {
    if (!pop.hidden && !pop.contains(event.target) && !button.contains(event.target)) close();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !pop.hidden) {
      close();
      event.preventDefault();
    }
  });
  window.addEventListener('resize', () => {
    if (!pop.hidden) place();
  });

  return {
    open,
    close,
    get isOpen() {
      return !pop.hidden;
    },
  };
}
