// 토끼 몸짓 (귀엽고 통통 튀는 움직임)
// 블록 인형(voxelFigure.js) 위에 깡충 뛰기, 귀 출렁임, 숨쉬기, 무기 들기, 칼 휘두르기, 구르기,
// 공격 준비(웅크리며 빨갛게 떨기), 맞았을 때 반짝이며 뒤로 젖히기, 어지러워 비틀거리기를 입힙니다.
// 몸 전체 움직임은 이 파일, 귀·팔·무기·발·꼬리 자세는 rigLimbs.js 가 맡습니다.
//
//   const rig = createRabbitRig(scene, modelDef, { weapon: 무기설계도|null, scale = 1, onLand, hurtHex, flashMax = 1 })
//     onLand(위치, 세기)   깡충 뛰다 땅에 닿을 때마다 (예: fx.dust 연결, 없어도 됨)
//                          세기 = 깡충 세기(0~1) × scale (토끼 크기만큼 작아짐)
//     hurtHex             맞았을 때 반짝이는 색 (없으면 HURT_HEX)
//     flashMax            맞았을 때 반짝임 최대 세기 0~1 (작을수록 원래 색이 비쳐 보임)
//   rig.setWeapon(무기설계도|null)     손에 든 무기 바꾸기 (weaponArt.js 의 createWeaponModel 결과)
//   rig.update(dt, pose)              매 장면 한 번. pose = {
//       position (Vector3, 발밑), facing (바라보는 각도), move 0~1 (빠르기 비율), aiming (조준 중),
//       roll -1 | 0~1 (구르기 진행), swing -1 | 0~1 (칼 휘두르기 진행), swingSide ±1 (휘두르는 방향),
//       windup 0~1 (공격 준비), recoil 0~1 (총 반동), hurt 0~1 (맞은 직후), stunned (어지러움) }
//     windup 이 크다가 갑자기 0 이 되면 '내려치기/찌르기' 모션이 저절로 나옵니다.
//   rig.muzzleWorld(out) / rig.weaponTipWorld(out) / rig.handWorld(out)   총구·무기 끝·손의 세상 위치
//   rig.popBlocks(n) / rig.restoreBlocks(n) / rig.explode()              귀 블록 떼기·다시 붙이기·펑
//   rig.reset()                       블록 전부 다시 보이고 몸짓 처음으로 (다시 하기)
//   rig.setVisible(참/거짓) / rig.dispose()
//   rig.figure (블록 인형) / rig.popTotal (떨어질 수 있는 귀 블록 수) / rig.scale
//
// 얼마나 높이 뛰는지, 얼마나 눌리는지 같은 크기는 아래 상수에서 바꿉니다.

import * as THREE from '../../lib/three.js';
import { createVoxelFigure } from './voxelFigure.js';
import { createRigLimbs } from './rigLimbs.js';
import { createHop, approach, wrapAngle, clamp, easeInOutSine } from './rigMotion.js';

// 부위 연결: 귀는 머리에, 머리·팔·꼬리는 몸에 붙음 (발은 몸 밖에 따로)
const PARENTS = { earL: 'head', earR: 'head', head: 'body', armL: 'body', armR: 'body', tail: 'body' };

const HOP_HEIGHT = 0.9; // 깡충 뛰는 높이 (칸)
const LAND_SQUASH = 0.2; // 착지할 때 꾹 눌리는 정도
const AIR_STRETCH = 0.12; // 뛰어오를 때 길쭉해지는 정도
const HOP_TILT = 0.12; // 뛰는 동안 몸이 앞뒤로 까딱하는 각도
const BREATH = 0.022; // 가만히 있을 때 숨쉬기 크기
const ROLL_SHRINK = 0.84; // 구를 때 몸을 공처럼 오므리는 크기
const ROLL_LIFT = 2.2; // 구를 때 귀가 땅에 박히지 않게 살짝 띄우는 높이
const HURT_LEAN = 0.42; // 맞았을 때 뒤로 젖히는 각도
const WINDUP_CROUCH = 0.2; // 공격 준비할 때 웅크리는 정도
const WINDUP_SHAKE = 0.14; // 공격 준비할 때 덜덜 떠는 크기 (칸)
const RELEASE_SECONDS = 0.34; // 준비 뒤 내려치기/찌르기 모션 시간
const RUN_SPEED = 12; // 이 빠르기(초당 칸)면 귀가 가장 많이 뒤로 넘어감
const TELEPORT = 8; // 한 장면에 이보다 멀리 옮겨지면 순간이동으로 봄 (귀가 갑자기 휙 넘어가지 않게)
const HURT_HEX = '#F4F4F4'; // 맞았을 때 반짝이는 기본 색 (토끼마다 hurtHex 로 바꿀 수 있음)
const WINDUP_HEX = '#C91A09'; // 공격 준비할 때 물드는 색
const WINDUP_TINT = 0.35; // 공격 준비 때 빨갛게 물드는 기본 세기
const WINDUP_PULSE = 0.25; // 공격 준비 때 깜빡이며 더해지는 세기
const WINDUP_HURT_SHARE = 0.5; // 공격 준비 중에 맞으면 빨강이 (맞은 반짝임 × 이 비율)까지 잠깐 더 밝아짐

