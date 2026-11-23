// 소굴 밤하늘 (위에서 아래로 짙어지는 하늘빛 + 반짝이는 별 + 커다란 달 + 아래로 흘러가는 보라 구름 + 멀리 떠 있는 작은 바위섬)
// 밝은 화면(라이트 테마)에서는 조금 밝은 저녁 하늘, 어두운 화면에서는 깊은 밤하늘이 됩니다.
//
//   const sky = createLairSky(scene, camera)
//   sky.setTheme(dark)                       true = 밤하늘, false = 저녁 하늘
//   sky.setFrame({ width, height, insets })  화면 크기 · 가림 (달 자리를 빈 화면 오른쪽 위에)
//   sky.update(dt, time)                     별 반짝 · 구름 흐름 · 바위섬 둥실
//   sky.dispose()
//
// 하늘 색은 아래 SKY 표, 별 개수 · 구름 수는 상수에서 바꿉니다.

import * as THREE from '../../lib/three.js';
import { getBlockAssets } from '../../game/core/blockAssets.js';
import { getLairMaterials, seededRandom } from './lairKit.js';

const SKY = {
  dark: { top: '#05030f', mid: '#140b33', bottom: '#2c1656', haze: '#4a2a7a', stars: 1, cloud: '#3a2266', moon: '#fff4d6' },
  light: { top: '#1e1650', mid: '#4a3796', bottom: '#9c7fd6', haze: '#d2b9f2', stars: 0.55, cloud: '#7a5cc0', moon: '#fffbe8' },
};
const STAR_COUNT = 260;
const STAR_DEPTH = 900; // 별이 있는 거리 (카메라 앞)
const CLOUD_COUNT = 9;
const CLOUD_Y = -70; // 구름 높이 (땅판보다 한참 아래)
const CLOUD_DRIFT = 2.2; // 구름이 흘러가는 빠르기
const ISLANDS = [
  // 멀리 떠 있는 작은 바위섬 [x, y, z, 크기]
  [-95, -38, -70, 7],
  [105, -52, -20, 5],
  [-80, -70, 70, 4],
];

