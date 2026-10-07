// 미친토끼 무리 (만들기, 매 장면 움직이기, 다시 하기)
// fightConfig.js 의 enemies.spawns 자리에 칼·총·망치 미친토끼를 세우고, 매 장면 머리(enemyBrains.js)를 돌립니다.
// 맞는 것·귀가 터지는 것·'펑'은 fighterBody.js 가 내 토끼와 똑같이 처리합니다.
// 맞으면 쉬고 있던 토끼도 깨어나고('!'), 깨어난 토끼는 근처(fightConfig.js 의 enemies.wakeRadius) 친구를 차례로 깨웁니다.
// 한꺼번에 공격 준비를 하는 토끼는 칼·망치 토끼 최대 MAX_MELEE 마리, 총 토끼 최대 MAX_RANGED 마리
// (동시에 너무 많이 덤비지 않게 — 차례를 기다리는 칼 토끼는 옆에서 빙빙 돎).
//
//   const enemies = createEnemies(scene, { collision, bullets, fx, debris, events, view, player })
//   enemies.list            미친토끼 목록 = fighter + { kind, name, state, cfg, rig, spawn, scale }
//                           state: 'idle' | 'alert' | 'chase' | 'windup' | 'attack' | 'recover' | 'dead'
//                           (터진 토끼도 목록에 남음, alive = false)
//   enemies.spawnAll()      처음 자리에 모두 세우기 (다시 하기에도 이것 — 이미 있으면 되살림)
//   enemies.update(dt)      매 장면 한 번 (총알 맞기는 bullets.update 가 함)
//   enemies.aliveCount()    살아 있는 수 ;  enemies.total  전체 수
//   enemies.clear()         모두 치우기 (블록 인형까지 지움)
//   enemies.wakeAll()       모두 깨우기 (시험·디버그용)
//   enemies.wakeNearest(x, z) → 깨운 토끼 | null   (x, z) 에 가장 가까운 쉬는 토끼 하나만 깨움 (친구는 안 깨움)
//                           내 토끼가 오래 숨어 있으면 game.js 가 불러서 미친토끼가 찾아오게 함
//   enemies.dispose()       clear + 총구 빛·충격 고리까지 장면에서 지움 (게임을 완전히 끝낼 때)
//
// 종류별 숫자(체력·빠르기·공격)는 fightConfig.js 의 enemies, 움직임 느낌은 enemyBrains.js / enemyAttacks.js / enemyGunner.js,
// 길 찾기는 enemySteering.js, 총구 반짝임·땅 블록은 enemyLook.js 에서 바꿉니다.

import * as THREE from '../../lib/three.js';
import { FIGHT } from '../fightConfig.js';
import { createFighterBody } from './fighterBody.js';
import { createRabbitRig } from '../render/rabbitRig.js';
import { createRabbitModel } from '../art/rabbitArt.js';
import { createWeaponModel } from '../art/weaponArt.js';
import { createEnemyNav, createSteerMemory, separateEnemies } from './enemySteering.js';
import { createBrainMemory, resetBrain, updateEnemyBrain, becomeAlert } from './enemyBrains.js';
import { cancelAttack } from './enemyActions.js';
import { createEnemyLook } from './enemyLook.js';

const E = FIGHT.enemies;
const WEAPON_OF = { knife: 'knife', gunner: 'enemyGun', brute: 'hammer' }; // 종류별 무기 (weaponArt.js)
const KNOCK_TAKEN = { knife: 1, gunner: 1, brute: 0.45 }; // 맞고 밀리는 정도 (망치 토끼는 무거워서 덜 밀림)
const MAX_MELEE = 2; // 동시에 공격 준비·공격하는 칼·망치 토끼 최대 수
const MAX_RANGED = 1; // 동시에 쏘는 총 토끼 최대 수 (번갈아 쏴서 총알을 보고 피하기 쉽게)
const WAKE_RADIUS = E.wakeRadius; // 친구 깨우는 거리 (fightConfig.js 의 enemies.wakeRadius)
const DUST_MIN = 0.75; // 깡충 세기(0~1, 토끼 크기와 상관없이)가 이보다 셀 때만 착지 먼지 (쉴 때 살살 걷는 것은 먼지 없음)
const DUST_SIZE = 0.7; // 착지 먼지 크기 비율
const ALERT_ABOVE = 1; // '!' 를 귀 끝보다 이만큼 위에 (칸)
const ENEMY_HURT_HEX = '#FFF03A'; // 맞으면 연노랑으로 반짝 (하양은 내 토끼 색이라 헷갈리지 않게)
const ENEMY_FLASH_MAX = 0.55; // 맞았을 때 반짝임 최대 세기 (원래 색이 비쳐 보이게)

