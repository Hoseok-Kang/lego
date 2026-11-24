// ─────────────────────────────────────────────────────────────
// 악당 타이쿤 그림판 (도트 그림 프로그램)
// 괴수를 칸칸이 찍어 그리는 그림판입니다. 마우스 · 손가락 · 펜 모두 됩니다.
//   도구: 연필(B) 지우개(E) 페인트통(G) 색 뽑기(I) 선(L) 네모(R, 한 번 더 누르면 채운 네모) 옮기기(M) 두께 붓(T)
//   그 밖: 좌우 대칭, 되돌리기(Ctrl+Z) / 다시하기(Ctrl+Shift+Z, Ctrl+Y), 좌우 뒤집기, 전부 지우기(화면 안에서 한 번 물어봄)
//   숫자 1~9, 0 은 색 고르기, 마우스 오른쪽 단추는 지우개
// 칸마다 두께도 들고 있습니다 ('.' = 자동, '1'~'7'). 새로 칠한 칸은 자동, 지운 칸은 두께도 지워져요.
// 되돌리기 · 좌우 대칭 · 뒤집기 · 옮기기는 두께도 같이 다룹니다. (그림 = paintDoc.js, 긋기 = paintStroke.js)
//
// 쓰는 법
//   const board = createPaintBoard(rootEl, { cols, rows, palette, costOf? })
//       costOf(cells, depths) → 몸값 (없으면 칸 수 × 칸당 값). 숫자판에 보여 줄 값
//   board.getCells() / board.getDepths()   그림 · 두께 (줄 글자 배열, '.' = 빈 칸 / 자동)
//   board.setCells(cells, depths?)         그림 바꿔 넣기 (되돌리기 기록은 새로 시작)
//   board.onChange(fn)          그림이 바뀔 때마다 fn(cells, depths) → 그만 듣기 함수
//   board.clear() / undo() / redo() / flip()
//   board.setTool(name) / setColor(ch) / setMirror(bool)     name: pencil eraser fill picker line rect rectFilled move thick
//   board.setDepthPick(value) / board.setDepthAll(value)     두께 붓 값 고르기 / 칠한 칸 전부 그 두께로 ('.' = 자동)
//   board.setExtraCost(n)       값 숫자판에 더할 돈 (붙인 부품 값)
//   board.onAction(fn)          'paint' 'erase' 'fill' 'pick' 'undo' 'depth' ... 가 일어날 때 fn(kind) (소리 붙이기용)
//   board.extra                 그림판 옆 빈 자리 (미리보기 · 단추를 끼워 넣는 곳)
//   board.getState() / board.refresh() / board.destroy()
//
// 되돌리기 횟수는 아래 HISTORY_LIMIT, 칸당 값은 villainConfig.js 의 monster.costPerBlock 에서 바꿉니다.
// ─────────────────────────────────────────────────────────────

import { VILLAIN } from '../villainConfig.js';
import { askConfirm } from './confirmBox.js';
import { createPaintCanvas } from './paintCanvas.js';
import { createDepthPanel, drawDepthOverlay, autoDepths, DEPTH_CHOICES } from './paintDepth.js';
import { createPaintDoc, changedCells } from './paintDoc.js';
import { attachPaintKeys } from './paintKeys.js';
import { EMPTY, countBlocks, flippedH, fromCells, makeGrid } from './paintOps.js';
import { attachPaintStrokes } from './paintStroke.js';
import { createPaintUi, TOOLS } from './paintToolbar.js';

const TEXT = {
  canvas: '괴수를 그리는 도화지',
  clearAsk: '그림을 전부 지울까요?',
  clearYes: '지울래요',
  clearNo: '아니요',
};
const HISTORY_LIMIT = 100;
const FLASH_MS = 170;
const DEPTH_KEYS = new Set(DEPTH_CHOICES);

