// 건물 그림 공용 도구 (장난감 블록 색 이름표 + 계단 모양 세모 지붕)
// 꼬마 마을(buildingArt.js)·바닷가 마을(harborArt.js)·왕궁 성곽(castleArt.js) 건물 그림이 같이 씁니다.
//
//   C                                 색 이름 → '#RRGGBB' (js/bricks/brickColors.js 의 색만)
//   gableRoof(s, { x0, x1, z0, z1, y, roof, ridge, gable, gableX })   용마루가 x 방향인 세모 지붕 (한 층마다 두 줄씩 안으로)
//   roofHeightAt(z, d) → 그 줄의 지붕 높이 (굴뚝을 지붕 위에 딱 올릴 때)
//   battlements(s, x0, z0, x1, z1, y, hex)   네모 둘레에 톱니 난간 (한 칸 건너 한 칸)

export const C = {
  white: '#F4F4F4',
  gray: '#A0A5A9',
  darkGray: '#6C6E68',
  black: '#1B2A34',
  red: '#C91A09',
  darkRed: '#720E0F',
  orange: '#FE8A18',
  yellow: '#F2CD37',
  sand: '#E4CD9E',
  darkSand: '#958A73',
  brown: '#582A12',
  caramel: '#AA7D55',
  cream: '#F6D7B3',
  lime: '#BBE90B',
  green: '#4B9F4A',
  teal: '#36AEBF',
  sky: '#9FC3E9',
  midBlue: '#5A93DB',
  blue: '#0055BF',
  navy: '#0A3463',
  pink: '#E4ADC8',
  coral: '#FF698F',
  lavender: '#AC78BA',
  lightYellow: '#FFF03A',
  tangerine: '#F8BB3D',
  darkOrange: '#A95500',
  darkGreen: '#237841',
  forest: '#184632',
  sandGreen: '#A0BCAC',
  deepSky: '#078BC9',
  purple: '#3F3691',
  magenta: '#923978',
  apricot: '#D09168',
  lilac: '#E1D5ED',
};

// 계단 모양 세모 지붕 (용마루가 x 방향). 한 층마다 두 줄씩 놓아서 아래층 위에 걸쳐 앉음
export function gableRoof(s, { x0, x1, z0, z1, y, roof, ridge, gable, gableX }) {
  for (let k = 0; ; k++) {
    const a = z0 - 1 + k; // 앞뒤 바깥 줄
    const b = z1 + 1 - k;
    if (a + 1 >= b - 1) {
      s.box(x0, y + k, a, x1, y + k, b, ridge); // 맨 위 용마루
      break;
    }
    s.box(x0, y + k, a, x1, y + k, a + 1, roof);
    s.box(x0, y + k, b - 1, x1, y + k, b, roof);
    for (const x of gableX) s.box(x, y + k, a + 2, x, y + k, b - 2, gable); // 세모 벽
  }
}

// 위 지붕에서 z 줄의 높이 (굴뚝을 지붕 위에 딱 올리려고)
export function roofHeightAt(z, d) {
  for (let k = 0; ; k++) {
    const a = -1 + k;
    const b = d - k;
    if (a + 1 >= b - 1 || z <= a + 1 || z >= b - 1) return k + 1;
  }
}

// 톱니 난간: 네모 둘레를 따라 한 칸 건너 한 칸 (성벽·탑 꼭대기)
export function battlements(s, x0, z0, x1, z1, y, hex) {
  for (let x = x0; x <= x1; x++) {
    for (let z = z0; z <= z1; z++) {
      const edge = x === x0 || x === x1 || z === z0 || z === z1;
      if (edge && (x + z) % 2 === 0) s.set(x, y, z, hex);
    }
  }
}
