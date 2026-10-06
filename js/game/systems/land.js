// 땅 (넓어지는 바닥판)
// 웨이브를 막을 때마다 바닥판 둘레에 잔디 블록이 시계 바늘처럼 빙 돌아가며 떨어져 쌓이고,
// 다 쌓이면 바닥판을 그만큼 키워서 이음매 없이 이어 붙입니다. 땅이 넓어지면 몬스터도 더 멀리서 나타납니다.
// 몇 칸에서 시작해 몇 칸씩 넓어지는지는 gameConfig.js 의 arena 에서 바꿉니다.
//
//   const land = createLand({ scene, stage, events, config })
//   land.size           지금 땅 한 변 칸 수
//   land.spawnRadius    몬스터가 나타나는 거리 (= 땅 절반 - arena.spawnMargin)
//   land.nextSize       다음에 넓어지면 될 크기 (넓어지는 중이면 그 목표 크기, 가장 넓으면 null)
//   land.isGrowing      넓어지는 모션 중인지
//   land.grow()         땅 넓히기 시작 → 'landGrowStarted' { from, to } 소식, 다 쌓이면 'landGrown' 소식
//                       (가장 넓거나 이미 넓어지는 중이면 아무것도 안 하고 false)
//   land.update(dt)     매 장면마다 불러서 쌓기 모션 진행
//   land.reset()        모션 없이 바로 처음 크기로 (다시 하기) → 'landGrown' 소식
//
// 'landGrown' 소식 내용: { size, previousSize, spawnRadius }

import { BlockFigure } from '../core/blockFigure.js';
import { getVoxelBlueprint } from '../core/blueprints.js';

// ── 바꿔도 되는 숫자 ──
const RING_DROP_HEIGHT = 6; // 둘레 블록이 몇 칸 위에서 떨어지는지
const RING_LAYER = -1; // 둘레 블록이 놓이는 층 (-1 = 바닥판과 같은 높이: 윗면이 땅 높이 0)
const SWEEP_START_DEG = 0; // 쌓기 시작하는 방향 (0 = 처음 카메라 기준 화면 위쪽, 90 = 오른쪽)
const SWEEP_JITTER_DEG = 4; // 시계 바늘 앞쪽이 살짝 들쭉날쭉하게 (0이면 칼같이 반듯)

const TWO_PI = Math.PI * 2;
const DEG = Math.PI / 180;

export function createLand({ scene, stage, events, config }) {
  const arena = config.arena;
  const startSize = evenSize(arena.startSize);
  const maxSize = Math.max(startSize, evenSize(arena.maxSize));
  // 늘 짝수만큼 넓어져야 바닥판 돌기 줄이 맞음
  const step = Math.max(2, evenSize(arena.growthPerWave));

  let size = startSize;
  let growth = null; // 넓어지는 중: { from, to, figure, done }
  if (stage.arenaSize !== size) stage.setArenaSize(size);

  function spawnRadiusFor(landSize) {
    return landSize / 2 - arena.spawnMargin;
  }

  function grow() {
    if (growth || size >= maxSize) return false;
    const from = size;
    const to = Math.min(maxSize, size + step);
    events.emit('landGrowStarted', { from, to });
    const blueprint = getVoxelBlueprint(`land-ring|${from}|${to}|${arena.groundColor}`, ringVoxels(from, to, arena.groundColor));
    const figure = new BlockFigure(blueprint, scene);
    growth = { from, to, figure, done: false };
    figure.build(arena.growSeconds, {
      dropHeight: RING_DROP_HEIGHT,
      onLand: () => events.emit('blockLanded'),
      onComplete: () => {
        if (growth?.figure === figure) growth.done = true;
      },
    });
    return true;
  }

  // 다 쌓인 둘레를 바닥판으로 바꿔치기 (같은 장면 안에서 바꿔서 깜빡이지 않음)
  function finishGrowth() {
    const { from, to, figure } = growth;
    growth = null;
    stage.setArenaSize(to);
    figure.dispose();
    size = to;
    events.emit('landGrown', { size, previousSize: from, spawnRadius: spawnRadiusFor(size) });
  }

  function update(dt) {
    if (!growth) return;
    growth.figure.update(dt);
    if (growth.done) finishGrowth();
  }

  function reset() {
    if (growth) {
      growth.figure.dispose();
      growth = null;
    }
    const previousSize = size;
    size = startSize;
    stage.setArenaSize(size);
    events.emit('landGrown', { size, previousSize, spawnRadius: spawnRadiusFor(size) });
  }

  return {
    get size() {
      return size;
    },
    get spawnRadius() {
      return spawnRadiusFor(size);
    },
    get nextSize() {
      if (growth) return growth.to;
      return size < maxSize ? Math.min(maxSize, size + step) : null;
    },
    get isGrowing() {
      return growth !== null;
    },
    grow,
    update,
    reset,
  };
}

// 예전 정사각형(from)과 새 정사각형(to) 사이 띠의 블록들, 시계 방향으로 도는 순서
// (처음 카메라 기준 화면 위쪽에서 시작해 오른쪽 → 아래 → 왼쪽)
function ringVoxels(from, to, hex) {
  const oldHalf = from / 2;
  const start = SWEEP_START_DEG * DEG;
  const jitter = createRandom(from * 131 + to);
  const list = [];
  for (let i = 0; i < to; i++) {
    for (let j = 0; j < to; j++) {
      const x = i - (to - 1) / 2;
      const z = j - (to - 1) / 2;
      if (Math.max(Math.abs(x), Math.abs(z)) < oldHalf) continue;
      // 화면 위쪽(-z)이 0, 오른쪽(+x)이 90도인 각도
      const angle = Math.atan2(x, -z) - start;
      const turn = ((angle % TWO_PI) + TWO_PI) % TWO_PI;
      list.push({ x, y: RING_LAYER, z, hex, order: turn + (jitter() * 2 - 1) * SWEEP_JITTER_DEG * DEG });
    }
  }
  list.sort((a, b) => a.order - b.order);
  return list.map(({ x, y, z }) => ({ x, y, z, hex }));
}

function evenSize(value) {
  return Math.max(2, Math.round(value / 2) * 2);
}

// 늘 같은 순서로 나오는 난수 (같은 크기로 넓어질 때마다 똑같이 쌓이게)
function createRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
