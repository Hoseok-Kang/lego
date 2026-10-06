// 몬스터 무리 (적 관리)
// 몬스터가 나타나면 블록이 모여 몸이 만들어지고, 성까지 걸어가서 성을 공격합니다.
// 몬스터가 맞으면 깎인 체력만큼 몸의 블록이 떨어져 나가고, 쓰러지면 남은 블록이 사방으로 튀어 나갑니다.
// 몬스터 종류별 체력·속도·공격력·돈은 gameConfig.js 의 enemies 에서 바꿉니다.
// 움직임의 크기·빠르기(통통 튀기, 날갯짓, 쿵쿵 걷기)는 아래 '움직임 설정' 숫자를 바꾸면 됩니다.
//
// 몬스터가 나타나는 거리(땅이 넓어지면 멀어짐)와 피해 다닐 타워 자리 목록은 game.js 가 알려 줍니다
// (getSpawnRadius, getPads). 박쥐는 타워 자리 위로 날아서 지나갑니다.
//
// 할 수 있는 일
//   enemies.spawn(종류, { angle, hpScale })      몬스터 한 마리 등장 → 몬스터
//                                                angle: 나타나는 방향(라디안), hpScale: 체력 배율
//                                                (그 방향에 타워 자리가 있으면 옆으로 살짝 비켜서 나타남)
//   enemies.update(dt, { cameraYaw })            매 장면마다 움직이기
//   enemies.damage(몬스터, 피해, { slow, slowSeconds, from })
//                                                한 마리 때리기 (slow: 느려지는 정도 0~1, from: 맞은 쪽 위치)
//   enemies.damageArea(위치, 반지름, 피해, { from })  그 둘레 안의 몬스터 모두 때리기 (대포)
//   enemies.slowAll(느려지는 정도, 초)             살아 있는 몬스터 모두 느리게 (얼려라 스킬) → 몇 마리
//   enemies.list()                               살아 있는 몬스터 목록 (읽기만 하세요)
//   enemies.aliveCount()                         살아 있는 몬스터 수
//   enemies.clear()                              모두 바로 지우기 (다시 하기)
//   enemies.refreshArt(종류)                     그림이 바뀌었을 때 (다음에 나오는 몬스터부터 새 그림)
//
// 몬스터 한 마리의 정보 (타워·발사체도 읽음)
//   id, typeId, type(설정), hp, maxHp
//   position   땅 위 위치            velocity  지금 걷는 속도 (땅 위)
//   center     몸 한가운데 (조준할 곳)  radius    몸 반지름 (가로 칸 수의 절반)
//   state      'arriving'(몸 만드는 중) | 'walking'(걷는 중) | 'attacking'(성 공격 중) | 'dead'
//   alive      살아 있는지              slowLeft  느려진 채로 남은 시간(초)
//   figure     블록 인형 (blockFigure.js)
//   assembling true 인 동안(대장이 잔해로 모이는 중)은 움직이지 않고 맞지도 않음 (bossAssembly.js 가 정함)

import * as THREE from '../../lib/three.js';
import { BlockFigure } from '../core/blockFigure.js';
import { getBlueprint, forgetBlueprints } from '../core/blueprints.js';

// ── 움직임 설정 ──
const SPAWN_DROP_HEIGHT = 8; // 나타날 때 몸 블록이 몇 칸 위에서 떨어져 모이는지

// 통통 (슬라임, 내 몬스터)
const HOP_SECONDS = 0.6; // 한 번 뛰는 데 걸리는 시간 (몸이 클수록 조금 느려짐)
const HOP_HEIGHT = 1.4; // 뛰는 높이
const HOP_AIR_SHARE = 0.7; // 한 번 뛰는 시간 중 공중에 떠 있는 비율
const HOP_GROUND_SPEED = 0.15; // 땅에 닿아 있는 동안 앞으로 가는 빠르기 (0 = 멈춤, 1 = 그대로)
const HOP_SQUASH = 0.3; // 착지할 때 납작해지는 정도
const HOP_STRETCH = 0.12; // 공중에서 길쭉해지는 정도

// 훨훨 (박쥐)
const FLY_HEIGHT = 3; // 나는 높이
const FLY_BOB = 0.45; // 위아래로 둥실거리는 폭
const FLY_BOB_SECONDS = 1.5; // 한 번 둥실거리는 시간
const FLAP_SPEED = 14; // 날갯짓 빠르기
const FLAP_AMOUNT = 0.2; // 날갯짓 폭 (몸이 가로로 늘었다 줄었다 하는 정도)
const FLY_WEAVE = 0.35; // 좌우로 갈지자로 나는 정도
const LUNGE_DIVE = 1.6; // 공격할 때 아래로 내리꽂는 깊이

// 쿵쿵 (골렘, 대장 골렘)
const STOMP_SECONDS = 1.1; // 왼발·오른발 한 번씩 걷는 시간 (몸이 클수록 조금 느려짐)
const STOMP_ROCK = 0.13; // 좌우로 기우뚱하는 정도 (라디안)
const STOMP_BOB = 0.28; // 걸을 때 몸이 들썩이는 높이
const STOMP_SQUASH = 0.07; // 발을 디딜 때 눌리는 정도

