// 토끼 모양 설계 (글자 지도)
// 내 토끼(player)와 미친토끼 3종류(knife 칼, gunner 총, brute 망치)의 모양을 블록 글자 지도로 적습니다.
// 지도 읽는 법은 voxelText.js 맨 위 설명을 보세요. (첫 줄 = 뒤통수 쪽, 마지막 줄 = 얼굴 쪽, 맨 앞 층 = 맨 아래)
//
// 토끼 하나의 설계
//   colors   글자 → 블록 색 (js/bricks/brickColors.js 의 색만 쓰기)
//   parts    부품마다 { pivot: 돌아가는 중심 [x,y,z], pieces: [{ at: [x, 밑면 높이, z], layers, mirror }] }
//            at = 그 조각 지도의 가운데가 놓일 곳. mirror: true 면 좌우 뒤집어서 놓음
//   hand     무기 손잡이가 올 곳 (오른손 앞)
//
// 뼈대 (모든 토끼 공통, 블록 칸 단위)
//   발 y 0 · 몸 y 1~4 · 머리 y 5~10 · 귀 y 11~17
//   토끼 자신의 왼쪽(L) = +x, 오른쪽(R) = -x. 얼굴 = +z
//
// 귀 블록 수가 '맞을 때 터지는 칸 수' 입니다. 한 토끼에 20~28개 정도가 알맞습니다.
//
//   RABBIT_DESIGNS = { player, knife, gunner, brute }

import { PLAYER } from './rabbitPlayer.js';
import { KNIFE, GUNNER, BRUTE } from './rabbitEnemies.js';

export const RABBIT_DESIGNS = { player: PLAYER, knife: KNIFE, gunner: GUNNER, brute: BRUTE };
