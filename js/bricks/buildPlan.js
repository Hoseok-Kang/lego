// 쌓기 계획
// 색이 정해진 격자를 '블록 목록'으로 바꾸고, 어떤 순서로 쌓을지 정합니다.
// 맨 아랫줄부터 위로 한 줄씩 쌓고, 한 줄 안의 순서는 order 설정을 따릅니다.
//
// 결과: {
//   columns, rows, depth,
//   blocks: [{ x, y, z, colorIndex }, ...]   ← 쌓는 순서대로 (y = 0 이 맨 아래)
//   colorCounts: [{ colorIndex, count }, ...] ← 색별 블록 개수 (많은 순)
// }
// 나중에 게임을 만들 때도 이 '블록 목록'을 그대로 쓸 수 있습니다.

export const BUILD_ORDERS = {
  random: '랜덤',
  leftToRight: '왼쪽부터',
  centerOut: '가운데부터',
  snake: '지그재그',
};

export function createBuildPlan(colorGrid, { order = 'random', depth = 1, seed = 7 } = {}) {
  const { columns, rows, cells } = colorGrid;
  const random = createRandom(seed);
  const blocks = [];
  const counts = new Map();

  for (let y = 0; y < rows; y++) {
    const rowFromTop = rows - 1 - y;
    const rowBlocks = [];
    for (let x = 0; x < columns; x++) {
      const colorIndex = cells[rowFromTop * columns + x];
      if (colorIndex === null || colorIndex === undefined) continue;
      for (let z = 0; z < depth; z++) rowBlocks.push({ x, y, z, colorIndex });
      counts.set(colorIndex, (counts.get(colorIndex) ?? 0) + depth);
    }
    sortRow(rowBlocks, order, y, columns, random);
    blocks.push(...rowBlocks);
  }

  const colorCounts = Array.from(counts, ([colorIndex, count]) => ({ colorIndex, count })).sort(
    (a, b) => b.count - a.count,
  );
  return { columns, rows, depth, blocks, colorCounts };
}

function sortRow(rowBlocks, order, y, columns, random) {
  const center = (columns - 1) / 2;
  switch (order) {
    case 'leftToRight':
      rowBlocks.sort((a, b) => a.x - b.x || b.z - a.z);
      break;
    case 'centerOut':
      rowBlocks.sort((a, b) => Math.abs(a.x - center) - Math.abs(b.x - center) || b.z - a.z);
      break;
    case 'snake':
      rowBlocks.sort((a, b) => (y % 2 === 0 ? a.x - b.x : b.x - a.x) || b.z - a.z);
      break;
    default:
      shuffle(rowBlocks, random);
  }
}

function shuffle(list, random) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
}

// 매번 같은 순서가 나오는 난수 (같은 그림이면 같은 모습으로 쌓임)
function createRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
