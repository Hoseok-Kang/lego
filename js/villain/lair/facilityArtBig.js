// 소굴 큰 시설 그림 (2×2 칸 = 블록 10×10 자리): 악당 왕좌, 괴수 공장, 연구실, 훈련장, 악마 대장간
// 단계(level 1~3)가 오를수록 더 높고 화려해집니다. 가장자리 한 줄(x·z = 0, 9)은 되도록 비워 옆 시설과 틈을 둡니다.
// 칸 좌표: x 0~9 오른쪽, z 0~9 앞쪽(카메라 쪽), y 0 = 땅 바로 위 층.
//
//   BIG_ART = { throne, factory, lab, training, forge }   각각 (level) → { shape, anims?, emitters?, top?, badge? }
//       anims: 움직이는 조각 [{ kind: 'spin'|'bob'|'swing'|'orbit', pivot: [x,y,z], voxels, speed, axis?, amount? }]
//       emitters: 연기·불티 나오는 자리 [{ kind: 'smoke'|'ember'|'spark'|'bubble', at: [x,y,z] }]
//       top: 단계 깃발·왕관을 꽂을 자리 [x,y,z],  badge: false 면 깃발·왕관을 안 꽂음
//
// 모양을 바꾸려면 아래 함수 안의 s.box / s.set 줄을 고치면 됩니다. 색은 artShape.js 의 C 표에서만 고릅니다.

import { C, createArtShape, fire, crown } from './artShape.js';

// ── 악당 왕좌: 두 단 받침 + 붉은 카펫 + 뿔 달린 보라 의자 + 화로 ──
function throne(level) {
  const s = createArtShape();
  s.box(1, 0, 1, 8, 0, 8, C.black);
  s.box(2, 1, 1, 7, 1, 6, C.dark);
  s.box(4, 0, 7, 5, 0, 9, C.red); // 카펫 (앞 끝까지)
  s.box(4, 1, 5, 5, 1, 6, C.red);
  // 의자
  const backTop = level >= 2 ? 8 : 7;
  s.box(3, 2, 2, 6, 2, 4, C.purple);
  s.box(4, 3, 3, 5, 3, 4, C.magenta); // 방석
  s.box(3, 3, 2, 6, backTop, 2, C.purple);
  s.box(4, 4, 2, 5, backTop - 1, 2, C.magenta);
  s.glow(4, backTop - 2, 2, C.lime); // 끈적 보석
  s.glow(5, backTop - 2, 2, C.lime);
  for (const x of [3, 6]) {
    s.box(x, 3, 3, x, 3, 4, level >= 2 ? C.yellow : C.purple); // 팔걸이
    s.set(x, 4, 4, C.yellow);
    s.set(x, backTop + 1, 2, level >= 2 ? C.white : C.yellow); // 뿔
  }
  if (level >= 2) {
    s.set(3, backTop + 2, 2, C.white);
    s.set(6, backTop + 2, 2, C.white);
    s.set(2, backTop + 2, 2, C.white);
    s.set(7, backTop + 2, 2, C.white);
    s.box(3, 3, 2, 3, backTop, 2, C.yellow);
    s.box(6, 3, 2, 6, backTop, 2, C.yellow);
  }
  // 화로 (앞 두 귀퉁이, 3단계는 뒤에도)
  const braziers = level >= 3 ? [[1, 8], [8, 8], [1, 1], [8, 1]] : [[1, 8], [8, 8]];
  for (const [x, z] of braziers) {
    s.box(x, 1, z, x, 1 + (level >= 2 ? 2 : 1), z, C.black);
    s.set(x, level >= 2 ? 4 : 3, z, C.dark);
    fire(s, x, level >= 2 ? 5 : 4, z);
  }
  // 2단계: 뒤쪽 깃발 두 개
  if (level >= 2) {
    for (const [px, cx] of [[2, 3], [7, 6]]) {
      s.box(px, 2, 1, px, 9, 1, C.black);
      s.box(Math.min(px, cx), 9, 1, Math.max(px, cx), 9, 1, C.black);
      s.box(cx, 5, 1, cx, 8, 1, C.magenta);
      s.set(cx, 7, 1, C.lime);
    }
  }
  const anims = [];
  const emitters = [];
  if (level >= 3) {
    // 용암 도랑 (받침 양옆)
    s.box(1, 0, 2, 1, 0, 6, C.orange, true);
    s.box(8, 0, 2, 8, 0, 6, C.orange, true);
    // 의자 위에 둥둥 뜬 큰 왕관
    const c = createArtShape();
    crown(c, 0, 0, 0);
    c.set(-2, 0, 0, C.yellow);
    c.set(2, 0, 0, C.yellow);
    c.set(-2, 1, 0, C.yellow);
    c.set(2, 1, 0, C.yellow);
    anims.push({ kind: 'bob', pivot: [4.5, backTop + 4, 2], voxels: c.voxels(), speed: 2.2, amount: 0.35 });
    emitters.push({ kind: 'ember', at: [1, 1, 4] }, { kind: 'ember', at: [8, 1, 4] });
  }
  for (const [x, z] of braziers) emitters.push({ kind: 'ember', at: [x, level >= 2 ? 6 : 5, z] });
  return { shape: s, anims, emitters, badge: false };
}

