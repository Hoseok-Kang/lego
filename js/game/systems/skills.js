// 스킬
// 화면 아래 스킬 단추로 쓰는 특별한 힘입니다. 쓰고 나면 대기시간(게임 시간)이 지나야 다시 쓸 수 있습니다.
//   블록 떨어뜨리기  단추를 누르고 땅을 누르면, 하늘에서 알록달록한 큰 블록 덩어리가 떨어져
//                   둘레의 몬스터를 때리고 와르르 부서집니다 (떨어질 곳에 동그라미가 미리 보임)
//   얼려라          모든 몬스터가 잠깐 거의 멈춤 (눈·얼음 조각이 튐)
//   긴급 수리       성 체력을 바로 채움 (떨어져 나간 블록이 다시 쌓임)
// 스킬 이름·대기시간·위력은 gameConfig.js 의 skills 에서, 덩어리·효과 모양은 아래 '바꿔도 되는 숫자'에서 바꿉니다.
// 보상 카드가 바꾸는 값(modifiers.js): skillCooldown(대기시간 배율), skillPower(위력 배율), skillRadius(범위 더하기)
//
// 할 수 있는 일
//   skills.list()            스킬 목록 → [{ id, name, description, unlocked, ready, cooldownLeft, cooldownTotal,
//                                         needsTarget, targeting, usable }]
//                            ready: 열려 있고 대기시간이 끝남 / usable: 지금 쓰면 효과가 있음
//                            (몬스터가 없으면 얼려라, 성이 멀쩡하면 긴급 수리는 false)
//   skills.unlock(id)        스킬 열기 → 'skillUnlocked' { id } 소식
//   skills.beginTarget(id)   땅을 눌러야 하는 스킬(블록 떨어뜨리기) 겨누기 시작 → 시작했으면 true
//   skills.cancelTarget()    겨누기 그만
//   skills.targeting         겨누는 중인 스킬 id (없으면 null)
//   skills.cast(id, 땅 위치)  스킬 쓰기 → 썼으면 true (잠겨 있거나, 대기 중이거나, 쓸 필요가 없으면 false)
//   skills.update(dt)        매 장면마다 (대기시간이 끝나면 'skillReady' { id } 소식)
//   skills.reset()           다시 하기: 처음 열린 스킬만 남기고 대기시간·떨어지는 덩어리 모두 지움
//
// 소식: 'skillCast' { id, point } 스킬을 씀 / 'skillImpact' { id, point } 덩어리가 땅에 닿음 (화면 흔들림)

import * as THREE from '../../lib/three.js';
import { BlockFigure } from '../core/blockFigure.js';
import { getVoxelBlueprint } from '../core/blueprints.js';

