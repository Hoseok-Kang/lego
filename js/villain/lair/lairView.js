// 악당 소굴 3D 화면 (밤하늘에 뜬 화산 바위 판 위에 블록 시설을 짓는 곳)
// 자기 3D 화면(렌더러)과 장면 반복(rAF)을 갖고, 보일 때만 움직입니다. 땅판은 위 정보판 · 아래 단추 사이 빈 화면에 꽉 맞춥니다.
// 화면은 보여 주기와 '어디를 눌렀는지' 알리기만 하고, 실제로 짓고 · 팔고 · 저장하는 일은 부른 쪽(game.js)이 합니다.
//
//   const view = createLairView(container, { onTap, onGhostMove, manual })
//     onTap({ x, y, buildingId, tileX, tileY })   눌린 칸. 시설을 누르면 buildingId, 빈칸이면 null.
//                         짓는 중(placing)이면 x, y = 시설 왼쪽 위 칸: 손가락 아래 칸이 시설의 맨 아래 줄 · 가로 가운데 (땅 안으로 맞춤),
//                         buildingId = null  → 그대로 previewPlace(lair, type, x, y) 에 넣으면 됨
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
//                                         (낀 시설이 아직 쌓이는 중이면 다 쌓인 뒤에 번쩍 — playBuild 바로 뒤에 불러도 됨)
//   view.setInsets({ top, bottom, left, right })   3D 상자 위에 떠서 가리는 단추 · 띠 크기(px) → 그 사이에 땅판을 맞춤
//   view.setTheme('auto' | 'light' | 'dark')       하늘 색 (기본 auto: 페이지 data-theme 또는 기기 설정)
//   view.screenPoint(id) → { x, y } | null         시설 지붕 위의 화면(페이지) 좌표 (말풍선 자리)
//   view.tileScreen(x, y) → { x, y }               칸 가운데의 화면(페이지) 좌표
//   view.resize() / view.setVisible(보임?) / view.dispose()
//   view.step(dt, { render })            한 장면 움직이기 (+ 그리기). manual 일 때 바깥에서 부름
//
// 빛 · 테마는 lairStage, 땅판 lairPlate, 시설 lairBuildings(+ lairMotion · facilityArt*), 유령 lairGhost,
// 계책 줄 lairLinks, 효과 lairFx, 하늘 lairSky, 카메라 lairCamera, 누르기 lairPointer · lairInput · lairPick 에서 바꿉니다.

import * as THREE from '../../lib/three.js';
import { SCHEMES } from '../data/schemes.js';
import { growShift } from './lairSim.js';
import { TILE } from './lairKit.js';
import { facilitySize } from './facilityArt.js';
import { createLairCamera } from './lairCamera.js';
import { createLairPlate } from './lairPlate.js';
import { createLairBuildings } from './lairBuildings.js';
import { createLairMarks } from './lairGhost.js';
import { createLairLinks } from './lairLinks.js';
import { createLairFx } from './lairFx.js';
import { createLairSky } from './lairSky.js';
import { createLairPointer } from './lairPointer.js';
import { createLairStage } from './lairStage.js';

const SLIDE_SECONDS = 0.9; // 땅이 넓어질 때 가운데로 미끄러지는 시간
const EMBERS_PER_SECOND = 2.5; // 칸 사이 용암에서 올라오는 불티 (땅 8칸 기준)
const PULSE_WAIT = 6; // 계책 번쩍임을 이만큼(초)까지 기다렸다가 (시설이 다 쌓일 때까지)
const TIER_LABEL = { 1: '#BBE90B', 2: '#FF698F', 3: '#FFF03A' };

