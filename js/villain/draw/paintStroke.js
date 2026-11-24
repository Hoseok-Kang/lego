// ─────────────────────────────────────────────────────────────
// 악당 타이쿤 그림판: 누르고 긋기 (마우스 · 손가락 · 펜)
// 도화지를 누르고 끄는 동안 고른 도구로 그림(paintDoc.js)을 바꿉니다. 손을 떼면 확정해서 되돌리기 기록에 남깁니다.
//   연필 · 지우개 · 두께 붓: 지나간 칸마다 / 선 · 네모: 누른 곳 ~ 지금 곳 / 옮기기: 통째로 / 페인트통: 누르자마자 / 색 뽑기
//   마우스 오른쪽 단추는 언제나 지우개
//
// 쓰는 법
//   const strokes = attachPaintStrokes({ canvas, paper, doc, state, hooks })
//     state(): 지금 { tool, color, mirror, depthPick, rectFilled }
//     hooks: { flash(cells), act(kind), render(), emit(), pick(ch) → 색을 바꿨는지, picked() }
//   strokes.busy   긋는 중인지 ;  strokes.hover   마우스가 올라간 칸 { x, y } | null ;  strokes.detach()
// ─────────────────────────────────────────────────────────────

import { changedCells } from './paintDoc.js';
import { EMPTY, floodFill, linePoints, rectPoints, shifted } from './paintOps.js';

export function attachPaintStrokes({ canvas, paper, doc, state, hooks }) {
  const { cols, rows } = doc;
  let stroke = null;
  let hover = null;
  let mirror = false;

  function plot(target, x, y, ch) {
    if (x < 0 || y < 0 || x >= cols || y >= rows) return;
    target[y * cols + x] = ch;
    if (mirror) target[y * cols + (cols - 1 - x)] = ch;
  }

  // 두께 붓: 칠한 칸에만
  function plotDepth(points, value) {
    const changed = [];
    const put = (i) => {
      if (doc.work[i] === EMPTY || doc.workDepths[i] === value) return;
      doc.workDepths[i] = value;
      changed.push(i);
    };
    for (const [x, y] of points) {
      if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
      put(y * cols + x);
      if (mirror) put(y * cols + (cols - 1 - x));
    }
    return changed;
  }

  const clampCell = (cell) => ({ x: Math.max(0, Math.min(cols - 1, cell.x)), y: Math.max(0, Math.min(rows - 1, cell.y)) });

  function strokeMove(cell) {
    const s = stroke;
    const now = state();
    if (s.tool === 'pencil' || s.tool === 'eraser') {
      const before = doc.work.slice();
      for (const [x, y] of linePoints(s.last.x, s.last.y, cell.x, cell.y)) plot(doc.work, x, y, s.tool === 'eraser' ? EMPTY : now.color);
      s.last = cell;
      const changed = changedCells(before, doc.work);
      if (changed.length) {
        hooks.flash(changed);
        hooks.emit();
      }
    } else if (s.tool === 'thick') {
      const changed = plotDepth(linePoints(s.last.x, s.last.y, cell.x, cell.y), now.depthPick);
      s.last = cell;
      if (changed.length) {
        hooks.flash(changed);
        hooks.emit();
      }
    } else if (s.tool === 'line' || s.tool === 'rect') {
      const end = clampCell(cell);
      if (end.x === s.last.x && end.y === s.last.y && s.drawn) return;
      s.last = end;
      s.drawn = true;
      doc.work = doc.grid.slice();
      const points = s.tool === 'line' ? linePoints(s.start.x, s.start.y, end.x, end.y) : rectPoints(s.start.x, s.start.y, end.x, end.y, now.rectFilled);
      for (const [x, y] of points) plot(doc.work, x, y, now.color);
      hooks.emit();
    } else if (s.tool === 'move') {
      const dx = cell.x - s.start.x;
      const dy = cell.y - s.start.y;
      if (dx === s.dx && dy === s.dy) return;
      s.dx = dx;
      s.dy = dy;
      doc.work = shifted(doc.grid, cols, rows, dx, dy);
      doc.workDepths = shifted(doc.depths, cols, rows, dx, dy);
      hooks.emit();
    } else if (s.tool === 'picker' && cell.inside) {
      const ch = doc.work[cell.y * cols + cell.x];
      if (ch !== EMPTY) hooks.pick(ch);
      s.picked = s.picked || ch !== EMPTY;
    }
    hooks.render();
  }

  function onPointerDown(event) {
    if (stroke || (event.pointerType === 'mouse' && event.button !== 0 && event.button !== 2)) return;
    event.preventDefault();
    const cell = paper.cellAt(event.clientX, event.clientY);
    if (!cell.inside) return;
    canvas.setPointerCapture?.(event.pointerId);
    hover = null;
    const now = state();
    mirror = now.mirror;
    const tool = event.button === 2 ? 'eraser' : now.tool;
    if (tool === 'fill') {
      const next = doc.grid.slice();
      floodFill(next, cols, rows, cell.x, cell.y, now.color);
      if (mirror) floodFill(next, cols, rows, cols - 1 - cell.x, cell.y, now.color);
      hooks.flash(changedCells(doc.grid, next));
      if (doc.commit(next, doc.depths)) hooks.act('fill');
      hooks.render();
      stroke = { tool: 'none', pointerId: event.pointerId };
      return;
    }
    stroke = { tool, pointerId: event.pointerId, start: clampCell(cell), last: cell, dx: 0, dy: 0, drawn: false, picked: false };
    if (tool === 'pencil' || tool === 'eraser') doc.work = doc.grid.slice();
    if (tool === 'thick') doc.workDepths = doc.depths.slice();
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
      hooks.render();
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
      doc.cancel();
      hooks.emit();
      hooks.render();
      return;
    }
    if (s.tool === 'picker') {
      if (s.picked) hooks.picked();
      hooks.render();
      return;
    }
    if (s.tool === 'line' || s.tool === 'rect') hooks.flash(changedCells(doc.grid, doc.work));
    if (doc.commit(doc.work, doc.workDepths)) hooks.act({ eraser: 'erase', move: 'move', thick: 'depth' }[s.tool] ?? 'paint');
    hooks.render();
  }

  function onPointerLeave() {
    if (hover) {
      hover = null;
      hooks.render();
    }
  }

  const onContextMenu = (event) => event.preventDefault();
  const onPointerUp = (event) => endStroke(event, false);
  const onPointerCancel = (event) => endStroke(event, true);
  const onTouchMove = (event) => event.preventDefault(); // 그리는 도중 손가락이 화면을 밀어 올리지 못하게
  const listeners = [
    ['pointerdown', onPointerDown],
    ['pointermove', onPointerMove],
    ['pointerup', onPointerUp],
    ['pointercancel', onPointerCancel],
    ['pointerleave', onPointerLeave],
    ['contextmenu', onContextMenu],
  ];
  for (const [name, fn] of listeners) canvas.addEventListener(name, fn);
  canvas.addEventListener('touchmove', onTouchMove, { passive: false });

  return {
    get busy() {
      return !!stroke;
    },
    get hover() {
      return stroke ? null : hover;
    },
    cancel() {
      stroke = null;
    },
    detach() {
      for (const [name, fn] of listeners) canvas.removeEventListener(name, fn);
      canvas.removeEventListener('touchmove', onTouchMove);
    },
  };
}
