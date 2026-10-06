// 그림 → 블록 격자
// 가로 칸 수를 정하면 그림 비율에 맞춰 세로 칸 수가 정해지고,
// 각 칸마다 그 칸을 가장 잘 대표하는 색 하나를 고릅니다.
// 결과: { columns, rows, cells }  (cells[행 * columns + 열] = {r,g,b} 또는 빈칸 null, 0행이 맨 위)

const SAMPLES = 4; // 한 칸을 4×4개의 점으로 나눠서 살펴봄

export function pixelate(source, columns, { maxRows = 100, alphaThreshold = 0.5 } = {}) {
  const fullW = source.naturalWidth || source.width;
  const fullH = source.naturalHeight || source.height;
  if (!fullW || !fullH) throw new Error('그림 크기가 0입니다');

  // 투명한 여백을 빼고 실제 그림이 있는 부분만 사용 → '가로 블록 수'가 그림 자체의 폭이 됨
  const area = findContentArea(source, fullW, fullH, alphaThreshold);

  let cols = Math.max(1, Math.round(columns));
  let rows = Math.max(1, Math.round((cols * area.height) / area.width));
  if (rows > maxRows) {
    rows = maxRows;
    cols = Math.max(1, Math.round((rows * area.width) / area.height));
  }

  const width = cols * SAMPLES;
  const data = readPixels(source, area, width, rows * SAMPLES);
  const cells = new Array(cols * rows);
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      cells[cy * cols + cx] = pickCellColor(data, width, cx * SAMPLES, cy * SAMPLES, alphaThreshold);
    }
  }
  return trimEmptyEdges({ columns: cols, rows, cells });
}

// 칸 하나의 색 고르기
// 1) 칸 안에서 같은 색이 여러 점을 차지하면(그림·만화) 그 색을 씁니다. → 경계가 또렷함
// 2) 아니면(사진) 평균색에 가장 가까운 실제 점의 색을 씁니다.
// 그냥 평균만 쓰면 경계마다 어중간한 회색 블록이 생깁니다.
const MAJORITY = 6; // 16개 점 중 이 개수 이상이 같은 색이면 그 색으로 결정

function pickCellColor(data, width, x0, y0, alphaThreshold) {
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let sumA = 0;
  const votes = new Map();
  for (let y = y0; y < y0 + SAMPLES; y++) {
    for (let x = x0; x < x0 + SAMPLES; x++) {
      const i = (y * width + x) * 4;
      const a = data[i + 3] / 255;
      sumR += data[i] * a;
      sumG += data[i + 1] * a;
      sumB += data[i + 2] * a;
      sumA += a;
      if (data[i + 3] < 128) continue;
      const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
      const vote = votes.get(key);
      if (vote) vote.count++;
      else votes.set(key, { count: 1, r: data[i], g: data[i + 1], b: data[i + 2] });
    }
  }
  if (sumA / (SAMPLES * SAMPLES) < alphaThreshold) return null;

  let top = null;
  for (const vote of votes.values()) if (!top || vote.count > top.count) top = vote;
  if (top && top.count >= MAJORITY) return { r: top.r, g: top.g, b: top.b };

  const avgR = sumR / sumA;
  const avgG = sumG / sumA;
  const avgB = sumB / sumA;
  let best = null;
  let bestDistance = Infinity;
  for (let y = y0; y < y0 + SAMPLES; y++) {
    for (let x = x0; x < x0 + SAMPLES; x++) {
      const i = (y * width + x) * 4;
      if (data[i + 3] < 128) continue;
      const d = (data[i] - avgR) ** 2 + (data[i + 1] - avgG) ** 2 + (data[i + 2] - avgB) ** 2;
      if (d < bestDistance) {
        bestDistance = d;
        best = { r: data[i], g: data[i + 1], b: data[i + 2] };
      }
    }
  }
  return best ?? { r: Math.round(avgR), g: Math.round(avgG), b: Math.round(avgB) };
}

// 그림에서 투명하지 않은 부분이 차지하는 영역 찾기 (작게 줄여서 빠르게 확인)
function findContentArea(source, fullW, fullH, alphaThreshold) {
  const scale = Math.min(1, 256 / Math.max(fullW, fullH));
  const w = Math.max(1, Math.round(fullW * scale));
  const h = Math.max(1, Math.round(fullH * scale));
  const ctx = makeCanvas(w, h).getContext('2d', { willReadFrequently: true });
  ctx.drawImage(source, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  const minAlpha = alphaThreshold * 255;
  let minX = w;
  let maxX = -1;
  let minY = h;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] < minAlpha) continue;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < 0) return { x: 0, y: 0, width: fullW, height: fullH };
  // 줄인 그림 기준 1칸만큼 여유를 두고 원래 크기로 되돌림
  const x0 = Math.max(0, (minX - 1) / scale);
  const y0 = Math.max(0, (minY - 1) / scale);
  const x1 = Math.min(fullW, (maxX + 2) / scale);
  const y1 = Math.min(fullH, (maxY + 2) / scale);
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

// 큰 사진을 한 번에 확 줄이면 품질이 떨어져서, 반씩 여러 번 나눠 줄입니다.
function readPixels(source, area, width, height) {
  let current = source;
  let curX = area.x;
  let curY = area.y;
  let curW = area.width;
  let curH = area.height;
  while (curW > width * 2 || curH > height * 2) {
    const nextW = Math.max(width, Math.floor(curW / 2));
    const nextH = Math.max(height, Math.floor(curH / 2));
    const step = makeCanvas(nextW, nextH);
    const stepCtx = step.getContext('2d');
    stepCtx.imageSmoothingQuality = 'high';
    stepCtx.drawImage(current, curX, curY, curW, curH, 0, 0, nextW, nextH);
    current = step;
    curX = 0;
    curY = 0;
    curW = nextW;
    curH = nextH;
  }
  const out = makeCanvas(width, height);
  const ctx = out.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(current, curX, curY, curW, curH, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height).data;
}

function makeCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

// 그림 둘레의 텅 빈 줄을 잘라 내서, 그림이 바닥판 위에 딱 서 있게 합니다.
function trimEmptyEdges(grid) {
  const { columns, rows, cells } = grid;
  let minX = columns;
  let maxX = -1;
  let minY = rows;
  let maxY = -1;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < columns; x++) {
      if (!cells[y * columns + x]) continue;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < 0) return grid; // 전부 빈칸
  const newCols = maxX - minX + 1;
  const newRows = maxY - minY + 1;
  if (newCols === columns && newRows === rows) return grid;

  const trimmed = new Array(newCols * newRows);
  for (let y = 0; y < newRows; y++) {
    for (let x = 0; x < newCols; x++) {
      trimmed[y * newCols + x] = cells[(y + minY) * columns + (x + minX)];
    }
  }
  return { columns: newCols, rows: newRows, cells: trimmed };
}