// ── 괴수 공장: 톱니 지붕 공장 + 줄무늬 굴뚝(초록 연기) + 앞쪽 컨베이어 위 꼬마 괴수 ──
function factory(level) {
  const s = createArtShape();
  const H = level >= 2 ? 4 : 3;
  s.box(1, 0, 3, 7, 0, 8, C.black);
  s.walls(1, 1, 3, 7, H, 8, C.dark);
  for (const [x, z] of [[1, 3], [7, 3], [1, 8], [7, 8]]) s.box(x, 0, z, x, H, z, C.black);
  // 큰 문 (노랑·검정 줄무늬 틀) + 빛나는 창 띠
  s.box(3, 1, 8, 5, 2, 8, C.black);
  for (let x = 2; x <= 6; x++) s.set(x, 3, 8, x % 2 ? C.yellow : C.black);
  s.set(2, 1, 8, C.yellow);
  s.set(6, 1, 8, C.yellow);
  s.set(2, 2, 8, C.black);
  s.set(6, 2, 8, C.black);
  if (H >= 4) for (const x of [2, 4, 6]) s.glow(x, 4, 8, C.lime);
  for (const z of [5, 6]) {
    s.glow(1, 2, z, C.lime);
    s.glow(7, 2, z, C.lime);
  }
  // 톱니 지붕
  s.box(1, H + 1, 3, 7, H + 1, 8, C.purple);
  for (const z of [4, 7]) {
    s.box(1, H + 2, z - 1, 7, H + 2, z - 1, C.purple);
    s.box(1, H + 2, z, 7, H + 2, z, C.lavender);
  }
  // 굴뚝 (뒤 오른쪽)
  const chimneyTop = level >= 3 ? 11 : level >= 2 ? 10 : 8;
  s.box(6, 0, 1, 7, chimneyTop, 2, C.darkRed);
  for (let y = 3; y <= chimneyTop; y += 3) s.box(6, y, 1, 7, y, 2, C.white);
  s.walls(5, chimneyTop + 1, 0, 8, chimneyTop + 1, 3, C.black);
  const emitters = [{ kind: 'smoke', at: [6.5, chimneyTop + 1.5, 1.5] }];
  // 컨베이어 + 꼬마 괴수
  s.box(1, 0, 9, 8, 0, 9, C.black);
  for (let x = 1; x <= 8; x += 2) s.set(x, 0, 9, C.dark);
  s.box(6, 1, 9, 7, 2, 9, C.lime);
  s.set(6, 2, 9, C.black); // 눈
  s.set(7, 2, 9, C.white);
  s.set(8, 1, 9, C.green);
  const anims = [];
  if (level >= 2) {
    // 왼쪽 벽의 큰 톱니바퀴 (빙글빙글)
    const g = createArtShape();
    for (const [dy, dz] of [[-2, -1], [-2, 0], [-2, 1], [2, -1], [2, 0], [2, 1], [-1, -2], [0, -2], [1, -2], [-1, 2], [0, 2], [1, 2]]) {
      g.set(0, dy, dz, C.gray);
    }
    for (const [dy, dz] of [[-3, 0], [3, 0], [0, -3], [0, 3]]) g.set(0, dy, dz, C.yellow);
    g.set(0, 0, 0, C.yellow);
    anims.push({ kind: 'spin', axis: 'x', pivot: [0, 3, 5.5], voxels: g.voxels(), speed: 1.4 });
    // 두 번째 굴뚝 (작게)
    s.box(2, 0, 1, 3, 7, 2, C.dark);
    s.box(2, 5, 1, 3, 5, 2, C.yellow);
    s.walls(2, 8, 1, 3, 8, 2, C.black);
    emitters.push({ kind: 'smoke', at: [2.5, 8.5, 1.5] });
  }
  if (level >= 3) {
    // 지붕 위 끈적 통 (초록 빛이 출렁)
    s.walls(2, H + 3, 4, 5, H + 5, 7, C.sky);
    s.box(3, H + 3, 5, 4, H + 4, 6, C.lime, true);
    s.box(2, H + 6, 4, 5, H + 6, 7, C.dark);
    s.set(3, H + 5, 5, C.green, true);
    emitters.push({ kind: 'bubble', at: [3.5, H + 6.5, 5.5] });
  }
  return { shape: s, anims, emitters, top: [4, level >= 3 ? H + 7 : H + 3, 5] };
}

