// 그림 칸마다 앞뒤 두께 정하기 (자동 '통통' 규칙 + 두께 붓)
// 그림판 괴수(2D)의 칸 하나하나가 블록 몇 개 두께가 될지 정합니다.
//   자동: 그림 가장자리 칸은 1칸, 안쪽으로 갈수록 3칸 → 5칸 (가는 선·가는 팔다리는 3칸)
//   두께 붓으로 정한 칸: 그 숫자만큼 (1 ~ villainConfig 의 draw.maxThickness)
// 블록 괴수 만들기(monsterVoxels.js), 값·체력 계산(monsterPower.js), 그림판 두께 표시, 3D 작업대 '그림에서 시작'이 같이 씁니다.
//
//   readCells(design) → [{ col, row, ch, auto, depth, set, edge }]   칠한 칸 목록 (위 → 아래, 왼쪽 → 오른쪽)
//       auto: 자동 규칙의 두께, depth: 실제 두께 (정한 칸은 정한 숫자), set: 두께 붓으로 정했는지, edge: 가장 가까운 빈 칸까지 거리
//   depthSpan(depth) → { front, back }   두께 d 칸의 앞뒤 블록 자리 (z: 앞쪽 = +). 짝수 두께는 뒤로 반 칸 더 깊게
//   depthChar(value) / depthValue(ch)    저장 글자 ('.' = 자동, '1'~'9') ↔ 숫자 (자동이면 0)
//   THIN_DEPTH                           가는 선을 얼마나 도톰하게 할지 (1 이면 종이처럼 납작)
//
// 가장 두꺼운 자동 두께는 villainConfig.js 의 monster.maxDepth, 붓으로 정할 수 있는 끝은 draw.maxThickness 에서 바꿉니다.

import { VILLAIN } from '../villainConfig.js';

export const THIN_DEPTH = 3; // 가는 선·가는 팔다리(폭 1~2칸)는 이 두께로

const isPaint = (ch) => ch !== undefined && ch !== '.' && ch !== ' ';

export function depthValue(ch) {
  const n = Number(ch);
  return Number.isInteger(n) && n > 0 ? n : 0;
}

export function depthChar(value) {
  const n = Math.round(Number(value) || 0);
  return n > 0 ? String(Math.min(9, n)) : '.';
}

export function depthSpan(depth) {
  const d = Math.max(1, Math.round(depth));
  const front = Math.floor((d - 1) / 2);
  return { front, back: front - d + 1 };
}

// 칠한 칸마다 자동 두께 · 실제 두께 계산
export function readCells(design, { maxDepth = VILLAIN.monster.maxDepth, maxThickness = VILLAIN.draw.maxThickness ?? 7 } = {}) {
  const cols = design?.cols || 0;
  const rows = design?.rows || 0;
  const rowsText = design?.cells || [];
  const depthText = Array.isArray(design?.depths) ? design.depths : null;
  const at = (c, r) => (r >= 0 && r < rows && c >= 0 && c < cols && isPaint(rowsText[r]?.[c]) ? rowsText[r][c] : null);
  const maxHalf = Math.max(0, Math.floor((maxDepth - 1) / 2));

  // 가장 가까운 빈 칸까지 거리 → 두께의 절반
  const reach = maxHalf + 2;
  const cells = [];
  const index = new Map();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ch = at(c, r);
      if (!ch) continue;
      let nearest = reach + 1;
      for (let dr = -reach; dr <= reach; dr++) {
        for (let dc = -reach; dc <= reach; dc++) {
          if (at(c + dc, r + dr)) continue;
          const d = Math.hypot(dc, dr);
          if (d < nearest) nearest = d;
        }
      }
      const half = Math.min(maxHalf, Math.floor(nearest - 1 + 0.6)); // 거리 1 → 0, 1.4~2.2 → 1, 2.8~ → 2
      index.set(r * cols + c, cells.length);
      cells.push({ col: c, row: r, ch, half, edge: nearest, auto: 1, depth: 1, set: false });
    }
  }
  // 가는 선 (바로 옆에 '속살' 칸이 없는 칸): 종이처럼 납작하지 않게 조금 도톰하게
  const thinHalf = Math.min(maxHalf, Math.floor((THIN_DEPTH - 1) / 2));
  if (thinHalf > 0) {
    const isCore = (c, r) => (cells[index.get(r * cols + c)]?.edge ?? 0) >= 2;
    for (const cell of cells) {
      if (cell.half >= thinHalf) continue;
      let nearCore = false;
      for (let dr = -1; dr <= 1 && !nearCore; dr++) for (let dc = -1; dc <= 1; dc++) if (isCore(cell.col + dc, cell.row + dr)) nearCore = true;
      if (!nearCore) cell.half = thinHalf;
    }
  }
  // 두께 붓으로 정한 칸은 그 숫자 (끝 = maxThickness)
  for (const cell of cells) {
    cell.auto = cell.half * 2 + 1;
    const want = depthText ? depthValue(depthText[cell.row]?.[cell.col]) : 0;
    cell.set = want > 0;
    cell.depth = cell.set ? Math.min(maxThickness, want) : cell.auto;
    delete cell.half;
  }
  return cells;
}
