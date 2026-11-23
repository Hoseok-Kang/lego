// 영웅 '번개 기사' 그림 (작고 용감한 블록 기사: 파란 옷, 노란 깃털·방패, 빨간 망토, 칼)
// 건물 블록의 절반 크기 블록으로 만들어서(HERO_SCALE) 키는 약 7칸이지만 얼굴·망토까지 또렷하게 보입니다.
// 지도 읽는 법은 js/fight/art/voxelText.js 와 같습니다 (층마다 위에서 내려다본 글자 지도, 첫 줄이 뒤쪽).
//
//   HERO_SCALE                 블록 크기 (0.5 = 건물 블록의 절반)
//   buildHeroModel() → { parts, parents, popOrder, sword: { voxels, grip, at }, height }
//       parts: body(몸) head(머리) plume(깃털) armL armR(팔) shield(방패) legL legR(다리) cape(망토)
//       popOrder: 맞을 때 먼저 떨어지는 블록 순서 (망토 아래부터 → 방패 → 깃털)
//
// 색을 바꾸려면 COLORS 표를 고치세요. (js/bricks/brickColors.js 의 색만)

import { parseLayers } from '../../fight/art/voxelText.js';

export const HERO_SCALE = 0.5;

const COLORS = {
  B: '#0055BF', // 파란 옷
  Y: '#F2CD37', // 노랑 (깃털·무늬·방패)
  A: '#A0A5A9', // 갑옷 회색
  D: '#6C6E68', // 진한 회색 (장화·투구 테)
  S: '#F6D7B3', // 얼굴
  K: '#1B2A34', // 눈
  R: '#C91A09', // 망토
  r: '#720E0F', // 망토 그늘
  N: '#582A12', // 허리띠
  W: '#F4F4F4', // 칼날
  L: '#FFF03A', // 칼날 빛
};

const LEG = [
  [1, ['DD', 'DD', 'DD']],
  [2, ['AA', 'AA', 'AA']],
];
const BODY = [
  [1, ['NNNNN', 'NNNNN', 'NNYNN']],
  [1, ['BBBBB', 'BBBBB', 'BBYBB']],
  [1, ['BBBBB', 'BBBBB', 'BYYYB']],
  [1, ['BBBBB', 'BBBBB', 'BBYBB']],
  [1, ['AAAAA', 'AAAAA', 'AAAAA']],
];
const HEAD = [
  [1, ['AAAAA', 'AAAAA', 'AAAAA', 'AAAAA', 'ASSSA']],
  [1, ['AAAAA', 'AAAAA', 'AAAAA', 'AAAAA', 'AKSKA']],
  [1, ['DDDDD', 'DAAAD', 'DAAAD', 'DAAAD', 'DDYDD']],
  [1, ['.AAA.', 'AAAAA', 'AAAAA', 'AAAAA', '.AAA.']],
];
const PLUME = [
  [1, ['Y', 'Y', 'Y', 'Y']],
  [1, ['Y', 'Y', 'Y', '.']],
  [1, ['Y', 'Y', '.', '.']],
];
const ARM = [
  [1, ['.', 'D', '.']],
  [2, ['.', 'B', '.']],
  [1, ['A', 'A', 'A']],
];
const SHIELD = [
  [1, ['.', 'Y', '.']],
  [1, ['Y', 'B', 'Y']],
  [1, ['Y', 'Y', 'Y']],
  [1, ['Y', 'B', 'Y']],
];
const CAPE = [
  [1, ['R.R.R']],
  [3, ['RRRRR']],
  [1, ['rRRRr']],
  [1, ['RRRRR']],
];
// 칼: 첫 줄이 뒤쪽 → 손잡이, 가로대, 칼날(앞) 순서
const SWORD = [[1, ['.N.', 'YYY', '.W.', '.W.', '.L.', '.W.', '.W.', '.W.']]];

export function buildHeroModel() {
  const part = (layers, pivot, offset) => ({ pivot, voxels: parseLayers(layers, COLORS, { offset }) });
  const parts = {
    legL: part(LEG, [-1.5, 3, 0], [-1.5, 0, 0]),
    legR: part(LEG, [1.5, 3, 0], [1.5, 0, 0]),
    body: part(BODY, [0, 3, 0], [0, 3, 0]),
    head: part(HEAD, [0, 8, 0], [0, 8, 0]),
    plume: part(PLUME, [0, 12, 0], [0, 12, -0.5]),
    armL: part(ARM, [-3, 7.5, 0], [-3, 4, 0]),
    armR: part(ARM, [3, 7.5, 0], [3, 4, 0]),
    shield: part(SHIELD, [-4, 6, 0], [-4, 3.5, 0]),
    cape: part(CAPE, [0, 8, -2], [0, 2, -2]),
  };
  const parents = { head: 'body', armL: 'body', armR: 'body', cape: 'body', plume: 'head', shield: 'armL' };

  // 떨어지는 순서: 망토 아래 → 위, 방패, 깃털 위 → 아래
  const byHeight = (name, dir) =>
    parts[name].voxels.map((v, index) => ({ part: name, index, y: v.y })).sort((a, b) => (a.y - b.y) * dir).map(({ part, index }) => ({ part, index }));
  const popOrder = [...byHeight('cape', 1), ...byHeight('shield', 1), ...byHeight('plume', -1)];

  // 칼: 손에 쥐는 점(grip)은 손잡이 가운데, 오른손 자리(at)에 붙임
  const sword = { voxels: parseLayers(SWORD, COLORS), grip: [0, 0.5, -3.5], at: [3, 4.5, 0] };
  return { parts, parents, popOrder, sword, height: 15 * HERO_SCALE };
}
