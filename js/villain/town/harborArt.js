// 바닷가 마을 건물 그림 (어시장, 창고, 좁고 높은 항구 집, 그물 창고, 등대, 고깃배, 돛단배)
// 꼬마 마을 건물처럼 '속이 빈 블록 집' 이라 맞으면 벽에 구멍이 뚫립니다. 배는 물 위에서 둥실둥실 흔들려요(bob).
// 칸 좌표: x 0 ~ w-1 (오른쪽), z 0 ~ d-1 (앞 = 카메라 쪽), y 0 = 바닥 층. 모든 블록은 바닥까지 이어져 있어야 합니다.
//
//   HARBOR_MAKERS: { 종류: () => { name, w, d, voxels, rotor?, bob? } }   (buildingArt.js 의 makeBuilding 이 씀)
//       rotor: 등대 꼭대기에서 빙글 도는 불빛 (axis 'y'), bob: { height, roll, speed } 물 위 흔들림
//   종류: fishMarket(어시장) warehouse(창고) harborHouseTeal / harborHouseYellow / harborHouseCoral(항구 집)
//        netShed(그물 창고) lighthouse(등대) fishingBoat(고깃배) sailboat(돛단배)
//
// 크기·색을 바꾸려면 각 함수 안 숫자를 고치세요. (색은 artKit.js 의 C = js/bricks/brickColors.js 의 색만)

import { createShape } from './voxelShape.js';
import { C, gableRoof } from './artKit.js';

const HARBOR_HOUSES = {
  harborHouseTeal: { name: '청록 항구 집', wall: C.teal, roof: C.navy, door: C.yellow, trim: C.white },
  harborHouseYellow: { name: '노란 항구 집', wall: C.yellow, roof: C.darkRed, door: C.blue, trim: C.white },
  harborHouseCoral: { name: '분홍 항구 집', wall: C.coral, roof: C.darkGray, door: C.navy, trim: C.white },
};
const BOAT_BOB = { height: 0.18, roll: 0.035, speed: 1.7 };

export const HARBOR_MAKERS = {
  fishMarket: makeFishMarket,
  warehouse: makeWarehouse,
  netShed: makeNetShed,
  lighthouse: makeLighthouse,
  fishingBoat: makeFishingBoat,
  sailboat: makeSailboat,
};
for (const kind of Object.keys(HARBOR_HOUSES)) HARBOR_MAKERS[kind] = () => makeHarborHouse(HARBOR_HOUSES[kind]);

// ── 어시장: 앞이 탁 트인 큰 시장. 줄무늬 차양 아래 생선 좌판, 지붕 위 커다란 물고기 간판 ──
function makeFishMarket() {
  const s = createShape();
  const w = 13;
  const d = 8;
  const H = 5;
  s.walls(0, 0, 0, w - 1, 0, d - 1, C.darkGray);
  s.box(0, 1, 0, w - 1, H, 0, C.white); // 뒷벽
  s.box(0, 1, 0, 0, H, d - 1, C.white); // 옆벽
  s.box(w - 1, 1, 0, w - 1, H, d - 1, C.white);
  for (const x of [0, 4, 8, w - 1]) s.box(x, 1, d - 1, x, H, d - 1, C.caramel); // 앞 기둥
  s.box(1, H, d - 1, w - 2, H, d - 1, C.caramel); // 앞 들보
  for (const x of [3, 9]) s.box(x, 2, 0, x + 1, 3, 0, C.sky); // 뒷창
  s.box(0, 2, 3, 0, 3, 4, C.sky);
  s.box(w - 1, 2, 3, w - 1, 3, 4, C.sky);
  // 생선 좌판 세 개 (다리 + 판 + 생선)
  const fish = [C.sky, C.coral, C.orange, C.gray, C.sky, C.tangerine];
  for (const x0 of [1, 5, 9]) {
    s.box(x0, 0, d - 2, x0 + 2, 1, d - 2, C.brown);
    for (let i = 0; i < 3; i++) s.set(x0 + i, 2, d - 2, fish[(x0 + i) % fish.length]);
  }
  s.box(5, 0, 2, 7, 1, 3, C.deepSky); // 가운데 물통
  // 줄무늬 차양 (앞으로 두 칸 + 늘어진 끝단)
  for (let x = -1; x <= w; x++) {
    const hex = (x + 2) % 2 === 0 ? C.blue : C.white;
    s.set(x, H + 1, d, hex);
    s.set(x, H + 1, d + 1, hex);
    if ((x + 2) % 2 === 0) s.set(x, H, d + 1, hex);
  }
  s.box(-1, H + 1, d - 1, w, H + 1, d - 1, C.white);
  gableRoof(s, { x0: -1, x1: w, z0: 0, z1: d - 2, y: H + 1, roof: C.deepSky, ridge: C.navy, gable: C.white, gableX: [0, w - 1] });
  // 지붕 위 물고기 간판 (용마루 위에 세움)
  const top = H + 1 + Math.floor((d - 1) / 2) + 1;
  const mid = Math.floor((d - 2) / 2);
  s.box(5, top, mid, 7, top + 2, mid, C.orange);
  s.box(4, top + 1, mid, 4, top + 1, mid, C.orange);
  s.box(8, top + 1, mid, 8, top + 1, mid, C.orange);
  s.set(9, top, mid, C.tangerine); // 꼬리
  s.set(9, top + 2, mid, C.tangerine);
  s.set(9, top + 1, mid, C.tangerine);
  s.set(5, top + 1, mid, C.black); // 눈
  return { name: '어시장', w, d, voxels: s.voxels() };
}

