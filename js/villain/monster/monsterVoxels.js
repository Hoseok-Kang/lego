// 그림 → 통통한 블록 괴수 설계도
// ① 그림판 괴수 (2D 그림): 칠한 칸 하나하나를 블록 기둥(앞뒤 두께)으로 바꿉니다.
//    두께는 monsterDepth.js 가 정합니다: 자동이면 가장자리 1칸 → 안쪽 3칸 → 5칸, 두께 붓으로 정한 칸은 그 숫자.
// ② 3D 블록 괴수 (design.kind === 'voxel'): 작업대에서 쌓은 블록을 그대로 씁니다.
//    design.voxels = { w, h, d, layers: [앞에서부터 d 장, 장마다 위에서부터 h 줄, 줄마다 w 글자] }
// 발은 바닥(y = 0)에 닿고, 좌우 가운데가 x = 0, 카메라 쪽(앞)이 +z 입니다.
//
//   const model = buildMonsterModel(design, { maxDepth? })
//   model.parts.body.voxels      [{ x, y, z, hex }]  (voxelFigure.js 에 그대로 넘김)
//   model.popOrder               맞을 때 블록이 떨어지는 순서 (바깥·위쪽부터 안쪽으로)
//   model.buildOrder             처음 쌓일 때 순서 (아래 줄부터, 블록 번호 목록)
//   model.width / height / depth 크기 (칸) ; model.radius 몸통 반지름 ; model.cellCount 칠한 칸(앞에서 본 칸) 수
//   model.cellToWorld(col, row)  → { x, y, z } 그 칸의 맨 앞 블록 앞면 가운데 (부품 붙이는 자리), 빈 칸이면 null
//   model.cellOfVoxel[i]         블록 i 가 속한 칸 번호 ; model.cells[번호] = { col, row, x, y, depth, count }
//   model.cellIndexAt(col, row)  칸 번호 (빈 칸이면 -1)
//
// 자동 두께는 villainConfig.js 의 monster.maxDepth, 가는 선 두께는 monsterDepth.js 의 THIN_DEPTH 에서 바꿉니다.

import { VILLAIN } from '../villainConfig.js';
import { readCells, depthSpan } from './monsterDepth.js';

const FALLBACK_HEX = '#A0A5A9'; // 모르는 색 기호는 회색
const PALETTE = new Map(VILLAIN.draw.palette.map((entry) => [entry.ch, entry.hex]));
const hexOf = (ch) => PALETTE.get(ch) || FALLBACK_HEX;
const isPaint = (ch) => ch !== undefined && ch !== '.' && ch !== ' ';

// 블록마다 늘 같은 '주사위' (순서를 살짝 섞되, 다시 만들어도 같은 모양이 되게)
const dice = (a, b, c) => {
  const v = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453;
  return v - Math.floor(v);
};

export function buildMonsterModel(design, { maxDepth = VILLAIN.monster.maxDepth } = {}) {
  if (design?.kind === 'voxel' && design.voxels) return buildSculptModel(design);
  const cols = design?.cols || 0;
  const list = readCells(design, { maxDepth });

  // 칠한 범위
  let minC = Infinity, maxC = -Infinity, minR = Infinity, maxR = -Infinity;
  for (const cell of list) {
    if (cell.col < minC) minC = cell.col;
    if (cell.col > maxC) maxC = cell.col;
    if (cell.row < minR) minR = cell.row;
    if (cell.row > maxR) maxR = cell.row;
  }
  const empty = list.length === 0;
  const width = empty ? 0 : maxC - minC + 1;
  const height = empty ? 0 : maxR - minR + 1;
  const centerC = empty ? 0 : (minC + maxC) / 2;

  const cells = [];
  const cellIndex = new Map();
  const voxels = [];
  const cellOfVoxel = [];
  const popKey = [];
  const buildKey = [];
  let depth = 0;
  for (const source of list) {
    const { front, back } = depthSpan(source.depth);
    const index = cells.length;
    const cell = { col: source.col, row: source.row, x: source.col - centerC, y: maxR - source.row + 0.5, depth: source.depth, count: source.depth, front };
    cellIndex.set(source.row * cols + source.col, index);
    cells.push(cell);
    if (cell.depth > depth) depth = cell.depth;
    const fromTop = height > 1 ? (source.row - minR) / (height - 1) : 0;
    const hex = hexOf(source.ch);
    for (let z = back; z <= front; z++) {
      const skin = Math.min(source.edge, Math.min(front - z, z - back) + 1); // 겉에서 몇 겹 안쪽인지
      const roll = dice(source.col, source.row, z);
      cellOfVoxel.push(index);
      popKey.push(skin + fromTop * 1.1 + roll * 0.9);
      buildKey.push(cell.y + roll * 1.6 + Math.abs(z) * 0.15);
      voxels.push({ x: cell.x, y: cell.y, z, hex });
    }
  }
  return finishModel({ cols, cells, cellIndex, voxels, cellOfVoxel, popKey, buildKey, width, height, depth });
}