// ── 연구실: 라벤더 건물 + 유리 돔 + 번개 기둥(테슬라) + 빛나는 플라스크 ──
function lab(level) {
  const s = createArtShape();
  s.box(1, 0, 3, 8, 0, 8, C.dark);
  s.walls(1, 1, 3, 8, 3, 8, C.lavender);
  s.box(1, 4, 3, 8, 4, 8, C.purple);
  for (const [x, z] of [[1, 3], [8, 3], [1, 8], [8, 8]]) s.box(x, 1, z, x, 3, z, C.white);
  s.box(4, 1, 8, 5, 2, 8, C.black); // 문
  for (const x of [2, 7]) s.glow(x, 2, 8, C.teal); // 창
  s.glow(1, 2, 5, C.teal);
  s.glow(8, 2, 6, C.teal);
  // 유리 돔
  s.box(2, 5, 4, 7, 5, 7, C.sky);
  s.box(3, 6, 4, 6, 6, 7, C.sky);
  s.box(4, 7, 5, 5, 7, 6, C.sky);
  s.glow(4, 5, 5, C.lime);
  s.glow(5, 5, 6, C.lime);
  // 앞 탁자 위 플라스크
  s.box(1, 0, 9, 3, 0, 9, C.brown);
  s.glow(1, 1, 9, C.lime);
  s.glow(3, 1, 9, C.coral);
  s.set(1, 2, 9, C.white);
  s.set(3, 2, 9, C.white);
  const emitters = [{ kind: 'bubble', at: [1, 2.5, 9] }];
  // 번개 기둥 (뒤 왼쪽)
  const coil = (x, z, height) => {
    s.box(x, 0, z, x, height, z, C.black);
    for (let y = 2; y < height; y += 2) s.set(x, y, z, C.yellow);
    s.glow(x, height + 1, z, C.cyan);
    emitters.push({ kind: 'spark', at: [x, height + 1.5, z] });
  };
  coil(1, 1, level >= 3 ? 9 : 7);
  if (level >= 2) {
    coil(8, 1, level >= 3 ? 9 : 7);
    // 안테나 접시
    s.box(6, 5, 2, 6, 6, 2, C.gray);
    s.box(5, 7, 2, 7, 7, 2, C.white);
    s.set(6, 8, 2, C.red, true);
    s.box(6, 0, 9, 8, 0, 9, C.dark);
    s.glow(7, 1, 9, C.teal);
  }
  const anims = [];
  if (level >= 3) {
    // 돔 위 뇌 단지 (분홍 뇌가 둥둥)
    s.walls(3, 8, 4, 6, 10, 7, C.sky);
    s.box(3, 11, 4, 6, 11, 7, C.dark);
    const b = createArtShape();
    b.box(-1, 0, -1, 0, 1, 0, C.pink);
    b.set(-1, 1, 0, C.coral);
    b.set(0, 0, -1, C.pinkDark);
    anims.push({ kind: 'bob', pivot: [5, 9, 6], voxels: b.voxels(), speed: 1.6, amount: 0.25 });
  }
  return { shape: s, anims, emitters, top: [5, level >= 3 ? 12 : 8, 5] };
}

