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

const TEXT = { mirror: '좌우 대칭', mirrorHint: '좌우 대칭: 한쪽에 쌓으면 반대쪽에도 똑같이 쌓여요' };

export const TOOLS = [
  { id: 'add', label: '쌓기', icon: 'addBlock', key: 'B', hint: '블록 면을 누르면 그 옆에 하나 붙어요. 바닥을 눌러도 돼요' },
  { id: 'erase', label: '지우기', icon: 'eraser', key: 'E', hint: '누르거나 문질러서 블록을 빼요' },
  { id: 'paint', label: '칠하기', icon: 'fill', key: 'G', hint: '블록 색만 바꿔요' },
  { id: 'pick', label: '색 뽑기', icon: 'picker', key: 'I', hint: '블록을 눌러 그 색을 골라요' },
];

export const ACTIONS = [
  { id: 'undo', label: '되돌리기', icon: 'undo', hint: '되돌리기 (Ctrl+Z)' },
  { id: 'redo', label: '다시하기', icon: 'redo', hint: '다시하기 (Ctrl+Shift+Z)' },
  { id: 'clear', label: '전부 지우기', icon: 'trash', hint: '블록을 전부 지워요' },
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
