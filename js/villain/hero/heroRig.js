// 영웅 몸짓 (달리기, 칼 휘두르기, 뛰어올라 내려찍기, 하늘에서 떨어지기, 착지, 움찔)
// hero.js 가 '지금 어떤 상태인지'를 숫자로 알려 주면, 여기서 팔·다리·망토 손잡이를 돌려 자세를 만듭니다.
//
//   const rig = createHeroRig(fig)        fig: voxelFigure 인형 (heroArt.js 설계도)
//   rig.pose({ time, run, runPhase, swing, swingSide, air, fall, crouch, cheer, hurt })
//       time: 흐른 시간(초), run: 달리는 정도 0~1, runPhase: 발 구르는 박자
//       swing: 칼 휘두르기 진행 0~1 (안 휘두르면 -1), swingSide: 휘두르는 방향 ±1
//       air: 뛰어오른 정도 -1(올라가는 중) ~ 1(내려찍는 중), 땅에 있으면 null
//       fall: 하늘에서 떨어지는 중이면 1, crouch: 착지해서 웅크린 정도 0~1
//       cheer: 칼을 번쩍 드는 정도 0~1, hurt: 맞아서 움찔한 정도 0~1
//
// 각도는 라디안입니다. 몸짓 크기는 아래 상수에서 바꿉니다.

const RUN_LEG = 0.95; // 달릴 때 다리를 젓는 각도
const RUN_LEAN = 0.22; // 달릴 때 앞으로 숙이는 각도
const GUARD_ARM = -0.75; // 평소 칼 든 팔 각도 (칼끝이 앞·위를 봄)
const SWING_TWIST = 1.25; // 칼을 휘두를 때 몸을 비트는 각도

const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);

export function createHeroRig(fig) {
  const P = fig.parts;
  const bodyY = P.body.position.y;

  function pose({ time = 0, run = 0, runPhase = 0, swing = -1, swingSide = 1, air = null, fall = 0, crouch = 0, cheer = 0, hurt = 0 } = {}) {
    for (const node of Object.values(P)) node.rotation.set(0, 0, 0);
    const stride = Math.sin(runPhase);
    const breathe = Math.sin(time * 3.2);

    // 다리·몸: 달리기
    P.legL.rotation.x = stride * RUN_LEG * run;
    P.legR.rotation.x = -stride * RUN_LEG * run;
    P.body.rotation.x = RUN_LEAN * run - hurt * 0.4;
    P.body.position.y = bodyY + breathe * 0.1 * (1 - run) - crouch * 1.3;
    P.head.rotation.x = -RUN_LEAN * 0.6 * run - hurt * 0.3 + breathe * 0.03;
    P.head.rotation.z = hurt * 0.25;

    // 팔: 방패 든 왼팔은 달릴 때 흔들고, 칼 든 오른팔은 앞으로 겨눔
    P.armL.rotation.x = -stride * 0.7 * run - 0.25;
    P.armL.rotation.z = -0.12;
    P.armR.rotation.x = GUARD_ARM + stride * 0.2 * run + breathe * 0.05;
    P.armR.rotation.z = 0.1;

    // 망토·깃털: 달리면 뒤로 펄럭
    P.cape.rotation.x = 0.12 + run * 0.75 + Math.sin(time * 9) * 0.1 * (0.3 + run) + hurt * 0.5;
    P.plume.rotation.x = -run * 0.25 + Math.sin(time * 7) * 0.06;

    // 칼 휘두르기: 뒤로 젖혔다가(준비) 반대쪽으로 크게 훑고(베기) 천천히 돌아옴
    if (swing >= 0) {
      let twist;
      let reach;
      if (swing < 0.3) {
        twist = -ease(swing / 0.3);
        reach = ease(swing / 0.3);
      } else if (swing < 0.55) {
        twist = lerp(-1, 1, ease((swing - 0.3) / 0.25));
        reach = 1;
      } else {
        twist = 1 - ease((swing - 0.55) / 0.45);
        reach = twist;
      }
      P.body.rotation.y = twist * SWING_TWIST * swingSide;
      P.armR.rotation.x = lerp(P.armR.rotation.x, -0.15, reach);
      P.armR.rotation.z = lerp(0.1, 1.35, reach); // 팔을 옆으로 쭉 뻗어 칼이 가로로 돌게
      P.armL.rotation.x = lerp(P.armL.rotation.x, 0.5, reach);
      P.cape.rotation.x += reach * 0.35;
    }

    // 뛰어올라 내려찍기: 올라갈 때 칼을 머리 뒤로, 내려올 때 앞으로 내려침
    if (air !== null) {
      const down = Math.max(0, air);
      const up = 1 - down;
      P.armR.rotation.x = lerp(-2.9, -0.55, ease(down));
      P.armR.rotation.z = 0.05;
      P.armL.rotation.x = lerp(-2.2, -0.4, down);
      P.legL.rotation.x = lerp(-1.0, 0.5, down);
      P.legR.rotation.x = lerp(0.7, -0.3, down);
      P.body.rotation.x = lerp(-0.3, 0.45, down);
      P.cape.rotation.x = 0.5 + up * 0.4 + down * 1.5;
    }

    // 하늘에서 떨어지는 중: 망토는 위로 펄럭, 칼은 머리 위로
    if (fall > 0) {
      P.cape.rotation.x = 2.3 + Math.sin(time * 30) * 0.15;
      P.armR.rotation.x = -2.6;
      P.armL.rotation.x = -0.9;
      P.armL.rotation.z = -0.6;
      P.legL.rotation.x = -0.5;
      P.legR.rotation.x = 0.35;
      P.body.rotation.x = 0.15;
      P.plume.rotation.x = -0.6;
    }

    // 착지: 한쪽 무릎을 굽히고 웅크렸다가 일어남
    if (crouch > 0) {
      P.legL.rotation.x = lerp(P.legL.rotation.x, -1.1, crouch);
      P.legR.rotation.x = lerp(P.legR.rotation.x, 0.9, crouch);
      P.body.rotation.x = lerp(P.body.rotation.x, 0.5, crouch);
      P.head.rotation.x = lerp(P.head.rotation.x, 0.25, crouch);
      P.armL.rotation.z = lerp(P.armL.rotation.z, -0.8, crouch);
      P.armR.rotation.x = lerp(P.armR.rotation.x, 0.2, crouch);
      P.armR.rotation.z = lerp(P.armR.rotation.z, 0.9, crouch);
      P.cape.rotation.x = lerp(P.cape.rotation.x, 1.1, crouch);
    }

    // 칼 번쩍 들기 (등장한 뒤, 이겼을 때)
    if (cheer > 0) {
      P.armR.rotation.x = lerp(P.armR.rotation.x, -2.25, cheer);
      P.armR.rotation.z = lerp(P.armR.rotation.z, 0.25, cheer);
      P.head.rotation.x = lerp(P.head.rotation.x, -0.2, cheer);
      P.body.rotation.x = lerp(P.body.rotation.x, -0.1, cheer);
    }
  }

  return { pose };
}
