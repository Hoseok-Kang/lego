// 시설 누르기 판정 (블록 하나하나까지 정확하게)
// 먼저 시설 상자에 광선이 닿는지 보고, 닿으면 시설 안 블록 칸을 광선을 따라 한 칸씩 건너가며(DDA) 처음 만나는 블록을 찾습니다.
// 그래서 높은 의자 등받이 앞의 빈 공간을 누르면 시설이 아니라 그 뒤 땅 칸이 눌립니다 (보이는 대로 눌림).
//
//   rayHitArt(art, ox, oy, oz, dx, dy, dz, maxT) → 거리 | null
//       art: facilityArt 결과, (ox,oy,oz): 시설 가운데 기준 광선 시작점, (dx,dy,dz): 광선 방향(길이 1), maxT: 이 거리까지만
//   움직이는 조각(박쥐 · 톱날)은 누르기에서 빠집니다.

const occCache = new WeakMap();

// 시설 블록 자리 표 (가로 W × 높이 H × 세로 D)
function occupancy(art) {
  let occ = occCache.get(art);
  if (occ) return occ;
  const W = art.W;
  const D = art.D;
  const H = Math.ceil(art.pick.maxY) + 1;
  const data = new Uint8Array(W * H * D);
  for (const list of [art.solid, art.glow]) {
    for (const v of list) {
      const i = Math.floor(v.x + W / 2);
      const j = Math.floor(v.y);
      const k = Math.floor(v.z + D / 2);
      if (i >= 0 && i < W && j >= 0 && j < H && k >= 0 && k < D) data[i + W * (j + H * k)] = 1;
    }
  }
  occ = { data, W, H, D };
  occCache.set(art, occ);
  return occ;
}

export function rayHitArt(art, ox, oy, oz, dx, dy, dz, maxT = 1e6) {
  const { data, W, H, D } = occupancy(art);
  // 칸 좌표로 옮김 (0 ~ W, 0 ~ H, 0 ~ D)
  const px = ox + W / 2;
  const py = oy;
  const pz = oz + D / 2;
  // 상자에 들어가는 거리 · 나오는 거리
  let t0 = 0;
  let t1 = maxT;
  for (const [p, d, size] of [[px, dx, W], [py, dy, H], [pz, dz, D]]) {
    if (Math.abs(d) < 1e-9) {
      if (p < 0 || p > size) return null;
      continue;
    }
    let a = (0 - p) / d;
    let b = (size - p) / d;
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a);
    t1 = Math.min(t1, b);
    if (t0 > t1) return null;
  }
  let t = t0 + 1e-5;
  let ix = Math.min(W - 1, Math.max(0, Math.floor(px + dx * t)));
  let iy = Math.min(H - 1, Math.max(0, Math.floor(py + dy * t)));
  let iz = Math.min(D - 1, Math.max(0, Math.floor(pz + dz * t)));
  const sx = dx > 0 ? 1 : -1;
  const sy = dy > 0 ? 1 : -1;
  const sz = dz > 0 ? 1 : -1;
  const ddx = Math.abs(1 / (dx || 1e-9));
  const ddy = Math.abs(1 / (dy || 1e-9));
  const ddz = Math.abs(1 / (dz || 1e-9));
  let nx = (dx > 0 ? ix + 1 - px : px - ix) * ddx;
  let ny = (dy > 0 ? iy + 1 - py : py - iy) * ddy;
  let nz = (dz > 0 ? iz + 1 - pz : pz - iz) * ddz;
  // nx 등은 '시작점에서' 다음 경계까지의 거리 → 지금 t 보다 작으면 앞으로 당김
  while (nx < t) nx += ddx;
  while (ny < t) ny += ddy;
  while (nz < t) nz += ddz;
  for (let n = 0; n < W + H + D + 4; n++) {
    if (data[ix + W * (iy + H * iz)]) return t;
    if (nx <= ny && nx <= nz) {
      t = nx;
      nx += ddx;
      ix += sx;
    } else if (ny <= nz) {
      t = ny;
      ny += ddy;
      iy += sy;
    } else {
      t = nz;
      nz += ddz;
      iz += sz;
    }
    if (t > t1 || ix < 0 || iy < 0 || iz < 0 || ix >= W || iy >= H || iz >= D) return null;
  }
  return null;
}
