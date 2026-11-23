// 마을 꾸미기 소품 그림 (나무, 울타리, 가로등, 덤불 + 바닷가·성곽 소품)
// 건물과 같은 칸 좌표를 씁니다 (x 오른쪽, y 위, z 앞). 소품은 돈이 되지 않지만 밟히거나 맞으면 블록으로 흩어집니다.
//
//   makeDecor(kind, 옵션) → { kind, voxels: [{ x, y, z, hex }] }
//   종류: treeRound(동글 나무), treePine(뾰족 나무), bush(덤불), lamp(가로등),
//        fenceX / fenceZ (울타리, 옵션 { length })
//        바닷가: barrel(나무통) crates(상자 더미) buoy(부표) rock(바위) netRack(그물 걸이) anchor(닻)
//        성곽: hedgeX / hedgeZ (생울타리, { length }) flowerBed(꽃밭) torch(횃불) banner(깃발 장대)

import { createShape } from './voxelShape.js';

const BROWN = '#582A12';
const GREEN = '#4B9F4A';
const DARK_GREEN = '#237841';
const LIME = '#BBE90B';
const WHITE = '#F4F4F4';
const DARK_GRAY = '#6C6E68';
const BLACK = '#1B2A34';
const YELLOW = '#FFF03A';
const CORAL = '#FF698F';
const RED = '#C91A09';
const CARAMEL = '#AA7D55';
const DARK_ORANGE = '#A95500';
const TANGERINE = '#F8BB3D';
const GRAY = '#A0A5A9';
const ORANGE = '#FE8A18';
const LAVENDER = '#AC78BA';
const BLUE = '#0055BF';

const plus = (s, y, hex) => {
  for (const [x, z] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) s.set(x, y, z, hex);
};

const MAKERS = {
  treeRound() {
    const s = createShape();
    s.box(0, 0, 0, 0, 2, 0, BROWN);
    plus(s, 3, GREEN);
    s.box(-1, 4, -1, 1, 5, 1, GREEN);
    plus(s, 6, GREEN);
    for (const [x, y, z] of [[1, 5, 1], [-1, 4, 1], [0, 6, 1], [1, 4, -1]]) s.set(x, y, z, LIME);
    s.set(-1, 5, 1, RED); // 사과
    return s;
  },
  treePine() {
    const s = createShape();
    s.box(0, 0, 0, 0, 1, 0, BROWN);
    s.box(-1, 2, -1, 1, 2, 1, DARK_GREEN);
    plus(s, 3, DARK_GREEN);
    s.box(-1, 4, -1, 1, 4, 1, DARK_GREEN);
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) s.set(x, 4, z, null);
    plus(s, 4, GREEN);
    s.box(0, 5, 0, 0, 6, 0, GREEN);
    return s;
  },
  bush() {
    const s = createShape();
    s.box(0, 0, 0, 1, 0, 0, GREEN);
    s.set(0, 1, 0, LIME);
    s.set(1, 1, 0, CORAL);
    return s;
  },
  lamp() {
    const s = createShape();
    s.set(0, 0, 0, BLACK);
    s.box(0, 1, 0, 0, 3, 0, DARK_GRAY);
    s.set(0, 4, 0, YELLOW);
    return s;
  },
  fenceX({ length = 5 } = {}) {
    const s = createShape();
    for (let i = 0; i < length; i++) {
      s.set(i, 0, 0, WHITE);
      if (i % 2 === 0) s.set(i, 1, 0, WHITE);
    }
    return s;
  },
  fenceZ({ length = 5 } = {}) {
    const s = createShape();
    for (let i = 0; i < length; i++) {
      s.set(0, 0, i, WHITE);
      if (i % 2 === 0) s.set(0, 1, i, WHITE);
    }
    return s;
  },
};

// ── 바닷가 소품 ──
Object.assign(MAKERS, {
  barrel() {
    const s = createShape();
    s.set(0, 0, 0, DARK_ORANGE);
    s.set(0, 1, 0, CARAMEL);
    s.set(1, 0, 0, CARAMEL);
    return s;
  },
  crates() {
    const s = createShape();
    s.box(0, 0, 0, 1, 0, 0, TANGERINE);
    s.set(0, 1, 0, DARK_ORANGE);
    return s;
  },
  buoy() {
    const s = createShape();
    s.set(0, 0, 0, RED);
    s.set(0, 1, 0, WHITE);
    s.set(0, 2, 0, RED);
    return s;
  },
  rock() {
    const s = createShape();
    s.box(0, 0, 0, 1, 0, 1, GRAY);
    s.set(0, 1, 0, DARK_GRAY);
    s.set(1, 1, 1, GRAY);
    return s;
  },
  netRack() {
    const s = createShape();
    for (const x of [0, 3]) s.box(x, 0, 0, x, 2, 0, BROWN);
    for (let x = 1; x <= 2; x++) for (let y = 1; y <= 2; y++) s.set(x, y, 0, (x + y) % 2 ? DARK_GREEN : GREEN);
    return s;
  },
  anchor() {
    const s = createShape();
    s.box(0, 0, 0, 0, 3, 0, DARK_GRAY);
    s.set(-1, 0, 0, DARK_GRAY);
    s.set(1, 0, 0, DARK_GRAY);
    s.set(-1, 1, 0, DARK_GRAY);
    s.set(1, 1, 0, DARK_GRAY);
    s.box(-1, 3, 0, 1, 3, 0, DARK_GRAY);
    return s;
  },
  // ── 성곽 소품 ──
  hedgeX({ length = 5 } = {}) {
    const s = createShape();
    s.box(0, 0, 0, length - 1, 1, 0, DARK_GREEN);
    for (let i = 0; i < length; i += 2) s.set(i, 1, 0, GREEN);
    return s;
  },
  hedgeZ({ length = 5 } = {}) {
    const s = createShape();
    s.box(0, 0, 0, 0, 1, length - 1, DARK_GREEN);
    for (let i = 0; i < length; i += 2) s.set(0, 1, i, GREEN);
    return s;
  },
  flowerBed() {
    const s = createShape();
    s.box(0, 0, 0, 2, 0, 1, BROWN);
    const petals = [CORAL, YELLOW, LAVENDER, RED, WHITE, CORAL];
    for (let x = 0; x <= 2; x++) for (let z = 0; z <= 1; z++) s.set(x, 1, z, petals[x * 2 + z]);
    return s;
  },
  torch() {
    const s = createShape();
    s.box(0, 0, 0, 0, 2, 0, DARK_GRAY);
    s.set(0, 3, 0, ORANGE);
    s.set(0, 4, 0, YELLOW);
    return s;
  },
  banner() {
    const s = createShape();
    s.box(0, 0, 0, 0, 5, 0, DARK_GRAY);
    s.box(1, 3, 0, 2, 5, 0, BLUE);
    s.set(1, 4, 0, YELLOW);
    return s;
  },
});

export function makeDecor(kind, options) {
  const maker = MAKERS[kind];
  if (!maker) throw new Error(`모르는 소품 종류: ${kind}`);
  return { kind, voxels: maker(options).voxels() };
}
