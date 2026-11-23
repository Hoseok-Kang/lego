// 악당 소굴 3D 화면 (밤하늘에 뜬 화산 바위 판 위에 블록 시설을 짓는 곳)
// 자기 3D 화면(렌더러)과 장면 반복(rAF)을 갖고, 보일 때만 움직입니다. 땅판은 위 정보판 · 아래 단추 사이 빈 화면에 꽉 맞춥니다.
// 화면은 보여 주기와 '어디를 눌렀는지' 알리기만 하고, 실제로 짓고 · 팔고 · 저장하는 일은 부른 쪽(game.js)이 합니다.
//
//   const view = createLairView(container, { onTap, onGhostMove, manual })
//     onTap({ x, y, buildingId, tileX, tileY })   눌린 칸. 시설을 누르면 buildingId, 빈칸이면 null.
//                         짓는 중(placing)이면 x, y = 손가락 아래를 가운데로 한 시설 왼쪽 위 칸 (땅 안으로 맞춤), buildingId = null
//                         땅 밖(하늘)을 누르면 x = y = null
//     onGhostMove({ x, y })   짓는 중에 끌거나 마우스를 움직여 유령 칸이 바뀔 때 (없으면 끌기를 뗄 때 onTap 으로 알림)
//     manual: true 면 스스로 돌지 않음 → view.step(dt) 로 한 장면씩 (녹화 · 시험용)
//   view.setLair(lair, evaluation)        소굴 · 계책 계산 결과 보여 주기 (땅이 넓어졌으면 새 칸이 솟아오름)
//   view.startPlacing(type, { moveId })   짓기(또는 옮기기) 시작 → 유령이 나타남
//   view.setGhost(x, y, { valid, gained, lost, evaluation })   유령 자리 · 놓을 수 있는지 · 켜질/꺼질 계책 (lairSim.previewPlace 결과를 그대로 줘도 됨)
//   view.stopPlacing()
//   view.select(id | null)                시설 고르기 (테두리 + 그 시설의 계책 줄만 밝게)
//   view.playBuild(id) / playUpgrade(id) / playRemove(id)   짓기 · 강화 · 팔기 움직임 (setLair 앞이든 뒤든 같은 차례에 부르면 됨)
//   view.showLand(size)                   새 땅 칸이 솟아오르는 움직임 (setLair 로 넓어질 때 저절로도 나옴; 다시 보여 주기)
//   view.pulseScheme(key)                 계책이 켜진 순간: 시설마다 빛 고리 + 반짝 + 계책 이름 글자
//   view.setInsets({ top, bottom, left, right })   화면 가장자리를 가리는 정보판 · 단추 크기(px)
//   view.setTheme('auto' | 'light' | 'dark')       하늘 색 (기본 auto: 페이지 data-theme 또는 기기 설정)
//   view.screenPoint(id) → { x, y } | null         시설 지붕 위의 화면(페이지) 좌표 (말풍선 자리)
//   view.resize() / view.setVisible(보임?) / view.dispose()
//   view.step(dt, { render })            한 장면 움직이기 (+ 그리기). manual 일 때 바깥에서 부름
//
// 빛 세기 · 색은 아래 상수, 각 부분은 lairPlate · lairBuildings · lairGhost · lairLinks · lairFx · lairSky · lairCamera 에서 바꿉니다.

import * as THREE from '../../lib/three.js';
import { createStudioLight } from '../../scene/stage.js';
import { SCHEMES } from '../data/schemes.js';
import { TILE } from './lairKit.js';
import { facilitySize } from './facilityArt.js';
import { createLairCamera } from './lairCamera.js';
import { createLairPlate } from './lairPlate.js';
import { createLairBuildings } from './lairBuildings.js';
import { createLairMarks } from './lairGhost.js';
import { createLairLinks } from './lairLinks.js';
import { createLairFx } from './lairFx.js';
import { createLairSky } from './lairSky.js';
import { createLairInput } from './lairInput.js';

