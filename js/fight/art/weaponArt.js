// 무기 모양 (모두 장난감 블록 무기)
// 내 토끼의 블록 총·블록 칼, 미친토끼의 당근 손잡이 칼·검은 총·큰 망치를 글자 지도로 그립니다.
// 지도 읽는 법: voxelText.js 맨 위 설명. 첫 줄 = 손잡이 쪽(뒤), 마지막 줄 = 무기 끝(앞, +z). 층은 아래부터.
// 모든 무기는 앞(+z)을 향하게 그리고, 손잡이 블록 가운데가 [0, 0, 0] 이 되도록 옮겨 둡니다.
// 손잡이 블록보다 뒤에는 블록을 두지 않습니다 → 토끼 손 바로 앞에 붙여도 손과 겹치지 않음.
//
//   createWeaponModel(kind) → { kind, voxels: [{ x, y, z, hex }], grip: [0,0,0], muzzle?: [x,y,z], tip: [x,y,z], length }
//       kind: 'blaster' | 'sword' | 'knife' | 'enemyGun' | 'hammer'
//       grip    손으로 잡는 곳 (늘 [0, 0, 0])
//       muzzle  총알이 나오는 곳 = 총구 앞면 가운데 (blaster, enemyGun 만)
//       tip     무기 맨 끝 앞면 가운데 (칼끝·총구·망치 머리 앞면)
//       length  손잡이부터 끝까지 길이 (칸)
//   WEAPON_KINDS                     만들 수 있는 무기 목록
//
// 색을 바꾸려면 각 무기의 colors, 모양을 바꾸려면 layers 를 고치세요.
// grip / muzzle / tip 은 [가로 칸, 줄, 층] (지도 안의 블록 자리, 0부터 셈) 으로 적습니다.

import { parseLayers, translate } from './voxelText.js';

