// 미친토끼 모양 3종류 (칼 · 총 · 망치)
// 무섭지만 장난감처럼 귀엽게: 빨갛게 빛나는 눈(흰 반짝이 + 코랄빛), 화난 눈썹, 반창고·꿰맨 자국, 한쪽은 찢어진 짧은 귀, 삐죽 털.
// 얼굴 생김새(주둥이·코·눈 자리)는 내 토끼와 같아서 '같은 토끼 친구가 미쳐 버린' 느낌이 납니다.
//   knife  밝은 회색 + 빨간 두건(뒤로 묶은 매듭) + 송곳니. 찢어진 오른쪽 귀에 반창고
//   gunner 진한 회색 + 보라 헬멧과 청록 고글 + 노란 총알 띠. 찢어진 왼쪽 귀를 검은 실로 꿰맴
//   brute  밤색 + 큰 배 + 주걱턱 송곳니 + 정수리를 가로지르는 꿰맨 흉터 + 뒤통수 삐친 털. 굵은 팔 (게임에서 1.35배로 커짐)
// 지도 읽는 법: voxelText.js 맨 위 설명. 첫 줄 = 뒤통수, 마지막 줄 = 얼굴 쪽. 층은 아래부터.
// 머리 지도는 내 토끼(rabbitPlayer.js)와 같은 7칸 × 7줄 (마지막 줄 = 얼굴 앞 한 칸, 비워 두어도 됨)
//
//   KNIFE, GUNNER, BRUTE   rabbitDesigns.js 가 가져다 씀

import { rabbitParts, HAND_AT } from './rabbitParts.js';

// 미친토끼가 같이 쓰는 색
const SHARED = {
  E: '#C91A09', // 빨간 눈 (빨강)
  e: '#FF698F', // 눈 속에서 빛나는 빛 (코랄)
  K: '#1B2A34', // 눈썹·입·꿰맨 실 (검정)
  W: '#F4F4F4', // 이빨·반창고 (흰색)
  P: '#C870A0', // 속귀 (진분홍)
};

// ── 칼 미친토끼 ──
const KNIFE_COLORS = {
  ...SHARED,
  F: '#A0A5A9', // 털 (밝은 회색)
  f: '#6C6E68', // 발·삐친 털·찢어진 귀 끝 (진한 회색)
  R: '#C91A09', // 두건 (빨강)
  r: '#720E0F', // 매듭·허리띠 (진한 빨강)
  b: '#E4CD9E', // 배 (모래색)
};

const KNIFE_HEAD = [
  // y5 턱 + 주둥이 아래로 삐죽 나온 송곳니 두 개
  [1, ['..FFF..', '.FFFFF.', 'FFFFFFF', 'FFFFFFF', 'FFFFFFF', '.FFFFF.', '..W.W..']],
  // y6 앞으로 한 칸 나온 주둥이
  [1, ['.FFFFF.', 'FFFFFFF', 'FFFFFFF', 'FFFFFFF', 'FFFFFFF', 'FFFFFFF', '..FFF..']],
  // y7 빨간 눈 아래 (오른쪽 아래가 코랄빛으로 빛남) + 까만 코
  [1, ['.FFFFF.', 'FFFFFFF', 'FFFFFFF', 'FFFFFFF', 'FFFFFFF', 'FEeFEeF', '...K...']],
  // y8 빨간 눈 위 + 흰 반짝이 (두 눈 모두 왼쪽 위, 내 토끼와 같은 자리)
  [1, ['.FFFFF.', 'FFFFFFF', 'FFFFFFF', 'FFFFFFF', 'FFFFFFF', 'FWEFWEF', '.......']],
  // y9 안쪽 눈썹 (바깥쪽 눈썹은 한 칸 위 → 화난 \ / 모양)
  [1, ['.FFFFF.', 'FFFFFFF', 'FFFFFFF', 'FFFFFFF', 'FFFFFFF', 'FFKFKFF', '.......']],
  // y10 머리를 덮은 빨간 두건 (흰 물방울무늬, 앞 끝단은 진한 빨강) + 바깥쪽 눈썹
  [1, ['..RRR..', '.RRWRR.', 'RWRRRRR', 'RRRRRWR', 'RRWRRRR', '.KrrrK.', '.......']],
];
const KNIFE_KNOT = [[1, ['R..']], [1, ['R.R']], [1, ['.r.']]]; // 뒤통수 두건 매듭 (아래층부터)
const MESSY_TUFT = [[1, ['f..', '.ff']], [1, ['...', '.f.']]]; // 삐죽삐죽 털

const KNIFE_BODY = [
  [1, ['.FFF.', 'FFFFF', 'FFFFF', '.FFF.']], // y1
  [1, ['.rrr.', 'rrrrr', 'rrrrr', '.rRr.']], // y2 허리띠 + 버클
  [1, ['.FFF.', 'FFFFF', 'FFFFF', '.bKb.']], // y3 꿰맨 배
  [1, ['.FFF.', 'FFFFF', 'FFFFF', '.bbb.']], // y4
];

