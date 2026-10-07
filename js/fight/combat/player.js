// 내 토끼 (움직이기, 조준, 구르기, 무기 쓰기)
// 누르는 쪽으로 '휙' 빨리 출발하고 빨리 멈춥니다. 마우스·조준 스틱 쪽을 바라보고, 구르는 동안은 맞지 않습니다.
// 맞는 것·귀가 터지는 것·'펑'은 fighterBody.js 가 미친토끼와 똑같이 처리합니다.
//
//   const player = createPlayer(scene, { collision, bullets, fx, debris, events, view, getEnemies, props })
//       props 는 없어도 됨 (칼로 상자 부수기용, 없으면 bullets 가 가진 props 를 씀)
//   player            = fighter (team 'player', position, velocity, radius, facing, alive, takeDamage, heal …)
//   player.update(dt, input) → 무기 frame { hitStop, fired, swung, hits, … }   매 장면 한 번
//       input = { move:{x,z}, aimPoint, aimDir, fire, firePressed, autoAim, rollPressed, switchPressed, slot, reloadPressed }
//       바라보는 쪽 정하기: aimDir > aimPoint > autoAim(앞쪽 가까운 미친토끼) > 걷는 쪽
//   player.reset(x?, z?)               처음 자리(없으면 FIGHT.map.playerSpawn)·체력·무기로 (다시 하기)
//   player.rig / player.weapons        블록 인형 몸짓 / 무기 (weapons.js)
//   player.rolling (참/거짓) / player.rollReady (0~1, HUD 구르기 버튼) / player.muzzle (총구 위치 Vector3)
//   player.hitStop                     이번 장면에 칼로 맞혀서 요청한 멈칫 시간 (초)
//
// 빠르기·구르기 숫자는 fightConfig.js 의 player 에서 바꿉니다. 아래는 손맛(보이는 느낌) 숫자.

import * as THREE from '../../lib/three.js';
import { FIGHT } from '../fightConfig.js';
import { createFighterBody } from './fighterBody.js';
import { createPlayerWeapons } from './weapons.js';
import { facingFromDir, turnToward, wrapAngle } from './combatMath.js';
import { createRabbitRig } from '../render/rabbitRig.js';
import { createRabbitModel } from '../art/rabbitArt.js';
import { createWeaponModel } from '../art/weaponArt.js';

const P = FIGHT.player;
const ROLL = P.roll;
const TURN_RATE = 16; // 걷는 쪽으로 몸을 돌리는 빠르기 (라디안/초). 조준할 때는 바로 돎
const STOP_BOOST = 1.5; // 멈추거나 방향을 바꿀 때 이만큼 더 빨리 (미끄러지지 않게)
const RECOIL_PUSH = 2.4; // 총 한 발 쏠 때마다 뒤로 밀리는 빠르기
const SHOT_SHAKE = 0.06; // 총 쏠 때 화면이 살짝 흔들리는 세기
const SHOT_KICK = 0.22; // 총 쏠 때 화면이 쏘는 반대쪽으로 '톡' 밀리는 거리 (view.kick 이 있을 때)
const HIT_SHAKE = 0.18; // 칼로 맞혔을 때 화면 흔들림
const ROLL_BUFFER = 0.15; // 구르기를 조금 일찍 눌러도 기억해 두는 시간 (초)
const ROLL_END_SPEED = 0.5; // 구르기 끝날 때 빠르기 비율 (부드럽게 이어 걷게)
const AUTO_AIM_RANGE = 40; // 자동 조준이 미친토끼를 찾는 거리
const AIM_ASSIST = 0.2; // 조준 스틱 방향에서 이 각도(라디안) 안의 미친토끼에게 총알을 살짝 모아 줌
const AIM_DEADZONE = 1.5; // 마우스가 내 토끼에 이보다 가까우면 방향을 바꾸지 않음
const AIM_HOLD = 0.6; // 쏜 뒤 이 시간 동안은 총을 겨눈 자세 유지
const BODY_PUSH = 0.5; // 미친토끼와 겹치면 이만큼씩 밀려남 (구를 때는 지나감)
const MOVE_EPS = 0.15; // 이보다 작은 스틱 입력은 '안 움직임'

