// 전장 꾸미기
// 바닥판 네 모서리(적이 다니는 원 바깥)에 블록으로 만든 나무, 바위, 꽃, 버섯, 연못(오리 한 마리)을 놓고,
// 웨이브가 시작되면 적이 몰려오는 방향마다 빨간 화살표 경고 표시를 몇 초 동안 깜빡입니다.
// 꾸미기는 게임이 열릴 때 블록이 떨어져 쌓이며 생겨납니다. 카메라를 따라 돌지 않는 입체 블록입니다.
//
//   const decor = createArenaDecor({ scene, events, config })
//   decor.update(dt)                  매 장면마다 불러서 쌓기 모션, 오리, 경고 표시를 움직임
//   decor.showWarnings(각도 목록, 초)  경고 표시 띄우기 ('wavePreview'·'waveStarted' 소식이 오면 저절로 불림)
//   decor.clear()                     떠 있는 경고 표시 모두 지우기
//   decor.blockCount                  꾸미기에 쓴 블록 수 (경고 표시 제외)
//
// 바꾸고 싶은 것
//   무엇을 어디에 놓을지   → DECOR_LAYOUT (모서리에서 안쪽으로 몇 칸 들어온 자리인지)
//   색                    → COLORS, FLOWER_COLORS
//   모양                  → MODELS (나무, 바위 같은 모양을 블록으로 쌓는 방법)
//   경고 표시 시간·모양     → WARNING, ARROW
// 적이 다니는 원(적이 나타나는 거리 + CLEAR_MARGIN 칸) 안쪽이나 바닥판 밖으로 나가는 꾸미기는 통째로 빠집니다.

import * as THREE from '../../lib/three.js';
import { BlockFigure } from '../core/blockFigure.js';
import { createBlockBatch } from '../core/blockAssets.js';

const DECOR_SEED = 7; // 바꾸면 나뭇잎·돌 색 섞임이 달라짐
const DECOR_BUILD_SECONDS = 3.5; // 처음에 꾸미기가 쌓이는 시간
const DECOR_DROP_HEIGHT = 7; // 꾸미기 블록이 몇 칸 위에서 떨어지는지
const CLEAR_MARGIN = 3; // 적이 나타나는 거리보다 이만큼 더 바깥에만 꾸미기를 둠

// 경고 표시 (적이 오는 방향의 땅 위에 놓이는 빨간 블록 화살표)
const WARNING = {
  seconds: 4, // 보이는 시간
  radiusOffset: -2, // 화살표 가운데 = 적이 나타나는 거리(config.arena.spawnRadius) + 이 값 (바닥판 밖으로 안 나가게 안쪽으로)
  color: '#C91A09', // 평소 색 (빨강)
  flashColor: '#F2CD37', // 번쩍일 때 색 (노랑)
  chaseSpeed: 1.4, // 1초에 불빛이 꼬리에서 화살촉(성 쪽)으로 몇 번 지나가는지
  lift: 0.7, // 번쩍일 때 위로 뛰는 높이
  maxShown: 6, // 한꺼번에 보일 수 있는 방향 수
};

// 화살표 모양 (맨 윗줄이 화살촉 = 성을 가리킴, X = 블록)
const ARROW = [
  '...X...',
  '..XXX..',
  '.XXXXX.',
  'XXXXXXX',
  '..XXX..',
  '..XXX..',
  '..XXX..',
];

