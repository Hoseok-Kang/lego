// 왕궁 성곽 건물 그림 (성문, 성벽, 모서리 탑, 둥근 탑, 왕궁, 병영, 보물 창고, 분수, 황금 왕 동상)
// 돌 블록이 많아 튼튼해 보이고 (마을 설정의 hpPerBlock 으로 실제로도 더 단단함), 꼭대기는 톱니 난간·깃발로 장식합니다.
// 칸 좌표: x 0 ~ w-1 (오른쪽), z 0 ~ d-1 (앞 = 카메라 쪽), y 0 = 바닥 층. 모든 블록은 바닥까지 이어져 있어야 합니다.
//
//   CASTLE_MAKERS: { 종류: () => { name, w, d, voxels } }   (buildingArt.js 의 makeBuilding 이 씀)
//   종류: gatehouse(성문) wallX / wallZ(성벽, 가로·세로) towerSquare(모서리 탑) towerRound(둥근 탑)
//        palace(왕궁) barracks(병영) treasury(보물 창고) fountain(분수) statue(황금 왕 동상)
//
// 크기·색을 바꾸려면 각 함수 안 숫자를 고치세요. (색은 artKit.js 의 C = js/bricks/brickColors.js 의 색만)

import { createShape } from './voxelShape.js';
import { C, gableRoof, battlements } from './artKit.js';

const STONE = C.gray;
const DARK = C.darkGray;
const WALL_LEN = 9; // 성벽 한 토막 길이
const WALL_H = 5; // 성벽 높이 (난간 빼고)

export const CASTLE_MAKERS = {
  gatehouse: makeGatehouse,
  wallX: () => makeWall(false),
  wallZ: () => makeWall(true),
  towerSquare: makeSquareTower,
  towerRound: makeRoundTower,
  palace: makePalace,
  barracks: makeBarracks,
  treasury: makeTreasury,
  fountain: makeFountain,
  statue: makeStatue,
};

// 빨간 깃발 하나 (막대 + 천) — (x, y, z) 가 막대 밑
function flag(s, x, y, z, hex = C.red) {
  s.box(x, y, z, x, y + 3, z, DARK);
  s.box(x + 1, y + 2, z, x + 2, y + 3, z, hex);
}

// ── 성문: 두 탑 사이 아치, 쇠창살 문, 탑마다 걸린 깃발 천. 길(x 방향)이 가운데를 지나감 ──
function makeGatehouse() {
  const s = createShape();
  const w = 6;
  const d = 10;
  const H = 8;
  for (const [z0, z1] of [[0, 2], [7, 9]]) {
    s.walls(0, 0, z0, w - 1, H, z1, STONE);
    s.walls(0, 0, z0, w - 1, 0, z1, DARK);
    s.box(0, H + 1, z0, w - 1, H + 1, z1, DARK);
    battlements(s, 0, z0, w - 1, z1, H + 2, STONE);
    for (const y of [3, 6]) s.set(0, y, z0 + 1, C.black); // 화살 구멍
  }
  // 아치 (문 위를 잇는 다리) + 난간
  s.box(0, 5, 3, w - 1, 6, 6, STONE);
  s.box(0, 5, 3, w - 1, 5, 6, DARK);
  battlements(s, 0, 3, w - 1, 6, 7, STONE);
  // 쇠창살 문 (바깥쪽 x = 0)
  for (let z = 3; z <= 6; z++) for (let y = 0; y <= 4; y++) if (z % 2 === 1 || y === 2) s.set(0, y, z, C.black);
  // 앞 탑의 깃발 천 (카메라 쪽 면)
  s.box(2, 4, d, 3, 7, d, C.red);
  s.box(2, 6, d, 3, 6, d, C.yellow);
  s.set(2, 3, d, C.red);
  s.box(2, 4, 0 - 1, 3, 7, -1, C.blue);
  flag(s, 1, H + 2, 8, C.yellow);
  return { name: '성문', w, d, voxels: s.voxels() };
}

