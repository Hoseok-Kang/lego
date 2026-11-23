// 그림 → 통통한 블록 괴수 설계도
// 그림판에 칠한 칸 하나하나를 블록 기둥(앞뒤 두께)으로 바꿉니다.
// 그림 가장자리 칸은 1칸 두께, 안쪽으로 들어갈수록 3칸 → 5칸으로 두꺼워져서 (가는 선은 3칸)
// 납작한 종이가 아니라 볼록한 장난감처럼 보입니다. 발은 바닥(y = 0)에 닿고, 좌우 가운데가 x = 0 입니다.
//
//   const model = buildMonsterModel(design, { maxDepth? })
//   model.parts.body.voxels      [{ x, y, z, hex }]  (voxelFigure.js 에 그대로 넘김)
//   model.popOrder               맞을 때 블록이 떨어지는 순서 (바깥·위쪽부터 안쪽으로)
//   model.buildOrder             처음 쌓일 때 순서 (아래 줄부터, 블록 번호 목록)
//   model.width / height / depth 그림 크기 (칸) ; model.radius 몸통 반지름 ; model.cellCount 칠한 칸 수
//   model.cellToWorld(col, row)  → { x, y, z } 그 칸 블록의 앞면 가운데 (부품 붙이는 자리), 빈 칸이면 null
//   model.cellOfVoxel[i]         블록 i 가 속한 칸 번호 ; model.cells[번호] = { col, row, x, y, depth, count }
//   model.cellIndexAt(col, row)  칸 번호 (빈 칸이면 -1)
//
// 두께는 villainConfig.js 의 monster.maxDepth, 가는 선 그림을 얼마나 도톰하게 할지는 아래 THIN_DEPTH 에서 바꿉니다.

import { VILLAIN } from '../villainConfig.js';

const THIN_DEPTH = 3; // 가는 선·가는 팔다리(폭 1~2칸)는 이 두께로 (1 이면 종이처럼 납작)
const FALLBACK_HEX = '#A0A5A9'; // 모르는 색 기호는 회색
const PALETTE = new Map(VILLAIN.draw.palette.map((entry) => [entry.ch, entry.hex]));

const isPaint = (ch) => ch !== undefined && ch !== '.' && ch !== ' ';
// 블록마다 늘 같은 '주사위' (순서를 살짝 섞되, 다시 만들어도 같은 모양이 되게)
const dice = (a, b, c) => {
  const v = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453;
  return v - Math.floor(v);
};

export function buildMonsterModel(design, { maxDepth = VILLAIN.monster.maxDepth } = {}) {
  const cols = design?.cols || 0;
  const rows = design?.rows || 0;
  const rowsText = design?.cells || [];
  const at = (c, r) => (r >= 0 && r < rows && c >= 0 && c < cols && isPaint(rowsText[r]?.[c]) ? rowsText[r][c] : null);

  // 칠한 범위
  let minC = Infinity, maxC = -Infinity, minR = Infinity, maxR = -Infinity;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!at(c, r)) continue;
      if (c < minC) minC = c;
      if (c > maxC) maxC = c;
      if (r < minR) minR = r;
      if (r > maxR) maxR = r;
    }
  }
  const empty = minC === Infinity;
  const width = empty ? 0 : maxC - minC + 1;
  const height = empty ? 0 : maxR - minR + 1;
  const centerC = empty ? 0 : (minC + maxC) / 2;
  const maxHalf = Math.max(0, Math.floor((maxDepth - 1) / 2));

  // 칸마다: 가장 가까운 빈 칸까지 거리 → 두께의 절반
  const reach = maxHalf + 2;
  const cells = [];
  const cellIndex = new Map();
  for (let r = minR; r <= maxR; r++) {
    for (let c = minC; c <= maxC; c++) {
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
      cellIndex.set(r * cols + c, cells.length);
      cells.push({ col: c, row: r, x: c - centerC, y: maxR - r + 0.5, half, edge: nearest, hex: PALETTE.get(ch) || FALLBACK_HEX, depth: 1, count: 0 });
    }
  }
  // 가는 선·가는 팔다리 (바로 옆에 '속살' 칸이 없는 칸): 종이처럼 납작하지 않게 조금 도톰하게
  const thinHalf = Math.min(maxHalf, Math.floor((THIN_DEPTH - 1) / 2));
  if (thinHalf > 0) {
    const isCore = (c, r) => (cells[cellIndex.get(r * cols + c)]?.edge ?? 0) >= 2;
    for (const cell of cells) {
      if (cell.half >= thinHalf) continue;
      let nearCore = false;
      for (let dr = -1; dr <= 1 && !nearCore; dr++) for (let dc = -1; dc <= 1; dc++) if (isCore(cell.col + dc, cell.row + dr)) nearCore = true;
      if (!nearCore) cell.half = thinHalf;
    }
  }

  // 블록 만들기 + 떨어지는 순서 점수 (작을수록 먼저 떨어짐: 겉·위쪽 → 속·아래쪽)
  const voxels = [];
  const cellOfVoxel = [];
  const popKey = [];
  const buildKey = [];
  let depth = 0;
  cells.forEach((cell, index) => {
    cell.depth = cell.half * 2 + 1;
    cell.count = cell.depth;
    if (cell.depth > depth) depth = cell.depth;
    const fromTop = height > 1 ? (cell.row - minR) / (height - 1) : 0;
    for (let z = -cell.half; z <= cell.half; z++) {
      const skin = Math.min(cell.edge, cell.half - Math.abs(z) + 1); // 겉에서 몇 겹 안쪽인지
      const roll = dice(cell.col, cell.row, z);
      cellOfVoxel.push(index);
      popKey.push(skin + fromTop * 1.1 + roll * 0.9);
      buildKey.push(cell.y + roll * 1.6 + Math.abs(z) * 0.15);
      voxels.push({ x: cell.x, y: cell.y, z, hex: cell.hex });
    }
  });
  const byKey = (keys) => voxels.map((_, i) => i).sort((a, b) => keys[a] - keys[b]);

  return {
    parts: { body: { pivot: [0, 0, 0], voxels } },
    popOrder: byKey(popKey).map((index) => ({ part: 'body', index })),
    buildOrder: byKey(buildKey),
    width,
    height,
    depth,
    radius: Math.max(1, width * 0.5 * 0.85),
    cellCount: cells.length,
    cells,
    cellOfVoxel,
    cellIndexAt: (col, row) => cellIndex.get(row * cols + col) ?? -1,
    cellToWorld(col, row) {
      const cell = cells[cellIndex.get(row * cols + col)];
      return cell ? { x: cell.x, y: cell.y, z: cell.half + 0.5 } : null;
    },
  };
}
