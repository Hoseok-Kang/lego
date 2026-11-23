// 소굴 땅판 (밤하늘에 둥둥 뜬 화산 바위 판)
// 위: 칸마다 돌기가 촘촘한 어두운 돌판(보라·검정 바둑판), 칸 사이 틈으로 아래 용암이 빛나서 칸 줄이 잘 보입니다.
// 둘레: 한 칸 높은 테두리 블록 + 네 귀퉁이 횃불. 앞쪽 아래: 뾰족뾰족 늘어진 바위(용암 금 + 초록 끈적이가 흘러내림).
// 땅이 넓어지면 새 칸이 용암 속에서 '퐁퐁' 솟아오릅니다.
//
//   const plate = createLairPlate()          plate.group 을 장면에 넣어 씀
//   plate.setSize(size, { from })            땅 크기 정하기. from(옛 크기)을 주면 새로 생긴 둘레 칸이 솟아오름
//   plate.update(dt, time)                   용암 반짝임 · 솟아오르기
//   plate.size / plate.rising                지금 크기 / 솟아오르는 중인지
//   plate.torches                            횃불 불꽃 자리 [Vector3] (불티 뿌리기용)
//   plate.grooveSpot(out) → out              칸 사이 틈 아무 곳 (용암 불티용)
//   plate.dispose()
//
// 색·두께·바위 깊이·솟는 빠르기는 아래 상수에서 바꿉니다. (블록 색은 js/bricks/brickColors.js 의 색만)

import * as THREE from '../../lib/three.js';
import { CONFIG } from '../../config.js';
import { getBlockAssets } from '../../game/core/blockAssets.js';
import { TILE, getLairMaterials, mergeGeos, seededRandom, ZERO_MATRIX } from './lairKit.js';

const MAX_SIZE = 16; // 가장 넓은 땅 (칸)
const GROOVE = 0.36; // 칸 사이 틈 (용암이 비침)
const SLAB = 0.5; // 칸 판 두께
const TILE_COLORS = [['#3F3691', 0.62], ['#1B2A34', 1.05]]; // 칸 바둑판 두 색 [색, 밝기] (짙은 보라, 검정)
const TILE_SHADE = 0.1; // 칸마다 밝기가 살짝 다른 정도
const RIM = '#1B2A34'; // 테두리 블록 색
const RIM_TICK = '#6C6E68'; // 칸 줄과 만나는 테두리 블록 (눈금)
const ROCK_COLORS = ['#1B2A34', '#1B2A34', '#1B2A34', '#1B2A34', '#3F3691']; // 아래 바위 색 (뽑기)
const LAVA_COLORS = ['#FE8A18', '#FE8A18', '#F8BB3D']; // 바위 틈 용암 블록
const SLIME = '#BBE90B';
const BODY = 3; // 판 몸통 두께 (블록)
const KEEL = 0.3; // 앞쪽 아래로 늘어진 바위 깊이 (땅 너비에 대한 비율)
const LAVA_PULSE = 0.18; // 칸 사이 용암이 숨 쉬듯 밝아졌다 어두워지는 정도
const RISE_SECONDS = 0.75; // 새 칸이 솟아오르는 시간
const RISE_STAGGER = 0.09; // 칸마다 늦게 시작하는 정도 (옛 땅에서 멀수록)
const RISE_DEPTH = 7; // 새 칸이 솟아오르기 시작하는 깊이

