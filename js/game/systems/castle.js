// 우리 성
// 전장 가운데 회색 돌바닥 위에 그림으로 만든 성을 세웁니다. 몬스터에게 맞으면 블록이 떨어져 나가고,
// 체력이 0이 되면 남은 블록이 한꺼번에 무너집니다. 성의 체력·크기 숫자는 gameConfig.js 의 castle 에 있습니다.
//
//   castle.build()                      성을 (다시) 쌓기 시작 (블록이 떨어져 쌓이는 모션)
//   castle.update(dt, { cameraYaw })    매 장면마다: 쌓기 모션, 카메라 쪽 보기, 맞았을 때 흔들림
//   castle.damage(피해, 때린 위치)        체력을 깎고 블록을 떼어 냄 → 남은 체력
//   castle.collapse()                   남은 블록 전부 와르르 (돌바닥은 남음)
//   castle.reset()                      체력을 다 채우고 처음부터 다시 쌓기
//   castle.refreshArt()                 성 그림이 바뀌었을 때 새 그림으로 다시 쌓기 (체력은 그대로)
//   castle.repair(체력)                  체력을 채우고 떨어져 나간 블록을 아래쪽부터 다시 쌓기 → 'castleRepaired' 소식
//   castle.addMaxHp(체력)                최대 체력과 지금 체력을 함께 늘림 (성벽 부품). reset() 하면 처음 값으로
//   castle.attachFigure(인형, 옵션)       성 부품 인형을 성에 붙임: 맞으면 블록이 떨어지고, 수리하면 다시 쌓임
//   castle.detachFigure(인형)             붙였던 인형 떼기 (인형을 지우지는 않음)
//   castle.isInReach(위치)               적이 성에 닿았는지 (멈추고 공격할 거리인지)
//   castle.hp / maxHp / isBuilt / isDestroyed / figureHeight(블록 줄 수)
//
// 체력과 블록 수는 같이 줄어듭니다: 남은 블록 수 ≈ (성 + 붙은 부품) 블록 수 × 남은 체력 ÷ 최대 체력.
// 체력은 하나로 같이 쓰고, 맞을 때는 때린 몬스터에게 가장 가까운 인형(그쪽 성벽·부품)의 블록부터 떨어져 나갑니다.
// (부품은 밑동을 조금 남기고, 성 그림은 체력 비율만큼은 남겨 둔 채 그다음 가까운 부품으로 넘어감)
// 인형 안에서는 위가 비어 있는 블록('exposed')부터 떨어져서 지붕·깃발이 먼저 부서집니다.
// 수리할 때는 블록이 많이 빠진 인형부터 (빠진 만큼 나눠서) 아래쪽부터 다시 쌓입니다.
//
// attachFigure 옵션 (모두 생략 가능)
//   group      같은 부품의 인형끼리 묶는 이름 (몸통·강화 층·지붕). 맞을 때 위 인형부터, 수리할 때 아래 인형부터
//   layer      묶음 안에서 아래부터 몇 번째인지 (0 = 맨 아래)
//   keep       이 비율만큼은 다른 인형을 먼저 부순 뒤에야 떨어짐 (0.3 = 30% 는 남겨 둠)
//   footprint  { x, z, halfX, halfZ } 땅 위 차지하는 칸 (몬스터와 가까운지 잴 때 씀. 없으면 인형 크기로 계산)

import * as THREE from '../../lib/three.js';
import { BlockFigure } from '../core/blockFigure.js';
import { getBlueprint, getSolidBlueprint, forgetBlueprints } from '../core/blueprints.js';