// 꾸미기 색 (모두 js/bricks/brickColors.js 의 블록 색)
const COLORS = {
  trunk: '#582A12', // 나무 줄기 (밤색)
  leaf: '#237841', // 나뭇잎 (진초록)
  leafLight: '#4B9F4A', // 밝은 나뭇잎 (초록)
  leafDark: '#184632', // 어두운 나뭇잎, 소나무 (짙은 초록)
  apple: '#C91A09', // 사과 (빨강)
  rock: '#A0A5A9', // 바위 (밝은 회색)
  rockDark: '#6C6E68', // 바위 그늘 (진한 회색)
  moss: '#4B9F4A', // 바위 위 이끼 (초록)
  sand: '#E4CD9E', // 연못가 모래 (모래색)
  water: '#078BC9', // 물 (진한 하늘색)
  waterLight: '#36AEBF', // 밝은 물 (청록)
  sparkle: '#9FC3E9', // 물 반짝임 (연하늘색)
  lily: '#4B9F4A', // 연잎 (초록)
  stem: '#237841', // 꽃줄기, 갈대 (진초록)
  flowerCenter: '#F2CD37', // 꽃 가운데 (노랑)
  cattail: '#582A12', // 갈대 이삭 (밤색)
  mushroomStem: '#F6D7B3', // 버섯 기둥 (연살구색)
  mushroomCap: '#C91A09', // 버섯 갓 (빨강)
  mushroomDot: '#F4F4F4', // 버섯 점 (흰색)
  duck: '#F2CD37', // 오리 몸 (노랑)
  beak: '#FE8A18', // 오리 부리 (주황)
};

// 꽃잎 색 (꽃마다 이 중에서 골라 씀)
const FLOWER_COLORS = ['#C91A09', '#F4F4F4', '#E4ADC8', '#5A93DB', '#FF698F', '#AC78BA'];

// 네 모서리 배치표
// 모서리 이름은 처음 카메라 기준: far = 화면 위쪽(멀리), near = 화면 아래쪽(가까이)
// x: 왼쪽/오른쪽 끝에서 안쪽으로 몇 칸, z: 위/아래 끝에서 안쪽으로 몇 칸 (1 = 맨 끝 칸)
// type: tree(둥근 나무) pine(소나무) rock(큰 바위) pebble(작은 돌) flower(꽃) bud(작은 꽃)
//       mushroom(버섯) pond(연못) reeds(갈대) duck(오리, 연못 가운데에 둠)
// flower, bud 는 color: '#C91A09' 처럼 꽃잎 색을 정할 수 있음 (없으면 FLOWER_COLORS 에서 고름)
// tree 는 apples: true 를 붙이면 사과가 열림
const DECOR_LAYOUT = {
  farRight: [
    { type: 'tree', x: 4, z: 4, apples: true },
    { type: 'tree', x: 9, z: 3 },
    { type: 'mushroom', x: 3, z: 10 },
    { type: 'flower', x: 7, z: 7, color: '#F4F4F4' },
    { type: 'flower', x: 2, z: 14, color: '#E4ADC8' },
    { type: 'bud', x: 12, z: 2, color: '#5A93DB' },
    { type: 'pebble', x: 15, z: 2 },
  ],
  farLeft: [
    { type: 'pine', x: 4, z: 4 },
    { type: 'pine', x: 9, z: 3 },
    { type: 'pine', x: 3, z: 9 },
    { type: 'rock', x: 7, z: 8 },
    { type: 'pebble', x: 13, z: 2 },
    { type: 'bud', x: 2, z: 15, color: '#F4F4F4' },
    { type: 'flower', x: 3, z: 14, color: '#FF698F' },
  ],
  nearRight: [
    { type: 'pond', x: 5, z: 5 },
    { type: 'duck', x: 5, z: 5 },
    { type: 'reeds', x: 2, z: 9 },
    { type: 'tree', x: 10, z: 3 },
    { type: 'flower', x: 3, z: 12, color: '#C91A09' },
    { type: 'bud', x: 14, z: 2, color: '#AC78BA' },
  ],
  nearLeft: [
    { type: 'rock', x: 4, z: 4 },
    { type: 'mushroom', x: 8, z: 3 },
    { type: 'mushroom', x: 11, z: 4 },
    { type: 'tree', x: 3, z: 10, apples: true },
    { type: 'flower', x: 7, z: 7, color: '#5A93DB' },
    { type: 'pebble', x: 2, z: 15 },
    { type: 'bud', x: 13, z: 2, color: '#C91A09' },
  ],
};

