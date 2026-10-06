// 타워 (타워 자리, 짓기, 강화, 팔기, 쏘기)
// 성 둘레에 모래색 타워 자리가 있고, 빈 자리 위에는 흰 '+' 표시가 둥실거립니다.
// 자리에 타워를 지으면 블록이 하나씩 떨어져 쌓이고, 다 쌓여야 쏘기 시작합니다.
// 강화하면 타워 꼭대기에 노란 왕관 블록이 한 층씩 더 쌓입니다. 팔면 타워가 와르르 부서지고 돈을 일부 돌려받습니다.
// 타워 종류별 값·사거리·공격력·쏘는 간격은 gameConfig.js 의 towers, 강화 규칙은 upgrade, 자리 수·거리는 towerPads 에 있습니다.
//
// 할 수 있는 일
//   towers.padAt(땅 위치)             그 위치의 타워 자리 번호 (없으면 null). 타워 몸통을 눌러도 그 자리로 침
//   towers.padInfo(번호)              { position(메뉴를 띄울 곳), tower: null | { typeId, name, level, maxLevel, built,
//                                       damage, range, fireInterval } }
//   towers.build(번호, 종류)           타워 짓기 시작 (돈 계산은 game.js 가 함)
//   towers.upgradeCost(번호)          강화 비용 (강화할 수 없으면 null)
//   towers.upgrade(번호)              한 단계 강화 (왕관 블록이 쌓임)
//   towers.sellValue(번호)            팔면 돌려받는 돈
//   towers.sell(번호)                 팔기 → 돌려받는 돈
//   towers.update(dt, { cameraYaw })  매 장면마다: 쌓기 모션, 카메라 쪽 보기, 쏠 몬스터 고르기, 쏘기
//   towers.highlight(번호 | null)      고른 자리를 노랗게 물들이고, 타워가 있으면 사거리 원을 보여 줌
//   towers.clear()                    타워 전부 없애기 (자리는 남음)
//   towers.refreshArt(종류)            그 종류 타워 그림이 바뀌면 새 그림으로 다시 쌓기 (다 쌓일 때까지 쉼)
//   towers.list()                     지어진 타워 목록 (읽기만 하세요)
//
// 타워 레벨 L 의 능력치
//   공격력 = 기본 × damageRate^(L-1)   사거리 = 기본 + rangeBonus × (L-1)   쏘는 간격 = 기본 × fireIntervalRate^(L-1)
// 쏠 몬스터: 사거리 안(타워 자리 가운데에서 땅 위 거리)에 있는 몬스터 중 성에 가장 가까운 몬스터

import * as THREE from '../../lib/three.js';
import { BlockFigure } from '../core/blockFigure.js';
import { getBlueprint, getSolidBlueprint, forgetBlueprints } from '../core/blueprints.js';
import { createBlockBatch } from '../core/blockAssets.js';

