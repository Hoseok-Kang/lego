// 토끼 팔다리 자세 (rabbitRig.js 가 씀)
// 몸 전체의 움직임(깡충·점프·젖히기)은 rabbitRig.js 가 정하고,
// 이 파일은 귀·머리·팔·무기·발·꼬리를 그 순간 상태에 맞게 움직입니다.
//
//   const limbs = createRigLimbs(fig, handPart)
//   limbs.setWeapon(무기 손잡이 노드|null, 총인지)      무기가 바뀌면 알려 줌
//   limbs.kickLanding(세기) / limbs.kickTakeoff(세기) / limbs.kickHurt()   귀·고개가 출렁이는 순간
//   limbs.update(frame)    frame: rabbitRig.js 가 매 장면 채워 주는 상태 (아래 update 참고)
//   limbs.reset()
//
// 각도 단위는 라디안. 귀가 얼마나 출렁이는지, 칼을 얼마나 크게 휘두르는지는 아래 상수에서 바꿉니다.

import { createSpring, approach, clamp, easeOutCubic } from './rigMotion.js';

const EAR_STIFF = 150; // 귀 용수철 단단함 (작을수록 흐물흐물)
const EAR_DAMP = 7; // 귀 출렁임이 멈추는 힘 (작을수록 오래 출렁임)
const EAR_LIMIT = 1.25; // 귀가 꺾일 수 있는 최대 각도
const EAR_SPEED_BACK = 0.38; // 달릴 때 귀가 뒤로 넘어가는 각도
const EAR_TURN = 0.045; // 몸을 돌릴 때 귀가 따라 휘는 정도
const EAR_LAND_KICK = 4.2; // 착지할 때 귀가 앞으로 털썩하는 세기
const EAR_LAND_SPLAY = 2.6; // 착지할 때 귀가 옆으로 벌어지는 세기
const SWING_HALF = 1.45; // 칼 휘두르는 반쪽 각도 (양쪽으로 이만큼)
const MELEE_REST_TILT = 0.55; // 칼·망치를 들고 있을 때 끝이 위로 들린 각도
const RECOIL_PUSH = 0.9; // 총 반동으로 무기가 뒤로 밀리는 거리 (칸)
const EAR_JUMP_BACK = 1.15; // 점프로 솟아오를 때 귀가 뒤로 날리는 각도
const EAR_JUMP_FLOP = 0.3; // 점프 꼭대기부터 귀가 위로 붕 떠서 살짝 앞으로 넘어오는 각도 (크게 털썩은 착지 때)
const EAR_APEX_KICK = 2.5; // 점프 꼭대기에서 귀가 앞으로 휙 넘어가는 세기
const FOOT_TUCK = 1.1; // 점프 중 발을 몸 쪽으로 쏙 접는 높이 (칸)
const FEET = ['footL', 'footR'];