export function createLairPlate() {
  const group = new THREE.Group();
  group.name = 'lairPlate';
  const mats = getLairMaterials();

  // ── 칸 판 (판 + 돌기 25개를 한 모양으로) ──
  const tileGeo = makeTileGeometry();
  const tileMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55 });
  const tiles = new THREE.InstancedMesh(tileGeo, tileMat, MAX_SIZE * MAX_SIZE);
  tiles.receiveShadow = true;
  tiles.frustumCulled = false;
  tiles.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  group.add(tiles);

  // ── 칸 아래 용암 (틈으로 비침) ──
  const lavaTex = makeLavaTexture();
  const lavaMat = new THREE.MeshBasicMaterial({ map: lavaTex, color: 0xffffff });
  const lava = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), lavaMat);
  lava.rotation.x = -Math.PI / 2;
  lava.position.y = -SLAB - 0.02;
  group.add(lava);

  // ── 테두리 · 몸통 바위 · 용암 금 · 횃불 (크기가 바뀔 때마다 새로 쌓음) ──
  let rocks = null;
  let rockGlow = null;
  const torches = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];

  let size = 0;
  let riseTime = -1;
  const delay = new Float32Array(MAX_SIZE * MAX_SIZE).fill(-1);
  const matrix = new THREE.Matrix4();
  const color = new THREE.Color();
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const scl = new THREE.Vector3();

  function tileMatrix(i, lift, s) {
    const tx = i % size;
    const ty = (i / size) | 0;
    pos.set((tx + 0.5 - size / 2) * TILE, lift, (ty + 0.5 - size / 2) * TILE);
    scl.setScalar(s);
    return matrix.compose(pos, quat, scl);
  }

  function setSize(next, { from = null } = {}) {
    next = Math.max(1, Math.min(MAX_SIZE, Math.round(next)));
    const grew = from !== null && from < next;
    size = next;
    const rand = seededRandom(7);
    const shift = grew ? Math.floor((next - from) / 2) : 0;
    tiles.count = size * size;
    for (let i = 0; i < size * size; i++) {
      const tx = i % size;
      const ty = (i / size) | 0;
      const [base, bright] = TILE_COLORS[(tx + ty) % 2];
      color.set(base).multiplyScalar(bright * (1 - TILE_SHADE / 2 + rand() * TILE_SHADE));
      tiles.setColorAt(i, color);
      // 새로 생긴 칸: 옛 땅에서 먼 칸일수록 늦게 솟아오름
      const inside = !grew || (tx >= shift && tx < shift + from && ty >= shift && ty < shift + from);
      if (inside) {
        delay[i] = -1;
        tiles.setMatrixAt(i, tileMatrix(i, 0, 1));
      } else {
        const dx = Math.max(shift - tx, tx - (shift + from - 1), 0);
        const dy = Math.max(shift - ty, ty - (shift + from - 1), 0);
        const ring = Math.max(dx, dy);
        delay[i] = (ring - 1) * 0.35 + ((tx * 7 + ty * 13) % size) * RISE_STAGGER * (6 / size) + rand() * 0.08;
        tiles.setMatrixAt(i, ZERO_MATRIX);
      }
    }
    tiles.instanceMatrix.needsUpdate = true;
    if (tiles.instanceColor) tiles.instanceColor.needsUpdate = true;
    riseTime = grew ? 0 : -1;
    const span = size * TILE;
    lava.scale.set(span, span, 1);
    lavaTex.repeat.set(size / 2, size / 2);
    buildRocks();
  }

  function buildRocks() {
    if (rocks) {
      group.remove(rocks, rockGlow);
      rocks.dispose();
      rockGlow.dispose();
    }
    const solid = [];
    const glow = [];
    const rand = seededRandom(size * 31 + 5);
    const half = (size * TILE) / 2;
    const n = size * TILE + 2; // 테두리까지 한 줄 블록 수
    const at = (i) => i - half - 0.5; // i 번째 블록 줄의 가운데 좌표
    const pick = (list) => list[Math.floor(rand() * list.length)];
    // 테두리 (칸보다 살짝 높게)
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i !== 0 && j !== 0 && i !== n - 1 && j !== n - 1) continue;
        // 칸 줄과 만나는 자리 (줄 양옆 두 블록)는 눈금 색
        const along = i === 0 || i === n - 1 ? j : i;
        const tick = along > 2 && along < n - 3 && (along % TILE === 0 || along % TILE === 1);
        solid.push({ x: at(i), y: 0, z: at(j), hex: tick ? RIM_TICK : RIM });
      }
    }
    // 앞쪽 아래 늘어진 바위: 가운데가 깊은 V 모양 + 들쭉날쭉 + 가끔 고드름
    const depth = new Int16Array(n);
    const keel = Math.round(size * TILE * KEEL);
    for (let i = 0; i < n; i++) {
      const u = Math.abs((i + 0.5) / n - 0.5) * 2;
      let d = BODY + keel * Math.pow(Math.max(0, 1 - Math.pow(u, 1.35)), 1.6) + (rand() - 0.5) * 2.2;
      if (rand() < 0.12) d += 2 + rand() * 3;
      depth[i] = Math.max(BODY, Math.round(d));
    }
    const KEEL_ROWS = 3; // 앞쪽 몇 줄까지 바위 옆면을 쌓을지 (뒤쪽은 화면에 안 보임)
    for (let j = 0; j < n; j++) {
      const front = j === n - 1;
      for (let i = 0; i < n; i++) {
        const side = i === 0 || i === n - 1;
        const nearFront = j >= n - 1 - KEEL_ROWS;
        const d = nearFront ? Math.max(BODY, depth[i] - (n - 1 - j) * 2) : BODY;
        for (let k = 1; k <= d; k++) {
          const left = i > 0 ? (nearFront ? Math.max(BODY, depth[i - 1] - (n - 1 - j) * 2) : BODY) : 0;
          const right = i < n - 1 ? (nearFront ? Math.max(BODY, depth[i + 1] - (n - 1 - j) * 2) : BODY) : 0;
          const exposed = front || side || (nearFront && (left < k || right < k)) || (j === 0 && k <= BODY);
          if (!exposed) continue;
          solid.push({ x: at(i), y: -k, z: at(j), hex: pick(ROCK_COLORS) });
        }
      }
    }
    // 앞면 용암 금 (구불구불 아래로)
    const cracks = Math.max(3, Math.round(size * 0.6));
    const frontZ = at(n - 1) + 0.02;
    for (let c = 0; c < cracks; c++) {
      let i = Math.floor(((c + 0.3 + rand() * 0.4) / cracks) * n);
      for (let k = 1; k <= depth[i] - 1; k++) {
        if (rand() < 0.35) i = Math.max(0, Math.min(n - 1, i + (rand() < 0.5 ? -1 : 1)));
        if (k > depth[i] - 1) break;
        glow.push({ x: at(i), y: -k, z: frontZ + 0.04, hex: pick(LAVA_COLORS) });
      }
    }
    // 초록 끈적이 (앞 테두리에서 흘러내림)
    const drips = Math.max(4, size);
    for (let c = 0; c < drips; c++) {
      const i = 1 + Math.floor(rand() * (n - 2));
      const len = 1 + Math.floor(rand() * 3);
      glow.push({ x: at(i), y: 0, z: frontZ + 0.04, hex: SLIME, slime: true });
      for (let k = 1; k <= len; k++) glow.push({ x: at(i), y: -k, z: frontZ + 0.06, hex: SLIME, slime: true });
    }
    // 네 귀퉁이 횃불
    const corner = half + 0.5;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz], t) => {
      for (let y = 1; y <= 2; y++) solid.push({ x: sx * corner, y, z: sz * corner, hex: '#1B2A34' });
      solid.push({ x: sx * corner, y: 3, z: sz * corner, hex: '#6C6E68' });
      glow.push({ x: sx * corner, y: 4, z: sz * corner, hex: '#FE8A18' });
      glow.push({ x: sx * corner, y: 5, z: sz * corner, hex: '#FFF03A', small: true });
      torches[t].set(sx * corner, 5.6, sz * corner);
    });
    // 끈적이·용암 블록은 바위 앞에 살짝 튀어나오게 (같은 자리 바위 블록을 덮음)
    rocks = makeBlocks(solid, mats.solid, false);
    rockGlow = makeBlocks(glow, mats.glow, false);
    group.add(rocks, rockGlow);
  }

  function update(dt, time) {
    const pulse = 1 - LAVA_PULSE / 2 + Math.sin(time * 1.6) * (LAVA_PULSE / 2) + Math.sin(time * 4.3) * 0.03;
    lavaMat.color.setScalar(pulse);
    lavaTex.offset.set(Math.sin(time * 0.11) * 0.05, time * 0.012);
    if (riseTime < 0) return;
    riseTime += dt;
    let busy = false;
    for (let i = 0; i < size * size; i++) {
      if (delay[i] < 0) continue;
      const t = (riseTime - delay[i]) / RISE_SECONDS;
      if (t <= 0) {
        busy = true;
        tiles.setMatrixAt(i, ZERO_MATRIX);
        continue;
      }
      if (t >= 1) {
        tiles.setMatrixAt(i, tileMatrix(i, 0, 1));
        delay[i] = -1;
        continue;
      }
      busy = true;
      const back = easeOutBack(t);
      tiles.setMatrixAt(i, tileMatrix(i, -RISE_DEPTH * (1 - back), 0.35 + 0.65 * Math.min(1, t * 1.6)));
    }
    tiles.instanceMatrix.needsUpdate = true;
    if (!busy) riseTime = -1;
  }

  // 칸 사이 틈 아무 곳 (용암 불티가 올라올 자리)
  function grooveSpot(out) {
    const half = (size * TILE) / 2;
    const line = Math.floor(Math.random() * (size - 1)) + 1;
    const along = (Math.random() - 0.5) * size * TILE;
    const across = line * TILE - half;
    if (Math.random() < 0.5) out.set(across, -0.1, along);
    else out.set(along, -0.1, across);
    return out;
  }

  return {
    group,
    setSize,
    update,
    grooveSpot,
    torches,
    get size() {
      return size;
    },
    get rising() {
      return riseTime >= 0;
    },
    dispose() {
      tiles.dispose();
      tileGeo.dispose();
      tileMat.dispose();
      lava.geometry.dispose();
      lavaMat.dispose();
      lavaTex.dispose();
      rocks?.dispose();
      rockGlow?.dispose();
    },
  };
}

