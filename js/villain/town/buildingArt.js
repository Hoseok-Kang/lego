// 마을 건물 그림 (장난감 블록 집) — 꼬마 마을 건물 + 모든 마을 건물 목록
// 건물은 전부 '속이 빈 블록 집' 입니다: 벽 한 겹 + 지붕. 그래서 맞으면 벽에 구멍이 뚫리고 안이 들여다보입니다.
// 칸 좌표는 정수: x 0 ~ w-1 (오른쪽), z 0 ~ d-1 (앞 = 카메라 쪽), y 0 = 바닥 층. 처마는 -1 이나 w 까지 나와도 됩니다.
// 모든 블록은 옆·위·아래로 이어져 있어야 합니다 (이어지지 않은 블록은 게임에서 바로 떨어짐).
//
//   BUILDING_KINDS                     건물 종류 이름 목록
//   makeBuilding(kind) → { kind, name, w, d, voxels: [{ x, y, z, hex }], rotor?, bob? }
//       rotor: 돌아가는 날개 (풍차, 등대 불빛) { voxels, pivot: [x, y, z], anchor: [x, y, z], speed, axis?: 'z' | 'y' }
//              anchor 칸의 블록이 부서지면 날개가 통째로 떨어짐
//       bob: 물 위 배처럼 둥실둥실 { height, roll, speed }
//
// 꼬마 마을 건물: houseRed(빨간 지붕 집), houseBlue(파란 지붕 집), houseOrange(주황 지붕 집), houseTeal(청록 지붕 집),
//           tower(높은 탑), shop(가게), hall(마을 회관), windmill(풍차), well(우물)
// 바닷가 마을 건물은 harborArt.js, 왕궁 성곽 건물은 castleArt.js 에 있고 여기서 한 목록으로 모읍니다.
// 색은 js/bricks/brickColors.js 의 색만 씁니다. 집 크기·색을 바꾸려면 아래 HOUSES 표를 고치세요.

import { createShape } from './voxelShape.js';
import { C, gableRoof, roofHeightAt } from './artKit.js';
import { HARBOR_MAKERS } from './harborArt.js';
import { CASTLE_MAKERS } from './castleArt.js';

// 집 네 가지 (가로 w, 세로 d, 벽 높이 wallH, 벽·지붕·기둥·문 색, 굴뚝 자리)
const HOUSES = {
  houseRed: { name: '빨간 지붕 집', w: 7, d: 6, wallH: 4, wall: C.white, roof: C.red, trim: C.caramel, door: C.brown, ridge: C.darkRed, chimney: 5 },
  houseBlue: { name: '파란 지붕 집', w: 7, d: 6, wallH: 4, wall: C.cream, roof: C.blue, trim: C.white, door: C.darkRed, ridge: C.navy, chimney: 1 },
  houseOrange: { name: '주황 지붕 집', w: 6, d: 6, wallH: 3, wall: C.sand, roof: C.orange, trim: C.brown, door: C.green, ridge: C.red, chimney: 4 },
  houseTeal: { name: '청록 지붕 집', w: 8, d: 6, wallH: 4, wall: C.pink, roof: C.teal, trim: C.white, door: C.navy, ridge: C.blue, chimney: 6 },
};

const MAKERS = {
  tower: makeTower,
  shop: makeShop,
  hall: makeHall,
  windmill: makeWindmill,
  well: makeWell,
};
for (const kind of Object.keys(HOUSES)) MAKERS[kind] = () => makeHouse(HOUSES[kind]);
Object.assign(MAKERS, HARBOR_MAKERS, CASTLE_MAKERS); // 바닷가 마을·왕궁 성곽 건물

export const BUILDING_KINDS = Object.keys(MAKERS);

export function makeBuilding(kind) {
  const maker = MAKERS[kind];
  if (!maker) throw new Error(`모르는 건물 종류: ${kind}`);
  return { kind, ...maker() };
}