// ── 훈련장: 모래 마당 + 울타리 + 영웅 허수아비 + 아령 (2단계 매달린 샌드백, 3단계 뿔 달린 문) ──
function training(level) {
  const s = createArtShape();
  s.box(1, 0, 1, 8, 0, 8, C.sand);
  for (let i = 1; i <= 8; i++) {
    if (i % 2) s.set(i, 0, 1, C.tan);
    if (i % 3 === 0) s.set(i, 0, 5, C.darkSand);
  }
  // 울타리 기둥 + 가로대
  for (const [x, z] of [[1, 1], [8, 1], [1, 8], [8, 8]]) s.box(x, 1, z, x, 2, z, C.darkRed);
  s.box(1, 2, 2, 1, 2, 7, C.brown);
  s.box(8, 2, 2, 8, 2, 7, C.brown);
  s.box(2, 2, 8, 3, 2, 8, C.brown);
  s.box(6, 2, 8, 7, 2, 8, C.brown);
  // 영웅 허수아비 (파란 투구 + 과녁)
  const dummy = (x, z) => {
    s.box(x, 1, z, x, 2, z, C.caramel);
    s.box(x - 1, 2, z, x + 1, 2, z, C.caramel);
    s.set(x, 3, z, C.cream);
    s.set(x, 4, z, C.blue);
    s.set(x, 2, z + 1, C.red); // 과녁
  };
  dummy(3, 4);
  dummy(6, 4);
  // 아령
  s.box(3, 1, 7, 5, 1, 7, C.dark);
  s.set(3, 1, 7, C.black);
  s.set(5, 1, 7, C.black);
  const anims = [];
  let top = [5, 3, 2];
  if (level >= 2) {
    // 샌드백 틀 (오른쪽 뒤) + 흔들리는 샌드백
    s.box(6, 1, 2, 6, 6, 2, C.black);
    s.box(6, 6, 2, 8, 6, 2, C.black);
    const bag = createArtShape();
    bag.set(0, 0, 0, C.dark);
    bag.box(0, -3, 0, 0, -1, 0, C.red);
    bag.set(0, -2, 0, C.white);
    anims.push({ kind: 'swing', axis: 'z', pivot: [8, 5.5, 2], voxels: bag.voxels(), speed: 2.6, amount: 0.35 });
    // 오르기 벽 (왼쪽 뒤)
    s.box(2, 1, 2, 4, 4, 2, C.dark);
    for (const [x, y] of [[2, 2], [3, 3], [4, 2], [2, 4], [4, 4]]) s.set(x, y, 3, x === 3 ? C.lime : C.orange);
    top = [3, 5, 2];
  }
  if (level >= 3) {
    // 뿔 달린 큰 문 (뒤 가운데)
    s.box(2, 1, 1, 2, 7, 1, C.black);
    s.box(7, 1, 1, 7, 7, 1, C.black);
    s.box(2, 8, 1, 7, 8, 1, C.darkRed);
    s.box(3, 9, 1, 6, 9, 1, C.darkRed);
    for (const x of [1, 8]) s.box(x, 8, 1, x, 9, 1, C.white);
    s.set(0, 10, 1, C.white);
    s.set(9, 10, 1, C.white);
    s.glow(4, 7, 1, C.lime);
    s.glow(5, 7, 1, C.lime);
    s.box(4, 10, 1, 5, 10, 1, C.darkRed);
    top = [4, 11, 1];
    dummy(5, 6);
  }
  return { shape: s, anims, top };
}