export function createPlayer(scene, { collision = null, bullets, fx = null, debris, events, view = null, getEnemies = () => [], props = null }) {
  const models = { blaster: createWeaponModel('blaster'), sword: createWeaponModel('sword') };
  const weapons = createPlayerWeapons({ bullets, fx, events, getEnemies, props });
  const rig = createRabbitRig(scene, createRabbitModel('player'), {
    weapon: models[weapons.current] || null,
    scale: FIGHT.figureScale ?? 1,
    onLand: (position, strength) => fx?.dust?.(position, strength),
  });
  let shownWeapon = weapons.current;

  const body = createFighterBody({
    team: 'player',
    rig,
    maxHp: P.maxHp,
    radius: P.radius,
    debris,
    fx,
    events,
    view,
    hurtInvulnerable: P.hurtInvulnerable,
  });

  let rollTime = -1; // -1 = 안 구름
  let rollCooldown = 0;
  let rollBuffer = 0;
  const rollDir = { x: 0, z: 1 };
  let sinceFire = 99;
  let pushBack = 0; // 반동으로 뒤로 밀리는 빠르기 (다음 장면에 적용)
  let lunge = 0;
  let weaponFrame = null;

  const muzzle = new THREE.Vector3();
  const delta = { x: 0, z: 0 };
  const aimTarget = { x: 0, z: 0 };
  const kickDir = { x: 0, z: 0 };
  const pose = {
    position: body.position,
    facing: Math.PI,
    move: 0,
    aiming: false,
    roll: -1,
    swing: -1,
    swingSide: 1,
    windup: 0,
    recoil: 0,
    hurt: 0,
    stunned: false,
  };
  const idleFrame = { recoil: 0, swing: -1, swingSide: 1, hitStop: 0, lunge: 0, swingFacing: 0, fired: false, swung: false, hits: 0 };

  // 구르는 동안은 맞지 않음 (처음 ROLL.invulnerable 초)
  body.extraInvulnerable = () => rollTime >= 0 && rollTime < ROLL.invulnerable;

  function syncWeaponModel(force = false) {
    if (!force && shownWeapon === weapons.current) return;
    shownWeapon = weapons.current;
    rig.setWeapon(models[shownWeapon] || null);
  }

  // 가장 알맞은 미친토끼: 기준 방향에서 maxAngle 안, 가깝고 앞쪽이고 보이는 토끼일수록 좋음
  function pickEnemy(refAngle, maxAngle) {
    const enemies = getEnemies() || [];
    let best = null;
    let bestScore = Infinity;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e || !e.alive) continue;
      const dx = e.position.x - body.position.x;
      const dz = e.position.z - body.position.z;
      const d = Math.hypot(dx, dz);
      if (d > AUTO_AIM_RANGE) continue;
      const diff = d > 1e-6 ? Math.abs(wrapAngle(Math.atan2(dx, dz) - refAngle)) : 0;
      if (diff > maxAngle) continue;
      let score = d * (1 + (2 * diff) / Math.PI);
      if (collision && !collision.lineOfSight(body.position, e.position)) score *= 3;
      if (score < bestScore) {
        best = e;
        bestScore = score;
      }
    }
    return best;
  }

  function startRoll(mx, mz) {
    const length = Math.hypot(mx, mz);
    if (length > MOVE_EPS) {
      rollDir.x = mx / length;
      rollDir.z = mz / length;
    } else {
      rollDir.x = Math.sin(body.facing);
      rollDir.z = Math.cos(body.facing);
    }
    rollTime = 0;
    rollCooldown = ROLL.cooldown;
    rollBuffer = 0;
    body.facing = facingFromDir(rollDir.x, rollDir.z);
    weapons.cancelSwing();
    events.emit('roll', { position: body.position.clone() });
    fx?.dust?.(body.position, 1);
  }

  // 바라보는 쪽 정하기 → 총알을 모을 곳(target) 을 돌려줌 (없으면 null)
  function chooseFacing(dt, input, mx, mz, moving) {
    if (rollTime >= 0) {
      body.facing = facingFromDir(rollDir.x, rollDir.z);
      return null;
    }
    if (weapons.swinging) {
      body.facing = weapons.swingFacing; // 휘두르는 동안은 방향 고정
      return null;
    }
    const aimDir = input.aimDir;
    if (aimDir && Math.hypot(aimDir.x, aimDir.z) > 0.05) {
      body.facing = facingFromDir(aimDir.x, aimDir.z);
      const helped = pickEnemy(body.facing, AIM_ASSIST);
      return helped ? copyTarget(helped.position) : null;
    }
    const point = input.aimPoint;
    if (point && Math.hypot(point.x - body.position.x, point.z - body.position.z) > AIM_DEADZONE) {
      body.facing = facingFromDir(point.x - body.position.x, point.z - body.position.z);
      return copyTarget(point);
    }
    if (input.autoAim) {
      const ref = moving ? facingFromDir(mx, mz) : body.facing;
      const enemy = pickEnemy(ref, Math.PI / 2) || pickEnemy(ref, Math.PI);
      if (enemy) {
        body.facing = facingFromDir(enemy.position.x - body.position.x, enemy.position.z - body.position.z);
        return copyTarget(enemy.position);
      }
    }
    if (moving) body.facing = turnToward(body.facing, facingFromDir(mx, mz), TURN_RATE * dt);
    return null;
  }

  function copyTarget(point) {
    aimTarget.x = point.x;
    aimTarget.z = point.z;
    return aimTarget;
  }

  function move(dt, mx, mz) {
    const v = body.velocity;
    if (rollTime >= 0) {
      const k = Math.min(1, rollTime / ROLL.seconds);
      const speed = ROLL.speed * (1 - (1 - ROLL_END_SPEED) * k * k);
      v.x = rollDir.x * speed;
      v.z = rollDir.z * speed;
    } else {
      // 원하는 빠르기 쪽으로 accel 만큼씩 (멈출 때·꺾을 때는 더 빨리)
      const wantX = mx * P.speed;
      const wantZ = mz * P.speed;
      const dx = wantX - v.x;
      const dz = wantZ - v.z;
      const gap = Math.hypot(dx, dz);
      const braking = wantX * v.x + wantZ * v.z < v.x * v.x + v.z * v.z - 1e-6;
      const stepSize = P.accel * dt * (braking ? STOP_BOOST : 1);
      if (gap <= stepSize) {
        v.x = wantX;
        v.z = wantZ;
      } else {
        v.x += (dx / gap) * stepSize;
        v.z += (dz / gap) * stepSize;
      }
    }
    // 총 반동: 바라보는 반대쪽으로 살짝
    if (pushBack > 0) {
      v.x -= Math.sin(body.facing) * pushBack;
      v.z -= Math.cos(body.facing) * pushBack;
      pushBack = 0;
    }
    delta.x = v.x * dt + body.knockDelta.x;
    delta.z = v.z * dt + body.knockDelta.z;
    if (lunge > 0 && rollTime < 0) {
      delta.x += Math.sin(body.facing) * lunge * dt;
      delta.z += Math.cos(body.facing) * lunge * dt;
    }
    slide(delta);
    if (rollTime < 0) separate();
  }

  // 벽에 닿으면 미끄러지고, 벽 쪽으로 가던 빠르기는 없앰
  function slide(d) {
    if (!collision) {
      body.position.x += d.x;
      body.position.z += d.z;
      return;
    }
    const { normal } = collision.moveCircle(body.position, body.radius, d);
    if (normal) {
      const v = body.velocity;
      const into = v.x * normal.x + v.z * normal.z;
      if (into < 0) {
        v.x -= into * normal.x;
        v.z -= into * normal.z;
      }
    }
  }

  // 미친토끼와 겹치면 살짝 밀려남 (몸을 뚫고 지나가지 않게)
  function separate() {
    const enemies = getEnemies() || [];
    let px = 0;
    let pz = 0;
    for (let i = 0; i < enemies.length; i++) {
      const e = enemies[i];
      if (!e || !e.alive) continue;
      const dx = body.position.x - e.position.x;
      const dz = body.position.z - e.position.z;
      const d = Math.hypot(dx, dz);
      const overlap = body.radius + (e.radius || 0) - d;
      if (overlap <= 0) continue;
      if (d < 1e-4) {
        px += overlap * BODY_PUSH;
        continue;
      }
      px += (dx / d) * overlap * BODY_PUSH;
      pz += (dz / d) * overlap * BODY_PUSH;
    }
    if (px !== 0 || pz !== 0) {
      delta.x = px;
      delta.z = pz;
      slide(delta);
    }
  }

  function update(dt, input = {}) {
    if (!body.alive) {
      body.hitStop = 0;
      return idleFrame;
    }
    body.updateBody(dt);
    rollCooldown = Math.max(0, rollCooldown - dt);
    rollBuffer = Math.max(0, rollBuffer - dt);
    sinceFire += dt;

    // 무기 바꾸기·장전
    if (input.slot) weapons.switchTo(input.slot);
    if (input.switchPressed) weapons.cycle();
    if (input.reloadPressed) weapons.reload();
    syncWeaponModel();

    // 움직이려는 방향
    let mx = input.move?.x || 0;
    let mz = input.move?.z || 0;
    const length = Math.hypot(mx, mz);
    if (length > 1) {
      mx /= length;
      mz /= length;
    }
    const moving = length > MOVE_EPS;
    if (!moving) mx = mz = 0;

    // 구르기
    if (input.rollPressed) rollBuffer = ROLL_BUFFER;
    if (rollTime >= 0) {
      rollTime += dt;
      if (rollTime >= ROLL.seconds) rollTime = -1;
    }
    if (rollBuffer > 0 && rollTime < 0 && rollCooldown <= 0) startRoll(mx, mz);

    const target = chooseFacing(dt, input, mx, mz, moving);
    move(dt, mx, mz);

    // 몸짓
    const rolling = rollTime >= 0;
    const aimActive = !!(input.aimDir || input.aimPoint || input.fire);
    pose.facing = body.facing;
    pose.move = rolling ? 0 : Math.min(1, Math.hypot(body.velocity.x, body.velocity.z) / P.speed);
    pose.aiming = weapons.current === 'blaster' && !rolling && (aimActive || sinceFire < AIM_HOLD);
    pose.roll = rolling ? Math.min(1, rollTime / ROLL.seconds) : -1;
    pose.swing = weaponFrame ? weaponFrame.swing : -1;
    pose.swingSide = weaponFrame ? weaponFrame.swingSide : 1;
    pose.recoil = weaponFrame ? weaponFrame.recoil : 0;
    pose.hurt = body.hurt;
    rig.update(dt, pose);
    rig.muzzleWorld(muzzle);

    // 무기 (구르는 동안은 쏘지 않음)
    weaponFrame = weapons.update(dt, {
      holding: !rolling && !!input.fire,
      pressed: !rolling && !!input.firePressed,
      position: body.position,
      facing: body.facing,
      muzzle,
      target,
    });
    lunge = weaponFrame.lunge;
    if (weaponFrame.fired) {
      sinceFire = 0;
      pushBack += RECOIL_PUSH;
      view?.shake?.(SHOT_SHAKE);
      kickDir.x = Math.sin(body.facing);
      kickDir.z = Math.cos(body.facing);
      view?.kick?.(kickDir, SHOT_KICK);
    }
    if (weaponFrame.hits > 0) view?.shake?.(HIT_SHAKE);
    body.hitStop = weaponFrame.hitStop;
    return weaponFrame;
  }

  const resetBody = body.reset; // fighterBody 의 reset (아래에서 player.reset 으로 바꿔 끼움)
  function reset(x = FIGHT.map.playerSpawn[0], z = FIGHT.map.playerSpawn[1]) {
    resetBody(x, z);
    rig.reset?.();
    rig.setVisible?.(true);
    weapons.reset();
    syncWeaponModel(true);
    body.facing = Math.PI; // 화면 위쪽(미친토끼 쪽)을 바라봄
    rollTime = -1;
    rollCooldown = 0;
    rollBuffer = 0;
    sinceFire = 99;
    pushBack = 0;
    lunge = 0;
    weaponFrame = null;
    body.hitStop = 0;
    pose.facing = body.facing;
    pose.move = 0;
    pose.roll = -1;
    pose.swing = -1;
    pose.recoil = 0;
    pose.hurt = 0;
    rig.update(0, pose);
    rig.muzzleWorld(muzzle);
  }

  Object.assign(body, { kind: 'player', rig, weapons, muzzle, update, reset, hitStop: 0 });
  Object.defineProperties(body, {
    rolling: { get: () => rollTime >= 0, enumerable: true },
    rollReady: { get: () => (ROLL.cooldown > 0 ? 1 - rollCooldown / ROLL.cooldown : 1), enumerable: true },
  });
  reset();
  return body;
}