// 모두 함께
const LEAN = 0.16; // 가는 방향(화면 왼쪽·오른쪽)으로 몸이 기우는 정도
const HIT_PULSE_SECONDS = 0.18; // 맞았을 때 몸이 커졌다 돌아오는 시간
const HIT_PULSE_SCALE = 0.12; // 그때 커지는 정도 (0.12 = 12%)
const LUNGE_SECONDS = 0.38; // 공격할 때 성 쪽으로 달려들었다 돌아오는 시간
const LUNGE_HIT_SHARE = 0.4; // 달려드는 시간 중 이만큼 지났을 때 성에 피해를 줌
const LUNGE_DISTANCE = 1.2; // 달려드는 거리
const LUNGE_HOP = 0.5; // 달려들 때 살짝 뛰어오르는 높이 (땅 몬스터)
const FIRST_ATTACK_DELAY = 0.35; // 성에 닿은 뒤 첫 공격까지 기다리는 비율 (공격 간격 × 이 값)
const CHEER_SECONDS = 0.45; // 성이 무너진 뒤 신나서 한 번 뛰는 시간
const CHEER_HEIGHT = 0.9; // 그때 뛰는 높이
const SLOW_TINT = '#9FC3E9'; // 느려졌을 때 몸이 물드는 색 (연파랑)
const SLOW_TINT_AMOUNT = 0.45;

// ── 길 찾기 설정 ──
const SEPARATION = 0.9; // 몬스터끼리 떨어지는 거리 배율 (1 = 몸 가장자리가 딱 닿을 때까지)
const FLY_SEPARATION = 0.75; // 박쥐끼리 떨어지는 거리 배율
const SEPARATION_RATE = 7; // 겹친 몬스터를 떼어 놓는 빠르기
const SLIDE = 0.8; // 앞이 막혔을 때 옆으로 비켜 가는 정도
const ATTACKER_WEIGHT = 40; // 성을 공격 중인 몬스터는 이만큼 무거워서 잘 안 밀림
const PAD_LOOKAHEAD = 6; // 타워 자리를 몇 칸 앞에서부터 피하기 시작할지
const PAD_STEER = 2; // 타워 자리를 피해 옆으로 트는 세기
const PAD_AVOID_SHARE = 0.7; // 타워 자리 가운데에서 (자리 한 변 × 이 값 + 몸 반지름) 안으로는 들어가지 않음
const LANE_LOOKAHEAD = 5; // 타워 자리 고리에 이만큼(칸) 가까워지면 가장 가까운 길목(자리와 자리 사이) 쪽으로 틀기 시작
const LANE_GAIN = 1.4; // 길목 쪽으로 트는 세기
const LANE_MAX_STEER = 2.5; // 한 번에 옆으로 트는 최대 세기
const PAD_BODY_SHARE = 0.4; // 타워 자리 위로는 몸 반지름 × 이 값까지만 걸칠 수 있음 (가운데로는 못 들어감)
const PAD_GAP_MARGIN = 0.4; // 이웃한 두 타워 자리 사이 한가운데 길은 늘 이 폭의 2배만큼 비워 둠 (대장도 꼭 지나가게)
const SPAWN_SHIFT_STEP = 0.25; // 나타날 곳이 타워 자리에 걸리면 이 거리(칸)씩 옆으로 옮겨 봄
const SPAWN_SHIFT_MAX = 0.6; // 최대 이 각도(라디안)까지 옮겨 봄

const TAU = Math.PI * 2;

