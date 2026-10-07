// 둥근 소품 모양 (나무, 덤불, 바위)
// 동그란 덩어리는 글자 지도로 그리기 어려워서 '공(타원) 모양 안의 칸에 블록을 채우는' 규칙으로 만듭니다.
// 겉에서 보이는 블록만 남기고 속은 비워서 가볍게 합니다. 무늬는 늘 같게 나옵니다.
//
//   createRoundProp(kind, variant) → [{ x, y, z, hex }]     kind: 'tree' | 'bush' | 'rock'
//   ROUND_DESIGNS                                         아래 설계 (숫자를 바꾸면 모양이 바뀜)
//
// 덩어리 하나 = { width 가로·세로 칸 수(짝수 권장), height 높이 칸 수, base 시작 높이, colors: [아래쪽, 가운데, 위쪽],
//                 dots: { hex, chance } 겉에 콕콕 박히는 열매·꽃, bumpy 0~1 울퉁불퉁한 정도,
//                 fill 0~0.5 클수록 네모에 가깝게 꽉 참, flat: true 면 밑이 넓적함 (바위) }
// 나무는 trunk { width, height, hex, top } 줄기도 있습니다.

export const ROUND_DESIGNS = {
  tree: [
    // 0 동그란 나무
    {
      trunk: { width: 2, height: 4, hex: '#582A12', top: '#AA7D55' },
      blobs: [{ width: 8, height: 6, base: 3, colors: ['#237841', '#4B9F4A', '#BBE90B'], bumpy: 0.25 }],
    },
    // 1 큰 사과나무 (빨간 사과)
    {
      trunk: { width: 2, height: 4, hex: '#582A12', top: '#AA7D55' },
      blobs: [{ width: 10, height: 7, base: 3, colors: ['#184632', '#237841', '#4B9F4A'], dots: { hex: '#C91A09', chance: 0.07 }, bumpy: 0.25 }],
    },
    // 2 분홍 꽃나무
    {
      trunk: { width: 2, height: 4, hex: '#582A12', top: '#AA7D55' },
      blobs: [{ width: 8, height: 6, base: 3, colors: ['#C870A0', '#E4ADC8', '#F4F4F4'], dots: { hex: '#FF698F', chance: 0.08 }, bumpy: 0.3 }],
    },
  ],
  bush: [
    { blobs: [{ width: 4, height: 3, base: 0, colors: ['#237841', '#4B9F4A', '#4B9F4A'], bumpy: 0.15, fill: 0.2 }] },
    { blobs: [{ width: 4, height: 3, base: 0, colors: ['#237841', '#4B9F4A', '#BBE90B'], dots: { hex: '#F2CD37', chance: 0.18 }, bumpy: 0.15, fill: 0.2 }] },
    { blobs: [{ width: 6, height: 3, base: 0, colors: ['#184632', '#237841', '#4B9F4A'], dots: { hex: '#FF698F', chance: 0.12 }, bumpy: 0.25 }] },
  ],
  rock: [
    { blobs: [{ width: 4, height: 3, base: 0, colors: ['#6C6E68', '#A0A5A9', '#A0A5A9'], bumpy: 0.15, flat: true }] },
    { blobs: [{ width: 6, height: 4, base: 0, colors: ['#6C6E68', '#A0A5A9', '#A0A5A9'], dots: { hex: '#237841', chance: 0.1 }, bumpy: 0.15, flat: true }] },
    { blobs: [{ width: 2, height: 2, base: 0, colors: ['#6C6E68', '#A0A5A9', '#A0A5A9'], bumpy: 0, flat: true }] },
  ],
};

export function createRoundProp(kind, variant = 0) {
  const list = ROUND_DESIGNS[kind];
  const design = list[((variant % list.length) + list.length) % list.length];
  const cells = new Map();
  const put = (x, y, z, hex) => cells.set(`${x},${y},${z}`, { x, y, z, hex });

  if (design.trunk) {
    const { width, height, hex, top } = design.trunk;
    for (let y = 0; y < height + 2; y++) {
      for (const x of centered(width)) for (const z of centered(width)) put(x, y + 0.5, z, y >= height - 1 ? top : hex);
    }
    // 뿌리: 줄기 밑동 둘레에 한 칸씩
    put(-1.5, 0.5, 0.5, hex);
    put(1.5, 0.5, -0.5, hex);
    put(0.5, 0.5, 1.5, hex);
  }

  design.blobs.forEach((blob, b) => {
    const r = blob.width / 2;
    const ry = blob.height / 2;
    const cy = blob.base + ry;
    for (const x of centered(blob.width)) {
      for (const z of centered(blob.width)) {
        for (let layer = 0; layer < blob.height; layer++) {
          const y = blob.base + layer + 0.5;
          const d = (x / r) ** 2 + (z / r) ** 2 + ((y - cy) / ry) ** 2;
          const limit = 1.08 + (blob.fill ?? 0) - (blob.bumpy ?? 0) * noise(x, y, z + b);
          if (d > limit) continue;
          if (blob.flat && layer === 0 && d > 0.75) continue; // 바위 밑은 덜 둥글게
          const t = layer / Math.max(1, blob.height - 1);
          let hex = blob.colors[t < 0.34 ? 0 : t < 0.75 ? 1 : 2];
          if (t >= 0.75 && noise(z, y, x) < 0.35) hex = blob.colors[1]; // 위쪽 밝은 색에 얼룩
          if (blob.dots && noise(x + 3, y, z) < blob.dots.chance && layer > 0) hex = blob.dots.hex;
          put(x, y, z, hex);
        }
      }
    }
  });

  return surfaceOnly(cells);
}

// 겉으로 드러난 블록만 남김 (여섯 방향이 모두 막힌 속 블록은 빼서 가볍게)
function surfaceOnly(cells) {
  const result = [];
  const has = (x, y, z) => cells.has(`${x},${y},${z}`);
  for (const v of cells.values()) {
    const hidden = has(v.x + 1, v.y, v.z) && has(v.x - 1, v.y, v.z) && has(v.x, v.y + 1, v.z) && has(v.x, v.y - 1, v.z) && has(v.x, v.y, v.z + 1) && has(v.x, v.y, v.z - 1);
    if (!hidden) result.push(v);
  }
  return result;
}

// 가운데를 0으로 하는 칸 자리 목록 (짝수면 ±0.5, ±1.5 …)
function centered(count) {
  return Array.from({ length: count }, (_, i) => i - (count - 1) / 2);
}

function noise(a, b, c) {
  const n = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453;
  return n - Math.floor(n);
}
