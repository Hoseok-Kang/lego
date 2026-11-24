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
  appearAtDestroyed: 0.3, // 마을이 이만큼(비율) 부서지면 출동 (주인 요청: 영웅은 20~30% 부쉈을 때. 시골 마을 30%)
  appearLatestSeconds: 30, // 마을이 덜 부서졌어도 부수기 시작한 지 이 시간(초)이 지나면 출동 (판이 늘어지지 않게)
  alertSeconds: 2, // '영웅 출동!' 경보 뒤 나타날 때까지
  maxHp: 380, // (3단계 조정: 420 → 380 — 영웅이 30% 에 일찍 오니, 처음 두 판쯤 지고 소굴을 조금 키우면 이기게)
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
  appearAtDestroyed: 0.25, // 항구는 25% 부서지면 출동
  appearLatestSeconds: 28,
  alertSeconds: 2,
  maxHp: 650, // (D 조정: 380 → 320, E 조정: → 650 — 소굴 효과를 받은 괴수와 맞추려고)
  speed: 6.5, // (D 조정: 9 → 6.5, 빠른 괴수가 따라잡을 수 있게)
  damage: 22, // 얼음 화살 한 번 (D 조정: 12 → 14, E 조정: → 22)
  interval: 1.2, // (D 조정: 1.3 → 1.4, E 조정: → 1.2)
  range: 16, // 이만큼 떨어져서도 던짐
  keepDistance: 9, // 괴수와 이 거리를 지키려고 함
  slowMul: 0.6, // 얼음에 맞으면 괴수 빠르기가 이만큼으로
  slowSeconds: 1.2, // (D 조정: 1.6 → 1.2)
  blinkEvery: 5.5, // 괴수가 가까이 오면 이 시간(초)마다 한 번 순간 이동 (D 조정: 4 → 5.5)
  blinkDistance: 12,
  payForWin: 180,
  // (D) 마법사 움직임 숫자
  blinkGap: 3.8, // 괴수가 이만큼(칸)보다 가까이 오면 순간 이동
  tooFar: 14, // 괴수가 이보다 멀면 다가감
  boltSpeed: 18, // 얼음 화살 빠르기 (초당 칸)
  engage: 16, // 괴수가 이만큼 가까우면 건물 대신 마법사를 쫓아감
};