export function createLairView(container, { onTap = null, onGhostMove = null, manual = false } = {}) {
  const stage = createLairStage(container);
  const { renderer, scene, camera, canvas } = stage;

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
  let gainedKey = '';
  const pendingPulse = new Map(); // 계책 key → 기다리기 시작한 시각 (PULSE_WAIT 초가 지나면 버림)
  const slide = { t: 0, x: 0, z: 0 };
  let time = 0;
  let visible = true;
  let disposed = false;
  let raf = 0;
  let last = 0;
  let emberClock = 0;
  const tmpV = new THREE.Vector3();
  const screenOut = { x: 0, y: 0 };

  // 테마(밝은/어두운 화면)가 바뀌면 하늘 색도
  stage.onTheme = (dark) => sky.setTheme(dark);
  stage.refreshTheme();

  // 땅 크기에 맞춰 달빛 그림자 · 블록 조각이 튀는 바닥 범위 맞추기
  function fitMoon(size) {
    stage.fitLand(size);
    fx.setFloor((size * TILE) / 2);
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
      shift = growShift(landSize, next.size);
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
    // 뒤쪽 두 줄의 높은 시설은 꼭대기가 화면 위로 잘리지 않게 카메라가 위 여유를 더 둠
    const tall = [];
    for (const b of next.buildings) {
      const rec = buildings.get(b.id);
      if (rec && b.y < 3) tall.push({ height: rec.art.height, back: b.y * TILE });
    }
    cam.setTall(tall);
    if (selectedId !== null && !next.buildings.some((b) => b.id === selectedId)) select(null);
    else if (selectedId !== null) select(selectedId);
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
    pointer.setGhostKey(start.x, start.y);
    gainedKey = '';
    wake();
  }

  function setGhost(x, y, { valid = true, gained = [], lost = [], evaluation: preview = null } = {}) {
    if (!placing) return;
    marks.moveGhost(x, y, landSize, { valid });
    pointer.setGhostKey(x, y);
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
    // 아직 계책이 없거나(setLair 전) 낀 시설이 쌓이는 중이면 → 다 쌓인 뒤에
    if (!s || s.ownerIds.some((id) => buildings.busy(id)) || s.links.some((l) => buildings.busy(l[1]))) {
      if (!pendingPulse.has(key)) pendingPulse.set(key, time);
      wake();
      return;
    }
    pendingPulse.delete(key);
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

  // ── 누르기 → 칸 · 시설 (lairPointer.js) ──
  const pointer = createLairPointer(canvas, {
    cam,
    world,
    buildings,
    marks,
    state: () => ({ landSize, placing, owners }), // 누를 때만 불림
    onTap: (spot) => onTap?.(spot),
    onGhostMove: onGhostMove ? (spot) => onGhostMove(spot) : null,
  });

  // ── 장면 반복 ──
  // 시설(짓는 중이면 유령) 지붕 위 자리. linked: 계책 줄용이면 아직 쌓이는 시설은 빼고 (다 쌓인 뒤에 줄이 이어짐)
  function anchor(id, out, linked = true) {
    if (placing && id === placing.ghostId && marks.ghost) {
      const g = marks.ghost.group.position;
      return out.set(g.x, g.y + Math.min(marks.ghost.art.height, placing.w > 1 ? 7 : 5) + 0.7, g.z);
    }
    if (linked && buildings.rising(id)) return null;
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
    if (pendingPulse.size) {
      for (const [key, since] of pendingPulse) {
        if (time - since > PULSE_WAIT) pendingPulse.delete(key);
        else pulseScheme(key);
      }
    }
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
    setTheme: (mode = 'auto') => stage.setTheme(mode),
    tileScreen(x, y) {
      tmpV.set((x + 0.5 - landSize / 2) * TILE, 0, (y + 0.5 - landSize / 2) * TILE).add(world.position);
      const p = cam.worldToScreen(tmpV, screenOut);
      return { x: p.x, y: p.y };
    },
    screenPoint(id) {
      if (!anchor(id, tmpV, false)) return null;
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
      observer?.disconnect();
      pointer.dispose();
      marks.dispose();
      links.dispose();
      buildings.dispose();
      fx.dispose();
      plate.dispose();
      sky.dispose();
      stage.dispose();
    },
  };
}

