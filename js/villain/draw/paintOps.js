// ─────────────────────────────────────────────────────────────
// 악당 타이쿤 그림판: 칸 계산 도구
// 화면과 상관없이 '칸 목록'만 다루는 순수한 계산 모음입니다. (선 긋기, 네모, 페인트통, 옮기기, 뒤집기)
// 그림은 한 줄로 편 글자 배열(grid)로 들고 있습니다: grid[row * cols + col] = 색 기호 또는 '.'(빈 칸)
//
// 쓰는 법
//   makeGrid(cols, rows)                     빈 그림
//   fromCells(cells, cols, rows, allowed)    저장 모양(줄 글자 배열) → grid
//   toCells(grid, cols, rows)                grid → 저장 모양
//   linePoints(x0, y0, x1, y1)               두 칸을 잇는 선 위의 칸들 [[x, y], ...]
//   rectPoints(x0, y0, x1, y1, filled)       네모 테두리(또는 속까지) 칸들
//   floodFill(grid, cols, rows, x, y, ch)    이어진 같은 색을 한 번에 칠함 → 바뀐 칸 수
//   shifted(grid, cols, rows, dx, dy)        그림 전체를 옮긴 새 grid (밖으로 나간 칸은 사라짐)
//   flippedH(grid, cols, rows)               좌우로 뒤집은 새 grid
//   countBlocks(grid) / sameGrid(a, b)
// ─────────────────────────────────────────────────────────────

export const EMPTY = '.';

export function makeGrid(cols, rows) {
  return new Array(cols * rows).fill(EMPTY);
}

export function fromCells(cells, cols, rows, allowed) {
  const grid = makeGrid(cols, rows);
  for (let y = 0; y < rows; y += 1) {
    const line = typeof cells?.[y] === 'string' ? cells[y] : '';
    for (let x = 0; x < cols; x += 1) {
      const ch = line[x];
      if (ch && ch !== EMPTY && (!allowed || allowed.has(ch))) grid[y * cols + x] = ch;
    }
  }
  return grid;
}

export function toCells(grid, cols, rows) {
  const cells = [];
  for (let y = 0; y < rows; y += 1) cells.push(grid.slice(y * cols, (y + 1) * cols).join(''));
  return cells;
}

export function countBlocks(grid) {
  let count = 0;
  for (const ch of grid) if (ch !== EMPTY) count += 1;
  return count;
}

export function sameGrid(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

// 계단 모양으로 끊기지 않게 두 칸을 잇습니다 (브레젠험 선 긋기)
export function linePoints(x0, y0, x1, y1) {
  const points = [];
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (let guard = 0; guard < 4096; guard += 1) {
    points.push([x, y]);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
  return points;
}

export function rectPoints(x0, y0, x1, y1, filled) {
  const left = Math.min(x0, x1);
  const right = Math.max(x0, x1);
  const top = Math.min(y0, y1);
  const bottom = Math.max(y0, y1);
  const points = [];
  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      if (filled || x === left || x === right || y === top || y === bottom) points.push([x, y]);
    }
  }
  return points;
}

export function floodFill(grid, cols, rows, x, y, ch) {
  if (x < 0 || y < 0 || x >= cols || y >= rows) return 0;
  const from = grid[y * cols + x];
  if (from === ch) return 0;
  const stack = [[x, y]];
  let changed = 0;
  while (stack.length) {
    const [cx, cy] = stack.pop();
    if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) continue;
    const index = cy * cols + cx;
    if (grid[index] !== from) continue;
    grid[index] = ch;
    changed += 1;
    stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
  }
  return changed;
}

export function shifted(grid, cols, rows, dx, dy) {
  const out = makeGrid(cols, rows);
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      out[ny * cols + nx] = grid[y * cols + x];
    }
  }
  return out;
}

export function flippedH(grid, cols, rows) {
  const out = makeGrid(cols, rows);
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) out[y * cols + (cols - 1 - x)] = grid[y * cols + x];
  }
  return out;
}