// 왼쪽 귀(멀쩡함): 왼쪽 칸 = 안쪽. 13블록
const LONG_EAR = [[1, ['FF']], [4, ['PF']], [1, ['FF']], [1, ['.F']]];
// 오른쪽 귀(멀쩡함, 오른쪽 자리에 그대로 그림): 왼쪽 칸 = 바깥쪽. 13블록
const LONG_EAR_R = [[1, ['FF']], [4, ['FP']], [1, ['FF']], [1, ['F.']]];

// 칼 토끼 오른쪽 귀: 찢어져 짧고 반창고를 붙임 (왼쪽 칸 = 바깥쪽). 9블록
const KNIFE_TORN_EAR = [[1, ['FF']], [1, ['FP']], [1, ['WW']], [1, ['FP']], [1, ['f.']]];

const GREY_ARM = [[1, ['f']], [2, ['F']]];
const DARK_FOOT = [[1, ['ff', 'ff', 'ff']]];
const STUB_TAIL = [[1, ['...', '.F.']], [1, ['.f.', 'FFF']], [1, ['...', '.F.']]];

export const KNIFE = {
  colors: KNIFE_COLORS,
  parts: rabbitParts(
    { head: KNIFE_HEAD, body: KNIFE_BODY, ear: LONG_EAR, earR: KNIFE_TORN_EAR, arm: GREY_ARM, foot: DARK_FOOT, tail: STUB_TAIL },
    { head: [{ at: [0, 8, -4], layers: KNIFE_KNOT }, { at: [0, 11, 0.5], layers: MESSY_TUFT }] },
  ),
  hand: HAND_AT,
};

// ── 총 미친토끼 ──
const GUNNER_COLORS = {
  ...SHARED,
  F: '#6C6E68', // 털 (진한 회색)
  f: '#1B2A34', // 손·장화 (검정)
  H: '#3F3691', // 헬멧·조끼 (보라)
  h: '#AC78BA', // 헬멧 꼭대기 반짝임 (라벤더)
  G: '#36AEBF', // 고글 유리 (청록)
  Y: '#F2CD37', // 총알 띠 (노랑)
};

const GUNNER_HEAD = [
  // y5 턱
  [1, ['..FFF..', '.FFFFF.', 'FFFFFFF', 'FFFFFFF', 'FFFFFFF', '.FFFFF.', '.......']],
  // y6 앞으로 한 칸 나온 주둥이
  [1, ['.FFFFF.', 'FFFFFFF', 'FFFFFFF', 'FFFFFFF', 'FFFFFFF', 'FFFFFFF', '..FFF..']],
  // y7 빨간 눈 아래 (오른쪽 아래가 코랄빛으로 빛남) + 까만 코
  [1, ['.FFFFF.', 'FFFFFFF', 'FFFFFFF', 'FFFFFFF', 'FFFFFFF', 'FEeFEeF', '...K...']],
  // y8 빨간 눈 위 + 흰 반짝이
  [1, ['.FFFFF.', 'FFFFFFF', 'FFFFFFF', 'FFFFFFF', 'FFFFFFF', 'FWEFWEF', '.......']],
  // y9 화난 눈썹 (안쪽이 내려옴)
  [1, ['.FFFFF.', 'FFFFFFF', 'FFFFFFF', 'FFFFFFF', 'FFFFFFF', 'FFKFKFF', '.......']],
  // y10 보라 헬멧 + 이마 위로 올린 청록 고글
  [1, ['..HHH..', '.HHHHH.', 'HHHHHHH', 'HHHHHHH', 'HHHHHHH', '.GGKGG.', '.......']],
];
const HELMET_TOP = [[1, ['.HHH.', 'HhhhH', '.HHH.']]]; // 헬멧 꼭대기 볼록한 부분 (귀 앞쪽, 라벤더로 반짝)

const GUNNER_BODY = [
  [1, ['.fff.', 'fffff', 'fffff', '.fff.']], // y1 바지
  [1, ['.HHH.', 'HHHHH', 'HHHHH', '.HHY.']], // y2 조끼 + 총알 띠 (비스듬히)
  [1, ['.HHH.', 'HHHHH', 'HHHHH', '.HYH.']], // y3
  [1, ['.HHH.', 'FHHHF', 'FHHHF', '.YHH.']], // y4
];

// 총 토끼 왼쪽 귀: 찢어진 곳을 검은 실로 꿰맴 (왼쪽 칸 = 안쪽). 9블록
const GUNNER_TORN_EAR = [[1, ['FF']], [1, ['PF']], [1, ['KK']], [1, ['PF']], [1, ['.F']]];
const GUNNER_ARM = [[1, ['f']], [2, ['H']]];
const BOOTS = [[1, ['ff', 'ff', 'ff']]];