export function createLairSky(scene, camera) {
  // 하늘빛 (세로 그라데이션 그림을 배경으로)
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 256;
  const bg = new THREE.CanvasTexture(canvas);
  bg.colorSpace = THREE.SRGBColorSpace;
  scene.background = bg;

  // 별 (카메라에 붙여서 늘 화면에 깔림)
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(STAR_COUNT * 3);
  const starInfo = new Float32Array(STAR_COUNT * 2); // 크기, 반짝 박자
  const rand = seededRandom(11);
  for (let i = 0; i < STAR_COUNT; i++) {
    starPos[i * 3] = (rand() - 0.5) * STAR_DEPTH * 2.2;
    starPos[i * 3 + 1] = (rand() - 0.5) * STAR_DEPTH * 0.95;
    starPos[i * 3 + 2] = -STAR_DEPTH;
    starInfo[i * 2] = rand() < 0.08 ? 3.4 + rand() * 1.6 : 1.3 + rand() * 1.6;
    starInfo[i * 2 + 1] = rand() * Math.PI * 2;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute('info', new THREE.BufferAttribute(starInfo, 2));
  const starMat = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, strength: { value: 1 }, pixel: { value: 1 } },
    vertexShader: `
      attribute vec2 info;
      uniform float time; uniform float pixel;
      varying float vGlow;
      void main() {
        vGlow = 0.55 + 0.45 * sin(time * (1.3 + info.y * 0.4) + info.y * 7.0);
        gl_PointSize = info.x * pixel * (0.75 + 0.25 * vGlow);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform float strength;
      varying float vGlow;
      void main() {
        vec2 c = gl_PointCoord - 0.5;
        float d = length(c) * 2.0;
        float core = smoothstep(1.0, 0.0, d);
        float cross = max(0.0, 1.0 - abs(c.x) * 9.0) * max(0.0, 1.0 - abs(c.y) * 2.2) + max(0.0, 1.0 - abs(c.y) * 9.0) * max(0.0, 1.0 - abs(c.x) * 2.2);
        float a = (core * core + cross * 0.35) * vGlow * strength;
        gl_FragColor = vec4(vec3(1.0, 0.95, 0.85) * a, a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const stars = new THREE.Points(starGeo, starMat);
  stars.frustumCulled = false;
  stars.renderOrder = -10;
  camera.add(stars);

  // 달 (카메라에 붙인 둥근 그림)
  const moonTex = makeMoonTexture();
  const moonMat = new THREE.SpriteMaterial({ map: moonTex, depthWrite: false, transparent: true, fog: false });
  const moon = new THREE.Sprite(moonMat);
  moon.renderOrder = -9;
  camera.add(moon);
  if (!camera.parent) scene.add(camera);

  // 아래로 흘러가는 구름 (부드러운 보라 덩어리)
  const cloudTex = makeCloudTexture();
  const clouds = [];
  for (let i = 0; i < CLOUD_COUNT; i++) {
    const mat = new THREE.SpriteMaterial({ map: cloudTex, depthWrite: false, transparent: true, opacity: 0.5 + rand() * 0.3 });
    const s = new THREE.Sprite(mat);
    const w = 70 + rand() * 90;
    s.scale.set(w, w * 0.42, 1);
    s.position.set((rand() - 0.5) * 360, CLOUD_Y - rand() * 50, (rand() - 0.6) * 220);
    s.userData.speed = CLOUD_DRIFT * (0.6 + rand() * 0.8);
    s.renderOrder = -8;
    clouds.push(s);
    scene.add(s);
  }

  // 멀리 떠 있는 작은 바위섬 (블록 몇 개 + 용암 한 점)
  const islands = makeIslands(rand);
  scene.add(islands.mesh, islands.glow);

  let palette = SKY.dark;
  function paint() {
    const g = canvas.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, palette.top);
    grad.addColorStop(0.45, palette.mid);
    grad.addColorStop(0.85, palette.bottom);
    grad.addColorStop(1, palette.haze);
    g.fillStyle = grad;
    g.fillRect(0, 0, 4, 256);
    bg.needsUpdate = true;
    starMat.uniforms.strength.value = palette.stars;
    moonMat.color.set(palette.moon);
    for (const c of clouds) c.material.color.set(palette.cloud);
  }
  paint();

  function setFrame({ width, height, insets = {} }) {
    // 달: 빈 화면 오른쪽 위 (카메라 앞 STAR_DEPTH 거리, 화면 좌표 → 카메라 좌표)
    const tanY = Math.tan((camera.fov * Math.PI) / 360);
    const tanX = tanY * (width / Math.max(1, height));
    const nx = 0.72;
    const ny = 1 - (2 * (insets.top || 0)) / Math.max(1, height) - 0.2;
    const depth = STAR_DEPTH * 0.9;
    moon.position.set(nx * tanX * depth, Math.min(0.8, ny) * tanY * depth, -depth);
    const size = Math.min(width, height) * 0.2;
    const world = (size / height) * 2 * tanY * depth;
    moon.scale.set(world, world, 1);
    starMat.uniforms.pixel.value = Math.min(2, window.devicePixelRatio || 1);
  }

  function update(dt, time) {
    starMat.uniforms.time.value = time;
    for (const c of clouds) {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 200) c.position.x -= 400;
    }
    islands.update(time);
  }

  return {
    setTheme(dark) {
      palette = dark ? SKY.dark : SKY.light;
      paint();
    },
    setFrame,
    update,
    dispose() {
      camera.remove(stars, moon);
      starGeo.dispose();
      starMat.dispose();
      moonMat.dispose();
      moonTex.dispose();
      cloudTex.dispose();
      for (const c of clouds) {
        scene.remove(c);
        c.material.dispose();
      }
      scene.remove(islands.mesh, islands.glow);
      islands.mesh.dispose();
      islands.glow.dispose();
      bg.dispose();
      if (scene.background === bg) scene.background = null;
    },
  };
}

// 작은 바위섬들: 거꾸로 선 뾰족 바위 + 용암 블록 하나, 천천히 오르락내리락
function makeIslands(rand) {
  const { block } = getBlockAssets();
  const mats = getLairMaterials();
  const solid = [];
  const glow = [];
  ISLANDS.forEach(([cx, cy, cz, r], n) => {
    for (let y = 0; y < r; y++) {
      const w = Math.max(0, r - y - 1);
      for (let x = -w; x <= w; x++) {
        for (let z = -w; z <= w; z++) {
          if (Math.abs(x) + Math.abs(z) > w + 1 || (y > 0 && rand() < 0.15)) continue;
          solid.push({ n, x: cx + x * 2, y: cy - y * 2, z: cz + z * 2, hex: rand() < 0.75 ? '#1B2A34' : '#3F3691' });
        }
      }
    }
    glow.push({ n, x: cx, y: cy + 2, z: cz, hex: '#FE8A18' });
    glow.push({ n, x: cx + 2, y: cy, z: cz + 2 * Math.max(1, r - 2), hex: '#BBE90B' });
  });
  const build = (list, material) => {
    const mesh = new THREE.InstancedMesh(block, material, Math.max(1, list.length));
    mesh.count = list.length;
    mesh.frustumCulled = false;
    const c = new THREE.Color();
    list.forEach((v, i) => mesh.setColorAt(i, c.set(v.hex)));
    return mesh;
  };
  const mesh = build(solid, mats.solid);
  const glowMesh = build(glow, mats.glow);
  function update(time) {
    placeIsland(solid, mesh, time);
    placeIsland(glow, glowMesh, time);
  }
  update(0);
  return { mesh, glow: glowMesh, update };
}

const islandMatrix = new THREE.Matrix4();
function placeIsland(list, target, time) {
  for (let i = 0; i < list.length; i++) {
    const v = list[i];
    const bob = Math.sin(time * 0.5 + v.n * 2.1) * 1.4;
    islandMatrix.makeScale(2, 2, 2);
    islandMatrix.setPosition(v.x, v.y + bob, v.z);
    target.setMatrixAt(i, islandMatrix);
  }
  target.instanceMatrix.needsUpdate = true;
}

// 달 그림: 둥근 달 + 은은한 빛 테 + 곰보 자국
function makeMoonTexture() {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const g = canvas.getContext('2d');
  const c = size / 2;
  const halo = g.createRadialGradient(c, c, size * 0.18, c, c, size * 0.5);
  halo.addColorStop(0, 'rgba(255,240,210,0.45)');
  halo.addColorStop(1, 'rgba(255,240,210,0)');
  g.fillStyle = halo;
  g.fillRect(0, 0, size, size);
  const body = g.createRadialGradient(c - 18, c - 18, 8, c, c, size * 0.22);
  body.addColorStop(0, '#fffdf2');
  body.addColorStop(1, '#f1dfb4');
  g.fillStyle = body;
  g.beginPath();
  g.arc(c, c, size * 0.22, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(200,170,120,0.45)';
  for (const [x, y, r] of [[-14, -10, 11], [16, 8, 8], [-4, 20, 6], [20, -18, 5]]) {
    g.beginPath();
    g.arc(c + x, c + y, r, 0, Math.PI * 2);
    g.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// 구름 그림: 흰 동그라미 여러 개를 흐리게 겹침 (색은 재질 색이 곱해짐)
function makeCloudTexture() {
  const w = 256;
  const h = 128;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d');
  const rand = seededRandom(5);
  for (let i = 0; i < 14; i++) {
    const x = w * (0.2 + rand() * 0.6);
    const y = h * (0.4 + rand() * 0.25);
    const r = 22 + rand() * 34;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.55)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
