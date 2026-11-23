// ─────────────────────────────────────────────────────────────
// 악당 타이쿤: 게임 숫자 설정
// 이 파일의 숫자만 바꿔도 게임 느낌이 바뀝니다. (다른 파일은 건드리지 않아도 됩니다)
// 길이 단위는 '블록 한 칸' 입니다. 방향: 화면 위쪽 = -z, 아래쪽(카메라 쪽) = +z, 오른쪽 = +x
// ─────────────────────────────────────────────────────────────

// ── 영웅 세 명 (마을마다 지키는 영웅이 다름) ──
// 번개 기사 = 1단계 영웅 그대로. VILLAIN.hero 는 번개 기사와 같은 것 (옛 코드가 그대로 돌게)
const KNIGHT = {
  name: '번개 기사',
  hint: '칼이 빨라요. 멀리서 불을 뿜으면 유리해요',
  appearAtDestroyed: 0.55, // 마을이 이만큼(비율) 부서지면 출동
  appearLatestSeconds: 30, // 마을이 덜 부서졌어도 부수기 시작한 지 이 시간(초)이 지나면 출동 (판이 늘어지지 않게)
  alertSeconds: 2, // '영웅 출동!' 경보 뒤 나타날 때까지
  maxHp: 420,
  speed: 11,
  damage: 14, // 칼 한 번
  interval: 0.7,
  range: 3.2,
  leapEvery: 5, // 이 시간(초)마다 한 번 높이 뛰어올라 내려찍기
  leapDamage: 30,
  payForWin: 100, // 영웅을 이기면 받는 돈
};

// 얼음 마법사 (바닷가 마을): 멀찍이 서서 얼음을 던져 괴수를 느리게 하고, 가까이 오면 휙 사라져요
const ICE_MAGE = {
  name: '얼음 마법사',
  hint: '멀리서 얼음을 던져 느리게 해요. 돌진 뿔로 확 들이받으면 좋아요',
  appearAtDestroyed: 0.5,
  appearLatestSeconds: 28,
  alertSeconds: 2,
  maxHp: 380,
  speed: 9,
  damage: 12, // 얼음 화살 한 번
  interval: 1.3,
  range: 16, // 이만큼 떨어져서도 던짐
  keepDistance: 9, // 괴수와 이 거리를 지키려고 함
  slowMul: 0.6, // 얼음에 맞으면 괴수 빠르기가 이만큼으로
  slowSeconds: 1.6,
  blinkEvery: 4, // 괴수가 가까이 오면 이 시간(초)마다 한 번 순간 이동
  blinkDistance: 12,
  payForWin: 180,
  // (D) 마법사 움직임 숫자
  blinkGap: 3.8, // 괴수가 이만큼(칸)보다 가까이 오면 순간 이동
  tooFar: 14, // 괴수가 이보다 멀면 다가감
  boltSpeed: 24, // 얼음 화살 빠르기 (초당 칸)
  engage: 16, // 괴수가 이만큼 가까우면 건물 대신 마법사를 쫓아감
};

// 황금 수호자 (왕궁 성곽): 크고 느림. 방패를 들면 앞에서 오는 공격을 반 막고, 땅을 쾅 내려찍음 (미리 표시)
const GUARDIAN = {
  name: '황금 수호자',
  hint: '방패로 앞을 막아요. 멀리서 불을 뿜거나 크게 부수면 이겨요',
  appearAtDestroyed: 0.5,
  appearLatestSeconds: 32,
  alertSeconds: 2.5,
  maxHp: 900,
  speed: 6,
  damage: 26, // 철퇴 한 번
  interval: 1.4,
  range: 4,
  shieldEvery: 6, // 이 시간(초)마다 방패 들기
  shieldSeconds: 2.5,
  shieldBlock: 0.5, // 방패를 든 동안 앞에서 오는 피해를 이만큼 막음
  slamEvery: 7, // 땅 내려찍기 간격
  slamTelegraph: 1.0, // 내려찍기 전 바닥에 표시되는 시간
  slamDamage: 45,
  slamRadius: 7,
  payForWin: 300,
  // (D) 방패 깨기
  shieldBreak: 45, // 방패를 든 동안 한 방에 이만큼 넘게 맞으면 방패가 깨져 비틀거림 (돌진 뿔 60)
};