// ── 바꿔도 되는 숫자 ──
const PLATFORM_COLOR = '#A0A5A9'; // 성 아래 돌바닥 색 (밝은 회색)
const PLATFORM_GROUT_COLOR = '#6C6E68'; // 돌바닥 블록 사이 틈으로 보이는 색 (잔디가 비쳐 보이지 않게)
const PLATFORM_TOP = 1; // 돌바닥 높이 = 블록 줄 수 (성은 이 높이 위에 섬)
const REFRESH_BUILD_SECONDS = 2.5; // 그림을 바꿨을 때 성을 다시 쌓는 시간
const REPAIR_SECONDS = 2; // 수리할 때 블록이 다시 쌓이는 시간
const HIT_BURST = { power: 5, upward: 6 }; // 맞았을 때 떨어져 나간 블록이 튀는 세기
const COLLAPSE_BURST = { power: 9, upward: 10 }; // 무너질 때 블록이 튀는 세기
const TRIM_BURST = { power: 3, upward: 4 }; // 다시 쌓은 뒤 체력만큼 블록을 덜어 낼 때 튀는 세기
const WOBBLE_KICK = 0.9; // 맞았을 때 옆으로 흔들리는 세기
const WOBBLE_MAX_TILT = 0.06; // 가장 많이 기울어지는 각도 (라디안)
const WOBBLE_SPRING = 320; // 흔들림이 제자리로 돌아오는 힘 (클수록 빠르게 떨림)
const WOBBLE_DAMPING = 11; // 흔들림이 멎는 빠르기
const SQUASH_PER_HIT = 0.025; // 맞았을 때 납작하게 눌리는 정도
const SQUASH_MAX = 0.06;
const CORE_SLACK = 0.1; // 성 그림은 (남은 체력 비율 - 이 값) 만큼은 남겨 두고, 그보다 더 부술 때는 먼 부품을 먼저 부숨
const CATCH_UP_RATE = 2; // 한 번 맞을 때 떼어 내는 블록 수의 최대 배수 (부품을 새로 붙여서 블록이 남아돌 때 한꺼번에 우르르 떨어지지 않게)
const FACE_TURN = 0.035; // 카메라 쪽을 볼 때 살짝 더 돌리는 각도 (라디안). 0이면 가운데 블록 틈으로 뒤가 비쳐 보임

const STEP = 1 / 60; // 흔들림 계산을 잘게 나누는 간격 (게임 속도를 올려도 튀지 않게)

