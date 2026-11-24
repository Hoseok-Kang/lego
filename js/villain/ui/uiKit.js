// ─────────────────────────────────────────────────────────────
// 악당 타이쿤: 화면 공통 도구
// 여러 화면(소굴 · 상점 · 습격 정보판 · 결과)이 함께 쓰는 작은 도구 모음입니다.
//
// 쓰는 법
//   el('<div class="x">…</div>')          HTML 글자 → 요소 하나
//   escapeHTML(글)                         이름처럼 사용자가 적은 글을 화면에 안전하게 넣기
//   money(123456) → '123,456'             돈 숫자 모양
//   coin(120)                              동전 아이콘 + 숫자 HTML
//   countTo(요소, 숫자, { duration })       숫자가 또르르 올라가게 (요소.textContent 를 바꿈)
//   bump(요소, 'is-bump')                   짧은 통통 효과 한 번 (css 의 .is-bump 애니메이션을 다시 틀어 줌)
//   askDialog(상자, { title, message, yes, no, danger }) → Promise<true|false>   화면 안 확인 창 (window.confirm 안 씀)
//   toast(글, { kind: 'good' | 'bad' })     아래쪽에 잠깐 뜨는 알림
//   isCalm()                               움직임 줄이기 설정이거나 녹화(body.capture) 중이면 true → 숫자 애니메이션 생략
//
// 확인 창 기본 단추 글자는 아래 TEXT, 모양은 css/villain.css (확인 창 .vt-dialog, 알림 .vt-toast) 에서 바꿉니다.
// ─────────────────────────────────────────────────────────────

import { icon } from './uiIcons.js';
import { L } from '../lang/lang.js';

// 화면에 보이는 글자 (확인 창의 기본 단추)
const TEXT = L({
  ko: { yes: '네', no: '아니요' },
  en: { yes: 'Yes', no: 'No' },
});

const TOAST_SECONDS = 2.4; // 알림이 떠 있는 시간

export function el(html) {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
}

export function escapeHTML(text) {
  return String(text ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}

export function money(value) {
  return Math.round(Number(value) || 0).toLocaleString('ko-KR');
}

export function coin(value, { sign = false } = {}) {
  const n = Math.round(Number(value) || 0);
  const text = sign && n > 0 ? `+${money(n)}` : money(n);
  return `<span class="coin">${icon('coin')}<b>${text}</b></span>`;
}

export function isCalm() {
  if (document.body.classList.contains('capture')) return true;
  return !!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

// 숫자가 또르르 올라가거나 내려감
const running = new WeakMap();
export function countTo(node, to, { duration = 0.6, format = money, from = null } = {}) {
  if (!node) return;
  const target = Math.round(Number(to) || 0);
  const start = from ?? (Number(node.dataset.value ?? target) || 0);
  cancelAnimationFrame(running.get(node));
  node.dataset.value = String(target);
  if (isCalm() || start === target || duration <= 0) {
    node.textContent = format(target);
    return;
  }
  const t0 = performance.now();
  const tick = (now) => {
    const k = Math.min(1, (now - t0) / (duration * 1000));
    const eased = 1 - (1 - k) ** 3;
    node.textContent = format(start + (target - start) * eased);
    if (k < 1) running.set(node, requestAnimationFrame(tick));
  };
  running.set(node, requestAnimationFrame(tick));
}

// css 애니메이션을 처음부터 다시 틀기
export function bump(node, className = 'is-bump') {
  if (!node) return;
  node.classList.remove(className);
  void node.offsetWidth; // 다시 그리게 해서 애니메이션을 처음으로
  node.classList.add(className);
}

// 화면 안 확인 창. 바깥을 누르거나 Esc 는 '아니요'
export function askDialog(host, { title = '', message = '', yes = TEXT.yes, no = TEXT.no, danger = false } = {}) {
  return new Promise((resolve) => {
    host.querySelector(':scope > .vt-dialog')?.remove();
    const veil = el(`
      <div class="vt-dialog">
        <div class="vt-dialog-card" role="alertdialog" aria-modal="true">
          ${title ? `<h3 class="vt-dialog-title">${escapeHTML(title)}</h3>` : ''}
          <p class="vt-dialog-text">${escapeHTML(message)}</p>
          <div class="vt-dialog-actions">
            <button type="button" class="vt-btn" data-answer="no">${escapeHTML(no)}</button>
            <button type="button" class="vt-btn ${danger ? 'vt-btn--danger' : 'vt-btn--go'}" data-answer="yes">${escapeHTML(yes)}</button>
          </div>
        </div>
      </div>`);
    const finish = (answer) => {
      document.removeEventListener('keydown', onKey, true);
      veil.remove();
      resolve(answer);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        finish(false);
      }
    };
    veil.addEventListener('click', (event) => {
      const answer = event.target.closest('[data-answer]')?.dataset.answer;
      if (answer) finish(answer === 'yes');
      else if (event.target === veil) finish(false);
    });
    document.addEventListener('keydown', onKey, true);
    host.append(veil);
    veil.querySelector('[data-answer="no"]').focus({ preventScroll: true });
  });
}

// 아래쪽 알림 한 줄 (새 알림이 오면 앞의 것은 바로 사라짐)
let toastTimer = 0;
export function toast(message, { kind = '' } = {}) {
  let box = document.querySelector('.vt-toast');
  if (!box) {
    box = el('<div class="vt-toast" role="status" aria-live="polite"></div>');
    document.body.append(box);
  }
  box.textContent = message;
  box.dataset.kind = kind;
  bump(box, 'is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => box.classList.remove('is-on'), TOAST_SECONDS * 1000);
}