const MAX_PIXEL_RATIO = 2;
const LIGHT = {
  dark: { sky: '#a898ff', ground: '#2a1640', hemi: 0.95, moon: 2.4, env: 0.32 },
  light: { sky: '#cbbcff', ground: '#3d2259', hemi: 1.15, moon: 2.6, env: 0.42 },
};
const MOON_DIR = [-0.5, 1, 0.65]; // 달빛이 오는 쪽 (왼쪽 앞 위) → 그림자는 오른쪽 뒤로
const SLIDE_SECONDS = 0.9; // 땅이 넓어질 때 가운데로 미끄러지는 시간
const EMBERS_PER_SECOND = 2.5; // 칸 사이 용암에서 올라오는 불티 (땅 8칸 기준)
const TIER_LABEL = { 1: '#BBE90B', 2: '#FF698F', 3: '#FFF03A' };

export function createLairView(container, { onTap = null, onGhostMove = null, manual = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
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
  moon.shadow.mapSize.set(2048, 2048);
  moon.shadow.bias = -0.0006;
  moon.shadow.normalBias = 0.05;
  scene.add(hemi, moon, moon.target);

  const world = new THREE.Group(); // 땅판 · 시설 · 효과를 담음 (땅이 넓어질 때 통째로 미끄러짐)
  scene.add(world);
  const sky = createLairSky(scene, camera);
  const cam = createLairCamera(camera, container);
  const plate = createLairPlate();
  world.add(plate.group);
  const fx = createLairFx(world);
  const buildings = createLairBuildings(world, fx, { onLanded: (rec, kind) => cam.shake(kind === 'build' ? 0.18 : 0.1) });
  const marks = createLairMarks(world);
  const links = createLairLinks(world);

  let lair = null;
  let evaluation = null;
  let owners = new Int32Array(0);
  let landSize = 0;
  let placing = null; // { type, moveId, ghostId, w, h }
  let selectedId = null;
  let hoverKey = '';
  let lastGhostKey = '';
  let gainedKey = '';
  const pendingPulse = new Set();
  const slide = { t: 0, x: 0, z: 0 };
  let time = 0;
  let visible = true;
  let disposed = false;
  let raf = 0;
  let last = 0;
  let themeMode = 'auto';
  let emberClock = 0;
  const tmpV = new THREE.Vector3();
  const localRay = new THREE.Ray();
  const screenOut = { x: 0, y: 0 };

  // ── 빛 · 하늘 (밝은/어두운 화면) ──
  function isDark() {
    if (themeMode === 'dark') return true;
    if (themeMode === 'light') return false;
    const attr = document.documentElement.dataset.theme;
    if (attr === 'dark') return true;
    if (attr === 'light') return false;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true;
  }
  function applyTheme() {
    const dark = isDark();
    const l = dark ? LIGHT.dark : LIGHT.light;
    hemi.color.set(l.sky);
    hemi.groundColor.set(l.ground);
    hemi.intensity = l.hemi;
    moon.intensity = l.moon;
    scene.environmentIntensity = l.env;
    sky.setTheme(dark);
  }
  const media = window.matchMedia?.('(prefers-color-scheme: dark)');
  media?.addEventListener?.('change', applyTheme);
  const themeWatch = typeof MutationObserver !== 'undefined' ? new MutationObserver(applyTheme) : null;
  themeWatch?.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  applyTheme();

  // 달빛 그림자가 땅판 전체를 딱 덮게
  function fitMoon(size) {
    const half = (size * TILE) / 2 + 4;
    const dir = tmpV.set(...MOON_DIR).normalize();
    moon.position.copy(dir).multiplyScalar(half * 3);
    moon.target.position.set(0, 0, 0);
    const c = moon.shadow.camera;
    const r = half * 1.25;
    Object.assign(c, { left: -r, right: r, top: r, bottom: -r, near: 1, far: half * 6 });
    c.updateProjectionMatrix();
    renderer.shadowMap.needsUpdate = true;
  }

  // ── 크기 ──
  function resize() {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const scale = (h * renderer.getPixelRatio()) / (2 * Math.tan((camera.fov * Math.PI) / 360));
    fx.setPixelScale(scale);
    links.setPixelScale(scale);
    sky.setFrame({ width: w, height: h, insets: lastInsets });
  }
  let lastInsets = { top: 0, bottom: 0, left: 0, right: 0 };
  const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => resize()) : null;
  observer?.observe(container);

  // ── 소굴 보여 주기 ──
  function setLair(next, nextEvaluation = null) {
    if (!next) return;
    const first = landSize === 0;
    let shift = 0;
    if (first) {
      plate.setSize(next.size);
      cam.setLand(next.size, { snap: true });
      fitMoon(next.size);
    } else if (next.size !== landSize) {
      shift = next.size > landSize ? Math.floor((next.size - landSize) / 2) : 0;
      growTo(next.size, landSize, shift);
    }
    landSize = next.size;
    lair = next;
    evaluation = nextEvaluation;
    buildings.sync(next, { shift });
    owners = new Int32Array(next.size * next.size).fill(-1);
    for (const b of next.buildings) {
      const [w, h] = facilitySize(b.type);
      for (let y = b.y; y < b.y + h; y++) for (let x = b.x; x < b.x + w; x++) if (x >= 0 && y >= 0 && x < next.size && y < next.size) owners[y * next.size + x] = b.id;
    }
    links.setSchemes(evaluation);
    if (selectedId !== null && !next.buildings.some((b) => b.id === selectedId)) select(null);
    else if (selectedId !== null) select(selectedId);
    for (const key of pendingPulse) pulseScheme(key);
    pendingPulse.clear();
    renderer.shadowMap.needsUpdate = true;
    wake();
  }

  function growTo(size, from, shift) {
    plate.setSize(size, { from });
    cam.setLand(size);
    fitMoon(size);
    const d = (shift - (size - from) / 2) * TILE; // 옛 칸이 새 좌표에서 움직인 거리
    slide.t = 1;
    slide.x = -d;
    slide.z = -d;
    world.position.set(slide.x, 0, slide.z);
  }

  function showLand(size) {
    if (!lair) return;
    if (size > landSize) return; // setLair 로 넓어질 때 저절로 나옴
    if (!plate.rising) plate.setSize(landSize, { from: Math.max(1, landSize - 2) });
    wake();
  }

  // ── 짓기 · 옮기기 유령 ──
  function startPlacing(type, { moveId = null } = {}) {
    stopPlacing();
    let level = 1;
    let start = null;
    if (moveId !== null && moveId !== undefined) {
      const rec = buildings.get(moveId);
      if (rec) {
        type = rec.type;
        level = rec.level;
        start = { x: rec.x, y: rec.y };
        buildings.setHidden(moveId, true);
      }
    }
    const [w, h] = facilitySize(type);
    const nextId = lair?.nextId ?? 1 + Math.max(0, ...(lair?.buildings ?? []).map((b) => b.id));
    placing = { type, moveId: moveId ?? null, ghostId: moveId ?? nextId, w, h };
    marks.showGhost(type, level);
    marks.select(null);
    links.focus(null);
    const size = landSize || 8;
    start ??= { x: Math.floor((size - w) / 2), y: Math.floor((size - h) / 2) };
    marks.moveGhost(start.x, start.y, size, { valid: true, snap: true });
    lastGhostKey = `${start.x},${start.y}`;
    gainedKey = '';
    wake();
  }

  function setGhost(x, y, { valid = true, gained = [], lost = [], evaluation: preview = null } = {}) {
    if (!placing) return;
    marks.moveGhost(x, y, landSize, { valid });
    lastGhostKey = `${x},${y}`;
    const gainLinks = [];
    const lostLinks = [];
    if (preview && gained.length) {
      for (const s of preview.schemes ?? []) {
        if (!gained.includes(s.key)) continue;
        for (const l of s.links) if (l[0] === placing.ghostId || l[1] === placing.ghostId) gainLinks.push(l);
      }
    }
    if (lost.length) {
      for (const s of evaluation?.schemes ?? []) if (lost.includes(s.key)) for (const l of s.links) lostLinks.push(l);
    }
    links.setPreview(gainLinks, lostLinks);
    // 새 계책이 켜질 자리에 처음 올라오면 반짝!
    const key = valid ? gained.join(',') : '';
    if (key && key !== gainedKey && marks.ghost) {
      const g = marks.ghost.group.position;
      fx.sparkle(g.x, marks.ghost.art.height + 1, g.z, 18, '#7CFF4F', { spread: 2, up: 6 });
    }
    gainedKey = key;
  }

  function stopPlacing() {
    if (!placing) return;
    if (placing.moveId !== null) buildings.setHidden(placing.moveId, false);
    placing = null;
    marks.hideGhost();
    links.setPreview([], []);
    if (selectedId !== null) select(selectedId);
  }

  function select(id) {
    selectedId = id ?? null;
    const rec = selectedId !== null ? buildings.get(selectedId) : null;
    if (rec && !placing) marks.select(rec.x, rec.y, rec.w, rec.h, landSize);
    else marks.select(null);
    buildings.setSelected(rec ? selectedId : null);
    links.focus(rec ? selectedId : null);
  }

  function pulseScheme(key) {
    const s = evaluation?.schemes?.find((one) => one.key === key);
    if (!s) {
      pendingPulse.add(key);
      return;
    }
    links.pulse(key);
    const color = TIER_LABEL[s.tier] ?? TIER_LABEL[1];
    let first = null;
    for (const id of s.ownerIds) {
      const rec = buildings.get(id);
      if (!rec) continue;
      const g = rec.group.position;
      fx.ring(g.x, 0.3, g.z, color, { radius: rec.w * TILE * 1.1, life: 1 });
      fx.sparkle(g.x, rec.art.height * 0.7, g.z, 30, color, { spread: rec.w * 2.4, up: 9, size: 1.1 });
      first ??= rec;
    }
    if (first) {
      buildings.anchor(first.id, tmpV);
      fx.label(tmpV.x, tmpV.y + 1.5, tmpV.z, SCHEMES[key]?.name ?? key, color);
    }
    wake();
  }

  // ── 누르기 → 칸 · 시설 ──
  function groundAt(clientX, clientY) {
    const ray = cam.pointerRay(clientX, clientY);
    localRay.origin.copy(ray.origin).sub(world.position);
    localRay.direction.copy(ray.direction);
    if (localRay.direction.y > -1e-4) return null;
    const t = -localRay.origin.y / localRay.direction.y;
    const px = localRay.origin.x + localRay.direction.x * t;
    const pz = localRay.origin.z + localRay.direction.z * t;
    return { t, fx: px / TILE + landSize / 2, fy: pz / TILE + landSize / 2 };
  }

  function placingSpot(hit) {
    const { w, h } = placing;
    const x = Math.max(0, Math.min(landSize - w, Math.round(hit.fx - w / 2)));
    const y = Math.max(0, Math.min(landSize - h, Math.round(hit.fy - h / 2)));
    return { x, y };
  }

  function pickAt(clientX, clientY) {
    const hit = groundAt(clientX, clientY);
    if (placing) {
      if (!hit) return null;
      const spot = placingSpot(hit);
      return { x: spot.x, y: spot.y, buildingId: null, tileX: Math.floor(hit.fx), tileY: Math.floor(hit.fy) };
    }
    const building = buildings.pick(localRay);
    if (building && (!hit || building.distance <= hit.t + 0.5)) {
      const rec = buildings.get(building.id);
      return { x: rec.x, y: rec.y, buildingId: building.id, tileX: hit ? Math.floor(hit.fx) : rec.x, tileY: hit ? Math.floor(hit.fy) : rec.y };
    }
    if (!hit) return { x: null, y: null, buildingId: null, tileX: null, tileY: null };
    const tx = Math.floor(hit.fx);
    const ty = Math.floor(hit.fy);
    if (tx < 0 || ty < 0 || tx >= landSize || ty >= landSize) return { x: null, y: null, buildingId: null, tileX: tx, tileY: ty };
    const owner = owners[ty * landSize + tx];
    return { x: tx, y: ty, buildingId: owner >= 0 ? owner : null, tileX: tx, tileY: ty };
  }

  function ghostFollow(clientX, clientY, final) {
    const spot = pickAt(clientX, clientY);
    if (!spot) return;
    const key = `${spot.x},${spot.y}`;
    if (key === lastGhostKey && !final) return;
    const changed = key !== lastGhostKey;
    lastGhostKey = key;
    if (changed) marks.moveGhost(spot.x, spot.y, landSize, { valid: marks.ghost?.valid ?? true });
    if (onGhostMove) {
      if (changed) onGhostMove({ x: spot.x, y: spot.y });
    } else if (final) onTap?.(spot);
  }

  const input = createLairInput(canvas, {
    onPress(x, y) {
      if (placing) ghostFollow(x, y, false);
    },
    onDrag(x, y) {
      if (placing) ghostFollow(x, y, false);
    },
    onRelease(x, y, wasDrag) {
      if (placing && wasDrag) ghostFollow(x, y, true);
    },
    onTap(x, y) {
      const spot = pickAt(x, y);
      if (spot) onTap?.(spot);
    },
    onHover(x, y) {
      if (placing) return ghostFollow(x, y, false);
      const spot = pickAt(x, y);
      const key = spot ? `${spot.x},${spot.y},${spot.buildingId}` : '';
      if (key === hoverKey) return;
      hoverKey = key;
      const rec = spot?.buildingId != null ? buildings.get(spot.buildingId) : null;
      if (rec) marks.hover(rec.x, rec.y, rec.w, rec.h, landSize);
      else if (spot && spot.x !== null) marks.hover(spot.x, spot.y, 1, 1, landSize);
      else marks.hover(null);
      canvas.style.cursor = rec ? 'pointer' : '';
    },
    onLeave() {
      hoverKey = '';
      marks.hover(null);
    },
  });

  // ── 장면 반복 ──
  function anchor(id, out) {
    if (placing && id === placing.ghostId && marks.ghost) {
      const g = marks.ghost.group.position;
      return out.set(g.x, g.y + Math.min(marks.ghost.art.height, placing.w > 1 ? 7 : 5) + 0.7, g.z);
    }
    return buildings.anchor(id, out);
  }

  function ambient(dt) {
    if (!landSize) return;
    emberClock += dt * EMBERS_PER_SECOND * (landSize / 8) ** 2;
    while (emberClock > 1) {
      emberClock -= 1;
      plate.grooveSpot(tmpV);
      fx.ember(tmpV.x, tmpV.y, tmpV.z, Math.random() < 0.7 ? '#FE8A18' : '#FFF03A');
    }
    for (const torch of plate.torches) if (Math.random() < dt * 2.2) fx.ember(torch.x, torch.y, torch.z, '#FFF03A');
  }

  function step(dt, { render = true } = {}) {
    if (disposed) return;
    dt = Math.min(0.05, Math.max(0, dt));
    time += dt;
    if (slide.t > 0) {
      slide.t = Math.max(0, slide.t - dt / SLIDE_SECONDS);
      const e = slide.t * slide.t * (3 - 2 * slide.t);
      world.position.set(slide.x * e, 0, slide.z * e);
      renderer.shadowMap.needsUpdate = true;
    }
    cam.update(dt);
    plate.update(dt, time);
    if (buildings.update(dt, time) || plate.rising) renderer.shadowMap.needsUpdate = true;
    marks.update(dt, time);
    links.update(dt, time, anchor);
    ambient(dt);
    fx.update(dt);
    sky.update(dt, time);
    if (render && container.clientWidth > 0) renderer.render(scene, camera);
  }

  function running() {
    return visible && !disposed && !manual && !document.hidden;
  }
  function loop(now) {
    raf = 0;
    if (!running()) return;
    raf = requestAnimationFrame(loop);
    step((now - last) / 1000);
    last = now;
  }
  function wake() {
    if (raf || !running()) return;
    last = performance.now();
    raf = requestAnimationFrame(loop);
  }
  document.addEventListener('visibilitychange', wake);
  resize();
  wake();

  return {
    setLair,
    startPlacing,
    setGhost,
    stopPlacing,
    select,
    playBuild: (id) => (buildings.playBuild(id), wake()),
    playUpgrade: (id) => (buildings.playUpgrade(id), wake()),
    playRemove: (id) => (buildings.playRemove(id), wake()),
    showLand,
    pulseScheme,
    setInsets(insets = {}) {
      lastInsets = { top: 0, bottom: 0, left: 0, right: 0, ...insets };
      cam.setInsets(lastInsets);
      sky.setFrame({ width: container.clientWidth || 1, height: container.clientHeight || 1, insets: lastInsets });
    },
    setTheme(mode = 'auto') {
      themeMode = mode;
      applyTheme();
    },
    screenPoint(id) {
      if (!anchor(id, tmpV)) return null;
      tmpV.add(world.position);
      const p = cam.worldToScreen(tmpV, screenOut);
      return { x: p.x, y: p.y };
    },
    resize,
    setVisible(on) {
      visible = !!on;
      if (visible) {
        resize();
        wake();
      } else if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    },
    step,
    get placing() {
      return placing ? { ...placing } : null;
    },
    dispose() {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', wake);
      media?.removeEventListener?.('change', applyTheme);
      themeWatch?.disconnect();
      observer?.disconnect();
      input.dispose();
      marks.dispose();
      links.dispose();
      buildings.dispose();
      fx.dispose();
      plate.dispose();
      sky.dispose();
      env.dispose?.();
      renderer.dispose();
      canvas.remove();
    },
  };
}

