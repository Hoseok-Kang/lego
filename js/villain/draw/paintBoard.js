// ─────────────────────────────────────────────────────────────
// 악당 타이쿤 그림판 (도트 그림 프로그램)
// 괴수를 칸칸이 찍어 그리는 그림판입니다. 마우스 · 손가락 · 펜 모두 됩니다.
//   도구: 연필(B) 지우개(E) 페인트통(G) 색 뽑기(I) 선(L) 네모(R, 한 번 더 누르면 채운 네모) 옮기기(M)
//   그 밖: 좌우 대칭, 되돌리기(Ctrl+Z) / 다시하기(Ctrl+Shift+Z, Ctrl+Y), 좌우 뒤집기, 전부 지우기(화면 안에서 한 번 물어봄)
//   숫자 1~9, 0 은 색 고르기, 마우스 오른쪽 단추는 지우개
//
// 쓰는 법
//   const board = createPaintBoard(rootEl, { cols, rows, palette })
//   board.getCells()            그림 (줄 글자 배열, '.' = 빈 칸)
//   board.setCells(cells)       그림 바꿔 넣기 (되돌리기 기록은 새로 시작)
//   board.onChange(fn)          그림이 바뀔 때마다 fn(cells) → 그만 듣기 함수
//   board.clear() / undo() / redo() / flip()
//   board.setTool(name) / setColor(ch) / setMirror(bool)     name: pencil eraser fill picker line rect rectFilled move
//   board.setExtraCost(n)       값 숫자판에 더할 돈 (붙인 부품 값)
//   board.onAction(fn)          'paint' 'erase' 'fill' 'pick' 'undo' ... 가 일어날 때 fn(kind) (소리 붙이기용)
//   board.extra                 그림판 옆 빈 자리 (미리보기 · 단추를 끼워 넣는 곳)
//   board.destroy()
//
// 되돌리기 횟수는 아래 HISTORY_LIMIT, 칸당 값은 villainConfig.js 의 monster.costPerBlock 에서 바꿉니다.
// ─────────────────────────────────────────────────────────────

import { VILLAIN } from '../villainConfig.js';
import { askConfirm } from './confirmBox.js';
import { createPaintCanvas } from './paintCanvas.js';
import { attachPaintKeys } from './paintKeys.js';
import { EMPTY, countBlocks, flippedH, floodFill, fromCells, linePoints, makeGrid, rectPoints, sameGrid, shifted, toCells } from './paintOps.js';
import { createPaintUi, TOOLS } from './paintToolbar.js';

const HISTORY_LIMIT = 100;
const FLASH_MS = 170;

