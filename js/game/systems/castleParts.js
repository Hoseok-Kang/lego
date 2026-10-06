// 성 부품 (성 둘레 자리에 붙여서 성을 키우기)
// 성 돌바닥 위, 성 그림 둘레에 노란 '+' 표시가 있는 자리가 8개 있습니다. 모서리 4곳에는 망루·대포 포대를,
// 옆면 4곳에는 성벽·창고·수리소를 붙일 수 있습니다. 부품은 블록이 하나씩 떨어져 쌓이며 지어지고,
// 강화하면 지붕이 위로 들렸다가 새 층이 쌓인 뒤 다시 내려앉아 한 층씩 높아집니다.
// 부품은 성의 일부라서 성 체력을 같이 쓰고, 몬스터가 때리면 그쪽 부품의 블록부터 떨어져 나갑니다.
// 부품 종류·값·효과 숫자는 gameConfig.js 의 castleParts, 모양은 js/game/art/castlePartArt.js 에 있습니다.
//
// 할 수 있는 일
//   castleParts.socketAt(땅 위치)          그 위치(또는 그 앞에 서 있는 부품)의 자리 번호 (없으면 null)
//   castleParts.socketInfo(번호)           { position(메뉴를 띄울 곳), kind: 'corner'|'side', part: null | { typeId, name,
//                                            level, maxLevel, built, description, effect(지금 효과 글), nextEffect } }
//   castleParts.optionsFor(번호)           그 자리에 지을 수 있는 부품 [{ typeId, name, description, cost, free }]
//   castleParts.build(번호, 종류)           부품 짓기 시작 (돈 계산은 game.js 가 함). 다 쌓이면 'partBuilt' 소식
//   castleParts.upgradeCost(번호)          강화 비용 (강화할 수 없으면 null)
//   castleParts.upgrade(번호)              한 단계 강화 → 'partUpgraded' 소식
//   castleParts.grantFreePart(종류)        다음 그 종류 부품 하나를 무료로 (보상 카드)
//   castleParts.freeTokens                 무료로 지을 수 있는 부품 수 { 종류: 개수 }
//   castleParts.waveGold()                 창고들이 웨이브마다 주는 돈 합계
//   castleParts.repairBonus()              수리소들이 웨이브마다 더 고치는 성 체력 합계
//   castleParts.buildSpeedBonus()          수리소들 덕분에 타워를 더 빨리 짓는 비율 합계 (0.2 = 20%)
//   castleParts.highlight(번호 | null)      고른 자리를 노랗게 표시 (쏘는 부품이면 사거리 원도 보여 줌)
//   castleParts.update(dt, { cameraYaw })  매 장면마다: 쌓기·강화 모션, 쏘기, 굴뚝 연기, '+' 표시
//   castleParts.clear()                    부품 전부 없애기 (무료 부품도 처음으로). 성 체력은 castle.reset() 이 되돌림
//   castleParts.list()                     지어진 부품 목록 (읽기만 하세요)
//
// 부품 레벨 L 의 효과 = 기본 효과 × (1 + levelBoost × (L - 1))   (levelBoost 0.5 → 레벨 2 는 1.5배, 레벨 3 은 2배)
//   망루·대포 포대: 공격력 (× 보상 카드의 부품 공격력 배율)   성벽: 성 최대 체력   창고: 웨이브 돈   수리소: 수리량·짓기 빠르기
// 쏘는 부품은 타워처럼 사거리 안에서 성에 가장 가까운 몬스터를 쏩니다 (사거리는 자리 가운데에서 잼).
// 부품은 카메라를 따라 돌지 않는 진짜 3D 블록 건물입니다.

import * as THREE from '../../lib/three.js';
import { BlockFigure } from '../core/blockFigure.js';
import { getVoxelBlueprint } from '../core/blueprints.js';
import { createBlockBatch } from '../core/blockAssets.js';
import { partVoxels, partAnchor } from '../art/castlePartArt.js';

