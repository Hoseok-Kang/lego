// 얼음 마법사 몸짓 (미끄러지듯 달리기, 지팡이 휘둘러 얼음 쏘기, 떨어지기, 착지, 움찔, 승리 포즈)
// iceMage.js 가 '지금 어떤 상태인지' 를 숫자로 알려 주면, 여기서 팔·모자·지팡이 손잡이를 돌려 자세를 만듭니다.
//
//   const rig = createIceMageRig(fig)      fig: voxelFigure 인형 (iceMageArt.js 설계도 + 'staff' 부위)
//   rig.pose({ time, run, runPhase, cast, fall, crouch, cheer, hurt })
//       run: 달리는 정도 0~1, runPhase: 발 박자, cast: 얼음 쏘기 진행 0~1 (안 쏘면 -1)
//       fall: 하늘에서 떨어지는 중이면 1, crouch: 웅크린 정도 0~1, cheer: 지팡이 번쩍 0~1, hurt: 움찔 0~1
//
// 각도는 라디안입니다. 몸짓 크기는 아래 상수에서 바꿉니다.

const RUN_LEAN = 0.2; // 달릴 때 앞으로 숙이는 각도
const ROBE_SWAY = 0.12; // 달릴 때 로브가 좌우로 흔들리는 각도
const STAFF_REST = -0.35; // 평소 지팡이 든 팔 각도
const CAST_RAISE = -2.7; // 얼음을 모을 때 지팡이를 드는 각도
const CAST_THRUST = -1.25; // 얼음을 쏠 때 지팡이를 내미는 각도
const CAST_FIRE_AT = 0.6; // 이 진행에서 지팡이를 앞으로 휙 (iceMage.js 의 발사 순간과 맞춤)

const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);

export const ICE_CAST_FIRE_AT = CAST_FIRE_AT;

export function createIceMageRig(fig) {
  const P = fig.parts;
  const bodyY = P.body.position.y;

  function pose({ time = 0, run = 0, runPhase = 0, cast = -1, fall = 0, crouch = 0, cheer = 0, hurt = 0 } = {}) {
    for (const node of Object.values(P)) node.rotation.set(0, 0, 0);
    const stride = Math.sin(runPhase);
    const breathe = Math.sin(time * 2.6);

    // 몸: 둥실둥실 숨쉬기, 달리면 앞으로 숙이고 로브가 살랑
    P.body.rotation.x = RUN_LEAN * run - hurt * 0.4;
    P.body.rotation.z = stride * ROBE_SWAY * run;
    P.body.position.y = bodyY + breathe * 0.12 * (1 - run) + Math.abs(stride) * 0.35 * run - crouch * 1.2;
    P.head.rotation.x = -RUN_LEAN * 0.5 * run - hurt * 0.3 + breathe * 0.04;
    P.head.rotation.z = hurt * 0.25;
    // 모자 끝이 살랑살랑 (달리면 뒤로)
    P.hat.rotation.x = -run * 0.3 + Math.sin(time * 5) * 0.05;
    P.hat.rotation.z = Math.sin(time * 3.3) * 0.08;

    // 팔: 지팡이 든 오른팔은 앞으로, 왼손은 주문 외우듯 살짝 들고 있음
    P.armR.rotation.x = STAFF_REST + stride * 0.15 * run;
    P.armR.rotation.z = 0.08;
    P.armL.rotation.x = -0.55 - stride * 0.4 * run + Math.sin(time * 4) * 0.08;
    P.armL.rotation.z = -0.25;

    // 얼음 쏘기: 지팡이를 머리 위로 들어 얼음을 모았다가 → 앞으로 휙 내밈 → 천천히 돌아옴
    if (cast >= 0) {
      if (cast < CAST_FIRE_AT) {
        const p = ease(cast / CAST_FIRE_AT);
        P.armR.rotation.x = lerp(STAFF_REST, CAST_RAISE, p);
        P.armL.rotation.x = lerp(P.armL.rotation.x, -2.2, p);
        P.armL.rotation.z = lerp(-0.25, -0.5, p);
        P.body.rotation.x = lerp(P.body.rotation.x, -0.18, p);
        P.hat.rotation.x += 0.15 * p;
      } else if (cast < CAST_FIRE_AT + 0.15) {
        const p = ease((cast - CAST_FIRE_AT) / 0.15);
        P.armR.rotation.x = lerp(CAST_RAISE, CAST_THRUST, p);
        P.armL.rotation.x = lerp(-2.2, -1.4, p);
        P.body.rotation.x = lerp(-0.18, 0.25, p);
      } else {
        const p = ease((cast - CAST_FIRE_AT - 0.15) / (1 - CAST_FIRE_AT - 0.15));
        P.armR.rotation.x = lerp(CAST_THRUST, STAFF_REST, p);
        P.armL.rotation.x = lerp(-1.4, -0.55, p);
        P.body.rotation.x = lerp(0.25, 0, p);
      }
    }

    // 하늘에서 떨어지는 중: 두 팔을 번쩍, 모자는 위로 펄럭
    if (fall > 0) {
      P.armR.rotation.x = -2.6;
      P.armL.rotation.x = -2.4;
      P.armL.rotation.z = -0.4;
      P.hat.rotation.x = -0.5 + Math.sin(time * 30) * 0.12;
      P.body.rotation.x = 0.1;
    }

    // 착지: 웅크렸다가 일어남
    if (crouch > 0) {
      P.body.rotation.x = lerp(P.body.rotation.x, 0.45, crouch);
      P.head.rotation.x = lerp(P.head.rotation.x, 0.2, crouch);
      P.armL.rotation.x = lerp(P.armL.rotation.x, 0.3, crouch);
      P.armL.rotation.z = lerp(P.armL.rotation.z, -0.9, crouch);
      P.armR.rotation.x = lerp(P.armR.rotation.x, 0.1, crouch);
      P.armR.rotation.z = lerp(P.armR.rotation.z, 0.7, crouch);
    }

    // 지팡이 번쩍 들기 (등장한 뒤, 이겼을 때)
    if (cheer > 0) {
      P.armR.rotation.x = lerp(P.armR.rotation.x, -2.8, cheer);
      P.armL.rotation.x = lerp(P.armL.rotation.x, -2.0, cheer);
      P.head.rotation.x = lerp(P.head.rotation.x, -0.2, cheer);
    }
  }

  return { pose };
}