export const VILLAIN = {
  // 괴수 그리기 종이
  draw: {
    cols: 16, // 가로 칸 수
    rows: 16, // 세로 칸 수
    minBlocks: 30, // 이보다 적게 칠하면 괴수를 만들 수 없음
    // 고를 수 있는 색 (글자 = 저장할 때 쓰는 기호, js/bricks/brickColors.js 의 색만)
    palette: [
      { ch: 'G', hex: '#4B9F4A', name: '초록' },
      { ch: 'g', hex: '#BBE90B', name: '라임' },
      { ch: 'R', hex: '#C91A09', name: '빨강' },
      { ch: 'O', hex: '#FE8A18', name: '주황' },
      { ch: 'Y', hex: '#F2CD37', name: '노랑' },
      { ch: 'B', hex: '#0055BF', name: '파랑' },
      { ch: 'b', hex: '#9FC3E9', name: '하늘' },
      { ch: 'P', hex: '#3F3691', name: '보라' },
      { ch: 'p', hex: '#E4ADC8', name: '분홍' },
      { ch: 'N', hex: '#582A12', name: '밤색' },
      { ch: 'A', hex: '#A0A5A9', name: '회색' },
      { ch: 'K', hex: '#1B2A34', name: '검정' },
      { ch: 'W', hex: '#F4F4F4', name: '흰색' },
    ],
  },

  // 그림 → 괴수
  monster: {
    maxDepth: 5, // 가장 통통한 곳의 앞뒤 두께 (칸). 그림 가장자리는 1칸, 안쪽으로 갈수록 두꺼워짐
    costPerBlock: 0.5, // 그림 한 칸(블록)마다 드는 돈 (16×16 을 꽉 채우면 128)
    hpPerBlock: 3, // 그림 한 칸마다 체력
    baseSpeed: 9, // 가장 작은 괴수의 걷는 빠르기 (초당 칸)
    slowPerBlock: 0.005, // 그림 한 칸마다 느려지는 정도 → 빠르기 = baseSpeed / (1 + 칸 수 × 이 값)
    minSpeed: 4,
    buildSeconds: 2.2, // 블록이 촤르륵 쌓여 괴수가 되는 시간
    headbutt: { damage: 10, interval: 1.1, range: 2.5 }, // 부품이 없어도 쓰는 기본 공격 (몸통 박치기)
    // 큰 괴수일수록 건물을 더 잘 부숨: 건물에 주는 피해 × (base + 칸 수 × perBlock). 영웅에게 주는 피해는 그대로
    smashPower: { base: 0.35, perBlock: 0.009 }, // 30칸 → 0.6배, 130칸 → 1.5배, 256칸 → 2.65배
  },

  // 공격 부품 (상점에서 사서 괴수 그림에 붙임)
  parts: {
    slots: 2, // 괴수 한 마리에 붙일 수 있는 개수
    types: {
      claw: { name: '집게발', price: 0, cost: 15, damage: 16, interval: 0.9, range: 4, desc: '가까운 것을 세게 휘둘러 쳐요' },
      fireMouth: { name: '불 뿜는 입', price: 120, cost: 25, damage: 10, interval: 0.25, range: 14, burstSeconds: 1.6, restSeconds: 1.4, desc: '멀리까지 불을 뿜어요' },
      horn: { name: '돌진 뿔', price: 200, cost: 20, damage: 60, interval: 3.2, range: 16, dashSpeed: 30, desc: '멀리서 달려와 쿵 들이받아요' },
    },
  },

  // 마을 (1단계는 작은 마을 하나)
  town: {
    width: 64, // 바닥판 가로 칸
    depth: 44, // 바닥판 세로 칸
    groundColor: '#4B9F4A',
    name: '꼬마 마을',
    hpPerBlock: 0.8, // 건물 블록 하나를 떼어 내는 데 필요한 피해
    payPerBlock: 0.4, // 건물 블록 하나를 부술 때마다 버는 돈
    clearBonus: 150, // 영웅을 이기고 마을을 다 부수면 받는 보너스
    monsterStart: [-27, 4], // 괴수가 나타나는 자리 [x, z]
  },

  // 영웅 셋 (위쪽 KNIGHT · ICE_MAGE · GUARDIAN 에서 숫자를 바꿉니다)
  heroes: { knight: KNIGHT, iceMage: ICE_MAGE, guardian: GUARDIAN },
  hero: KNIGHT, // 옛 이름 (= heroes.knight). 1단계 코드가 이걸 씀

  // 습격 한 판의 박자
  raid: {
    cleanupSeconds: 15, // 영웅을 이긴 뒤 남은 마을을 마저 부술 수 있는 시간 (끝나면 남은 건물은 저절로 와르르)
  },

  // 돈
  economy: {
    startMoney: 150,
    minPay: 20, // 아무리 못 부숴도 받는 수고비 (돈이 0 이 되어 막히지 않게)
  },

  // 악당 소굴 (칸에 시설을 놓는 땅). 시설 표 = data/facilities.js, 계책 표 = data/schemes.js, 땅 크기 = data/ranks.js
  lair: {
    // 새로 시작할 때 소굴: 가운데 왕좌 + 바로 옆 괴수 공장 (x, y = 왼쪽 위 칸, y 가 클수록 카메라 쪽)
    startLayout: [
      { type: 'throne', x: 3, y: 3 },
      { type: 'factory', x: 1, y: 3 },
    ],
    sellRefund: 0.5, // 팔면 지금까지 쓴 돈(짓기 + 강화)의 이만큼을 돌려받음
    schemeLevelBonus: 0.25, // 계책을 받는 시설이 한 단계 오를 때마다 그 계책 효과 +25%
    schemeMaxInstances: 3, // 같은 계책은 시설 세 곳까지만 겹쳐 받음
    baseParts: ['claw'], // 연구실이 없어도 살 수 있는 부품
    heroDelayMax: 0.2, // 영웅 늦추기 효과의 끝 (마을 부서진 비율에 더하는 값)
    // 효과를 모두 더한 뒤 '1 + 합' 을 이 범위로 자름 [가장 작게, 가장 크게]
    clamp: {
      cost: [0.5, 1.5], // 출동 값
      hp: [0.5, 1.8], // 괴수 체력
      dmg: [0.5, 1.6], // 괴수 모든 공격
      partDmg: [0.5, 1.8], // 부품 공격
      smash: [0.5, 1.8], // 건물 부수는 힘
      pay: [0.5, 2], // 습격 수입
      notoriety: [0.5, 2.5], // 악명 얻는 양
      heroHp: [0.6, 1.5], // 영웅 체력 (작을수록 좋음)
    },
  },

  // 악명: 습격할 때마다 쌓이고, 쌓이면 악명 단계가 오름 (단계 표 = data/ranks.js)
  // 한 판에 얻는 악명 = 마을 기본 악명 × (이기면 win, 지면 lose + destroy × 부순 비율) × 악명 배수
  notoriety: {
    win: 1,
    lose: 0.4,
    destroy: 0.6,
    abortMul: 0.5, // 지는 중에 그만두면 이만큼만
    min: 1, // 아무리 못해도 이만큼은 얻음
    // 1단계 때부터 놀던 저장을 처음 열면 그동안의 습격만큼 악명을 선물 (단, capRank 단계 바로 앞까지만)
    veteranPerRaid: 8,
    veteranPerWin: 12,
    veteranCapRank: 2,
  },

  camera: { fov: 32, pitchDeg: 48 },
  debris: { capacity: 3000, rubbleCapacity: 2600, gravity: 52, lifeSeconds: 5, stack: true },
  speedOptions: [1, 2],
};