export function createEnemies(scene, { collision, bullets, fx = null, debris, events, view = null, player }) {
  const list = [];
  const nav = createEnemyNav(collision);
  const look = createEnemyLook(scene);
  const ctx = { collision, bullets, fx, debris, events, view, player, nav, list, look, dt: 0, wakeFriends, canAttack };
  let glowCount = 0;

  function build(kind, x, z) {
    const cfg = E[kind];
    if (!cfg) throw new Error(`없는 미친토끼 종류: ${kind}`);
    const scale = (cfg.scale || 1) * (FIGHT.figureScale ?? 1); // 모든 토끼 공통 크기 × 종류별 크기
    const model = createRabbitModel(kind);
    const rig = createRabbitRig(scene, model, {
      weapon: createWeaponModel(WEAPON_OF[kind]),
      scale,
      hurtHex: ENEMY_HURT_HEX,
      flashMax: ENEMY_FLASH_MAX,
      // strength = 깡충 세기 × 토끼 크기 → 기준도 크기만큼 곱해서 견줌 (작은 토끼도 세게 뛰면 먼지)
      onLand: (position, strength) => {
        if (strength > DUST_MIN * scale) fx?.dust?.(position, strength * DUST_SIZE);
      },
    });
    const body = createFighterBody({ team: 'enemy', rig, maxHp: cfg.maxHp, radius: cfg.radius, debris, fx, events, view });
    const pose = { position: body.position, facing: 0, move: 0, aiming: false, jump: -1, swing: -1, swingSide: 1, windup: 0, recoil: 0, hurt: 0, stunned: false };
    const e = Object.assign(body, {
      kind,
      name: cfg.name,
      cfg,
      scale,
      state: 'idle',
      stateTime: 0,
      spawn: { x, z },
      home: { x, z },
      pose,
      ai: createBrainMemory(),
      steer: createSteerMemory(),
      knockScale: KNOCK_TAKEN[kind] ?? 1,
      alertLift: ((model.height || 18) + ALERT_ABOVE) * scale,
      muzzle: new THREE.Vector3(),
      spark: new THREE.Vector3(),
      slamPoint: new THREE.Vector3(),
      glowIndex: kind === 'gunner' ? glowCount++ : -1,
    });

    // 맞으면 깨어남 (쉬던 토끼는 '!' + 친구 깨우기)
    const takeDamage = body.takeDamage;
    e.takeDamage = (hit) => {
      const result = takeDamage(hit);
      if (result.hit && e.alive && e.state === 'idle') becomeAlert(e, ctx, true);
      if (result.dead) onDeath(e);
      return result;
    };
    return e;
  }

  function place(e) {
    e.reset(e.home.x, e.home.z);
    e.spawn.x = e.home.x;
    e.spawn.z = e.home.z;
    e.rig.reset?.();
    e.rig.setVisible?.(true);
    // 처음에는 아래쪽(내 토끼가 오는 쪽)을 대충 바라봄
    e.facing = (Math.random() - 0.5) * 1.6;
    e.steer = createSteerMemory();
    resetBrain(e);
    e.pose.hurt = 0;
    e.pose.facing = e.facing;
    e.rig.update(0, e.pose);
    e.rig.muzzleWorld(e.muzzle);
  }

  function onDeath(e) {
    cancelAttack(e);
    e.state = 'dead';
    e.stateTime = 0;
  }

  function spawnAll() {
    const spawns = E.spawns;
    const same = list.length === spawns.length && list.every((e, i) => e.kind === spawns[i][0]);
    if (!same) {
      clear();
      for (const [kind, x, z] of spawns) list.push(build(kind, x, z));
    }
    for (let i = 0; i < list.length; i++) {
      list[i].home.x = spawns[i][1];
      list[i].home.z = spawns[i][2];
      place(list[i]);
    }
    look.clear();
    nav.clear();
  }

  function update(dt) {
    dt = Math.min(Math.max(dt, 0), 0.1);
    ctx.dt = dt;
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.alive) {
        if (e.state !== 'dead') onDeath(e);
        continue;
      }
      e.updateBody(dt);
      updateEnemyBrain(e, ctx, dt);
    }
    separateEnemies(list, ctx);
    for (let i = 0; i < list.length; i++) {
      const e = list[i];
      if (!e.alive) continue;
      e.rig.update(dt, e.pose);
      e.rig.muzzleWorld(e.muzzle);
    }
    look.update(dt);
  }

  // 깨어난 토끼 둘레의 쉬던 친구들을 가까운 순서로 alertSpread 초씩 차이를 두고 깨움
  function wakeFriends(source) {
    const sleepers = [];
    for (const o of list) {
      if (o === source || !o.alive || o.state !== 'idle' || o.ai.wakeDelay >= 0) continue;
      const d = Math.hypot(o.position.x - source.position.x, o.position.z - source.position.z);
      if (d <= WAKE_RADIUS) sleepers.push([d, o]);
    }
    sleepers.sort((a, b) => a[0] - b[0]);
    sleepers.forEach(([, o], i) => {
      o.ai.wakeDelay = E.alertSpread * (i + 1);
    });
  }

  // 같은 무리(칼·망치 / 총)에서 지금 공격 준비·공격 중인 친구가 한도보다 적어야 새로 공격 시작
  function canAttack(e) {
    const ranged = e.kind === 'gunner';
    let busy = 0;
    for (const o of list) {
      if (o === e || !o.alive || (o.kind === 'gunner') !== ranged) continue;
      if (o.state === 'windup' || o.state === 'attack') busy++;
    }
    return busy < (ranged ? MAX_RANGED : MAX_MELEE);
  }

  function wakeAll() {
    for (const e of list) if (e.alive && e.state === 'idle') becomeAlert(e, ctx, false);
  }

  function wakeNearest(x, z) {
    let best = null;
    let bestDistance = Infinity;
    for (const e of list) {
      if (!e.alive || e.state !== 'idle') continue;
      const d = Math.hypot(e.position.x - x, e.position.z - z);
      if (d < bestDistance) {
        best = e;
        bestDistance = d;
      }
    }
    if (best) becomeAlert(best, ctx, false);
    return best;
  }

  function aliveCount() {
    let n = 0;
    for (const e of list) if (e.alive) n++;
    return n;
  }

  function clear() {
    for (const e of list) {
      cancelAttack(e);
      e.rig.dispose?.();
    }
    list.length = 0;
    glowCount = 0;
    look.clear();
  }

  function dispose() {
    clear();
    look.dispose();
  }

  return {
    list,
    spawnAll,
    update,
    aliveCount,
    clear,
    wakeAll,
    wakeNearest,
    dispose,
    get total() {
      return list.length;
    },
  };
}
