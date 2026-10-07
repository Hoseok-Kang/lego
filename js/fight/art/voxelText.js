// 글자 지도 → 블록 목록
// 토끼·무기·소품 모양을 '층마다 위에서 내려다본 글자 지도'로 적으면, 이 파일이 블록 목록으로 바꿔 줍니다.
// 글자 하나 = 블록 한 칸, '.' (또는 빈칸) = 블록 없음. 글자 → 색은 colors 표에서 찾습니다.
//
// 지도 읽는 법
//   layers = [[쌓는 횟수, 지도], ...]   맨 앞이 맨 아래층. [2, 지도] 는 같은 층을 두 번 쌓음
//   지도 = 줄 목록. 첫 줄 = 뒤쪽(-z), 마지막 줄 = 앞쪽(+z, 모델이 바라보는 쪽)
//   한 줄 안의 글자: 왼쪽(-x) → 오른쪽(+x)
//   가로·세로 가운데 칸이 0 이 되게 놓습니다. (칸 수가 홀수면 딱 맞고, 짝수면 .5 자리가 됨)
//   위치는 블록 '가운데' 입니다. 맨 아래층 블록의 가운데 높이 = 0.5 → 블록 밑면이 y = 0 에 닿음
//
//   parseLayers(layers, colors, { offset = [0,0,0], keepChar = false }) → [{ x, y, z, hex }]
//                     offset 만큼 옮겨서 돌려줌. keepChar: true 면 각 블록에 ch(지도 글자)도 붙임
//   mirrorX(voxels)                  좌우(x)를 뒤집은 새 목록
//   translate(voxels, dx, dy, dz)    옮긴 새 목록
//   recolor(voxels, map)             색 바꾼 새 목록. map = { '#원래색': '#새색' }
//   withoutChar(voxels)              ch 표시를 뺀 새 목록 ({ x, y, z, hex } 만 남김)
//   bounds(voxels)                   { min:[x,y,z], max:[x,y,z], size:[가로,높이,깊이] } (블록 겉면 기준)

export function parseLayers(layers, colors, { offset = [0, 0, 0], keepChar = false } = {}) {
  const voxels = [];
  let layerIndex = 0;
  for (const [times, rows] of layers) {
    const width = rows[0].length;
    for (const row of rows) {
      if (row.length !== width) throw new Error(`지도 줄 길이가 달라요: '${row}' (다른 줄은 ${width}칸)`);
    }
    for (let t = 0; t < times; t++) {
      rows.forEach((row, r) => {
        for (let c = 0; c < row.length; c++) {
          const ch = row[c];
          if (ch === '.' || ch === ' ') continue;
          const hex = colors[ch];
          if (!hex) throw new Error(`색 표에 없는 글자 '${ch}' (줄 '${row}')`);
          const voxel = {
            x: tidy(c - (width - 1) / 2 + offset[0]),
            y: tidy(layerIndex + 0.5 + offset[1]),
            z: tidy(r - (rows.length - 1) / 2 + offset[2]),
            hex,
          };
          if (keepChar) voxel.ch = ch;
          voxels.push(voxel);
        }
      });
      layerIndex += 1;
    }
  }
  return voxels;
}

export function mirrorX(voxels) {
  return voxels.map((v) => ({ ...v, x: tidy(-v.x) }));
}

export function translate(voxels, dx = 0, dy = 0, dz = 0) {
  return voxels.map((v) => ({ ...v, x: tidy(v.x + dx), y: tidy(v.y + dy), z: tidy(v.z + dz) }));
}

export function recolor(voxels, map) {
  return voxels.map((v) => ({ ...v, hex: map[v.hex] ?? v.hex }));
}

export function withoutChar(voxels) {
  return voxels.map(({ x, y, z, hex }) => ({ x, y, z, hex }));
}

export function bounds(voxels) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const v of voxels) {
    const p = [v.x, v.y, v.z];
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i], p[i] - 0.5);
      max[i] = Math.max(max[i], p[i] + 0.5);
    }
  }
  if (!voxels.length) return { min: [0, 0, 0], max: [0, 0, 0], size: [0, 0, 0] };
  return { min, max, size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]] };
}

// 소수 계산 찌꺼기(0.30000000004 같은 것)와 -0 을 없앰
function tidy(value) {
  return Math.round(value * 1000) / 1000 + 0;
}