export function createRabbitRig(scene, modelDef, { weapon = null, scale = 1, onLand = null, hurtHex = HURT_HEX, flashMax = 1 } = {}) {
  const fig = createVoxelFigure(scene, modelDef, { scale, parents: PARENTS });
  const { parts, root } = fig;
  const hand = modelDef.hand || { part: 'armR', at: fig.pivots.armR || [0, 0, 0] };
  const handPart = parts[hand.part] ? hand.part : 'armR';
  const handLocal = new THREE.Vector3(
    hand.at[0] - fig.pivots[handPart][0],
    hand.at[1] - fig.pivots[handPart][1],
    hand.at[2] - fig.pivots[handPart][2],
  );
  const centerY = coreCenter(modelDef); // 구를 때 도는 중심 높이 (모델 좌표)
  for (const name of ['armL', 'armR', handPart]) if (parts[name]) parts[name].rotation.order = 'YXZ';

  const limbs = createRigLimbs(fig, handPart);
  const hop = createHop();
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  const pivotOffset = new THREE.Vector3();

  // 무기
  let weaponNode = null;
  let holdsGun = false; // 총구가 있는 무기를 들었는지 (총이면 조준 자세, 아니면 휘두르는 자세)
  const weaponMuzzle = new THREE.Vector3();
  const weaponTip = new THREE.Vector3();

  // 매 장면 바뀌는 상태 (새 물건을 만들지 않으려고 한 번만 만들어 씀)
  const s = {
    time: Math.random() * 100,
    hasPrev: false,
    prevX: 0,
    prevZ: 0,
    velX: 0,
    velZ: 0,
    prevFwd: 0,
    prevFacing: 0,
    facing: 0,
    yawRate: 0,
    prevHurt: 0,
    prevWindup: 0,
    release: 0,
    lean: 0,
  };
  const frame = {
    dt: 0, t: 0, move: 0, air: 0, speed: 0, accelFwd: 0, yawRate: 0, rolling: false, swinging: false,
    swing: 0, swingSide: 1, windup: 0, slamming: false, recoil: 0, hurt: 0, stunned: false, aiming: false, calm: true,
  };

  function setWeapon(def) {
    fig.removePart('weapon');
    weaponNode = null;
    holdsGun = false;
    if (def && def.voxels && def.voxels.length) {
      const grip = def.grip || [0, 0, 0];
      weaponNode = fig.addPart('weapon', def.voxels, { parent: handPart, pivot: grip, at: hand.at });
      const tip = def.tip || def.muzzle || grip;
      const muzzle = def.muzzle || tip;
      weaponMuzzle.set(muzzle[0] - grip[0], muzzle[1] - grip[1], muzzle[2] - grip[2]);
      weaponTip.set(tip[0] - grip[0], tip[1] - grip[1], tip[2] - grip[2]);
    }
    holdsGun = !!weaponNode && !!def.muzzle;
    limbs.setWeapon(weaponNode, holdsGun);
  }
  setWeapon(weapon);

  function update(dt, pose) {
    dt = Math.min(Math.max(dt, 0), 0.1);
    s.time += dt;
    const t = s.time;
    const position = pose.position;
    const facing = pose.facing ?? 0;
    const roll = pose.roll ?? -1;
    const rolling = roll >= 0;
    const swing = pose.swing ?? -1;
    const windup = clamp(pose.windup ?? 0, 0, 1);
    const recoil = clamp(pose.recoil ?? 0, 0, 1);
    const hurt = clamp(pose.hurt ?? 0, 0, 1);
    const stunned = !!pose.stunned && !rolling;
    const move = rolling || stunned ? 0 : clamp(pose.move ?? 0, 0, 1);

    // 빠르기·도는 빠르기 (귀가 따라 출렁이게)
    let accelFwd = 0;
    // 한 장면에 너무 멀리 옮겨졌으면(다시 시작·순간이동) 빠르기 계산을 새로 시작
    if (s.hasPrev && Math.abs(position.x - s.prevX) + Math.abs(position.z - s.prevZ) > TELEPORT) {
      s.hasPrev = false;
      s.velX = s.velZ = s.prevFwd = 0;
    }
    if (s.hasPrev && dt > 0) {
      s.velX = approach(s.velX, (position.x - s.prevX) / dt, 14, dt);
      s.velZ = approach(s.velZ, (position.z - s.prevZ) / dt, 14, dt);
      const fwd = s.velX * Math.sin(facing) + s.velZ * Math.cos(facing);
      accelFwd = (fwd - s.prevFwd) / dt;
      s.prevFwd = fwd;
      s.yawRate = approach(s.yawRate, clamp(wrapAngle(facing - s.prevFacing) / dt, -25, 25), 12, dt);
    }
    s.hasPrev = true;
    s.prevX = position.x;
    s.prevZ = position.z;
    s.prevFacing = facing;
    s.facing = facing;

    // 깡충 뛰기 + 출렁이는 순간들
    hop.step(dt, move);
    if (hop.landed) {
      limbs.kickLanding(hop.amp);
      onLand?.(position, hop.amp * scale);
    }
    if (hop.tookOff) limbs.kickTakeoff(hop.amp);
    if (hurt > s.prevHurt + 0.3) limbs.kickHurt();
    s.prevHurt = hurt;
    if (s.prevWindup > 0.4 && windup < s.prevWindup - 0.25) s.release = 1; // 준비 끝 → 내려치기
    s.prevWindup = windup;
    s.release = Math.max(0, s.release - dt / RELEASE_SECONDS);
    const release = s.release;

    // 팔다리에 넘겨줄 상태
    const f = frame;
    f.dt = dt;
    f.t = t;
    f.move = move;
    f.air = hop.air;
    f.speed = Math.min(1, Math.hypot(s.velX, s.velZ) / (RUN_SPEED * scale));
    f.accelFwd = accelFwd;
    f.yawRate = s.yawRate;
    f.rolling = rolling;
    f.swinging = swing >= 0 && !rolling;
    f.swing = swing;
    f.swingSide = pose.swingSide < 0 ? -1 : 1;
    f.windup = windup;
    f.slamming = release > 0.45;
    f.recoil = recoil;
    f.hurt = hurt;
    f.stunned = stunned;
    f.aiming = !!pose.aiming;
    f.calm = move < 0.05 && !rolling && !f.swinging && windup === 0 && !stunned && hurt === 0;
    const gun = holdsGun;

    // ── 뿌리: 위치·방향·눌림 ──
    let sy = 1 - LAND_SQUASH * hop.squash + AIR_STRETCH * hop.stretch;
    if (f.calm) sy += BREATH * Math.sin(t * 2.7);
    sy -= WINDUP_CROUCH * windup + 0.1 * hurt + 0.06 * recoil;
    if (release > 0) sy -= 0.16 * Math.sin(Math.PI * Math.min(1, (1 - release) * 2.2)) * (gun ? 0.3 : 1);
    if (stunned) sy -= 0.05;
    let uniform = scale;
    let pitch = HOP_TILT * hop.tilt + 0.07 * move;
    let yaw = facing;
    let rz = 0;
    let lift = HOP_HEIGHT * hop.height;
    let pivotY = 0;
    let jitterX = 0;
    let jitterZ = 0;

    if (rolling) {
      // 앞구르기: 몸 가운데를 중심으로 한 바퀴, 공처럼 오므림
      pitch = Math.PI * 2 * easeInOutSine(roll);
      uniform *= 1 - (1 - ROLL_SHRINK) * Math.sin(Math.PI * Math.min(1, roll * 1.4));
      lift = ROLL_LIFT * Math.sin(Math.PI * roll);
      pivotY = centerY;
      sy = 1;
    }
    s.lean = approach(s.lean, -HURT_LEAN * Math.pow(hurt, 0.7) - (gun ? 0.05 : 0.14) * windup - 0.07 * recoil, 22, dt);
    if (!rolling) pitch += s.lean;
    if (release > 0 && !gun) pitch += 0.32 * Math.sin(Math.PI * Math.min(1, (1 - release) * 1.6));
    if (f.swinging) pitch += 0.1 * Math.sin(Math.PI * swing);
    if (windup > 0) {
      jitterX = Math.sin(t * 83) * WINDUP_SHAKE * windup * scale;
      jitterZ = Math.cos(t * 71) * WINDUP_SHAKE * windup * scale;
    }
    if (stunned) {
      rz = Math.sin(t * 5.5) * 0.17;
      yaw += Math.sin(t * 3.1) * 0.25;
    }

    sy = Math.max(0.6, sy);
    const sxz = 1 / Math.sqrt(sy);
    euler.set(pitch, yaw, rz, 'YXZ');
    root.quaternion.setFromEuler(euler);
    root.scale.set(uniform * sxz, uniform * sy, uniform * sxz);
    // 구를 때는 몸 가운데를 중심으로 돌도록 위치를 보정
    pivotOffset.set(0, pivotY * uniform * sy, 0).applyQuaternion(root.quaternion);
    root.position.set(
      position.x + jitterX - pivotOffset.x,
      (position.y || 0) + (lift + pivotY) * scale - pivotOffset.y,
      position.z + jitterZ - pivotOffset.z,
    );

    limbs.update(f);

    // 반짝임: 공격 준비 중이면 빨갛게 깜빡, 아니면 맞았을 때 hurtHex 색으로 반짝
    // 공격 준비 빨강이 먼저 — 맞아도 가려지지 않게, 맞으면 빨강이 잠깐 더 밝아짐
    // 맞은 순간만 확 반짝 (제곱 → 빨리 빠짐: 총을 계속 맞아도 색과 귀가 보이게), flashMax 보다 세지 않게
    const hurtFlash = Math.min(flashMax, hurt * hurt * 1.15);
    if (windup > 0) {
      const pulse = 0.5 + 0.5 * Math.sin(t * 30);
      fig.setFlash(Math.max(hurtFlash * WINDUP_HURT_SHARE, windup * (WINDUP_TINT + WINDUP_PULSE * pulse)), WINDUP_HEX);
    } else if (hurtFlash > 0.02) fig.setFlash(hurtFlash, hurtHex);
    else fig.setFlash(0);

    fig.animate(dt);
    fig.update();
  }

  function reset() {
    fig.reset();
    hop.reset();
    limbs.reset();
    s.hasPrev = false;
    s.velX = s.velZ = s.prevFwd = s.yawRate = 0;
    s.release = s.prevWindup = s.prevHurt = s.lean = 0;
    fig.setFlash(0);
    fig.setVisible(true);
  }

  function handWorld(out) {
    return parts[handPart].localToWorld(out.copy(handLocal));
  }

  // 무기가 없을 때: 손에서 바라보는 쪽으로 조금 앞
  function forwardFromHand(out, distance) {
    handWorld(out);
    out.x += Math.sin(s.facing) * distance * scale;
    out.z += Math.cos(s.facing) * distance * scale;
    return out;
  }

  return {
    figure: fig,
    scale,
    popTotal: fig.popTotal,
    setWeapon,
    update,
    reset,
    popBlocks: (n) => fig.popBlocks(n),
    restoreBlocks: (n) => fig.restoreBlocks(n),
    explode: () => fig.explode(),
    setVisible: (value) => fig.setVisible(value),
    dispose: () => fig.dispose(),
    handWorld,
    muzzleWorld: (out) => (weaponNode ? weaponNode.localToWorld(out.copy(weaponMuzzle)) : forwardFromHand(out, 1.5)),
    weaponTipWorld: (out) => (weaponNode ? weaponNode.localToWorld(out.copy(weaponTip)) : forwardFromHand(out, 1)),
    get weaponNode() {
      return weaponNode;
    },
  };
}

// 구를 때 도는 중심 높이: 귀를 뺀 몸(발~머리) 가운데
function coreCenter(modelDef) {
  let min = Infinity;
  let max = -Infinity;
  for (const name of ['footL', 'footR', 'body', 'head']) {
    const part = modelDef.parts[name];
    if (!part) continue;
    for (const v of part.voxels) {
      min = Math.min(min, v.y - 0.5);
      max = Math.max(max, v.y + 0.5);
    }
  }
  return Number.isFinite(min) ? (min + max) / 2 : (modelDef.height || 16) * 0.35;
}
