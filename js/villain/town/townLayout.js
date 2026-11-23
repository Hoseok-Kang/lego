// 꼬마 마을 배치도 (건물·길·소품이 어디에 놓이는지)
// 바닥판은 가운데가 (0, 0), 가로 64칸 × 세로 44칸 입니다. x: 왼쪽 -32 ~ 오른쪽 32, z: 뒤쪽 -22 ~ 앞쪽(카메라 쪽) 22.
// 괴수는 왼쪽(-27, 4)에서 나타나 가운데 큰길을 따라 걸어 들어옵니다. 큰길(z 0~8)은 비워 두세요.
// 키 큰 건물은 뒤쪽 줄에, 낮은 집은 앞쪽 줄에 두어야 큰길이 가려지지 않습니다.
//
//   TOWN_LAYOUT.buildings: [{ kind, x0, z0 }]     kind: buildingArt.js 의 건물 종류, (x0, z0): 왼쪽 뒤 모서리 칸
//   TOWN_LAYOUT.roads:     [{ x0, z0, x1, z1 }]   모래색 길 (칸 범위, 끝 칸은 포함하지 않음)
//   TOWN_LAYOUT.decor:     [{ kind, x, z, length? }]   decorArt.js 의 소품 종류와 놓을 칸
//   TOWN_LAYOUT.villagers: 마을 사람 수
//
// 건물을 옮기려면 x0, z0 숫자만 바꾸면 됩니다. (서로 겹치지 않게)

export const TOWN_LAYOUT = {
  buildings: [
    // 뒤쪽 줄 (왼쪽 → 오른쪽)
    { kind: 'windmill', x0: -28, z0: -18 },
    { kind: 'houseRed', x0: -19, z0: -10 },
    { kind: 'shop', x0: -8, z0: -12 },
    { kind: 'hall', x0: 5, z0: -16 },
    { kind: 'tower', x0: 24, z0: -12 },
    // 광장
    { kind: 'well', x0: 14, z0: -3 },
    // 앞쪽 줄
    { kind: 'houseBlue', x0: -19, z0: 12 },
    { kind: 'houseOrange', x0: -3, z0: 13 },
    { kind: 'houseTeal', x0: 11, z0: 12 },
  ],
  roads: [
    { x0: -32, z0: 1, x1: 32, z1: 8 }, // 큰길
    { x0: 6, z0: -5, x1: 17, z1: 1 }, // 회관 앞 광장
    { x0: -17, z0: -4, x1: -15, z1: 1 }, // 빨간 집 문 앞
    { x0: -3, z0: -4, x1: -1, z1: 1 }, // 가게 문 앞
    { x0: 25, z0: -7, x1: 28, z1: 1 }, // 탑 문 앞
    { x0: -27, z0: -13, x1: -25, z1: 1 }, // 풍차 가는 길
  ],
  decor: [
    { kind: 'treeRound', x: -22, z: -13 },
    { kind: 'treePine', x: -10, z: -16 },
    { kind: 'treeRound', x: 2, z: -18 },
    { kind: 'treePine', x: 21, z: -17 },
    { kind: 'treeRound', x: 30, z: -18 },
    { kind: 'treePine', x: 30, z: -3 },
    { kind: 'treeRound', x: 29, z: 14 },
    { kind: 'treePine', x: 24, z: 18 },
    { kind: 'treeRound', x: -29, z: 16 },
    { kind: 'treePine', x: -8, z: 17 },
    { kind: 'treeRound', x: 6, z: 18 },
    { kind: 'treePine', x: -31, z: -5 },
    { kind: 'lamp', x: -21, z: -1 },
    { kind: 'lamp', x: -11, z: -1 },
    { kind: 'lamp', x: 4, z: -1 },
    { kind: 'lamp', x: 21, z: -1 },
    { kind: 'lamp', x: -24, z: 9 },
    { kind: 'lamp', x: -8, z: 9 },
    { kind: 'lamp', x: 7, z: 9 },
    { kind: 'lamp', x: 23, z: 9 },
    { kind: 'bush', x: -13, z: -3 },
    { kind: 'bush', x: 2, z: -5 },
    { kind: 'bush', x: 19, z: -6 },
    { kind: 'bush', x: 30, z: -8 },
    { kind: 'bush', x: -22, z: -4 },
    { kind: 'bush', x: -11, z: 14 },
    { kind: 'bush', x: 4, z: 14 },
    { kind: 'bush', x: 23, z: 13 },
    { kind: 'fenceX', x: -21, z: 20, length: 11 },
    { kind: 'fenceX', x: -5, z: 20, length: 9 },
    { kind: 'fenceX', x: 9, z: 20, length: 11 },
    { kind: 'fenceZ', x: -22, z: 12, length: 8 },
    { kind: 'fenceZ', x: 21, z: 12, length: 8 },
    { kind: 'fenceX', x: -19, z: -19, length: 7 },
    { kind: 'fenceX', x: 22, z: -19, length: 7 },
  ],
  villagers: 7,
};