// ── 성벽 한 토막: 두꺼운 돌벽 + 톱니 난간 + 화살 구멍 + 가운데 깃발 천 ──
function makeWall(alongZ) {
  const s = createShape();
  const L = WALL_LEN;
  // x 방향으로 만든 뒤, 세로 성벽이면 x·z 를 바꿔 놓음
  s.box(0, 0, 0, L - 1, 0, 1, DARK);
  s.box(0, 1, 0, L - 1, WALL_H, 1, STONE);
  for (let x = 0; x < L; x += 3) s.box(x, 1, 1, x, 1, 1, DARK); // 아래 띠 무늬
  for (const x of [2, 6]) s.set(x, 3, 1, C.black);
  battlements(s, 0, 0, L - 1, 1, WALL_H + 1, STONE);
  s.box(4, 2, 2, 4, 4, 2, C.red); // 깃발 천
  s.set(4, 3, 2, C.yellow);
  const voxels = s.voxels();
  if (!alongZ) return { name: '성벽', w: L, d: 3, voxels: voxels.map((v) => ({ ...v })) };
  return { name: '성벽', w: 3, d: L, voxels: voxels.map((v) => ({ x: 2 - v.z, y: v.y, z: v.x, hex: v.hex })) };
}

// ── 모서리 탑: 네모 돌탑 + 넓은 꼭대기 + 파란 뾰족 지붕 + 깃발 ──
function makeSquareTower() {
  const s = createShape();
  const n = 6;
  const H = 10;
  s.walls(0, 0, 0, n - 1, H, n - 1, STONE);
  s.walls(0, 0, 0, n - 1, 0, n - 1, DARK);
  for (const [x, z] of [[0, 0], [n - 1, 0], [0, n - 1], [n - 1, n - 1]]) s.box(x, 1, z, x, H, z, DARK);
  for (const y of [3, 7]) {
    s.box(2, y, n - 1, 3, y + 1, n - 1, C.black);
    s.set(0, y, 2, C.black);
    s.set(n - 1, y, 3, C.black);
  }
  s.box(-1, H + 1, -1, n, H + 1, n, DARK);
  battlements(s, -1, -1, n, n, H + 2, STONE);
  s.walls(1, H + 2, 1, n - 2, H + 3, n - 2, STONE);
  for (let k = 0; k < 3; k++) s.box(k, H + 4 + k, k, n - 1 - k, H + 4 + k, n - 1 - k, k === 2 ? C.navy : C.blue);
  flag(s, 2, H + 7, 2);
  return { name: '모서리 탑', w: n, d: n, voxels: s.voxels() };
}

// ── 둥근 탑: 동글게 깎은 돌탑 + 빨간 고깔 지붕 ──
function makeRoundTower() {
  const s = createShape();
  const ring = (y, hex) => {
    s.walls(0, y, 0, 4, y, 4, hex);
    for (const [x, z] of [[0, 0], [4, 0], [0, 4], [4, 4]]) s.set(x, y, z, null);
    for (const [x, z] of [[1, 1], [3, 1], [1, 3], [3, 3]]) s.set(x, y, z, hex);
  };
  const H = 9;
  ring(0, DARK);
  for (let y = 1; y <= H; y++) ring(y, y % 4 === 0 ? C.darkSand : STONE);
  for (const y of [3, 6]) s.set(2, y, 4, C.black);
  s.box(2, 0, 4, 2, 1, 4, C.brown);
  s.box(-1, H + 1, 0, 5, H + 1, 4, DARK);
  s.box(0, H + 1, -1, 4, H + 1, 5, DARK);
  s.box(0, H + 2, 0, 4, H + 2, 4, C.red);
  s.box(1, H + 3, 1, 3, H + 4, 3, C.red);
  s.box(2, H + 5, 2, 2, H + 5, 2, C.darkRed);
  flag(s, 2, H + 6, 2, C.yellow);
  return { name: '둥근 탑', w: 5, d: 5, voxels: s.voxels() };
}

