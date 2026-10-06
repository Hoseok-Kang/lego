// 기본 타워 그림 (화살 · 대포 · 얼음)
// 타워 자리에 지어지는 세 가지 타워의 기본 그림입니다. (사용자가 그림을 올리면 그 그림이 대신 쓰입니다)
// 글자 하나 = 블록 한 칸. 가로 칸 수는 gameConfig.js 의 towers.<종류>.columns 와 같아야 합니다.
//   화살 타워 8칸 · 대포 타워 9칸 · 얼음 타워 8칸
// 한 그림 안의 모든 줄은 글자 수가 똑같아야 합니다. '.' 은 빈칸(투명)입니다.
// 맨 왼쪽·오른쪽 칸과 맨 위·아래 줄에는 블록이 하나 이상 있어야 그림 폭이 정확히 맞습니다.
//
//   TOWER_ART.archer() / .cannon() / .ice()   타워 그림 캔버스를 돌려줌 (배경 투명)
//   TOWER_MAPS                                타워별 글자 지도 (위 → 아래)
//   TOWER_COLORS                              글자 → 블록 색 (세 타워가 함께 씀, js/bricks/brickColors.js 의 색만 쓰기)

import { drawPixelMap } from './pixelArt.js';

// 글자별 색
export const TOWER_COLORS = {
  K: '#1B2A34', // 검정 (테두리, 대포 포신, 창문, 깃대)
  D: '#6C6E68', // 진한 회색 (대포 타워 돌벽)
  G: '#A0A5A9', // 밝은 회색 (대포 타워 윗단, 포신 반짝임, 돌 무늬)
  R: '#C91A09', // 빨강 (화살 타워 지붕)
  r: '#720E0F', // 진한 빨강 (지붕 그림자 쪽)
  O: '#582A12', // 밤색 (나무 테두리, 대포 받침)
  C: '#AA7D55', // 캐러멜 (나무 벽)
  S: '#E4CD9E', // 모래색 (나무 벽 밝은 쪽)
  Y: '#F2CD37', // 노랑 (화살 타워 깃발, 대포 심지)
  F: '#FE8A18', // 주황 (대포 심지 불꽃)
  W: '#F4F4F4', // 흰색 (얼음 수정 밝은 면, 눈)
  L: '#9FC3E9', // 연하늘색 (얼음 수정 가운데 면)
  M: '#5A93DB', // 중간 파랑 (얼음 수정 그림자 면, 받침 밝은 쪽)
  B: '#0055BF', // 파랑 (얼음 받침)
  N: '#0A3463', // 남색 (얼음 받침 그림자 쪽)
};

export const TOWER_MAPS = {
  // 화살 타워 (가로 8칸): 노란 깃발 + 빨간 뾰족 지붕 + 나무 망루 + 화살 구멍
  archer: [
    '...KYY..',
    '...KYYY.',
    '...KY...',
    '...RR...',
    '..RRRr..',
    '..RRRr..',
    '.RRRRrr.',
    'RRRRRrrr',
    'OOOOOOOO',
    'OSCKKCCO',
    'OSCKKCCO',
    'OOOOOOOO',
    '.OSCCCO.',
    '.OSCKCO.',
    '.OSCKCO.',
    'OOOOOOOO',
  ],

  // 대포 타워 (가로 9칸): 진한 돌탑 위에 오른쪽을 겨눈 검은 대포 (왼쪽 끝은 심지 불꽃)
  cannon: [
    '.F.......',
    '.YKKKK..K',
    '.KGGGGKKK',
    '.KKKKKKKK',
    '..KKKK..K',
    'GG.OO.GG.',
    'GGGGGGGG.',
    'KDDDDDDK.',
    'KDGDDGDK.',
    'KDDKKDDK.',
    'KDDKKDDK.',
    'KDDDDDDK.',
    'KDGDDGDK.',
    'KKKKKKKK.',
  ],

  // 얼음 타워 (가로 8칸): 하얗고 파란 뾰족 수정 + 눈 덮인 파란 받침
  ice: [
    '...WL...',
    '...WL...',
    '..WWLM..',
    '..WWLM..',
    '.WWWLMM.',
    '.WWWLMM.',
    '.WWLLMM.',
    '..WLLM..',
    '..WLMM..',
    'WWWWLLLL',
    '.MMMBBN.',
    '..MMBN..',
    '.MMMBBN.',
    'MMMMBBNN',
  ],
};

export const TOWER_ART = {
  archer: () => drawPixelMap(TOWER_MAPS.archer, TOWER_COLORS),
  cannon: () => drawPixelMap(TOWER_MAPS.cannon, TOWER_COLORS),
  ice: () => drawPixelMap(TOWER_MAPS.ice, TOWER_COLORS),
};
