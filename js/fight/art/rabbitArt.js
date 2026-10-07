// 토끼 모델 만들기 (내 토끼 + 미친토끼 3종류)
// rabbitDesigns.js 의 글자 지도를 블록 목록으로 바꾸고, 귀가 터지는 순서(popOrder)를 정합니다.
// 모양(색·지도)을 바꾸려면 rabbitDesigns.js 를 고치세요. 이 파일은 조립만 합니다.
//
//   createRabbitModel(kind) → ModelDef        kind: 'player' | 'knife' | 'gunner' | 'brute'
//     ModelDef = {
//       parts: { 이름: { pivot: [x,y,z], voxels: [{ x, y, z, hex }] } }
//               이름: body, head, earL, earR, armL, armR, footL, footR, tail
//               위치는 모델 기준 (발바닥 y = 0, 앞 = +z), 블록 '가운데' 좌표. pivot 도 모델 기준
//               L = 토끼 자신의 왼쪽 = +x 쪽, R = 토끼 자신의 오른쪽 = -x 쪽 (무기는 armR)
//       popOrder: [{ part, index }]   맞을 때 터지는 순서. 귀 끝 → (양쪽 귀 번갈아) → 귀 뿌리 → 꼬리
//       hand: { part: 'armR', at: [x,y,z] }   무기 손잡이 블록 가운데가 올 곳 (오른손 바깥 옆, 팔을 내린 자세 기준)
//       height, radius                         전체 키 (귀 끝까지), 발밑 둘레 반지름
//       kind
//     }
//   RABBIT_KINDS                               만들 수 있는 종류 목록
//   buildRabbitModel(design, kind) → ModelDef  설계 하나로 바로 만들기 (새 모양을 시험해 볼 때)
//
// 같은 kind 를 여러 번 부르면 매번 새 목록을 돌려줍니다. (받은 쪽에서 고쳐도 안전)

import { parseLayers, mirrorX, translate } from './voxelText.js';
import { RABBIT_DESIGNS } from './rabbitDesigns.js';

export const RABBIT_KINDS = Object.keys(RABBIT_DESIGNS);
const PART_NAMES = ['body', 'head', 'earL', 'earR', 'armL', 'armR', 'footL', 'footR', 'tail'];

export function createRabbitModel(kind = 'player') {
  const design = RABBIT_DESIGNS[kind];
  if (!design) throw new Error(`없는 토끼 종류: ${kind}`);
  return buildRabbitModel(design, kind);
}

export function buildRabbitModel(design, kind = 'custom') {
  const parts = {};
  for (const name of PART_NAMES) {
    const part = design.parts[name];
    if (!part) throw new Error(`토끼 '${kind}' 에 '${name}' 부품이 없어요`);
    const voxels = [];
    for (const piece of part.pieces) voxels.push(...buildPiece(piece, design.colors, kind, name));
    parts[name] = { pivot: [...part.pivot], voxels };
  }

  return {
    kind,
    parts,
    popOrder: buildPopOrder(parts),
    hand: { part: 'armR', at: [...design.hand] },
    height: topOf(parts),
    radius: footprintRadius(parts),
  };
}

// 조각 하나: 지도 → 블록 (mirror: true 면 좌우를 뒤집은 뒤 at 으로 옮김)
function buildPiece(piece, colors, kind, partName) {
  let voxels;
  try {
    voxels = parseLayers(piece.layers, colors);
  } catch (error) {
    throw new Error(`토끼 '${kind}' 의 '${partName}': ${error.message}`);
  }
  if (piece.mirror) voxels = mirrorX(voxels);
  const [x, y, z] = piece.at;
  return translate(voxels, x, y, z);
}

// 터지는 순서 정하기
//   1) 귀마다 블록을 높은 것부터 줄 세움 (같은 높이면 바깥쪽 먼저)
//   2) 두 귀를 번갈아 하나씩 꺼냄. 길이가 다르면(찢어진 귀) 짧은 귀는 천천히 → 두 귀가 비슷하게 뿌리까지 닳음
//   3) 마지막에 꼬리 (몸에서 먼 블록부터)
function buildPopOrder(parts) {
  const earLine = (name) =>
    parts[name].voxels
      .map((v, index) => ({ part: name, index, y: v.y, out: Math.abs(v.x) }))
      .sort((a, b) => b.y - a.y || b.out - a.out);
  const left = earLine('earL');
  const right = earLine('earR');

  // 각 블록의 '귀 안에서 몇 번째인지' 비율로 섞음. 같은 비율이면 왼쪽 귀 먼저 → 길이가 같으면 정확히 번갈아 나옴
  const tagged = [
    ...left.map((item, i) => ({ item, key: i / left.length, side: 0 })),
    ...right.map((item, i) => ({ item, key: i / right.length, side: 1 })),
  ];
  tagged.sort((a, b) => a.key - b.key || a.side - b.side);
  const order = tagged.map(({ item }) => ({ part: item.part, index: item.index }));

  const tail = parts.tail.voxels
    .map((v, index) => ({ index, back: -v.z, y: v.y }))
    .sort((a, b) => b.back - a.back || b.y - a.y);
  for (const { index } of tail) order.push({ part: 'tail', index });
  return order;
}

function topOf(parts) {
  let top = 0;
  for (const name of PART_NAMES) for (const v of parts[name].voxels) top = Math.max(top, v.y + 0.5);
  return top;
}

function footprintRadius(parts) {
  let radius = 0;
  for (const name of PART_NAMES) {
    for (const v of parts[name].voxels) radius = Math.max(radius, Math.hypot(Math.abs(v.x) + 0.5, Math.abs(v.z) + 0.5));
  }
  return Math.round(radius * 10) / 10;
}