// 황금 수호자 (왕궁 성곽): 크고 느림. 방패를 들면 앞에서 오는 공격을 반 막고, 땅을 쾅 내려찍음 (미리 표시)
const GUARDIAN = {
  name: '황금 수호자',
  hint: '방패로 앞을 막아요. 멀리서 불을 뿜거나 크게 부수면 이겨요',
  appearAtDestroyed: 0.2, // 왕궁 성곽은 20% 부서지면 출동 (큰 마을일수록 영웅이 빨리 옴)
  appearLatestSeconds: 32,
  alertSeconds: 2.5,
  maxHp: 1700, // (E 조정: 900 → 1700 — 소굴을 잘 지어야 이길 수 있게)
  speed: 6,
  damage: 32, // 철퇴 한 번 (E 조정: 26 → 32)
  interval: 1.4,
  range: 4,
  shieldEvery: 6, // 이 시간(초)마다 방패 들기
  shieldSeconds: 2.5,
  shieldBlock: 0.5, // 방패를 든 동안 앞에서 오는 피해를 이만큼 막음
  slamEvery: 7, // 땅 내려찍기 간격
  slamTelegraph: 1.0, // 내려찍기 전 바닥에 표시되는 시간
  slamDamage: 55, // (E 조정: 45 → 55)
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
    maxThickness: 7, // (S) 두께 붓으로 정할 수 있는 가장 두꺼운 두께 (칸). 1 = 종이처럼 납작
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
    // (S) 두께 붓: 두께를 정한 칸은 '칸 수' 대신 (정한 두께 ÷ 자동 두께) 칸으로 셈 → 값 · 체력 · 빠르기 · 부수는 힘에 그대로 들어감
    //     얇게 = 싸고 약하고 빠름, 두껍게 = 비싸고 튼튼하고 느림. 한 칸이 이 범위 밖으로 나가지 않게 자름
    thickness: { minWeight: 0.4, maxWeight: 2.2 },
  },

  // 공격 부품 (상점에서 사서 괴수 그림에 붙임)
  parts: {
    slots: 2, // 괴수 한 마리에 붙일 수 있는 개수 (기본. 연구실 3단계 · 악명 단계 덤으로 늘어남 → lair/modifiers.js 의 partSlots)
    maxSlots: 4, // 아무리 늘어도 이만큼까지 (그림에 저장되는 부품 수의 끝)
    types: {
      claw: { name: '집게발', price: 0, cost: 15, damage: 16, interval: 0.9, range: 4, desc: '가까운 것을 세게 휘둘러 쳐요' },
      fireMouth: { name: '불 뿜는 입', price: 120, cost: 25, damage: 10, interval: 0.25, range: 14, burstSeconds: 1.6, restSeconds: 1.4, desc: '멀리까지 불을 뿜어요' },
      horn: { name: '돌진 뿔', price: 200, cost: 20, damage: 60, interval: 3.2, range: 16, dashSpeed: 30, desc: '멀리서 달려와 쿵 들이받아요' },
      // (P) 꼬리 철퇴: 빙글 한 바퀴 돌며 range 안의 모든 것(건물·영웅)을 치고 영웅을 knockback 칸만큼 밀쳐 냄. 둘러싸였을 때 좋음
      //     knockMul: 영웅마다 밀려나는 배율 (무거운 황금 수호자는 덜 밀림, 멀리 서는 얼음 마법사는 너무 멀어지지 않게)
      //     (P 조정: 시험 습격 결과 피해 22 → 30, 간격 2.4 → 2.2, 거리 5.5 → 6 — 집게발보다 조금 나은 값 · 싼 범위 공격이 되게)
      tailMace: { name: '꼬리 철퇴', price: 160, cost: 20, damage: 30, interval: 2.2, range: 6, knockback: 5, knockMul: { guardian: 0.45, iceMage: 0.6 }, desc: '빙글 한 바퀴! 둘레를 다 치고 영웅을 밀쳐요' },
      // (P) 레이저 눈: chargeSeconds 동안 눈빛을 모았다가 beamSeconds 동안 곧은 빛줄기. tick 초마다 줄 위의 모든 것에 damage
      //     width: 빛줄기가 닿는 반쪽 너비 (칸). 황금 수호자의 방패는 레이저도 반 막음 (방패 깨기는 못 함)
      //     (P 조정: 한 번 지짐 14 → 10, 간격 5 → 5.5 — 14 일 때는 레이저 혼자 왕궁 성곽 영웅을 이겨서 다른 부품을 다 눌렀음)
      laserEye: { name: '레이저 눈', price: 450, cost: 30, damage: 10, interval: 5.5, range: 22, chargeSeconds: 0.8, beamSeconds: 1.0, tick: 0.1, width: 1.1, desc: '눈빛을 모아 쏘면 한 줄을 다 꿰뚫어요' },
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
    veteranPerRaid: 10, // (E 조정: 8 → 10, 1단계 단계 문턱이 200 으로 올라서)
    veteranPerWin: 12,
    veteranCapRank: 2,
  },

  // (S) 3D 블록 작업대 (고수용): 블록을 하나하나 쌓아 괴수를 만듦. 화면 글자는 js/villain/sculpt/*.js 의 TEXT
  sculpt: {
    unlockRank: 2, // 이 악명 단계부터 열림 (2 = '마을의 공포', 이름은 data/ranks.js)
    size: { w: 16, h: 16, d: 8 }, // 쌓을 수 있는 공간: 가로 × 세로 × 앞뒤 (가로·세로는 그림판과 같아야 부품 자리가 맞음)
    minBlocks: 60, // 이보다 적게 쌓으면 괴수를 만들 수 없음
    maxBlocks: 1600, // 이보다 많이 쌓을 수 없음 (휴대폰에서도 습격이 부드럽게)
    refDepth: 3, // 블록 수 ÷ 이 값 = 몸집 점수 (자동 그림 한 칸이 평균 3블록 → 같은 부피면 그림과 값이 비슷)
  },

  // (V) 마을 사람: 습격 때 '으악!' 하며 도망치는 꼬마 블록 사람들. 사람은 절대 다치지 않아요 (뛰고, 넘어지고, 숨고, 응원만 함)
  //     밖에 나와 있는 사람 수 = town/*Layout.js 의 villagers, 외치는 말 = data/villagerLines.js, 옷 색 = town/villagers.js
  villagers: {
    size: 0.95, // 블록 사람 크기 (건물 블록 = 1. 2단계까지는 0.5)
    kidChance: 0.3, // 이 비율만큼은 꼬마 (작고 목소리가 높음)
    kidSize: 0.75, // 꼬마 크기 배율
    walkSpeed: 1.6, // 평소 걷는 빠르기 (초당 칸)
    runSpeed: 9, // 도망치는 빠르기 (사람마다 ±15%, 꼬마는 조금 느림)
    scareDistance: 22, // 괴수가 이만큼(칸) 가까우면 도망
    alarmDistance: 14, // 누가 비명을 지르면 이만큼(칸) 안에서 서성이던 사람도 같이 놀라 뜀
    calmSeconds: 2.5, // 괴수가 멀어진 뒤에도 이만큼(초)은 더 뜀
    zigzag: 0.75, // 도망칠 때 지그재그 세기 (0 = 곧장)
    tripPerSecond: 0.1, // 뛰는 동안 1초마다 꽈당 넘어질 확률
    tripSeconds: 1.0, // 엎어져 버둥대는 시간 (그다음 허둥지둥 일어남)
    hidePerSecond: 0.07, // 뛰는 동안 1초마다 멀쩡한 건물 문으로 숨으러 갈 확률
    hideSearch: 18, // 이만큼(칸) 안의 건물 문만 찾음
    hideSeconds: 5, // 숨은 사람은 이만큼(초) 뒤 괴수가 멀면 살금살금 다시 나옴 (건물이 흔들리면 바로 튀어나옴)
    edgePerSecond: 0.05, // 뛰는 동안 1초마다 마을 밖으로 달아날 확률
    returnSeconds: 8, // 마을 밖으로 달아난 사람은 이만큼(초) 뒤 괴수가 멀면 돌아옴
    insidePerBuilding: 2, // 큰 건물 안에 숨어 있는 사람 (작은 건물은 1명, 벽·분수·배는 0명)
    insideTotal: 14, // 건물 안 사람은 모두 합쳐 이만큼까지
    burst: [1, 3], // 건물이 세게 맞으면 안에서 이만큼 (가장 적게, 가장 많이) 뛰쳐나옴
    burstBlocks: 3, // 건물 블록이 이만큼 떨어져 나가면 '세게 맞음'
    cheerDistance: 28, // 영웅이 이만큼(칸) 안에 있고
    braveDistance: 10, //   괴수는 이만큼보다 멀면 진정하고 폴짝폴짝 응원 (영웅이 오면 구경꾼이 됨)
    shout: {
      maxOnScreen: 3, // 화면에 한 번에 떠 있는 말풍선 수
      seconds: 1.7, // 말풍선이 떠 있는 시간 (초)
      cooldown: 4, // 한 사람이 다시 외치기까지 (초)
      gap: 0.35, // 아무나 다시 외치기까지 (초)
      perSecond: 0.8, // 도망치는 사람이 1초마다 외칠 확률
      hush: 0.6, // 건물이 와르르 무너진 뒤 이만큼(초)은 보통 말 쉬기 (큰 장면에 말이 쏟아지지 않게)
    },
  },

  // (C) 직접 조종: 습격은 처음엔 자동, 막대 · 단추 · 키를 쓰는 순간 직접 조종, 가만두면 다시 자동
  //     공격 피해 · 식는 시간은 위 parts · monster.headbutt 와 똑같아요 (직접 조종이라고 더 세지 않고, 노리는 것만 똑똑하게)
  //     화면 글자는 js/villain/ui/controlPad.js 의 TEXT, 단추 크기 · 자리는 css/villain-control.css · villain-control2.css
  control: {
    idleSeconds: 4, // 이 시간(초) 동안 아무 조작이 없으면 다시 자동으로 싸움
    heroFirst: 12, // 공격 단추를 누르면: 영웅이 이만큼(칸) 안에 있고 공격이 닿으면 영웅부터 노림
    frontWeight: 6, // 그다음은 걷는 방향 앞쪽 건물부터 (바로 뒤에 있는 건물은 이만큼의 두 배(칸) 더 먼 것처럼 셈)
    pressBuffer: 0.35, // 다른 공격을 하는 중에 누른 단추는 이 시간(초) 동안 기억했다가 바로 씀
    stickRadius: 50, // 움직이기 막대 손잡이가 움직이는 거리 (화면 글자 크기 기준 px)
    stickDeadzone: 0.18, // 막대를 이 비율보다 조금 밀면 가만히 (0~1)
    stickZone: 0.5, // 화면 왼쪽 이 비율까지 손가락을 대면 그 자리에 움직이기 막대
    tapPixels: 12, // 이만큼(px) 안 움직이고 짧게 뗀 누름 = 톡 (건물 · 영웅을 노리기)
    tapSeconds: 0.35,
    hintSeconds: 7, // 첫 습격 때 뜨는 조종 안내 글이 떠 있는 시간 (조종을 하면 바로 사라짐)
  },

  camera: { fov: 32, pitchDeg: 48 },
  debris: { capacity: 3000, rubbleCapacity: 2600, gravity: 52, lifeSeconds: 5, stack: true },
  speedOptions: [1, 2],
};