export function createEnemyManager({ scene, events, debris, castle, art, config, getSpawnRadius = null, getPads = null }) {
  const root = new THREE.Group();
  root.name = 'enemies';
  scene.add(root);

  const live = []; // 살아 있는 몬스터 (쓰러진 몬스터는 다음 정리 때 빠짐)
  let aliveTotal = 0;
  let needsCompact = false;
  let nextId = 1;
  let lastYaw = 0;

  // 몬스터가 나타나는 거리와 타워 자리 목록 (game.js 가 알려 주지 않으면 설정값으로)
  const spawnRadiusNow = getSpawnRadius ?? (() => defaultSpawnRadius(config));
  const padSource = getPads ?? createConfigPadSource(config);
  const maxEnemyRadius = Math.max(...Object.values(config.enemies).map((type) => type.columns / 2));
  let pads = []; // 피해 다닐 타워 자리 (padSource 목록이 바뀔 때만 다시 만듦)
  let padSourceList = null;
  const look = { y: 0, sx: 1, sy: 1, rz: 0, lean: 0 }; // 매 장면 재사용하는 자세 값
  const view = { cos: 1, sin: 0 }; // 카메라 방향 (화면 오른쪽 = (cos, 0, -sin))

  // 처음 나올 때 멈칫하지 않게 설계도를 미리 만들어 둠
  for (const typeId of Object.keys(config.enemies)) prepareBlueprint(typeId);

  function prepareBlueprint(typeId) {
    const type = config.enemies[typeId];
    const artId = `monster:${typeId}`;
    return getBlueprint(art.key(artId), art.get(artId), { columns: type.columns, depth: type.depth });
  }

  // ── 타워 자리 목록 맞추기 ──
  // 자리가 늘거나 줄었을 때만 피하기 정보를 다시 계산함 (매 장면 불러도 가벼움)
  function syncPads() {
    const list = padSource() ?? [];
    if (list === padSourceList) return;
    const same = padSourceList !== null && samePadList(list, padSourceList);
    padSourceList = list;
    if (!same) {
      pads = createPadObstacles(list, maxEnemyRadius);
      lanes = createLaneRings(list);
    }
  }

  // 타워 자리 고리마다 '길목'(이웃한 두 자리 사이 한가운데) 각도 목록을 만듦. 바깥 고리부터.
  let lanes = [];
  function createLaneRings(list) {
    const byRing = new Map();
    for (const pad of list) {
      const radius = Math.round(Math.hypot(pad.x, pad.z));
      if (!byRing.has(radius)) byRing.set(radius, { radius, half: (pad.size ?? 5) / 2, angles: [] });
      byRing.get(radius).angles.push(Math.atan2(pad.z, pad.x));
    }
    const rings = [];
    for (const ring of byRing.values()) {
      ring.angles.sort((a, b) => a - b);
      const count = ring.angles.length;
      ring.lanes = ring.angles.map((angle, i) => {
        const next = i + 1 < count ? ring.angles[i + 1] : ring.angles[0] + Math.PI * 2;
        return (angle + next) / 2;
      });
      rings.push(ring);
    }
    return rings.sort((a, b) => b.radius - a.radius);
  }

  // 다음에 지나갈 타워 자리 고리의 가장 가까운 길목 쪽으로 트는 양 (+ 는 왼쪽)
  function laneSteer(enemy) {
    const { position } = enemy;
    const r = Math.hypot(position.x, position.z);
    if (r < 1e-3) return 0;
    for (const ring of lanes) {
      const reach = ring.half + enemy.radius;
      if (r > ring.radius + reach + LANE_LOOKAHEAD) continue; // 아직 멀었음
      if (r < ring.radius - 0.5) continue; // 이미 이 고리 안쪽으로 들어옴 → 다음(안쪽) 고리를 봄
      const theta = Math.atan2(position.z, position.x);
      let diff = Infinity;
      for (const lane of ring.lanes) {
        const d = wrapAngle(lane - theta);
        if (Math.abs(d) < Math.abs(diff)) diff = d;
      }
      const arc = diff * r; // 길목까지 옆으로 남은 거리 (+: 각도가 커지는 쪽)
      const ahead = Math.max(1, r - ring.radius + 1);
      // 옆 방향(px, pz)은 각도가 작아지는 쪽이라서 부호를 뒤집음
      return Math.max(-LANE_MAX_STEER, Math.min(LANE_MAX_STEER, (-arc / ahead) * LANE_GAIN));
    }
    return 0;
  }

  // 자리 가운데에서 (ux, uz) 방향으로 이 거리 안에는 몸 가운데가 들어가지 않음 (몸 크기만큼 둥글게 피함).
  // 단, 가까운 이웃 자리 쪽으로는 두 자리 한가운데 선 앞에서 멈춤 → 이웃한 자리 사이에는 늘 곧은 길이 남아서
  // 대장처럼 큰 몬스터도 꼭 성까지 갈 수 있음 (그 길을 지날 때는 몸이 자리 가장자리에 조금 걸쳐 보일 수 있음)
  function hardRadius(pad, bodyRadius, ux, uz) {
    let limit = pad.avoid + bodyRadius;
    const neighbours = pad.neighbours;
    for (let i = 0; i < neighbours.length; i++) {
      const next = neighbours[i];
      const facing = ux * next.ux + uz * next.uz;
      if (facing <= 0 || next.cap >= limit * facing) continue;
      limit = next.cap / facing; // 이 방향으로 가다가 한가운데 선(에서 여유만큼 앞)에 닿는 거리
    }
    return limit;
  }

  // 나타날 곳이 타워 자리에 걸리면 옆으로 조금씩 옮겨서 비어 있는 곳을 찾음
  function clearSpawnAngle(angle, distance, bodyRadius) {
    if (pads.length === 0) return angle;
    let best = angle;
    let bestRoom = -Infinity;
    const angleStep = SPAWN_SHIFT_STEP / Math.max(1, distance);
    const steps = Math.ceil(SPAWN_SHIFT_MAX / angleStep);
    for (let step = 0; step <= steps; step++) {
      for (let sign = 1; sign >= -1; sign -= 2) {
        if (step === 0 && sign < 0) continue;
        const tryAngle = angle + sign * step * angleStep;
        const room = spawnRoom(Math.cos(tryAngle) * distance, Math.sin(tryAngle) * distance, bodyRadius);
        if (room >= 0) return tryAngle;
        if (room > bestRoom) {
          bestRoom = room;
          best = tryAngle;
        }
      }
    }
    return best;
  }

  // 그 자리에 섰을 때 가장 가까운 타워 자리 둘레까지 남는 거리 (음수면 걸림)
  function spawnRoom(x, z, bodyRadius) {
    let room = Infinity;
    for (const pad of pads) {
      const dx = x - pad.x;
      const dz = z - pad.z;
      const distance = Math.hypot(dx, dz);
      if (distance >= pad.avoid + bodyRadius) continue;
      const ux = distance < 1e-4 ? pad.outX : dx / distance;
      const uz = distance < 1e-4 ? pad.outZ : dz / distance;
      room = Math.min(room, distance - hardRadius(pad, bodyRadius, ux, uz));
    }
    return room;
  }

  // ── 등장 ──
  function spawn(typeId, { angle = Math.random() * TAU, hpScale = 1 } = {}) {
    const type = config.enemies[typeId];
    if (!type) {
      console.warn(`몬스터 종류를 찾을 수 없어요: ${typeId}`);
      return null;
    }
    const blueprint = prepareBlueprint(typeId);
    const figure = new BlockFigure(blueprint, root);
    const spawnRadius = spawnRadiusNow();
    const maxHp = type.hp * hpScale;
    const radius = type.columns / 2;
    if (type.motion !== 'fly') {
      syncPads();
      angle = clearSpawnAngle(angle, spawnRadius, radius);
    }
    const enemy = {
      id: nextId++,
      typeId,
      type,
      hp: maxHp,
      maxHp,
      position: new THREE.Vector3(Math.cos(angle) * spawnRadius, 0, Math.sin(angle) * spawnRadius),
      velocity: new THREE.Vector3(),
      center: new THREE.Vector3(),
      radius,
      state: 'arriving',
      alive: true,
      slowLeft: 0,
      slow: 0,
      figure,
      // ── 아래는 이 파일 안에서만 쓰는 값 ──
      initialCount: blueprint.count,
      motion: type.motion,
      flying: type.motion === 'fly',
      heading: new THREE.Vector3(-Math.cos(angle), 0, -Math.sin(angle)), // 가려는 방향
      cycleSeconds: cycleSecondsFor(type),
      gait: Math.random(), // 걸음 진행 (1 = 한 걸음)
      flap: Math.random() * TAU,
      side: Math.random() < 0.5 ? -1 : 1, // 길이 막혔을 때 비켜 갈 쪽
      attackTimer: 0,
      lungeTime: -1,
      hitTime: 0,
      tinted: false,
      cheering: false,
    };
    figure.build(config.enemyArriveSeconds, { dropHeight: SPAWN_DROP_HEIGHT });
    live.push(enemy);
    aliveTotal += 1;
    setView(lastYaw);
    pose(enemy, lastYaw);
    events.emit('enemySpawned', { enemy });
    return enemy;
  }

  // ── 매 장면마다 ──
  function update(dt, { cameraYaw = lastYaw } = {}) {
    lastYaw = cameraYaw;
    compact();
    syncPads();
    const cheering = Boolean(castle.isDestroyed);
    for (let i = 0; i < live.length; i++) think(live[i], dt, cheering);
    separate(dt);
    setView(cameraYaw);
    for (let i = 0; i < live.length; i++) pose(live[i], cameraYaw);
  }

  function think(enemy, dt, cheering) {
    if (!enemy.alive) return;
    enemy.figure.update(dt);
    if (enemy.hitTime > 0) enemy.hitTime = Math.max(0, enemy.hitTime - dt);
    updateSlow(enemy, dt);
    const pace = 1 - enemy.slow;
    enemy.flap += dt * pace * FLAP_SPEED;
    if (enemy.assembling) {
      // 대장이 잔해로 모이는 중: 제자리에서 기다림 (다 모이면 아래에서 'walking' 으로 바뀜)
      enemy.velocity.set(0, 0, 0);
      return;
    }

    if (enemy.state === 'arriving') {
      if (enemy.flying) enemy.gait += dt / enemy.cycleSeconds; // 몸이 모이는 동안에도 둥실둥실
      if (!enemy.figure.isBuilt) return;
      enemy.state = 'walking';
      enemy.hitTime = HIT_PULSE_SECONDS; // 몸이 다 모이면 톡 하고 커졌다 돌아옴
    }

    enemy.cheering = cheering;
    if (cheering) {
      enemy.velocity.set(0, 0, 0);
      enemy.gait += dt / CHEER_SECONDS;
      if (enemy.lungeTime >= 0) advanceLunge(enemy, dt, false);
      return;
    }
    if (enemy.state === 'walking') walk(enemy, dt, pace);
    else if (enemy.state === 'attacking') attack(enemy, dt, pace);
  }

  function walk(enemy, dt, pace) {
    const position = enemy.position;
    const heading = enemy.heading;
    aimAtCastle(enemy);

    // 성 쪽 방향에 옆으로 트는 양(steer)을 더함
    const px = -heading.z;
    const pz = heading.x;
    const steer = enemy.flying ? FLY_WEAVE * Math.sin(Math.PI * enemy.gait + enemy.side) : laneSteer(enemy);
    const vx = heading.x + px * steer;
    const vz = heading.z + pz * steer;
    const length = Math.hypot(vx, vz) || 1;
    const speed = enemy.type.speed * pace;
    enemy.velocity.set((vx / length) * speed, 0, (vz / length) * speed);

    enemy.gait += (dt * pace) / enemy.cycleSeconds;
    const stride = strideFactor(enemy);
    position.x += enemy.velocity.x * dt * stride;
    position.z += enemy.velocity.z * dt * stride;

    if (castle.isInReach(position)) {
      enemy.state = 'attacking';
      enemy.velocity.set(0, 0, 0);
      enemy.attackTimer = enemy.type.attackInterval * FIRST_ATTACK_DELAY;
      aimAtCastle(enemy);
    }
  }

  // 앞에 타워 자리가 있으면 옆으로 비켜 가는 양 (+ 는 왼쪽)
  function padSteer(enemy, px, pz) {
    const { position, heading } = enemy;
    let steer = 0;
    for (let i = 0; i < pads.length; i++) {
      const pad = pads[i];
      const padAvoid = pad.avoid + enemy.radius;
      const rx = pad.x - position.x;
      const rz = pad.z - position.z;
      const along = rx * heading.x + rz * heading.z;
      if (along < 0 || along > padAvoid + PAD_LOOKAHEAD) continue;
      const lateral = rx * px + rz * pz;
      const offset = Math.abs(lateral);
      if (offset >= padAvoid) continue;
      const side = offset < 0.05 ? enemy.side : -Math.sign(lateral);
      const near = Math.min(1, (padAvoid + PAD_LOOKAHEAD - along) / PAD_LOOKAHEAD);
      steer += side * (1 - offset / padAvoid) * near * PAD_STEER;
    }
    return steer;
  }

  function attack(enemy, dt, pace) {
    enemy.velocity.set(0, 0, 0);
    enemy.gait += (dt * pace) / enemy.cycleSeconds;
    if (enemy.lungeTime >= 0) advanceLunge(enemy, dt, true);
    enemy.attackTimer -= dt;
    if (enemy.attackTimer <= 0 && enemy.lungeTime < 0) {
      enemy.attackTimer += enemy.type.attackInterval;
      enemy.lungeTime = 0;
    }
  }

  // 성 쪽으로 달려들기: 가장 멀리 나갔을 때 성에 피해
  function advanceLunge(enemy, dt, canHit) {
    const hitAt = LUNGE_SECONDS * LUNGE_HIT_SHARE;
    const before = enemy.lungeTime;
    enemy.lungeTime += dt;
    if (canHit && before < hitAt && enemy.lungeTime >= hitAt && !castle.isDestroyed) {
      const { position, heading } = enemy;
      const hitPoint = new THREE.Vector3(
        position.x + heading.x * LUNGE_DISTANCE,
        0,
        position.z + heading.z * LUNGE_DISTANCE,
      );
      castle.damage(enemy.type.damage, hitPoint);
    }
    if (enemy.lungeTime >= LUNGE_SECONDS) enemy.lungeTime = -1;
  }

  function aimAtCastle(enemy) {
    const { position, heading } = enemy;
    const distance = Math.hypot(position.x, position.z);
    if (distance > 1e-4) heading.set(-position.x / distance, 0, -position.z / distance);
  }

  // ── 몬스터끼리 겹치지 않게, 타워 자리 위로 걷지 않게 ──
  function separate(dt) {
    const rate = Math.min(1, dt * SEPARATION_RATE);
    if (rate <= 0) return;
    const count = live.length;
    for (let i = 0; i < count; i++) {
      const a = live[i];
      if (!a.alive) continue;
      for (let j = i + 1; j < count; j++) {
        const b = live[j];
        if (!b.alive || a.flying !== b.flying) continue; // 박쥐는 박쥐끼리만 비킴
        let nx = a.position.x - b.position.x;
        let nz = a.position.z - b.position.z;
        const minDistance = (a.radius + b.radius) * (a.flying ? FLY_SEPARATION : SEPARATION);
        const distanceSq = nx * nx + nz * nz;
        if (distanceSq >= minDistance * minDistance) continue;
        const distance = Math.sqrt(distanceSq);
        if (distance < 1e-4) {
          const angle = a.id * 2.399 + b.id;
          nx = Math.cos(angle);
          nz = Math.sin(angle);
        } else {
          nx /= distance;
          nz /= distance;
        }
        const push = (minDistance - distance) * rate;
        const weightA = weightOf(a);
        const weightB = weightOf(b);
        const shareA = weightB / (weightA + weightB);
        shove(a, nx, nz, push * shareA);
        shove(b, -nx, -nz, push * (1 - shareA));
      }
    }
    for (let i = 0; i < count; i++) {
      const enemy = live[i];
      if (enemy.alive && !enemy.flying && !enemy.assembling) keepOffPads(enemy);
    }
  }

  function weightOf(enemy) {
    const weight = enemy.radius * enemy.radius;
    return enemy.state === 'attacking' || enemy.assembling ? weight * ATTACKER_WEIGHT : weight;
  }

  function shove(enemy, nx, nz, amount) {
    if (amount <= 0) return;
    const position = enemy.position;
    position.x += nx * amount;
    position.z += nz * amount;
    if (enemy.state !== 'walking' || enemy.cheering) return;
    // 앞을 가로막혔으면 옆으로 비켜 감 (성 둘레로 퍼지게)
    const heading = enemy.heading;
    if (heading.x * nx + heading.z * nz > -0.2) return;
    const px = -heading.z;
    const pz = heading.x;
    const sideness = px * nx + pz * nz;
    const side = Math.abs(sideness) < 0.05 ? enemy.side : Math.sign(sideness);
    position.x += px * side * amount * SLIDE;
    position.z += pz * side * amount * SLIDE;
  }

  // 타워 자리 위로 올라서지 않게 밀어냄 (이웃 자리 사이에는 늘 길이 남음: hardRadius)
  function keepOffPads(enemy) {
    const position = enemy.position;
    for (let i = 0; i < pads.length; i++) {
      const pad = pads[i];
      const dx = position.x - pad.x;
      const dz = position.z - pad.z;
      const full = pad.avoid + enemy.radius;
      const distanceSq = dx * dx + dz * dz;
      if (distanceSq >= full * full) continue;
      const distance = Math.sqrt(distanceSq);
      const ux = distance < 1e-4 ? pad.outX : dx / distance;
      const uz = distance < 1e-4 ? pad.outZ : dz / distance;
      // 몸 가운데가 자리 위로 올라서지만 않게 (몸 가장자리는 조금 걸칠 수 있음 → 좁은 길목에서 갇히지 않음)
      const hard = Math.min(hardRadius(pad, enemy.radius, ux, uz), pad.size * 0.5 + enemy.radius * PAD_BODY_SHARE);
      if (distance >= hard) continue;
      position.x = pad.x + ux * hard;
      position.z = pad.z + uz * hard;
    }
  }

  // ── 몸 움직임 (통통 / 훨훨 / 쿵쿵) ──
  function setView(yaw) {
    view.cos = Math.cos(yaw);
    view.sin = Math.sin(yaw);
  }

  function pose(enemy, yaw) {
    if (!enemy.alive) return;
    look.y = enemy.flying ? FLY_HEIGHT : 0;
    look.sx = 1;
    look.sy = 1;
    look.rz = 0;
    // 화면에서 오른쪽(+)·왼쪽(-)으로 가는 정도 (-1 ~ 1)
    const v = enemy.velocity;
    look.lean = (v.x * view.cos - v.z * view.sin) / Math.max(0.01, enemy.type.speed);

    if (enemy.cheering && enemy.state !== 'arriving') poseCheer(enemy);
    else if (enemy.motion === 'fly') poseFly(enemy);
    else if (enemy.state === 'arriving') look.y = 0;
    else if (enemy.motion === 'stomp') poseStomp(enemy, enemy.state === 'attacking' ? 0.5 : 1);
    else poseHop(enemy, enemy.state === 'attacking' ? 0.3 : 1);

    let offsetX = 0;
    let offsetZ = 0;
    if (enemy.lungeTime >= 0) {
      const u = enemy.lungeTime / LUNGE_SECONDS;
      const reach = lungeCurve(u);
      offsetX = enemy.heading.x * LUNGE_DISTANCE * reach;
      offsetZ = enemy.heading.z * LUNGE_DISTANCE * reach;
      look.y += enemy.flying ? -LUNGE_DIVE * reach : LUNGE_HOP * reach;
      const towardScreen = enemy.heading.x * view.cos - enemy.heading.z * view.sin;
      look.rz -= LEAN * 1.6 * towardScreen * reach;
      const impact = Math.max(0, 1 - Math.abs(u - LUNGE_HIT_SHARE) / 0.15);
      look.sx *= 1 + 0.14 * impact;
      look.sy *= 1 - 0.12 * impact;
    }

    const pulse = enemy.hitTime / HIT_PULSE_SECONDS;
    const grow = 1 + HIT_PULSE_SCALE * pulse * pulse;
    const group = enemy.figure.group;
    // 옆으로 기울면 넓은 몸의 아래 모서리가 땅에 파묻히므로 그만큼 들어 올림 (땅 위 몬스터만)
    if (!enemy.flying) look.y += Math.abs(Math.sin(look.rz)) * enemy.figure.width * 0.5 * look.sx;
    group.position.set(enemy.position.x + offsetX, look.y, enemy.position.z + offsetZ);
    group.rotation.set(0, yaw, look.rz);
    group.scale.set(look.sx * grow, look.sy * grow, look.sx * grow);
    enemy.center.set(group.position.x, look.y + enemy.figure.height * 0.5 * look.sy * grow, group.position.z);
  }

  // 통통: 포물선으로 뛰고, 공중에선 길쭉, 착지하면 납작
  function poseHop(enemy, amount) {
    const u = enemy.gait % 1;
    if (u < HOP_AIR_SHARE) {
      const a = u / HOP_AIR_SHARE;
      look.y += HOP_HEIGHT * amount * 4 * a * (1 - a);
      const stretch = HOP_STRETCH * amount * Math.abs(Math.sin(TAU * a));
      look.sy = 1 + stretch;
      look.sx = 1 - stretch * 0.5;
      look.rz = -LEAN * look.lean * Math.sin(Math.PI * a);
    } else {
      const q = (u - HOP_AIR_SHARE) / (1 - HOP_AIR_SHARE);
      const squash = HOP_SQUASH * Math.max(0.4, amount) * Math.sin(Math.PI * q);
      look.sy = 1 - squash;
      look.sx = 1 + squash * 0.6;
    }
  }

  // 훨훨: 둥실 떠서 날갯짓 (몸이 가로로 늘었다 줄었다), 가는 쪽으로 몸을 기울임
  function poseFly(enemy) {
    const flap = Math.sin(enemy.flap);
    look.y += FLY_BOB * Math.sin(TAU * enemy.gait + enemy.side);
    look.y += 0.12 * flap;
    look.sx = 1 + FLAP_AMOUNT * flap;
    look.sy = 1 - FLAP_AMOUNT * 0.3 * flap;
    look.rz = -LEAN * 1.4 * look.lean;
  }

  // 쿵쿵: 좌우로 기우뚱, 한쪽 발로 설 때 들썩, 발을 디딜 때 살짝 눌림
  function poseStomp(enemy, amount) {
    const swing = Math.sin(TAU * enemy.gait);
    const plant = Math.max(0, 1 - Math.abs(swing) * 5);
    look.rz = STOMP_ROCK * amount * swing - LEAN * 0.4 * look.lean;
    look.y += STOMP_BOB * amount * Math.abs(swing);
    look.sy = 1 - STOMP_SQUASH * amount * plant;
    look.sx = 1 + STOMP_SQUASH * 0.5 * amount * plant;
  }

  // 성이 무너지면 그 자리에서 신나게 뛰기
  function poseCheer(enemy) {
    if (enemy.flying) {
      poseFly(enemy);
      return;
    }
    const u = enemy.gait % 1;
    if (u < 0.75) {
      const a = u / 0.75;
      look.y += CHEER_HEIGHT * 4 * a * (1 - a);
      look.rz = 0.12 * Math.sin(TAU * a) * enemy.side;
    } else {
      const squash = HOP_SQUASH * 0.8 * Math.sin((Math.PI * (u - 0.75)) / 0.25);
      look.sy = 1 - squash;
      look.sx = 1 + squash * 0.6;
    }
  }

  // ── 피해 ──
  function damage(enemy, amount, { slow = 0, slowSeconds = 0, from = null } = {}) {
    if (!enemy || !enemy.alive || enemy.assembling || !(amount > 0)) return;
    enemy.hp = Math.max(0, enemy.hp - amount);
    if (enemy.hp <= 0) {
      kill(enemy, amount);
      return;
    }
    // 남은 체력만큼만 블록이 남도록 떼어 냄
    const keep = Math.ceil((enemy.initialCount * enemy.hp) / enemy.maxHp);
    const removed = enemy.figure.removeBlocks(enemy.figure.aliveCount - keep, 'random');
    if (removed.length > 0) debris.burst(removed, { from: from ?? enemy.center, power: 4, upward: 5 });
    enemy.hitTime = HIT_PULSE_SECONDS;
    if (slow > 0 && slowSeconds > 0) applySlow(enemy, slow, slowSeconds);
    events.emit('enemyHit', { enemy, damage: amount, position: enemy.center.clone() });
  }

  function damageArea(point, radius, amount, { from = null } = {}) {
    let hits = 0;
    for (let i = 0; i < live.length; i++) {
      const enemy = live[i];
      if (!enemy.alive || enemy.assembling) continue;
      const dx = enemy.position.x - point.x;
      const dz = enemy.position.z - point.z;
      const reach = radius + enemy.radius * 0.5;
      if (dx * dx + dz * dz > reach * reach) continue;
      damage(enemy, amount, { from });
      hits += 1;
    }
    return hits;
  }

  function kill(enemy, amount) {
    enemy.state = 'dead';
    enemy.alive = false;
    enemy.slowLeft = 0;
    enemy.slow = 0;
    enemy.velocity.set(0, 0, 0);
    const position = enemy.center.clone();
    const removed = enemy.figure.removeAll();
    debris.burst(removed, { from: enemy.center, power: 7, upward: 8 });
    enemy.figure.dispose();
    aliveTotal -= 1;
    needsCompact = true;
    events.emit('enemyHit', { enemy, damage: amount, position });
    events.emit('enemyKilled', { enemy, gold: enemy.type.gold, position: position.clone() });
  }

  // 살아 있는 몬스터 모두 느리게 (얼려라 스킬) → 느려진 몬스터 수
  function slowAll(slow, seconds) {
    if (!(slow > 0) || !(seconds > 0)) return 0;
    let count = 0;
    for (let i = 0; i < live.length; i++) {
      const enemy = live[i];
      if (!enemy.alive) continue;
      applySlow(enemy, slow, seconds);
      count += 1;
    }
    return count;
  }

  // 느려짐: 시간은 새로 채우고, 더 센 느려짐을 유지
  function applySlow(enemy, slow, seconds) {
    enemy.slow = enemy.slowLeft > 0 ? Math.max(enemy.slow, slow) : slow;
    enemy.slow = Math.min(0.95, enemy.slow);
    enemy.slowLeft = Math.max(enemy.slowLeft, seconds);
    updateSlow(enemy, 0);
  }

  function updateSlow(enemy, dt) {
    if (enemy.slowLeft > 0) {
      enemy.slowLeft = Math.max(0, enemy.slowLeft - dt);
      if (enemy.slowLeft === 0) enemy.slow = 0;
    }
    const slowed = enemy.slowLeft > 0;
    if (slowed === enemy.tinted) return;
    enemy.tinted = slowed;
    enemy.figure.setTint(slowed ? SLOW_TINT : null, SLOW_TINT_AMOUNT);
  }

  // ── 목록 ──
  // 쓰러진 몬스터를 목록에서 뺌 (목록을 도는 중에 빠지지 않도록 여기서 한꺼번에)
  function compact() {
    if (!needsCompact) return;
    let write = 0;
    for (let read = 0; read < live.length; read++) {
      if (live[read].alive) live[write++] = live[read];
    }
    live.length = write;
    needsCompact = false;
  }

  function list() {
    compact();
    return live;
  }

  function clear() {
    for (const enemy of live) {
      if (!enemy.alive) continue;
      enemy.alive = false;
      enemy.state = 'dead';
      enemy.figure.dispose();
    }
    live.length = 0;
    aliveTotal = 0;
    needsCompact = false;
  }

  // 그림이 바뀌면 예전 설계도를 버리고 새 설계도를 미리 만들어 둠 (이미 나와 있는 몬스터는 그대로)
  function refreshArt(typeId) {
    if (!config.enemies[typeId]) return;
    forgetBlueprints(`monster:${typeId}@`);
    prepareBlueprint(typeId);
  }

  return {
    spawn,
    update,
    damage,
    damageArea,
    slowAll,
    list,
    aliveCount: () => aliveTotal,
    clear,
    refreshArt,
  };
}