// ── 바꿔도 되는 숫자 ──
const PLATFORM_TOP = 1; // 성 돌바닥 높이 (부품은 이 위에 섬)
const MARKER_COLOR = '#F2CD37'; // 빈 자리 '+' 표시 색 (노랑: 타워 자리의 흰 '+' 와 구별)
const MARKER_SELECTED_COLOR = '#F4F4F4'; // 고른 빈 자리의 '+' 표시 색 (흰색)
const MARKER_THICKNESS = 0.45; // '+' 표시 블록 두께
const MARKER_LIFT = 0.3; // '+' 표시가 돌바닥 위로 떠 있는 높이
const MARKER_BOB = 0.22; // '+' 표시가 위아래로 둥실거리는 폭
const MARKER_BOB_SECONDS = 1.6; // 한 번 둥실거리는 시간
const FOOTPRINT_COLOR = '#F2CD37'; // 고른 자리 바닥(부품이 들어갈 칸)을 칠하는 색
const FOOTPRINT_OPACITY = 0.45;
const HIGHLIGHT_COLOR = '#F2CD37'; // 고른 부품을 물들이는 색
const HIGHLIGHT_AMOUNT = 0.35; // 물들이는 정도 (0~1)
const RANGE_RING_COLOR = '#FFFFFF'; // 사거리 원 색
const RANGE_RING_OPACITY = 0.75;
const RANGE_RING_WIDTH = 0.35;
const RANGE_FILL_OPACITY = 0.12;
const PART_KEEP_SHARE = 0.3; // 부품 몸통 블록은 이 비율만큼 남겨 둔 채 다른 곳이 먼저 부서짐 (밑동이 남아 있게)
const CAP_MIN_SECONDS = 0.8; // 지을 때 지붕이 쌓이는 최소 시간 (몸통이 다 쌓인 뒤 지붕이 쌓임)
const FLOOR_BUILD_SECONDS = 1.1; // 강화할 때 새 층이 쌓이는 시간
const FLOOR_DROP = 3; // 강화할 때 새 층 블록이 떨어지는 높이 (칸)
const LIFT_SECONDS = 0.35; // 강화할 때 지붕이 위로 들리는 시간
const SETTLE_SECONDS = 0.22; // 새 층 위로 지붕이 다시 내려앉는 시간
const FIRST_SHOT_DELAY = 0.3; // 다 지은 뒤 첫 발을 쏘기까지 기다리는 시간
const RECOIL_SECONDS = 0.2; // 쏠 때 꼭대기가 뒤로 밀리는 시간
const RECOIL_KICK = { cannonball: 0.35, arrow: 0.06 }; // 쏠 때 꼭대기가 뒤로 밀리는 거리 (발사체 종류별)
const SMOKE_INTERVAL = 0.55; // 굴뚝 연기가 나오는 간격 (초)
const SMOKE_SECONDS = 1.9; // 연기 한 조각이 사라지기까지 시간
const SMOKE_RISE = 1.5; // 연기가 1초에 올라가는 높이
const SMOKE_SIZE = 0.62; // 연기 조각 가장 클 때 크기 (블록 한 칸 = 1)
const SMOKE_COLORS = ['#F4F4F4', '#A0A5A9'];
const SMOKE_CAPACITY = 40; // 한꺼번에 보일 수 있는 연기 조각 수
const TAP_MARGIN = 0.5; // 부품을 눌렀다고 봐주는 여유 (칸)
const EMPTY_TAP_HEIGHT = 1.5; // 빈 자리를 누를 때 봐주는 높이 (칸)
const MENU_LIFT = 1; // 메뉴를 부품 꼭대기에서 이만큼 위에 띄움
const SKIP_ARRIVING = true; // true: 몸이 아직 만들어지는 중인 몬스터는 쏘지 않음