// ── 집: 돌 받침 + 벽(모서리 기둥) + 문·창문 + 계단 모양 세모 지붕 + 굴뚝 ──
function makeHouse({ name, w, d, wallH, wall, roof, trim, door, ridge, chimney }) {
  const s = createShape();
  s.walls(0, 0, 0, w - 1, 0, d - 1, C.gray);
  s.walls(0, 1, 0, w - 1, wallH, d - 1, wall);
  for (const [x, z] of [[0, 0], [w - 1, 0], [0, d - 1], [w - 1, d - 1]]) s.box(x, 1, z, x, wallH, z, trim);
  // 문 (앞쪽 가운데) 과 디딤돌
  const doorX = Math.floor((w - 1) / 2);
  s.box(doorX, 0, d - 1, doorX, 2, d - 1, door);
  s.set(doorX, 3, d - 1, trim);
  s.set(doorX, 0, d, C.sand);
  // 창문: 앞 양쪽, 옆 가운데, 뒤 가운데
  const windowTop = Math.min(3, wallH);
  for (const x of [1, w - 2]) s.box(x, 2, d - 1, x, windowTop, d - 1, C.sky);
  if (w >= 8) s.box(w - 3, 2, d - 1, w - 3, windowTop, d - 1, C.sky);
  for (const x of [0, w - 1]) s.box(x, 2, 2, x, windowTop, d - 3, C.sky);
  s.box(doorX, 2, 0, doorX + 1, windowTop, 0, C.sky);
  // 창문 밑 꽃 상자 (앞)
  for (const x of [1, w - 2]) s.set(x, 1, d, x === 1 ? C.coral : C.yellow);
  gableRoof(s, { x0: -1, x1: w, z0: 0, z1: d - 1, y: wallH + 1, roof, ridge, gable: wall, gableX: [0, w - 1] });
  // 굴뚝 (지붕 뒤쪽 비탈 위)
  const top = roofHeightAt(1, d);
  s.box(chimney, wallH + 1 + top, 1, chimney, wallH + 3 + top, 1, C.darkRed);
  s.set(chimney, wallH + 4 + top, 1, C.darkGray);
  return { name, w, d, voxels: s.voxels() };
}

// ── 높은 탑: 돌탑 + 넓은 망루 + 뾰족 지붕 + 깃발 ──
function makeTower() {
  const s = createShape();
  const H = 10;
  s.walls(0, 0, 0, 4, H, 4, C.gray);
  s.walls(0, 0, 0, 4, 0, 4, C.darkGray);
  for (const [x, z] of [[0, 0], [4, 0], [0, 4], [4, 4]]) s.box(x, 0, z, x, H, z, C.darkGray);
  s.box(2, 0, 4, 2, 2, 4, C.brown); // 문
  for (const y of [5, 8]) {
    s.set(2, y, 4, C.black); // 좁은 창
    s.set(0, y - 1, 2, C.black);
    s.set(4, y - 1, 2, C.black);
  }
  // 망루 바닥 (탑보다 한 칸씩 넓게) 과 톱니 난간
  s.box(-1, H + 1, -1, 5, H + 1, 5, C.darkGray);
  for (let i = -1; i <= 5; i++) {
    if ((i + 1) % 2 === 0) {
      s.set(i, H + 2, -1, C.gray);
      s.set(i, H + 2, 5, C.gray);
      s.set(-1, H + 2, i, C.gray);
      s.set(5, H + 2, i, C.gray);
    }
  }
  // 뾰족 지붕
  s.walls(1, H + 2, 1, 3, H + 3, 3, C.gray);
  s.box(0, H + 4, 0, 4, H + 4, 4, C.blue);
  s.box(1, H + 5, 1, 3, H + 5, 3, C.blue);
  s.box(2, H + 6, 2, 2, H + 7, 2, C.navy);
  // 깃발
  s.box(2, H + 8, 2, 2, H + 10, 2, C.darkGray);
  s.box(3, H + 9, 2, 4, H + 10, 2, C.red);
  return { name: '높은 탑', w: 5, d: 5, voxels: s.voxels() };
}