// ── 바꿔도 되는 숫자 ──
// 블록 떨어뜨리기
const DROP_HEIGHT = 22; // 덩어리가 나타나는 높이 (땅에서 칸 수)
const CHUNK_LAYERS = 3; // 덩어리 두께 (층 수). 가로·세로는 gameConfig 의 skills.blockDrop.size
const CHUNK_COLORS = ['#C91A09', '#0055BF', '#F2CD37', '#4B9F4A', '#FE8A18', '#36AEBF', '#FF698F', '#BBE90B', '#AC78BA', '#F4F4F4'];
const CHUNK_VARIANTS = 6; // 색 섞임 종류 수 (떨어뜨릴 때마다 이 중 하나)
const APPEAR_SECONDS = 0.18; // 하늘에 덩어리가 '뿅' 나타나는 시간 (이 뒤에 떨어지기 시작)
const FALL_SPIN = 1.2; // 떨어지면서 도는 각도 (라디안, 땅에 닿을 때는 똑바로)
const FALL_TILT = 0.25; // 떨어지면서 기우뚱하는 각도
const IMPACT_HOLD_SECONDS = 0.22; // 땅에 닿은 뒤 부서지기 전까지 납작하게 눌려 있는 시간
const IMPACT_SQUASH = 0.28; // 땅에 닿을 때 납작해지는 정도 (0~1)
const SHATTER_POWER = 10; // 부서질 때 옆으로 튀는 세기
const SHATTER_UPWARD = 15; // 부서질 때 위로 튀는 세기
const TELEGRAPH_COLOR = '#FE8A18'; // 떨어질 곳 동그라미 색 (주황)
const TELEGRAPH_WIDTH = 0.4; // 동그라미 테두리 두께
const SHADOW_COLOR = '#1B2A34'; // 떨어질 곳 가운데 그림자 색
const SHADOW_OPACITY = 0.4; // 덩어리가 땅에 가까워졌을 때 그림자 진하기
const IMPACT_WAVE_COLOR = '#F4F4F4'; // 땅에 닿을 때 퍼지는 동그라미 색
const IMPACT_WAVE_SECONDS = 0.45;
// 얼려라
const FREEZE_COLORS = ['#F4F4F4', '#9FC3E9', '#5A93DB']; // 눈·얼음 조각 색 (흰색, 연하늘색, 하늘색)
const FREEZE_SHARDS_PER_ENEMY = 6; // 몬스터 한 마리에서 튀는 얼음 조각 수
const FREEZE_SNOW = 50; // 전장 곳곳에 흩날리는 눈 조각 수
const FREEZE_WAVE_COLOR = '#9FC3E9'; // 성에서 퍼져 나가는 서리 동그라미 색
const FREEZE_WAVE_SECONDS = 0.8;
// 긴급 수리
const REPAIR_COLORS = ['#F2CD37', '#FFF03A', '#F4F4F4']; // 반짝이 조각 색 (노랑, 연노랑, 흰색)
const REPAIR_SPARKLES = 28; // 성 둘레에서 솟는 반짝이 조각 수
const REPAIR_WAVE_COLOR = '#F2CD37';
const REPAIR_WAVE_SECONDS = 0.7;
// 공통
const EFFECT_LIFETIME = 0.55; // 눈·반짝이 조각이 사라지기까지 시간 (짧아야 바닥에 잔해로 남지 않음)
const PLATFORM_TOP = 1; // 성 돌바닥 높이 (돌바닥 위에 떨어지면 이 높이에서 멈춤)
const WAVE_POOL = 6; // 동시에 퍼질 수 있는 동그라미 수

