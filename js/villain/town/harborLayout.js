// 바닷가 마을 배치도 (건물·바닥·소품이 어디에 놓이는지)
// 바닥판은 꼬마 마을과 같은 64 × 44 칸 (x: -32 ~ 32, z: -22 ~ 22). 앞쪽(카메라 쪽, z 13 ~ 22)은 바다이고 그 위에 배가 떠 있어요.
// 괴수는 왼쪽(-28, 4)에서 나무 길(z 1 ~ 8)을 따라 들어옵니다. 바다로 걸어 들어가 배를 부수면 물이 첨벙 튀어요.
// 영웅(얼음 마법사)은 물 위에는 내려오지 않습니다.
//
//   HARBOR_LAYOUT.buildings: [{ kind, x0, z0 }]   kind: harborArt.js 의 건물 종류, (x0, z0): 왼쪽 뒤 모서리 칸
//   HARBOR_LAYOUT.ground: [{ kind, x0, z0, x1, z1 }]   바닥 타일 (끝 칸은 포함하지 않음). 뒤에 적은 것이 위에 깔림
//       kind: water(바다) shallow(얕은 물) sand(모래밭) boardwalk(나무 길) pier(부두) rocks(바위 언덕)  — 색·높이는 townGround.js 의 GROUND
//   HARBOR_LAYOUT.decor / villagers / villagerStyle / street / monsterStart / road — townLayout.js 와 같은 뜻
//
// 건물을 옮기려면 x0, z0 숫자만 바꾸면 됩니다. (서로 겹치지 않게, 배는 바다 위에)

export const HARBOR_LAYOUT = {
  buildings: [
    // 뒤쪽 줄 (왼쪽 → 오른쪽)
    { kind: 'warehouse', x0: -30, z0: -12 },
    { kind: 'harborHouseTeal', x0: -17, z0: -8 },
    { kind: 'harborHouseYellow', x0: -11, z0: -9 },
    { kind: 'harborHouseCoral', x0: -5, z0: -8 },
    { kind: 'fishMarket', x0: 4, z0: -14 },
    { kind: 'netShed', x0: 21, z0: -9 },
    // 바다 쪽
    { kind: 'lighthouse', x0: 25, z0: 11 },
    { kind: 'fishingBoat', x0: -28, z0: 17 },
    { kind: 'sailboat', x0: -13, z0: 17 },
    { kind: 'fishingBoat', x0: 5, z0: 17 },
  ],
  ground: [
    { kind: 'sand', x0: -32, z0: 8, x1: 32, z1: 12 },
    { kind: 'shallow', x0: -32, z0: 12, x1: 32, z1: 14 },
    { kind: 'water', x0: -32, z0: 14, x1: 32, z1: 22 },
    { kind: 'boardwalk', x0: -32, z0: 1, x1: 32, z1: 8 }, // 큰길
    { kind: 'boardwalk', x0: 6, z0: -5, x1: 15, z1: 1 }, // 어시장 앞 광장
    { kind: 'boardwalk', x0: -16, z0: -3, x1: -14, z1: 1 }, // 집 앞
    { kind: 'boardwalk', x0: -26, z0: -5, x1: -24, z1: 1 }, // 창고 앞
    { kind: 'pier', x0: -20, z0: 9, x1: -17, z1: 21 }, // 부두 셋
    { kind: 'pier', x0: 1, z0: 9, x1: 4, z1: 21 },
    { kind: 'pier', x0: 15, z0: 9, x1: 18, z1: 19 },
    { kind: 'rocks', x0: 22, z0: 9, x1: 32, z1: 18 }, // 등대 바위
  ],
  decor: [
    // 뒤쪽 숲
    { kind: 'treePine', x: -26, z: -18 },
    { kind: 'treePine', x: -19, z: -16 },
    { kind: 'treePine', x: -12, z: -17 },
    { kind: 'treeRound', x: -5, z: -15 },
    { kind: 'treePine', x: 0, z: -19 },
    { kind: 'treePine', x: 19, z: -17 },
    { kind: 'treeRound', x: 25, z: -15 },
    { kind: 'treePine', x: 30, z: -19 },
    { kind: 'treeRound', x: 31, z: -6 },
    { kind: 'fenceX', x: -31, z: -20, length: 13 },
    { kind: 'fenceX', x: 18, z: -20, length: 13 },
    // 큰길 가로등
    { kind: 'lamp', x: -22, z: 0 },
    { kind: 'lamp', x: -8, z: 0 },
    { kind: 'lamp', x: 17, z: 0 },
    { kind: 'lamp', x: -12, z: 8 },
    { kind: 'lamp', x: 8, z: 8 },
    { kind: 'lamp', x: 24, z: 8 },
    // 창고·시장 둘레 짐
    { kind: 'barrel', x: -19, z: -4 },
    { kind: 'crates', x: -22, z: -3 },
    { kind: 'barrel', x: 17, z: -5 },
    { kind: 'crates', x: 2, z: -5 },
    { kind: 'barrel', x: 19, z: -3 },
    { kind: 'bush', x: -9, z: -2 },
    { kind: 'bush', x: 28, z: -3 },
    // 모래밭
    { kind: 'netRack', x: -13, z: 9 },
    { kind: 'netRack', x: 8, z: 10 },
    { kind: 'anchor', x: 20, z: 10 },
    { kind: 'rock', x: -31, z: 9 },
    { kind: 'rock', x: -6, z: 10 },
    { kind: 'crates', x: -24, z: 9 },
    { kind: 'barrel', x: 12, z: 9 },
    // 바다·바위
    { kind: 'buoy', x: -31, z: 20 },
    { kind: 'buoy', x: -2, z: 21 },
    { kind: 'buoy', x: 13, z: 21 },
    { kind: 'buoy', x: 20, z: 15 },
    { kind: 'rock', x: 23, z: 10 },
    { kind: 'rock', x: 30, z: 10 },
    { kind: 'rock', x: 23, z: 16 },
    { kind: 'rock', x: 30, z: 16 },
  ],
  villagers: 7,
  villagerStyle: 'harbor',
  street: [1, 8],
  monsterStart: [-28, 4],
  road: 4.5,
};