// 블록 목록 → 고정 블록 묶음 (작은 것: small 표시면 70% 크기)
function makeBlocks(list, material, shadow) {
  const { block } = getBlockAssets();
  const mesh = new THREE.InstancedMesh(block, material, Math.max(1, list.length));
  const m = new THREE.Matrix4();
  const c = new THREE.Color();
  list.forEach((v, i) => {
    m.makeScale(v.small ? 0.7 : 1, v.small ? 0.7 : 1, v.small ? 0.7 : 1);
    m.setPosition(v.x, v.y, v.z);
    mesh.setMatrixAt(i, m);
    mesh.setColorAt(i, c.set(v.hex));
  });
  mesh.count = list.length;
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  return mesh;
}

// 칸 한 장 = 얇은 판 + 돌기 5×5
function makeTileGeometry() {
  const { studRadius, studHeight } = CONFIG.block;
  const parts = [];
  const slab = new THREE.BoxGeometry(TILE - GROOVE, SLAB, TILE - GROOVE);
  slab.translate(0, -SLAB / 2, 0);
  parts.push(slab);
  for (let a = -2; a <= 2; a++) {
    for (let b = -2; b <= 2; b++) {
      const stud = new THREE.CylinderGeometry(studRadius, studRadius, studHeight, 8, 1, true);
      stud.translate(a, studHeight / 2, b);
      const cap = new THREE.CircleGeometry(studRadius, 8);
      cap.rotateX(-Math.PI / 2);
      cap.translate(a, studHeight, b);
      parts.push(stud, cap);
    }
  }
  return mergeGeos(parts);
}

// 용암 무늬 (주황 바탕에 노란 줄기, 검붉은 얼룩)
function makeLavaTexture() {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d');
  g.fillStyle = '#c2410c';
  g.fillRect(0, 0, size, size);
  const rand = seededRandom(3);
  const blob = (color, r) => {
    const x = rand() * size;
    const y = rand() * size;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    for (const [ox, oy] of [[0, 0], [size, 0], [-size, 0], [0, size], [0, -size]]) {
      g.save();
      g.translate(ox, oy);
      g.fillStyle = grad;
      g.fillRect(x - r, y - r, r * 2, r * 2);
      g.restore();
    }
  };
  for (let i = 0; i < 18; i++) blob('rgba(90,10,4,0.85)', 10 + rand() * 18);
  for (let i = 0; i < 26; i++) blob('rgba(255,170,40,0.9)', 6 + rand() * 14);
  for (let i = 0; i < 14; i++) blob('rgba(255,240,120,0.9)', 3 + rand() * 6);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function easeOutBack(t) {
  const c = 1.9;
  const u = t - 1;
  return 1 + (c + 1) * u * u * u + c * u * u;
}
