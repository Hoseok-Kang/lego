// 황금 수호자 몸짓 (쿵쿵 걷기, 망치 내려치기, 방패 들기, 땅 내려찍기 준비·쾅, 비틀, 떨어지기, 착지, 승리 포즈)
// guardian.js 가 '지금 어떤 상태인지' 를 숫자로 알려 주면, 여기서 팔·다리·방패·망치 손잡이를 돌려 자세를 만듭니다.
//
//   const rig = createGuardianRig(fig)    fig: voxelFigure 인형 (guardianArt.js + 'hammer' 부위)
//   rig.pose({ time, run, runPhase, swing, guard, slam, impact, stagger, fall, crouch, cheer, hurt })
//       swing: 망치 내려치기 진행 0~1 (안 하면 -1),  guard: 방패를 앞으로 든 정도 0~1
//       slam: 땅 내려찍기 준비 0~1 (망치를 두 손으로 머리 위로) / 안 하면 -1,  impact: 쾅 한 뒤 웅크림 0~1
//       stagger: 방패가 깨져 비틀거림 0~1, fall / crouch / cheer / hurt: 다른 영웅과 같음
//
// 각도는 라디안입니다. 몸짓 크기는 아래 상수에서 바꿉니다.

const RUN_LEG = 0.6; // 걸을 때 다리를 젓는 각도 (무거워서 작게)
const STOMP_SWAY = 0.07; // 걸을 때 좌우로 기우뚱
const HAMMER_REST = -0.4; // 평소 망치 든 팔 각도
const SHIELD_FRONT = [0, 1.6, 4]; // 방패를 들었을 때 방패 손잡이 자리 (몸 손잡이 기준, 앞 가운데)
// 망치가 세상에서 기우는 각도 (0 = 똑바로 위, + = 앞으로, - = 뒤로). 팔이 어떻게 돌든 이 각도가 되게 맞춤
const HAMMER_TILT = { rest: -0.55, windup: -1.9, strike: 1.7, slam: -1.0, impact: 1.9, cheer: 0, fall: -0.3 };

const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);

