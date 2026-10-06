// 색 맞추기
// 그림의 각 칸 색을 블록 색 목록 중 '눈으로 봤을 때 가장 비슷한 색'으로 바꿉니다.
// 사람 눈 기준으로 색 차이를 재는 Lab 색공간을 사용합니다.
// 결과: { columns, rows, cells }  (cells[i] = 블록 색 번호 또는 빈칸 null)

export function quantizeGrid(grid, palette, { dithering = false } = {}) {
  const { columns, rows, cells } = grid;
  const nearest = createColorMatcher(palette);
  const out = new Array(cells.length).fill(null);

  if (!dithering) {
    cells.forEach((cell, i) => {
      if (cell) out[i] = nearest(cell.r, cell.g, cell.b);
    });
    return { columns, rows, cells: out };
  }

  // 색 섞기(플로이드-스타인버그 디더링):
  // 한 칸에서 생긴 색 오차를 오른쪽·아래 칸에 나눠 줘서 멀리서 보면 부드러운 색이 됩니다.
  const paletteRgb = palette.map((color) => hexToRgb(color.hex));
  const buffer = new Float32Array(cells.length * 3);
  cells.forEach((cell, i) => {
    if (!cell) return;
    buffer[i * 3] = cell.r;
    buffer[i * 3 + 1] = cell.g;
    buffer[i * 3 + 2] = cell.b;
  });
  const spread = (x, y, er, eg, eb, weight) => {
    if (x < 0 || x >= columns || y >= rows) return;
    const j = y * columns + x;
    if (!cells[j]) return;
    buffer[j * 3] += er * weight;
    buffer[j * 3 + 1] += eg * weight;
    buffer[j * 3 + 2] += eb * weight;
  };
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      const i = y * columns + x;
      if (!cells[i]) continue;
      const r = clamp255(buffer[i * 3]);
      const g = clamp255(buffer[i * 3 + 1]);
      const b = clamp255(buffer[i * 3 + 2]);
      const index = nearest(r, g, b);
      out[i] = index;
      const picked = paletteRgb[index];
      const er = r - picked.r;
      const eg = g - picked.g;
      const eb = b - picked.b;
      spread(x + 1, y, er, eg, eb, 7 / 16);
      spread(x - 1, y + 1, er, eg, eb, 3 / 16);
      spread(x, y + 1, er, eg, eb, 5 / 16);
      spread(x + 1, y + 1, er, eg, eb, 1 / 16);
    }
  }
  return { columns, rows, cells: out };
}

export function createColorMatcher(palette) {
  const labs = palette.map((color) => rgbToLab(hexToRgb(color.hex)));
  const cache = new Map();
  return function nearest(r, g, b) {
    const key = (r << 16) | (g << 8) | b;
    const cached = cache.get(key);
    if (cached !== undefined) return cached;
    const lab = rgbToLab({ r, g, b });
    let best = 0;
    let bestDistance = Infinity;
    for (let i = 0; i < labs.length; i++) {
      const dL = lab.L - labs[i].L;
      const da = lab.a - labs[i].a;
      const db = lab.b - labs[i].b;
      const d = dL * dL + da * da + db * db;
      if (d < bestDistance) {
        bestDistance = d;
        best = i;
      }
    }
    cache.set(key, best);
    return best;
  };
}

export function hexToRgb(hex) {
  const value = parseInt(hex.slice(1), 16);
  return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
}

export function rgbToLab({ r, g, b }) {
  const R = srgbToLinear(r);
  const G = srgbToLinear(g);
  const B = srgbToLinear(b);
  const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const fx = labF(x);
  const fy = labF(y);
  const fz = labF(z);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

function srgbToLinear(channel) {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function labF(t) {
  return t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116;
}

function clamp255(value) {
  return Math.max(0, Math.min(255, Math.round(value)));
}
