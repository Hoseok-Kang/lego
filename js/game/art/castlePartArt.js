// 성 부품 모양 (망루 · 대포 포대 · 성벽 · 창고 · 수리소)
// 성 둘레 자리에 붙는 부품을 블록으로 어떻게 쌓을지 정합니다. 그림이 아니라 진짜 3D 블록 모양입니다.
// 층마다 '위에서 내려다본 글자 지도'를 아래층부터 차례로 적습니다. 글자 하나 = 블록 한 칸, '.' = 빈칸.
//
//   모서리 부품 (망루, 대포 포대): 5 × 5 칸. 지도의 맨 아래 줄과 맨 오른쪽 칸이 성 바깥쪽입니다.
//   옆면 부품 (성벽, 창고, 수리소): 가로 10칸 × 세로 3줄. 지도의 맨 아래 줄이 성 바깥쪽입니다.
//   (게임 화면 정면 아래쪽 자리에서 카메라로 보면 지도와 똑같은 방향으로 보입니다. 다른 자리는 알아서 돌려 놓습니다)
//
// 부품 하나의 설계
//   body     레벨 1 몸통 (아래층부터)
//   cap      지붕·꼭대기 (몸통 위에 얹힘). 강화하면 지붕이 위로 들렸다가 새 층 위에 다시 내려앉습니다
//   floors   [레벨 2 에 끼워 넣는 층들, 레벨 3 에 끼워 넣는 층들] (몸통과 지붕 사이에 쌓임)
//   muzzle   화살·대포알이 나가는 곳 { col: 칸, row: 줄, layer: 지붕의 몇 번째 층, reach: 적 쪽으로 더 나가는 거리 }
//   smoke    굴뚝 연기가 나오는 곳 (같은 방식, 없으면 생략)
// 층 하나는 [쌓는 횟수, 지도] 입니다. 예: [2, [...]] 는 같은 층을 두 번 쌓음.
//
//   partVoxels(종류, 레벨, 자리)   블록 목록 [{ x, y, z, hex, cap }] (자리 가운데 기준, 돌바닥 윗면 y = 0)
//                                  레벨 1 = 몸통 + 지붕(cap: true), 레벨 2·3 = 그 레벨에 새로 끼워 넣는 층만
//   partAnchor(종류, 이름, 자리)    'muzzle' | 'smoke' 위치 { x, y, z, reach } (레벨 1 기준, 지붕이 들리면 그만큼 올라감) 또는 null
//   PART_DESIGNS, PART_COLORS       위 설계와 글자 → 블록 색 (js/bricks/brickColors.js 의 색만 쓰기)

// 글자별 색
export const PART_COLORS = {
  D: '#6C6E68', // 진한 회색 (돌 받침, 테두리)
  G: '#A0A5A9', // 밝은 회색 (돌벽)
  K: '#1B2A34', // 검정 (창문, 대포, 깃대)
  W: '#F4F4F4', // 흰색
  R: '#C91A09', // 빨강 (망루 지붕, 벽돌)
  r: '#720E0F', // 진한 빨강 (지붕 처마, 벽돌 무늬, 굴뚝)
  Y: '#F2CD37', // 노랑 (금색 띠, 금 지붕, 불 켜진 창)
  y: '#FFF03A', // 연노랑 (반짝이는 금화)
  o: '#F8BB3D', // 귤색 (금 지붕 처마, 금화 테두리)
  B: '#582A12', // 밤색 (문, 나무 기둥, 대포 받침)
  C: '#AA7D55', // 캐러멜 (나무 벽)
  s: '#958A73', // 진한 모래색 (창고 받침돌)
  N: '#0055BF', // 파랑 (깃발, 성벽 깃발 — 성 지붕과 같은 색)
  F: '#FE8A18', // 주황 (대장간 불빛, 달군 쇠)
  A: '#A95500', // 진한 주황 (굴뚝 벽돌)
};

