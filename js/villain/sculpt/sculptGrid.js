// ─────────────────────────────────────────────────────────────
// 악당 타이쿤 3D 작업대: 블록 공간 (쌓은 블록 + 되돌리기 기록)
// 가로 w × 세로 h × 앞뒤 d 칸 상자 안에 블록을 하나씩 넣고 뺍니다. 화면은 모릅니다.
// 칸 자리: x = 왼쪽에서 몇째 (0 부터), y = 위에서 몇째 (0 = 맨 위, h-1 = 바닥), z = 앞에서 몇째 장 (0 = 맨 앞)
//
// 쓰는 법
//   const grid = createSculptGrid({ w, h, d, palette, maxBlocks })
//   grid.get(x, y, z) → 색 기호 | null ;  grid.has(x, y, z) ;  grid.inside(x, y, z)
//   grid.set(x, y, z, 색 | null) → 바뀌었는지  (블록이 maxBlocks 개면 더 못 넣음 → grid.full)
//   grid.begin() / grid.end() → 바뀌었는지      한 번의 손짓(누르고 떼기)을 되돌리기 한 번으로 묶음
//   grid.cancel()                             손짓 도중 바꾼 것을 되돌림 (두 손가락으로 바뀌었을 때)
//   grid.undo() / grid.redo() / grid.canUndo / grid.canRedo / grid.clear()
//   grid.load(voxels) / grid.toVoxels()       저장 모양 { w, h, d, layers } 넣기 · 꺼내기 (load 는 기록을 비움)
//   grid.count / grid.version (바뀔 때마다 1씩 커짐) / grid.forEach(fn(x, y, z, ch))
//   grid.onChange(fn)
//
// 되돌리기 횟수는 아래 HISTORY_LIMIT 에서 바꿉니다.
// ─────────────────────────────────────────────────────────────

import { createHistory } from '../draw/paintHistory.js';

const HISTORY_LIMIT = 80;
const EMPTY = '.';

export function createSculptGrid({ w, h, d, palette, maxBlocks = Infinity }) {
  const chars = palette.map((c) => c.ch);
  const code = new Map(chars.map((ch, i) => [ch, i + 1]));
  let cells = new Uint8Array(w * h * d);
  let count = 0;
  let version = 0;
  let before = null; // 손짓을 시작할 때 모습
  const history = createHistory(HISTORY_LIMIT);
  const listeners = new Set();

  const inside = (x, y, z) => x >= 0 && y >= 0 && z >= 0 && x < w && y < h && z < d;
  const index = (x, y, z) => (z * h + y) * w + x;
  const recount = () => {
    count = 0;
    for (const v of cells) if (v) count += 1;
  };
  function changed() {
    version += 1;
    for (const fn of listeners) fn();
  }

  function set(x, y, z, ch) {
    if (!inside(x, y, z)) return false;
    const i = index(x, y, z);
    const next = ch ? code.get(ch) ?? 0 : 0;
    if (cells[i] === next) return false;
    if (!cells[i] && next && count >= maxBlocks) return false;
    count += (next ? 1 : 0) - (cells[i] ? 1 : 0);
    cells[i] = next;
    changed();
    return true;
  }

  function restore(snapshot) {
    cells = snapshot.slice();
    recount();
    changed();
  }

  const grid = {
    w,
    h,
    d,
    inside,
    get: (x, y, z) => (inside(x, y, z) && cells[index(x, y, z)] ? chars[cells[index(x, y, z)] - 1] : null),
    has: (x, y, z) => inside(x, y, z) && cells[index(x, y, z)] > 0,
    set,
    begin() {
      if (!before) before = cells.slice();
    },
    end() {
      if (!before) return false;
      const start = before;
      before = null;
      let diff = false;
      for (let i = 0; i < cells.length && !diff; i += 1) if (cells[i] !== start[i]) diff = true;
      if (diff) history.push(start);
      return diff;
    },
    cancel() {
      if (!before) return;
      const start = before;
      before = null;
      restore(start);
    },
    undo() {
      if (before) return false;
      const prev = history.back(cells.slice());
      if (prev) restore(prev);
      return !!prev;
    },
    redo() {
      if (before) return false;
      const next = history.forward(cells.slice());
      if (next) restore(next);
      return !!next;
    },
    clear() {
      if (!count) return false;
      history.push(cells.slice());
      restore(new Uint8Array(w * h * d));
      return true;
    },
    load(voxels) {
      const next = new Uint8Array(w * h * d);
      for (let z = 0; z < d; z += 1) {
        for (let y = 0; y < h; y += 1) {
          const line = voxels?.layers?.[z]?.[y] ?? '';
          for (let x = 0; x < w; x += 1) next[index(x, y, z)] = code.get(line[x]) ?? 0;
        }
      }
      before = null;
      history.reset();
      restore(next);
    },
    toVoxels() {
      const layers = [];
      for (let z = 0; z < d; z += 1) {
        const rows = [];
        for (let y = 0; y < h; y += 1) {
          let row = '';
          for (let x = 0; x < w; x += 1) row += cells[index(x, y, z)] ? chars[cells[index(x, y, z)] - 1] : EMPTY;
          rows.push(row);
        }
        layers.push(rows);
      }
      return { w, h, d, layers };
    },
    forEach(fn) {
      for (let z = 0; z < d; z += 1) for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) if (cells[index(x, y, z)]) fn(x, y, z, chars[cells[index(x, y, z)] - 1]);
    },
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    get count() {
      return count;
    },
    get full() {
      return count >= maxBlocks;
    },
    get version() {
      return version;
    },
    get canUndo() {
      return history.canUndo;
    },
    get canRedo() {
      return history.canRedo;
    },
  };
  return grid;
}
