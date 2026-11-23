// 마을 바닥 타일 (길·흙길·모래밭·돌바닥 마당·나무 길·부두·바위·바다) + 바다 물결 + 첨벙
// 배치도의 ground(와 꼬마 마을의 roads)를 납작한 블록 판으로 깝니다. 바닥판 돌기를 덮을 만큼만 두꺼워요.
// 바다 위에는 하얀 물결 조각이 둥실둥실 흘러가고, 괴수가 물에 발을 디디면 물 블록이 첨벙 튑니다.
//
//   const ground = createTownGround(scene, layout, { debris })
//   ground.heightAt(x, z) → 그 자리 바닥 높이 (맨 위 타일 윗면, 타일이 없으면 0)
//   ground.kindAt(x, z) → 'water' | 'sand' | … | null (맨 위 타일 종류)
//       종류: road dirt sand stone avenue boardwalk pier rocks shallow water (아래 GROUND 표)
//   ground.isWet(x, z) → 물 위인지 (바다·얕은 물)
//   ground.splash(position, 세기 = 1) → 물 위면 첨벙 (물 블록이 튐), 아니면 아무것도 안 함
//   ground.update(dt) ; ground.dispose()
//
// 타일 색·높이·무늬는 아래 GROUND 표, 물결 수·빠르기는 아래 상수에서 바꿉니다. (색은 js/bricks/brickColors.js 의 색만)

import * as THREE from '../../lib/three.js';

// 종류 → { 색, 둘째 색(무늬), 무늬, 높이, 물인지 }. 무늬: 'stripeX' (x 로 한 칸씩 번갈아) | 'stripeZ' | 'checker'
export const GROUND = {
  road: { hex: '#E4CD9E', height: 0.18 }, // 모래색 길
  dirt: { hex: '#958A73', alt: '#AA7D55', pattern: 'checker', height: 0.18 }, // 흙길
  sand: { hex: '#F6D7B3', alt: '#E4CD9E', pattern: 'checker', height: 0.18 }, // 모래밭
  stone: { hex: '#E4CD9E', alt: '#958A73', pattern: 'checkerSoft', height: 0.17 }, // 돌바닥 마당 (모래색 돌)
  avenue: { hex: '#F4F4F4', alt: '#A0A5A9', pattern: 'checker', height: 0.19 }, // 왕궁 큰길 (흰·회색 바둑판)
  boardwalk: { hex: '#AA7D55', alt: '#D09168', pattern: 'stripeX', height: 0.2 }, // 나무 길
  pier: { hex: '#582A12', alt: '#AA7D55', pattern: 'stripeZ', height: 0.45 }, // 부두
  rocks: { hex: '#6C6E68', alt: '#A0A5A9', pattern: 'checker', height: 0.5 }, // 바위 언덕
  shallow: { hex: '#36AEBF', height: 0.24, wet: true }, // 얕은 물
  water: { hex: '#078BC9', height: 0.26, wet: true }, // 바다
};
const LAYER_STEP = 0.004; // 뒤에 적은 타일을 조금씩 높게 (겹친 곳이 깜빡이지 않게)
const WAVES_PER_CELL = 1 / 14; // 물 한 칸마다 물결 조각 수
const WAVE_SPEED = 0.8; // 물결이 옆으로 흐르는 빠르기
const WAVE_HEXES = ['#F4F4F4', '#9FC3E9'];
const SPLASH_HEXES = ['#9FC3E9', '#F4F4F4', '#078BC9', '#36AEBF'];
const SPLASH_BLOCKS = 9; // 첨벙 한 번에 튀는 물 블록 수