export function createSkills({ scene, events, enemies, castle, debris, modifiers, config }) {
  const skillConfig = config.skills;
  const ids = Object.keys(skillConfig);
  const states = new Map(ids.map((id) => [id, freshState(id)]));
  const root = new THREE.Group();
  root.name = 'skills';
  scene.add(root);

  const drops = [];
  const waves = createWaves(root);
  const telegraphGeometry = { bands: new Map(), disc: new THREE.CircleGeometry(1, 48).rotateX(-Math.PI / 2) };
  const colors = {
    freeze: FREEZE_COLORS.map((hex) => new THREE.Color(hex)),
    repair: REPAIR_COLORS.map((hex) => new THREE.Color(hex)),
  };
  const velocity = new THREE.Vector3();
  const spot = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  let targeting = null;

  function freshState(id) {
    return { id, unlocked: Boolean(skillConfig[id].unlocked), cooldownLeft: 0, cooldownTotal: 0, factor: 1 };
  }

  // ── 대기시간 ──
  function cooldownFactor() {
    const factor = modifiers.values.skillCooldown;
    return factor > 0 ? factor : 1;
  }

  function startCooldown(state) {
    const factor = cooldownFactor();
    state.factor = factor;
    state.cooldownTotal = skillConfig[state.id].cooldown * factor;
    state.cooldownLeft = state.cooldownTotal;
  }

  function tickCooldown(state, dt) {
    if (state.cooldownLeft <= 0) return;
    // 대기 중에 '빠른 재충전' 카드를 고르면 남은 시간도 같은 비율로 줄어듦
    const factor = cooldownFactor();
    if (factor !== state.factor) {
      const ratio = factor / state.factor;
      state.cooldownLeft *= ratio;
      state.cooldownTotal *= ratio;
      state.factor = factor;
    }
    state.cooldownLeft = Math.max(0, state.cooldownLeft - dt);
    if (state.cooldownLeft === 0) events.emit('skillReady', { id: state.id });
  }

  function isReady(state) {
    return Boolean(state?.unlocked) && state.cooldownLeft <= 0;
  }

  // 지금 쓰면 효과가 있는지 (헛되이 대기시간만 쓰지 않게)
  function isUsable(id) {
    if (id === 'freeze') return enemies.aliveCount() > 0;
    if (id === 'repair') return !castle.isDestroyed && castle.hp < castle.maxHp;
    return true;
  }

  // ── 목록 / 열기 / 겨누기 ──
  function list() {
    return ids.map((id) => {
      const skill = skillConfig[id];
      const state = states.get(id);
      const ready = isReady(state);
      return {
        id,
        name: skill.name,
        description: skill.description,
        unlocked: state.unlocked,
        ready,
        cooldownLeft: state.cooldownLeft,
        cooldownTotal: state.cooldownLeft > 0 ? state.cooldownTotal : skill.cooldown * cooldownFactor(),
        needsTarget: Boolean(skill.needsTarget),
        targeting: targeting === id,
        usable: ready && isUsable(id),
      };
    });
  }

  function unlock(id) {
    const state = states.get(id);
    if (!state || state.unlocked) return false;
    state.unlocked = true;
    state.cooldownLeft = 0;
    events.emit('skillUnlocked', { id });
    return true;
  }

  function beginTarget(id) {
    const state = states.get(id);
    if (!skillConfig[id]?.needsTarget || !isReady(state)) return false;
    targeting = id;
    return true;
  }

  function cancelTarget() {
    targeting = null;
  }

  // ── 쓰기 ──
  function cast(id, point = null) {
    const state = states.get(id);
    const skill = skillConfig[id];
    if (skill?.needsTarget && targeting === id) targeting = null; // 겨누기는 한 번 누르면 끝
    if (!isReady(state) || !isUsable(id)) return false;
    let done = false;
    if (id === 'blockDrop') done = castBlockDrop(skill, point);
    else if (id === 'freeze') done = castFreeze(skill);
    else if (id === 'repair') done = castRepair(skill);
    if (!done) return false;
    startCooldown(state);
    return true;
  }

  // 블록 떨어뜨리기: 덩어리가 블록 칸에 딱 맞게 떨어지도록 위치를 돌기 칸에 맞춤
  function castBlockDrop(skill, point) {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.z)) return false;
    const size = Math.max(1, Math.round(skill.size));
    const x = snapToStuds(point.x, size);
    const z = snapToStuds(point.z, size);
    const groundY = groundHeight(x, z);
    const target = new THREE.Vector3(x, groundY, z);
    const radius = skill.radius + (modifiers.values.skillRadius?.blockDrop ?? 0);
    const damage = skill.damage * (modifiers.values.skillPower?.blockDrop ?? 1);

    const variant = Math.floor(Math.random() * CHUNK_VARIANTS);
    const figure = new BlockFigure(chunkBlueprint(size, variant), root);
    figure.group.position.set(x, groundY + DROP_HEIGHT, z);
    figure.group.scale.setScalar(0.001);
    drops.push({
      figure,
      telegraph: createTelegraph(target, radius),
      point: target,
      size,
      radius,
      damage,
      fallSeconds: Math.max(0.1, skill.fallSeconds),
      time: 0,
      impactTime: -1,
      spin: (Math.random() < 0.5 ? -1 : 1) * FALL_SPIN,
      tiltPhase: Math.random() * Math.PI * 2,
    });
    events.emit('skillCast', { id: 'blockDrop', point: target.clone() });
    return true;
  }

  function castFreeze(skill) {
    const seconds = skill.seconds * (modifiers.values.skillPower?.freeze ?? 1);
    let farthest = 0;
    for (const enemy of enemies.list()) {
      if (!enemy.alive) continue;
      farthest = Math.max(farthest, Math.hypot(enemy.position.x, enemy.position.z));
      burstAround(enemy.center, FREEZE_SHARDS_PER_ENEMY, colors.freeze, { spread: 0.8, side: 4, upward: 7 });
    }
    slowEveryone(skill.slow, seconds);
    const reach = Math.max(14, farthest + 3);
    for (let i = 0; i < FREEZE_SNOW; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.sqrt(Math.random()) * reach;
      spot.set(Math.cos(angle) * distance, 4 + Math.random() * 6, Math.sin(angle) * distance);
      velocity.set((Math.random() - 0.5) * 3, 2 + Math.random() * 3, (Math.random() - 0.5) * 3);
      debris.spawn(spot, pick(colors.freeze), velocity, { lifetime: EFFECT_LIFETIME });
    }
    const point = new THREE.Vector3(0, 0, 0);
    waves.start(point, { fromRadius: 2, toRadius: reach, hex: FREEZE_WAVE_COLOR, seconds: FREEZE_WAVE_SECONDS, thin: true });
    events.emit('skillCast', { id: 'freeze', point });
    return true;
  }

  // 모든 몬스터 느리게. enemies.slowAll 이 없는 예전 enemies.js 에서도 동작하게 한 마리씩 넣음
  function slowEveryone(slow, seconds) {
    if (typeof enemies.slowAll === 'function') {
      enemies.slowAll(slow, seconds);
      return;
    }
    for (const enemy of enemies.list()) {
      if (!enemy.alive) continue;
      enemies.damage(enemy, 0, { slow, slowSeconds: seconds });
      // 피해 0 을 무시하는 enemies.js 라면 느려짐 값을 직접 넣음 (다음 장면에 파랗게 물듦)
      if (!(enemy.slowLeft >= seconds)) {
        enemy.slow = Math.min(0.95, enemy.slowLeft > 0 ? Math.max(enemy.slow ?? 0, slow) : slow);
        enemy.slowLeft = seconds;
      }
    }
  }

  function castRepair(skill) {
    const amount = skill.amount * (modifiers.values.skillPower?.repair ?? 1);
    const before = castle.hp;
    castle.repair(amount);
    if (!(castle.hp > before)) return false;
    const reach = config.castle.platformSize / 2;
    for (let i = 0; i < REPAIR_SPARKLES; i++) {
      const angle = (i / REPAIR_SPARKLES) * Math.PI * 2 + Math.random() * 0.2;
      const distance = reach * (0.55 + Math.random() * 0.4);
      spot.set(Math.cos(angle) * distance, PLATFORM_TOP + 0.6, Math.sin(angle) * distance);
      velocity.set(0, 7 + Math.random() * 5, 0);
      debris.spawn(spot, pick(colors.repair), velocity, { lifetime: EFFECT_LIFETIME + 0.15 });
    }
    const point = new THREE.Vector3(0, PLATFORM_TOP, 0);
    waves.start(point, { fromRadius: reach * 0.6, toRadius: reach + 1, hex: REPAIR_WAVE_COLOR, seconds: REPAIR_WAVE_SECONDS, thin: true });
    events.emit('skillCast', { id: 'repair', point });
    return true;
  }

  // ── 블록 덩어리 움직이기 ──
  function updateDrop(drop, dt) {
    drop.time += dt;
    const group = drop.figure.group;
    const groundY = drop.point.y;
    if (drop.impactTime < 0) {
      if (drop.time < APPEAR_SECONDS) {
        // 하늘에 뿅 나타남 (살짝 커졌다가 제 크기)
        const t = drop.time / APPEAR_SECONDS;
        group.scale.setScalar(Math.max(0.001, easeOutBack(t)));
        group.rotation.set(0, drop.spin, 0);
        updateTelegraph(drop, 0);
        return;
      }
      const t = Math.min(1, (drop.time - APPEAR_SECONDS) / drop.fallSeconds);
      // 점점 빨라지며 떨어짐 (땅에 닿을 때 똑바로 서도록 회전이 0 으로 줄어듦)
      group.position.y = groundY + DROP_HEIGHT * (1 - t * t);
      group.scale.setScalar(1);
      const turn = 1 - t;
      group.rotation.set(
        Math.sin(drop.tiltPhase + drop.time * 9) * FALL_TILT * turn,
        drop.spin * turn * turn,
        Math.cos(drop.tiltPhase + drop.time * 7) * FALL_TILT * turn,
      );
      updateTelegraph(drop, t);
      if (t >= 1) impact(drop);
      return;
    }
    // 땅에 닿은 뒤: 납작하게 눌렸다가 와르르 부서짐
    drop.impactTime += dt;
    const k = Math.min(1, drop.impactTime / IMPACT_HOLD_SECONDS);
    const squash = IMPACT_SQUASH * Math.sin(Math.PI * Math.min(1, k * 1.6)) * (1 - k * 0.5);
    group.scale.set(1 + squash * 0.45, 1 - squash, 1 + squash * 0.45);
    if (k >= 1) shatter(drop);
  }

  function impact(drop) {
    const group = drop.figure.group;
    group.position.y = drop.point.y;
    group.rotation.set(0, 0, 0);
    drop.impactTime = 0;
    removeTelegraph(drop);
    enemies.damageArea(drop.point, drop.radius, drop.damage, { from: drop.point });
    waves.start(drop.point, { fromRadius: drop.size * 0.4, toRadius: drop.radius, hex: IMPACT_WAVE_COLOR, seconds: IMPACT_WAVE_SECONDS });
    events.emit('skillImpact', { id: 'blockDrop', point: drop.point.clone() });
  }

  // 덩어리가 부서져 사방으로 튐: 가장자리 블록일수록 멀리, 위층일수록 높이
  function shatter(drop) {
    const group = drop.figure.group;
    group.scale.set(1, 1, 1);
    const blocks = drop.figure.removeAll();
    const half = Math.max(0.5, drop.size / 2);
    for (const block of blocks) {
      velocity.subVectors(block.position, drop.point).setY(0);
      const edge = Math.min(1, velocity.length() / half);
      if (velocity.lengthSq() < 1e-4) velocity.set(Math.random() - 0.5, 0, Math.random() - 0.5);
      velocity.normalize().multiplyScalar(SHATTER_POWER * (0.35 + edge * 0.65) * (0.7 + Math.random() * 0.6));
      velocity.x += (Math.random() - 0.5) * SHATTER_POWER * 0.4;
      velocity.z += (Math.random() - 0.5) * SHATTER_POWER * 0.4;
      const layer = (block.position.y - drop.point.y) / CHUNK_LAYERS;
      velocity.y = SHATTER_UPWARD * (0.45 + layer * 0.55 + Math.random() * 0.45);
      debris.spawn(block.position, block.color, velocity);
    }
    drop.figure.dispose();
    drop.figure = null;
  }

  // ── 떨어질 곳 표시 (동그라미 + 점점 진해지는 그림자) ──
  function createTelegraph(point, radius) {
    const group = new THREE.Group();
    group.position.set(point.x, point.y + 0.2, point.z);
    const band = new THREE.Mesh(
      bandGeometry(radius),
      // depthTest: false → 몬스터에 가려도 동그라미가 보임 (어디가 맞을지 알 수 있게)
      new THREE.MeshBasicMaterial({ color: TELEGRAPH_COLOR, transparent: true, opacity: 0.8, depthWrite: false, depthTest: false }),
    );
    const shadow = new THREE.Mesh(
      telegraphGeometry.disc,
      new THREE.MeshBasicMaterial({ color: SHADOW_COLOR, transparent: true, opacity: 0, depthWrite: false }),
    );
    band.renderOrder = 3;
    shadow.renderOrder = 2;
    group.add(shadow, band);
    root.add(group);
    return { group, band, shadow };
  }

  function bandGeometry(radius) {
    const key = radius.toFixed(2);
    if (!telegraphGeometry.bands.has(key)) {
      const inner = Math.max(0.1, radius - TELEGRAPH_WIDTH);
      telegraphGeometry.bands.set(key, new THREE.RingGeometry(inner, radius, 72).rotateX(-Math.PI / 2));
    }
    return telegraphGeometry.bands.get(key);
  }

  // t: 떨어진 정도 (0 = 하늘, 1 = 땅)
  function updateTelegraph(drop, t) {
    const telegraph = drop.telegraph;
    if (!telegraph) return;
    telegraph.band.material.opacity = 0.55 + 0.35 * Math.sin(drop.time * 16) ** 2;
    const half = (drop.size / 2) * Math.SQRT2 * (0.45 + 0.55 * t);
    telegraph.shadow.scale.setScalar(half);
    telegraph.shadow.material.opacity = SHADOW_OPACITY * (0.25 + 0.75 * t);
  }

  function removeTelegraph(drop) {
    const telegraph = drop.telegraph;
    if (!telegraph) return;
    telegraph.group.removeFromParent();
    telegraph.band.material.dispose();
    telegraph.shadow.material.dispose();
    drop.telegraph = null;
  }

  // ── 매 장면마다 ──
  function update(dt) {
    for (const state of states.values()) tickCooldown(state, dt);
    for (let i = drops.length - 1; i >= 0; i--) {
      updateDrop(drops[i], dt);
      if (!drops[i].figure) drops.splice(i, 1);
    }
    waves.update(dt);
  }

  function reset() {
    for (const drop of drops) {
      removeTelegraph(drop);
      drop.figure?.dispose();
    }
    drops.length = 0;
    waves.clear();
    for (const id of ids) states.set(id, freshState(id));
    targeting = null;
  }

  // ── 작은 도우미 ──
  // 땅 높이: 성 돌바닥 위면 1, 아니면 0
  function groundHeight(x, z) {
    const half = config.castle.platformSize / 2;
    return Math.max(Math.abs(x), Math.abs(z)) <= half ? PLATFORM_TOP : 0;
  }

  function burstAround(center, count, palette, { spread, side, upward }) {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.6;
      spot.set(Math.cos(angle) * spread, (Math.random() - 0.3) * spread, Math.sin(angle) * spread).add(center);
      velocity
        .set(Math.cos(angle), 0, Math.sin(angle))
        .multiplyScalar(side * (0.6 + Math.random() * 0.6))
        .addScaledVector(up, upward * (0.6 + Math.random() * 0.6));
      debris.spawn(spot, pick(palette), velocity, { lifetime: EFFECT_LIFETIME });
    }
  }

  return {
    list,
    unlock,
    beginTarget,
    cancelTarget,
    cast,
    update,
    reset,
    get targeting() {
      return targeting;
    },
    // 자동 테스트용: 지금 떨어지는 중인 덩어리 수
    get activeDrops() {
      return drops.length;
    },
  };
}