const WEAPONS = {
  // 블록 총: 주황 몸통 + 파란 물통 + 노란 손잡이의 통통한 물총 (가로 2 × 높이 5 × 길이 6)
  blaster: {
    colors: {
      O: '#FE8A18', // 몸통 (주황)
      Y: '#F2CD37', // 손잡이·띠 (노랑)
      B: '#5A93DB', // 물통 (중간 파랑)
      b: '#0055BF', // 총구 (파랑)
      K: '#1B2A34', // 방아쇠 (검정)
    },
    layers: [
      [1, ['YY', '..', '..', '..', '..', '..']], // 손잡이 아래
      [1, ['YY', 'K.', '..', '..', '..', '..']], // 손잡이 위 + 방아쇠
      [1, ['OO', 'OO', 'OO', 'OO', 'OO', 'bb']], // 몸통 + 총구
      [1, ['OO', 'YY', 'OO', 'OO', 'OO', 'bb']], // 몸통 위 + 노란 띠
      [1, ['..', 'BB', 'BB', 'BB', '..', '..']], // 물통
    ],
    grip: [0.5, 0, 1],
    muzzle: [0.5, 5, 2.5],
  },

  // 블록 칼: 갈색 손잡이 + 금색 날밑 + 길고 밝은 회색 날 (위쪽은 흰 날) (날 길이 8)
  sword: {
    colors: {
      G: '#582A12', // 손잡이 (밤색)
      Y: '#F2CD37', // 날밑·손잡이 끝 (노랑)
      A: '#A0A5A9', // 날 (밝은 회색)
      W: '#F4F4F4', // 날 끝·윗날 (흰색)
    },
    layers: [
      [1, ['.Y.', '.G.', 'YYY', '.A.', '.A.', '.A.', '.A.', '.A.', '.A.', '.A.', '.W.']],
      [1, ['...', '...', '.Y.', '.W.', '.W.', '.W.', '.W.', '.W.', '.W.', '.W.', '...']],
    ],
    grip: [1, 0, 0],
    tip: [1, 10, 0],
  },

  // 미친토끼 칼: 짧은 날 + 당근 손잡이 (손잡이 끝에 초록 잎)
  knife: {
    colors: {
      O: '#FE8A18', // 당근 손잡이 (주황)
      L: '#4B9F4A', // 당근 잎 (초록)
      l: '#BBE90B', // 잎 끝 (라임)
      K: '#1B2A34', // 날밑 (검정)
      A: '#A0A5A9', // 날 (밝은 회색)
      W: '#F4F4F4', // 날 끝 (흰색)
    },
    layers: [
      [1, ['O', 'O', 'K', 'A', 'A', 'W']],
      [1, ['L', '.', '.', 'W', '.', '.']],
      [1, ['l', '.', '.', '.', '.', '.']],
    ],
    grip: [0, 0, 0],
    tip: [0, 5, 0],
  },

  // 미친토끼 총: 검정·진한 회색 몸통 + 빨간 줄 + 아래로 나온 탄창 (가로 2 × 높이 4 × 길이 6)
  enemyGun: {
    colors: {
      K: '#1B2A34', // 손잡이·총구 (검정)
      D: '#6C6E68', // 몸통 (진한 회색)
      R: '#C91A09', // 빨간 줄
    },
    layers: [
      [1, ['KK', '..', 'KK', '..', '..', '..']], // 손잡이 아래 + 탄창
      [1, ['KK', '..', 'KK', '..', '..', '..']],
      [1, ['DD', 'DD', 'DD', 'DD', 'DD', 'KK']], // 몸통 + 총구
      [1, ['DD', 'RR', 'RR', 'RR', 'DD', '..']], // 빨간 줄
    ],
    grip: [0.5, 0, 1],
    muzzle: [0.5, 5, 2],
  },

  // 큰 망치: 긴 갈색 자루 + 커다란 머리 (가로 3 × 높이 4 × 깊이 3, 위아래가 때리는 면)
  hammer: {
    colors: {
      G: '#582A12', // 자루 (밤색)
      K: '#1B2A34', // 자루 끝 손잡이·때리는 면 (검정)
      D: '#6C6E68', // 망치 머리 (진한 회색)
      R: '#C91A09', // 머리 띠 (빨강)
    },
    layers: [
      [1, ['...', '...', '...', '...', '...', '...', '...', 'KKK', 'KKK', 'KKK']], // 아래 때리는 면
      [1, ['.K.', '.K.', '.G.', '.G.', '.G.', '.G.', '.G.', 'DDD', 'RRR', 'DDD']], // 자루 + 머리
      [1, ['...', '...', '...', '...', '...', '...', '...', 'DDD', 'RRR', 'DDD']],
      [1, ['...', '...', '...', '...', '...', '...', '...', 'KKK', 'KKK', 'KKK']], // 위 때리는 면
    ],
    grip: [1, 0, 1],
    tip: [1, 9, 1.5],
  },
};

export const WEAPON_KINDS = Object.keys(WEAPONS);

export function createWeaponModel(kind) {
  const design = WEAPONS[kind];
  if (!design) throw new Error(`없는 무기 종류: ${kind}`);
  const toPoint = (cell, front = 0) => mapPoint(design.layers, cell, front);
  const grip = toPoint(design.grip);
  const shift = (point) => point.map((value, i) => round(value - grip[i]));
  const voxels = translate(parseLayers(design.layers, design.colors), -grip[0], -grip[1], -grip[2]);
  const tip = shift(toPoint(design.tip ?? design.muzzle, 0.5));
  const result = { kind, voxels, grip: [0, 0, 0], tip, length: tip[2] };
  if (design.muzzle) result.muzzle = shift(toPoint(design.muzzle, 0.5));
  return result;
}

// 지도 안의 [가로 칸, 줄, 층] → 위치 (parseLayers 와 같은 방식으로 가운데 맞춤). front: 앞쪽으로 더 나가는 거리
function mapPoint(layers, [col, row, layer], front = 0) {
  const rows = layers[0][1];
  return [col - (rows[0].length - 1) / 2, layer + 0.5, row - (rows.length - 1) / 2 + front];
}

function round(value) {
  return Math.round(value * 1000) / 1000 + 0;
}
