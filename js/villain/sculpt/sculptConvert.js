// ─────────────────────────────────────────────────────────────
// 악당 타이쿤 3D 작업대: 그림 → 3D 블록 (그림에서 시작)
// 그림판 괴수를 3D 블록으로 바꿉니다. 습격에 나가는 블록 괴수(monsterVoxels.js)와 똑같은 규칙을 씁니다:
// 칸마다 두께 (자동 통통 규칙 또는 두께 붓 숫자) 만큼 앞뒤로 블록을 쌓고, 가운데 장을 기준으로 앞뒤가 고르게.
//
// 쓰는 법
//   voxelsFromDrawing(design, { w, h, d }) → { w, h, d, layers }   (두께가 d 보다 두꺼우면 d 장까지만)
//   partsFromDrawing(design) → 그림에 붙어 있던 부품 (자리는 그대로: 앞에서 본 칸이 같으니까)
// ─────────────────────────────────────────────────────────────

import { readCells, depthSpan } from '../monster/monsterDepth.js';

export function voxelsFromDrawing(design, { w, h, d }) {
  const grid = Array.from({ length: d }, () => Array.from({ length: h }, () => new Array(w).fill('.')));
  const middle = Math.floor((d - 1) / 2); // z = 0 이 놓이는 장 (앞에서 몇째)
  for (const cell of readCells(design)) {
    if (cell.col >= w || cell.row >= h) continue;
    const { front, back } = depthSpan(cell.depth);
    for (let z = front; z >= back; z -= 1) {
      const k = middle - z;
      if (k >= 0 && k < d) grid[k][cell.row][cell.col] = cell.ch;
    }
  }
  return { w, h, d, layers: grid.map((layer) => layer.map((row) => row.join(''))) };
}

export function partsFromDrawing(design) {
  return (design?.parts ?? []).map((p) => ({ type: p.type, col: p.col, row: p.row }));
}
