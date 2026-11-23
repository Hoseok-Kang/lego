// 소굴 작은 시설 그림 (1×1 칸 = 블록 5×5 자리): 물감 창고, 금고, 감시탑, 함정 공방, 박쥐 동굴, 용암 웅덩이
// 단계(level 1~3)가 오를수록 더 높고 화려해집니다. 가운데 3×3(x·z 1~3)이 몸통, 둘레 한 줄은 장식만 조금.
// 칸 좌표: x 0~4 오른쪽, z 0~4 앞쪽(카메라 쪽), y 0 = 땅 바로 위 층.
//
//   SMALL_ART = { paint, vault, watchtower, traps, bats, lava }   각각 (level) → { shape, anims?, emitters?, top?, badge? }
//   (anims · emitters · top 의 뜻은 facilityArtBig.js 맨 위 설명과 같음)

import { C, createArtShape, pile } from './artShape.js';

// ── 물감 창고: 나무 창고 + 알록달록 물감 통 + 지붕에서 흘러내리는 물감 ──
function paint(level) {
  const s = createArtShape();
  const H = level >= 2 ? 2 : 1;
  s.box(1, 0, 1, 3, H, 3, C.caramel);
  s.box(2, 0, 3, 2, 1, 3, C.brown); // 문
  s.box(1, H + 1, 1, 3, H + 1, 3, C.magenta);
  s.set(2, H + 2, 2, C.magenta);
  // 지붕에서 흘러내린 물감 (앞면)
  s.set(1, H + 1, 4, C.red);
  s.set(1, H, 4, C.red);
  s.set(3, H + 1, 4, C.blue);
  s.set(3, H + 1, 0, C.yellow);
  if (H >= 2) s.set(3, H, 4, C.blue);
  // 물감 통 (앞 양옆)
  s.set(0, 0, 4, C.yellow);
  s.set(4, 0, 4, C.green);
  s.set(4, 0, 3, C.coral);
  const anims = [];
  let top = [2, H + 3, 2];
  if (level >= 2) {
    s.set(0, 0, 2, C.blue);
    s.set(0, 1, 2, C.red);
    s.set(4, 1, 4, C.lime);
    s.set(0, 0, 0, C.lavender);
  }
  if (level >= 3) {
    // 지붕 위 큰 물감 통 (무지개 물감이 넘침)
    s.walls(1, H + 2, 1, 3, H + 3, 3, C.white);
    s.set(2, H + 3, 2, C.coral);
    s.set(2, H + 2, 2, C.coral);
    s.set(1, H + 4, 3, C.red);
    s.set(2, H + 4, 3, C.yellow);
    s.set(3, H + 4, 3, C.blue);
    s.set(2, H + 1, 4, C.yellow);
    top = [2, H + 5, 1];
  }
  return { shape: s, anims, top };
}

// ── 금고: 두꺼운 쇠 금고 + 금 다이얼 + 동전 더미 ──
function vault(level) {
  const s = createArtShape();
  const H = level >= 2 ? 3 : 2;
  s.box(1, 0, 1, 3, H, 3, C.gray);
  for (const [x, z] of [[1, 1], [3, 1], [1, 3], [3, 3]]) s.box(x, 0, z, x, H, z, C.dark);
  s.box(1, 0, 3, 3, H, 3, C.dark); // 앞 문
  s.glow(2, Math.ceil(H / 2), 3, C.yellow); // 다이얼
  s.set(3, 1, 3, C.black); // 손잡이
  s.box(1, H + 1, 1, 3, H + 1, 3, C.gray); // 뚜껑
  s.set(2, H + 1, 2, C.black); // 동전 넣는 구멍
  s.set(0, 0, 4, C.yellow); // 동전
  s.set(1, 0, 4, C.tangerine);
  s.set(4, 0, 3, C.yellow);
  const emitters = [{ kind: 'spark', at: [2, H + 1.5, 3.5] }];
  let top = [2, H + 2, 2];
  if (level >= 2) {
    // 금괴 더미 (지붕 위) + 동전 더미 (양옆)
    s.box(1, H + 2, 1, 3, H + 2, 2, C.yellow);
    s.set(2, H + 3, 1, C.tangerine);
    pile(s, 0, 2, 0, 4, 0, [C.yellow, C.tangerine], 3);
    s.set(4, 0, 4, C.yellow);
    s.set(4, 1, 4, C.tangerine);
    top = [2, H + 3, 3];
  }
  if (level >= 3) {
    pile(s, 1, 1, 3, 3, H + 2, [C.yellow, C.tangerine, C.lightYellow], 7);
    s.glow(2, H + 4, 2, C.lightYellow);
    s.set(4, 0, 0, C.yellow);
    s.set(0, 0, 0, C.tangerine);
    top = [2, H + 5, 2];
  }
  return { shape: s, emitters, top };
}

