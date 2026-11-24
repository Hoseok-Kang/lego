// ─────────────────────────────────────────────────────────────
// 악당 타이쿤 그림판: 도구 단추 · 색 물감 · 숫자판 만들기
// 그림판 화면의 단추들을 만들고, 눌렸을 때 그림판(paintBoard.js)에 알려 줍니다.
// 단추 이름과 설명 글을 바꾸려면 아래 TOOLS / ACTIONS 목록을 고치면 됩니다.
//
// 쓰는 법
//   const ui = createPaintUi(rootEl, { palette, onTool, onColor, onToggle, onAction })
//   ui.stage (도화지가 들어갈 자리), ui.extra (그림판 옆 빈 자리: 미리보기 · 다음 단추를 끼워 넣는 곳)
//   ui.depthSlot (두께 붓 판이 들어갈 자리: 두께 붓을 든 동안 색 물감 대신 보임)
//   ui.showTool(name, rectFilled) / ui.showColor(ch) / ui.showMirror(on) / ui.showHistory(canUndo, canRedo)
//   ui.showCounts(blocks, cost, minBlocks)
// ─────────────────────────────────────────────────────────────

import { icon } from './paintIcons.js';

// 화면 글자 (도구 이름 · 설명은 아래 TOOLS / ACTIONS)
const TEXT = {
  tools: '그리기 도구',
  colors: '색 고르기',
  cells: '칠한 칸 수',
  cellUnit: '칸',
  cost: '괴수를 보낼 때 드는 돈',
  mirror: '좌우 대칭',
  mirrorHint: '좌우 대칭: 한쪽만 그려도 반대쪽이 똑같이 그려져요',
  rect: '네모',
  rectFilled: '채운 네모',
};

export const TOOLS = [
  { id: 'pencil', label: '연필', icon: 'pencil', key: 'B', hint: '끌어서 그려요' },
  { id: 'eraser', label: '지우개', icon: 'eraser', key: 'E', hint: '끌어서 지워요' },
  { id: 'fill', label: '페인트통', icon: 'fill', key: 'G', hint: '이어진 칸을 한 번에 칠해요' },
  { id: 'picker', label: '색 뽑기', icon: 'picker', key: 'I', hint: '그림에서 색을 골라요' },
  { id: 'line', label: '선', icon: 'line', key: 'L', hint: '끌어서 곧은 선을 그어요' },
  { id: 'rect', label: '네모', icon: 'rect', key: 'R', hint: '끌어서 네모를 그려요. 한 번 더 누르면 속까지 채워요' },
  { id: 'move', label: '옮기기', icon: 'move', key: 'M', hint: '그림을 통째로 끌어 옮겨요' },
  { id: 'thick', label: '두께', icon: 'thick', key: 'T', hint: '칠한 칸을 문질러 두껍게 · 얇게 해요' },
];

export const ACTIONS = [
  { id: 'undo', label: '되돌리기', icon: 'undo', hint: '되돌리기 (Ctrl+Z)' },
  { id: 'redo', label: '다시하기', icon: 'redo', hint: '다시하기 (Ctrl+Shift+Z)' },
  { id: 'flip', label: '뒤집기', icon: 'flip', hint: '그림을 좌우로 뒤집어요' },
  { id: 'clear', label: '전부 지우기', icon: 'trash', hint: '그림을 전부 지워요' },
];

function button(className, data, iconName, label, title) {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = className;
  Object.assign(el.dataset, data);
  el.title = title;
  el.setAttribute('aria-label', label);
  el.innerHTML = `${icon(iconName)}<span class="pb-tool-label">${label}</span>`;
  return el;
}