// 피해 다닐 타워 자리 정보: 위치, 피하는 거리, 가까운 이웃 자리 쪽 길 폭
// list: [{ x, z, size }] (towers.padPositions())
function createPadObstacles(list, maxEnemyRadius) {
  const obstacles = list.map((pad) => {
    const out = Math.hypot(pad.x, pad.z);
    return {
      x: pad.x,
      z: pad.z,
      outX: out > 1e-4 ? pad.x / out : 1, // 성 반대쪽 방향 (자리 한가운데에 몬스터가 있을 때 밀어낼 쪽)
      outZ: out > 1e-4 ? pad.z / out : 0,
      size: pad.size ?? 5,
      avoid: (pad.size ?? 5) * PAD_AVOID_SHARE,
      neighbours: [],
    };
  });
  // 두 자리 사이 길: 두 자리 가운데 사이 거리의 절반 - 여유. 몸을 이보다 크게 피하면 길이 막히는 이웃만 기억함
  for (let i = 0; i < obstacles.length; i++) {
    const a = obstacles[i];
    for (let j = i + 1; j < obstacles.length; j++) {
      const b = obstacles[j];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const distance = Math.hypot(dx, dz);
      if (distance < 1e-4) continue;
      const cap = Math.max(0, distance / 2 - PAD_GAP_MARGIN);
      const ux = dx / distance;
      const uz = dz / distance;
      if (cap < a.avoid + maxEnemyRadius) a.neighbours.push({ ux, uz, cap });
      if (cap < b.avoid + maxEnemyRadius) b.neighbours.push({ ux: -ux, uz: -uz, cap });
    }
  }
  return obstacles;
}