// ── 왕궁: 가장 큰 건물. 흰 벽 + 금 장식, 기둥 현관과 계단, 가운데 높은 본채와 파란 지붕, 금관, 앞 모서리 작은 첨탑 ──
function makePalace() {
  const s = createShape();
  const w = 17;
  const d = 11;
  const H = 6;
  s.walls(0, 0, 0, w - 1, 0, d - 1, DARK);
  s.walls(0, 1, 0, w - 1, H, d - 1, C.cream);
  s.walls(0, H, 0, w - 1, H, d - 1, C.yellow); // 금 띠
  for (const x of [0, 4, 12, w - 1]) for (const z of [0, d - 1]) s.box(x, 1, z, x, H - 1, z, C.white);
  for (const x of [2, 14]) {
    s.box(x, 2, d - 1, x, 4, d - 1, C.sky);
    s.set(x, 5, d - 1, C.yellow);
  }
  for (const x of [0, w - 1]) s.box(x, 2, 3, x, 4, d - 4, C.sky);
  // 큰 문 + 계단 + 기둥 현관
  s.box(7, 0, d - 1, 9, 4, d - 1, C.darkRed);
  s.set(8, 5, d - 1, C.yellow);
  s.box(5, 0, d, 11, 0, d + 1, C.white);
  s.box(6, 0, d + 2, 10, 0, d + 2, C.gray);
  for (const x of [5, 11]) s.box(x, 1, d + 1, x, H - 1, d + 1, C.white);
  s.box(5, H, d, 11, H, d + 1, C.yellow);
  s.box(6, H + 1, d, 10, H + 1, d, C.white);
  s.set(8, H + 2, d, C.red);
  // 지붕 (평평) + 난간
  s.box(0, H + 1, 0, w - 1, H + 1, d - 1, C.white);
  battlements(s, 0, 0, w - 1, d - 1, H + 2, C.white);
  // 가운데 본채 (한 층 높게) + 파란 지붕 + 금관
  const kx0 = 5;
  const kx1 = 11;
  s.walls(kx0, H + 2, 2, kx1, H + 6, 7, C.cream);
  s.walls(kx0, H + 6, 2, kx1, H + 6, 7, C.yellow);
  for (const x of [7, 9]) s.box(x, H + 3, 7, x, H + 5, 7, C.sky);
  s.set(8, H + 4, 7, C.yellow);
  gableRoof(s, { x0: kx0 - 1, x1: kx1 + 1, z0: 2, z1: 7, y: H + 7, roof: C.blue, ridge: C.navy, gable: C.cream, gableX: [kx0, kx1] });
  const ridgeY = H + 7 + 3;
  s.box(7, ridgeY + 1, 4, 9, ridgeY + 1, 5, C.yellow); // 금관
  for (const x of [7, 9]) s.set(x, ridgeY + 2, 4, C.lightYellow);
  s.set(8, ridgeY + 2, 4, C.red); // 왕관 보석
  s.set(8, ridgeY + 3, 4, C.lightYellow);
  // 앞 모서리 작은 첨탑 둘
  for (const x of [1, w - 2]) {
    s.box(x - 1, H + 2, d - 3, x + 1, H + 4, d - 1, C.white);
    s.box(x - 1, H + 5, d - 3, x + 1, H + 5, d - 1, C.red);
    s.box(x, H + 6, d - 2, x, H + 7, d - 2, C.red);
    flag(s, x, H + 8, d - 2, C.yellow);
  }
  return { name: '왕궁', w, d, voxels: s.voxels() };
}

// ── 병영: 돌 아래층 + 나무 위층 + 빨간 지붕, 앞에 걸린 방패, 옆 창 걸이 ──
function makeBarracks() {
  const s = createShape();
  const w = 10;
  const d = 6;
  s.walls(0, 0, 0, w - 1, 2, d - 1, STONE);
  s.walls(0, 0, 0, w - 1, 0, d - 1, DARK);
  s.walls(0, 3, 0, w - 1, 5, d - 1, C.caramel);
  for (const [x, z] of [[0, 0], [w - 1, 0], [0, d - 1], [w - 1, d - 1]]) s.box(x, 3, z, x, 5, z, C.brown);
  s.box(4, 0, d - 1, 5, 2, d - 1, C.brown);
  for (const x of [1, 8]) s.box(x, 1, d - 1, x, 1, d - 1, C.black);
  for (const x of [2, 7]) s.box(x, 4, d - 1, x, 4, d - 1, C.sky);
  // 방패 둘 (파랑·노랑)
  for (const [x, hex] of [[1, C.blue], [7, C.yellow]]) {
    s.box(x, 3, d, x + 1, 4, d, hex);
    s.set(x, 4, d, C.white);
  }
  gableRoof(s, { x0: -1, x1: w, z0: 0, z1: d - 1, y: 6, roof: C.red, ridge: C.darkRed, gable: C.caramel, gableX: [0, w - 1] });
  // 창 걸이 (옆)
  s.box(w, 0, 2, w, 0, 3, C.brown);
  for (const z of [2, 3]) {
    s.box(w, 1, z, w, 4, z, C.brown);
    s.set(w, 5, z, C.white);
  }
  return { name: '병영', w, d, voxels: s.voxels() };
}