export function createRigLimbs(fig, handPart) {
  const { parts } = fig;
  const sideOf = (name) => Math.sign(fig.pivots[name]?.[0] || (name.endsWith('L') ? 1 : -1)) || 1;
  const ears = ['earL', 'earR']
    .filter((name) => parts[name])
    .map((name, i) => ({
      node: parts[name],
      side: sideOf(name),
      pitch: createSpring(EAR_STIFF * (i ? 0.9 : 1), EAR_DAMP, EAR_LIMIT),
      splay: createSpring(EAR_STIFF * 0.8, EAR_DAMP, EAR_LIMIT * 0.7),
    }));
  const nod = createSpring(120, 9, 0.8);
  const restFootY = {};
  for (const name of FEET) if (parts[name]) restFootY[name] = parts[name].position.y;
  const armR = parts[handPart] || null;
  const armRSide = sideOf(handPart);
  const armL = handPart !== 'armL' ? parts.armL || null : null;
  const armLSide = sideOf('armL');

  let weaponNode = null;
  let gun = false;
  const weaponRest = { x: 0, y: 0, z: 0 };
  const s = {
    armX: 0,
    armY: 0,
    armZ: 0,
    weaponX: -MELEE_REST_TILT,
    armLX: 0,
    armLZ: 0,
    twist: 0,
    twitch: 1 + Math.random() * 2,
    tiltTimer: 2 + Math.random() * 3,
    tiltTarget: 0,
    tilt: 0,
    prevRise: 0,
  };

  function setWeapon(node, isGun) {
    weaponNode = node;
    gun = !!isGun;
    if (node) {
      weaponRest.x = node.position.x;
      weaponRest.y = node.position.y;
      weaponRest.z = node.position.z;
    }
    s.weaponX = gun ? -s.armX : -s.armX - MELEE_REST_TILT;
  }

  function kickLanding(amount) {
    for (let i = 0; i < ears.length; i++) {
      ears[i].pitch.kick(EAR_LAND_KICK * amount);
      ears[i].splay.kick(EAR_LAND_SPLAY * amount);
    }
    nod.kick(2.4 * amount);
  }

  function kickTakeoff(amount) {
    for (let i = 0; i < ears.length; i++) ears[i].pitch.kick(-EAR_LAND_KICK * 0.6 * amount);
  }

  function kickHurt() {
    for (let i = 0; i < ears.length; i++) {
      ears[i].pitch.kick(-9);
      ears[i].splay.kick(5);
    }
    nod.kick(-5);
  }

  // frame = { dt, t, move, air, speed, accelFwd, yawRate, jumping, rise, crouch, land, swinging, swing, swingSide,
  //           windup, slamming, recoil, hurt, stunned, aiming, calm }
  //   jumping 점프 중, jumpAir 발이 땅에서 떨어짐, rise 1(막 솟음) → 0(꼭대기) → -1(내려오기 직전),
  //   crouch 0~1 뛰기 직전 웅크림, land 1→0 착지 직후
  function update(f) {
    const { dt, t } = f;
    idleFidget(f);

    // ── 귀: 용수철로 출렁, 달리면 뒤로, 화나면 납작, 어지러우면 축 처짐 ──
    let earPitch = -EAR_SPEED_BACK * f.speed - 0.75 * f.windup - 0.3 * f.hurt;
    let earSplay = 0.1 + 0.12 * f.windup;
    if (f.jumpAir) {
      // 점프: 솟아오를 때는 바람에 뒤로 쭉, 꼭대기부터는 위로 붕 떠서 앞으로 넘어옴 (양옆으로 살짝 벌어짐)
      earPitch = f.rise > 0 ? -0.2 - EAR_JUMP_BACK * f.rise : EAR_JUMP_FLOP * Math.sqrt(-f.rise);
      earSplay = f.rise > 0 ? 0.04 : 0.1 + 0.3 * -f.rise;
      if (s.prevRise > 0 && f.rise <= 0) {
        for (let i = 0; i < ears.length; i++) ears[i].pitch.kick(EAR_APEX_KICK);
      }
    }
    s.prevRise = f.jumpAir ? f.rise : 0;
    if (f.stunned) {
      earPitch = 0.35;
      earSplay = 0.85;
    }
    earPitch -= clamp(f.accelFwd * 0.006, -0.45, 0.45);
    const turn = clamp(f.yawRate * EAR_TURN, -0.5, 0.5);
    for (let i = 0; i < ears.length; i++) {
      const ear = ears[i];
      ear.pitch.step(dt, earPitch + ear.side * turn);
      ear.splay.step(dt, earSplay + (f.stunned ? 0.15 * Math.sin(t * 4 + ear.side) : 0));
      ear.node.rotation.x = ear.pitch.x;
      ear.node.rotation.z = -ear.side * ear.splay.x;
    }

    // ── 머리: 착지할 때 끄덕, 가만히 있으면 갸웃, 어지러우면 빙글 ──
    let headTarget = f.calm ? 0.025 * Math.sin(t * 2.7 + 0.6) : 0;
    if (f.jumping) headTarget = (f.rise > 0 ? -0.2 * f.rise : -0.12 * f.rise) + 0.25 * f.crouch; // 오를 때 위를, 내려올 때 땅을 봄
    headTarget += 0.14 * f.windup;
    nod.step(dt, headTarget);
    if (parts.head) {
      parts.head.rotation.x = nod.x + (f.stunned ? Math.cos(t * 4.4) * 0.12 : 0);
      parts.head.rotation.z = s.tilt + (f.stunned ? Math.sin(t * 4.4) * 0.22 : 0);
      parts.head.rotation.y = f.calm ? Math.sin(t * 0.9) * 0.08 : 0;
    }

    poseWeaponArm(f);
    poseOtherLimbs(f);
  }

  // 가만히 있을 때: 가끔 귀 쫑긋, 고개 갸웃
  function idleFidget(f) {
    s.twitch -= f.dt;
    if (s.twitch <= 0) {
      s.twitch = 1.2 + Math.random() * 2.8;
      if (f.calm && ears.length) {
        const ear = ears[Math.floor(Math.random() * ears.length)];
        ear.pitch.kick(Math.random() < 0.5 ? 6 : -6);
        ear.splay.kick(3);
      }
    }
    s.tiltTimer -= f.dt;
    if (s.tiltTimer <= 0) {
      s.tiltTarget = s.tiltTarget === 0 && f.calm ? (Math.random() < 0.5 ? -1 : 1) * 0.16 : 0;
      s.tiltTimer = s.tiltTarget ? 0.9 + Math.random() * 0.5 : 2.2 + Math.random() * 3;
    }
    s.tilt = approach(s.tilt, f.calm ? s.tiltTarget : 0, 7, f.dt);
  }

  // 오른팔 + 무기: 무기는 늘 바라보는 쪽을 향하게 팔 각도를 되돌려 줌
  function poseWeaponArm(f) {
    const { dt, t } = f;
    let armX = gun ? (f.aiming ? -0.95 : -0.4) : -0.3;
    let armY = 0;
    let armZ = 0;
    let weaponX = gun ? -armX : -armX - MELEE_REST_TILT;
    let twist = 0;
    let rate = 12;
    if (f.swinging) {
      // 칼 휘두르기: 살짝 뒤로 뺐다가 반대쪽까지 휙 (몸통도 함께 비틀기)
      const e = f.swing < 0.12 ? -0.06 * (f.swing / 0.12) : easeOutCubic((f.swing - 0.12) / 0.88);
      const angle = f.swingSide * SWING_HALF * (2 * e - 1);
      armX = -1.25;
      armY = angle * 0.65;
      twist = angle * 0.35;
      weaponX = 1.25;
      rate = 70;
    } else if (f.slamming && !gun) {
      // 준비 끝 → 앞으로 쾅 (망치·칼)
      armX = -1.0;
      weaponX = 1.4;
      rate = 45;
    } else if (f.windup > 0) {
      if (gun) {
        armX = -1.05;
        weaponX = 1.05;
      } else {
        // 무기를 머리 위로 번쩍
        const k = Math.min(1, f.windup * 2.2);
        armX = -0.3 - 2.5 * k;
        weaponX = -armX - MELEE_REST_TILT - 1.65 * k;
      }
      rate = 18;
    } else if (f.jumping && !f.aiming) {
      // 점프: 무기 든 팔도 살짝 옆으로 벌림 (조준 중이면 겨눈 그대로 — 공중에서도 쏨)
      armX = gun ? -0.55 : -0.7;
      armZ = 0.4 * (1 - f.crouch);
      weaponX = gun ? -armX : -armX - MELEE_REST_TILT;
      rate = 18;
    } else if (f.stunned) {
      armX = 0.15;
      armZ = 0.15 * Math.sin(t * 5);
      weaponX = 0.35;
    } else if (!f.aiming && !gun) {
      armX -= 0.25 * f.air;
    }
    armX += 0.22 * f.recoil;
    s.armX = approach(s.armX, armX, rate, dt);
    s.armY = approach(s.armY, armY, f.swinging ? rate : 9, dt);
    s.armZ = approach(s.armZ, armZ, rate, dt);
    s.twist = approach(s.twist, twist, f.swinging ? rate : 9, dt);
    s.weaponX = approach(s.weaponX, weaponX - 0.5 * f.recoil, rate, dt);
    if (armR) armR.rotation.set(s.armX, s.armY, -armRSide * s.armZ);
    if (parts.body) parts.body.rotation.y = s.twist;
    if (weaponNode) {
      weaponNode.rotation.x = s.weaponX;
      // 반동: 무기가 자기 방향 뒤로 쑥
      const push = f.recoil * RECOIL_PUSH;
      weaponNode.position.set(weaponRest.x, weaponRest.y + Math.sin(s.weaponX) * push, weaponRest.z - Math.cos(s.weaponX) * push);
    }
  }

  function poseOtherLimbs(f) {
    const { dt, t } = f;
    // 왼팔: 뛸 때 파닥, 총 조준할 때 받쳐 줌, 점프할 때 옆으로 활짝
    let armLX = -0.15 - 0.45 * f.air;
    let armLZ = 0.12 + 0.5 * f.air;
    if (gun && f.aiming) {
      armLX = -1.0;
      armLZ = -0.3;
    }
    if (f.jumping) {
      armLX = -0.45 - 0.35 * f.crouch;
      armLZ = (0.7 + 0.2 * Math.max(0, -f.rise)) * (1 - f.crouch);
    }
    if (f.windup > 0 && !gun) armLZ = 0.55 * f.windup;
    if (f.stunned) {
      armLX = 0.1;
      armLZ = 0.25 + 0.18 * Math.sin(t * 5 + 1);
    }
    s.armLX = approach(s.armLX, armLX, 16, dt);
    s.armLZ = approach(s.armLZ, armLZ, 16, dt);
    if (armL) armL.rotation.set(s.armLX, 0, armLSide * s.armLZ);

    // 발: 공중에서 뒤로 쏙, 점프할 때는 차고 올라 → 쏙 접었다 → 땅을 향해 내밂, 어지러우면 비틀
    for (let i = 0; i < FEET.length; i++) {
      const foot = parts[FEET[i]];
      if (!foot) continue;
      let fx = 0.75 * f.air;
      let fy = 0.3 * f.air;
      if (f.jumpAir) {
        const g = (1 - f.rise) / 2; // 0 막 솟음 → 1 땅에 닿기 직전
        fx = 0.9 - 1.25 * g;
        fy = FOOT_TUCK * (1 - f.rise * f.rise);
      } else if (f.jumping) {
        fx = 0; // 웅크리는 동안은 발바닥을 땅에 꾹
        fy = 0;
      }
      if (f.stunned) fx = 0.2 * Math.sin(t * 6 + i * Math.PI);
      foot.rotation.x = approach(foot.rotation.x, fx, 25, dt);
      foot.position.y = approach(foot.position.y, restFootY[FEET[i]] + fy, 25, dt);
    }

    // 꼬리: 살랑살랑 (점프 중에는 공중에서 신나게)
    if (parts.tail) {
      const air = f.jumping ? 1 : f.air;
      parts.tail.rotation.y = Math.sin(t * 15) * 0.35 * Math.max(f.move, air) + Math.sin(t * 2.1) * 0.1;
      parts.tail.rotation.x = -0.35 * air;
    }
  }

  function reset() {
    for (let i = 0; i < ears.length; i++) {
      ears[i].pitch.reset();
      ears[i].splay.reset();
    }
    nod.reset();
    s.twist = s.armY = s.armZ = s.tilt = s.tiltTarget = s.prevRise = 0;
  }

  return { setWeapon, kickLanding, kickTakeoff, kickHurt, update, reset };
}
