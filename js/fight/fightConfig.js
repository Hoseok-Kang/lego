// ─────────────────────────────────────────────────────────────
// 펑펑 토끼: 게임 숫자 설정
// 이 파일의 숫자만 바꿔도 게임 느낌이 바뀝니다. (다른 파일은 건드리지 않아도 됩니다)
// 길이 단위는 '블록 한 칸' 입니다. (토끼 키 ≈ 13칸 = 그림 18칸 × figureScale)
// 방향: 화면 위쪽 = -z, 화면 아래쪽 = +z, 오른쪽 = +x
// ─────────────────────────────────────────────────────────────

export const FIGHT = {
  // 작은 전장
  map: {
    width: 80, // 가로 칸 수
    depth: 60, // 세로 칸 수
    groundColor: '#4B9F4A', // 잔디 바닥판 색
    outsideColor: '#237841', // 전장 바깥 땅 색
    studSegments: 8, // 바닥 돌기 둘레 조각 수 (작을수록 가벼움)
    playerSpawn: [0, 22], // 내 토끼 시작 위치 [x, z]
  },

  // 카메라 (위에서 비스듬히 내려다보며 내 토끼를 따라감)
  camera: {
    fov: 30, // 좁을수록 멀리서 찍어 키 큰 토끼가 덜 커 보임
    pitchDeg: 58, // 내려다보는 각도 (90 = 바로 위)
    minHalfWidth: 24, // 화면에 적어도 내 토끼 좌우로 이만큼은 보이게
    minHalfDepth: 18, // 화면에 적어도 내 토끼 앞뒤로 이만큼은 보이게 (총 토끼가 쏘는 거리보다 넉넉히)
    portraitHalfWidth: 15, // 휴대폰 세로 화면에서는 좌우로 이만큼만 (넓게 보면 토끼가 너무 작아지고 전장 위아래가 남아돎)
    follow: 7, // 따라가는 빠르기 (클수록 딱 붙어 따라감)
    aimLead: 5, // 조준하는 쪽으로 화면을 미리 옮기는 거리
    shakeMax: 1.4, // 화면 흔들림 최대 세기
  },

  // 토끼 블록 인형 크기 (1 = 그림 그대로 키 18칸). 모든 토끼에 곱함 (망치 토끼는 enemies.brute.scale 도 한 번 더)
  figureScale: 0.75,

  // 내 토끼
  player: {
    maxHp: 100,
    radius: 3, // 부딪힘 크기 (반지름)
    speed: 13, // 걷는 빠르기 (초당 칸)
    accel: 90, // 빨라지는 정도 (클수록 바로 최고 속도)
    roll: {
      speed: 30, // 구르는 빠르기
      seconds: 0.32, // 구르는 시간
      cooldown: 0.75, // 다시 구를 수 있을 때까지
      invulnerable: 0.28, // 구르기 시작부터 이 시간 동안은 맞지 않음
    },
    hurtInvulnerable: 0.18, // 한 번 맞은 뒤 잠깐 안 맞는 시간 (연속으로 너무 많이 깎이지 않게)
    startWeapon: 'blaster',
  },

  // 내 무기 (모두 블록으로 만든 장난감 무기)
  weapons: {
    blaster: {
      name: '블록 총',
      damage: 10,
      interval: 0.13, // 쏘는 간격 (초) — 누르고 있으면 계속 쏨
      magazine: 14, // 탄창
      reloadSeconds: 1.0,
      bulletSpeed: 52,
      bulletRange: 46, // 날아가는 최대 거리
      spreadDeg: 4, // 탄이 퍼지는 각도
      knockback: 4, // 맞은 상대가 밀리는 세기
      bulletColor: '#F2CD37',
    },
    sword: {
      name: '블록 칼',
      damage: 26,
      interval: 0.42, // 휘두르는 간격
      swingSeconds: 0.2, // 한 번 휘두르는 데 걸리는 시간
      range: 8.5, // 닿는 거리 (토끼 가운데부터)
      arcDeg: 150, // 휘두르는 부채꼴 각도
      knockback: 14,
      lunge: 9, // 휘두를 때 앞으로 살짝 나가는 빠르기
      deflectBullets: true, // 휘두르는 칼에 닿은 적 총알을 지움
      hitStop: 0.05, // 칼로 맞혔을 때 아주 잠깐 멈칫하는 시간 (타격감)
    },
  },

  // 미친토끼 (적)
  enemies: {
    // 처음에 나오는 적 [종류, x, z]
    spawns: [
      ['knife', -24, -8],
      ['knife', 26, -4],
      ['gunner', -14, -22],
      ['gunner', 18, -21],
      ['brute', 0, -16],
    ],
    sightRange: 30, // 이 거리 안에 내 토끼가 보이면 달려옴
    alertDelay: 0.45, // '!' 뜨고 움직이기 시작할 때까지
    alertSpread: 0.35, // 근처 친구도 함께 깨어나는 시간 차이
    separation: 6.5, // 적끼리 이 거리보다 가까우면 서로 비킴
    huntAfter: 6, // 이 시간(초) 동안 깨어 있는 미친토끼가 하나도 없으면, 내 토끼와 가장 가까운 미친토끼가 찾아옴

    // 칼 토끼: 빠르게 달려와 휙 찌름
    knife: {
      name: '칼 미친토끼',
      maxHp: 45,
      radius: 3,
      speed: 10.5,
      attackRange: 7, // 이 거리에서 찌를 준비
      windup: 0.38, // 찌르기 전 준비 (빨갛게 반짝 → 피할 시간)
      lungeSpeed: 30,
      lungeSeconds: 0.22,
      recover: 0.65, // 찌른 뒤 멍하니 있는 시간 (반격 기회)
      damage: 12,
      hitRadius: 4.2, // 찌르기 닿는 거리
    },
    // 총 토끼: 거리를 두고 빙빙 돌며 세 발씩 쏨
    gunner: {
      name: '총 미친토끼',
      maxHp: 40,
      radius: 3,
      speed: 8,
      keepDistance: [13, 22], // 이 거리 사이를 유지하려고 함
      windup: 0.45, // 쏘기 전 총구가 반짝
      burst: 3, // 한 번에 쏘는 탄 수
      burstInterval: 0.13,
      cooldown: [1.3, 2.0], // 다음 공격까지 (최소, 최대)
      damage: 7,
      bulletSpeed: 24, // 내 탄보다 느려서 보고 피할 수 있음
      bulletRange: 40,
      spreadDeg: 7,
      bulletColor: '#FF698F',
    },
    // 망치 토끼: 크고 느리지만 쾅 내려치면 아픔
    brute: {
      name: '망치 미친토끼',
      maxHp: 150,
      radius: 4.2,
      scale: 1.35, // 다른 토끼보다 얼마나 큰지
      speed: 6,
      attackRange: 8,
      windup: 0.8, // 내려치기 전 (바닥에 빨간 원이 커짐)
      slamRadius: 8.5,
      damage: 24,
      knockback: 22,
      recover: 0.9,
      cooldown: 1.0,
    },
  },

  // 맞으면 토끼 귀가 조금씩 터짐
  pop: {
    blockPower: 5, // 귀에서 떨어진 블록이 튀는 세기
    blockUpward: 8,
    deathPower: 11, // 마지막에 '펑' 할 때 블록이 흩어지는 세기
    deathUpward: 13,
    deathShake: 0.9, // 내 토끼가 터질 때 화면 흔들림 (적은 절반)
    deathKeep: 0.4, // '펑' 할 때 잔해로 남는 블록 비율 (토끼 인형이 figureScale 만큼 작아서 다 남기면 잔해가 너무 많음, 나머지는 연기 속으로)
  },

  // 당근 (먹으면 체력 회복 + 귀가 다시 쌓임)
  carrots: {
    heal: 30,
    radius: 2.6, // 이 거리 안에 들어가면 먹음
    dropChance: 0.45, // 미친토끼가 터질 때 당근이 나올 확률
    mapSpots: [[-30, 18], [32, 12]], // 처음부터 땅에 있는 당근 [x, z]
  },

  // 나무 상자 (총알·칼에 맞으면 블록이 떨어져 나가다 부서짐)
  crates: {
    hp: 40,
    carrotChance: 0.3, // 부서질 때 당근이 나올 확률
  },

  // 떨어진 블록 조각
  debris: {
    capacity: 2600, // 동시에 날아다니는 조각 최대 수
    rubbleCapacity: 2200, // 바닥에 남는 잔해 최대 수
    gravity: 52,
    lifeSeconds: 5,
  },

  // 게임 속도
  hitStopMax: 0.08, // 멈칫 효과가 겹쳐도 이 시간 이상 멈추지 않음
};
