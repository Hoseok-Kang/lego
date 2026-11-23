// 영웅 '얼음 마법사' 그림 (파란 로브, 하얀 수염, 별 무늬 뾰족 모자, 끝에 얼음 결정이 달린 지팡이)
// 기사처럼 건물 블록의 절반 크기 블록(ICE_MAGE_SCALE)으로 만들어 키가 약 9칸입니다. 다리는 로브 속에 숨어 있어요.
// 지도 읽는 법은 js/fight/art/voxelText.js 와 같습니다 (층마다 위에서 내려다본 글자 지도, 첫 줄이 뒤쪽).
//
//   ICE_MAGE_SCALE
//   buildIceMageModel() → { parts, parents, popOrder, staff: { voxels, grip, at, tip }, height }
//       parts: body(로브+몸) head(얼굴·수염) hat(모자) armL armR(소매)
//       popOrder: 맞을 때 먼저 떨어지는 블록 순서 (모자 끝 → 수염 끝)
//       staff.tip: 지팡이 끝(얼음 결정) 자리 — 얼음 화살이 여기서 나감 (지팡이 손잡이 기준 칸)
//
// 색을 바꾸려면 COLORS 표를 고치세요. (js/bricks/brickColors.js 의 색만)

import { parseLayers } from '../../fight/art/voxelText.js';

export const ICE_MAGE_SCALE = 0.5;

const COLORS = {
  B: '#5A93DB', // 로브 (중간 파랑)
  N: '#0A3463', // 로브 그늘·밑단 (남색)
  W: '#F4F4F4', // 수염·털
  b: '#9FC3E9', // 연하늘 (무늬·얼음)
  T: '#36AEBF', // 청록 (얼음 결정 속)
  Y: '#F2CD37', // 금색 별·허리띠
  S: '#F6D7B3', // 얼굴·손
  K: '#1B2A34', // 눈·신발
  p: '#FF698F', // 볼 (코랄)
  M: '#582A12', // 지팡이 나무
};

// 로브: 아래가 넓은 종 모양. 맨 앞줄 가운데 흰 띠, 발끝(검정)이 살짝 보임. 모든 층을 7×5 칸에 맞춰 적음
const BODY = [
  [1, ['.NNNNN.', 'NNNNNNN', 'NNNNNNN', 'NNNNNNN', '.KNbNK.']],
  [1, ['.BBBBB.', 'BBBBBBB', 'BBBBBBB', 'BBBBBBB', '.BBWBB.']],
  [1, ['.BBBBB.', 'BBBBBBB', 'BBBBBBB', 'BbBBBbB', '.BBWBB.']],
  [1, ['.......', '.BBBBB.', '.BBBBB.', '.BBBBB.', '..BWB..']],
  [1, ['.......', '.YYYYY.', '.YYYYY.', '.YYbYY.', '.......']], // 허리띠
  [2, ['.......', '.BBBBB.', '.BBBBB.', '.BBWBB.', '.......']],
  [1, ['.......', '.NBBBN.', '.BBBBB.', '.NBWBN.', '.......']],
];
// 머리: 맨 아래 두 층은 가슴 앞으로 늘어진 수염
const HEAD = [
  [1, ['.....', '.....', '.....', '.....', '.WWW.']],
  [1, ['.....', '.....', '.....', '.....', 'WWWWW']],
  [1, ['WWWWW', 'WSSSW', 'WSSSW', 'WSSSW', 'WWWWW']],
  [1, ['WWWWW', 'WSSSW', 'SSSSS', 'SSSSS', 'pKSKp']], // 눈 + 발그레한 볼
  [1, ['WWWWW', 'SSSSS', 'SSSSS', 'SSSSS', 'WWSWW']], // 하얀 눈썹
];
// 모자: 넓은 챙 → 금색 버클 띠 → 뒤로 살짝 꺾인 뾰족 끝 + 금별
const HAT = [
  [1, ['.BBBBB.', 'BBBBBBB', 'BBBBBBB', 'BBBBBBB', 'BBBBBBB', 'BBBBBBB', '.......']], // 챙 (앞은 짧게 — 위에서 봐도 얼굴이 보이게)
  [1, ['.......', '.NNNNN.', '.NNNNN.', '.NNNNN.', '.NNNNN.', '.NNYNN.', '.......']],
  [1, ['.......', '..BBB..', '.BBBBB.', '.BBBBB.', '.BBBBY.', '..BBB..', '.......']],
  [1, ['.......', '.......', '..BBB..', '..BBB..', '..YBB..', '.......', '.......']],
  [1, ['.......', '.......', '..BB...', '..BBB..', '.......', '.......', '.......']],
  [1, ['.......', '.......', '..B....', '..B....', '.......', '.......', '.......']],
  [1, ['.......', '..Y....', '.......', '.......', '.......', '.......', '.......']],
];
const ARM = [
  [1, ['.', 'S', '.']],
  [1, ['W', 'W', 'W']],
  [2, ['B', 'B', 'B']],
];
// 지팡이: 아래에서 위로 (나무 → 얼음 결정 → 반짝)
const STAFF = [
  [8, ['...', '.M.', '...']],
  [1, ['.b.', 'bTb', '.b.']],
  [1, ['bWb', 'WTW', 'bWb']],
  [1, ['.b.', 'bTb', '.b.']],
  [1, ['...', '.W.', '...']],
];

export function buildIceMageModel() {
  const part = (layers, pivot, offset) => ({ pivot, voxels: parseLayers(layers, COLORS, { offset }) });
  const parts = {
    body: part(BODY, [0, 4, 0], [0, 0, 0]),
    head: part(HEAD, [0, 8, 0], [0, 6, 0]),
    hat: part(HAT, [0, 11, 0], [0, 11, 0]),
    armL: part(ARM, [-3, 8, 0], [-3, 4, 0]),
    armR: part(ARM, [3, 8, 0], [3, 4, 0]),
  };
  const parents = { head: 'body', hat: 'head', armL: 'body', armR: 'body' };

  // 떨어지는 순서: 모자 끝(위 → 아래), 수염 끝(아래 → 위)
  const byHeight = (name, dir, limit = Infinity) =>
    parts[name].voxels
      .map((v, index) => ({ part: name, index, y: v.y }))
      .sort((a, b) => (a.y - b.y) * dir)
      .slice(0, limit)
      .map(({ part, index }) => ({ part, index }));
  const popOrder = [...byHeight('hat', -1, 28), ...byHeight('head', 1, 8)];

  // 지팡이: 손잡이 점(grip)은 나무 아래쪽, 오른손 앞(at)에 붙임. tip = 얼음 결정 가운데 (지팡이 손잡이 기준 칸)
  const staff = { voxels: parseLayers(STAFF, COLORS), grip: [0, 2.5, 0], at: [3, 4.5, 1], tip: [0, 9.5, 0] };
  return { parts, parents, popOrder, staff, height: 18 * ICE_MAGE_SCALE };
}
