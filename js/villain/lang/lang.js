// ─────────────────────────────────────────────────────────────
// 악당 타이쿤: 말(언어) 고르기 — 한국어 / English
// 게임이 한국어로 나올지 영어로 나올지를 페이지를 열 때 한 번 정합니다.
// 영어판 이름은 "Doodle Kaiju" 예요 (주인이 고른 이름. 아래 GAME_TITLE).
//
// 어떻게 정하나요? (위에서부터 먼저 맞는 것)
//   ① 주소 끝의 ?lang=en 또는 ?lang=ko   (고른 것을 브라우저에 기억도 함)
//   ② 브라우저에 기억한 말 (localStorage 'villainTycoon.lang')
//   ③ 브라우저 말이 ko 로 시작하면 한국어, 아니면 영어
//
// 쓰는 법
//   import { L, LANG } from '../lang/lang.js';
//   const TEXT = L({ ko: { title: '괴수 도감' }, en: { title: 'Monster Book' } });
//       → 지금 말에 맞는 쪽을 돌려줌. 영어가 빠져 있으면 한국어를 대신 씀 (시험 중이면 콘솔에 한 번 알림)
//       → 둘 다 { } 묶음이면 낱말 하나하나를 맞춰 봄: 영어에 빠진 낱말만 한국어로 채움
//   name: L({ ko: '악당 왕좌', en: 'Villain Throne' })     데이터 표의 이름 한 칸에도 똑같이 씀
//   LANG                지금 말 'ko' | 'en'
//   IS_EN               영어면 true
//   setLang('en')       말을 바꾸고 기억한 뒤 페이지를 새로 엶 (설정 창의 한국어 / English 단추)
//   GAME_TITLE          게임 이름 ('악당 타이쿤' / 'Doodle Kaiju')
//   GAME_TITLE_PARTS    소굴 머리줄 로고에 두 줄로 쓰는 이름 (['악당', '타이쿤'] / ['Doodle', 'Kaiju'])
//   LANG_CHOICES        설정 창에 보여 줄 말 목록 [{ code, label }] (글자는 그 나라 말 그대로)
//   plural(n, 'coin')   영어 낱말 수 맞추기 → '1 coin' / '5 coins'  (불규칙이면 plural(n, 'box', 'boxes'))
//   num(n)              숫자에 쉼표 (1,234)
//
// 새 글자를 넣을 때: 한국어 옆에 en 을 같이 적어 주세요. 영어를 고치려면 en: 쪽 글자만 바꾸면 됩니다.
// 이 파일은 다른 게임 파일보다 먼저 불려야 해서 ui/boot.js 맨 위에서 가장 먼저 불러요.
// ─────────────────────────────────────────────────────────────

// 이 파일이 직접 보여 주는 글자 (처음 여는 동안 잠깐 보이는 글 — 한국어는 villain.html 에 적혀 있음)
const TEXT = {
  bootEn: 'Opening the monster lair…',
};

const KEY = 'villainTycoon.lang';
const CODES = ['ko', 'en'];

// 설정 창에 보이는 말 이름 (어느 말로 보든 그 나라 말로 적는 게 약속이에요)
export const LANG_CHOICES = [
  { code: 'ko', label: '한국어' },
  { code: 'en', label: 'English' },
];

function readSaved() {
  try {
    const saved = localStorage.getItem(KEY);
    return CODES.includes(saved) ? saved : null;
  } catch {
    return null; // 개인 정보 보호 창 등 (기억을 못 해도 괜찮음)
  }
}

function save(code) {
  try {
    localStorage.setItem(KEY, code);
    return true;
  } catch {
    return false;
  }
}

function decide() {
  try {
    const asked = new URLSearchParams(location.search).get('lang');
    if (CODES.includes(asked)) {
      save(asked);
      return asked;
    }
  } catch {
    // 주소를 못 읽는 곳이면 그냥 다음 방법으로
  }
  const saved = readSaved();
  if (saved) return saved;
  const browser = String(globalThis.navigator?.language || '').toLowerCase();
  return browser.startsWith('ko') ? 'ko' : 'en';
}

export const LANG = decide();
export const IS_EN = LANG === 'en';

// 시험 중(내 컴퓨터에서 열었거나 주소에 ?debug)일 때만 빠진 영어를 콘솔에 알림
const DEBUG = (() => {
  try {
    return /^(localhost|127\.0\.0\.1)$/.test(location.hostname) || new URLSearchParams(location.search).has('debug');
  } catch {
    return false;
  }
})();
const warned = new Set();
function warnMissing(what) {
  if (!DEBUG || LANG === 'ko') return;
  const key = String(what).slice(0, 40);
  if (warned.has(key)) return;
  warned.add(key);
  console.warn('[lang] 영어 글자가 빠졌어요 (한국어로 대신 보여요):', key);
}

const isPlain = (v) => v && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;

// 한국어 묶음에 있는 낱말이 영어 묶음에 없으면 한국어로 채움 (둘 다 { } 묶음일 때, 안쪽 묶음까지)
function fill(ko, en) {
  const out = { ...en };
  for (const k of Object.keys(ko)) {
    if (!(k in en)) {
      warnMissing(`${k}: ${typeof ko[k] === 'string' ? ko[k] : ''}`);
      out[k] = ko[k];
    } else if (isPlain(ko[k]) && isPlain(en[k])) out[k] = fill(ko[k], en[k]);
  }
  return out;
}

export function L(table) {
  if (!table || typeof table !== 'object') return table;
  const { ko } = table;
  if (LANG === 'ko') return ko;
  const value = table[LANG];
  if (value === undefined) {
    warnMissing(typeof ko === 'string' ? ko : JSON.stringify(ko ?? '').slice(0, 40));
    return ko;
  }
  if (isPlain(ko) && isPlain(value)) return fill(ko, value);
  return value;
}

export function setLang(code) {
  if (!CODES.includes(code)) return;
  const saved = save(code);
  try {
    const url = new URL(location.href);
    // 주소에 ?lang= 이 있으면 (또는 기억을 못 하는 브라우저면) 주소에도 새 말을 적어야 새로 열어도 바뀜
    if (url.searchParams.has('lang') || !saved) url.searchParams.set('lang', code);
    if (url.href === location.href) location.reload();
    else location.replace(url.href);
  } catch {
    location.reload();
  }
}

export const GAME_TITLE_PARTS = L({ ko: ['악당', '타이쿤'], en: ['Doodle', 'Kaiju'] });
export const GAME_TITLE = GAME_TITLE_PARTS.join(' ');

// 영어 낱말 수: plural(1, 'coin') → '1 coin', plural(3, 'coin') → '3 coins'
export function plural(n, one, many = `${one}s`) {
  const count = Number(n) || 0;
  return `${num(count)} ${Math.abs(count) === 1 ? one : many}`;
}

// 숫자에 쉼표 (한국어 · 영어 모두 1,234 꼴)
export function num(n) {
  return Math.round(Number(n) || 0).toLocaleString(LANG === 'ko' ? 'ko-KR' : 'en-US');
}

// 페이지 전체에 지금 말 알리기 (글꼴 · 읽어 주기 프로그램이 씀) + 브라우저 탭 이름 + 처음 여는 동안 보이는 글
if (typeof document !== 'undefined') {
  document.documentElement.lang = LANG;
  if (IS_EN) {
    document.title = GAME_TITLE;
    const boot = document.getElementById('bootMessage');
    if (boot) boot.textContent = TEXT.bootEn;
  }
}