// ── 창고: 높은 나무 헛간 + 큰 미닫이 문 + 다락 창 + 앞에 쌓인 상자 ──
function makeWarehouse() {
  const s = createShape();
  const w = 11;
  const d = 7;
  const H = 6;
  s.walls(0, 0, 0, w - 1, 0, d - 1, C.darkGray);
  s.walls(0, 1, 0, w - 1, H, d - 1, C.caramel);
  for (let y = 2; y <= H; y += 2) s.walls(0, y, 0, w - 1, y, d - 1, C.apricot); // 판자 줄무늬
  for (const [x, z] of [[0, 0], [w - 1, 0], [0, d - 1], [w - 1, d - 1]]) s.box(x, 1, z, x, H, z, C.brown);
  // 큰 문 (흰 X 버팀목)
  s.box(3, 0, d - 1, 7, 4, d - 1, C.darkOrange);
  for (let i = 0; i < 4; i++) {
    s.set(3 + i, 1 + i, d - 1, C.white);
    s.set(7 - i, 1 + i, d - 1, C.white);
  }
  s.set(5, 5, d - 1, C.brown);
  s.box(4, H, d - 1, 6, H, d - 1, C.sky); // 다락 창
  gableRoof(s, { x0: -1, x1: w, z0: 0, z1: d - 1, y: H + 1, roof: C.red, ridge: C.darkRed, gable: C.caramel, gableX: [0, w - 1] });
  // 앞에 쌓인 상자·통
  s.box(0, 0, d, 1, 1, d, C.tangerine);
  s.set(0, 2, d, C.darkOrange);
  s.box(w - 2, 0, d, w - 1, 0, d, C.brown);
  s.set(w - 1, 1, d, C.caramel);
  return { name: '창고', w, d, voxels: s.voxels() };
}

