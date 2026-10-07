// 전장 소품 모양 (나무 상자, 돌담, 나무, 덤불, 꽃, 당근밭, 당근, 바위, 울타리)
// 작은 것은 글자 지도로, 둥근 나무·덤불·바위는 '공 모양 + 색 섞기' 규칙으로 블록을 쌓습니다.
// 모든 소품은 가운데가 x = 0, z = 0 이고 맨 아래 블록 밑면이 y = 0 (바닥) 에 닿습니다.
// 무늬가 섞이는 소품(돌담, 나무, 바위)은 늘 같은 모양이 나옵니다 (variant 숫자로 다른 모양).
//
//   createPropModel(kind, variant?) → { kind, voxels: [{ x, y, z, hex }], size: [가로, 높이, 깊이] }
//       kind: 'crate' | 'wallStone' | 'tree' | 'bush' | 'flowers' | 'carrotPatch' | 'carrot' | 'rock' | 'fence'
//       variant: 숫자 0, 1, 2 (모양 바꾸기)
//                'wallStone' 과 'fence' 는 { length, height, axis } (axis 'x' = 가로로 긺, 'z' = 세로로 긺)
//                'carrot' 은 'upright'(서 있음, 기본) 또는 'lying'(누워 있음)
//   createWall(length, height, axis, seed?)   돌담 한 줄 (두께 1칸)
//   createFence(length, axis)                 나무 울타리 한 줄 (3칸마다 기둥)
//   PROP_KINDS, PREVIEW_LIST                  종류 목록 / 미리보기 도구가 쓰는 목록
//
// 크기 짝수/홀수: 바닥판 돌기는 .5 자리에 있어서, 폭이 짝수인 소품을 정수 자리에 놓으면 돌기 위에 딱 맞습니다.

import { parseLayers, bounds } from './voxelText.js';
import { createRoundProp, ROUND_DESIGNS } from './propShapes.js';

// ── 나무 상자 (4 × 4 × 4) ──
const CRATE_COLORS = {
  D: '#582A12', // 테두리 (밤색)
  C: '#AA7D55', // 판자 (캐러멜)
  c: '#D09168', // 밝은 판자 (살구 갈색)
  Y: '#F2CD37', // 경고 표시 (노랑)
};
// 네 모서리 기둥은 밤색, 옆면은 캐러멜 판자에 밤색 대각선 버팀목, 윗면은 밝고 어두운 판자가 번갈아
const CRATE_LAYERS = [
  [
    [1, ['DCCD', 'CCCC', 'CCCC', 'DCCD']], // 바닥
    [1, ['DCDD', 'DCCC', 'CCCD', 'DDCD']], // 버팀목 아래쪽
    [1, ['DDCD', 'CCCD', 'DCCC', 'DCDD']], // 버팀목 위쪽
    [1, ['DccD', 'CCCC', 'cccc', 'DCCD']], // 뚜껑 판자
  ],
  [
    [1, ['DCCD', 'CCCC', 'CCCC', 'DCCD']],
    [1, ['DCCD', 'CCCC', 'CCCC', 'DYYD']], // 앞면 노란 띠 (당근이 들었을지도!)
    [1, ['DCCD', 'CCCC', 'CCCC', 'DYYD']],
    [1, ['DccD', 'CCCC', 'cccc', 'DCCD']],
  ],
];

// ── 꽃 (3 × 3 작은 꽃밭) ──
const FLOWER_COLORS = {
  L: '#4B9F4A', // 줄기·잎 (초록)
  l: '#BBE90B', // 새싹 (라임)
  P: '#FF698F', // 꽃 (코랄)
  p: '#E4ADC8', // 꽃 (분홍)
  Y: '#F2CD37', // 꽃 (노랑)
  W: '#F4F4F4', // 꽃 (흰색)
  V: '#AC78BA', // 꽃 (라벤더)
};
const FLOWER_LAYERS = [
  [[1, ['L.l', '.L.', 'l.L']], [1, ['P..', '...', '..Y']]],
  [[1, ['l.L', 'L..', '.lL']], [1, ['..W', 'p..', '..V']]],
  [[1, ['.L.', 'l.L', '.L.']], [1, ['.Y.', '..P', '.p.']]],
];

// ── 당근밭 (7 × 5: 흙두둑 3줄에 당근 머리와 잎) ──
const PATCH_COLORS = {
  S: '#582A12', // 흙 (밤색)
  O: '#FE8A18', // 당근 머리 (주황)
  L: '#4B9F4A', // 잎 (초록)
  l: '#BBE90B', // 잎 끝 (라임)
};
const PATCH_LAYERS = [
  [1, ['SSSSSSS', '.......', 'SSSSSSS', '.......', 'SSSSSSS']],
  [1, ['.O.S.O.', '.......', 'S.O.O.S', '.......', '.O.S.O.']],
  [1, ['.L...L.', '.......', '..L.L..', '.......', '.L...L.']],
  [1, ['.l...l.', '.......', '..l.l..', '.......', '.l...l.']],
];