// ── 가게: 큰 진열창 + 줄무늬 차양 + 지붕 위 간판 ──
function makeShop() {
  const s = createShape();
  const w = 9;
  const d = 6;
  s.walls(0, 0, 0, w - 1, 0, d - 1, C.gray);
  s.walls(0, 1, 0, w - 1, 5, d - 1, C.sky);
  for (const [x, z] of [[0, 0], [w - 1, 0], [0, d - 1], [w - 1, d - 1]]) s.box(x, 1, z, x, 5, z, C.white);
  s.box(1, 2, d - 1, 4, 3, d - 1, C.white); // 진열창 틀
  s.box(1, 2, d - 1, 4, 3, d - 1, C.midBlue);
  s.set(2, 2, d - 1, C.yellow); // 진열창 안 물건
  s.set(3, 2, d - 1, C.coral);
  s.box(6, 0, d - 1, 6, 2, d - 1, C.brown); // 문
  s.set(6, 0, d, C.sand);
  for (const x of [0, w - 1]) s.box(x, 2, 2, x, 3, 3, C.midBlue);
  // 줄무늬 차양 (앞으로 두 칸)
  for (let x = 0; x < w; x++) {
    const hex = x % 2 === 0 ? C.red : C.white;
    s.set(x, 4, d, hex);
    s.set(x, 4, d + 1, hex);
  }
  // 평평한 지붕 + 난간 + 간판
  s.box(0, 6, 0, w - 1, 6, d - 1, C.white);
  s.walls(0, 7, 0, w - 1, 7, d - 1, C.sand);
  s.box(2, 7, d - 1, 6, 9, d - 1, C.yellow);
  s.box(3, 8, d - 1, 5, 8, d - 1, C.red);
  return { name: '가게', w, d, voxels: s.voxels() };
}

// ── 마을 회관: 가장 큰 건물. 기둥 현관 + 파란 지붕 + 가운데 시계탑 ──
function makeHall() {
  const s = createShape();
  const w = 13;
  const d = 8;
  const H = 5;
  s.walls(0, 0, 0, w - 1, 0, d - 1, C.darkGray);
  s.walls(0, 1, 0, w - 1, H, d - 1, C.sand);
  for (const x of [0, 4, 8, w - 1]) for (const z of [0, d - 1]) s.box(x, 1, z, x, H, z, C.white);
  // 창문 (앞·뒤·옆)
  for (const x of [2, 10]) {
    s.box(x, 2, d - 1, x, 4, d - 1, C.sky);
    s.box(x, 2, 0, x, 4, 0, C.sky);
  }
  for (const x of [0, w - 1]) s.box(x, 2, 2, x, 4, d - 3, C.sky);
  // 큰 문 + 계단 + 기둥 현관
  s.box(5, 0, d - 1, 7, 3, d - 1, C.darkRed);
  s.set(6, 4, d - 1, C.yellow);
  s.box(4, 0, d, 8, 0, d + 1, C.gray);
  for (const x of [4, 8]) s.box(x, 1, d + 1, x, 4, d + 1, C.white);
  s.box(4, 5, d, 8, 5, d + 1, C.white);
  s.box(5, 6, d, 7, 6, d, C.blue);
  // 지붕 (두 층 계단 + 평평한 꼭대기)
  s.walls(-1, H + 1, -1, w, H + 1, d, C.blue);
  s.walls(0, H + 1, 0, w - 1, H + 1, d - 1, C.blue);
  s.walls(0, H + 2, 0, w - 1, H + 2, d - 1, C.blue);
  s.walls(1, H + 2, 1, w - 2, H + 2, d - 2, C.blue);
  s.box(1, H + 3, 1, w - 2, H + 3, d - 2, C.navy);
  // 시계탑
  s.walls(5, H + 4, 3, 7, H + 7, 5, C.white);
  s.set(6, H + 6, 5, C.yellow); // 시계
  s.set(6, H + 5, 5, C.black);
  s.box(4, H + 8, 2, 8, H + 8, 6, C.blue);
  s.box(5, H + 9, 3, 7, H + 9, 5, C.blue);
  s.box(6, H + 10, 4, 6, H + 12, 4, C.yellow);
  s.box(7, H + 11, 4, 8, H + 12, 4, C.coral); // 깃발
  return { name: '마을 회관', w, d, voxels: s.voxels() };
}