// ── 좁고 높은 항구 집: 앞을 보는 계단 모양 박공, 하얀 창틀, 꼭대기 도르래 ──
function makeHarborHouse({ name, wall, roof, door, trim }) {
  const s = createShape();
  const w = 5;
  const d = 5;
  const H = 6;
  s.walls(0, 0, 0, w - 1, 0, d - 1, C.darkGray);
  s.walls(0, 1, 0, w - 1, H, d - 1, wall);
  s.box(2, 0, d - 1, 2, 2, d - 1, door);
  for (const x of [1, 3]) {
    s.set(x, 2, d - 1, C.sky); // 아래 창
    s.box(x, 4, d - 1, x, 5, d - 1, C.sky); // 위 긴 창
  }
  s.box(0, 3, d - 1, w - 1, 3, d - 1, trim); // 흰 띠
  s.set(2, 5, d - 1, trim);
  for (const x of [0, w - 1]) s.box(x, 3, 2, x, 4, 2, C.sky);
  // 지붕: 앞뒤로 긴 세모 (용마루가 z 방향), 앞면은 계단 모양 벽
  for (let k = 0; k < 3; k++) {
    s.box(k, H + 1 + k, 0, w - 1 - k, H + 1 + k, d - 2, roof);
    s.box(k, H + 1 + k, d - 1, w - 1 - k, H + 1 + k, d - 1, wall);
    s.set(k, H + 1 + k, d - 1, trim);
    s.set(w - 1 - k, H + 1 + k, d - 1, trim);
  }
  s.set(2, H + 3, d, C.brown); // 도르래 들보
  s.set(2, H + 4, d - 1, trim);
  s.set(1, 1, d, C.coral); // 문 옆 화분
  return { name, w, d, voxels: s.voxels() };
}

// ── 그물 창고: 작은 오두막 + 지붕 위 말리는 그물 + 걸어 둔 생선 ──
function makeNetShed() {
  const s = createShape();
  const w = 6;
  const d = 5;
  s.walls(0, 0, 0, w - 1, 0, d - 1, C.darkGray);
  s.walls(0, 1, 0, w - 1, 3, d - 1, C.sandGreen);
  for (const [x, z] of [[0, 0], [w - 1, 0], [0, d - 1], [w - 1, d - 1]]) s.box(x, 1, z, x, 3, z, C.brown);
  s.box(2, 0, d - 1, 2, 2, d - 1, C.brown);
  s.set(4, 2, d - 1, C.sky);
  s.box(-1, 4, -1, w, 4, d, C.darkSand); // 평평한 지붕
  // 그물 (초록 점점이) + 생선 걸이
  for (let x = 0; x < w; x++) for (let z = 0; z < d; z++) if ((x + z) % 2 === 0) s.set(x, 5, z, C.darkGreen);
  s.box(-1, 3, d, -1, 3, d, C.brown);
  s.set(-1, 2, d, C.sky);
  s.set(w, 3, d, C.brown);
  s.set(w, 2, d, C.coral);
  return { name: '그물 창고', w, d, voxels: s.voxels() };
}

// ── 등대: 빨강·하양 줄무늬 둥근 탑 + 난간 + 노란 불빛 방 + 빨간 지붕, 꼭대기에서 불빛이 빙글빙글 ──
function makeLighthouse() {
  const s = createShape();
  const ring = (y, hex, r = 2) => {
    s.walls(2 - r, y, 2 - r, 2 + r, y, 2 + r, hex);
    for (const [x, z] of [[2 - r, 2 - r], [2 + r, 2 - r], [2 - r, 2 + r], [2 + r, 2 + r]]) s.set(x, y, z, null); // 모서리를 깎아 둥글게
    if (r === 2) for (const [x, z] of [[1, 1], [3, 1], [1, 3], [3, 3]]) s.set(x, y, z, hex);
  };
  ring(0, C.darkGray);
  const H = 12;
  for (let y = 1; y <= H; y++) ring(y, Math.floor((y - 1) / 2) % 2 === 0 ? C.white : C.red);
  s.box(2, 0, 4, 2, 2, 4, C.navy); // 문
  for (const y of [5, 9]) s.set(2, y, 4, C.sky);
  // 난간 층 (한 칸 넓게) + 난간
  s.box(-1, H + 1, 0, 5, H + 1, 4, C.darkGray);
  s.box(0, H + 1, -1, 4, H + 1, 5, C.darkGray);
  for (let i = 0; i <= 4; i += 2) {
    s.set(i, H + 2, -1, C.black);
    s.set(i, H + 2, 5, C.black);
    s.set(-1, H + 2, i, C.black);
    s.set(5, H + 2, i, C.black);
  }
  // 불빛 방 (창 너머 노란 불) + 빨간 지붕 + 꼭지
  s.walls(1, H + 2, 1, 3, H + 3, 3, C.white);
  for (const [x, z] of [[2, 1], [2, 3], [1, 2], [3, 2]]) s.box(x, H + 2, z, x, H + 3, z, C.lightYellow);
  s.box(2, H + 2, 2, 2, H + 3, 2, C.yellow);
  s.box(0, H + 4, 0, 4, H + 4, 4, C.red);
  s.box(1, H + 5, 1, 3, H + 5, 3, C.red);
  s.box(2, H + 6, 2, 2, H + 7, 2, C.black);
  // 빙글 도는 불빛: 가운데 불 위 두 갈래 빛줄기 (불빛 방 가운데 블록이 받침)
  const beam = createShape();
  for (let r = 2; r <= 5; r++) {
    beam.set(r, 0, 0, r < 4 ? C.lightYellow : C.yellow);
    beam.set(-r, 0, 0, r < 4 ? C.lightYellow : C.yellow);
  }
  const rotor = { voxels: beam.voxels(), pivot: [2, H + 3, 2], anchor: [2, H + 2, 2], speed: 1.8, axis: 'y' };
  return { name: '등대', w: 5, d: 5, voxels: s.voxels(), rotor };
}

