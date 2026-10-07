// 토끼 뼈대 (모든 토끼가 같이 쓰는 부품 자리)
// 부품마다 '돌아가는 중심(pivot)'과 '지도를 놓는 곳(at)'을 정합니다. 모든 토끼가 이 자리를 같이 써서
// 움직임(깡충 뛰기, 귀 펄럭임, 팔 휘두르기)이 어느 토끼에게나 똑같이 맞습니다.
//
//   SKELETON[부품] = { pivot: [x,y,z], at: [x, 밑면 높이, z] }
//   rabbitParts({ head, body, ear, earR, arm, armR, foot, tail }, extra, moved) → parts 설계
//       ear  = 왼쪽 귀(L, +x) 지도. earR 를 따로 안 주면 ear 를 좌우로 뒤집어 오른쪽 귀로 씀 (arm 도 같음)
//            earR 를 따로 줄 때는 오른쪽 귀 자리 그대로 그림 (왼쪽 칸 = 바깥쪽, 오른쪽 칸 = 안쪽)
//       extra = { 부품: [{ at, layers, mirror }] }   그 부품에 붙는 장식 조각 (머리띠 매듭, 삐친 털 등)
//       moved = { 부품: { pivot, at } }              이 토끼만 자리를 옮길 부품 (덩치 큰 토끼의 팔·발)
//
// 자리 (블록 칸): 발 y 0 · 몸 y 1~4 · 머리 y 5~10 · 귀 y 11~17. 얼굴 = +z. 왼쪽(L) = +x
// 바꾸고 싶으면: 귀를 더 벌리려면 earL/earR 의 x, 귀를 앞뒤로 옮기려면 z 를 바꾸세요.

export const SKELETON = {
  body: { pivot: [0, 1, 0.5], at: [0, 1, 0.5] }, // 5×4 몸 (z -1 ~ 2)
  head: { pivot: [0, 5, 0], at: [0, 5, 0] }, // 7×6 머리 (z -3 ~ 2) + 앞으로 나온 주둥이 줄 (z 3)
  earL: { pivot: [1.5, 11, -1], at: [1.5, 11, -1] }, // 귀 뿌리 (머리 위)
  earR: { pivot: [-1.5, 11, -1], at: [-1.5, 11, -1] },
  armL: { pivot: [3, 5, 1], at: [3, 2, 1] }, // 어깨에서 매달린 팔 (y 2 ~ 4)
  armR: { pivot: [-3, 5, 1], at: [-3, 2, 1] },
  footL: { pivot: [1.5, 1, 1], at: [1.5, 0, 1] }, // 발 (z 0 ~ 2)
  footR: { pivot: [-1.5, 1, 1], at: [-1.5, 0, 1] },
  tail: { pivot: [0, 2.5, -1.5], at: [0, 1, -2.5] }, // 엉덩이 뒤 동그란 꼬리
};

// 무기 손잡이 블록 가운데가 오는 곳: 오른손(armR 맨 아래 블록)의 바깥 옆, 반 칸 앞
// 머리(가로 7칸) 밖으로 나와 있어야 위쪽(북쪽)을 겨눌 때도 무기가 커다란 머리에 가려지지 않습니다.
export const HAND_AT = [-4.5, 2.5, 1.5];

export function rabbitParts(maps, extra = {}, moved = {}) {
  const place = (name) => moved[name] ?? SKELETON[name];
  const piece = (name, layers, mirror = false) => ({ at: place(name).at, layers, mirror });
  const parts = {
    body: [piece('body', maps.body)],
    head: [piece('head', maps.head)],
    earL: [piece('earL', maps.ear)],
    earR: [maps.earR ? piece('earR', maps.earR) : piece('earR', maps.ear, true)],
    armL: [piece('armL', maps.arm)],
    armR: [maps.armR ? piece('armR', maps.armR) : piece('armR', maps.arm, true)],
    footL: [piece('footL', maps.foot)],
    footR: [piece('footR', maps.foot, true)],
    tail: [piece('tail', maps.tail)],
  };
  const result = {};
  for (const [name, pieces] of Object.entries(parts)) {
    result[name] = { pivot: place(name).pivot, pieces: [...pieces, ...(extra[name] ?? [])] };
  }
  return result;
}