function samePadList(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].x !== b[i].x || a[i].z !== b[i].z || a[i].size !== b[i].size) return false;
  }
  return true;
}

// game.js 가 타워 자리 목록을 알려 주지 않을 때: 처음 땅 크기에서 열리는 고리의 자리 (towers.js 와 같은 규칙)
function createConfigPadSource(config) {
  const padConfig = config.towerPads;
  const startSize = config.arena.startSize ?? config.arena.size ?? 0;
  const rings = padConfig.rings ?? [{ radius: padConfig.radius, count: padConfig.count, landSize: 0 }];
  const list = [];
  for (const ring of rings) {
    if ((ring.landSize ?? 0) > startSize) continue;
    for (let k = 0; k < ring.count; k++) {
      const angle = ((k + 0.5) * TAU) / ring.count;
      list.push({ x: Math.cos(angle) * ring.radius, z: Math.sin(angle) * ring.radius, size: padConfig.size });
    }
  }
  return () => list;
}

// game.js 가 나타나는 거리를 알려 주지 않을 때: 처음 땅 절반 - 여유
function defaultSpawnRadius(config) {
  const arena = config.arena;
  if (arena.spawnRadius) return arena.spawnRadius;
  return (arena.startSize ?? arena.size ?? 64) / 2 - (arena.spawnMargin ?? 3);
}

