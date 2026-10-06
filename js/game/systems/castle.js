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
//   castle.isInReach(위치)               적이 성에 닿았는지 (멈추고 공격할 거리인지)
//   castle.hp / maxHp / isBuilt / isDestroyed / figureHeight(블록 줄 수)
//
// 체력과 블록 수는 같이 줄어듭니다: 남은 블록 수 ≈ 처음 블록 수 × 남은 체력 ÷ 최대 체력.
// 맞을 때는 위가 비어 있는 블록('exposed')부터 떨어져 나가서 지붕·깃발이 먼저 부서집니다.

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
const FACE_TURN = 0.035; // 카메라 쪽을 볼 때 살짝 더 돌리는 각도 (라디안). 0이면 가운데 블록 틈으로 뒤가 비쳐 보임

const STEP = 1 / 60; // 흔들림 계산을 잘게 나누는 간격 (게임 속도를 올려도 튀지 않게)

export function createCastle({ scene, events, debris, art, config }) {
  const castleConfig = config.castle;
  const maxHp = castleConfig.maxHp;

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
  let hp = maxHp;
  let destroyed = false;
  let lastYaw = 0;
  const wobble = { tilt: 0, velocity: 0, squash: 0 };
  const center = new THREE.Vector3(0, PLATFORM_TOP, 0);

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

  // 남은 블록 수를 체력 비율에 맞춤 (다시 쌓은 직후에 씀)
  function trimToHp() {
    if (!figure || destroyed) return;
    const removed = figure.removeBlocks(figure.aliveCount - targetBlockCount(), 'exposed');
    if (removed.length > 0) debris.burst(removed, { from: null, ...TRIM_BURST });
  }

  function targetBlockCount() {
    return Math.round((figure.blueprint.count * hp) / maxHp);
  }

  // 맞았을 때: 체력 깎기 → 블록 떼어 내기 → 소식 보내기
  function damage(amount, fromPosition) {
    if (destroyed || !figure || !(amount > 0)) return hp;
    const dealt = Math.min(hp, amount);
    hp = Math.max(0, hp - amount);

    // 쌓는 중에는 체력만 깎고, 블록은 다 쌓은 뒤 trimToHp 가 맞춰 줌
    // 체력이 0이 되면 블록은 collapse() 가 한꺼번에 무너뜨리도록 남겨 둠
    if (figure.isBuilt && hp > 0) {
      const removed = figure.removeBlocks(figure.aliveCount - targetBlockCount(), 'exposed');
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

  // 맞은 자리: 성 앞면에서 때린 쪽으로 조금 나온 곳, 성 높이의 40% 쯤
  function hitPoint(fromPosition) {
    const height = PLATFORM_TOP + (figure ? figure.height : 0) * 0.4;
    const point = new THREE.Vector3(0, height, 0);
    if (!fromPosition) return point;
    const distance = Math.hypot(fromPosition.x, fromPosition.z);
    if (distance < 1e-4) return point;
    const reach = Math.min(distance, castleConfig.columns / 2);
    return point.set((fromPosition.x / distance) * reach, height, (fromPosition.z / distance) * reach);
  }

  // 전부 무너뜨리기 (돌바닥은 남음)
  function collapse() {
    destroyed = true;
    hp = 0;
    if (!figure) return;
    const removed = figure.removeAll();
    center.set(0, PLATFORM_TOP + figure.height * 0.3, 0);
    if (removed.length > 0) debris.burst(removed, { from: center, ...COLLAPSE_BURST });
    resetWobble();
  }

  function reset() {
    hp = maxHp;
    destroyed = false;
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
    if (figure.isBuilt) {
      figure.restoreBlocks(targetBlockCount() - figure.aliveCount, {
        seconds: REPAIR_SECONDS,
        onLand: () => events.emit('blockLanded'),
      });
    }
    events.emit('castleRepaired', { amount: hp - before, hp, maxHp });
    return hp;
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
    isInReach,
    get hp() {
      return hp;
    },
    get maxHp() {
      return maxHp;
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
