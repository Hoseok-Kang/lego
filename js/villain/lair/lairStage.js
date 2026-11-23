// 소굴 3D 무대 (렌더러 · 장면 · 카메라 · 빛 · 밝은/어두운 화면 따라가기)
// 달빛(그림자를 만드는 빛) + 하늘빛 + 앞에서 비추는 은은한 빛 + 플라스틱 반짝임(반사광).
// 페이지의 data-theme(또는 기기의 어두운 화면 설정)이 바뀌면 빛 세기와 하늘 색을 저절로 바꿉니다.
//
//   const stage = createLairStage(container)
//   stage.renderer / scene / camera / canvas
//   stage.onTheme = (dark) => …        테마가 바뀔 때 (하늘 색 바꾸기용)
//   stage.setTheme('auto' | 'light' | 'dark')    stage.dark → 지금 어두운 화면인지
//   stage.fitLand(size)                 달빛 그림자가 땅판 전체를 덮게
//   stage.dispose()
//
// 빛 세기 · 색은 아래 LIGHT, 달빛 방향은 MOON_DIR 에서 바꿉니다.

import * as THREE from '../../lib/three.js';
import { createStudioLight } from '../../scene/stage.js';
import { TILE } from './lairKit.js';

const MAX_PIXEL_RATIO = 2; // 화면 선명도 최대 배율 (휴대폰이 버벅이면 1.5 로)
const LIGHT = {
  dark: { sky: '#a898ff', ground: '#2a1640', hemi: 0.95, moon: 2.4, env: 0.32, fill: 0.7 },
  light: { sky: '#cbbcff', ground: '#3d2259', hemi: 1.15, moon: 2.6, env: 0.42, fill: 0.85 },
};
const MOON_DIR = [-0.5, 1, 0.65]; // 달빛이 오는 쪽 (왼쪽 앞 위) → 그림자는 오른쪽 뒤로
const FILL_DIR = [0.2, 0.12, 1]; // 앞에서 거의 수평으로 → 시설 앞면만 밝히고 땅 윗면은 그대로
const SHADOW_SIZE = 2048;

export function createLairStage(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false; // 움직임이 있을 때만 그림자를 다시 그림 (lairView 가 needsUpdate)
  renderer.toneMapping = THREE.NeutralToneMapping;
  const canvas = renderer.domElement;
  canvas.className = 'lair-canvas';
  Object.assign(canvas.style, { display: 'block', width: '100%', height: '100%' });
  container.appendChild(canvas);

  const scene = new THREE.Scene();
  const env = createStudioLight(renderer);
  scene.environment = env;
  const camera = new THREE.PerspectiveCamera(30, 1, 1, 1500);
  scene.add(camera);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x000000, 1);
  const moon = new THREE.DirectionalLight(0xe6e0ff, 2);
  moon.castShadow = true;
  const small = Math.min(window.innerWidth, window.innerHeight) < 700;
  moon.shadow.mapSize.set(small ? SHADOW_SIZE / 2 : SHADOW_SIZE, small ? SHADOW_SIZE / 2 : SHADOW_SIZE);
  moon.shadow.bias = -0.0006;
  moon.shadow.normalBias = 0.05;
  const fill = new THREE.DirectionalLight(0xffe2c8, 0.7);
  fill.position.set(...FILL_DIR);
  scene.add(hemi, moon, moon.target, fill);

  let mode = 'auto';
  let dark = true;
  const stage = { renderer, scene, camera, canvas, onTheme: null };

  function isDark() {
    if (mode === 'dark') return true;
    if (mode === 'light') return false;
    const attr = document.documentElement.dataset.theme;
    if (attr === 'dark') return true;
    if (attr === 'light') return false;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true;
  }
  function applyTheme() {
    dark = isDark();
    const l = dark ? LIGHT.dark : LIGHT.light;
    hemi.color.set(l.sky);
    hemi.groundColor.set(l.ground);
    hemi.intensity = l.hemi;
    moon.intensity = l.moon;
    fill.intensity = l.fill;
    scene.environmentIntensity = l.env;
    stage.onTheme?.(dark);
  }
  const media = window.matchMedia?.('(prefers-color-scheme: dark)');
  media?.addEventListener?.('change', applyTheme);
  const themeWatch = typeof MutationObserver !== 'undefined' ? new MutationObserver(applyTheme) : null;
  themeWatch?.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  const dir = new THREE.Vector3();
  return Object.assign(stage, {
    get dark() {
      return dark;
    },
    setTheme(next = 'auto') {
      mode = next;
      applyTheme();
    },
    refreshTheme: applyTheme,
    fitLand(size) {
      const half = (size * TILE) / 2 + 4;
      dir.set(...MOON_DIR).normalize();
      moon.position.copy(dir).multiplyScalar(half * 3);
      moon.target.position.set(0, 0, 0);
      const c = moon.shadow.camera;
      const r = half * 1.25;
      Object.assign(c, { left: -r, right: r, top: r, bottom: -r, near: 1, far: half * 6 });
      c.updateProjectionMatrix();
      renderer.shadowMap.needsUpdate = true;
    },
    dispose() {
      media?.removeEventListener?.('change', applyTheme);
      themeWatch?.disconnect();
      env.dispose?.();
      renderer.dispose();
      canvas.remove();
    },
  });
}