// 한 걸음(한 번 뛰기)에 걸리는 시간: 몸이 클수록 조금 느림
function cycleSecondsFor(type) {
  if (type.motion === 'stomp') return STOMP_SECONDS * Math.sqrt(type.columns / 10);
  if (type.motion === 'fly') return FLY_BOB_SECONDS;
  return HOP_SECONDS * Math.sqrt(type.columns / 8);
}

// 걸음 중 앞으로 나가는 빠르기 배율 (한 걸음 평균은 1)
function strideFactor(enemy) {
  const u = enemy.gait % 1;
  if (enemy.motion === 'hop') {
    if (u >= HOP_AIR_SHARE) return HOP_GROUND_SPEED;
    return (1 - HOP_GROUND_SPEED * (1 - HOP_AIR_SHARE)) / HOP_AIR_SHARE;
  }
  if (enemy.motion === 'stomp') return 0.5 + (Math.PI / 4) * Math.abs(Math.sin(TAU * u));
  return 1;
}

// 달려들기 모양: 빠르게 나갔다가 천천히 돌아옴 (0 → 1 → 0)
function lungeCurve(u) {
  if (u <= 0 || u >= 1) return 0;
  if (u < LUNGE_HIT_SHARE) {
    const a = 1 - u / LUNGE_HIT_SHARE;
    return 1 - a * a;
  }
  const b = (u - LUNGE_HIT_SHARE) / (1 - LUNGE_HIT_SHARE);
  return 1 - b * b * (3 - 2 * b);
}

function wrapAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}
