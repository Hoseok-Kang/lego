// 전장 지도 (무엇을 어디에 놓을지 — 숫자만 있는 파일)
// 가로 80칸 × 세로 60칸 잔디판. 가운데가 (0, 0), 화면 위쪽 = -z (북쪽), 아래쪽 = +z, 오른쪽 = +x.
// 내 토끼는 아래 가운데 (0, 22) 에서, 미친토끼들은 위쪽 절반에서 시작합니다. (fightConfig.js)
//   → 미친토끼 시작 자리, 당근 자리 둘레는 비워 두세요. (토끼 반지름 3, 망치 토끼 4.2 + 여유)
//
// 놓는 법 (x, z = 가운데 위치, 칸 단위)
//   walls:   돌담 { x, z, length 길이, axis 'x'(가로로 긺) | 'z'(세로로 긺), height 높이, thickness 두께 }
//   crates:  나무 상자 4×4×4 { x, z, variant 0|1 }   (총·칼에 맞으면 부서짐)
//   trees:   나무 { x, z, variant 0 동그란 | 1 큰 사과나무 | 2 분홍 꽃나무, radius 부딪힘 반지름 }
//   rocks:   바위 { x, z, variant 0 보통 | 1 큼 | 2 작음 }
//   bushes:  덤불 { x, z, variant } — 그냥 꾸미기 (지나갈 수 있음, 총알도 지나감)
//   flowers: 꽃 { x, z, variant } — 꾸미기
//   carrotPatches: 당근밭 { x, z } — 꾸미기 (진짜 당근은 fightConfig.js 의 carrots.mapSpots)
//   fence:   true 면 전장 둘레에 나무 울타리
//   outside: 울타리 바깥(한 칸 낮은 땅)에 놓는 꾸미기 { trees, bushes, rocks, flowers }
//   turn:    (어느 것에나) 0~3 → 90도씩 돌려 놓기
//
// 크기 참고: 상자 4칸, 나무 잎 8~10칸, 바위 2~6칸, 덤불 4~6칸, 토끼 키 약 16칸.

export const FIGHT_MAP = {
  plateThickness: 1, // 잔디판 두께 (바깥 땅은 이만큼 낮음)

  // 엄폐용 돌담: 서쪽 ㄴ자, 동쪽 ㄱ자, 가운데 짧은 담 (사이 길은 망치 토끼도 지나갈 만큼 넓게)
  walls: [
    { x: -20, z: 3, length: 12, axis: 'x', height: 3, thickness: 2 },
    { x: -25, z: 7, length: 6, axis: 'z', height: 3, thickness: 2 },
    { x: 14, z: -3, length: 12, axis: 'x', height: 3, thickness: 2 },
    { x: 19, z: 1, length: 6, axis: 'z', height: 3, thickness: 2 },
    { x: 0, z: 7, length: 6, axis: 'x', height: 3, thickness: 2 },
  ],

  // 나무 상자 (2~3개씩 모여 있음)
  crates: [
    { x: -28, z: -15, variant: 0 },
    { x: -24, z: -15, variant: 1, turn: 1 },
    { x: 30, z: -16, variant: 0, turn: 2 },
    { x: 30, z: -12, variant: 1 },
    { x: -4, z: -5, variant: 0, turn: 1 },
    { x: -13, z: 17, variant: 1 },
    { x: -13, z: 21, variant: 0, turn: 3 },
    { x: 14, z: 18, variant: 1, turn: 2 },
  ],

  // 나무 (가장자리 근처)
  trees: [
    { x: -33, z: -23, variant: 1, radius: 4.6 },
    { x: 34, z: -24, variant: 0, radius: 3.8 },
    { x: -35, z: -5, variant: 2, radius: 3.8 },
    { x: 34, z: 23, variant: 0, radius: 3.8 },
  ],

  rocks: [
    { x: 6, z: -26, variant: 1 },
    { x: 36, z: -5, variant: 0 },
    { x: -37, z: 10, variant: 2 },
    { x: 8, z: 26, variant: 2 },
    { x: -21, z: -27, variant: 0 },
  ],

  bushes: [
    { x: -20, z: 22, variant: 1 },
    { x: 22, z: 18, variant: 0 },
    { x: -31, z: 10, variant: 2 },
    { x: 25, z: -27, variant: 1 },
    { x: -8, z: -27, variant: 0 },
    { x: 8, z: 5, variant: 2 },
    { x: -36, z: 22, variant: 0 },
  ],

  flowers: [
    { x: -4, z: 26, variant: 0 },
    { x: 4, z: 27, variant: 1 },
    { x: -24, z: 15, variant: 2 },
    { x: 18, z: 10, variant: 0 },
    { x: -6, z: 3, variant: 1 },
    { x: 7, z: -10, variant: 2 },
    { x: -18, z: -26, variant: 0 },
    { x: 20, z: -12, variant: 1 },
    { x: -34, z: 14, variant: 2 },
    { x: 37, z: 4, variant: 0 },
    { x: -12, z: -6, variant: 2 },
    { x: 27, z: 22, variant: 1 },
    { x: -26, z: -26, variant: 1 },
    { x: 36, z: -16, variant: 2 },
  ],

  carrotPatches: [
    { x: -30, z: 25 },
    { x: 24, z: 26 },
  ],

  fence: true,

  // 울타리 바깥 꾸미기 (카메라가 가장자리에 가면 보임). 부딪힘 없음
  outside: {
    trees: [
      { x: -30, z: -36, variant: 1 },
      { x: -12, z: -37, variant: 0 },
      { x: 4, z: -36, variant: 2 },
      { x: 20, z: -37, variant: 1 },
      { x: 36, z: -36, variant: 0 },
      { x: -47, z: -20, variant: 0 },
      { x: -46, z: 2, variant: 1 },
      { x: -47, z: 20, variant: 2 },
      { x: 47, z: -18, variant: 2 },
      { x: 46, z: 4, variant: 0 },
      { x: 47, z: 22, variant: 1 },
      { x: -48, z: -38, variant: 2 },
      { x: 48, z: -38, variant: 1 },
    ],
    bushes: [
      { x: -22, z: 34, variant: 0 },
      { x: -4, z: 35, variant: 2 },
      { x: 12, z: 34, variant: 1 },
      { x: 30, z: 35, variant: 0 },
      { x: -44, z: 32, variant: 1 },
      { x: 44, z: 33, variant: 2 },
      { x: -21, z: -34, variant: 2 },
      { x: 12, z: -34, variant: 0 },
    ],
    rocks: [
      { x: -36, z: 34, variant: 1 },
      { x: 22, z: 36, variant: 0 },
      { x: 44, z: -8, variant: 1 },
      { x: -44, z: -9, variant: 0 },
    ],
    flowers: [
      { x: -12, z: 33, variant: 0 },
      { x: 4, z: 33, variant: 1 },
      { x: 38, z: 33, variant: 2 },
      { x: -43, z: 12, variant: 0 },
      { x: 43, z: 13, variant: 1 },
    ],
  },
};
