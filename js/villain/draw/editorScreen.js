// ─────────────────────────────────────────────────────────────
// 악당 타이쿤: 괴수 그리기 화면 (가로 화면 전용)
// 그림판(paintBoard.js) + 부품 붙이기(partPlacer.js) + 이름 · 값 · 미리보기 · 저장을 한 화면으로 묶습니다.
// 차례: ① 그리기 (두께 붓 포함) → ② 부품 붙이기 → ③ 저장
//
// 쓰는 법
//   const editor = createEditorScreen({ bestiary, saveStore, onDone, preview3d, root, partSlots, statsOf, sculptLock, onSculpt })
//     onDone(design | null)   저장하면 저장된 괴수, 그냥 나가면 null
//     preview3d(el)           (없어도 됨) 블록 괴수 미리보기를 el 안에 만들고 { show(design) } 를 돌려주는 함수
//     root                    (없어도 됨) 화면을 붙일 곳. 기본은 document.body
//     partSlots()             (없어도 됨) 지금 붙일 수 있는 부품 칸 수 (소굴 효과). 없으면 villainConfig 의 parts.slots
//     statsOf(design)         (없어도 됨) { cost, hp, speed } 소굴 효과를 넣은 숫자. 없으면 도감 계산 그대로
//     sculptLock()            (없어도 됨) 3D 작업대가 잠겼으면 안내 글, 열렸으면 '' → 열렸을 때만 [3D 작업대로 옮기기] 단추가 보임
//     onSculpt(design)        (없어도 됨) [3D 작업대로 옮기기] 를 누르면 지금 그림(두께 포함)을 넘김
//   editor.open(design | null)   괴수를 고치거나(null 이면 새로 그리기) 화면을 엶
//   editor.close()               화면을 닫음 (onDone 은 부르지 않음)
//   editor.el / editor.isOpen / editor.board / editor.placer / editor.getDesign()
//
// 화면 모양은 css/villain-draw.css · villain-draw2.css, 글자는 아래 TEXT 를 고치면 됩니다.
// ─────────────────────────────────────────────────────────────

import { VILLAIN } from '../villainConfig.js';
import { askConfirm } from './confirmBox.js';
import { createPaintBoard } from './paintBoard.js';
import { icon } from './paintIcons.js';
import { createPartPlacer } from './partPlacer.js';
import { drawDesign } from './pixelThumb.js';

