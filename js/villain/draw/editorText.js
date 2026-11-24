// ─────────────────────────────────────────────────────────────
// 악당 타이쿤: 괴수 그리기 화면의 글자 (TEXT) + 화면 틀 (HTML)
// 그리기 화면(editorScreen.js)에 보이는 글자는 모두 여기 TEXT 에 있어요. 글자만 바꾸면 화면에 그대로 나옵니다.
//
// 쓰는 법: TEXT (글자 묶음), editorMarkup() → 화면 틀 HTML
// 모양은 css/villain-draw.css · css/villain-draw2.css 에서 바꿉니다.
// ─────────────────────────────────────────────────────────────

import { icon } from './paintIcons.js';

export const TEXT = {
  title: '괴수 그리기',
  back: '소굴로',
  backHint: '저장하지 않고 소굴로 돌아가요',
  steps: ['그리기', '부품 붙이기', '저장'],
  stepsLabel: '만드는 차례',
  name: '이름',
  namePlaceholder: '내 괴수',
  previewTag: '끌어서 돌려 봐요',
  previewFlat: '내 괴수',
  previewEmpty: '여기에 괴수가 나타나요',
  cost: '출동 값',
  hp: '체력',
  speed: '빠르기',
  money: '내 돈',
  toSculpt: '3D 작업대로',
  toSculptHint: '이 그림을 3D 블록 작업대로 가져가 블록을 하나하나 쌓아요',
  toSculptAsk: '이 그림을 3D 작업대로 가져갈까요? 그림판에서 고친 것은 저장되지 않아요.',
  toSculptYes: '가져갈래요',
  toSculptNo: '아니요',
  prev: '그림 고치기',
  nextDraw: '다음: 부품 붙이기',
  nextParts: '저장하기',
  nextSaved: '저장했어요!',
  poor: (n) => `돈이 ${n} 모자라요. 저장은 할 수 있어요.`,
  goodDraw: '멋져요! 이제 부품을 붙여요.',
  goodParts: '준비 끝! 저장하고 출동해요.',
  partsDropped: '그림이 바뀌어서 부품이 떨어졌어요. 다시 붙여 주세요.',
  saved: (name) => `${name}, 도감에 넣었어요!`,
  leaveAsk: '저장하지 않고 나갈까요? 그린 그림이 사라져요.',
  leaveYes: '나갈래요',
  leaveNo: '계속 그릴래요',
  builtInCopy: '고쳐서 저장하면 내 괴수로 복사돼요.',
};

export function editorMarkup() {
  return `
    <header class="vd-top">
      <button type="button" class="pb-btn vd-back" title="${TEXT.backHint}">${icon('back')}<span>${TEXT.back}</span></button>
      <ol class="vd-steps" aria-label="${TEXT.stepsLabel}">
        <li><button type="button" class="vd-step" data-step="draw"><i>1</i><span>${TEXT.steps[0]}</span></button></li>
        <li><button type="button" class="vd-step" data-step="parts"><i>2</i><span>${TEXT.steps[1]}</span></button></li>
        <li><span class="vd-step" data-step="save"><i>3</i><span>${TEXT.steps[2]}</span></span></li>
      </ol>
      <button type="button" class="pb-btn vd-sculpt" hidden title="${TEXT.toSculptHint}">${icon('cube')}<span>${TEXT.toSculpt}</span></button>
      <label class="vd-name"><span>${TEXT.name}</span><input type="text" maxlength="12" autocomplete="off" spellcheck="false" enterkeyhint="done" placeholder="${TEXT.namePlaceholder}"></label>
    </header>
    <div class="vd-main">
      <div class="vd-pane vd-pane--draw"></div>
      <div class="vd-pane vd-pane--parts" hidden></div>
    </div>
    <div class="vd-dock">
      <div class="vd-preview" data-empty="${TEXT.previewEmpty}"><div class="vd-preview-view"></div><span class="vd-preview-tag">${TEXT.previewTag}</span></div>
      <dl class="vd-bill">
        <div class="vd-bill-cost"><dt>${TEXT.cost}</dt><dd>${icon('coin')}<b class="vd-cost">0</b></dd></div>
        <div class="vd-bill-hp"><dt>${TEXT.hp}</dt><dd>${icon('heart')}<b class="vd-hp">0</b></dd></div>
        <div class="vd-bill-speed"><dt>${TEXT.speed}</dt><dd>${icon('speed')}<b class="vd-speed">0</b></dd></div>
        <div class="vd-bill-money"><dt>${TEXT.money}</dt><dd>${icon('coin')}<b class="vd-money">0</b></dd></div>
      </dl>
      <p class="vd-note" aria-live="polite"></p>
      <div class="vd-actions">
        <button type="button" class="pb-btn vd-prev" hidden title="${TEXT.prev}">${icon('back')}<span>${TEXT.prev}</span></button>
        <button type="button" class="pb-btn pb-btn--primary vd-next"><span class="vd-next-text">${TEXT.nextDraw}</span>${icon('next')}</button>
      </div>
    </div>
    <div class="vd-toast" role="status" aria-live="polite" hidden></div>`;
}