export function createTownGround(scene, layout, { debris = null } = {}) {
  const group = new THREE.Group();
  group.name = 'townGround';
  scene.add(group);
  const tiles = []; // { kind, x0, z0, x1, z1, top }
  const list = [...(layout.roads || []).map((r) => ({ kind: 'road', ...r })), ...(layout.ground || [])];
  const geometries = [];
  const materials = [];
  const box = new THREE.BoxGeometry(1, 1, 1);
  geometries.push(box);

  // 무늬 없는 타일은 판 하나, 무늬 타일은 한 칸짜리 블록을 한꺼번에 (InstancedMesh)
  const cells = []; // { x, z, h, hex }
  list.forEach((tile, i) => {
    const def = GROUND[tile.kind] || GROUND.road;
    const h = def.height + i * LAYER_STEP;
    tiles.push({ ...tile, top: h, def });
    if (!def.pattern) {
      const material = new THREE.MeshStandardMaterial({ color: def.hex, roughness: def.wet ? 0.25 : 0.5, metalness: 0 });
      materials.push(material);
      const mesh = new THREE.Mesh(box, material);
      mesh.scale.set(tile.x1 - tile.x0, h, tile.z1 - tile.z0);
      mesh.position.set((tile.x0 + tile.x1) / 2, h / 2, (tile.z0 + tile.z1) / 2);
      mesh.receiveShadow = true;
      group.add(mesh);
      return;
    }
    for (let x = tile.x0; x < tile.x1; x++) {
      for (let z = tile.z0; z < tile.z1; z++) {
        let second = false;
        if (def.pattern === 'stripeX') second = x % 2 !== 0;
        else if (def.pattern === 'stripeZ') second = z % 2 !== 0;
        else if (def.pattern === 'checker') second = (x + z) % 2 !== 0;
        else second = (x * 7 + z * 13) % 5 === 0; // checkerSoft: 드문드문
        cells.push({ x, z, h, hex: second ? def.alt : def.hex });
      }
    }
  });
  const matrix = new THREE.Matrix4();
  const color = new THREE.Color();
  if (cells.length) {
    const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0 });
    materials.push(material);
    const mesh = new THREE.InstancedMesh(box, material, cells.length);
    cells.forEach((c, i) => {
      mesh.setMatrixAt(i, matrix.makeScale(1, c.h, 1).setPosition(c.x + 0.5, c.h / 2, c.z + 0.5));
      mesh.setColorAt(i, color.set(c.hex));
    });
    mesh.receiveShadow = true;
    group.add(mesh);
  }

  // ── 바다 물결 ──
  const wet = tiles.filter((t) => t.def.wet);
  const waves = [];
  for (const t of wet) {
    const n = Math.round((t.x1 - t.x0) * (t.z1 - t.z0) * WAVES_PER_CELL);
    for (let i = 0; i < n; i++) {
      const seed = waves.length * 9.73;
      waves.push({ tile: t, x: t.x0 + frac(seed * 0.618) * (t.x1 - t.x0), z: t.z0 + 0.5 + Math.floor(frac(seed * 0.377) * (t.z1 - t.z0)), phase: frac(seed * 0.271) * 6.28 });
    }
  }
  let waveMesh = null;
  if (waves.length) {
    const material = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0 });
    materials.push(material);
    waveMesh = new THREE.InstancedMesh(box, material, waves.length);
    waves.forEach((w, i) => waveMesh.setColorAt(i, color.set(WAVE_HEXES[i % WAVE_HEXES.length])));
    group.add(waveMesh);
  }
  let time = 0;

  function update(dt) {
    if (!waveMesh) return;
    time += dt;
    waves.forEach((w, i) => {
      const t = w.tile;
      const span = t.x1 - t.x0 - 2;
      const x = t.x0 + 1 + ((((w.x - t.x0 + time * WAVE_SPEED) % span) + span) % span);
      const bob = Math.sin(time * 1.8 + w.phase);
      const len = 1.4 + 0.5 * Math.sin(time * 0.9 + w.phase);
      matrix.makeScale(len, 0.1, 0.32).setPosition(x, t.top + 0.04 + bob * 0.05, w.z);
      waveMesh.setMatrixAt(i, matrix);
    });
    waveMesh.instanceMatrix.needsUpdate = true;
  }

  function topTile(x, z) {
    let best = null;
    for (const t of tiles) if (x >= t.x0 && x < t.x1 && z >= t.z0 && z < t.z1 && (!best || t.top >= best.top)) best = t;
    return best;
  }

  const velocity = new THREE.Vector3();
  const splashColors = SPLASH_HEXES.map((hex) => new THREE.Color(hex));
  function splash(position, power = 1) {
    const t = topTile(position.x, position.z);
    if (!t || !t.def.wet || !debris) return false;
    const at = new THREE.Vector3(position.x, t.top + 0.3, position.z);
    for (let i = 0; i < SPLASH_BLOCKS; i++) {
      const a = (i / SPLASH_BLOCKS) * Math.PI * 2 + Math.random() * 0.5;
      const s = (3 + Math.random() * 4) * power;
      velocity.set(Math.cos(a) * s, (7 + Math.random() * 6) * power, Math.sin(a) * s);
      debris.spawn(at, splashColors[i % splashColors.length], velocity, { lifetime: 0.55 + Math.random() * 0.3, settle: false, scale: 0.4 + Math.random() * 0.3 });
    }
    return true;
  }

  update(0);
  return {
    heightAt: (x, z) => topTile(x, z)?.top ?? 0,
    kindAt: (x, z) => topTile(x, z)?.kind ?? null,
    isWet: (x, z) => !!topTile(x, z)?.def.wet,
    splash,
    update,
    dispose() {
      group.removeFromParent();
      for (const g of geometries) g.dispose();
      for (const m of materials) m.dispose();
      group.traverse((o) => o.isInstancedMesh && o.dispose());
    },
  };
}

function frac(v) {
  return v - Math.floor(v);
}