// 덩어리 설계도: size × size × CHUNK_LAYERS, 알록달록 (색 섞임 종류마다 한 번만 만들어 둠)
function chunkBlueprint(size, variant) {
  const voxels = [];
  const offset = (size - 1) / 2;
  for (let y = 0; y < CHUNK_LAYERS; y++) {
    for (let ix = 0; ix < size; ix++) {
      for (let iz = 0; iz < size; iz++) {
        const hex = CHUNK_COLORS[hash(ix, iz, y, variant) % CHUNK_COLORS.length];
        voxels.push({ x: ix - offset, y, z: iz - offset, hex });
      }
    }
  }
  return getVoxelBlueprint(`skill-chunk|${size}|${CHUNK_LAYERS}|${variant}`, voxels);
}

// 같은 칸이면 늘 같은 값이 나오는 '섞기' 숫자 (색이 줄무늬처럼 보이지 않게)
function hash(x, z, y, variant) {
  let h = (x * 374761393 + z * 668265263 + y * 2147483647 + variant * 1274126177) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}

// 돌기 칸에 맞추기: 덩어리 가로가 홀수면 칸 가운데(…, -0.5, 0.5, …), 짝수면 칸 경계에 덩어리 가운데를 둠
function snapToStuds(value, size) {
  return size % 2 === 1 ? Math.floor(value) + 0.5 : Math.round(value);
}

