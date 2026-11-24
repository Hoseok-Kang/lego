// ─────────────────────────────────────────────────────────────
// 악당 타이쿤: 괴수 설계도 모양 맞추기 (두께 · 3D 블록)
// 저장된 괴수 그림에 붙는 두 가지 새 정보를 정해진 모양으로 다듬습니다. (도감 bestiary.js 가 씀)
//
//   두께 (그림판 괴수, 없어도 됨)
//     design.depths = cells 와 같은 모양의 줄 글자. '.' = 자동 (통통 규칙), '1'~'9' = 그만큼 두껍게 (끝 = draw.maxThickness)
//   3D 블록 괴수
//     design.kind = 'voxel'
//     design.voxels = { w, h, d, layers: [d 장 (layers[0] 이 맨 앞), 장마다 h 줄 (0 = 맨 위), 줄마다 w 글자 (색 기호, '.' = 빈 칸)] }
//     design.cells  = 앞에서 본 모습 (칸마다 맨 앞 블록의 색) — 저장할 때마다 다시 만듦 → 카드 그림 · 부품 자리 · 검사가 그대로 됨
//
// 쓰는 법
//   cleanDepths(depths, cells) → 다듬은 두께 줄 (모두 자동이면 null)
//   cleanVoxels(voxels) → { w, h, d, layers }  (크기는 villainConfig 의 sculpt.size, 모르는 색은 빈 칸)
//   frontCells(voxels) → 앞에서 본 그림 줄 (h 줄 × w 글자)
//   emptyVoxels() → 빈 작업대
//   voxelBlocks(voxels) → 블록 수
// ─────────────────────────────────────────────────────────────

import { VILLAIN } from '../villainConfig.js';

const EMPTY = '.';

function paletteSet() {
  return new Set(VILLAIN.draw.palette.map((c) => c.ch));
}

export function sculptSize() {
  const size = VILLAIN.sculpt?.size ?? {};
  return { w: VILLAIN.draw.cols, h: VILLAIN.draw.rows, d: Math.max(1, Math.round(size.d ?? 8)) };
}

export function cleanDepths(depths, cells) {
  if (!Array.isArray(depths)) return null;
  const max = Math.max(1, Math.min(9, VILLAIN.draw.maxThickness ?? 7));
  let any = false;
  const out = cells.map((line, r) => {
    const src = typeof depths[r] === 'string' ? depths[r] : '';
    let row = '';
    for (let c = 0; c < line.length; c += 1) {
      const n = Number(src[c]);
      const ok = line[c] !== EMPTY && Number.isInteger(n) && n > 0;
      row += ok ? String(Math.min(max, n)) : EMPTY;
      if (ok) any = true;
    }
    return row;
  });
  return any ? out : null;
}

export function emptyVoxels() {
  const { w, h, d } = sculptSize();
  const line = EMPTY.repeat(w);
  return { w, h, d, layers: Array.from({ length: d }, () => Array.from({ length: h }, () => line)) };
}

export function cleanVoxels(voxels) {
  const { w, h, d } = sculptSize();
  const allowed = paletteSet();
  const layers = [];
  for (let k = 0; k < d; k += 1) {
    const src = Array.isArray(voxels?.layers?.[k]) ? voxels.layers[k] : [];
    const rows = [];
    for (let y = 0; y < h; y += 1) {
      const line = typeof src[y] === 'string' ? src[y] : '';
      let row = '';
      for (let x = 0; x < w; x += 1) row += allowed.has(line[x]) ? line[x] : EMPTY;
      rows.push(row);
    }
    layers.push(rows);
  }
  return { w, h, d, layers };
}

export function frontCells(voxels) {
  const { w, h, d, layers } = voxels;
  const out = [];
  for (let y = 0; y < h; y += 1) {
    let row = '';
    for (let x = 0; x < w; x += 1) {
      let ch = EMPTY;
      for (let k = 0; k < d; k += 1) {
        const v = layers[k]?.[y]?.[x];
        if (v && v !== EMPTY) {
          ch = v;
          break;
        }
      }
      row += ch;
    }
    out.push(row);
  }
  return out;
}

export function voxelBlocks(voxels) {
  let count = 0;
  for (const layer of voxels?.layers ?? []) for (const line of layer ?? []) for (const ch of line) if (ch !== EMPTY) count += 1;
  return count;
}