// ── 바꿔도 되는 숫자 ──
const PAD_COLOR = '#E4CD9E'; // 타워 자리 받침 색 (모래색)
const PAD_GROUT_COLOR = '#958A73'; // 받침 블록 사이 틈으로 보이는 색 (잔디가 비쳐 보이지 않게)
const PAD_TOP = 1; // 받침 높이 (블록 줄 수). 타워는 이 높이 위에 섬
const MARKER_COLOR = '#F4F4F4'; // 빈 자리 위 '+' 표시 색 (흰색)
const MARKER_SELECTED_COLOR = '#F2CD37'; // 고른 빈 자리의 '+' 표시 색 (노랑)
const MARKER_THICKNESS = 0.45; // '+' 표시 블록 두께 (1 = 블록 한 칸 높이)
const MARKER_LIFT = 0.3; // '+' 표시가 받침 위로 떠 있는 높이
const MARKER_BOB = 0.22; // '+' 표시가 위아래로 둥실거리는 폭
const MARKER_BOB_SECONDS = 1.6; // 한 번 둥실거리는 시간
const HIGHLIGHT_COLOR = '#F2CD37'; // 고른 타워 자리를 물들이는 색 (노랑)
const HIGHLIGHT_AMOUNT = 0.55; // 물들이는 정도 (0~1)
const RANGE_RING_COLOR = '#FFFFFF'; // 사거리 원 색
const RANGE_RING_OPACITY = 0.75; // 사거리 원 테두리 진하기 (0~1)
const RANGE_RING_WIDTH = 0.35; // 사거리 원 테두리 두께
const RANGE_FILL_OPACITY = 0.12; // 사거리 원 안쪽을 옅게 칠하는 진하기 (0 이면 테두리만)
const CROWN_BUILD_SECONDS = 0.9; // 강화 왕관이 쌓이는 시간
const FIRST_SHOT_DELAY = 0.25; // 다 쌓인 뒤 첫 발을 쏘기까지 기다리는 시간
const MUZZLE_SHARE = 0.85; // 발사체가 나가는 높이 (타워 전체 높이 × 이 값)
const RECOIL_SECONDS = 0.16; // 쏠 때 타워가 움찔하는 시간
const RECOIL_SQUASH = 0.08; // 그때 납작해지는 정도
const SELL_BURST = { power: 6, upward: 8 }; // 팔 때 블록이 튀는 세기
const REFRESH_BURST = { power: 3, upward: 5 }; // 그림을 바꿀 때 예전 블록이 튀는 세기
const FACE_TURN = 0.035; // 카메라 쪽을 볼 때 살짝 더 돌리는 각도 (라디안). 0이면 가운데 블록 틈으로 뒤가 비쳐 보임
const TAP_MARGIN = 0.8; // 타워 몸통을 눌렀다고 봐주는 여유 (칸)
const SKIP_ARRIVING = true; // true: 몸이 아직 만들어지는 중인 몬스터는 쏘지 않음