// ── 감시탑: 좁고 높은 돌탑 + 꼭대기 큰 눈 (단계마다 한 층씩 더 높아짐) ──
function watchtower(level) {
  const s = createArtShape();
  const H = 3 + level; // 몸통 높이
  s.box(1, 0, 1, 3, 0, 3, C.black);
  s.walls(1, 1, 1, 3, H, 3, C.dark);
  for (const [x, z] of [[1, 1], [3, 1], [1, 3], [3, 3]]) s.box(x, 1, z, x, H, z, C.black);
  s.set(2, 1, 3, C.brown);
  s.glow(2, H - 1, 3, C.orange); // 작은 창
  // 꼭대기 방 (한 칸 넓게) + 큰 눈
  s.box(0, H + 1, 0, 4, H + 1, 4, C.purple);
  s.box(1, H + 2, 1, 3, H + 3, 3, C.purple);
  s.box(1, H + 2, 3, 3, H + 3, 3, C.white);
  s.glow(2, H + 2, 3, C.red);
  s.glow(2, H + 3, 3, C.red);
  s.box(1, H + 4, 1, 3, H + 4, 3, C.black);
  let top = [2, H + 5, 2];
  if (level >= 2) {
    // 뾰족 지붕
    s.set(2, H + 5, 2, C.magenta);
    s.set(2, H + 6, 2, C.lime, true);
    top = [1, H + 5, 1];
    for (const [x, z] of [[0, 0], [4, 0], [0, 4], [4, 4]]) s.set(x, H + 2, z, C.black);
  }
  const anims = [];
  if (level >= 3) {
    // 꼭대기를 빙빙 도는 박쥐 감시병
    const bat = createArtShape();
    bat.set(3, 0, 0, C.black);
    bat.set(2, 0, 0, C.magenta);
    bat.set(4, 0, 0, C.magenta);
    anims.push({ kind: 'orbit', pivot: [2, H + 6, 2], voxels: bat.voxels(), speed: 1.8, amount: 0.3 });
  }
  return { shape: s, anims, top };
}

// ── 함정 공방: 작은 공방 + 앞쪽 가시밭 + 지붕 위 빙글빙글 톱날 (3단계 흔들리는 도끼) ──
function traps(level) {
  const s = createArtShape();
  s.box(1, 0, 1, 3, 1, 3, C.brown);
  s.box(1, 0, 3, 1, 1, 3, C.caramel);
  s.box(3, 0, 3, 3, 1, 3, C.caramel);
  s.set(2, 0, 3, C.black);
  s.box(1, 2, 1, 3, 2, 3, C.dark);
  // 가시 (앞 줄)
  for (let x = 0; x <= 4; x += 2) s.set(x, 0, 4, C.gray);
  if (level >= 2) for (let x = 1; x <= 3; x += 2) s.set(x, 0, 4, C.white);
  const anims = [];
  // 톱날 (지붕 위 기둥에 달려 빙글빙글): 가운데 빨강, 팔 회색, 끝 이빨 흰색
  const saw = createArtShape();
  saw.set(0, 0, 0, C.red);
  for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) saw.set(a, b, 0, C.dark);
  for (const [a, b] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) saw.set(a, b, 0, C.white);
  if (level >= 2) for (const [a, b] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) saw.set(a, b, 0, C.gray);
  const sawY = level >= 2 ? 5 : 4;
  s.box(2, 3, 1, 2, sawY - 1, 1, C.black);
  anims.push({ kind: 'spin', axis: 'z', pivot: [2, sawY, 1], voxels: saw.voxels(), speed: 3.2 });
  let top = [3, 3, 1];
  if (level >= 2) {
    // 곰 덫 (옆)
    s.set(4, 0, 1, C.black);
    s.set(4, 1, 0, C.white);
    s.set(4, 1, 2, C.white);
    top = [1, 3, 1];
  }
  if (level >= 3) {
    // 흔들리는 도끼 (앞 기둥에 매달림)
    s.box(0, 1, 3, 0, 5, 3, C.black);
    s.box(0, 5, 3, 4, 5, 3, C.black);
    s.box(4, 1, 3, 4, 5, 3, C.black);
    const axe = createArtShape();
    axe.box(0, -2, 0, 0, -1, 0, C.brown);
    axe.box(-1, -4, 0, 1, -3, 0, C.gray);
    axe.set(0, -4, 0, C.white);
    anims.push({ kind: 'swing', axis: 'z', pivot: [2, 4.5, 3], voxels: axe.voxels(), speed: 2.4, amount: 0.55 });
    top = [2, 6, 3];
  }
  return { shape: s, anims, top };
}