export function createPaintUi(root, { palette, onTool, onColor, onToggle, onAction }) {
  root.classList.add('pb');
  root.innerHTML = `
    <div class="pb-tools" role="toolbar" aria-label="${TEXT.tools}"></div>
    <div class="pb-stage"></div>
    <div class="pb-side">
      <div class="pb-status">
        <div class="pb-current" aria-live="polite">
          <span class="pb-current-chip"></span>
          <span class="pb-current-text"><b class="pb-current-tool"></b><span class="pb-current-color"></span></span>
        </div>
        <div class="pb-counts">
          <span class="pb-count" title="${TEXT.cells}"><span class="pb-count-block" aria-hidden="true"></span><b class="pb-count-blocks">0</b><span class="pb-count-unit">${TEXT.cellUnit}</span></span>
          <span class="pb-count" title="${TEXT.cost}">${icon('coin')}<b class="pb-count-cost">0</b></span>
        </div>
      </div>
      <div class="pb-palette" role="radiogroup" aria-label="${TEXT.colors}"></div>
      <div class="pb-depth-slot"></div>
      <div class="pb-extra"></div>
    </div>`;

  const toolsEl = root.querySelector('.pb-tools');
  const paletteEl = root.querySelector('.pb-palette');
  const toolButtons = new Map();
  const actionButtons = new Map();
  const swatches = new Map();

  for (const tool of TOOLS) {
    const el = button('pb-tool', { tool: tool.id }, tool.icon, tool.label, `${tool.label} (${tool.key}): ${tool.hint}`);
    el.setAttribute('aria-pressed', 'false');
    toolButtons.set(tool.id, el);
    toolsEl.append(el);
  }
  const mirrorBtn = button('pb-tool pb-tool--toggle', { toggle: 'mirror' }, 'mirror', TEXT.mirror, TEXT.mirrorHint);
  mirrorBtn.setAttribute('aria-pressed', 'false');
  toolsEl.append(mirrorBtn);
  for (const action of ACTIONS) {
    const el = button('pb-tool pb-tool--action', { action: action.id }, action.icon, action.label, action.hint);
    actionButtons.set(action.id, el);
    toolsEl.append(el);
  }

  for (const color of palette) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'pb-swatch';
    el.dataset.color = color.ch;
    el.style.setProperty('--swatch', color.hex);
    el.title = color.name;
    el.setAttribute('role', 'radio');
    el.setAttribute('aria-label', color.name);
    el.setAttribute('aria-checked', 'false');
    swatches.set(color.ch, el);
    paletteEl.append(el);
  }

  toolsEl.addEventListener('click', (event) => {
    const el = event.target.closest('button');
    if (!el || el.disabled) return;
    if (el.dataset.tool) onTool(el.dataset.tool);
    else if (el.dataset.toggle) onToggle(el.dataset.toggle);
    else if (el.dataset.action) onAction(el.dataset.action);
  });
  paletteEl.addEventListener('click', (event) => {
    const el = event.target.closest('.pb-swatch');
    if (el) onColor(el.dataset.color);
  });

  const chip = root.querySelector('.pb-current-chip');
  const toolText = root.querySelector('.pb-current-tool');
  const colorText = root.querySelector('.pb-current-color');
  const blocksEl = root.querySelector('.pb-count-blocks');
  const costEl = root.querySelector('.pb-count-cost');
  const countsEl = root.querySelector('.pb-counts');
  let shownTool = 'pencil';
  let shownColor = palette[0];

  function bump(el) {
    el.classList.remove('is-bump');
    void el.offsetWidth; // 같은 움직임을 다시 틀기 위해
    el.classList.add('is-bump');
  }

  function refreshCurrent() {
    const erasing = shownTool === 'eraser';
    chip.classList.toggle('is-eraser', erasing);
    chip.style.setProperty('--swatch', shownColor.hex);
    toolText.textContent = TOOLS.find((t) => t.id === shownTool)?.label ?? '';
    colorText.textContent = erasing || shownTool === 'move' || shownTool === 'thick' ? '' : shownColor.name;
    chip.classList.toggle('is-thick', shownTool === 'thick');
    root.classList.toggle('is-thick', shownTool === 'thick');
  }

  return {
    stage: root.querySelector('.pb-stage'),
    side: root.querySelector('.pb-side'),
    extra: root.querySelector('.pb-extra'),
    depthSlot: root.querySelector('.pb-depth-slot'),
    showTool(name, rectFilled) {
      shownTool = name;
      for (const [id, el] of toolButtons) {
        const on = id === name;
        el.classList.toggle('is-on', on);
        el.setAttribute('aria-pressed', String(on));
      }
      const rect = toolButtons.get('rect');
      rect.querySelector('.pb-icon').outerHTML = icon(rectFilled ? 'rectFilled' : 'rect');
      rect.querySelector('.pb-tool-label').textContent = rectFilled ? TEXT.rectFilled : TEXT.rect;
      refreshCurrent();
    },
    showColor(ch) {
      shownColor = palette.find((c) => c.ch === ch) ?? shownColor;
      for (const [id, el] of swatches) {
        const on = id === ch;
        if (on && !el.classList.contains('is-on')) bump(el);
        el.classList.toggle('is-on', on);
        el.setAttribute('aria-checked', String(on));
      }
      refreshCurrent();
    },
    showMirror(on) {
      mirrorBtn.classList.toggle('is-on', on);
      mirrorBtn.setAttribute('aria-pressed', String(on));
    },
    showHistory(canUndo, canRedo) {
      actionButtons.get('undo').disabled = !canUndo;
      actionButtons.get('redo').disabled = !canRedo;
    },
    showCounts(blocks, cost, minBlocks) {
      if (blocksEl.textContent !== String(blocks)) {
        blocksEl.textContent = String(blocks);
        costEl.textContent = String(cost);
        bump(countsEl);
      } else if (costEl.textContent !== String(cost)) {
        costEl.textContent = String(cost);
      }
      countsEl.classList.toggle('is-low', blocks < minBlocks);
    },
  };
}
