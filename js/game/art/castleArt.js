// 기본 성 그림
// 게임 가운데 서 있는 '우리 성'의 기본 그림입니다. (사용자가 그림을 올리면 그 그림이 대신 쓰입니다)
// 글자 하나 = 블록 한 칸. 가로는 정확히 22칸이어야 합니다 (gameConfig.js 의 castle.columns).
// 모든 줄의 글자 수를 똑같이 맞추세요. '.' 은 빈칸(투명)입니다.
// 맨 왼쪽·오른쪽 칸과 맨 위·아래 줄에는 블록이 하나 이상 있어야 그림 폭이 정확히 맞습니다.
// 성이 공격받으면 위가 비어 있는 블록부터 떨어져 나가므로 깃발·지붕이 먼저 부서집니다.
//
//   drawCastle()     성 그림 캔버스를 돌려줌 (배경 투명)
//   CASTLE_MAP       성 글자 지도 (위 → 아래)
//   CASTLE_COLORS    글자 → 블록 색 (js/bricks/brickColors.js 의 색만 쓰기)

import { drawPixelMap } from './pixelArt.js';

// 글자별 색
export const CASTLE_COLORS = {
  K: '#1B2A34', // 검정 (깃대, 문 테두리, 창문 위)
  D: '#6C6E68', // 진한 회색 (돌 테두리, 그림자)
  G: '#A0A5A9', // 밝은 회색 (돌벽)
  B: '#0055BF', // 파랑 (지붕)
  M: '#5A93DB', // 중간 파랑 (지붕 밝은 쪽)
  N: '#0A3463', // 남색 (지붕 그림자)
  R: '#C91A09', // 빨강 (깃발)
  r: '#720E0F', // 진한 빨강 (깃발 그림자)
  O: '#582A12', // 밤색 (문)
  C: '#AA7D55', // 캐러멜 (문 나뭇결)
  Y: '#F2CD37', // 노랑 (불 켜진 창문, 문고리, 지붕 끝 장식)
};

// 성 지도 (가로 22칸 × 세로 22줄)
//   왼쪽 0~6칸: 파란 뾰족 지붕 탑 · 가운데 7~14칸: 깃발 달린 큰 탑과 큰 문 · 오른쪽 15~21칸: 파란 뾰족 지붕 탑
export const CASTLE_MAP = [
  '..........KRRR........',
  '..........KRRRRR......',
  '...Y......KRRr....Y...',
  '...B......K.......B...',
  '..MBN.GG..GG..GG.MBN..',
  '..MBN.GGGGGGGGGG.MBN..',
  '.MMBBNDDDDDDDDDDMMBBN.',
  '.MBBBN.DGKGGKGD.MBBBN.',
  'MMBBBNNDGYGGYGDMMBBBNN',
  'NNNNNNNDGYGGYGDNNNNNNN',
  '.DGGGD.DGGGGGGD.DGGGD.',
  '.DGGGD.DGGGGGGD.DGGGD.',
  '.DGKGDGDGGGGGGDGDGKGD.',
  '.DGYGDGDGGKKGGDGDGYGD.',
  '.DGYGDGDGKYYKGDGDGYGD.',
  '.DGGGDGDKOOOOKDGDGGGD.',
  '.DGGGDGDKCOOOKDGDGGGD.',
  '.DGGGDGDKCOYOKDGDGGGD.',
  '.DGGGDGDKCOOOKDGDGGGD.',
  '.DGGGDGDKCOOOKDGDGGGD.',
  '.DGGGDGDKCOOOKDGDGGGD.',
  'DDDDDDDDKOOOOKDDDDDDDD',
];

export function drawCastle() {
  return drawPixelMap(CASTLE_MAP, CASTLE_COLORS);
}