// 빈 자리 '+' 표시 모양 (가운데 + 위아래좌우 한 칸씩)
const MARKER_CELLS = [
  [0, 0],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const GUESS_CAMERA_DISTANCE = 110; // 화면을 아직 한 번도 안 그렸을 때 짐작하는 카메라 거리

export function createTowerManager({ scene, events, enemies, projectiles, debris, art, config }) {
  const padConfig = config.towerPads;
  const upgradeConfig = config.upgrade;
  const maxLevel = upgradeConfig.maxLevel;

  const root = new THREE.Group();
  root.name = 'towers';
  scene.add(root);

  // 매 장면 재사용하는 값 (새로 만들지 않아 가벼움)
  const muzzle = new THREE.Vector3();
  const center = new THREE.Vector3();
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const noTurn = new THREE.Quaternion();
  const markerColor = new THREE.Color(MARKER_COLOR);
  const markerSelectedColor = new THREE.Color(MARKER_SELECTED_COLOR);
  const eye = new THREE.Vector3();
  const cameraSeen = { known: false, position: new THREE.Vector3() };

  const blueprintKeys = new Map(); // 타워 종류 → 지금 쓰는 그림 이름
  let lastYaw = 0;
  let clock = 0;
  let selected = null;

  // ── 타워 자리 ──
  const pads = createPads();
  const markers = createMarkers(pads.length);
  const ring = createRangeRing();
  watchCamera(pads[0].figure.bodies);

  // 처음 지을 때 멈칫하지 않게 설계도를 미리 만들어 둠
  for (const typeId of Object.keys(config.towers)) prepareBlueprint(typeId);

  function createPads() {
    const count = padConfig.count;
    const size = padConfig.size;
    const blueprint = getSolidBlueprint('tower-pad', { columns: size, rows: PAD_TOP, depth: size, hex: PAD_COLOR });
    const groutGeometry = new THREE.BoxGeometry(size - 0.1, PAD_TOP * 0.8, size - 0.1);
    const groutMaterial = new THREE.MeshStandardMaterial({ color: PAD_GROUT_COLOR, roughness: 0.9 });
    const list = [];
    for (let k = 0; k < count; k++) {
      const angle = ((k + 0.5) * TAU) / count;
      // 받침 블록이 바닥판 돌기 줄에 딱 맞게 가운데를 살짝 옮김 (0.5칸 이내)
      const x = snapToStuds(Math.cos(angle) * padConfig.radius, size, config.arena.size);
      const z = snapToStuds(Math.sin(angle) * padConfig.radius, size, config.arena.size);
      const figure = new BlockFigure(blueprint, root, { castShadow: false });
      figure.group.position.set(x, 0, z);
      const grout = new THREE.Mesh(groutGeometry, groutMaterial);
      grout.position.set(x, PAD_TOP * 0.4, z);
      grout.receiveShadow = true;
      root.add(grout);
      list.push({ index: k, angle, x, z, figure, tower: null });
    }
    return list;
  }

  // 빈 자리 '+' 표시 (모든 자리의 표시를 한 묶음으로 그림)
  function createMarkers(padCount) {
    const batch = createBlockBatch(padCount * MARKER_CELLS.length, { castShadow: false });
    root.add(batch.bodies, batch.studs);
    return batch;
  }

  // 사거리 원: 테두리 + 옅게 칠한 안쪽. 반지름이 바뀔 때만 다시 만듦
  function createRangeRing() {
    const group = new THREE.Group();
    group.visible = false;
    const band = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshBasicMaterial({
        color: RANGE_RING_COLOR,
        transparent: true,
        opacity: RANGE_RING_OPACITY,
        depthWrite: false,
      }),
    );
    const fill = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshBasicMaterial({
        color: RANGE_RING_COLOR,
        transparent: true,
        opacity: RANGE_FILL_OPACITY,
        depthWrite: false,
      }),
    );
    fill.visible = RANGE_FILL_OPACITY > 0;
    band.renderOrder = 2;
    fill.renderOrder = 1;
    group.add(fill, band);
    group.position.y = 0.2; // 바닥판 돌기 바로 위
    root.add(group);
    return { group, band, fill, radius: 0 };
  }

  function setRingRadius(radius) {
    if (ring.radius === radius) return;
    ring.radius = radius;
    const inner = Math.max(0.1, radius - RANGE_RING_WIDTH);
    ring.band.geometry.dispose();
    ring.fill.geometry.dispose();
    ring.band.geometry = new THREE.RingGeometry(inner, radius, 96).rotateX(-Math.PI / 2);
    ring.fill.geometry = new THREE.CircleGeometry(inner, 96).rotateX(-Math.PI / 2);
  }

  // ── 그림 → 설계도 ──
  function prepareBlueprint(typeId) {
    const type = config.towers[typeId];
    const artId = `tower:${typeId}`;
    const key = art.key(artId);
    const oldKey = blueprintKeys.get(typeId);
    if (oldKey && oldKey !== key) forgetBlueprints(`${oldKey}|`); // 예전 그림 설계도 정리
    blueprintKeys.set(typeId, key);
    return getBlueprint(key, art.get(artId), { columns: type.columns, depth: type.depth });
  }

  // ── 짓기 ──
  function build(index, typeId) {
    const pad = pads[index];
    const type = config.towers[typeId];
    if (!pad || !type || pad.tower) return null;
    const tower = {
      pad: index,
      typeId,
      type,
      name: type.name,
      level: 1,
      maxLevel,
      spent: type.cost, // 지금까지 이 타워에 쓴 돈 (팔 때 기준)
      damage: 0,
      range: 0,
      fireInterval: 0,
      built: false,
      removed: false,
      figure: null,
      crowns: [],
      cooldown: 0,
      recoilTime: 0,
    };
    applyLevelStats(tower);
    pad.tower = tower;
    startFigure(tower);
    if (selected === index) refreshHighlight();
    events.emit('towerBuildStarted', { tower });
    return tower;
  }

  // 타워 인형을 새로 만들고 쌓기 모션 시작 (다 쌓이면 쏘기 시작)
  function startFigure(tower) {
    const pad = pads[tower.pad];
    const figure = new BlockFigure(prepareBlueprint(tower.typeId), root);
    figure.group.position.set(pad.x, PAD_TOP, pad.z);
    figure.group.rotation.y = lastYaw + FACE_TURN;
    tower.figure = figure;
    tower.crowns = [];
    tower.built = false;
    tower.recoilTime = 0;
    figure.build(tower.type.buildSeconds, {
      onLand: () => events.emit('blockLanded'),
      onComplete: () => {
        if (tower.figure !== figure || tower.removed) return; // 그사이 팔렸거나 다른 그림으로 바뀜
        tower.built = true;
        tower.cooldown = FIRST_SHOT_DELAY;
        // 그림을 바꿔 다시 쌓은 경우: 강화 왕관도 다시 얹음
        while (tower.crowns.length < tower.level - 1) addCrown(tower);
        events.emit('towerBuilt', { tower });
      },
    });
  }

  // ── 레벨과 능력치 ──
  function applyLevelStats(tower) {
    const type = tower.type;
    const steps = tower.level - 1;
    tower.damage = type.damage * upgradeConfig.damageRate ** steps;
    tower.range = type.range + upgradeConfig.rangeBonus * steps;
    tower.fireInterval = type.fireInterval * upgradeConfig.fireIntervalRate ** steps;
  }

  function upgradeCost(index) {
    const tower = pads[index]?.tower;
    if (!tower || !tower.built || tower.level >= maxLevel) return null;
    const rate = upgradeConfig.costRate[tower.level];
    if (rate === undefined) return null;
    return Math.round(tower.type.cost * rate);
  }

  // 한 단계 강화: 돈은 game.js 가 먼저 냄. 강화했으면 true
  function upgrade(index) {
    const cost = upgradeCost(index);
    if (cost === null) return false;
    const tower = pads[index].tower;
    tower.spent += cost;
    tower.level += 1;
    applyLevelStats(tower);
    addCrown(tower);
    if (selected === index) refreshHighlight();
    events.emit('towerUpgraded', { tower });
    return true;
  }

  // 왕관: 타워(또는 아래 왕관) 위에 노란 블록이 한 층 쌓임. 타워와 함께 카메라 쪽을 봄
  function addCrown(tower) {
    const type = tower.type;
    const rows = upgradeConfig.crownRows;
    const blueprint = getCrownBlueprint(type.columns, rows, type.depth, upgradeConfig.crownColor);
    const crown = new BlockFigure(blueprint, tower.figure.group);
    crown.group.position.y = tower.figure.height + tower.crowns.length * rows;
    crown.build(CROWN_BUILD_SECONDS, { onLand: () => events.emit('blockLanded') });
    tower.crowns.push(crown);
  }

  // ── 팔기 ──
  function sellValue(index) {
    const tower = pads[index]?.tower;
    return tower ? Math.round(tower.spent * config.sellRate) : 0;
  }

  // 타워가 와르르 부서지고 자리가 비워짐 → 돌려받는 돈 (돈은 game.js 가 더함)
  function sell(index) {
    const pad = pads[index];
    const tower = pad?.tower;
    if (!tower) return 0;
    const refund = sellValue(index);
    tower.removed = true;
    tower.built = false;
    center.set(pad.x, PAD_TOP + towerHeight(tower) * 0.4, pad.z);
    const blocks = breakApart(tower.figure, tower.crowns);
    if (blocks.length > 0) debris.burst(blocks, { from: center, ...SELL_BURST });
    tower.figure = null;
    tower.crowns = [];
    pad.tower = null;
    if (selected === index) refreshHighlight();
    events.emit('towerSold', { tower, refund });
    return refund;
  }

  // 타워 인형(+왕관)의 보이는 블록을 전부 떼어 내고 지움 → [{ position, color }]
  function breakApart(figure, crowns) {
    const blocks = [];
    for (const part of [...crowns, figure]) {
      if (!part) continue;
      // 아직 쌓는 중이면 이미 나타난 블록만 튀게 함 (쌓기는 아래부터라서 낮은 블록부터 고름)
      const shown = part.animator ? part.animator.startedCount() : part.aliveCount;
      const removed = part.removeAll();
      if (shown < removed.length) {
        removed.sort((a, b) => a.position.y - b.position.y);
        removed.length = shown;
      }
      for (const block of removed) blocks.push(block);
      part.dispose();
    }
    return blocks;
  }

  // ── 매 장면마다 ──
  function update(dt, { cameraYaw = lastYaw } = {}) {
    lastYaw = cameraYaw;
    clock += dt;
    updateMarkers();
    for (let k = 0; k < pads.length; k++) {
      const tower = pads[k].tower;
      if (tower) updateTower(tower, dt, cameraYaw);
    }
  }

  function updateTower(tower, dt, yaw) {
    const figure = tower.figure;
    figure.update(dt);
    for (let i = 0; i < tower.crowns.length; i++) tower.crowns[i].update(dt);

    // 카메라 쪽 보기 + 쏠 때 움찔
    tower.recoilTime = Math.max(0, tower.recoilTime - dt);
    const squash = RECOIL_SQUASH * Math.sin((Math.PI * tower.recoilTime) / RECOIL_SECONDS);
    figure.group.rotation.y = yaw + FACE_TURN;
    figure.group.scale.set(1 + squash * 0.5, 1 - squash, 1 + squash * 0.5);

    if (!tower.built) return;
    tower.cooldown -= dt;
    if (tower.cooldown > 0) return;
    const target = findTarget(tower);
    if (!target) {
      tower.cooldown = 0; // 몬스터가 들어오면 바로 쏨
      return;
    }
    fire(tower, target);
    tower.cooldown += tower.fireInterval;
  }

  // 사거리 안에서 성에 가장 가까운 몬스터 (성 공격 거리와 같은 네모 거리로 잼)
  function findTarget(tower) {
    const pad = pads[tower.pad];
    const list = enemies.list();
    const rangeSq = tower.range * tower.range;
    let best = null;
    let bestScore = Infinity;
    for (let i = 0; i < list.length; i++) {
      const enemy = list[i];
      if (!enemy.alive || enemy.state === 'dead') continue;
      if (SKIP_ARRIVING && enemy.state === 'arriving') continue;
      const dx = enemy.position.x - pad.x;
      const dz = enemy.position.z - pad.z;
      if (dx * dx + dz * dz > rangeSq) continue;
      const score = Math.max(Math.abs(enemy.position.x), Math.abs(enemy.position.z));
      if (score < bestScore) {
        bestScore = score;
        best = enemy;
      }
    }
    return best;
  }

  function fire(tower, target) {
    const type = tower.type;
    const pad = pads[tower.pad];
    muzzle.set(pad.x, PAD_TOP + towerHeight(tower) * MUZZLE_SHARE, pad.z);
    projectiles.fire({
      kind: type.projectile,
      from: muzzle,
      target,
      damage: tower.damage,
      splashRadius: type.splashRadius ?? 0,
      slow: type.slow ?? 0,
      slowSeconds: type.slowSeconds ?? 0,
      speed: type.projectileSpeed,
    });
    tower.recoilTime = RECOIL_SECONDS;
  }

  // 타워 높이 (블록 줄 수, 왕관 포함)
  function towerHeight(tower) {
    if (!tower.figure) return 0;
    return tower.figure.height + tower.crowns.length * upgradeConfig.crownRows;
  }

  // 빈 자리 '+' 표시를 둥실둥실 움직임 (타워가 있는 자리는 건너뜀)
  function updateMarkers() {
    const { bodies, studs } = markers;
    let n = 0;
    for (let k = 0; k < pads.length; k++) {
      const pad = pads[k];
      if (pad.tower) continue;
      const wave = Math.sin((clock * TAU) / MARKER_BOB_SECONDS + k * 0.8);
      const y = PAD_TOP + MARKER_THICKNESS / 2 + MARKER_LIFT + MARKER_BOB * (0.5 + 0.5 * wave);
      const color = k === selected ? markerSelectedColor : markerColor;
      scale.set(0.92, MARKER_THICKNESS, 0.92);
      for (let c = 0; c < MARKER_CELLS.length; c++) {
        position.set(pad.x + MARKER_CELLS[c][0], y, pad.z + MARKER_CELLS[c][1]);
        matrix.compose(position, noTurn, scale);
        bodies.setMatrixAt(n, matrix);
        studs.setMatrixAt(n, matrix);
        bodies.setColorAt(n, color);
        studs.setColorAt(n, color);
        n++;
      }
    }
    bodies.count = n;
    studs.count = n;
    bodies.instanceMatrix.needsUpdate = true;
    studs.instanceMatrix.needsUpdate = true;
    bodies.instanceColor.needsUpdate = true;
    studs.instanceColor.needsUpdate = true;
  }

  // ── 고르기 (노랗게 물들이기 + 사거리 원) ──
  function highlight(index) {
    selected = index !== null && index !== undefined && pads[index] ? index : null;
    for (let k = 0; k < pads.length; k++) {
      pads[k].figure.setTint(k === selected ? HIGHLIGHT_COLOR : null, HIGHLIGHT_AMOUNT);
    }
    refreshHighlight();
    updateMarkers();
  }

  function refreshHighlight() {
    const pad = selected === null ? null : pads[selected];
    if (!pad || !pad.tower) {
      ring.group.visible = false;
      return;
    }
    setRingRadius(pad.tower.range);
    ring.group.position.x = pad.x;
    ring.group.position.z = pad.z;
    ring.group.visible = true;
  }

  // ── 누른 곳 → 타워 자리 ──
  function padAt(point) {
    if (!point) return null;
    const onTower = towerUnderTap(point);
    if (onTower !== null) return onTower;
    const near = padConfig.size * 0.75;
    let best = null;
    let bestSq = near * near;
    for (let k = 0; k < pads.length; k++) {
      const dx = point.x - pads[k].x;
      const dz = point.z - pads[k].z;
      const distanceSq = dx * dx + dz * dz;
      if (distanceSq <= bestSq) {
        bestSq = distanceSq;
        best = k;
      }
    }
    return best;
  }

  // 키 큰 타워의 몸통을 누르면 땅 위치는 타워 뒤쪽이 됨 → 카메라에서 누른 땅까지의 선이 타워를 지나가는지 봄
  function towerUnderTap(point) {
    cameraEye(eye);
    const dx = point.x - eye.x;
    const dy = point.y - eye.y;
    const dz = point.z - eye.z;
    const flatSq = dx * dx + dz * dz;
    if (flatSq < 1e-6) return null;
    let best = null;
    let bestT = Infinity;
    for (let k = 0; k < pads.length; k++) {
      const pad = pads[k];
      const tower = pad.tower;
      if (!tower || !tower.figure) continue;
      // 선 위에서 타워 기둥과 (땅 위에서) 가장 가까운 곳
      const t = THREE.MathUtils.clamp(((pad.x - eye.x) * dx + (pad.z - eye.z) * dz) / flatSq, 0, 1);
      const sideX = eye.x + dx * t - pad.x;
      const sideZ = eye.z + dz * t - pad.z;
      const height = eye.y + dy * t;
      const halfWidth = tower.figure.width / 2 + TAP_MARGIN;
      if (sideX * sideX + sideZ * sideZ > halfWidth * halfWidth) continue;
      if (height < 0 || height > PAD_TOP + towerHeight(tower) + TAP_MARGIN) continue;
      if (t < bestT) {
        bestT = t;
        best = k;
      }
    }
    return best;
  }

  // 화면을 그릴 때마다 카메라 위치를 기억해 둠
  function watchCamera(mesh) {
    mesh.onBeforeRender = (renderer, renderScene, camera) => {
      if (!camera.isPerspectiveCamera) return;
      cameraSeen.position.setFromMatrixPosition(camera.matrixWorld);
      cameraSeen.known = true;
    };
  }

  function cameraEye(out) {
    if (cameraSeen.known) return out.copy(cameraSeen.position);
    // 아직 그리기 전이면 설정값으로 짐작
    const pitch = (config.camera?.pitchDeg ?? 55) * DEG;
    const flat = Math.cos(pitch) * GUESS_CAMERA_DISTANCE;
    return out.set(Math.sin(lastYaw) * flat, Math.sin(pitch) * GUESS_CAMERA_DISTANCE, Math.cos(lastYaw) * flat);
  }

  // ── 정보 ──
  function padInfo(index) {
    const pad = pads[index];
    if (!pad) return null;
    const tower = pad.tower;
    return {
      position: new THREE.Vector3(pad.x, PAD_TOP + (tower ? towerHeight(tower) : 0) / 2, pad.z),
      tower: tower ? describe(tower) : null,
    };
  }

  function describe(tower) {
    return {
      pad: tower.pad,
      typeId: tower.typeId,
      name: tower.name,
      level: tower.level,
      maxLevel,
      built: tower.built,
      damage: tower.damage,
      range: tower.range,
      fireInterval: tower.fireInterval,
      spent: tower.spent,
    };
  }

  function list() {
    const towers = [];
    for (const pad of pads) if (pad.tower) towers.push(pad.tower);
    return towers;
  }

  // ── 다시 하기 · 그림 바꾸기 ──
  function clear() {
    for (const pad of pads) {
      const tower = pad.tower;
      if (!tower) continue;
      tower.removed = true;
      tower.built = false;
      for (const crown of tower.crowns) crown.dispose();
      tower.figure?.dispose();
      tower.figure = null;
      tower.crowns = [];
      pad.tower = null;
    }
    refreshHighlight();
  }

  // 그 종류 타워를 새 그림으로 다시 쌓음 (레벨·쓴 돈은 그대로, 다 쌓인 뒤 왕관도 다시 얹음)
  function refreshArt(typeId) {
    if (!config.towers[typeId]) return;
    prepareBlueprint(typeId);
    for (const pad of pads) {
      const tower = pad.tower;
      if (!tower || tower.typeId !== typeId) continue;
      const oldFigure = tower.figure;
      const oldCrowns = tower.crowns;
      tower.figure = null; // 예전 인형의 '다 쌓임' 소식은 무시되게 함
      center.set(pad.x, PAD_TOP + (oldFigure ? oldFigure.height * 0.4 : 0), pad.z);
      const blocks = breakApart(oldFigure, oldCrowns);
      if (blocks.length > 0) debris.burst(blocks, { from: center, ...REFRESH_BURST });
      startFigure(tower);
      events.emit('towerBuildStarted', { tower });
    }
    refreshHighlight();
  }

  return {
    padAt,
    padInfo,
    build,
    upgradeCost,
    upgrade,
    sellValue,
    sell,
    update,
    highlight,
    clear,
    refreshArt,
    list,
    get padCount() {
      return pads.length;
    },
    get selected() {
      return selected;
    },
    // 다른 모듈·테스트에서 쓸 수 있는 손잡이
    pads,
  };
}