export function createCastle({ scene, events, debris, art, config }) {
  const castleConfig = config.castle;
  const baseMaxHp = castleConfig.maxHp;

  // 돌바닥: 바로 보이고, 움직이지 않고, 카메라를 따라 돌지 않음
  const platformBlueprint = getSolidBlueprint('castle-platform', {
    columns: castleConfig.platformSize,
    rows: PLATFORM_TOP,
    depth: castleConfig.platformSize,
    hex: PLATFORM_COLOR,
  });
  const platform = new BlockFigure(platformBlueprint, scene, { castShadow: false });
  scene.add(createGrout(castleConfig.platformSize));

  // 성은 돌바닥 위에 섬 (root 높이 = 돌바닥 윗면)
  const root = new THREE.Group();
  root.position.y = PLATFORM_TOP;
  scene.add(root);

  let figure = null;
  let blueprintKey = null;
  let maxHp = baseMaxHp;
  let hp = maxHp;
  let destroyed = false;
  let lastYaw = 0;
  const wobble = { tilt: 0, velocity: 0, squash: 0 };
  const center = new THREE.Vector3(0, PLATFORM_TOP, 0);

  // 성에 붙은 부품 인형들 (성 그림 인형은 mainEntry)
  // 한 칸: { figure, group, layer, keep, footprint, distance }
  const attached = [];
  const mainEntry = { figure: null, group: 'castle', layer: 0, keep: 0, footprint: null, distance: 0 };
  const mainFootprint = { x: 0, z: 0, halfX: 0, halfZ: 0 };
  const corner = new THREE.Vector3();
  const boundsCache = new WeakMap();

  // 성 인형을 새로 만들고 쌓기 모션 시작. afterBuild: 다 쌓은 뒤 할 일
  function startFigure(seconds, afterBuild) {
    disposeFigure();
    const key = art.key('castle');
    if (blueprintKey && blueprintKey !== key) forgetBlueprints(`${blueprintKey}|`); // 예전 그림 설계도 정리
    blueprintKey = key;
    const blueprint = getBlueprint(key, art.get('castle'), {
      columns: castleConfig.columns,
      depth: castleConfig.depth,
    });
    const built = new BlockFigure(blueprint, root);
    figure = built;
    built.group.rotation.y = lastYaw + FACE_TURN;
    resetWobble();
    built.build(seconds, {
      onLand: () => events.emit('blockLanded'),
      onComplete: () => {
        if (figure !== built || destroyed) return; // 그사이 다른 성으로 바뀌었거나 무너졌으면 무시
        afterBuild?.();
        events.emit('castleBuilt');
      },
    });
  }

  function disposeFigure() {
    if (!figure) return;
    figure.dispose();
    figure = null;
  }

  function build() {
    startFigure(castleConfig.buildSeconds, trimToHp);
  }

  // ── 성 그림 + 붙은 부품: 블록 수를 체력에 맞추기 ──

  function entries() {
    const list = [];
    if (figure) {
      mainEntry.figure = figure;
      list.push(mainEntry);
    }
    for (const entry of attached) list.push(entry);
    return list;
  }

  // 다 쌓인 인형들 기준 (지금 남은 블록 수) − (체력에 맞는 블록 수). 음수면 블록이 모자람
  // 쌓는 중인 인형은 빼고 셈: 다 쌓인 뒤에 함께 맞춰짐
  function excessBlocks() {
    let count = 0;
    let alive = 0;
    for (const entry of entries()) {
      if (!entry.figure.isBuilt) continue;
      count += entry.figure.blueprint.count;
      alive += entry.figure.aliveCount;
    }
    return alive - Math.round((count * hp) / maxHp);
  }

  function builtBlockCount() {
    let count = 0;
    for (const entry of entries()) if (entry.figure.isBuilt) count += entry.figure.blueprint.count;
    return count;
  }

  // 블록 n개 떼어 내기 → [{ position, color }]
  // from 이 있으면 그 위치에 가까운 인형부터 (같은 부품이면 위 인형부터), 없으면 성 그림부터.
  // 첫 바퀴에는 부품은 keep 비율만큼, 성 그림은 체력 비율에 가깝게 남겨 두고 (한쪽에서만 맞아도 성 그림이 체력보다
  // 훨씬 먼저 사라지지 않게), 그래도 모자라면 두 번째 바퀴에서 가까운 것부터 남은 것도 뗌
  function chipBlocks(n, from) {
    const removed = [];
    if (!(n > 0)) return removed;
    const list = entries().filter((entry) => entry.figure.isBuilt && entry.figure.aliveCount > 0);
    if (from) {
      for (const entry of list) entry.distance = footprintDistance(entry, from);
      list.sort((a, b) => a.distance - b.distance || b.layer - a.layer);
    } else {
      list.sort((a, b) => (a === mainEntry ? -1 : b === mainEntry ? 1 : b.layer - a.layer));
    }
    const coreKeep = from ? Math.max(0, hp / maxHp - CORE_SLACK) : 0;
    let left = n;
    for (let pass = 0; pass < 2 && left > 0; pass++) {
      for (const entry of list) {
        if (left <= 0) break;
        const part = entry.figure;
        const share = entry === mainEntry ? coreKeep : entry.keep;
        const keep = pass === 0 ? Math.ceil(share * part.blueprint.count) : 0;
        const take = Math.min(left, part.aliveCount - keep);
        if (take <= 0) continue;
        const blocks = part.removeBlocks(take, 'exposed');
        left -= blocks.length;
        for (const block of blocks) removed.push(block);
      }
    }
    return removed;
  }

  // 모자란 블록 다시 쌓기: 많이 빠진 부품(묶음)일수록 많이 받고, 묶음 안에서는 아래 인형부터 채움
  function restoreToHp() {
    const need = -excessBlocks();
    if (need <= 0) return 0;
    const groups = new Map();
    let totalMissing = 0;
    for (const entry of entries()) {
      const part = entry.figure;
      if (!part.isBuilt) continue;
      const missing = part.blueprint.count - part.aliveCount;
      if (missing <= 0) continue;
      let group = groups.get(entry.group);
      if (!group) {
        group = { missing: 0, share: 0, rest: 0, entries: [] };
        groups.set(entry.group, group);
      }
      group.missing += missing;
      group.entries.push(entry);
      totalMissing += missing;
    }
    if (totalMissing === 0) return 0;
    const give = Math.min(need, totalMissing);
    const list = Array.from(groups.values());
    let given = 0;
    for (const group of list) {
      const exact = (give * group.missing) / totalMissing;
      group.share = Math.floor(exact);
      group.rest = exact - group.share;
      given += group.share;
    }
    list.sort((a, b) => b.rest - a.rest);
    for (let i = 0; given < give && i < list.length; i++) {
      if (list[i].share >= list[i].missing) continue;
      list[i].share += 1;
      given += 1;
    }
    let restored = 0;
    for (const group of list) {
      group.entries.sort((a, b) => a.layer - b.layer);
      let left = group.share;
      for (const entry of group.entries) {
        if (left <= 0) break;
        const part = entry.figure;
        const n = Math.min(left, part.blueprint.count - part.aliveCount);
        if (n <= 0) continue;
        const done = part.restoreBlocks(n, { seconds: REPAIR_SECONDS, onLand: () => events.emit('blockLanded') });
        left -= done;
        restored += done;
      }
    }
    return restored;
  }

  // 땅 위에서 인형이 차지하는 네모 칸까지의 거리 (안에 있으면 0)
  function footprintDistance(entry, from) {
    const box = footprintOf(entry);
    const dx = Math.max(0, Math.abs(from.x - box.x) - box.halfX);
    const dz = Math.max(0, Math.abs(from.z - box.z) - box.halfZ);
    return Math.hypot(dx, dz);
  }

  function footprintOf(entry) {
    if (entry.footprint) return entry.footprint;
    if (!entry.autoFootprint) entry.autoFootprint = entry === mainEntry ? mainFootprint : { x: 0, z: 0, halfX: 0, halfZ: 0 };
    return measureFootprint(entry.figure, entry.autoFootprint);
  }

  // 인형 설계도의 네 귀퉁이를 세상 위치로 옮겨서 땅 위 네모 칸을 잼 (카메라를 따라 돌아도 맞게)
  function measureFootprint(part, out) {
    const local = blueprintBounds(part.blueprint);
    part.group.updateWorldMatrix(true, false);
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (let k = 0; k < 4; k++) {
      corner.set(k & 1 ? local.maxX : local.minX, 0, k & 2 ? local.maxZ : local.minZ).applyMatrix4(part.group.matrixWorld);
      minX = Math.min(minX, corner.x);
      maxX = Math.max(maxX, corner.x);
      minZ = Math.min(minZ, corner.z);
      maxZ = Math.max(maxZ, corner.z);
    }
    out.x = (minX + maxX) / 2;
    out.z = (minZ + maxZ) / 2;
    out.halfX = (maxX - minX) / 2;
    out.halfZ = (maxZ - minZ) / 2;
    return out;
  }

  function blueprintBounds(blueprint) {
    let bounds = boundsCache.get(blueprint);
    if (bounds) return bounds;
    bounds = { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
    const p = blueprint.positions;
    for (let i = 0; i < blueprint.count; i++) {
      bounds.minX = Math.min(bounds.minX, p[i * 3] - 0.5);
      bounds.maxX = Math.max(bounds.maxX, p[i * 3] + 0.5);
      bounds.minZ = Math.min(bounds.minZ, p[i * 3 + 2] - 0.5);
      bounds.maxZ = Math.max(bounds.maxZ, p[i * 3 + 2] + 0.5);
    }
    if (blueprint.count === 0) Object.assign(bounds, { minX: 0, maxX: 0, minZ: 0, maxZ: 0 });
    boundsCache.set(blueprint, bounds);
    return bounds;
  }

  function nearestEntry(from) {
    let best = null;
    let bestDistance = Infinity;
    for (const entry of entries()) {
      if (!entry.figure.isBuilt || entry.figure.aliveCount === 0) continue;
      const distance = footprintDistance(entry, from);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = entry;
      }
    }
    return best;
  }

  // 남은 블록 수를 체력 비율에 맞춤 (다시 쌓은 직후에 씀). 방금 쌓은 성 그림부터 덜어 냄
  function trimToHp() {
    if (!figure || destroyed) return;
    const removed = chipBlocks(excessBlocks(), null);
    if (removed.length > 0) debris.burst(removed, { from: null, ...TRIM_BURST });
  }

  // 맞았을 때: 체력 깎기 → 블록 떼어 내기 → 소식 보내기
  function damage(amount, fromPosition) {
    if (destroyed || !figure || !(amount > 0)) return hp;
    const dealt = Math.min(hp, amount);
    hp = Math.max(0, hp - amount);

    // 다 쌓인 인형에서만 블록을 뗌 (쌓는 중인 인형은 다 쌓은 뒤 trimToHp 가 맞춰 줌)
    // 체력이 0이 되면 블록은 collapse() 가 한꺼번에 무너뜨리도록 남겨 둠
    if (hp > 0) {
      const limit = Math.max(1, Math.ceil(((builtBlockCount() * dealt) / maxHp) * CATCH_UP_RATE));
      const removed = chipBlocks(Math.min(excessBlocks(), limit), fromPosition ?? null);
      if (removed.length > 0) debris.burst(removed, { from: fromPosition ?? null, ...HIT_BURST });
    }
    kickWobble(dealt, fromPosition);

    events.emit('castleHit', { damage: dealt, hp, maxHp, position: hitPoint(fromPosition) });
    if (hp <= 0 && !destroyed) {
      destroyed = true;
      events.emit('castleDestroyed');
    }
    return hp;
  }

  // 맞은 자리: 때린 쪽에 가장 가까운 부품이면 그 부품 가장자리,
  // 성 그림이면 성 앞면에서 때린 쪽으로 조금 나온 곳 (성 높이의 40% 쯤)
  function hitPoint(fromPosition) {
    const height = PLATFORM_TOP + (figure ? figure.height : 0) * 0.4;
    const point = new THREE.Vector3(0, height, 0);
    if (!fromPosition) return point;
    const entry = nearestEntry(fromPosition);
    if (entry && entry !== mainEntry) {
      const box = footprintOf(entry);
      return point.set(
        THREE.MathUtils.clamp(fromPosition.x, box.x - box.halfX, box.x + box.halfX),
        PLATFORM_TOP + 1.5,
        THREE.MathUtils.clamp(fromPosition.z, box.z - box.halfZ, box.z + box.halfZ),
      );
    }
    const distance = Math.hypot(fromPosition.x, fromPosition.z);
    if (distance < 1e-4) return point;
    const reach = Math.min(distance, castleConfig.columns / 2);
    return point.set((fromPosition.x / distance) * reach, height, (fromPosition.z / distance) * reach);
  }

  // 전부 무너뜨리기: 성 그림과 붙은 부품까지 와르르 (돌바닥은 남음)
  function collapse() {
    destroyed = true;
    hp = 0;
    if (!figure) return;
    center.set(0, PLATFORM_TOP + figure.height * 0.3, 0);
    const blocks = [];
    for (const entry of entries()) for (const block of breakFigure(entry.figure)) blocks.push(block);
    if (blocks.length > 0) debris.burst(blocks, { from: center, ...COLLAPSE_BURST });
    resetWobble();
  }

  // 인형의 보이는 블록을 전부 떼어 냄 (쌓는 중이면 이미 나타난 블록만 튀게 함)
  function breakFigure(part) {
    const shown = part.animator ? part.animator.startedCount() : part.aliveCount;
    const removed = part.removeAll();
    if (shown < removed.length) {
      removed.sort((a, b) => a.position.y - b.position.y);
      removed.length = shown;
    }
    return removed;
  }

  // 처음 체력(최대 체력도 처음 값)으로 돌리고 다시 쌓기
  function reset() {
    maxHp = baseMaxHp;
    hp = maxHp;
    destroyed = false;
    // 아직 붙어 있는 부품이 있으면 블록을 다 채움 (보통은 castleParts.clear() 가 먼저 떼어 냄)
    for (const entry of attached) {
      const part = entry.figure;
      const missing = part.blueprint.count - part.aliveCount;
      if (missing > 0 && part.isBuilt) {
        part.restoreBlocks(missing, { seconds: REPAIR_SECONDS, onLand: () => events.emit('blockLanded') });
      }
    }
    build();
  }

  // 새 그림으로 다시 쌓기. 체력은 그대로 두고, 다 쌓은 뒤 체력만큼 블록을 덜어 냄
  // 이미 무너진 성은 지금 다시 세우지 않음 (다시 하기를 누르면 새 그림으로 쌓임)
  function refreshArt() {
    if (destroyed) return;
    startFigure(REFRESH_BUILD_SECONDS, trimToHp);
  }

  // 수리: 체력을 채우고, 그만큼 떨어져 나갔던 블록이 위에서 떨어져 다시 쌓임
  function repair(amount) {
    if (destroyed || !figure || !(amount > 0) || hp >= maxHp) return hp;
    const before = hp;
    hp = Math.min(maxHp, hp + amount);
    restoreToHp();
    events.emit('castleRepaired', { amount: hp - before, hp, maxHp });
    return hp;
  }

  // 최대 체력 늘리기 (성벽): 지금 체력도 같은 만큼 늘어남. 무너진 뒤에는 최대 체력만 늘어남
  function addMaxHp(amount) {
    if (!(amount > 0)) return maxHp;
    maxHp += amount;
    if (!destroyed) hp = Math.min(maxHp, hp + amount);
    return maxHp;
  }

  // 부품 인형 붙이기 / 떼기 (블록 수 계산과 맞았을 때·수리할 때 모습에 함께 들어감)
  function attachFigure(part, { group, layer = 0, keep = 0, footprint = null } = {}) {
    if (!part || attached.some((entry) => entry.figure === part)) return;
    attached.push({
      figure: part,
      group: group ?? part,
      layer,
      keep: THREE.MathUtils.clamp(keep, 0, 1),
      footprint,
      distance: 0,
    });
  }

  function detachFigure(part) {
    const index = attached.findIndex((entry) => entry.figure === part);
    if (index >= 0) attached.splice(index, 1);
  }

  function isInReach(position) {
    return Math.max(Math.abs(position.x), Math.abs(position.z)) <= castleConfig.reach;
  }

  // ── 맞았을 때 흔들림 (용수철처럼 좌우로 떨다가 멈춤) ──
  function kickWobble(amount, fromPosition) {
    const strength = Math.min(1, 0.35 + amount / 12);
    let side = Math.random() < 0.5 ? -1 : 1;
    if (fromPosition) {
      // 성이 보는 방향 기준으로 때린 쪽의 반대편으로 기울어짐
      const localX = fromPosition.x * Math.cos(lastYaw) - fromPosition.z * Math.sin(lastYaw);
      if (Math.abs(localX) > 0.5) side = Math.sign(localX);
    }
    wobble.velocity += side * WOBBLE_KICK * strength;
    wobble.squash = Math.min(SQUASH_MAX, wobble.squash + SQUASH_PER_HIT * strength);
  }

  function resetWobble() {
    wobble.tilt = 0;
    wobble.velocity = 0;
    wobble.squash = 0;
  }

  function stepWobble(dt) {
    let left = dt;
    while (left > 1e-6) {
      const h = Math.min(STEP, left);
      wobble.velocity += (-WOBBLE_SPRING * wobble.tilt - WOBBLE_DAMPING * wobble.velocity) * h;
      wobble.tilt = THREE.MathUtils.clamp(wobble.tilt + wobble.velocity * h, -WOBBLE_MAX_TILT, WOBBLE_MAX_TILT);
      left -= h;
    }
    wobble.squash *= Math.exp(-dt * 10);
    if (Math.abs(wobble.tilt) < 1e-4 && Math.abs(wobble.velocity) < 1e-3) {
      wobble.tilt = 0;
      wobble.velocity = 0;
    }
    if (wobble.squash < 1e-4) wobble.squash = 0;
  }

  function update(dt, { cameraYaw = 0 } = {}) {
    lastYaw = cameraYaw;
    if (!figure) return;
    figure.update(dt);
    stepWobble(dt);
    const group = figure.group;
    group.rotation.y = cameraYaw + FACE_TURN; // 항상 카메라 쪽을 봄
    group.rotation.z = wobble.tilt;
    group.scale.set(1 + wobble.squash * 0.5, 1 - wobble.squash, 1 + wobble.squash * 0.5);
  }

  return {
    build,
    update,
    damage,
    collapse,
    reset,
    refreshArt,
    repair,
    addMaxHp,
    attachFigure,
    detachFigure,
    isInReach,
    get hp() {
      return hp;
    },
    get maxHp() {
      return maxHp;
    },
    get baseMaxHp() {
      return baseMaxHp;
    },
    get isBuilt() {
      return Boolean(figure && figure.isBuilt);
    },
    get isDestroyed() {
      return destroyed;
    },
    get figureHeight() {
      return figure ? figure.height : 0;
    },
    // 다른 모듈·테스트에서 쓸 수 있는 손잡이
    get figure() {
      return figure;
    },
    get attachedFigures() {
      return attached.map((entry) => entry.figure);
    },
    platform,
  };
}

// 돌바닥 블록 아래에 까는 얇은 판 (블록 사이 틈으로 초록 잔디 줄이 보이지 않게 함)
function createGrout(size) {
  const geometry = new THREE.BoxGeometry(size - 0.1, PLATFORM_TOP * 0.8, size - 0.1);
  const material = new THREE.MeshStandardMaterial({ color: PLATFORM_GROUT_COLOR, roughness: 0.9 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = PLATFORM_TOP * 0.4;
  mesh.receiveShadow = true;
  return mesh;
}