export const GUNNER = {
  colors: GUNNER_COLORS,
  parts: rabbitParts(
    { head: GUNNER_HEAD, body: GUNNER_BODY, ear: GUNNER_TORN_EAR, earR: LONG_EAR_R, arm: GUNNER_ARM, foot: BOOTS, tail: STUB_TAIL },
    { head: [{ at: [0, 11, 1], layers: HELMET_TOP }] },
  ),
  hand: HAND_AT,
};

// ── 망치 미친토끼 ──
const BRUTE_COLORS = {
  ...SHARED,
  F: '#582A12', // 털 (밤색)
  f: '#1B2A34', // 주먹·발·삐친 털 (검정)
  B: '#D09168', // 큰 배 (살구 갈색)
  S: '#FF698F', // 흉터 (코랄)
};

const BRUTE_HEAD = [
  // y5 두 칸 높이 주둥이의 아래턱
  [1, ['..FFF..', '.FFFFF.', 'FFFFFFF', 'FFFFFFF', 'FFFFFFF', '.FFFFF.', '..FFF..']],
  // y6 주둥이 위 + 아래턱에서 위로 솟은 송곳니 (주걱턱)
  [1, ['.FFFFF.', 'FFFFFFF', 'FFFFFFF', 'FFFFFFF', 'FFFFFFF', 'FFFFFFF', '..WFW..']],
  // y7 빨간 눈 아래 (오른쪽 아래가 코랄빛으로 빛남) + 까만 코
  [1, ['.FFFFF.', 'FFFFFFF', 'FFFFFFF', 'FFFFFFF', 'FFFFFFF', 'FEeFEeF', '...K...']],
  // y8 빨간 눈 위 + 흰 반짝이
  [1, ['.FFFFF.', 'FFFFFFF', 'FFFFFFF', 'FFFFFFF', 'FFFFFFF', 'FWEFWEF', '.......']],
  // y9 화난 눈썹 (안쪽)
  [1, ['.FFFFF.', 'FFFFFFF', 'FFFFFFF', 'FFFFFFF', 'FFFFFFF', 'FKKFKKF', '.......']],
  // y10 정수리를 가로지르는 꿰맨 흉터 (코랄 줄 + 흰 실) + 바깥쪽 눈썹
  [1, ['..FFF..', '.FFFFF.', 'FFFWFFF', 'FSSSSSF', 'FFWFWFF', '.KFFFK.', '.......']],
];
const BRUTE_TUFT = [[1, ['f.f', '.f.']], [1, ['.f.', '...']]]; // 뒤통수 삐친 털 (귀 뒤)

const BRUTE_BODY = [
  // 가로 7 × 깊이 6 (마지막 줄 = 앞으로 불룩 나온 배)
  [1, ['.FFFFF.', 'FFFFFFF', 'FFFFFFF', 'FFFFFFF', '.FFFFF.', '.......']], // y1
  [2, ['.FFFFF.', 'FFFFFFF', 'FFFFFFF', 'FFFFFFF', 'FBBBBBF', '..BBB..']], // y2~3 큰 배
  [1, ['.FFFFF.', 'FFFFFFF', 'FFFFFFF', 'FFFFFFF', '.FBBBF.', '.......']], // y4
];
const BRUTE_EAR = [[1, ['FF']], [4, ['PF']], [1, ['FF']], [1, ['.F']]]; // 왼쪽 귀 13블록
const BRUTE_TORN_EAR = [[1, ['FF']], [1, ['FP']], [1, ['FP']], [1, ['KK']], [1, ['f.']]]; // 오른쪽 귀 9블록
const BRUTE_ARM = [[1, ['f', 'f']], [2, ['F', 'F']]]; // 앞뒤로 두꺼운 팔 (주먹은 검정)
const BRUTE_FOOT = [[1, ['fff', 'fff', 'fff']]];
const BRUTE_TAIL = [[1, ['...', '.F.']], [1, ['.f.', 'FFF']], [1, ['...', '.F.']]];

export const BRUTE = {
  colors: BRUTE_COLORS,
  parts: rabbitParts(
    { head: BRUTE_HEAD, body: BRUTE_BODY, ear: BRUTE_EAR, earR: BRUTE_TORN_EAR, arm: BRUTE_ARM, foot: BRUTE_FOOT, tail: BRUTE_TAIL },
    { head: [{ at: [0, 11, -2.5], layers: BRUTE_TUFT }] },
    {
      armL: { pivot: [4, 5, 0.5], at: [4, 2, 0.5] },
      armR: { pivot: [-4, 5, 0.5], at: [-4, 2, 0.5] },
      footL: { pivot: [2, 1, 1], at: [2, 0, 1] },
      footR: { pivot: [-2, 1, 1], at: [-2, 0, 1] },
      tail: { pivot: [0, 2.5, -2.5], at: [0, 1, -3.5] }, // 몸이 깊어서 꼬리도 한 칸 뒤로
    },
  ),
  hand: [-5.5, 2.5, 1.5], // 팔이 한 칸 바깥(x ±4)이라 손 자리도 한 칸 바깥
};