// ── 당근 (먹으면 체력 회복) ──
const CARROT_COLORS = {
  O: '#FE8A18', // 당근 (주황)
  o: '#A95500', // 당근 줄무늬 (진한 주황)
  L: '#4B9F4A', // 잎 (초록)
  l: '#BBE90B', // 잎 끝 (라임)
};
const CARROT_UPRIGHT = [
  [1, ['...', '.O.', '...']], // 뾰족한 끝
  [1, ['...', '.o.', '...']],
  [1, ['.O.', 'OOO', '.O.']],
  [1, ['.o.', 'oOo', '.O.']],
  [1, ['.O.', 'OOO', '.O.']],
  [1, ['...', '.L.', '...']], // 잎
  [1, ['.L.', 'l.L', '...']],
  [1, ['.l.', '...', '...']],
];
const CARROT_LYING = [
  [1, ['...', '.O.', '.O.', '.o.', '.O.', '.O.', '...', '...']],
  [1, ['...', '...', 'OOO', 'oOo', 'OOO', '.O.', '.L.', 'l.l']],
  [1, ['...', '...', '...', '.O.', '...', '...', '...', '.L.']],
];

export const PROP_KINDS = ['crate', 'wallStone', 'tree', 'bush', 'flowers', 'carrotPatch', 'carrot', 'rock', 'fence'];

export function createPropModel(kind, variant = 0) {
  let voxels;
  if (kind === 'wallStone') {
    const { length = 6, height = 3, axis = 'x', seed = 0 } = variant ?? {};
    return createWall(length, height, axis, seed);
  }
  if (kind === 'fence') {
    const { length = 9, axis = 'x' } = variant ?? {};
    return createFence(length, axis);
  }
  if (kind === 'crate') voxels = parseLayers(pick(CRATE_LAYERS, variant), CRATE_COLORS);
  else if (kind === 'flowers') voxels = parseLayers(pick(FLOWER_LAYERS, variant), FLOWER_COLORS);
  else if (kind === 'carrotPatch') voxels = parseLayers(PATCH_LAYERS, PATCH_COLORS);
  else if (kind === 'carrot') voxels = parseLayers(variant === 'lying' ? CARROT_LYING : CARROT_UPRIGHT, CARROT_COLORS);
  else if (ROUND_DESIGNS[kind]) voxels = createRoundProp(kind, typeof variant === 'number' ? variant : 0);
  else throw new Error(`없는 소품 종류: ${kind}`);
  return finish(kind, voxels);
}

// 돌담: 밝은 회색 돌 사이에 진한 돌이 섞이고, 맨 위는 납작한 덮개돌, 바닥에는 이끼가 조금
export function createWall(length, height = 3, axis = 'x', seed = 0) {
  const voxels = [];
  for (let i = 0; i < length; i++) {
    for (let y = 0; y < height; y++) {
      const n = noise(i, y, seed);
      let hex = n < 0.22 ? '#6C6E68' : '#A0A5A9'; // 진한 돌 / 밝은 돌
      if (y === height - 1) hex = n < 0.3 ? '#958A73' : '#E4CD9E'; // 덮개돌 (모래색)
      else if (y === 0 && n > 0.86) hex = '#237841'; // 이끼 (진초록)
      const along = i - (length - 1) / 2;
      voxels.push(axis === 'x' ? { x: along, y: y + 0.5, z: 0, hex } : { x: 0, y: y + 0.5, z: along, hex });
    }
  }
  return finish('wallStone', voxels);
}

// 나무 울타리: 3칸마다 기둥(높이 3, 위는 밝은 색), 기둥 사이에 가로대 한 줄 (높이 2번째 칸)
export function createFence(length, axis = 'x') {
  const voxels = [];
  for (let i = 0; i < length; i++) {
    const post = i % 3 === 0 || i === length - 1;
    const along = i - (length - 1) / 2;
    const put = (y, hex) => voxels.push(axis === 'x' ? { x: along, y: y + 0.5, z: 0, hex } : { x: 0, y: y + 0.5, z: along, hex });
    if (post) {
      put(0, '#582A12'); // 기둥 (밤색)
      put(1, '#582A12');
      put(2, '#AA7D55'); // 기둥 머리 (캐러멜)
    } else {
      put(1, '#D09168'); // 가로대 (살구 갈색)
    }
  }
  return finish('fence', voxels);
}

export const PREVIEW_LIST = [
  ['crate', 0], ['crate', 1], ['wallStone', { length: 8, height: 3, axis: 'x' }], ['fence', { length: 10, axis: 'x' }],
  ['tree', 0], ['tree', 1], ['tree', 2], ['bush', 0],
  ['bush', 1], ['bush', 2], ['rock', 0], ['rock', 1],
  ['flowers', 0], ['flowers', 1], ['carrotPatch', 0], ['carrot', 'upright'],
  ['carrot', 'lying'], ['rock', 2], ['flowers', 2], ['wallStone', { length: 5, height: 3, axis: 'z' }],
];

function pick(list, variant) {
  const index = typeof variant === 'number' ? variant : 0;
  return list[((index % list.length) + list.length) % list.length];
}

function finish(kind, voxels) {
  const { size } = bounds(voxels);
  return { kind, voxels, size };
}

// 늘 같은 값이 나오는 0~1 무늬 숫자
function noise(a, b, c) {
  const n = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453;
  return n - Math.floor(n);
}
