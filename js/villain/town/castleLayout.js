// 왕궁 성곽 배치도 (성벽·탑·왕궁·바닥·소품이 어디에 놓이는지)
// 바닥판은 꼬마 마을과 같은 64 × 44 칸 (x: -32 ~ 32, z: -22 ~ 22). 왼쪽 흙길 끝에 성문이 있고, 성 안은 돌바닥 마당입니다.
// 괴수는 왼쪽(-29, 4)에서 흙길을 따라 와서 성문부터 부수고 들어갑니다. 뒤쪽 가운데에 가장 큰 왕궁이 있어요.
// 앞쪽 성벽은 낮은 생울타리로 대신해서 마당이 카메라에 잘 보이게 했습니다.
//
//   CASTLE_LAYOUT.buildings: [{ kind, x0, z0 }]   kind: castleArt.js 의 건물 종류, (x0, z0): 왼쪽 뒤 모서리 칸
//   CASTLE_LAYOUT.ground: [{ kind, x0, z0, x1, z1 }]   바닥 타일 (끝 칸은 포함하지 않음). 뒤에 적은 것이 위에 깔림
//       kind: dirt(흙길) stone(돌바닥 마당) avenue(흰 돌 큰길)  — 색·높이는 townGround.js 의 GROUND
//   CASTLE_LAYOUT.decor / villagers / villagerStyle / street / monsterStart / road — townLayout.js 와 같은 뜻
//
// 건물을 옮기려면 x0, z0 숫자만 바꾸면 됩니다. (서로 겹치지 않게)

export const CASTLE_LAYOUT = {
  buildings: [
    // 왼쪽 성벽 줄 (성문 포함)
    { kind: 'towerSquare', x0: -25, z0: -17 },
    { kind: 'wallZ', x0: -23, z0: -11 },
    { kind: 'gatehouse', x0: -24, z0: -1 },
    { kind: 'wallZ', x0: -23, z0: 10 },
    // 뒤쪽 성벽 줄 + 왕궁
    { kind: 'wallX', x0: -18, z0: -17 },
    { kind: 'palace', x0: -8, z0: -20 },
    { kind: 'wallX', x0: 10, z0: -17 },
    { kind: 'towerSquare', x0: 20, z0: -17 },
    // 오른쪽
    { kind: 'wallZ', x0: 22, z0: -10 },
    { kind: 'towerRound', x0: 22, z0: 11 },
    // 성 안
    { kind: 'barracks', x0: -19, z0: -10 },
    { kind: 'treasury', x0: 12, z0: -9 },
    { kind: 'fountain', x0: -2, z0: -5 },
    { kind: 'statue', x0: 4, z0: 11 },
  ],
  ground: [
    { kind: 'stone', x0: -20, z0: -15, x1: 22, z1: 19 }, // 성 안 마당
    { kind: 'dirt', x0: -32, z0: 1, x1: -19, z1: 8 }, // 성문 가는 흙길
    { kind: 'avenue', x0: -19, z0: 1, x1: 32, z1: 8 }, // 큰길
    { kind: 'avenue', x0: -3, z0: -7, x1: 4, z1: 1 }, // 왕궁 가는 길
    { kind: 'avenue', x0: 3, z0: 8, x1: 10, z1: 11 }, // 동상 가는 길
  ],
  decor: [
    // 성 밖 나무·깃발
    { kind: 'treePine', x: -30, z: -16 },
    { kind: 'treeRound', x: -29, z: -8 },
    { kind: 'treePine', x: -31, z: -2 },
    { kind: 'treeRound', x: -30, z: 12 },
    { kind: 'treePine', x: -28, z: 18 },
    { kind: 'treePine', x: 29, z: -16 },
    { kind: 'treeRound', x: 30, z: -6 },
    { kind: 'treePine', x: 30, z: 18 },
    { kind: 'banner', x: -27, z: -1 },
    { kind: 'banner', x: -27, z: 9 },
    // 큰길 횃불
    { kind: 'torch', x: -14, z: 0 },
    { kind: 'torch', x: -5, z: 0 },
    { kind: 'torch', x: 8, z: 0 },
    { kind: 'torch', x: 18, z: 0 },
    { kind: 'torch', x: -14, z: 8 },
    { kind: 'torch', x: 0, z: 8 },
    { kind: 'torch', x: 14, z: 8 },
    // 앞 정원 (낮은 생울타리 + 꽃밭)
    { kind: 'hedgeX', x: -19, z: 19, length: 14 },
    { kind: 'hedgeX', x: 0, z: 19, length: 14 },
    { kind: 'hedgeZ', x: -20, z: 9, length: 9 },
    { kind: 'flowerBed', x: -14, z: 12 },
    { kind: 'flowerBed', x: -7, z: 15 },
    { kind: 'flowerBed', x: 13, z: 14 },
    { kind: 'flowerBed', x: -1, z: 12 },
    { kind: 'bush', x: -17, z: 15 },
    { kind: 'bush', x: 16, z: 11 },
    { kind: 'bush', x: 19, z: 16 },
    // 마당 구석
    { kind: 'barrel', x: -8, z: -4 },
    { kind: 'crates', x: -6, z: -3 },
    { kind: 'banner', x: 8, z: -3 },
    { kind: 'torch', x: 20, z: -6 },
  ],
  villagers: 11, // (V) 밖에 나와 있는 사람 수 (건물 안 사람은 villainConfig.js 의 villagers)
  villagerStyle: 'castle',
  street: [1, 8],
  monsterStart: [-29, 4],
  road: 4.5,
};