export function createGuardianRig(fig) {
  const P = fig.parts;
  const bodyY = P.body.position.y;
  const shieldBase = P.shield.position.clone(); // 평소 자리 (몸 왼쪽)

  function pose({ time = 0, run = 0, runPhase = 0, swing = -1, guard = 0, slam = -1, impact = 0, stagger = 0, fall = 0, crouch = 0, cheer = 0, hurt = 0 } = {}) {
    for (const node of Object.values(P)) node.rotation.set(0, 0, 0);
    const stride = Math.sin(runPhase);
    const breathe = Math.sin(time * 2);

    // 다리·몸: 쿵쿵 무겁게
    P.legL.rotation.x = stride * RUN_LEG * run;
    P.legR.rotation.x = -stride * RUN_LEG * run;
    P.body.rotation.z = stride * STOMP_SWAY * run;
    P.body.rotation.x = 0.08 * run - hurt * 0.25 - stagger * 0.35;
    P.body.position.y = bodyY + breathe * 0.12 * (1 - run) - Math.abs(Math.cos(runPhase)) * 0.25 * run - crouch * 1.4 - impact * 1.2;
    P.head.rotation.x = -0.05 * run - hurt * 0.2 + breathe * 0.03 + stagger * 0.3;
    P.head.rotation.z = hurt * 0.15 + stagger * Math.sin(time * 14) * 0.2;
    P.crest.rotation.x = -run * 0.2 + Math.sin(time * 6) * 0.06;
    P.cape.rotation.x = 0.1 + run * 0.4 + Math.sin(time * 5) * 0.06 + hurt * 0.3;

    // 팔: 망치는 어깨에 걸치듯, 방패는 왼쪽 옆에 세워 둠
    P.armR.rotation.x = HAMMER_REST + stride * 0.15 * run;
    P.armR.rotation.z = 0.12;
    P.armL.rotation.x = -0.3 - stride * 0.2 * run;
    P.armL.rotation.z = -0.1;
    let tilt = HAMMER_TILT.rest;
    P.shield.position.copy(shieldBase);
    P.shield.rotation.y = -1.25; // 옆으로 세움
    P.shield.rotation.x = 0.05 * run;

    // 방패 들기: 방패가 앞 가운데로 와서 몸을 가림 (왼팔도 앞으로)
    if (guard > 0) {
      const g = ease(Math.min(1, guard));
      P.shield.position.set(lerp(shieldBase.x, SHIELD_FRONT[0], g), lerp(shieldBase.y, SHIELD_FRONT[1], g), lerp(shieldBase.z, SHIELD_FRONT[2], g));
      P.shield.rotation.y = lerp(-1.25, 0, g);
      P.armL.rotation.x = lerp(P.armL.rotation.x, -1.45, g);
      P.armL.rotation.y = lerp(0, 0.6, g);
      P.body.rotation.x += 0.12 * g;
      P.head.rotation.x += 0.1 * g;
    }

    // 망치 내려치기: 머리 위로 들었다가 → 앞으로 쾅 → 돌아옴
    if (swing >= 0) {
      let arm;
      if (swing < 0.45) {
        arm = lerp(HAMMER_REST, -2.9, ease(swing / 0.45));
        tilt = lerp(HAMMER_TILT.rest, HAMMER_TILT.windup, ease(swing / 0.45));
      } else if (swing < 0.6) {
        arm = lerp(-2.9, -0.6, ease((swing - 0.45) / 0.15));
        tilt = lerp(HAMMER_TILT.windup, HAMMER_TILT.strike, ease((swing - 0.45) / 0.15));
      } else {
        arm = lerp(-0.6, HAMMER_REST, ease((swing - 0.6) / 0.4));
        tilt = lerp(HAMMER_TILT.strike, HAMMER_TILT.rest, ease((swing - 0.6) / 0.4));
      }
      P.armR.rotation.x = arm;
      P.armR.rotation.z = 0.05;
      const lean = swing < 0.45 ? -0.12 * ease(swing / 0.45) : swing < 0.6 ? lerp(-0.12, 0.3, (swing - 0.45) / 0.15) : lerp(0.3, 0, (swing - 0.6) / 0.4);
      P.body.rotation.x += lean;
    }

    // 땅 내려찍기 준비: 두 손으로 망치를 머리 위로 번쩍 (부르르 떨며 힘 모음)
    if (slam >= 0) {
      const p = ease(Math.min(1, slam / 0.5));
      const shake = Math.sin(time * 40) * 0.04 * p;
      P.armR.rotation.x = lerp(HAMMER_REST, -3.0, p) + shake;
      P.armR.rotation.z = lerp(0.12, -0.35, p);
      P.armL.rotation.x = lerp(P.armL.rotation.x, -2.9, p) + shake;
      P.armL.rotation.z = lerp(-0.1, 0.35, p);
      P.body.rotation.x += -0.2 * p;
      P.legL.rotation.x = lerp(0, -0.25, p);
      P.legR.rotation.x = lerp(0, 0.25, p);
      tilt = lerp(HAMMER_TILT.rest, HAMMER_TILT.slam, p) + shake;
    }

    // 쾅! 한 뒤: 망치를 땅에 박고 웅크림
    if (impact > 0) {
      P.armR.rotation.x = lerp(P.armR.rotation.x, -0.9, impact);
      P.armR.rotation.z = lerp(P.armR.rotation.z, -0.3, impact);
      P.armL.rotation.x = lerp(P.armL.rotation.x, -0.9, impact);
      P.armL.rotation.z = lerp(P.armL.rotation.z, 0.3, impact);
      P.body.rotation.x += 0.4 * impact;
      P.legL.rotation.x = lerp(P.legL.rotation.x, -0.6, impact);
      P.legR.rotation.x = lerp(P.legR.rotation.x, 0.5, impact);
      tilt = lerp(tilt, HAMMER_TILT.impact, impact);
    }

    // 하늘에서 떨어지는 중: 망치를 머리 위로, 망토는 위로 펄럭
    if (fall > 0) {
      P.cape.rotation.x = 2.2 + Math.sin(time * 30) * 0.12;
      P.armR.rotation.x = -2.8;
      P.armL.rotation.x = -0.9;
      P.legL.rotation.x = -0.4;
      P.legR.rotation.x = 0.3;
      P.crest.rotation.x = -0.6;
      tilt = HAMMER_TILT.fall;
    }

    // 착지: 무릎 꿇듯 웅크렸다가 일어남
    if (crouch > 0) {
      P.legL.rotation.x = lerp(P.legL.rotation.x, -1.0, crouch);
      P.legR.rotation.x = lerp(P.legR.rotation.x, 0.8, crouch);
      P.body.rotation.x = lerp(P.body.rotation.x, 0.4, crouch);
      P.armR.rotation.x = lerp(P.armR.rotation.x, -0.2, crouch);
      P.armR.rotation.z = lerp(P.armR.rotation.z, 0.7, crouch);
      P.cape.rotation.x = lerp(P.cape.rotation.x, 0.9, crouch);
    }

    // 망치 번쩍 (등장한 뒤, 이겼을 때)
    if (cheer > 0) {
      P.armR.rotation.x = lerp(P.armR.rotation.x, -2.7, cheer);
      P.head.rotation.x = lerp(P.head.rotation.x, -0.2, cheer);
      tilt = lerp(tilt, HAMMER_TILT.cheer, cheer);
    }

    // 망치: 팔이 돌아간 만큼 되돌려서 세상에서 원하는 기울기가 되게
    if (P.hammer) P.hammer.rotation.x = tilt - P.armR.rotation.x - P.body.rotation.x;
  }

  return { pose };
}