// 빈 자리 '+' 표시 모양 (가운데 + 위아래좌우 한 칸씩)
const MARKER_CELLS = [
  [0, 0],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

const CAP_LAYER = 10; // 지붕 인형의 층 번호 (성이 맞을 때 위 인형부터 부서지게 가장 큰 수)
const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const GUESS_CAMERA_DISTANCE = 110; // 화면을 아직 한 번도 안 그렸을 때 짐작하는 카메라 거리

export function createCastleParts({ scene, events, castle, enemies, projectiles, debris, modifiers, config }) {
  const partsConfig = config.castleParts;
  const types = partsConfig.types;
  const maxLevel = partsConfig.maxLevel;
  const platformSize = config.castle.platformSize;

  const root = new THREE.Group();
  root.name = 'castle-parts';
  scene.add(root);

  // 매 장면 재사용하는 값 (새로 만들지 않아 가벼움)
  const muzzle = new THREE.Vector3();
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const noTurn = new THREE.Quaternion();
  const spinTurn = new THREE.Quaternion();
  const tmpColor = new THREE.Color();
  const markerColor = new THREE.Color(MARKER_COLOR);
  const markerSelectedColor = new THREE.Color(MARKER_SELECTED_COLOR);
  const smokeColors = SMOKE_COLORS.map((hex) => new THREE.Color(hex));
  const ray = new THREE.Ray();
  const hit = new THREE.Vector3();
  const cameraSeen = { known: false, position: new THREE.Vector3() };

  let tokens = {}; // 무료 부품: 종류 → 개수
  let selected = null;
  let lastYaw = 0;
  let clock = 0;

  const sockets = partsConfig.sockets.map(createSocket);
  const markers = createBlockBatch(sockets.length * MARKER_CELLS.length, { castShadow: false });
  root.add(markers.bodies, markers.studs);
  const footprintMark = createFootprintMark();
  const ring = createRangeRing();
  const smoke = createSmoke();
  watchCamera(castle.platform?.bodies ?? markers.bodies);

  // ── 자리 ──
  function createSocket(def, index) {
    const kind = def.kind === 'side' ? 'side' : 'corner';
    const foot = partsConfig.footprint[kind];
    const facing = def.facing ?? 0;
    const outX = Math.cos(facing * DEG);
    const outZ = Math.sin(facing * DEG);
    // 옆면 부품은 성 가장자리를 따라 길게 놓임 (바깥 방향과 직각)
    const alongZ = kind === 'side' && Math.abs(outX) > Math.abs(outZ);
    const sizeX = alongZ ? foot.depth : foot.width;
    const sizeZ = alongZ ? foot.width : foot.depth;
    const x = snapCentre(def.x, sizeX, platformSize);
    const z = snapCentre(def.z, sizeZ, platformSize);
    return {
      index,
      kind,
      facing,
      x,
      z,
      outX,
      outZ,
      footprint: { x, z, halfX: sizeX / 2, halfZ: sizeZ / 2 },
      box: new THREE.Box3(),
      part: null,
    };
  }

  // 고른 자리 바닥에 칠하는 판 (돌바닥 돌기 사이로 노랗게 보임)
  function createFootprintMark() {
    const geometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const material = new THREE.MeshBasicMaterial({
      color: FOOTPRINT_COLOR,
      transparent: true,
      opacity: FOOTPRINT_OPACITY,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.visible = false;
    mesh.renderOrder = 1;
    root.add(mesh);
    return mesh;
  }

  // 사거리 원: 테두리 + 옅게 칠한 안쪽 (towers.js 와 같은 모양)
  function createRangeRing() {
    const group = new THREE.Group();
    group.visible = false;
    const band = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshBasicMaterial({ color: RANGE_RING_COLOR, transparent: true, opacity: RANGE_RING_OPACITY, depthWrite: false }),
    );
    const fill = new THREE.Mesh(
      new THREE.BufferGeometry(),
      new THREE.MeshBasicMaterial({ color: RANGE_RING_COLOR, transparent: true, opacity: RANGE_FILL_OPACITY, depthWrite: false }),
    );
    fill.visible = RANGE_FILL_OPACITY > 0;
    band.renderOrder = 2;
    fill.renderOrder = 1;
    group.add(fill, band);
    group.position.y = 0.2;
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

  // ── 값 계산 ──
  function levelFactor(level) {
    return 1 + partsConfig.levelBoost * (level - 1);
  }

  function priceOf(type) {
    const discount = THREE.MathUtils.clamp(modifiers?.values.partDiscount ?? 0, 0, 0.9);
    return Math.round(type.cost * (1 - discount));
  }

  function partDamage(part) {
    const boost = modifiers?.values.partDamage?.[part.typeId] ?? 1;
    return (part.type.damage ?? 0) * boost * levelFactor(part.level);
  }

  function splashOf(part) {
    const splash = part.type.splashRadius ?? 0;
    return splash > 0 ? splash + (modifiers?.values.splashBonus ?? 0) : 0;
  }

  // ── 짓기 ──
  function optionsFor(index) {
    const socket = sockets[index];
    if (!socket || socket.part) return [];
    const options = [];
    for (const [typeId, type] of Object.entries(types)) {
      if (type.socket !== socket.kind) continue;
      const free = (tokens[typeId] ?? 0) > 0;
      options.push({ typeId, name: type.name, description: type.description, cost: free ? 0 : priceOf(type), free });
    }
    return options;
  }

  // 부품 짓기 시작: 몸통이 쌓이고, 이어서 지붕이 쌓이면 완성 (돈은 game.js 가 먼저 냄)
  function build(index, typeId) {
    const socket = sockets[index];
    const type = types[typeId];
    if (!socket || !type || socket.part || type.socket !== socket.kind) return null;
    const free = (tokens[typeId] ?? 0) > 0;
    if (free) tokens[typeId] -= 1;
    const part = {
      socket: index,
      typeId,
      type,
      name: type.name,
      level: 1,
      maxLevel,
      built: false,
      removed: false,
      free,
      body: null,
      cap: null,
      floors: [],
      capBase: 0, // 지붕 맨 아래층 높이 (레벨 1)
      capRows: 0,
      capLift: 0, // 강화로 지붕이 올라간 높이 (모션 중에는 그 순간 높이)
      lift: 0, // 강화가 끝났을 때 지붕 높이
      anim: null,
      cooldown: 0,
      recoil: 0,
      smokeTimer: Math.random() * SMOKE_INTERVAL,
      muzzle: partAnchor(typeId, 'muzzle', socket),
      chimney: partAnchor(typeId, 'smoke', socket),
    };
    socket.part = part;

    const voxels = partVoxels(typeId, 1, socket);
    const bodyVoxels = voxels.filter((voxel) => !voxel.cap);
    const capVoxels = voxels.filter((voxel) => voxel.cap);
    part.capBase = capVoxels.length ? Math.min(...capVoxels.map((voxel) => voxel.y)) : layerTop(bodyVoxels);
    part.capRows = capVoxels.length ? layerTop(capVoxels) - part.capBase : 0;
    part.body = addFigure(part, 'body', bodyVoxels, 0, 0);

    const total = type.buildSeconds;
    const capShare = capVoxels.length / Math.max(1, voxels.length);
    const capSeconds = capVoxels.length ? THREE.MathUtils.clamp(total * capShare, CAP_MIN_SECONDS, total * 0.6) : 0;
    part.body.build(Math.max(0.5, total - capSeconds), {
      onLand: () => events.emit('blockLanded'),
      onComplete: () => startCap(part, capVoxels, capSeconds),
    });
    if (selected === index) refreshHighlight();
    return part;
  }

  function startCap(part, capVoxels, seconds) {
    if (part.removed || castle.isDestroyed) return;
    if (capVoxels.length === 0) {
      finishBuild(part);
      return;
    }
    part.cap = addFigure(part, 'cap', capVoxels, part.capBase, CAP_LAYER);
    part.cap.build(seconds, {
      onLand: () => events.emit('blockLanded'),
      onComplete: () => finishBuild(part),
    });
  }

  function finishBuild(part) {
    if (part.removed || part.built) return;
    part.built = true;
    part.cooldown = FIRST_SHOT_DELAY;
    if (part.type.hpBonus && !castle.isDestroyed) castle.addMaxHp(part.type.hpBonus);
    if (selected === part.socket) refreshHighlight();
    events.emit('partBuilt', { part });
  }

  // 블록 목록 → 부품 인형 하나 (성에 붙여서 성과 함께 맞고·고쳐지고·무너짐)
  function addFigure(part, name, voxels, baseY, layer) {
    const socket = sockets[part.socket];
    const key = `castle-part|${part.typeId}|${name}|${socket.kind}|${socket.facing}`;
    const blueprint = getVoxelBlueprint(
      key,
      voxels.map((voxel) => ({ x: voxel.x, y: voxel.y - baseY, z: voxel.z, hex: voxel.hex })),
    );
    const figure = new BlockFigure(blueprint, root);
    figure.group.position.set(socket.x, PLATFORM_TOP + baseY, socket.z);
    castle.attachFigure(figure, {
      group: part,
      layer,
      keep: layer === 0 ? PART_KEEP_SHARE : 0,
      footprint: socket.footprint,
    });
    if (selected === part.socket) figure.setTint(HIGHLIGHT_COLOR, HIGHLIGHT_AMOUNT);
    return figure;
  }

  // ── 강화 ──
  function upgradeCost(index) {
    const part = sockets[index]?.part;
    if (!part || !part.built || part.level >= maxLevel) return null;
    const rate = partsConfig.upgradeCostRate[part.level];
    if (rate === undefined) return null;
    return Math.round(part.type.cost * rate);
  }

  // 한 단계 강화: 지붕이 들림 → 새 층이 쌓임 → 지붕이 내려앉음. 효과는 바로 올라감 (돈은 game.js 가 먼저 냄)
  function upgrade(index) {
    if (upgradeCost(index) === null) return false;
    const socket = sockets[index];
    const part = socket.part;
    finishAnimation(part);
    part.level += 1;
    if (part.type.hpBonus) castle.addMaxHp(part.type.hpBonus * partsConfig.levelBoost);
    const voxels = partVoxels(part.typeId, part.level, socket);
    if (voxels.length > 0) {
      const base = Math.min(...voxels.map((voxel) => voxel.y));
      const height = layerTop(voxels) - base;
      part.anim = {
        phase: part.cap ? 'lift' : 'floor',
        time: 0,
        level: part.level,
        voxels,
        base,
        from: part.lift,
        to: part.lift + height,
        hover: Math.max(0.5, FLOOR_DROP + 1 - height) + 0.5,
        floor: null,
      };
      if (!part.cap) startFloor(part);
    }
    if (selected === index) refreshHighlight();
    events.emit('partUpgraded', { part });
    return true;
  }

  function startFloor(part) {
    const anim = part.anim;
    anim.phase = 'floor';
    anim.time = 0;
    anim.floor = addFigure(part, `floor${anim.level}`, anim.voxels, anim.base, anim.level - 1);
    part.floors.push(anim.floor);
    anim.floor.build(FLOOR_BUILD_SECONDS, { dropHeight: FLOOR_DROP, onLand: () => events.emit('blockLanded') });
  }

  function updateAnimation(part, dt) {
    const anim = part.anim;
    if (!anim) return;
    anim.time += dt;
    if (anim.phase === 'lift') {
      const p = Math.min(1, anim.time / LIFT_SECONDS);
      setCapLift(part, anim.from + (anim.to + anim.hover - anim.from) * easeOutCubic(p));
      if (p >= 1) startFloor(part);
    } else if (anim.phase === 'floor') {
      if (anim.floor.isBuilt) {
        anim.phase = part.cap ? 'settle' : 'done';
        anim.time = 0;
      }
    } else if (anim.phase === 'settle') {
      const p = Math.min(1, anim.time / SETTLE_SECONDS);
      setCapLift(part, anim.to + anim.hover * (1 - p * p));
      if (p >= 1) {
        events.emit('blockLanded');
        anim.phase = 'done';
      }
    }
    if (anim.phase === 'done') {
      part.lift = anim.to;
      setCapLift(part, anim.to);
      part.anim = null;
    }
  }

  // 강화 모션이 남아 있으면 바로 끝냄 (연달아 강화할 때)
  function finishAnimation(part) {
    const anim = part.anim;
    if (!anim) return;
    if (!anim.floor) startFloor(part);
    anim.floor.finishBuild();
    part.lift = anim.to;
    setCapLift(part, anim.to);
    part.anim = null;
  }

  function setCapLift(part, lift) {
    part.capLift = lift;
    if (part.cap) part.cap.group.position.y = PLATFORM_TOP + part.capBase + lift;
  }

  // ── 매 장면마다 ──
  function update(dt, { cameraYaw = lastYaw } = {}) {
    lastYaw = cameraYaw;
    clock += dt;
    for (let k = 0; k < sockets.length; k++) {
      const part = sockets[k].part;
      if (part) updatePart(part, dt);
    }
    updateSmoke(dt);
    updateMarkers();
  }

  function updatePart(part, dt) {
    part.body.update(dt);
    for (let i = 0; i < part.floors.length; i++) part.floors[i].update(dt);
    if (part.cap) part.cap.update(dt);
    updateAnimation(part, dt);
    updateRecoil(part, dt);
    if (!part.built || castle.isDestroyed) return;
    if (part.chimney) puffSmoke(part, dt);
    if (part.type.projectile) updateShooter(part, dt);
  }

  // 쏠 때 꼭대기(지붕)가 바깥 반대쪽으로 살짝 밀렸다 돌아옴
  function updateRecoil(part, dt) {
    if (!part.cap) return;
    const socket = sockets[part.socket];
    part.recoil = Math.max(0, part.recoil - dt);
    const kick = (RECOIL_KICK[part.type.projectile] ?? 0) * Math.sin((Math.PI * part.recoil) / RECOIL_SECONDS);
    part.cap.group.position.x = socket.x - socket.outX * kick;
    part.cap.group.position.z = socket.z - socket.outZ * kick;
  }

  function updateShooter(part, dt) {
    part.cooldown -= dt;
    if (part.cooldown > 0) return;
    const target = findTarget(part);
    if (!target) {
      part.cooldown = 0; // 몬스터가 들어오면 바로 쏨
      return;
    }
    fire(part, target);
    part.cooldown += part.type.fireInterval;
  }

  // 사거리 안에서 성에 가장 가까운 몬스터
  function findTarget(part) {
    const socket = sockets[part.socket];
    const list = enemies.list();
    const range = part.type.range ?? 0;
    const rangeSq = range * range;
    let best = null;
    let bestScore = Infinity;
    for (let i = 0; i < list.length; i++) {
      const enemy = list[i];
      if (!enemy.alive || enemy.state === 'dead') continue;
      if (SKIP_ARRIVING && enemy.state === 'arriving') continue;
      const dx = enemy.position.x - socket.x;
      const dz = enemy.position.z - socket.z;
      if (dx * dx + dz * dz > rangeSq) continue;
      const score = Math.max(Math.abs(enemy.position.x), Math.abs(enemy.position.z));
      if (score < bestScore) {
        bestScore = score;
        best = enemy;
      }
    }
    return best;
  }

  function fire(part, target) {
    const socket = sockets[part.socket];
    const anchor = part.muzzle;
    if (anchor) {
      muzzle.set(socket.x + anchor.x, PLATFORM_TOP + anchor.y + part.capLift, socket.z + anchor.z);
    } else {
      muzzle.set(socket.x, PLATFORM_TOP + partHeight(part), socket.z);
    }
    // 망루처럼 reach 가 있으면 몬스터 쪽 벽에서 쏨
    const reach = anchor?.reach ?? 0;
    if (reach > 0) {
      const dx = target.position.x - socket.x;
      const dz = target.position.z - socket.z;
      const distance = Math.hypot(dx, dz);
      if (distance > 1e-4) {
        muzzle.x += (dx / distance) * reach;
        muzzle.z += (dz / distance) * reach;
      }
    }
    projectiles.fire({
      kind: part.type.projectile,
      from: muzzle,
      target,
      damage: partDamage(part),
      splashRadius: splashOf(part),
      slow: part.type.slow ?? 0,
      slowSeconds: part.type.slowSeconds ?? 0,
      speed: part.type.projectileSpeed,
    });
    part.recoil = RECOIL_SECONDS;
  }

  // 부품 높이 (돌바닥 위 블록 줄 수, 지붕 포함)
  function partHeight(part) {
    if (part.cap) return part.capBase + part.capLift + part.capRows;
    let top = part.body ? part.body.height : 0;
    for (const floor of part.floors) top = Math.max(top, floor.group.position.y - PLATFORM_TOP + floor.height);
    return top;
  }

  // ── 굴뚝 연기 (수리소) ──
  function createSmoke() {
    const batch = createBlockBatch(SMOKE_CAPACITY, { castShadow: false });
    root.add(batch.bodies, batch.studs);
    return {
      batch,
      x: new Float32Array(SMOKE_CAPACITY),
      y: new Float32Array(SMOKE_CAPACITY),
      z: new Float32Array(SMOKE_CAPACITY),
      driftX: new Float32Array(SMOKE_CAPACITY),
      driftZ: new Float32Array(SMOKE_CAPACITY),
      age: new Float32Array(SMOKE_CAPACITY),
      spin: new Float32Array(SMOKE_CAPACITY),
      count: 0,
      colorIndex: 0,
    };
  }

  function puffSmoke(part, dt) {
    part.smokeTimer -= dt;
    if (part.smokeTimer > 0) return;
    part.smokeTimer += SMOKE_INTERVAL * (0.8 + Math.random() * 0.4);
    if (smoke.count >= SMOKE_CAPACITY) return;
    const socket = sockets[part.socket];
    const i = smoke.count++;
    smoke.x[i] = socket.x + part.chimney.x;
    smoke.y[i] = PLATFORM_TOP + part.chimney.y + part.capLift;
    smoke.z[i] = socket.z + part.chimney.z;
    smoke.driftX[i] = (Math.random() - 0.5) * 0.5 + 0.25;
    smoke.driftZ[i] = (Math.random() - 0.5) * 0.5;
    smoke.age[i] = 0;
    smoke.spin[i] = (Math.random() - 0.5) * 2;
    const color = smokeColors[smoke.colorIndex++ % smokeColors.length];
    smoke.batch.bodies.setColorAt(i, color);
    smoke.batch.studs.setColorAt(i, color);
    smoke.batch.bodies.instanceColor.needsUpdate = true;
    smoke.batch.studs.instanceColor.needsUpdate = true;
  }

  function updateSmoke(dt) {
    const { batch } = smoke;
    let i = 0;
    while (i < smoke.count) {
      smoke.age[i] += dt;
      if (smoke.age[i] >= SMOKE_SECONDS) {
        removeSmoke(i);
        continue;
      }
      smoke.y[i] += SMOKE_RISE * dt;
      smoke.x[i] += smoke.driftX[i] * dt;
      smoke.z[i] += smoke.driftZ[i] * dt;
      const p = smoke.age[i] / SMOKE_SECONDS;
      const size = SMOKE_SIZE * Math.sin(Math.PI * Math.min(1, p * 1.15)) + 0.001;
      position.set(smoke.x[i], smoke.y[i], smoke.z[i]);
      spinTurn.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, smoke.spin[i] * smoke.age[i]);
      scale.set(size, size, size);
      matrix.compose(position, spinTurn, scale);
      batch.bodies.setMatrixAt(i, matrix);
      batch.studs.setMatrixAt(i, matrix);
      i++;
    }
    batch.bodies.count = smoke.count;
    batch.studs.count = smoke.count;
    batch.bodies.instanceMatrix.needsUpdate = true;
    batch.studs.instanceMatrix.needsUpdate = true;
  }

  function removeSmoke(i) {
    const last = smoke.count - 1;
    if (i !== last) {
      for (const list of [smoke.x, smoke.y, smoke.z, smoke.driftX, smoke.driftZ, smoke.age, smoke.spin]) list[i] = list[last];
      smoke.batch.bodies.getColorAt(last, tmpColor);
      smoke.batch.bodies.setColorAt(i, tmpColor);
      smoke.batch.studs.setColorAt(i, tmpColor);
      smoke.batch.bodies.instanceColor.needsUpdate = true;
      smoke.batch.studs.instanceColor.needsUpdate = true;
    }
    smoke.count = last;
  }

  // ── 빈 자리 '+' 표시 (둥실둥실). 부품이 있거나 성이 무너졌으면 숨김 ──
  function updateMarkers() {
    const { bodies, studs } = markers;
    let n = 0;
    if (!castle.isDestroyed) {
      for (let k = 0; k < sockets.length; k++) {
        const socket = sockets[k];
        if (socket.part) continue;
        const wave = Math.sin((clock * TAU) / MARKER_BOB_SECONDS + k * 0.8);
        const y = PLATFORM_TOP + MARKER_THICKNESS / 2 + MARKER_LIFT + MARKER_BOB * (0.5 + 0.5 * wave);
        const color = k === selected ? markerSelectedColor : markerColor;
        scale.set(0.92, MARKER_THICKNESS, 0.92);
        for (let c = 0; c < MARKER_CELLS.length; c++) {
          // 블록이 돌바닥 돌기 줄에 맞게: 가운데 칸이 반 칸 어긋나면 반 칸 옮김
          position.set(markerCell(socket.x) + MARKER_CELLS[c][0], y, markerCell(socket.z) + MARKER_CELLS[c][1]);
          matrix.compose(position, noTurn, scale);
          bodies.setMatrixAt(n, matrix);
          studs.setMatrixAt(n, matrix);
          bodies.setColorAt(n, color);
          studs.setColorAt(n, color);
          n++;
        }
      }
    }
    bodies.count = n;
    studs.count = n;
    bodies.instanceMatrix.needsUpdate = true;
    studs.instanceMatrix.needsUpdate = true;
    if (bodies.instanceColor) bodies.instanceColor.needsUpdate = true;
    if (studs.instanceColor) studs.instanceColor.needsUpdate = true;
  }

  function markerCell(value) {
    const studOffset = platformSize % 2 === 0 ? 0.5 : 0;
    return Math.round(value - studOffset) + studOffset;
  }

  // ── 고르기 (노랗게 표시 + 사거리 원) ──
  function highlight(index) {
    selected = index !== null && index !== undefined && sockets[index] ? index : null;
    for (const socket of sockets) {
      const part = socket.part;
      if (!part) continue;
      const tint = socket.index === selected ? HIGHLIGHT_COLOR : null;
      for (const figure of partFigures(part)) figure.setTint(tint, HIGHLIGHT_AMOUNT);
    }
    refreshHighlight();
    updateMarkers();
  }

  function refreshHighlight() {
    const socket = selected === null ? null : sockets[selected];
    footprintMark.visible = Boolean(socket);
    if (socket) {
      footprintMark.position.set(socket.x, PLATFORM_TOP + 0.02, socket.z);
      footprintMark.scale.set(socket.footprint.halfX * 2, 1, socket.footprint.halfZ * 2);
    }
    const part = socket?.part;
    if (!part || !part.type.range) {
      ring.group.visible = false;
      return;
    }
    setRingRadius(part.type.range);
    ring.group.position.x = socket.x;
    ring.group.position.z = socket.z;
    ring.group.visible = true;
  }

  function partFigures(part) {
    const list = [];
    if (part.body) list.push(part.body);
    for (const floor of part.floors) list.push(floor);
    if (part.cap) list.push(part.cap);
    return list;
  }

  // ── 누른 곳 → 자리 ──
  // 카메라에서 누른 땅까지의 선이 자리(부품 높이까지의 상자)를 먼저 지나가면 그 자리.
  // 키 큰 망루의 몸통을 눌러도 그 자리로 침. 성 그림이 더 앞에 있으면 성을 누른 것으로 봄
  function socketAt(point) {
    if (!point) return null;
    cameraEye(ray.origin);
    ray.direction.subVectors(point, ray.origin);
    if (ray.direction.lengthSq() < 1e-8) return null;
    ray.direction.normalize();
    let best = null;
    let bestDistance = Infinity;
    for (const socket of sockets) {
      const box = socketBox(socket);
      if (!ray.intersectBox(box, hit)) continue;
      const distance = hit.distanceTo(ray.origin);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = socket.index;
      }
    }
    if (best === null) return null;
    // 성 그림 뒤에 가려진 '빈' 자리는 그림을 눌러도 열림 (카메라를 돌리지 않아도 뒤쪽 자리를 쓸 수 있게)
    return castleInFront(bestDistance) && socketByIndex(best).part ? null : best;
  }

  function socketByIndex(index) {
    return sockets.find((socket) => socket.index === index);
  }

  function socketBox(socket) {
    const { x, z, halfX, halfZ } = socket.footprint;
    const height = socket.part ? partHeight(socket.part) : EMPTY_TAP_HEIGHT;
    socket.box.min.set(x - halfX - TAP_MARGIN, 0, z - halfZ - TAP_MARGIN);
    socket.box.max.set(x + halfX + TAP_MARGIN, PLATFORM_TOP + height + TAP_MARGIN, z + halfZ + TAP_MARGIN);
    return socket.box;
  }

  // 성 그림(카메라를 보는 판)이 자리보다 카메라에 더 가까이에서 선에 닿는지
  function castleInFront(socketDistance) {
    const figure = castle.figure;
    if (!figure || castle.isDestroyed) return false;
    const turn = figure.group.rotation.y;
    const nx = Math.sin(turn);
    const nz = Math.cos(turn);
    const facing = ray.direction.x * nx + ray.direction.z * nz;
    if (Math.abs(facing) < 1e-6) return false;
    const t = -(ray.origin.x * nx + ray.origin.z * nz) / facing;
    if (t <= 0 || t >= socketDistance) return false;
    const px = ray.origin.x + ray.direction.x * t;
    const py = ray.origin.y + ray.direction.y * t;
    const pz = ray.origin.z + ray.direction.z * t;
    const across = px * Math.cos(turn) - pz * Math.sin(turn);
    return Math.abs(across) <= figure.width / 2 && py >= PLATFORM_TOP && py <= PLATFORM_TOP + figure.height;
  }

  // 화면을 그릴 때마다 카메라 위치를 기억해 둠
  function watchCamera(mesh) {
    const previous = mesh.onBeforeRender;
    mesh.onBeforeRender = (renderer, renderScene, camera, ...rest) => {
      previous?.call(mesh, renderer, renderScene, camera, ...rest);
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
  function socketInfo(index) {
    const socket = sockets[index];
    if (!socket) return null;
    const part = socket.part;
    return {
      index,
      kind: socket.kind,
      position: new THREE.Vector3(socket.x, PLATFORM_TOP + (part ? partHeight(part) : 1) + MENU_LIFT, socket.z),
      // 메뉴 위치만 볼 때(매 장면)는 설명 글을 만들지 않도록, 읽을 때 만듦
      get part() {
        return part ? describe(part) : null;
      },
    };
  }

  function describe(part) {
    const info = {
      socket: part.socket,
      typeId: part.typeId,
      name: part.name,
      level: part.level,
      maxLevel,
      built: part.built,
      description: part.type.description,
      effect: effectText(part, part.level),
      nextEffect: part.level < maxLevel ? effectText(part, part.level + 1) : null,
    };
    if (part.type.projectile) {
      info.damage = partDamage(part);
      info.range = part.type.range;
      info.fireInterval = part.type.fireInterval;
    }
    return info;
  }

  // 지금(또는 다음 레벨) 효과를 짧은 글로
  function effectText(part, level) {
    const type = part.type;
    const factor = levelFactor(level);
    const lines = [];
    if (type.projectile) {
      const boost = modifiers?.values.partDamage?.[part.typeId] ?? 1;
      lines.push(`공격력 ${Math.round(type.damage * boost * factor)} · 사거리 ${type.range}`);
    }
    if (type.hpBonus) lines.push(`성 체력 +${Math.round(type.hpBonus * factor)}`);
    if (type.goldPerWave) lines.push(`웨이브마다 돈 +${Math.round(type.goldPerWave * factor)}`);
    if (type.repairBonus) lines.push(`웨이브마다 성 수리 +${Math.round(type.repairBonus * factor)}`);
    if (type.buildSpeedBonus) lines.push(`타워를 ${Math.round(type.buildSpeedBonus * factor * 100)}% 빨리 지음`);
    return lines.join(' · ');
  }

  function list() {
    const parts = [];
    for (const socket of sockets) if (socket.part) parts.push(socket.part);
    return parts;
  }

  // ── 가만히 있는 효과 (창고·수리소) ──
  function sumBuilt(field) {
    let total = 0;
    for (const socket of sockets) {
      const part = socket.part;
      if (part && part.built && part.type[field]) total += part.type[field] * levelFactor(part.level);
    }
    return total;
  }

  // ── 무료 부품 ──
  function grantFreePart(typeId) {
    if (!types[typeId]) return false;
    tokens[typeId] = (tokens[typeId] ?? 0) + 1;
    return true;
  }

  // ── 다시 하기 ──
  function clear() {
    for (const socket of sockets) {
      const part = socket.part;
      if (!part) continue;
      part.removed = true;
      part.built = false;
      part.anim = null;
      for (const figure of partFigures(part)) {
        castle.detachFigure(figure);
        figure.dispose();
      }
      part.body = null;
      part.cap = null;
      part.floors = [];
      socket.part = null;
    }
    tokens = {};
    smoke.count = 0;
    smoke.batch.bodies.count = 0;
    smoke.batch.studs.count = 0;
    highlight(null);
  }

  return {
    socketAt,
    socketInfo,
    optionsFor,
    build,
    upgradeCost,
    upgrade,
    grantFreePart,
    waveGold: () => Math.round(sumBuilt('goldPerWave')),
    repairBonus: () => Math.round(sumBuilt('repairBonus')),
    buildSpeedBonus: () => sumBuilt('buildSpeedBonus'),
    highlight,
    update,
    clear,
    list,
    get freeTokens() {
      const copy = {};
      for (const [typeId, count] of Object.entries(tokens)) if (count > 0) copy[typeId] = count;
      return copy;
    },
    get socketCount() {
      return sockets.length;
    },
    get selected() {
      return selected;
    },
    // 다른 모듈·테스트에서 쓸 수 있는 손잡이
    sockets,
  };
}

// 부품 블록이 돌바닥 돌기 줄에 딱 맞도록 자리 가운데를 바깥쪽으로 반 칸 옮기고, 돌바닥 밖으로 나가지 않게 함
function snapCentre(value, size, platformSize) {
  const studOffset = platformSize % 2 === 0 ? 0.5 : 0; // 돌바닥 돌기 위치 (칸 가운데)
  const offset = mod(studOffset + (size - 1) / 2, 1);
  let snapped = value;
  if (Math.abs(mod(value - offset + 0.5, 1) - 0.5) > 1e-6) {
    const below = Math.floor(value - offset) + offset;
    snapped = value >= 0 ? below + 1 : below;
  }
  const limit = platformSize / 2 - size / 2;
  return Math.max(-limit, Math.min(limit, snapped));
}

function mod(value, n) {
  return ((value % n) + n) % n;
}

// 블록 목록의 가장 높은 층 + 1
function layerTop(voxels) {
  let top = 0;
  for (const voxel of voxels) top = Math.max(top, voxel.y + 1);
  return top;
}

function easeOutCubic(t) {
  return 1 - (1 - t) ** 3;
}
