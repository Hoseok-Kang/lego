// 소굴 시설 그림 도구 (블록을 '상자, 벽, 한 칸' 으로 쌓는 도구 + 색 이름 + 작은 장식 모양)
// 시설 그림 파일(facilityArtBig.js, facilityArtSmall.js, facilityArt.js)이 같이 씁니다.
// 칸 좌표는 정수: x 오른쪽, y 위(0 = 땅 칸 바로 위 층), z 앞쪽(카메라 쪽). 1×1 시설은 x,z 0~4, 2×2 시설은 0~9.
//
//   const s = createArtShape()
//   s.set(x, y, z, 색, 빛남?)   s.glow(x, y, z, 색)        한 칸 (색을 null 로 주면 지움)
//   s.box(x0, y0, z0, x1, y1, z1, 색, 빛남?)                 꽉 찬 상자 (끝 칸 포함)
//   s.walls(x0, y0, z0, x1, y1, z1, 색)                      속이 빈 네모 벽
//   s.clear(x0, y0, z0, x1, y1, z1)                          지우기
//   s.has(x, y, z)  /  s.topAt(x, z) → 그 줄에서 가장 높은 블록 바로 위 층 (없으면 0)
//   s.voxels() → [{ x, y, z, hex, glow }]
//
//   C                        색 이름표 (js/bricks/brickColors.js 의 색만)
//   fire(s, x, y, z)         작은 불꽃 (빨강·주황·노랑 빛 블록)
//   crown(s, cx, y, cz)      금관 (3×3)
//   flag(s, x, y, z, 색)      깃대 + 깃발
//   pile(s, x0, z0, x1, z1, y, 색들, 씨앗)  울퉁불퉁 쌓인 더미 (동전·돌)

export const C = {
  white: '#F4F4F4',
  gray: '#A0A5A9',
  dark: '#6C6E68',
  black: '#1B2A34',
  red: '#C91A09',
  darkRed: '#720E0F',
  orange: '#FE8A18',
  darkOrange: '#A95500',
  tangerine: '#F8BB3D',
  yellow: '#F2CD37',
  lightYellow: '#FFF03A',
  sand: '#E4CD9E',
  darkSand: '#958A73',
  brown: '#582A12',
  caramel: '#AA7D55',
  tan: '#D09168',
  cream: '#F6D7B3',
  lime: '#BBE90B',
  green: '#4B9F4A',
  darkGreen: '#237841',
  forest: '#184632',
  sage: '#A0BCAC',
  teal: '#36AEBF',
  cyan: '#078BC9',
  sky: '#9FC3E9',
  midBlue: '#5A93DB',
  blue: '#0055BF',
  navy: '#0A3463',
  lilac: '#E1D5ED',
  lavender: '#AC78BA',
  purple: '#3F3691',
  magenta: '#923978',
  pinkDark: '#C870A0',
  pink: '#E4ADC8',
  coral: '#FF698F',
};

export function createArtShape() {
  const cells = new Map();
  const key = (x, y, z) => x + 32 + (y + 8) * 128 + (z + 32) * 128 * 128;

  function set(x, y, z, hex, glow = false) {
    if (hex) cells.set(key(x, y, z), { x, y, z, hex, glow });
    else cells.delete(key(x, y, z));
  }

  function box(x0, y0, z0, x1, y1, z1, hex, glow = false) {
    for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) set(x, y, z, hex, glow);
  }

  function walls(x0, y0, z0, x1, y1, z1, hex, glow = false) {
    for (let y = y0; y <= y1; y++) {
      for (let z = z0; z <= z1; z++) {
        for (let x = x0; x <= x1; x++) if (x === x0 || x === x1 || z === z0 || z === z1) set(x, y, z, hex, glow);
      }
    }
  }

  function topAt(x, z) {
    let top = 0;
    for (const c of cells.values()) if (c.x === x && c.z === z) top = Math.max(top, c.y + 1);
    return top;
  }

  return {
    set,
    glow: (x, y, z, hex) => set(x, y, z, hex, true),
    box,
    walls,
    clear: (x0, y0, z0, x1, y1, z1) => box(x0, y0, z0, x1, y1, z1, null),
    has: (x, y, z) => cells.has(key(x, y, z)),
    topAt,
    voxels: () => [...cells.values()],
  };
}

// 작은 불꽃: 아래 빨강 → 주황 → 노랑 끝
export function fire(s, x, y, z, tall = 2) {
  s.glow(x, y, z, C.orange);
  if (tall >= 2) s.glow(x, y + 1, z, C.lightYellow);
}

// 금관 (가운데 빨간 보석, 네 귀퉁이 뾰족)
export function crown(s, cx, y, cz) {
  s.box(cx - 1, y, cz - 1, cx + 1, y, cz + 1, C.yellow);
  s.glow(cx, y, cz + 1, C.red);
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) s.set(cx + dx, y + 1, cz + dz, C.yellow);
  s.set(cx, y + 1, cz, C.lightYellow);
}

// 깃대 + 깃발 (깃발은 오른쪽으로 2칸, 위 2줄)
export function flag(s, x, y, z, hex = C.magenta, height = 3) {
  s.box(x, y, z, x, y + height, z, C.black);
  s.box(x + 1, y + height - 1, z, x + 2, y + height, z, hex);
  s.set(x + 1, y + height, z, C.lime);
}

// 울퉁불퉁 쌓인 더미 (씨앗이 같으면 늘 같은 모양)
export function pile(s, x0, z0, x1, z1, y, colors, seed = 1) {
  let n = seed * 9301 + 49297;
  const rand = () => {
    n = (n * 9301 + 49297) % 233280;
    return n / 233280;
  };
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const rx = Math.max(0.5, (x1 - x0) / 2);
  const rz = Math.max(0.5, (z1 - z0) / 2);
  for (let z = z0; z <= z1; z++) {
    for (let x = x0; x <= x1; x++) {
      const d = Math.hypot((x - cx) / (rx + 0.5), (z - cz) / (rz + 0.5));
      const h = Math.max(0, Math.round((1 - d) * 2.4 + rand() * 0.8));
      for (let k = 0; k < h; k++) s.set(x, y + k, z, colors[Math.floor(rand() * colors.length)]);
    }
  }
}
