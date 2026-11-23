// ─────────────────────────────────────────────────────────────
// 악당 타이쿤: 게임 숫자 설정
// 이 파일의 숫자만 바꿔도 게임 느낌이 바뀝니다. (다른 파일은 건드리지 않아도 됩니다)
// 길이 단위는 '블록 한 칸' 입니다. 방향: 화면 위쪽 = -z, 아래쪽(카메라 쪽) = +z, 오른쪽 = +x
// ─────────────────────────────────────────────────────────────

export const VILLAIN = {
  // 괴수 그리기 종이
  draw: {
    cols: 16, // 가로 칸 수
    rows: 16, // 세로 칸 수
    minBlocks: 12, // 이보다 적게 칠하면 괴수를 만들 수 없음
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
    costPerBlock: 1, // 그림 한 칸(블록)마다 드는 돈
    hpPerBlock: 3, // 그림 한 칸마다 체력
    baseSpeed: 9, // 가장 작은 괴수의 걷는 빠르기 (초당 칸)
    slowPerBlock: 0.008, // 그림 한 칸마다 느려지는 정도 → 빠르기 = baseSpeed / (1 + 칸 수 × 이 값)
    minSpeed: 3,
    buildSeconds: 2.2, // 블록이 촤르륵 쌓여 괴수가 되는 시간
    headbutt: { damage: 10, interval: 1.1, range: 2.5 }, // 부품이 없어도 쓰는 기본 공격 (몸통 박치기)
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

  // 영웅 (마을이 어느 정도 부서지면 나타남)
  hero: {
    name: '번개 기사',
    hint: '칼이 빨라요. 멀리서 불을 뿜으면 유리해요',
    appearAtDestroyed: 0.35, // 마을이 이만큼(비율) 부서지면 출동
    appearLatestSeconds: 30, // 마을이 덜 부서졌어도 부수기 시작한 지 이 시간(초)이 지나면 출동 (판이 늘어지지 않게)
    alertSeconds: 2, // '영웅 출동!' 경보 뒤 나타날 때까지
    maxHp: 500,
    speed: 11,
    damage: 14, // 칼 한 번
    interval: 0.7,
    range: 3.2,
    leapEvery: 5, // 이 시간(초)마다 한 번 높이 뛰어올라 내려찍기
    leapDamage: 30,
    payForWin: 100, // 영웅을 이기면 받는 돈
  },

  // 습격 한 판의 박자
  raid: {
    cleanupSeconds: 15, // 영웅을 이긴 뒤 남은 마을을 마저 부술 수 있는 시간 (끝나면 남은 건물은 저절로 와르르)
  },

  // 돈
  economy: {
    startMoney: 150,
    minPay: 20, // 아무리 못 부숴도 받는 수고비 (돈이 0 이 되어 막히지 않게)
  },

  camera: { fov: 32, pitchDeg: 48 },
  debris: { capacity: 3000, rubbleCapacity: 2600, gravity: 52, lifeSeconds: 5, stack: true },
  speedOptions: [1, 2],
};