export function createPaintBoard(rootEl, { cols = VILLAIN.draw.cols, rows = VILLAIN.draw.rows, palette = VILLAIN.draw.palette, costOf = null } = {}) {
  const hexByCh = new Map(palette.map((c) => [c.ch, c.hex]));
  const allowed = new Set(hexByCh.keys());
  const changeListeners = new Set();
  const actionListeners = new Set();
  const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');

  let tool = 'pencil';
  let paintTool = 'pencil'; // 색 뽑기 · 두께 붓 뒤에 돌아갈 도구
  let rectFilled = false;
  let color = palette[0].ch;
  let depthPick = '.';
  let autos = null; // 자동 두께 (두께 붓을 든 동안만 계산)
  let autosFor = null;
  let mirror = false;
  let extraCost = 0;
  let flashes = [];
  let frameId = 0;
  let destroyed = false;

  const doc = createPaintDoc({ cols, rows, limit: HISTORY_LIMIT, onChange: () => (emitChange(), requestRender()), onHistory: () => refreshHistory() });

  const ui = createPaintUi(rootEl, {
    palette,
    onTool: (name) => {
      if (name === 'rect' && tool === 'rect') rectFilled = !rectFilled;
      setTool(name);
      act('tool');
    },
    onColor: (ch) => {
      setColor(ch);
      if (tool === 'eraser' || tool === 'picker' || tool === 'move' || tool === 'thick') setTool(paintTool);
      act('color');
    },
    onToggle: () => {
      setMirror(!mirror);
      act('toggle');
    },
    onAction: (id) => {
      if (id === 'undo') undo();
      else if (id === 'redo') redo();
      else if (id === 'flip') flip();
      else if (id === 'clear') confirmClear();
    },
  });
  const depthPanel = createDepthPanel(ui.depthSlot, {
    onPick: (value) => {
      setDepthPick(value);
      act('tool');
    },
    onAll: (value) => setDepthAll(value),
  });
  const paper = createPaintCanvas(ui.stage, { cols, rows, colorOf: (ch) => hexByCh.get(ch) });
  const canvas = paper.canvas;
  canvas.setAttribute('aria-label', TEXT.canvas);

  const strokes = attachPaintStrokes({
    canvas,
    paper,
    doc,
    state: () => ({ tool, color, mirror, depthPick, rectFilled }),
    hooks: {
      flash,
      act,
      render: requestRender,
      emit: emitChange,
      pick(ch) {
        if (ch === color) return;
        setColor(ch);
        act('pick');
      },
      picked: () => setTool(paintTool),
    },
  });

  function act(kind) {
    for (const fn of actionListeners) fn(kind);
  }

  // ── 화면 그리기 ──────────────────────────────────────────
  function overlay(ctx, size) {
    if (autosFor !== doc.work) {
      autos = autoDepths(doc.work, cols, rows);
      autosFor = doc.work;
    }
    drawDepthOverlay(ctx, { cols, rows, size, grid: doc.work, depths: doc.workDepths, autos });
  }

  function render() {
    frameId = 0;
    const now = performance.now();
    flashes = flashes.filter((f) => now - f.start < FLASH_MS);
    paper.draw(doc.work, {
      mirror,
      hover: strokes.hover,
      flash: flashes.map((f) => ({ cells: f.cells, alpha: 0.55 * (1 - (now - f.start) / FLASH_MS) })),
      overlay: tool === 'thick' ? overlay : null,
    });
    if (flashes.length) requestRender();
  }

  function requestRender() {
    if (!frameId && !destroyed) frameId = requestAnimationFrame(render);
  }

  function flash(cells) {
    if (!cells.length || reducedMotion?.matches) return;
    flashes.push({ cells, start: performance.now() });
  }

  function refreshCounts() {
    const blocks = countBlocks(doc.work);
    const body = costOf ? costOf(doc.cells(), doc.depthLines()) : Math.ceil(blocks * VILLAIN.monster.costPerBlock);
    ui.showCounts(blocks, body + extraCost, VILLAIN.draw.minBlocks);
  }

  function emitChange() {
    refreshCounts();
    const cells = doc.cells();
    const depthLines = doc.depthLines();
    for (const fn of changeListeners) fn(cells, depthLines);
  }

  function refreshHistory() {
    ui.showHistory(doc.canUndo, doc.canRedo);
  }

  // ── 단추 동작 ────────────────────────────────────────────
  function setTool(name) {
    if (name === 'rectFilled') {
      rectFilled = true;
      name = 'rect';
    }
    if (!TOOLS.some((t) => t.id === name)) return;
    tool = name;
    if (name === 'pencil' || name === 'fill' || name === 'line' || name === 'rect') paintTool = name;
    ui.showTool(tool, rectFilled);
    depthPanel.setVisible(tool === 'thick');
    canvas.dataset.tool = tool;
    requestRender();
  }

  function setColor(ch) {
    if (!allowed.has(ch)) return;
    color = ch;
    ui.showColor(ch);
  }

  function setMirror(on) {
    mirror = Boolean(on);
    ui.showMirror(mirror);
    requestRender();
  }

  function setDepthPick(value) {
    if (!DEPTH_KEYS.has(value)) return;
    depthPick = value;
    depthPanel.show(value);
  }

  function apply(next, nextDepths, kind) {
    if (strokes.busy) return false;
    flash([...new Set([...changedCells(doc.grid, next), ...changedCells(doc.depths, nextDepths)])]);
    const changed = doc.commit(next, nextDepths);
    if (changed) act(kind);
    requestRender();
    return changed;
  }

  // 칠한 칸 전부를 한 두께로 ('모두 자동', '납작하게')
  const setDepthAll = (value) => DEPTH_KEYS.has(value) && apply(doc.grid, doc.grid.map((ch) => (ch === EMPTY ? EMPTY : value)), 'depth');
  const clear = () => apply(makeGrid(cols, rows), makeGrid(cols, rows), 'clear');
  const flip = () => apply(flippedH(doc.grid, cols, rows), flippedH(doc.depths, cols, rows), 'flip');

  // 되돌리기 · 다시하기
  function stepHistory(forward) {
    if (strokes.busy) return false;
    const changed = doc.step(forward);
    if (!changed) return false;
    flash(changed);
    act(forward ? 'redo' : 'undo');
    return true;
  }
  const undo = () => stepHistory(false);
  const redo = () => stepHistory(true);

  async function confirmClear() {
    if (countBlocks(doc.grid) === 0) return;
    const yes = await askConfirm(rootEl, { message: TEXT.clearAsk, yes: TEXT.clearYes, no: TEXT.clearNo, danger: true });
    if (yes && !destroyed) clear();
  }

  const detachKeys = attachPaintKeys(rootEl, {
    undo,
    redo,
    tool: (name) => {
      if (name === 'rect' && tool === 'rect') rectFilled = !rectFilled;
      setTool(name);
    },
    colorIndex: (index) => palette[index] && setColor(palette[index].ch),
  });

  setTool('pencil');
  setColor(color);
  setMirror(false);
  setDepthPick('.');
  refreshHistory();
  refreshCounts();
  requestRender();

  return {
    el: rootEl,
    extra: ui.extra,
    getCells: () => doc.cells(),
    getDepths: () => doc.depthLines(),
    setCells(cells, depthLines = null) {
      strokes.cancel();
      paper.layout();
      const grid = fromCells(cells, cols, rows, allowed);
      doc.reset(grid, fromCells(depthLines ?? [], cols, rows, DEPTH_KEYS));
    },
    onChange(fn) {
      changeListeners.add(fn);
      return () => changeListeners.delete(fn);
    },
    onAction(fn) {
      actionListeners.add(fn);
      return () => actionListeners.delete(fn);
    },
    clear,
    undo,
    redo,
    flip,
    setTool,
    setColor,
    setMirror,
    setDepthPick,
    setDepthAll,
    setExtraCost(amount) {
      extraCost = Math.max(0, Number(amount) || 0);
      refreshCounts();
    },
    getState: () => ({ tool, rectFilled, color, mirror, depthPick, blocks: countBlocks(doc.work), canUndo: doc.canUndo, canRedo: doc.canRedo }),
    refresh() {
      paper.layout();
      requestRender();
    },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(frameId);
      detachKeys();
      strokes.detach();
      paper.destroy();
      changeListeners.clear();
      actionListeners.clear();
      rootEl.classList.remove('pb');
      rootEl.innerHTML = '';
    },
  };
}