// 모서리 방향 (sx: 오른쪽 +1 / 왼쪽 -1, sz: 가까이 +1 / 멀리 -1)
const CORNERS = {
  farRight: { sx: 1, sz: -1 },
  farLeft: { sx: -1, sz: -1 },
  nearRight: { sx: 1, sz: 1 },
  nearLeft: { sx: -1, sz: 1 },
};

const WATER_SINK = -0.62; // 물 블록을 땅속으로 내려서 윗면만 살짝 보이게 함
const DUCK_FLOAT_Y = -0.15; // 오리가 물에 떠 있는 높이

// ── 모양 만들기 ──
// 각 모양은 블록 목록 [{ dx, dy, dz, hex, sink }] 을 돌려줍니다. (dx, dz: 자리에서 몇 칸 옆, dy: 몇 층)

const MODELS = {
  // 둥근 나무: 줄기 3칸 + 둥근 잎 덩어리 (apples: true 면 빨간 사과가 열림)
  tree(rng, { apples = false } = {}) {
    const out = [];
    for (let y = 0; y < 3; y++) out.push(block(0, y, 0, COLORS.trunk));
    const layers = [
      [3, 1, false],
      [4, 2, true],
      [5, 2, true],
      [6, 1, false],
    ];
    for (const [y, radius, cutCorners] of layers) {
      square(radius, cutCorners, (dx, dz) => {
        const edge = Math.max(Math.abs(dx), Math.abs(dz)) === radius;
        let hex = pick(rng, y >= 5 ? [COLORS.leafLight, COLORS.leaf] : [COLORS.leaf, COLORS.leaf, COLORS.leafLight]);
        if (y === 3) hex = pick(rng, [COLORS.leafDark, COLORS.leaf]);
        if (apples && edge && (y === 4 || y === 5) && rng() < 0.2) hex = COLORS.apple;
        out.push(block(dx, y, dz, hex));
      });
    }
    return out;
  },

  // 소나무: 줄기 2칸 + 위로 갈수록 좁아지는 잎 치마 두 겹 + 뾰족한 꼭대기
  pine(rng) {
    const out = [block(0, 0, 0, COLORS.trunk), block(0, 1, 0, COLORS.trunk)];
    const leaf = () => (rng() < 0.55 ? COLORS.leafDark : COLORS.leaf);
    square(2, true, (dx, dz) => out.push(block(dx, 2, dz, leaf())));
    square(1, false, (dx, dz) => out.push(block(dx, 3, dz, leaf())));
    // 두 번째 치마: 3×3 + 네 방향으로 한 칸씩 삐죽
    square(1, false, (dx, dz) => out.push(block(dx, 4, dz, leaf())));
    for (const [dx, dz] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) out.push(block(dx, 4, dz, COLORS.leaf));
    square(1, true, (dx, dz) => out.push(block(dx, 5, dz, leaf())));
    out.push(block(0, 6, 0, COLORS.leaf), block(0, 7, 0, COLORS.leafLight));
    return out;
  },

  // 큰 바위: 3×3 바닥 + 2×2 + 꼭대기 (가끔 이끼)
  rock(rng) {
    const out = [];
    const missing = Math.floor(rng() * 4);
    const corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
    square(1, false, (dx, dz) => {
      if (dx === corners[missing][0] && dz === corners[missing][1]) return; // 귀퉁이 하나는 비워서 울퉁불퉁하게
      out.push(block(dx, 0, dz, rockColor(rng)));
    });
    const ox = rng() < 0.5 ? -1 : 0;
    const oz = rng() < 0.5 ? -1 : 0;
    for (const [dx, dz] of [[0, 0], [1, 0], [0, 1], [1, 1]]) out.push(block(ox + dx, 1, oz + dz, rockColor(rng)));
    out.push(block(ox + (rng() < 0.5 ? 0 : 1), 2, oz + (rng() < 0.5 ? 0 : 1), rng() < 0.5 ? COLORS.moss : COLORS.rock));
    return out;
  },

  // 작은 돌
  pebble(rng) {
    return [
      block(0, 0, 0, rockColor(rng)),
      block(1, 0, 0, rockColor(rng)),
      block(0, 0, 1, rockColor(rng)),
      block(0, 1, 0, COLORS.rock),
    ];
  },

  // 꽃: 줄기 위에 꽃잎 4장 + 노란 가운데
  flower(rng, { color } = {}) {
    const petal = color ?? pick(rng, FLOWER_COLORS);
    const leafSide = rng() < 0.5 ? 1 : -1;
    return [
      block(0, 0, 0, COLORS.stem),
      block(leafSide, 0, 0, COLORS.leafLight),
      block(0, 1, 0, COLORS.flowerCenter),
      block(1, 1, 0, petal),
      block(-1, 1, 0, petal),
      block(0, 1, 1, petal),
      block(0, 1, -1, petal),
    ];
  },

  // 작은 꽃: 잎 위에 꽃 한 송이
  bud(rng, { color } = {}) {
    return [
      block(0, 0, 0, COLORS.leafLight),
      block(0, 1, 0, color ?? pick(rng, FLOWER_COLORS)),
      block(rng() < 0.5 ? 1 : -1, 0, 0, COLORS.stem),
    ];
  },

  // 버섯: 연살구색 기둥 + 흰 점이 있는 빨간 갓
  mushroom(rng) {
    const out = [block(0, 0, 0, COLORS.mushroomStem), block(0, 1, 0, COLORS.mushroomStem)];
    const dots = new Set([Math.floor(rng() * 8), Math.floor(rng() * 8)]);
    let ring = 0;
    square(1, false, (dx, dz) => {
      const isRing = dx !== 0 || dz !== 0;
      const hex = isRing && dots.has(ring) ? COLORS.mushroomDot : COLORS.mushroomCap;
      if (isRing) ring++;
      out.push(block(dx, 2, dz, hex));
    });
    const topDot = Math.floor(rng() * 4);
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dz], i) => {
      out.push(block(dx, 3, dz, i === topDot ? COLORS.mushroomDot : COLORS.mushroomCap));
    });
    out.push(block(0, 3, 0, COLORS.mushroomCap));
    return out;
  },

  // 연못: 타원 모양 물 (땅속으로 살짝 내려감) + 둘레의 돌과 모래 + 연잎 하나
  pond(rng, { radiusX = 3.2, radiusZ = 2.2 } = {}) {
    const out = [];
    const isWater = (dx, dz) => (dx / radiusX) ** 2 + (dz / radiusZ) ** 2 <= 1;
    const spanX = Math.ceil(radiusX) + 1;
    const spanZ = Math.ceil(radiusZ) + 1;
    const water = [];
    for (let dx = -spanX; dx <= spanX; dx++) {
      for (let dz = -spanZ; dz <= spanZ; dz++) {
        if (isWater(dx, dz)) {
          water.push([dx, dz]);
          continue;
        }
        let shore = false;
        for (let ax = -1; ax <= 1 && !shore; ax++) for (let az = -1; az <= 1; az++) if (isWater(dx + ax, dz + az)) shore = true;
        if (shore) out.push(block(dx, 0, dz, pick(rng, [COLORS.rock, COLORS.rock, COLORS.sand, COLORS.sand, COLORS.rockDark])));
      }
    }
    // 연잎은 오리가 다니는 길에서 먼 왼쪽 또는 오른쪽 끝 물칸에 하나
    const lilyX = (rng() < 0.5 ? -1 : 1) * Math.floor(radiusX);
    for (const [dx, dz] of water) {
      if (dx === lilyX && dz === 0) {
        out.push(block(dx, 0, dz, COLORS.lily, WATER_SINK + 0.12));
        continue;
      }
      const roll = rng();
      const hex = roll < 0.12 ? COLORS.sparkle : roll < 0.35 ? COLORS.waterLight : COLORS.water;
      out.push(block(dx, 0, dz, hex, WATER_SINK));
    }
    return out;
  },

  // 갈대: 초록 줄기 + 갈색 이삭
  reeds(rng) {
    const out = [];
    const stalks = [
      [0, 0, 3],
      [1, 0, 2],
      [0, 1, 2],
    ];
    for (const [dx, dz, height] of stalks) {
      for (let y = 0; y < height - 1; y++) out.push(block(dx, y, dz, COLORS.stem));
      out.push(block(dx, height - 1, dz, rng() < 0.7 ? COLORS.cattail : COLORS.stem));
    }
    return out;
  },
};

