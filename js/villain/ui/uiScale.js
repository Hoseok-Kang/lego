// ─────────────────────────────────────────────────────────────
// 악당 타이쿤: 화면 크기 (글자 · 단추 · 판을 한꺼번에 작게 / 보통 / 크게)
// 화면 위에 뜨는 모든 것(#ui 상자)을 통째로 줄이거나 키웁니다 (CSS transform: scale). 3D 마을(#stage)은 그대로예요.
// 실제 배율 = 화면 크기에 맞춘 기본 배율(AUTO) × 사용자가 고른 크기(SIZES)
//   휴대폰 가로 · 작은 창 (컴퓨터 조건이 아닌 화면)  → AUTO.compact
//   컴퓨터 (너비 900 이상 + 높이 521 이상)            → 1280×720 을 1 로 보고, 화면 크기에 맞춰 AUTO.desktopMin ~ AUTO.desktopMax
// 고른 크기는 브라우저에 기억합니다 (localStorage 'villainTycoon.uiScale').
// CSS 는 :root 의 --ui-scale 값을 씁니다 (css/villain.css 의 .ui 와 --edge-* 여백).
//
// 쓰는 법
//   initUiScale()             처음 한 번 (ui/boot.js 가 부름). 화면 크기가 바뀌면 저절로 다시 맞춤
//   uiScale()                 지금 실제 배율 (화면 픽셀 = #ui 안 픽셀 × 배율)
//   uiSize()                  지금 고른 크기 'small' | 'normal' | 'large'
//   setUiSize(이름)            크기 바꾸기 (+ 기억)
//   onUiScaleChange(fn)       배율이 바뀔 때마다 fn(배율) → 그만 듣기 함수
//   UI_SIZES                  [{ key, label }] 설정 창에 보여 줄 목록 (글자는 아래 TEXT)
//
// 숫자는 아래 SIZES · AUTO 에서 바꿉니다.
// ─────────────────────────────────────────────────────────────

import { L } from '../lang/lang.js';

const TEXT = L({
  ko: { small: '작게', normal: '보통', large: '크게' },
  en: { small: 'Small', normal: 'Normal', large: 'Large' },
});

const KEY = 'villainTycoon.uiScale';
const SIZES = { small: 0.86, normal: 1, large: 1.15 }; // 사용자가 고르는 크기 (보통 = 1)
const AUTO = {
  compact: 0.9, // 휴대폰 가로 · 작은 창: 예전보다 조금 작게 (3D 소굴이 더 넓게 보이게)
  desktopMin: 0.85, // 작은 컴퓨터 창 (960×540 등)
  desktopMax: 1.4, // 큰 모니터 (1920×1080 등): 너무 작아 보이지 않게 키움
  baseW: 1280,
  baseH: 720,
};
const COMPACT_QUERY = '(max-width: 899px), (max-height: 520px)'; // css/villain-lair.css 의 '휴대폰 가로 · 작은 창' 과 같은 조건

export const UI_SIZES = Object.keys(SIZES).map((key) => ({ key, label: TEXT[key] }));

let size = 'normal';
let scale = 1;
let started = false;
const listeners = new Set();

function readSize() {
  try {
    const saved = localStorage.getItem(KEY);
    return saved in SIZES ? saved : 'normal';
  } catch {
    return 'normal';
  }
}

function autoScale() {
  if (window.matchMedia?.(COMPACT_QUERY).matches) return AUTO.compact;
  const fit = Math.min(window.innerWidth / AUTO.baseW, window.innerHeight / AUTO.baseH);
  return Math.max(AUTO.desktopMin, Math.min(AUTO.desktopMax, fit));
}

function apply() {
  const next = Math.round(autoScale() * SIZES[size] * 1000) / 1000;
  const root = document.documentElement;
  root.dataset.uiSize = size;
  if (next === scale && root.style.getPropertyValue('--ui-scale')) return;
  scale = next;
  root.style.setProperty('--ui-scale', String(scale));
  for (const fn of listeners) fn(scale);
}

export function initUiScale() {
  if (started) return;
  started = true;
  size = readSize();
  apply();
  window.addEventListener('resize', apply);
}

export function uiScale() {
  return scale;
}

export function uiSize() {
  return size;
}

export function setUiSize(next) {
  if (!(next in SIZES)) return;
  size = next;
  try {
    localStorage.setItem(KEY, size);
  } catch {
    // 기억을 못 해도 지금 화면에는 적용됨
  }
  apply();
  window.dispatchEvent(new Event('resize')); // 3D 칸 · 카메라가 새 크기에 맞추게
}

export function onUiScaleChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