// ── 고깃배: 빨간 배 + 하얀 조타실 + 작은 돛대와 깃발 (물 위에서 흔들) ──
function makeFishingBoat() {
  const s = createShape();
  const w = 8;
  const d = 4;
  s.box(1, 0, 1, w - 2, 0, d - 2, C.darkRed); // 용골
  s.walls(0, 1, 0, w - 2, 1, d - 1, C.red);
  s.box(w - 1, 1, 1, w - 1, 1, d - 2, C.red); // 뾰족한 뱃머리
  s.walls(0, 2, 0, w - 2, 2, d - 1, C.white);
  s.box(w - 1, 2, 1, w - 1, 2, d - 2, C.white);
  s.box(1, 1, 1, w - 3, 1, d - 2, C.caramel); // 갑판
  s.walls(1, 2, 1, 3, 4, 2, C.white); // 조타실
  s.set(2, 3, 2, C.sky);
  s.box(1, 5, 1, 3, 5, 2, C.blue);
  s.box(5, 2, 1, 5, 6, 1, C.brown); // 돛대
  s.box(6, 5, 1, 6, 6, 1, C.yellow); // 깃발
  s.set(5, 2, 2, C.tangerine); // 부표
  return { name: '고깃배', w, d, voxels: s.voxels(), bob: BOAT_BOB };
}

// ── 돛단배: 파란 배 + 높은 돛대 + 하얀 큰 돛과 작은 돛 (물 위에서 흔들) ──
function makeSailboat() {
  const s = createShape();
  const w = 10;
  const d = 4;
  s.box(1, 0, 1, w - 3, 0, d - 2, C.navy);
  s.walls(0, 1, 0, w - 2, 1, d - 1, C.blue);
  s.box(w - 1, 1, 1, w - 1, 1, d - 2, C.blue);
  s.walls(0, 2, 0, w - 2, 2, d - 1, C.white);
  s.box(w - 1, 2, 1, w - 1, 2, d - 2, C.white);
  s.box(1, 1, 1, w - 3, 1, d - 2, C.caramel);
  const mast = 5;
  s.box(mast, 2, 1, mast, 12, 1, C.brown);
  s.set(mast, 13, 1, C.red);
  // 큰 돛 (돛대 왼쪽 세모) + 작은 돛 (오른쪽)
  for (let y = 3; y <= 11; y++) {
    const reach = Math.max(1, Math.round(((11 - y) / 8) * 4));
    s.box(mast - reach, y, 1, mast - 1, y, 1, y === 7 ? C.red : C.white);
  }
  for (let y = 3; y <= 8; y++) {
    const reach = Math.max(1, Math.round(((8 - y) / 5) * 3));
    s.box(mast + 1, y, 1, mast + reach, y, 1, C.white);
  }
  return { name: '돛단배', w, d, voxels: s.voxels(), bob: { ...BOAT_BOB, speed: BOAT_BOB.speed * 0.8 } };
}
