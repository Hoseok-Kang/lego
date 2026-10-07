// 내 토끼 모양 (하얀 토끼 + 파란 멜빵바지)
// 커다란 머리, 반짝이는 까만 눈, 분홍 볼터치, 분홍 속귀, 파란 리본, 동그란 꼬리. 위에서 내려다봐도 귀엽게 보이도록
// 얼굴 앞으로 주둥이와 코를 한 칸 내밀었습니다.
// 지도 읽는 법: voxelText.js 맨 위 설명. 첫 줄 = 뒤통수, 마지막 줄 = 얼굴 쪽. 층은 아래부터.
//
//   PLAYER   rabbitDesigns.js 가 가져다 씀 (colors, parts, hand)

import { rabbitParts, HAND_AT } from './rabbitParts.js';

const COLORS = {
  F: '#F4F4F4', // 털 (흰색)
  c: '#F6D7B3', // 발끝·손 (연살구색)
  P: '#E4ADC8', // 속귀 (분홍)
  E: '#1B2A34', // 눈 (검정)
  e: '#9FC3E9', // 눈 반짝이 (연하늘색)
  C: '#E4ADC8', // 볼터치 (분홍)
  N: '#FF698F', // 코 (코랄)
  O: '#5A93DB', // 멜빵바지·리본 (중간 파랑)
  o: '#0055BF', // 멜빵 끈·리본 매듭 (파랑)
  Y: '#F2CD37', // 단추 (노랑)
  T: '#F4F4F4', // 꼬리 (흰색)
};

// 머리: 가로 7 × 깊이 6 × 높이 6 (+ 맨 앞 줄 = 주둥이·코). 아래층부터
const HEAD = [
  // y5 턱
  [1, ['..FFF..', '.FFFFF.', 'FFFFFFF', 'FFFFFFF', 'FFFFFFF', '.FFFFF.', '.......']],
  // y6 입 높이 + 앞으로 한 칸 나온 주둥이
  [1, ['.FFFFF.', 'FFFFFFF', 'FFFFFFF', 'FFFFFFF', 'FFFFFFF', 'FFFFFFF', '..FFF..']],
  // y7 볼터치 + 코
  [1, ['.FFFFF.', 'FFFFFFF', 'FFFFFFF', 'FFFFFFF', 'CFFFFFC', 'CCFFFCC', '...N...']],
  // y8 눈 아래
  [1, ['.FFFFF.', 'FFFFFFF', 'FFFFFFF', 'FFFFFFF', 'FFFFFFF', 'FEEFEEF', '.......']],
  // y9 눈 위 + 반짝이 (두 눈 모두 왼쪽 위)
  [1, ['.FFFFF.', 'FFFFFFF', 'FFFFFFF', 'FFFFFFF', 'FFFFFFF', 'FeEFeEF', '.......']],
  // y10 정수리 (둥글게)
  [1, ['..FFF..', '.FFFFF.', 'FFFFFFF', 'FFFFFFF', 'FFFFFFF', '.FFFFF.', '.......']],
];

// 왼쪽 귀 앞에 묶은 파란 나비 리본
const BOW = [
  [1, ['OoO']],
  [1, ['O.O']],
];

// 정수리 위 삐죽 솟은 털 한 가닥 (머리 부품에 붙음)
const TUFT = [
  [1, ['cc.']],
  [1, ['.c.']],
];

// 몸: 가로 5 × 깊이 4 × 높이 4 (멜빵바지)
const BODY = [
  [2, ['.OOO.', 'OOOOO', 'OOOOO', '.OOO.']], // y1~2 바지
  [1, ['.FFF.', 'FFFFF', 'FOOOF', '.YOY.']], // y3 앞판 + 단추
  [1, ['.oFo.', 'FFFFF', 'FFFFF', '.oFo.']], // y4 멜빵 끈
];

// 왼쪽 귀 (오른쪽 귀는 뒤집어서 씀). 왼쪽 칸 = 안쪽(분홍), 오른쪽 칸 = 바깥쪽. 13블록
const EAR = [
  [1, ['FF']], // y11 뿌리
  [4, ['PF']], // y12~15 분홍 속귀
  [1, ['FF']], // y16
  [1, ['.F']], // y17 귀 끝
];

const ARM = [
  [1, ['c']], // y2 손
  [2, ['F']], // y3~4 팔
];

const FOOT = [[1, ['FF', 'FF', 'cc']]]; // 앞 줄 = 발끝

// 꼬리: 뒤에서 본 동그란 솜뭉치 (첫 줄 = 가장 뒤)
const TAIL = [
  [1, ['...', '.T.']],
  [1, ['.T.', 'TTT']],
  [1, ['...', '.T.']],
];

export const PLAYER = {
  colors: COLORS,
  parts: rabbitParts(
    { head: HEAD, body: BODY, ear: EAR, arm: ARM, foot: FOOT, tail: TAIL },
    { head: [{ at: [0, 11, 1], layers: TUFT }, { at: [2, 11, 0], layers: BOW }] },
  ),
  hand: HAND_AT,
};