// ── 박쥐 동굴: 울퉁불퉁 바위 언덕 + 어두운 굴 입구(빛나는 눈) + 빙빙 도는 박쥐 ──
function bats(level) {
  const s = createArtShape();
  const tall = level >= 3 ? 4 : level >= 2 ? 3 : 2;
  s.box(0, 0, 0, 4, 0, 3, C.black);
  s.box(1, 1, 0, 3, tall, 3, C.dark);
  for (const [x, y, z] of [[1, tall, 3], [3, 1, 0], [2, tall, 0], [1, 1, 2]]) s.set(x, y, z, C.gray);
  s.box(0, 1, 1, 0, Math.max(1, tall - 1), 2, C.black);
  s.box(4, 1, 1, 4, Math.max(1, tall - 1), 2, C.black);
  s.set(2, tall + 1, 1, C.dark);
  // 굴 입구 + 반짝 눈
  s.clear(2, 0, 3, 2, 1, 3);
  s.set(2, 0, 2, C.black);
  s.glow(2, 1, 2, C.lightYellow);
  s.set(1, 0, 4, C.dark);
  s.set(3, 0, 4, C.black);
  // 위에 자라난 버섯 (보라)
  s.set(3, tall + 1, 2, C.magenta);
  const anims = [];
  const count = level + 1;
  for (let i = 0; i < count; i++) {
    const bat = createArtShape();
    const radius = 2 + (i % 2);
    bat.set(radius, 0, 0, C.black);
    bat.set(radius, 0, -1, C.lavender);
    bat.set(radius, 0, 1, C.lavender);
    bat.glow(radius + 1, 0, 0, C.red); // 눈
    anims.push({ kind: 'orbit', pivot: [2, tall + 2 + (i % 2), 2], voxels: bat.voxels(), speed: 1.4 + i * 0.35, amount: 0.4, phase: i * 2.1 });
  }
  if (level >= 2) {
    s.box(0, 1, 0, 0, 2, 0, C.black); // 뾰족 바위
    s.set(4, 1, 3, C.dark);
  }
  if (level >= 3) {
    s.box(4, 1, 0, 4, 3, 0, C.black);
    s.glow(1, 2, 3, C.red);
    s.glow(3, 2, 3, C.red);
  }
  return { shape: s, anims, top: [2, tall + 2, 1] };
}

// ── 용암 웅덩이: 돌 테두리 안 끓는 용암 (3단계는 작은 화산) ──
function lava(level) {
  const s = createArtShape();
  const emitters = [{ kind: 'ember', at: [2, 1, 2] }];
  const anims = [];
  if (level < 3) {
    s.walls(0, 0, 0, 4, 0, 4, C.black);
    for (const [x, z] of [[0, 0], [4, 4], [0, 3], [3, 0]]) s.set(x, 1, z, C.dark);
    s.box(1, 0, 1, 3, 0, 3, C.orange, true);
    s.glow(2, 0, 2, C.lightYellow);
    s.glow(1, 0, 3, C.red);
    if (level >= 2) {
      for (const [x, z] of [[4, 0], [0, 4]]) s.box(x, 1, z, x, 2, z, C.black);
      s.set(4, 3, 0, C.dark);
      s.glow(3, 0, 1, C.lightYellow);
    }
    const bubble = createArtShape();
    bubble.set(0, 0, 0, C.tangerine, true);
    anims.push({ kind: 'bob', pivot: [1, 1, 2], voxels: bubble.voxels(), speed: 3.1, amount: 0.45 });
  } else {
    // 작은 화산
    s.box(0, 0, 0, 4, 0, 4, C.black);
    s.box(0, 1, 1, 4, 1, 3, C.dark);
    s.box(1, 1, 0, 3, 1, 4, C.dark);
    s.walls(1, 2, 1, 3, 3, 3, C.black);
    s.glow(2, 3, 2, C.orange);
    s.glow(2, 2, 2, C.orange);
    // 흘러내리는 용암 (앞)
    s.glow(2, 3, 3, C.orange);
    s.glow(2, 2, 3, C.red);
    s.glow(2, 1, 4, C.orange);
    s.glow(2, 0, 4, C.red);
    emitters.push({ kind: 'ember', at: [2, 4, 2] }, { kind: 'smoke', at: [2, 4.5, 2] });
  }
  return { shape: s, anims, emitters, top: level >= 3 ? [3, 4, 1] : [4, 2, 4], badge: level >= 2 };
}

export const SMALL_ART = { paint, vault, watchtower, traps, bats, lava };