// ── 보물 창고: 두꺼운 돌 + 쇠문, 지붕 위에 쌓인 금화 더미 ──
function makeTreasury() {
  const s = createShape();
  const w = 7;
  const d = 6;
  s.walls(0, 0, 0, w - 1, 4, d - 1, STONE);
  s.walls(0, 0, 0, w - 1, 0, d - 1, DARK);
  for (const [x, z] of [[0, 0], [w - 1, 0], [0, d - 1], [w - 1, d - 1]]) s.box(x, 0, z, x, 5, z, DARK);
  s.box(2, 0, d - 1, 4, 3, d - 1, C.darkGray);
  s.box(3, 1, d - 1, 3, 2, d - 1, C.yellow); // 자물쇠
  s.box(0, 5, 0, w - 1, 5, d - 1, STONE);
  // 금화 더미 (계단 모양 언덕)
  s.box(1, 6, 1, w - 2, 6, d - 2, C.yellow);
  s.box(2, 7, 2, w - 3, 7, d - 3, C.yellow);
  s.set(3, 8, 2, C.lightYellow);
  s.set(3, 8, 3, C.yellow);
  for (const [x, z] of [[1, 1], [5, 4], [2, 3], [4, 2]]) s.set(x, 7 - (x === 1 || x === 5 ? 1 : 0), z, C.tangerine);
  s.set(2, 7, 2, C.red); // 보석
  s.set(4, 7, 3, C.deepSky);
  return { name: '보물 창고', w, d, voxels: s.voxels() };
}

// ── 분수: 돌 테두리 + 물 + 가운데 기둥에서 솟는 물줄기 ──
function makeFountain() {
  const s = createShape();
  s.walls(0, 0, 0, 4, 1, 4, C.white);
  s.box(1, 0, 1, 3, 0, 3, C.deepSky);
  s.box(2, 1, 2, 2, 3, 2, STONE);
  s.box(1, 4, 1, 3, 4, 3, C.white);
  s.set(2, 5, 2, C.sky);
  s.set(2, 6, 2, C.sky);
  for (const [x, z] of [[1, 2], [3, 2], [2, 1], [2, 3]]) s.set(x, 5, z, C.sky);
  return { name: '분수', w: 5, d: 5, voxels: s.voxels() };
}

// ── 황금 왕 동상: 돌 받침 위 금빛 왕 (빨간 망토, 왕관, 홀) ──
function makeStatue() {
  const s = createShape();
  s.box(0, 0, 0, 4, 0, 4, DARK);
  s.box(1, 1, 1, 3, 1, 3, STONE);
  s.set(2, 1, 4, C.yellow); // 이름판
  s.box(1, 2, 2, 3, 3, 2, C.yellow); // 다리·옷자락
  s.box(1, 2, 1, 3, 6, 1, C.red); // 망토 (뒤)
  s.box(1, 4, 2, 3, 6, 2, C.yellow); // 몸
  s.box(0, 5, 2, 0, 5, 2, C.yellow); // 팔
  s.box(4, 5, 2, 4, 5, 2, C.yellow);
  s.box(4, 6, 2, 4, 8, 2, C.tangerine); // 홀
  s.set(4, 9, 2, C.red);
  s.box(1, 7, 1, 3, 8, 2, C.yellow); // 머리
  s.set(1, 8, 3, C.yellow);
  s.set(3, 8, 3, C.yellow);
  s.box(1, 7, 3, 3, 7, 3, C.yellow); // 얼굴
  for (const x of [1, 2, 3]) s.set(x, 9, 2, x === 2 ? C.red : C.lightYellow); // 왕관
  s.set(2, 9, 1, C.lightYellow);
  return { name: '황금 왕 동상', w: 5, d: 5, voxels: s.voxels() };
}