export const PART_DESIGNS = {
  // 망루: 둥근 돌탑 + 창문 + 빨간 뾰족 지붕 + 파란 깃발. 강화하면 금색 띠를 두른 층이 늘어남
  watchtower: {
    body: [
      [1, ['.DDD.', 'DDDDD', 'DDDDD', 'DDDDD', '.DDD.']],
      [1, ['.GGG.', 'GGGGG', 'GGGGG', 'GGGGG', '.GGG.']],
      [2, ['.GKG.', 'GGGGG', 'KGGGK', 'GGGGG', '.GKG.']],
      [1, ['.GGG.', 'GGGGG', 'GGGGG', 'GGGGG', '.GGG.']],
    ],
    cap: [
      [1, ['DDDDD', 'DGGGD', 'DGGGD', 'DGGGD', 'DDDDD']],
      [1, ['rrrrr', 'rRRRr', 'rRRRr', 'rRRRr', 'rrrrr']],
      [1, ['.....', '.RRR.', '.RRR.', '.RRR.', '.....']],
      [1, ['.....', '..R..', '.RRR.', '..R..', '.....']],
      [1, ['.....', '.....', '..Y..', '.....', '.....']],
      [2, ['.....', '.....', '..KNN', '.....', '.....']],
    ],
    floors: [
      [
        [1, ['.YYY.', 'YYYYY', 'YYYYY', 'YYYYY', '.YYY.']],
        [1, ['.GKG.', 'GGGGG', 'KGGGK', 'GGGGG', '.GKG.']],
      ],
      [
        [1, ['.YYY.', 'YYYYY', 'YYYYY', 'YYYYY', '.YYY.']],
        [1, ['.GYG.', 'GGGGG', 'YGGGY', 'GGGGG', '.GYG.']],
      ],
    ],
    muzzle: { col: 2, row: 2, layer: 0, reach: 2.2 },
  },

  // 대포 포대: 낮고 단단한 돌 포대. 꼭대기 나무 받침 위의 긴 검은 대포가 성 바깥쪽을 겨눔
  bombard: {
    body: [
      [1, ['DDDDD', 'DDDDD', 'DDDDD', 'DDDDD', 'DDDDD']],
      [1, ['DGGGD', 'GGGGG', 'GGGGG', 'GGGGG', 'DGGGD']],
      [1, ['DGGGD', 'GGGGG', 'GGGGG', 'GGGGK', 'DGGKD']],
    ],
    cap: [
      [1, ['DDDDD', 'DDDDD', 'DDDDD', 'DDDDD', 'DDDDD']],
      [1, ['G.G.G', '.BB..', 'GBB..', '.BB..', 'G.G.G']],
      [1, ['.....', '.....', '.KKKK', '.....', '.....']],
    ],
    floors: [
      [
        [1, ['YYYYY', 'YDDDY', 'YDDDY', 'YDDDY', 'YYYYY']],
        [1, ['DGGGD', 'GGGGG', 'GGGGG', 'GGGGK', 'DGGKD']],
      ],
      [
        [1, ['YYYYY', 'YDDDY', 'YDDDY', 'YDDDY', 'YYYYY']],
        [1, ['DGGGD', 'GGGGG', 'GGGGG', 'GGGGK', 'DGGKD']],
      ],
    ],
    muzzle: { col: 4, row: 2, layer: 2, reach: 0 },
  },

  // 성벽: 낮은 회색 성벽 + 톱니 모양 성가퀴 + 파란 깃발. (레벨 1 은 4층 이하라야 성 그림을 가리지 않음)
  wall: {
    body: [
      [1, ['DDDDDDDDDD', 'DDDDDDDDDD', 'DDDDDDDDDD']],
      [1, ['GGGGGGGGGG', 'GGGGGGGGGG', 'GGDGNNGDGG']],
      [1, ['GGGGGGGGGG', 'GGGGGGGGGG', 'GGGGNNGGGG']],
    ],
    cap: [[1, ['GG..GG..GG', '..........', 'GG..YY..GG']]],
    floors: [
      [[1, ['GGGGGGGGGG', 'GGGGGGGGGG', 'YYYYYYYYYY']]],
      [[1, ['GGGGGGGGGG', 'GGGGGGGGGG', 'GDGGGGGGDG']], [1, ['GGGGGGGGGG', 'GGGGGGGGGG', 'YYYYYYYYYY']]],
    ],
  },

  // 창고: 나무 집 + 금색 지붕 + 지붕 위 큰 금화
  treasury: {
    body: [
      [1, ['ssssssssss', 'ssssssssss', 'ssssssssss']],
      [1, ['BCCCCCCCCB', 'CCCCCCCCCC', 'BCCCBBCCCB']],
      [1, ['BCCCCCCCCB', 'CCCCCCCCCC', 'BCYCBBCYCB']],
      [1, ['BBBBBBBBBB', 'BBBBBBBBBB', 'BBBBBBBBBB']],
    ],
    cap: [
      [1, ['oooooooooo', 'YYYYYYYYYY', 'oooooooooo']],
      [1, ['..........', 'YYYYYYYYYY', '..........']],
      [1, ['..........', '...oyyo...', '..........']],
      [1, ['..........', '...yYYy...', '..........']],
      [1, ['..........', '....yy....', '..........']],
    ],
    floors: [
      [[1, ['BCCCCCCCCB', 'CCCCCCCCCC', 'BCYCCCCYCB']]],
      [[1, ['BBBBBBBBBB', 'BBBBBBBBBB', 'BoBoBBoBoB']]],
    ],
  },

  // 수리소: 빨간 벽돌 대장간 + 굴뚝(연기) + 마당의 모루와 달군 쇠
  workshop: {
    body: [
      [1, ['DDDDDDDDDD', 'DDDDDDDDDD', 'DDDDDDDDDD']],
      [1, ['RRrRRRrR..', 'RRRRRRRRK.', 'RrBBRRrR..']],
      [1, ['RrRRrRRr..', 'RRRRRRRRKK', 'RRBBRFFR..']],
      [1, ['RRRrRRRr..', 'RRRRRRRRF.', 'rDDDRRRr..']],
    ],
    cap: [
      [1, ['DDDDDDDD..', 'DDDDDDDD..', 'DDDDDDDD..']],
      [1, ['.A........', 'KKKKKKKK..', '..........']],
      [1, ['.A........', '..........', '..........']],
      [1, ['.D........', '..........', '..........']],
    ],
    floors: [
      [[1, ['RrRRRrRR..', 'RRRRRRRR..', 'RYYRrYYR..']]],
      [[1, ['RRrRRRrR..', 'RRRRRRRR..', 'YYYYYYYY..']]],
    ],
    smoke: { col: 1, row: 0, layer: 4, reach: 0 },
  },
};

