// ─────────────────────────────────────────────────────────────
// 악당 타이쿤 3D 작업대: 화면 글자 (TEXT) + 화면 틀 (HTML)
// 작업대 화면(sculptScreen.js)에 보이는 글자는 모두 여기 TEXT 에 있어요. 글자만 바꾸면 화면에 그대로 나옵니다.
//
// 쓰는 법: TEXT (글자 묶음), sculptMarkup(maxBlocks) → 화면 틀 HTML
// 모양은 css/villain-sculpt.css · css/villain-sculpt2.css 에서 바꿉니다.
// ─────────────────────────────────────────────────────────────

import { icon } from '../draw/paintIcons.js';

export const TEXT = {
  title: '3D 블록 작업대',
  back: '소굴로',
  backHint: '저장하지 않고 소굴로 돌아가요',
  steps: ['쌓기', '부품 붙이기', '이름 · 저장'],
  stepsLabel: '만드는 차례',
  toolsLabel: '쌓기 도구',
  colorsLabel: '색 고르기',
  blocks: '블록',
  cost: '출동 값',
  hp: '체력',
  speed: '빠르기',
  money: '내 돈',
  name: '이름',
  namePlaceholder: '내 괴수',
  nameTitle: '이름을 지어 주세요',
  nextBuild: '다음: 부품',
  nextParts: '다음: 이름 · 저장',
  save: '도감에 저장하기',
  saved: '저장했어요!',
  savedToast: (name) => `${name}, 도감에 넣었어요!`,
  prevBuild: '블록 고치기',
  prevParts: '부품 고치기',
  previewTag: '끌어서 돌려 봐요',
  previewEmpty: '여기에 괴수가 나타나요',
  poor: (n) => `돈이 ${n} 모자라요. 저장은 할 수 있어요.`,
  good: { build: '멋져요! 다 쌓았으면 부품을 붙여요.', parts: '부품을 붙이고 이름을 지어요.', save: '준비 끝! 저장하고 출동해요.' },
  full: (n) => `블록은 ${n}개까지 쌓을 수 있어요.`,
  clearAsk: '블록을 전부 지울까요?',
  clearYes: '지울래요',
  no: '아니요',
  leaveAsk: '저장하지 않고 나갈까요? 쌓은 블록이 사라져요.',
  leaveYes: '나갈래요',
  leaveNo: '계속 쌓을래요',
  builtInCopy: '고쳐서 저장하면 내 괴수로 복사돼요.',
};

export function sculptMarkup(maxBlocks) {
  return `
    <header class="vd-top">
      <button type="button" class="pb-btn vd-back" title="${TEXT.backHint}">${icon('back')}<span>${TEXT.back}</span></button>
      <ol class="vd-steps" aria-label="${TEXT.stepsLabel}">
        ${TEXT.steps.map((label, i) => `<li><button type="button" class="vd-step" data-step="${['build', 'parts', 'save'][i]}"><i>${i + 1}</i><span>${label}</span></button></li>`).join('')}
      </ol>
      <div class="vs-count" title="${TEXT.blocks} · ${TEXT.cost}">
        <span class="pb-count-block" aria-hidden="true"></span><b class="vs-blocks">0</b><small>/${maxBlocks}</small>
        ${icon('coin')}<b class="vs-cost">0</b>
      </div>
    </header>
    <div class="vd-main">
      <div class="vd-pane vs-build">
        <div class="pb-tools vs-tools" role="toolbar" aria-label="${TEXT.toolsLabel}"></div>
        <div class="pb-palette vs-palette" aria-label="${TEXT.colorsLabel}"></div>
        <div class="vs-center">
          <div class="vs-view-host"></div>
          <div class="vs-bar">
            <span class="vs-stat" title="${TEXT.hp}">${icon('heart')}<b class="vs-hp">0</b></span>
            <span class="vs-stat" title="${TEXT.speed}">${icon('speed')}<b class="vs-speed">0</b></span>
            <p class="vs-note" aria-live="polite"></p>
            <button type="button" class="pb-btn pb-btn--primary vs-next"><span>${TEXT.nextBuild}</span>${icon('next')}</button>
          </div>
        </div>
        <div class="vs-slice-host"></div>
      </div>
      <div class="vd-pane vs-parts" hidden></div>
      <div class="vd-pane vs-save" hidden>
        <div class="vs-save-look"></div>
        <div class="vs-save-card">
          <label class="vs-name"><span>${TEXT.nameTitle}</span><input type="text" maxlength="12" autocomplete="off" spellcheck="false" enterkeyhint="done" placeholder="${TEXT.namePlaceholder}"></label>
        </div>
      </div>
    </div>
    <div class="vd-dock">
      <div class="vd-preview" data-empty="${TEXT.previewEmpty}"><div class="vd-preview-view"></div><span class="vd-preview-tag">${TEXT.previewTag}</span></div>
      <dl class="vd-bill">
        <div><dt>${TEXT.cost}</dt><dd>${icon('coin')}<b class="vd-cost">0</b></dd></div>
        <div><dt>${TEXT.hp}</dt><dd>${icon('heart')}<b class="vd-hp">0</b></dd></div>
        <div><dt>${TEXT.speed}</dt><dd>${icon('speed')}<b class="vd-speed">0</b></dd></div>
        <div><dt>${TEXT.money}</dt><dd>${icon('coin')}<b class="vd-money">0</b></dd></div>
      </dl>
      <p class="vd-note" aria-live="polite"></p>
      <div class="vd-actions">
        <button type="button" class="pb-btn vd-prev">${icon('back')}<span>${TEXT.prevBuild}</span></button>
        <button type="button" class="pb-btn pb-btn--primary vd-next"><span class="vd-next-text">${TEXT.nextParts}</span>${icon('next')}</button>
      </div>
    </div>
    <div class="vd-toast" role="status" aria-live="polite" hidden></div>`;
}