const TEXT = {
  title: '괴수 그리기',
  back: '소굴로',
  backHint: '저장하지 않고 소굴로 돌아가요',
  steps: ['그리기', '부품 붙이기', '저장'],
  name: '이름',
  namePlaceholder: '내 괴수',
  previewTag: '끌어서 돌려 봐요',
  previewFlat: '내 괴수',
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

const FIRST_COLOR = 'P'; // 화면을 열 때 골라 두는 색 (보라). 초록은 마을 잔디와 같은 색이라 괴수가 안 보여서 피함
const PREVIEW_DELAY = 140; // 그리는 동안 미리보기를 너무 자주 다시 만들지 않게 (1/1000초)
const SAVED_DELAY = 650; // '저장했어요' 를 보여 주고 나가기까지

// 두 그림이 서로 좌우 거울 모양인지 (좌우가 똑같은 그림은 뒤집어도 그대로라 false)
function isMirrored(before, after) {
  let changed = false;
  for (let r = 0; r < after.length; r++) {
    const a = before[r] ?? '';
    const b = after[r] ?? '';
    if (a !== b) changed = true;
    if (a !== [...b].reverse().join('')) return false;
  }
  return changed;
}

export function createEditorScreen({ bestiary, saveStore, onDone, preview3d, root, partSlots = null, statsOf = null, sculptLock = null, onSculpt = null } = {}) {
  const el = document.createElement('section');
  el.className = 'vd-editor';
  el.id = 'villainEditor';
  el.hidden = true;
  el.setAttribute('aria-label', TEXT.title);
  el.innerHTML = `
    <header class="vd-top">
      <button type="button" class="pb-btn vd-back" title="${TEXT.backHint}">${icon('back')}<span>${TEXT.back}</span></button>
      <ol class="vd-steps" aria-label="만드는 차례">
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
      <div class="vd-preview"><div class="vd-preview-view"></div><span class="vd-preview-tag">${TEXT.previewTag}</span></div>
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
  (root ?? document.body).append(el);

  const $ = (selector) => el.querySelector(selector);
  const nameInput = $('.vd-name input');
  const drawPane = $('.vd-pane--draw');
  const partsPane = $('.vd-pane--parts');
  const dock = $('.vd-dock');
  const previewView = $('.vd-preview-view');
  const noteEl = $('.vd-note');
  const prevBtn = $('.vd-prev');
  const nextBtn = $('.vd-next');
  const sculptBtn = $('.vd-sculpt');
  const toastEl = $('.vd-toast');
  const { cols, rows } = VILLAIN.draw;

  const board = createPaintBoard(drawPane, {
    cols,
    rows,
    palette: VILLAIN.draw.palette,
    costOf: (cells, depths) => bestiary.designCost({ cols, rows, cells, depths, parts: [] }),
  });
  const placer = createPartPlacer(partsPane, { design: bestiary.blankDesign?.() ?? { cells: [], parts: [] }, ownedParts: [] });
  board.extra.append(dock);

  let design = null; // 지금 고치는 괴수 (id, builtIn 을 기억)
  let parts = [];
  let step = 'draw';
  let dirty = false;
  let busy = false;
  let previewTimer = 0;
  let toastTimer = 0;
  let doneTimer = 0;
  let preview = null;
  let flatCanvas = null;
  let lastCells = null; // 바로 전 그림 (좌우 뒤집기를 알아채는 데 씀)

  // ── 미리보기 ────────────────────────────────────────────
  function setupPreview() {
    if (preview || flatCanvas) return;
    if (typeof preview3d === 'function') {
      try {
        preview = preview3d(previewView) ?? null;
      } catch (error) {
        console.error(error);
        preview = null;
      }
    }
    if (!preview) {
      // 3D 미리보기가 없으면 도트 그림을 그대로 보여 줍니다
      flatCanvas = document.createElement('canvas');
      flatCanvas.width = 216;
      flatCanvas.height = 216;
      flatCanvas.className = 'vd-preview-flat';
      previewView.append(flatCanvas);
      $('.vd-preview-tag').textContent = TEXT.previewFlat;
    }
  }

  function currentDesign() {
    const cells = board.getCells();
    const out = {
      id: design?.id ?? null,
      name: nameInput.value.trim() || TEXT.namePlaceholder,
      cols,
      rows,
      cells,
      parts: parts.filter((p) => cells[p.row]?.[p.col] && cells[p.row][p.col] !== '.').map((p) => ({ ...p })),
      builtIn: design?.builtIn || undefined,
      updatedAt: design?.updatedAt ?? 0,
    };
    const depths = board.getDepths();
    if (depths.some((line) => /[1-9]/.test(line))) out.depths = depths;
    return out;
  }

  function showPreviewNow() {
    clearTimeout(previewTimer);
    previewTimer = 0;
    const now = currentDesign();
    const empty = bestiary.countBlocks(now) === 0;
    $('.vd-preview').classList.toggle('is-empty', empty);
    if (flatCanvas) drawDesign(flatCanvas, now);
    else if (!empty) {
      try {
        preview.show(now);
      } catch (error) {
        console.error(error);
      }
    }
  }

  function queuePreview() {
    if (!previewTimer) previewTimer = setTimeout(showPreviewNow, PREVIEW_DELAY);
  }

  // ── 값 · 체력 · 빠르기 · 안내 ───────────────────────────
  function numbersOf(now) {
    const own = statsOf?.(now);
    return {
      cost: own?.cost ?? bestiary.designCost(now),
      hp: Math.round(own?.hp ?? bestiary.designHp?.(now) ?? bestiary.countBlocks(now) * VILLAIN.monster.hpPerBlock),
      speed: own?.speed ?? bestiary.designSpeed?.(now) ?? 0,
    };
  }

  function refreshBill() {
    const now = currentDesign();
    const { cost, hp, speed } = numbersOf(now);
    const money = saveStore.getSave().money;
    const check = bestiary.validate(now);
    $('.vd-cost').textContent = String(cost);
    $('.vd-hp').textContent = String(hp);
    $('.vd-speed').textContent = speed.toFixed(1);
    $('.vd-money').textContent = String(money);
    board.setExtraCost(bestiary.partsCost ? bestiary.partsCost(now.parts) : 0);
    el.classList.toggle('is-over', check.ok && cost > money);
    nextBtn.classList.toggle('is-waiting', !check.ok);
    if (!check.ok) noteEl.textContent = check.message;
    else if (cost > money) noteEl.textContent = TEXT.poor(cost - money);
    else noteEl.textContent = step === 'draw' ? TEXT.goodDraw : TEXT.goodParts;
  }

  function toast(text) {
    toastEl.textContent = text;
    toastEl.hidden = false;
    toastEl.classList.remove('is-in');
    void toastEl.offsetWidth;
    toastEl.classList.add('is-in');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.hidden = true;
    }, 2200);
  }

  function nudge() {
    nextBtn.classList.remove('is-shake');
    void nextBtn.offsetWidth;
    nextBtn.classList.add('is-shake');
  }

  // ── 차례 바꾸기 ─────────────────────────────────────────
  function setStep(next) {
    if (next !== 'save') toastEl.hidden = true;
    step = next;
    el.dataset.step = next;
    const order = ['draw', 'parts', 'save'];
    for (const chip of el.querySelectorAll('.vd-step')) {
      const index = order.indexOf(chip.dataset.step);
      chip.classList.toggle('is-on', chip.dataset.step === next);
      chip.classList.toggle('is-done', index < order.indexOf(next));
    }
    const drawing = next === 'draw';
    drawPane.hidden = !drawing;
    partsPane.hidden = drawing;
    prevBtn.hidden = drawing;
    $('.vd-next-text').textContent = drawing ? TEXT.nextDraw : next === 'save' ? TEXT.nextSaved : TEXT.nextParts;
    (drawing ? board.extra : placer.extra).append(dock);
    if (drawing) board.refresh();
    else if (next === 'parts') {
      const before = parts.length;
      placer.setOwnedParts(saveStore.getSave().ownedParts);
      if (partSlots) placer.setSlots(partSlots());
      placer.setDesign(currentDesign());
      parts = placer.getParts();
      // 그림을 지우거나 옮겨서 부품 밑의 칸이 사라졌으면 알려 줌
      if (parts.length < before) toast(TEXT.partsDropped);
    }
    refreshBill();
    showPreviewNow();
  }

  function goNext() {
    if (busy) return;
    const check = bestiary.validate(currentDesign());
    if (!check.ok) {
      toast(check.message);
      nudge();
      if (step !== 'draw') setStep('draw');
      return;
    }
    if (step === 'draw') setStep('parts');
    else if (step === 'parts') saveNow();
  }

  function saveNow() {
    busy = true;
    const saved = bestiary.saveDesign(currentDesign());
    design = saved;
    dirty = false;
    setStep('save');
    toast(TEXT.saved(saved.name));
    doneTimer = setTimeout(() => {
      busy = false;
      close();
      onDone?.(saved);
    }, SAVED_DELAY);
  }

  async function leave() {
    if (busy) return;
    if (dirty) {
      const yes = await askConfirm(el, { message: TEXT.leaveAsk, yes: TEXT.leaveYes, no: TEXT.leaveNo, danger: true });
      if (!yes) return;
    }
    close();
    onDone?.(null);
  }

  // 3D 작업대로: 지금 그림(두께 포함)을 새 3D 괴수의 밑그림으로 넘김 (그림판 괴수는 그대로 둠)
  async function toSculpt() {
    if (busy || !onSculpt) return;
    if (dirty) {
      const yes = await askConfirm(el, { message: TEXT.toSculptAsk, yes: TEXT.toSculptYes, no: TEXT.toSculptNo });
      if (!yes) return;
    }
    const now = currentDesign();
    close();
    onSculpt({ ...now, id: null, builtIn: undefined });
  }

  // ── 이어 붙이기 ─────────────────────────────────────────
  board.onChange((cells) => {
    // 좌우 뒤집기(되돌리기 포함)로 그림이 거울처럼 바뀌었으면 붙인 부품도 같이 뒤집음
    if (lastCells && isMirrored(lastCells, cells)) parts = parts.map((p) => ({ ...p, col: cols - 1 - p.col }));
    lastCells = cells;
    dirty = true;
    refreshBill();
    queuePreview();
  });
  placer.onChange((next) => {
    parts = next;
    dirty = true;
    refreshBill();
    showPreviewNow();
  });
  nameInput.addEventListener('input', () => {
    dirty = true;
  });
  nameInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') nameInput.blur();
  });
  $('.vd-back').addEventListener('click', leave);
  sculptBtn.addEventListener('click', toSculpt);
  nextBtn.addEventListener('click', goNext);
  prevBtn.addEventListener('click', () => !busy && setStep('draw'));
  $('.vd-steps').addEventListener('click', (event) => {
    const target = event.target.closest('button.vd-step')?.dataset.step;
    if (!target || busy || target === step) return;
    if (target === 'parts') goNext();
    else setStep('draw');
  });

  function open(source) {
    clearTimeout(doneTimer);
    busy = false;
    setupPreview();
    design = bestiary.normalizeDesign ? bestiary.normalizeDesign(source ?? bestiary.blankDesign()) : { ...(source ?? {}) };
    if (source?.builtIn) design.builtIn = true;
    parts = (design.parts ?? []).map((p) => ({ ...p }));
    nameInput.value = source ? design.name : '';
    sculptBtn.hidden = !onSculpt || !sculptLock || sculptLock() !== '';
    el.hidden = false;
    toastEl.hidden = true;
    lastCells = null;
    board.setCells(design.cells ?? [], design.depths ?? null);
    lastCells = board.getCells();
    board.setColor(FIRST_COLOR);
    board.setTool('pencil');
    board.setDepthPick('.');
    board.setMirror(false);
    setStep('draw');
    dirty = false;
    if (source?.builtIn) toast(TEXT.builtInCopy);
  }

  function close() {
    clearTimeout(previewTimer);
    clearTimeout(doneTimer);
    previewTimer = 0;
    busy = false;
    el.hidden = true;
  }

  return {
    el,
    board,
    placer,
    open,
    close,
    get isOpen() {
      return !el.hidden;
    },
    getDesign: currentDesign,
    destroy() {
      close();
      clearTimeout(toastTimer);
      board.destroy();
      placer.destroy();
      preview?.dispose?.();
      el.remove();
    },
  };
}
