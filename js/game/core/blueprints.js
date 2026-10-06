// 설계도: 그림 → 블록 배치
// 그림 한 장을 '어느 자리에 무슨 색 블록이 놓이는지' 목록으로 바꿉니다.
// 블록 이미지 빌더의 모듈(pixelator, colorMatcher, buildPlan)을 그대로 씁니다.
// 같은 그림·같은 크기는 한 번만 계산하고 저장해 두었다가 다시 씁니다.
//
// 설계도 내용
//   columns, rows, depth   가로·세로·두께 블록 수
//   count                  블록 개수
//   positions              Float32Array [x, y, z, ...]  블록 중심 위치 (바닥 가운데가 0,0,0, 앞쪽이 +z)
//   cells                  Int16Array   [x, y, z, ...]  격자 칸 번호 (y = 0 이 맨 아래)
//   colors                 THREE.Color[] 블록 색
//   width, height          전체 크기

import * as THREE from '../../lib/three.js';
import { pixelate } from '../../image/pixelator.js';
import { quantizeGrid } from '../../bricks/colorMatcher.js';
import { createBuildPlan } from '../../bricks/buildPlan.js';
import { BRICK_COLORS } from '../../bricks/brickColors.js';

const cache = new Map();
const paletteColors = BRICK_COLORS.map((color) => new THREE.Color(color.hex));

// key: 그림 이름(바뀔 때마다 달라져야 함), image: 캔버스나 그림
export function getBlueprint(key, image, { columns, depth = 1, order = 'random', maxRows = 80 }) {
  const cacheKey = `${key}|${columns}|${depth}|${order}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const grid = pixelate(image, columns, { maxRows, alphaThreshold: 0.5 });
  const colorGrid = quantizeGrid(grid, BRICK_COLORS);
  const plan = createBuildPlan(colorGrid, { order, depth });
  const count = plan.blocks.length;
  const positions = new Float32Array(count * 3);
  const cells = new Int16Array(count * 3);
  const colors = new Array(count);
  plan.blocks.forEach((block, i) => {
    positions[i * 3] = block.x - (plan.columns - 1) / 2;
    positions[i * 3 + 1] = block.y + 0.5;
    positions[i * 3 + 2] = (plan.depth - 1) / 2 - block.z;
    cells[i * 3] = block.x;
    cells[i * 3 + 1] = block.y;
    cells[i * 3 + 2] = block.z;
    colors[i] = paletteColors[block.colorIndex];
  });

  const blueprint = {
    key,
    columns: plan.columns,
    rows: plan.rows,
    depth: plan.depth,
    count,
    positions,
    cells,
    colors,
    width: plan.columns,
    height: plan.rows,
  };
  cache.set(cacheKey, blueprint);
  return blueprint;
}

// 그림이 바뀌었을 때 예전 설계도 지우기
export function forgetBlueprints(keyPrefix) {
  for (const cacheKey of cache.keys()) {
    if (cacheKey.startsWith(keyPrefix)) cache.delete(cacheKey);
  }
}

// 단색 블록을 가로 columns × 세로 rows × 두께 depth 로 쌓은 설계도 (타워 강화 왕관 등에 씀)
export function getSolidBlueprint(key, { columns, rows, depth = 1, hex, yOffset = 0 }) {
  const cacheKey = `solid|${key}|${columns}|${rows}|${depth}|${hex}|${yOffset}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  const color = new THREE.Color(hex);
  const count = columns * rows * depth;
  const positions = new Float32Array(count * 3);
  const cells = new Int16Array(count * 3);
  const colors = new Array(count);
  let i = 0;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      for (let z = 0; z < depth; z++) {
        positions[i * 3] = x - (columns - 1) / 2;
        positions[i * 3 + 1] = y + yOffset + 0.5;
        positions[i * 3 + 2] = (depth - 1) / 2 - z;
        cells[i * 3] = x;
        cells[i * 3 + 1] = y + yOffset;
        cells[i * 3 + 2] = z;
        colors[i] = color;
        i++;
      }
    }
  }
  const blueprint = { key, columns, rows, depth, count, positions, cells, colors, width: columns, height: rows };
  cache.set(cacheKey, blueprint);
  return blueprint;
}