function easeOutBack(t) {
  const c = 1.7;
  const u = t - 1;
  return 1 + (c + 1) * u * u * u + c * u * u;
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

// 땅 위에 퍼지는 동그라미 (덩어리가 떨어진 곳, 얼려라, 긴급 수리)
function createWaves(parent) {
  const thick = new THREE.RingGeometry(0.72, 1, 64).rotateX(-Math.PI / 2);
  const thin = new THREE.RingGeometry(0.93, 1, 96).rotateX(-Math.PI / 2);
  const pool = [];
  for (let k = 0; k < WAVE_POOL; k++) {
    const mesh = new THREE.Mesh(
      thick,
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }),
    );
    mesh.visible = false;
    mesh.renderOrder = 3;
    parent.add(mesh);
    pool.push({ mesh, time: 0, seconds: 1, from: 0, to: 1 });
  }
  let next = 0;
  return {
    // center: 가운데 땅 위치 { x, y, z }, 반지름이 fromRadius → toRadius 로 커지며 옅어짐
    start(center, { fromRadius, toRadius, hex, seconds, thin: useThin = false }) {
      const wave = pool[next];
      next = (next + 1) % pool.length;
      wave.mesh.geometry = useThin ? thin : thick;
      wave.mesh.material.color.set(hex);
      wave.mesh.position.set(center.x, center.y + 0.22, center.z);
      wave.mesh.scale.setScalar(Math.max(0.01, fromRadius));
      wave.time = 0;
      wave.seconds = seconds;
      wave.from = fromRadius;
      wave.to = toRadius;
      wave.mesh.visible = true;
    },
    update(dt) {
      for (const wave of pool) {
        if (!wave.mesh.visible) continue;
        wave.time += dt;
        const t = wave.time / wave.seconds;
        if (t >= 1) {
          wave.mesh.visible = false;
          continue;
        }
        const ease = 1 - (1 - t) * (1 - t);
        wave.mesh.scale.setScalar(wave.from + (wave.to - wave.from) * ease);
        wave.mesh.material.opacity = 0.85 * (1 - t);
      }
    },
    clear() {
      for (const wave of pool) wave.mesh.visible = false;
    },
  };
}
