// ─────────────────────────────────────────────────────────────
// 악당 타이쿤 그림판: 그림 한 장 (색 + 두께 + 되돌리기 기록)
// 그림판(paintBoard.js)이 들고 있는 그림을 다룹니다. 화면은 모릅니다.
//   doc.grid / doc.depths         확정된 그림 · 두께 (한 줄로 편 배열. 색 기호 또는 '.', 두께 '1'~'7' 또는 '.' = 자동)
//   doc.work / doc.workDepths     화면에 보이는 그림 (긋는 도중에는 grid 와 다름)
// 빈 칸의 두께는 늘 '자동' 이라서, 지운 칸은 두께도 저절로 지워집니다.
//
// 쓰는 법
//   const doc = createPaintDoc({ cols, rows, limit, onChange(), onHistory() })
//   doc.commit(grid, depths) → 바뀌었는지   확정하고 되돌리기 기록에 남김 (바뀌었으면 onChange)
//   doc.step(forward) → 바뀐 칸 번호 목록 | null   되돌리기(false) · 다시하기(true)
//   doc.cancel()        긋던 것 취소 (work 를 grid 로)
//   doc.reset(grid, depths)   새 그림으로 바꾸고 기록을 비움
//   doc.cells() / doc.depthLines()   저장 모양 (줄 글자 배열)
//   doc.canUndo / doc.canRedo
//   fitDepths(grid, depths)   빈 칸 두께를 자동으로 맞춘 새 배열
// ─────────────────────────────────────────────────────────────

import { createHistory } from './paintHistory.js';
import { EMPTY, makeGrid, sameGrid, toCells } from './paintOps.js';

export function fitDepths(grid, depths) {
  const out = depths.slice();
  for (let i = 0; i < grid.length; i += 1) if (grid[i] === EMPTY) out[i] = EMPTY;
  return out;
}

export function changedCells(before, after) {
  const out = [];
  for (let i = 0; i < after.length; i += 1) if (before[i] !== after[i]) out.push(i);
  return out;
}

export function createPaintDoc({ cols, rows, limit = 100, onChange = () => {}, onHistory = () => {} }) {
  const history = createHistory(limit);
  const doc = {
    cols,
    rows,
    grid: makeGrid(cols, rows),
    depths: makeGrid(cols, rows),
    work: null,
    workDepths: null,
    commit(next, nextDepths) {
      const fitted = fitDepths(next, nextDepths);
      if (sameGrid(next, doc.grid) && sameGrid(fitted, doc.depths)) {
        doc.cancel();
        return false;
      }
      history.push({ grid: doc.grid, depths: doc.depths });
      doc.grid = next;
      doc.depths = fitted;
      doc.cancel();
      onHistory();
      onChange();
      return true;
    },
    step(forward) {
      const now = { grid: doc.grid, depths: doc.depths };
      const next = forward ? history.forward(now) : history.back(now);
      if (!next) return null;
      const changed = [...new Set([...changedCells(doc.grid, next.grid), ...changedCells(doc.depths, next.depths)])];
      doc.grid = next.grid;
      doc.depths = next.depths;
      doc.cancel();
      onHistory();
      onChange();
      return changed;
    },
    cancel() {
      doc.work = doc.grid;
      doc.workDepths = doc.depths;
    },
    reset(grid, depths) {
      doc.grid = grid;
      doc.depths = fitDepths(grid, depths);
      doc.cancel();
      history.reset();
      onHistory();
      onChange();
    },
    cells: () => toCells(doc.work, cols, rows),
    depthLines: () => toCells(fitDepths(doc.work, doc.workDepths), cols, rows),
    get canUndo() {
      return history.canUndo;
    },
    get canRedo() {
      return history.canRedo;
    },
  };
  doc.cancel();
  return doc;
}