export function createPaintBoard(rootEl, { cols = VILLAIN.draw.cols, rows = VILLAIN.draw.rows, palette = VILLAIN.draw.palette } = {}) {
  const hexByCh = new Map(palette.map((c) => [c.ch, c.hex]));
  const allowed = new Set(hexByCh.keys());
  const changeListeners = new Set();
  const actionListeners = new Set();
  const reducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');

  let grid = makeGrid(cols, rows); // 확정된 그림
  let work = grid; // 화면에 보이는 그림 (긋는 도중에는 grid 와 다름)
  let tool = 'pencil';
  let paintTool = 'pencil'; // 색 뽑기 뒤에 돌아갈 도구
  let rectFilled = false;
  let color = palette[0].ch;
  let mirror = false;
  let extraCost = 0;
  let stroke = null;
  let hover = null;
  let undoStack = [];
  let redoStack = [];
  let flashes = [];
  let frameId = 0;
  let destroyed = false;

  const ui = createPaintUi(rootEl, {
    palette,
    onTool: (name) => {
      if (name === 'rect' && tool === 'rect') rectFilled = !rectFilled;
      setTool(name);
      act('tool');
    },
    onColor: (ch) => {
      setColor(ch);
      if (tool === 'eraser' || tool === 'picker' || tool === 'move') setTool(paintTool);
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
  const paper = createPaintCanvas(ui.stage, { cols, rows, colorOf: (ch) => hexByCh.get(ch) });
  const canvas = paper.canvas;
  canvas.setAttribute('aria-label', '괴수를 그리는 도화지');

  function act(kind) {
    for (const fn of actionListeners) fn(kind);
  }

  // ── 화면 그리기 ──────────────────────────────────────────
  function render() {
    frameId = 0;
    const now = performance.now();
    flashes = flashes.filter((f) => now - f.start < FLASH_MS);
    paper.draw(work, {
      mirror,
      hover: stroke ? null : hover,
      flash: flashes.map((f) => ({ cells: f.cells, alpha: 0.55 * (1 - (now - f.start) / FLASH_MS) })),
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

  function changedCells(before, after) {
    const out = [];
    for (let i = 0; i < after.length; i += 1) if (before[i] !== after[i]) out.push(i);
    return out;
  }

  function refreshCounts() {
    const blocks = countBlocks(work);
    ui.showCounts(blocks, Math.ceil(blocks * VILLAIN.monster.costPerBlock) + extraCost, VILLAIN.draw.minBlocks);
  }

  function emitChange() {
    refreshCounts();
    const cells = toCells(work, cols, rows);
    for (const fn of changeListeners) fn(cells);
  }

  function refreshHistory() {
    ui.showHistory(undoStack.length > 0, redoStack.length > 0);
  }

  // 그림을 확정하고 되돌리기 기록에 남깁니다
  function commit(next, kind) {
    if (sameGrid(next, grid)) {
      work = grid;
      requestRender();
      return false;
    }
    undoStack.push(grid);
    if (undoStack.length > HISTORY_LIMIT) undoStack.shift();
    redoStack = [];
    grid = next;
    work = grid;
    refreshHistory();
    emitChange();
    requestRender();
    if (kind) act(kind);
    return true;
  }

  // ── 긋기 ────────────────────────────────────────────────
  function plot(target, x, y, ch) {
    if (x < 0 || y < 0 || x >= cols || y >= rows) return;
    target[y * cols + x] = ch;
    if (mirror) target[y * cols + (cols - 1 - x)] = ch;
  }

  function plotAll(target, points, ch) {
    for (const [x, y] of points) plot(target, x, y, ch);
  }

  function clampCell(cell) {
    return { x: Math.max(0, Math.min(cols - 1, cell.x)), y: Math.max(0, Math.min(rows - 1, cell.y)) };
  }

  function pick(cell) {
    if (!cell.inside) return;
    const ch = work[cell.y * cols + cell.x];
    if (ch !== EMPTY && ch !== color) {
      setColor(ch);
      act('pick');
    }
    stroke.picked = stroke.picked || ch !== EMPTY;
  }

  function strokeMove(cell) {
    const s = stroke;
    if (s.tool === 'pencil' || s.tool === 'eraser') {
      const before = work.slice();
      plotAll(work, linePoints(s.last.x, s.last.y, cell.x, cell.y), s.tool === 'eraser' ? EMPTY : color);
      s.last = cell;
      const changed = changedCells(before, work);
      if (changed.length) {
        flash(changed);
        emitChange();
      }
    } else if (s.tool === 'line' || s.tool === 'rect') {
      const end = clampCell(cell);
      if (end.x === s.last.x && end.y === s.last.y && s.drawn) return;
      s.last = end;
      s.drawn = true;
      work = grid.slice();
      const points = s.tool === 'line' ? linePoints(s.start.x, s.start.y, end.x, end.y) : rectPoints(s.start.x, s.start.y, end.x, end.y, rectFilled);
      plotAll(work, points, color);
      emitChange();
    } else if (s.tool === 'move') {
      const dx = cell.x - s.start.x;
      const dy = cell.y - s.start.y;
      if (dx === s.dx && dy === s.dy) return;
      s.dx = dx;
      s.dy = dy;
      work = shifted(grid, cols, rows, dx, dy);
      emitChange();
    } else if (s.tool === 'picker') {
      pick(cell);
    }
    requestRender();
  }

  function onPointerDown(event) {
    if (stroke || (event.pointerType === 'mouse' && event.button !== 0 && event.button !== 2)) return;
    event.preventDefault();
    const cell = paper.cellAt(event.clientX, event.clientY);
    if (!cell.inside) return;
    canvas.setPointerCapture?.(event.pointerId);
    hover = null;
    const strokeTool = event.button === 2 ? 'eraser' : tool;
    if (strokeTool === 'fill') {
      const next = grid.slice();
      floodFill(next, cols, rows, cell.x, cell.y, color);
      if (mirror) floodFill(next, cols, rows, cols - 1 - cell.x, cell.y, color);
      flash(changedCells(grid, next));
      commit(next, 'fill');
      stroke = { tool: 'none', pointerId: event.pointerId };
      return;
    }
    stroke = { tool: strokeTool, pointerId: event.pointerId, start: clampCell(cell), last: cell, dx: 0, dy: 0, drawn: false, picked: false };
    if (strokeTool === 'pencil' || strokeTool === 'eraser') work = grid.slice();
    canvas.classList.add('is-drawing');
    strokeMove(cell);
  }

  function onPointerMove(event) {
    if (stroke) {
      if (event.pointerId !== stroke.pointerId || stroke.tool === 'none') return;
      event.preventDefault();
      // 빠르게 그을 때 놓친 점까지 모두 이어 줍니다
      const samples = event.getCoalescedEvents?.() ?? [];
      for (const sample of samples.length ? samples : [event]) strokeMove(paper.cellAt(sample.clientX, sample.clientY));
      return;
    }
    if (event.pointerType !== 'mouse') return;
    const cell = paper.cellAt(event.clientX, event.clientY);
    const next = cell.inside ? { x: cell.x, y: cell.y } : null;
    if (next?.x !== hover?.x || next?.y !== hover?.y) {
      hover = next;
      requestRender();
    }
  }

  function endStroke(event, cancelled) {
    if (!stroke || event.pointerId !== stroke.pointerId) return;
    const s = stroke;
    stroke = null;
    canvas.classList.remove('is-drawing');
    if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    if (s.tool === 'none') return;
    if (cancelled) {
      work = grid;
      emitChange();
      requestRender();
      return;
    }
    if (s.tool === 'picker') {
      if (s.picked) setTool(paintTool);
      requestRender();
      return;
    }
    if (s.tool === 'line' || s.tool === 'rect') flash(changedCells(grid, work));
    const kind = s.tool === 'eraser' ? 'erase' : s.tool === 'move' ? 'move' : 'paint';
    commit(work, kind);
  }

  function onPointerLeave() {
    if (hover) {
      hover = null;
      requestRender();
    }
  }

  const onContextMenu = (event) => event.preventDefault();
  const onPointerUp = (event) => endStroke(event, false);
  const onPointerCancel = (event) => endStroke(event, true);
  // 그리는 도중 손가락이 화면을 밀어 올리지 못하게 막습니다
  const onTouchMove = (event) => event.preventDefault();
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerCancel);
  canvas.addEventListener('pointerleave', onPointerLeave);
  canvas.addEventListener('contextmenu', onContextMenu);
  canvas.addEventListener('touchmove', onTouchMove, { passive: false });

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
    canvas.dataset.tool = tool;
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

  // 되돌리기 · 다시하기: 한쪽 기록에서 꺼내고 지금 그림은 반대쪽 기록에 넣습니다
  function stepHistory(from, to, kind) {
    if (stroke || !from.length) return false;
    to.push(grid);
    const before = grid;
    grid = from.pop();
    work = grid;
    flash(changedCells(before, grid));
    refreshHistory();
    emitChange();
    requestRender();
    act(kind);
    return true;
  }
  const undo = () => stepHistory(undoStack, redoStack, 'undo');
  const redo = () => stepHistory(redoStack, undoStack, 'redo');

  function clear() {
    if (stroke) return false;
    return commit(makeGrid(cols, rows), 'clear');
  }

  function flip() {
    if (stroke) return false;
    const next = flippedH(grid, cols, rows);
    flash(changedCells(grid, next));
    return commit(next, 'flip');
  }

  async function confirmClear() {
    if (countBlocks(grid) === 0) return;
    const yes = await askConfirm(rootEl, { message: '그림을 전부 지울까요?', yes: '지울래요', no: '아니요', danger: true });
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
  refreshHistory();
  refreshCounts();
  requestRender();

  return {
    el: rootEl,
    extra: ui.extra,
    getCells: () => toCells(work, cols, rows),
    setCells(cells) {
      grid = fromCells(cells, cols, rows, allowed);
      work = grid;
      stroke = null;
      undoStack = [];
      redoStack = [];
      refreshHistory();
      paper.layout();
      emitChange();
      requestRender();
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
    setExtraCost(amount) {
      extraCost = Math.max(0, Number(amount) || 0);
      refreshCounts();
    },
    getState: () => ({ tool, rectFilled, color, mirror, blocks: countBlocks(work), canUndo: undoStack.length > 0, canRedo: redoStack.length > 0 }),
    refresh() {
      paper.layout();
      requestRender();
    },
    destroy() {
      destroyed = true;
      cancelAnimationFrame(frameId);
      detachKeys();
      paper.destroy();
      changeListeners.clear();
      actionListeners.clear();
      rootEl.classList.remove('pb');
      rootEl.innerHTML = '';
    },
  };
}
