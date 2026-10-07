// 내 토끼 (움직이기, 조준, 점프, 무기 쓰기)
// 누르는 쪽으로 '휙' 빨리 출발하고 빨리 멈춥니다. 마우스·조준 스틱 쪽을 바라봅니다.
// 점프: 움직이던 쪽으로 깡충 (가만히 있으면 제자리에서 위로). 공중에 떠 있는 동안은 맞지 않고(총알은 발밑으로 지나감),
//       공중에서도 쏘고 휘두를 수 있음. 벽·나무는 넘지 못하고, 미친토끼 위로는 넘어감.
// 맞는 것·귀가 터지는 것·'펑'은 fighterBody.js 가 미친토끼와 똑같이 처리합니다.
//
//   const player = createPlayer(scene, { collision, bullets, fx, debris, events, view, getEnemies, props })
//       props 는 없어도 됨 (칼로 상자 부수기용, 없으면 bullets 가 가진 props 를 씀)
//   player            = fighter (team 'player', position, velocity, radius, facing, alive, takeDamage, heal …)
//   player.update(dt, input) → 무기 frame { hitStop, fired, swung, hits, … }   매 장면 한 번
//       input = { move:{x,z}, aimPoint, aimDir, fire, firePressed, autoAim, jumpPressed, switchPressed, slot, reloadPressed }
//       바라보는 쪽 정하기: aimDir > aimPoint > autoAim(가까운 미친토끼, 앞쪽을 조금 더 좋아함 — 뒤에 바짝 붙은 토끼도 쏨) > 걷는 쪽
//   player.reset(x?, z?)               처음 자리(없으면 FIGHT.map.playerSpawn)·체력·무기로 (다시 하기)
//   player.rig / player.weapons        블록 인형 몸짓 / 무기 (weapons.js)
//   player.jumping (참/거짓) / player.jumpProgress (0~1, 땅에 있으면 -1) / player.jumpReady (0~1, HUD 점프 고리)
//   player.altitude (지금 발이 땅에서 떠 있는 높이, 칸) / player.muzzle (총구 위치 Vector3)
//   player.hitStop                     이번 장면에 칼로 맞혀서 요청한 멈칫 시간 (초)
//
// 소식: jump { position } 뛰어오름, land { position } 땅에 내려옴
// 빠르기·점프 숫자는 fightConfig.js 의 player 에서 바꿉니다. 아래는 손맛(보이는 느낌) 숫자.

import * as THREE from '../../lib/three.js';
import { FIGHT } from '../fightConfig.js';
import { createFighterBody } from './fighterBody.js';
import { createPlayerWeapons } from './weapons.js';
import { facingFromDir, turnToward, wrapAngle } from './combatMath.js';
import { createRabbitRig } from '../render/rabbitRig.js';
import { jumpHeight } from '../render/rigMotion.js';
import { createRabbitModel } from '../art/rabbitArt.js';
import { createWeaponModel } from '../art/weaponArt.js';

const P = FIGHT.player;
const JUMP = P.jump;
const TURN_RATE = 16; // 걷는 쪽으로 몸을 돌리는 빠르기 (라디안/초). 조준할 때는 바로 돎
const STOP_BOOST = 1.5; // 멈추거나 방향을 바꿀 때 이만큼 더 빨리 (미끄러지지 않게)
const RECOIL_PUSH = 2.4; // 총 한 발 쏠 때마다 뒤로 밀리는 빠르기
const SHOT_SHAKE = 0.06; // 총 쏠 때 화면이 살짝 흔들리는 세기
const SHOT_KICK = 0.22; // 총 쏠 때 화면이 쏘는 반대쪽으로 '톡' 밀리는 거리 (view.kick 이 있을 때)
const HIT_SHAKE = 0.18; // 칼로 맞혔을 때 화면 흔들림
const JUMP_BUFFER = 0.15; // 점프를 조금 일찍 눌러도 기억해 두는 시간 (초)
const LAND_KEEP = 0.55; // 땅에 내려올 때 남는 빠르기 비율 (꾹 디디며 살짝 멈칫)
const TAKEOFF_DUST = 0.8; // 뛰어오를 때 발밑 먼지 크기
const LAND_DUST = 1.7; // 내려올 때 발밑 먼지 크기 (깡충 먼지보다 크게 '퍽')
const AIR_SHOT_HEIGHT = 5.2 * FIGHT.figureScale; // 공중에서 쏜 총알이 내려와 날아가는 높이 (땅에서 쏠 때 총구 높이쯤)
const AUTO_AIM_RANGE = 40; // 자동 조준이 미친토끼를 찾는 거리
const AIM_ASSIST = 0.2; // 조준 스틱 방향에서 이 각도(라디안) 안의 미친토끼에게 총알을 살짝 모아 줌
const AIM_DEADZONE = 1.5; // 마우스가 내 토끼에 이보다 가까우면 방향을 바꾸지 않음
const AIM_HOLD = 0.6; // 쏜 뒤 이 시간 동안은 총을 겨눈 자세 유지
const BODY_PUSH = 0.5; // 미친토끼와 겹치면 이만큼씩 밀려남 (점프하면 위로 넘어감)
const MOVE_EPS = 0.15; // 이보다 작은 스틱 입력은 '안 움직임'
const HURT_FLASH_HEX = '#FF698F'; // 내 토끼가 맞으면 코랄색으로 반짝 (하양은 내 털색이라 안 보이고, 하양 = 나 로 남게)