// 오리 (따로 움직이는 작은 블록 인형, 연못 위를 천천히 돎) — 부리가 +x 쪽
const DUCK_BLOCKS = [
  { x: -0.5, y: 0, hex: COLORS.duck },
  { x: 0.5, y: 0, hex: COLORS.duck },
  { x: 0.5, y: 1, hex: COLORS.duck },
  { x: 1.5, y: 1, hex: COLORS.beak },
];
const DUCK_PATH = { radiusX: 1.0, radiusZ: 0.45, speed: 0.35, bob: 0.05 }; // 오리가 도는 길 (칸), 빠르기

export function createArenaDecor({ scene, events, config }) {
  const half = config.arena.size / 2;
  const clearRadius = config.arena.spawnRadius + CLEAR_MARGIN;
  const rng = createRandom(DECOR_SEED);

  // ── 모서리 꾸미기 (블록 인형 하나로 한꺼번에 그림) ──
  const voxels = [];
  const ducks = [];
  for (const [cornerName, items] of Object.entries(DECOR_LAYOUT)) {
    const corner = CORNERS[cornerName];
    if (!corner) continue;
    for (const item of items) {
      const center = itemCenter(item, corner, half);
      if (item.type === 'duck') {
        ducks.push(center);
        continue;
      }
      const model = MODELS[item.type];
      if (!model) {
        console.warn(`꾸미기 종류 '${item.type}' 를 모릅니다 (${cornerName})`);
        continue;
      }
      const blocks = model(rng, item).map((b) => ({
        x: center.x + b.dx * corner.sx,
        y: b.dy + 0.5 + b.sink,
        z: center.z + b.dz * corner.sz,
        level: b.dy,
        hex: b.hex,
      }));
      if (!fitsOutsideField(blocks, half, clearRadius)) {
        console.warn(`꾸미기 '${item.type}' (${cornerName}, x ${item.x}, z ${item.z}) 가 전장 원 안이나 바닥판 밖이라 뺐어요`);
        continue;
      }
      voxels.push(...blocks);
    }
  }
  const decorFigure = voxels.length ? new BlockFigure(createVoxelBlueprint('decor', voxels, rng, half), scene) : null;
  decorFigure?.build(DECOR_BUILD_SECONDS, { dropHeight: DECOR_DROP_HEIGHT });

  const duckFigures = ducks.map((center) => {
    const blueprint = createVoxelBlueprint(
      'duck',
      DUCK_BLOCKS.map((b) => ({ x: b.x, y: b.y + 0.5, z: 0, level: b.y, hex: b.hex })),
      rng,
      half,
    );
    const figure = new BlockFigure(blueprint, scene);
    figure.group.position.set(center.x, DUCK_FLOAT_Y, center.z);
    figure.build(DECOR_BUILD_SECONDS * 0.6, { dropHeight: DECOR_DROP_HEIGHT });
    return { figure, center, phase: rng() * Math.PI * 2 };
  });
  let time = 0;

  // ── 경고 표시 ──
  // 화살표 블록: u = 성 쪽으로 몇 칸, v = 옆으로 몇 칸, step = 꼬리(0)에서 화살촉까지 몇 번째 줄
  const arrowCells = [];
  ARROW.forEach((row, r) => {
    for (let c = 0; c < row.length; c++) {
      if (row[c] === '.' || row[c] === ' ') continue;
      arrowCells.push({ u: (ARROW.length - 1) / 2 - r, v: c - (row.length - 1) / 2, step: ARROW.length - 1 - r });
    }
  });
  const warningRadius = config.arena.spawnRadius + WARNING.radiusOffset;
  const warningCapacity = WARNING.maxShown * arrowCells.length;
  const warningBatch = createBlockBatch(warningCapacity);
  scene.add(warningBatch.bodies, warningBatch.studs);
  const warnings = []; // { angle, cos, sin, age }
  let warningSlots = 0;

  const baseColor = new THREE.Color(WARNING.color);
  const flashColor = new THREE.Color(WARNING.flashColor);
  const color = new THREE.Color();
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);

  // seconds: 보이는 시간 (Infinity 면 다음 소식이 올 때까지 계속)
  function showWarnings(directions = [], seconds = WARNING.seconds) {
    for (const angle of directions) {
      if (warnings.length >= WARNING.maxShown) warnings.shift();
      warnings.push({ angle, cos: Math.cos(angle), sin: Math.sin(angle), age: 0, life: seconds });
    }
  }

  function updateWarnings(dt) {
    for (let i = warnings.length - 1; i >= 0; i--) {
      warnings[i].age += dt;
      if (warnings[i].age >= warnings[i].life) warnings.splice(i, 1);
    }
    if (warnings.length === 0 && warningSlots === 0) return;
    let slot = 0;
    for (const warning of warnings) slot = writeWarning(warning, slot);
    warningSlots = slot;
    warningBatch.bodies.count = slot;
    warningBatch.studs.count = slot;
    warningBatch.bodies.instanceMatrix.needsUpdate = true;
    warningBatch.studs.instanceMatrix.needsUpdate = true;
    warningBatch.bodies.instanceColor.needsUpdate = true;
    warningBatch.studs.instanceColor.needsUpdate = true;
  }

  // 화살표: 꼬리부터 톡톡 튀어나오고, 노란 불빛이 꼬리에서 화살촉(성 쪽)으로 지나가며 번쩍이고, 끝에 작아지며 사라짐
  function writeWarning({ angle, cos, sin, age, life }, slot) {
    rotation.setFromAxisAngle(up, -angle);
    const fadeOut = clamp01((life - age) / 0.35);
    const rows = ARROW.length;
    for (const { u, v, step } of arrowCells) {
      const pop = easeOutBack(clamp01((age - step * 0.05) / 0.3));
      const size = Math.max(0.001, pop * fadeOut);
      const phase = fract(age * WARNING.chaseSpeed - step / rows);
      const pulse = phase < 0.3 ? Math.sin((Math.PI * phase) / 0.3) : 0;
      color.copy(baseColor).lerp(flashColor, pulse);
      const along = warningRadius - u;
      position.set(cos * along - sin * v, 0.5 * size + pulse * WARNING.lift * fadeOut, sin * along + cos * v);
      scale.set(size, size, size);
      matrix.compose(position, rotation, scale);
      warningBatch.bodies.setMatrixAt(slot, matrix);
      warningBatch.studs.setMatrixAt(slot, matrix);
      warningBatch.bodies.setColorAt(slot, color);
      warningBatch.studs.setColorAt(slot, color);
      slot++;
    }
    return slot;
  }

  function clear() {
    warnings.length = 0;
    updateWarnings(0);
  }

  // 오리: 연못 위를 작은 타원으로 돌며 둥실둥실
  function updateDucks(dt) {
    for (const duck of duckFigures) {
      duck.figure.update(dt);
      const a = duck.phase + time * DUCK_PATH.speed;
      const group = duck.figure.group;
      group.position.set(
        duck.center.x + Math.cos(a) * DUCK_PATH.radiusX,
        DUCK_FLOAT_Y + Math.sin(time * 2.6 + duck.phase) * DUCK_PATH.bob,
        duck.center.z + Math.sin(a) * DUCK_PATH.radiusZ,
      );
      // 가는 방향(타원의 접선)을 바라봄
      group.rotation.y = Math.atan2(-Math.cos(a) * DUCK_PATH.radiusZ, -Math.sin(a) * DUCK_PATH.radiusX);
    }
  }

  // 쉬는 시간: 다음 웨이브 방향을 웨이브가 시작될 때까지 보여 줌 → 시작하면 잠깐 더 번쩍이고 사라짐
  events.on('wavePreview', ({ directions }) => {
    warnings.length = 0;
    showWarnings(directions, Infinity);
  });
  events.on('waveStarted', ({ directions }) => {
    warnings.length = 0;
    showWarnings(directions);
  });

  return {
    update(dt) {
      time += dt;
      decorFigure?.update(dt);
      updateDucks(dt);
      updateWarnings(dt);
    },
    showWarnings,
    clear,
    get blockCount() {
      return voxels.length + duckFigures.length * DUCK_BLOCKS.length;
    },
  };
}