// 받침 블록이 바닥판 돌기와 같은 줄에 놓이도록 가운데 위치를 맞춤
function snapToStuds(value, padSize, arenaSize) {
  const studOffset = arenaSize % 2 === 0 ? 0.5 : 0; // 바닥판 돌기 위치 (칸 가운데)
  const offset = (studOffset + (padSize - 1) / 2) % 1;
  return Math.round(value - offset) + offset;
}

// 강화 왕관 설계도: 아래 줄은 꽉 차고, 맨 윗줄은 한 칸씩 건너뛰어 왕관처럼 뾰족뾰족
// (설계도 내용은 blueprints.js 의 getSolidBlueprint 와 같은 모양)
const crownCache = new Map();

function getCrownBlueprint(columns, rows, depth, hex) {
  const cacheKey = `${columns}|${rows}|${depth}|${hex}`;
  const cached = crownCache.get(cacheKey);
  if (cached) return cached;
  const color = new THREE.Color(hex);
  const cells = [];
  for (let y = 0; y < rows; y++) {
    const top = rows > 1 && y === rows - 1;
    for (let x = 0; x < columns; x++) {
      if (top && Math.min(x, columns - 1 - x) % 2 === 1) continue; // 왕관 톱니 사이 빈칸
      for (let z = 0; z < depth; z++) cells.push(x, y, z);
    }
  }
  const count = cells.length / 3;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = cells[i * 3] - (columns - 1) / 2;
    positions[i * 3 + 1] = cells[i * 3 + 1] + 0.5;
    positions[i * 3 + 2] = (depth - 1) / 2 - cells[i * 3 + 2];
  }
  const blueprint = {
    key: `crown|${cacheKey}`,
    columns,
    rows,
    depth,
    count,
    positions,
    cells: Int16Array.from(cells),
    colors: new Array(count).fill(color),
    width: columns,
    height: rows,
  };
  crownCache.set(cacheKey, blueprint);
  return blueprint;
}
