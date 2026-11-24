// ─────────────────────────────────────────────────────────────
// 악당 타이쿤 3D 작업대: 도구 기둥 + 색 물감
// 쌓기 · 지우기 · 칠하기 · 색 뽑기 · 좌우 대칭 · 되돌리기 · 다시하기 · 전부 지우기 단추와 색 물감을 만듭니다.
// 단추를 누르면 작업대 화면(sculptScreen.js)에 알려 줍니다. 그림판과 같은 단추 모양(.pb-tool, .pb-swatch)을 씁니다.
//
// 쓰는 법
//   const rail = createSculptRail(toolsEl, paletteEl, { palette, onTool(name), onColor(ch), onMirror(), onAction(id) })
//   rail.showTool(name) / rail.showColor(ch) / rail.showMirror(on) / rail.showHistory(canUndo, canRedo)
//   TOOLS: add erase paint pick  /  ACTIONS: undo redo clear
//
// 단추 이름 · 설명은 아래 TOOLS / ACTIONS / TEXT 에서 바꿉니다.
// ─────────────────────────────────────────────────────────────

import { icon } from '../draw/paintIcons.js';
import { L } from '../lang/lang.js';

const TEXT = L({
  ko: { mirror: '좌우 대칭', mirrorHint: '좌우 대칭: 한쪽에 쌓으면 반대쪽에도 똑같이 쌓여요' },
  en: { mirror: 'Mirror', mirrorHint: 'Mirror: stack on one side and the other side copies it' },
});

export const TOOLS = [
  { id: 'add', label: L({ ko: '쌓기', en: 'Stack' }), icon: 'addBlock', key: 'B', hint: L({ ko: '블록 면을 누르면 그 옆에 하나 붙어요. 바닥을 눌러도 돼요', en: 'Tap a block face to add one next to it. You can tap the floor too' }) },
  { id: 'erase', label: L({ ko: '지우기', en: 'Erase' }), icon: 'eraser', key: 'E', hint: L({ ko: '누르거나 문질러서 블록을 빼요', en: 'Tap or rub to remove blocks' }) },
  { id: 'paint', label: L({ ko: '칠하기', en: 'Paint' }), icon: 'fill', key: 'G', hint: L({ ko: '블록 색만 바꿔요', en: 'Changes only the block color' }) },
  { id: 'pick', label: L({ ko: '색 뽑기', en: 'Picker' }), icon: 'picker', key: 'I', hint: L({ ko: '블록을 눌러 그 색을 골라요', en: 'Tap a block to pick its color' }) },
];

export const ACTIONS = [
  { id: 'undo', label: L({ ko: '되돌리기', en: 'Undo' }), icon: 'undo', hint: L({ ko: '되돌리기 (Ctrl+Z)', en: 'Undo (Ctrl+Z)' }) },
  { id: 'redo', label: L({ ko: '다시하기', en: 'Redo' }), icon: 'redo', hint: L({ ko: '다시하기 (Ctrl+Shift+Z)', en: 'Redo (Ctrl+Shift+Z)' }) },
  { id: 'clear', label: L({ ko: '전부 지우기', en: 'Clear all' }), icon: 'trash', hint: L({ ko: '블록을 전부 지워요', en: 'Remove all the blocks' }) },
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

export function createSculptRail(toolsEl, paletteEl, { palette, onTool, onColor, onMirror, onAction }) {
  const toolButtons = new Map();
  const actionButtons = new Map();
  const swatches = new Map();
  for (const tool of TOOLS) {
    const el = button('pb-tool', { tool: tool.id }, tool.icon, tool.label, `${tool.label} (${tool.key}): ${tool.hint}`);
    toolButtons.set(tool.id, el);
    toolsEl.append(el);
  }
  const mirrorBtn = button('pb-tool pb-tool--toggle', { toggle: 'mirror' }, 'mirror', TEXT.mirror, TEXT.mirrorHint);
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
    el.setAttribute('aria-label', color.name);
    swatches.set(color.ch, el);
    paletteEl.append(el);
  }
  toolsEl.addEventListener('click', (event) => {
    const el = event.target.closest('button');
    if (!el || el.disabled) return;
    if (el.dataset.tool) onTool(el.dataset.tool);
    else if (el.dataset.toggle) onMirror();
    else if (el.dataset.action) onAction(el.dataset.action);
  });
  paletteEl.addEventListener('click', (event) => {
    const el = event.target.closest('.pb-swatch');
    if (el) onColor(el.dataset.color);
  });

  const press = (map, id) => {
    for (const [key, el] of map) {
      el.classList.toggle('is-on', key === id);
      el.setAttribute('aria-pressed', String(key === id));
    }
  };
  return {
    showTool: (name) => press(toolButtons, name),
    showColor: (ch) => press(swatches, ch),
    showMirror(on) {
      mirrorBtn.classList.toggle('is-on', on);
      mirrorBtn.setAttribute('aria-pressed', String(on));
    },
    showHistory(canUndo, canRedo) {
      actionButtons.get('undo').disabled = !canUndo;
      actionButtons.get('redo').disabled = !canRedo;
    },
  };
}