// ── 악마 대장간: 용암 화덕 + 모루 + 쿵쿵 흔들리는 망치 (3단계는 뿔 달린 악마 얼굴 화덕) ──
function forge(level) {
  const s = createArtShape();
  s.box(1, 0, 1, 8, 0, 8, C.black);
  // 화덕 (뒤쪽): 검은 돌 + 빛나는 입
  const H = level >= 2 ? 5 : 4;
  s.box(2, 1, 1, 7, H, 3, C.dark);
  s.box(2, 1, 1, 2, H, 1, C.black);
  s.box(7, 1, 1, 7, H, 1, C.black);
  s.box(4, 1, 3, 5, 2, 3, C.orange, true);
  s.glow(4, 2, 3, C.lightYellow);
  s.box(3, H + 1, 1, 6, H + 1, 3, C.black);
  // 굴뚝
  const top = H + (level >= 3 ? 5 : 3);
  s.box(6, H + 1, 1, 7, top, 2, C.darkRed);
  s.walls(6, top + 1, 1, 7, top + 1, 2, C.black);
  const emitters = [{ kind: 'smoke', at: [6.5, top + 1.5, 1.5] }, { kind: 'ember', at: [4.5, 3, 4] }];
  // 용암 도랑 (화덕 앞)
  s.box(2, 0, 4, 7, 0, 4, C.orange, true);
  s.glow(3, 0, 4, C.lightYellow);
  // 모루
  s.box(4, 1, 6, 5, 1, 7, C.black);
  s.box(3, 2, 6, 6, 2, 7, C.dark);
  s.set(6, 2, 7, C.gray);
  // 쿵쿵 망치
  const hammer = createArtShape();
  hammer.box(0, 0, 0, 2, 0, 0, C.brown);
  hammer.box(3, -1, 0, 3, 1, 0, C.gray);
  hammer.set(3, 0, 1, C.gray);
  const anims = [{ kind: 'swing', axis: 'z', pivot: [2, 4, 6], voxels: hammer.voxels(), speed: 4, amount: 0.45 }];
  // 앞쪽 칼 거치대
  s.box(1, 1, 8, 1, 3, 8, C.brown);
  s.set(1, 4, 8, C.gray);
  s.box(8, 1, 8, 8, 2, 8, C.brown);
  if (level >= 2) {
    // 풀무 (옆) + 쌓인 쇳덩이
    s.box(8, 1, 3, 8, 2, 5, C.caramel);
    s.set(8, 3, 4, C.brown);
    s.box(1, 1, 5, 2, 1, 6, C.gray);
    s.set(1, 2, 5, C.dark);
  }
  if (level >= 3) {
    // 화덕이 악마 얼굴로: 뿔 + 빛나는 눈
    s.glow(3, H - 1, 3, C.red);
    s.glow(6, H - 1, 3, C.red);
    for (const x of [2, 7]) {
      s.set(x, H + 1, 2, C.white);
      s.set(x, H + 2, 2, C.white);
    }
    s.set(1, H + 3, 2, C.white);
    s.set(8, H + 3, 2, C.white);
    s.box(4, 1, 3, 5, 3, 3, C.orange, true);
    s.glow(4, 3, 3, C.lightYellow);
    emitters.push({ kind: 'ember', at: [4.5, H, 3.5] });
  }
  return { shape: s, anims, emitters, top: [4, H + 2, 2] };
}

export const BIG_ART = { throne, factory, lab, training, forge };