export function createPlayer(scene, { collision = null, bullets, fx = null, debris, events, view = null, getEnemies = () => [], props = null }) {
  const models = { blaster: createWeaponModel('blaster'), sword: createWeaponModel('sword') };
  const weapons = createPlayerWeapons({ bullets, fx, events, getEnemies, props });
  const rig = createRabbitRig(scene, createRabbitModel('player'), {
    weapon: models[weapons.current] || null,
    scale: FIGHT.figureScale ?? 1,
    hurtHex: HURT_FLASH_HEX,
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

  let jumpTime = -1; // -1 = 땅에 있음, 아니면 뛰어오른 뒤 지난 시간 (초)
  let jumpCooldown = 0; // 내려온 뒤 다시 뛸 수 있을 때까지 남은 시간
  let jumpBuffer = 0;
  let landTime = 99; // 내려온 뒤 지난 시간 (착지 눌림 몸짓)
  let altitude = 0;
  const jumpVel = { x: 0, z: 0 }; // 뛰어오를 때 정한 공중 빠르기
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
    jump: -1,
    altitude: 0,
    land: 0,
    swing: -1,
    swingSide: 1,
    windup: 0,
    recoil: 0,
    hurt: 0,
    stunned: false,
  };
  const idleFrame = { recoil: 0, swing: -1, swingSide: 1, hitStop: 0, lunge: 0, swingFacing: 0, fired: false, swung: false, hits: 0 };

  // 점프하는 동안(웅크림부터 내려올 때까지)은 맞지 않음
  body.extraInvulnerable = () => jumpTime >= 0;

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

  // 뛰어오르기: 움직이던 쪽으로 휙 (가만히 있으면 제자리에서 위로)
  function startJump(mx, mz) {
    const length = Math.hypot(mx, mz);
    jumpVel.x = length > MOVE_EPS ? (mx / length) * JUMP.speed : 0;
    jumpVel.z = length > MOVE_EPS ? (mz / length) * JUMP.speed : 0;
    jumpTime = 0;
    jumpBuffer = 0;
    landTime = 99;
    events.emit('jump', { position: body.position.clone() });
    fx?.dust?.(body.position, TAKEOFF_DUST);
  }

  // 땅에 내려옴: 꾹 디디며 빠르기가 줄고 먼지 '퍽', 이때부터 다시 뛸 때까지 기다림
  function land() {
    jumpTime = -1;
    jumpCooldown = JUMP.cooldown;
    landTime = 0;
    altitude = 0;
    body.velocity.x *= LAND_KEEP;
    body.velocity.z *= LAND_KEEP;
    events.emit('land', { position: body.position.clone() });
    fx?.dust?.(body.position, LAND_DUST);
  }

  // 바라보는 쪽 정하기 → 총알을 모을 곳(target) 을 돌려줌 (없으면 null)
  function chooseFacing(dt, input, mx, mz, moving) {
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
      // 모든 방향에서 고름: 점수가 앞쪽을 최대 3배까지 좋아해서, 멀리 앞에 있는 토끼보다 뒤에 바짝 붙은 토끼를 먼저 쏨
      const ref = moving ? facingFromDir(mx, mz) : body.facing;
      const enemy = pickEnemy(ref, Math.PI);
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
    if (jumpTime >= 0) {
      // 공중: 뛰어오를 때 정한 빠르기에 누르는 쪽을 조금 섞음 (airControl)
      const c = JUMP.airControl;
      v.x = jumpVel.x * (1 - c) + mx * JUMP.speed * c;
      v.z = jumpVel.z * (1 - c) + mz * JUMP.speed * c;
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
    // 칼 휘두를 때 앞으로 살짝 (공중에서는 점프 빠르기 그대로)
    if (lunge > 0 && jumpTime < 0) {
      delta.x += Math.sin(body.facing) * lunge * dt;
      delta.z += Math.cos(body.facing) * lunge * dt;
    }
    slide(delta); // 공중에서도 벽·나무·상자는 막음 (넘지 못함)
    if (jumpTime < 0) separate(); // 공중에서는 미친토끼 위로 지나감
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
    if (jumpTime < 0) jumpCooldown = Math.max(0, jumpCooldown - dt);
    jumpBuffer = Math.max(0, jumpBuffer - dt);
    landTime += dt;
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

    // 점프: 땅에 있고 기다림이 끝났으면 뛰어오름 → seconds 동안 포물선 → 내려옴
    if (input.jumpPressed) jumpBuffer = JUMP_BUFFER;
    if (jumpTime >= 0) {
      jumpTime += dt;
      if (jumpTime >= JUMP.seconds) land();
    }
    if (jumpBuffer > 0 && jumpTime < 0 && jumpCooldown <= 0) startJump(mx, mz);
    altitude = jumpTime >= 0 ? JUMP.height * jumpHeight(jumpTime / JUMP.seconds) : 0;

    const target = chooseFacing(dt, input, mx, mz, moving);
    move(dt, mx, mz);

    // 몸짓
    const jumping = jumpTime >= 0;
    const aimActive = !!(input.aimDir || input.aimPoint || input.fire);
    pose.facing = body.facing;
    pose.move = jumping ? 0 : Math.min(1, Math.hypot(body.velocity.x, body.velocity.z) / P.speed);
    pose.aiming = weapons.current === 'blaster' && (aimActive || sinceFire < AIM_HOLD);
    pose.jump = jumping ? Math.min(1, jumpTime / JUMP.seconds) : -1;
    pose.altitude = altitude;
    pose.land = landTime < JUMP.landingSquashSeconds ? 1 - landTime / JUMP.landingSquashSeconds : 0;
    pose.swing = weaponFrame ? weaponFrame.swing : -1;
    pose.swingSide = weaponFrame ? weaponFrame.swingSide : 1;
    pose.recoil = weaponFrame ? weaponFrame.recoil : 0;
    pose.hurt = body.hurt;
    rig.update(dt, pose);
    rig.muzzleWorld(muzzle);

    // 무기 (공중에서도 쏘고 휘두름. 공중에서 쏜 총알은 날아가며 땅에서 쏠 때 높이로 내려옴)
    weaponFrame = weapons.update(dt, {
      holding: !!input.fire,
      pressed: !!input.firePressed,
      position: body.position,
      facing: body.facing,
      muzzle,
      target,
      settleY: jumping ? AIR_SHOT_HEIGHT : null,
      lift: altitude, // 공중에서 휘두르면 칼 자국도 그 높이에
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
    jumpTime = -1;
    jumpCooldown = 0;
    jumpBuffer = 0;
    landTime = 99;
    altitude = 0;
    sinceFire = 99;
    pushBack = 0;
    lunge = 0;
    weaponFrame = null;
    body.hitStop = 0;
    pose.facing = body.facing;
    pose.move = 0;
    pose.jump = -1;
    pose.altitude = 0;
    pose.land = 0;
    pose.swing = -1;
    pose.recoil = 0;
    pose.hurt = 0;
    rig.update(0, pose);
    rig.muzzleWorld(muzzle);
  }

  Object.assign(body, { kind: 'player', rig, weapons, muzzle, update, reset, hitStop: 0 });
  Object.defineProperties(body, {
    jumping: { get: () => jumpTime >= 0, enumerable: true },
    jumpProgress: { get: () => (jumpTime >= 0 ? Math.min(1, jumpTime / JUMP.seconds) : -1), enumerable: true },
    jumpReady: { get: () => (jumpTime >= 0 ? 0 : JUMP.cooldown > 0 ? 1 - jumpCooldown / JUMP.cooldown : 1), enumerable: true },
    altitude: { get: () => altitude, enumerable: true },
  });
  reset();
  return body;
}
