// ─────────────────────────────────────────────────────────────
// 악당 타이쿤: 처음부터 들어 있는 3D 블록 괴수 (3D 작업대 '기본 예시')
// 16 × 16 × 8 칸 공간에 동그란 덩어리 · 네모 덩어리를 쌓아 만든 괴수입니다. 도감에도 기본 괴수로 나옵니다.
// 모양을 바꾸려면 아래 makePenguin 의 숫자 (가운데 · 반지름 · 색 기호) 를 바꾸면 됩니다.
//   x = 왼쪽에서 몇째 칸 (0~15), y = 위에서 몇째 줄 (0~15, 15 가 바닥), z = 앞에서 몇째 장 (0~7, 0 이 맨 앞)
//   색 기호는 villainConfig.js 의 draw.palette (B 파랑, W 흰색, K 검정, O 주황, p 분홍, Y 노랑 …)
//
// 쓰는 법: VOXEL_MONSTERS (괴수 목록, defaultMonsters.js 가 기본 괴수 끝에 붙임)
// ─────────────────────────────────────────────────────────────

import { frontCells } from './voxelDesign.js';

const W = 16;
const H = 16;
const D = 8;

function space() {
  const cells = Array.from({ length: D }, () => Array.from({ length: H }, () => new Array(W).fill('.')));
  const put = (x, y, z, ch) => {
    if (x >= 0 && y >= 0 && z >= 0 && x < W && y < H && z < D) cells[z][y][x] = ch;
  };
  const get = (x, y, z) => cells[z]?.[y]?.[x] ?? '.';
  // 동그란 덩어리: 가운데 (cx, cy, cz), 반지름 (rx, ry, rz)
  const ball = (cx, cy, cz, rx, ry, rz, ch) => {
    for (let z = 0; z < D; z += 1) for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 + ((z - cz) / rz) ** 2 <= 1) put(x, y, z, ch);
    }
  };
  const box = (x0, y0, z0, x1, y1, z1, ch) => {
    for (let z = z0; z <= z1; z += 1) for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) put(x, y, z, ch);
  };
  // 앞에서 보이는 맨 앞 블록의 색 바꾸기 (눈 · 배 무늬)
  const face = (x, y, ch) => {
    for (let z = 0; z < D; z += 1) if (get(x, y, z) !== '.') return put(x, y, z, ch);
  };
  const front = (x, y) => {
    for (let z = 0; z < D; z += 1) if (get(x, y, z) !== '.') return z;
    return D;
  };
  const layers = () => ({ w: W, h: H, d: D, layers: cells.map((layer) => layer.map((row) => row.join(''))) });
  return { put, get, ball, box, face, front, layers };
}

// 통통 펭귄: 파란 몸 · 하얀 배 · 주황 부리와 발 · 노란 머리털
function makePenguin() {
  const s = space();
  s.ball(7.5, 9.2, 4.2, 5.2, 5.6, 3.3, 'B'); // 몸통 (맨 앞 장은 비워 둠 → 부리 · 발이 앞으로 튀어나옴)
  s.box(2, 9, 4, 2, 11, 5, 'K'); // 왼 날개
  s.box(13, 9, 4, 13, 11, 5, 'K'); // 오른 날개
  for (let y = 7; y <= 14; y += 1) for (let x = 4; x <= 11; x += 1) if (((x - 7.5) / 3.6) ** 2 + ((y - 11) / 3.9) ** 2 <= 1) s.face(x, y, 'W'); // 배
  for (const x of [5, 6, 9, 10]) for (const y of [6, 7]) s.face(x, y, 'W'); // 눈 흰자
  s.face(6, 7, 'K'); // 눈동자
  s.face(9, 7, 'K');
  s.face(4, 9, 'p'); // 볼
  s.face(11, 9, 'p');
  for (const x of [7, 8]) s.put(x, 8, s.front(x, 8) - 1, 'O'); // 부리 (앞으로 튀어나옴)
  s.box(4, 15, 0, 6, 15, 3, 'O'); // 발
  s.box(9, 15, 0, 11, 15, 3, 'O');
  s.box(7, 3, 4, 8, 3, 4, 'Y'); // 머리털
  s.put(8, 2, 4, 'Y');
  return s.layers();
}

function voxelMonster(id, name, voxels, parts) {
  return Object.freeze({ id, name, cols: W, rows: H, kind: 'voxel', voxels, cells: frontCells(voxels), parts: Object.freeze(parts), builtIn: true, updatedAt: 0 });
}

export const VOXEL_MONSTERS = Object.freeze([
  voxelMonster('builtin-penguin', '통통 펭귄', makePenguin(), [{ type: 'claw', col: 13, row: 11 }]),
]);