// ── 아래는 내부에서 쓰는 도구 ──

function block(dx, dy, dz, hex, sink = 0) {
  return { dx, dy, dz, hex, sink };
}

// 가운데에서 radius 칸까지의 정사각형 (cutCorners 면 네 귀퉁이를 뺌)
function square(radius, cutCorners, visit) {
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dz = -radius; dz <= radius; dz++) {
      if (cutCorners && radius > 0 && Math.abs(dx) === radius && Math.abs(dz) === radius) continue;
      visit(dx, dz);
    }
  }
}

function rockColor(rng) {
  return rng() < 0.7 ? COLORS.rock : COLORS.rockDark;
}

// 배치표의 '모서리에서 몇 칸' → 바닥판 위 칸의 가운데 위치 (바닥판 돌기 위에 딱 맞음)
function itemCenter(item, corner, half) {
  return {
    x: corner.sx * (half - item.x + 0.5),
    z: corner.sz * (half - item.z + 0.5),
  };
}

function fitsOutsideField(blocks, half, clearRadius) {
  return blocks.every(
    (b) => Math.hypot(b.x, b.z) > clearRadius && Math.abs(b.x) < half && Math.abs(b.z) < half,
  );
}

// 블록 목록 → BlockFigure 가 쓰는 설계도 (아래층부터 쌓이게, 같은 층 안에서는 섞어서)
function createVoxelBlueprint(key, voxels, rng, half) {
  const list = voxels.slice();
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  list.sort((a, b) => a.level - b.level);

  const count = list.length;
  const positions = new Float32Array(count * 3);
  const cells = new Int16Array(count * 3);
  const colors = new Array(count);
  const colorCache = new Map();
  let rows = 1;
  list.forEach((voxel, i) => {
    positions[i * 3] = voxel.x;
    positions[i * 3 + 1] = voxel.y;
    positions[i * 3 + 2] = voxel.z;
    cells[i * 3] = Math.floor(voxel.x + half);
    cells[i * 3 + 1] = voxel.level;
    cells[i * 3 + 2] = Math.floor(voxel.z + half);
    if (!colorCache.has(voxel.hex)) colorCache.set(voxel.hex, new THREE.Color(voxel.hex));
    colors[i] = colorCache.get(voxel.hex);
    rows = Math.max(rows, voxel.level + 1);
  });
  const size = half * 2;
  return { key, columns: size, rows, depth: size, count, positions, cells, colors, width: size, height: rows };
}

// 늘 같은 순서로 나오는 난수 (꾸미기가 열 때마다 똑같이 보이게)
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

function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

function clamp01(t) {
  return Math.min(1, Math.max(0, t));
}

function fract(t) {
  return t - Math.floor(t);
}

// 살짝 넘쳤다가 제자리로 (톡 튀어나오는 느낌)
function easeOutBack(t) {
  const c = 1.7;
  return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2;
}