// 3D 블록 괴수: 쌓은 블록 그대로. 앞에서 본 칸(열) 하나 = 칸 하나 (부품은 그 열의 맨 앞 블록에 붙음)
function buildSculptModel(design) {
  const { w = 0, h = 0, d = 0, layers = [] } = design.voxels;
  const filled = (x, y, k) => x >= 0 && y >= 0 && k >= 0 && x < w && y < h && k < d && isPaint(layers[k]?.[y]?.[x]);
  let minC = Infinity, maxC = -Infinity, minR = Infinity, maxR = -Infinity, minK = Infinity, maxK = -Infinity;
  for (let k = 0; k < d; k++) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!filled(x, y, k)) continue;
        if (x < minC) minC = x;
        if (x > maxC) maxC = x;
        if (y < minR) minR = y;
        if (y > maxR) maxR = y;
        if (k < minK) minK = k;
        if (k > maxK) maxK = k;
      }
    }
  }
  const empty = minC === Infinity;
  const width = empty ? 0 : maxC - minC + 1;
  const height = empty ? 0 : maxR - minR + 1;
  const depth = empty ? 0 : maxK - minK + 1;
  const centerC = empty ? 0 : (minC + maxC) / 2;
  const centerK = empty ? 0 : (minK + maxK) / 2;
  const zOf = (k) => centerK - k; // 앞 장(k 가 작을수록)이 카메라 쪽 +z

  // 겉에서 몇 겹 안쪽인지 (빈 칸에서 6방향으로 몇 걸음)
  const skin = new Int16Array(Math.max(1, w * h * d)).fill(-1);
  const id = (x, y, k) => (k * h + y) * w + x;
  const queue = [];
  const STEPS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  for (let k = 0; k < d; k++) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (!filled(x, y, k)) continue;
        if (STEPS.some(([dx, dy, dk]) => !filled(x + dx, y + dy, k + dk))) {
          skin[id(x, y, k)] = 1;
          queue.push(x, y, k);
        }
      }
    }
  }
  for (let q = 0; q < queue.length; q += 3) {
    const [x, y, k] = [queue[q], queue[q + 1], queue[q + 2]];
    const next = skin[id(x, y, k)] + 1;
    for (const [dx, dy, dk] of STEPS) {
      if (!filled(x + dx, y + dy, k + dk) || skin[id(x + dx, y + dy, k + dk)] >= 0) continue;
      skin[id(x + dx, y + dy, k + dk)] = next;
      queue.push(x + dx, y + dy, k + dk);
    }
  }

  const cells = [];
  const cellIndex = new Map();
  const voxels = [];
  const cellOfVoxel = [];
  const popKey = [];
  const buildKey = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let front = -1, back = -1, count = 0;
      for (let k = 0; k < d; k++) {
        if (!filled(x, y, k)) continue;
        if (front < 0) front = k;
        back = k;
        count++;
      }
      if (!count) continue;
      const index = cells.length;
      const cell = { col: x, row: y, x: x - centerC, y: maxR - y + 0.5, depth: back - front + 1, count, front: zOf(front) };
      cellIndex.set(y * w + x, index);
      cells.push(cell);
      const fromTop = height > 1 ? (y - minR) / (height - 1) : 0;
      for (let k = front; k <= back; k++) {
        if (!filled(x, y, k)) continue;
        const z = zOf(k);
        const roll = dice(x, y, k);
        cellOfVoxel.push(index);
        popKey.push(skin[id(x, y, k)] + fromTop * 1.1 + roll * 0.9);
        buildKey.push(cell.y + roll * 1.6 + Math.abs(z) * 0.15);
        voxels.push({ x: cell.x, y: cell.y, z, hex: hexOf(layers[k][y][x]) });
      }
    }
  }
  return finishModel({ cols: w, cells, cellIndex, voxels, cellOfVoxel, popKey, buildKey, width, height, depth });
}

function finishModel({ cols, cells, cellIndex, voxels, cellOfVoxel, popKey, buildKey, width, height, depth }) {
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
      return cell ? { x: cell.x, y: cell.y, z: cell.front + 0.5 } : null;
    },
  };
}