// ── 풍차: 통통한 몸통 + 빨간 모자 + 빙글빙글 도는 날개 ──
function makeWindmill() {
  const s = createShape();
  const ring = (y, hex) => {
    s.walls(0, y, 0, 4, y, 4, hex);
    for (const [x, z] of [[0, 0], [4, 0], [0, 4], [4, 4]]) s.set(x, y, z, null); // 모서리를 깎아 둥글게
    for (const [x, z] of [[1, 1], [3, 1], [1, 3], [3, 3]]) s.set(x, y, z, hex);
  };
  ring(0, C.darkGray);
  for (let y = 1; y <= 5; y++) ring(y, C.white);
  s.box(2, 0, 4, 2, 2, 4, C.brown); // 문
  s.set(2, 4, 4, C.sky);
  s.set(0, 3, 2, C.sky);
  s.set(4, 3, 2, C.sky);
  s.box(1, 6, 1, 3, 6, 3, C.sand); // 가운데 바닥
  ring(6, C.sand);
  s.walls(1, 7, 1, 3, 10, 3, C.white);
  s.set(2, 8, 1, C.sky);
  // 모자
  s.box(0, 11, 1, 4, 11, 3, C.red);
  s.box(1, 11, 0, 3, 11, 4, C.red);
  s.box(1, 12, 1, 3, 12, 3, C.red);
  s.set(2, 13, 2, C.darkRed);
  // 날개 축 (몸통 앞으로 나옴)
  s.set(2, 9, 4, C.darkGray);
  const anchor = [2, 9, 4];
  // 날개 (z = 5 판 위, 축을 가운데로 십자 모양)
  const blades = createShape();
  blades.set(0, 0, 0, C.yellow);
  for (let r = 1; r <= 5; r++) {
    for (const [ax, ay, bx, by] of [[0, 1, 1, 0], [1, 0, 0, -1], [0, -1, -1, 0], [-1, 0, 0, 1]]) {
      blades.set(ax * r, ay * r, 0, C.brown);
      if (r >= 2) blades.set(ax * r + bx, ay * r + by, 0, r % 2 ? C.white : C.sand);
    }
  }
  const rotor = { voxels: blades.voxels(), pivot: [2, 9, 5], anchor, speed: 1.1 };
  return { name: '풍차', w: 5, d: 5, voxels: s.voxels(), rotor };
}

// ── 우물: 돌 테두리 + 물 + 작은 지붕 + 두레박 ──
function makeWell() {
  const s = createShape();
  s.walls(0, 0, 0, 2, 1, 2, C.gray);
  s.set(1, 0, 1, C.midBlue);
  for (const [x, z] of [[0, 0], [2, 2]]) s.set(x, 1, z, C.darkGray);
  for (const x of [0, 2]) s.box(x, 2, 1, x, 4, 1, C.brown);
  s.box(-1, 5, 0, 3, 5, 2, C.red);
  s.box(-1, 6, 1, 3, 6, 1, C.darkRed);
  s.set(1, 4, 1, C.caramel); // 줄
  s.set(1, 3, 1, C.darkGray); // 두레박
  return { name: '우물', w: 3, d: 3, voxels: s.voxels() };
}