const DEG = Math.PI / 180;

// 부품 블록 목록 (자리 가운데 기준 위치, 돌바닥 윗면 = y 0). 쌓는 순서 = 목록 순서 (아래층부터)
export function partVoxels(typeId, level, socket) {
  const design = designOf(typeId);
  const place = placement(socket);
  const voxels = [];
  if (level <= 1) {
    const top = addLayers(voxels, design.body, 0, place, false, typeId);
    addLayers(voxels, design.cap, top, place, true, typeId);
    return voxels;
  }
  const floors = design.floors[level - 2];
  if (!floors) return voxels;
  addLayers(voxels, floors, floorBase(design, level), place, false, typeId);
  return voxels;
}

// 대포 구멍·굴뚝 같은 지붕 위 특별한 곳의 위치 (레벨 1 기준)
export function partAnchor(typeId, name, socket) {
  const design = designOf(typeId);
  const anchor = design[name];
  if (!anchor) return null;
  const sample = design.cap[0][1];
  const local = toLocal(anchor.col, anchor.row, sample[0].length, sample.length);
  const [x, z] = placement(socket)(local.x, local.z);
  return { x, y: layersHeight(design.body) + anchor.layer + 0.5, z, reach: anchor.reach ?? 0 };
}

function designOf(typeId) {
  const design = PART_DESIGNS[typeId];
  if (!design) throw new Error(`없는 성 부품 종류: ${typeId}`);
  return design;
}

// 레벨 L 의 새 층이 시작하는 높이 = 몸통 + 그 전 레벨들의 층
function floorBase(design, level) {
  let y = layersHeight(design.body);
  for (let k = 0; k < level - 2; k++) y += layersHeight(design.floors[k] ?? []);
  return y;
}

function layersHeight(layers) {
  return layers.reduce((sum, [times]) => sum + times, 0);
}

// 층들을 블록 목록에 더함 → 다 쌓은 뒤의 높이
function addLayers(voxels, layers, startY, place, cap, typeId) {
  let y = startY;
  for (const [times, map] of layers) {
    for (let t = 0; t < times; t++) {
      const layer = [];
      map.forEach((row, r) => {
        if (row.length !== map[0].length) throw new Error(`성 부품 '${typeId}' 지도 줄 길이가 달라요: '${row}'`);
        for (let c = 0; c < row.length; c++) {
          const char = row[c];
          if (char === '.' || char === ' ') continue;
          const hex = PART_COLORS[char];
          if (!hex) throw new Error(`성 부품 '${typeId}' 지도에 없는 글자 '${char}'`);
          const local = toLocal(c, r, row.length, map.length);
          const [x, z] = place(local.x, local.z);
          layer.push({ x, y, z, hex, cap, order: scatter(c, r, y) });
        }
      });
      // 한 층 안에서는 흩어진 순서로 쌓아서 자연스럽게 보이게 함 (늘 같은 순서)
      layer.sort((a, b) => a.order - b.order);
      for (const voxel of layer) {
        delete voxel.order;
        voxels.push(voxel);
      }
      y += 1;
    }
  }
  return y;
}

// 지도 칸(col, row) → 부품 가운데 기준 위치 (오른쪽 = +x, 아래 줄 = +z = 바깥쪽)
function toLocal(col, row, columns, rows) {
  return { x: col - (columns - 1) / 2, z: row - (rows - 1) / 2 };
}

// 지도 방향 → 실제 자리 방향
//   모서리: 바깥 모서리가 (+x, +z) 쪽이 되게 그린 것을 자리 방향에 맞게 뒤집음
//   옆면: 바깥쪽이 +z 쪽이 되게 그린 것을 자리 방향(facing)만큼 돌림
function placement(socket) {
  const facing = (socket.facing ?? 90) * DEG;
  if (socket.kind === 'corner') {
    const sx = Math.cos(facing) < 0 ? -1 : 1;
    const sz = Math.sin(facing) < 0 ? -1 : 1;
    return (x, z) => [tidy(x * sx), tidy(z * sz)];
  }
  const turn = facing - 90 * DEG;
  const cos = Math.round(Math.cos(turn));
  const sin = Math.round(Math.sin(turn));
  return (x, z) => [tidy(x * cos - z * sin), tidy(x * sin + z * cos)];
}

function tidy(value) {
  return Math.round(value * 2) / 2 + 0; // 반 칸 단위로 맞추고 -0 없앰
}

function scatter(col, row, y) {
  const n = Math.sin(col * 12.9898 + row * 78.233 + y * 37.719) * 43758.5453;
  return n - Math.floor(n);
}
