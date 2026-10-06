// ─────────────────────────────────────────────────────────────
// 게임 설정 (성 지키기)
// 게임 밸런스(돈, 체력, 공격력, 속도, 웨이브 구성)는 전부 여기서 바꿉니다.
// 다른 파일은 이 값들을 읽어서 움직이기만 합니다.
// 거리 단위: 블록 한 칸 = 1, 시간 단위: 초
// ─────────────────────────────────────────────────────────────

export const GAME = {
  // 전장 (바닥판)
  arena: {
    size: 64, // 바닥판 한 변의 칸 수
    groundColor: '#4B9F4A', // 잔디색
    studSegments: 10, // 바닥판 돌기를 몇 조각으로 그릴지 (작을수록 가벼움)
    spawnRadius: 30, // 성 중심에서 적이 나타나는 거리
  },

  // 카메라
  camera: {
    fov: 34,
    pitchDeg: 55, // 위에서 내려다보는 각도
    yawDeg: 0, // 처음 보는 방향 (0 = 정면)
    fitRadius: 33, // 이 반지름의 원이 화면에 다 들어오게 맞춤
    minZoom: 0.55, // 최대로 확대했을 때 거리 배율
    maxZoom: 1.2, // 최대로 축소했을 때 거리 배율
  },

  // 우리 성 (지켜야 할 기지)
  castle: {
    columns: 22, // 성 그림의 가로 블록 수
    depth: 3, // 성의 두께 (블록 줄 수)
    maxHp: 150, // 성 체력
    buildSeconds: 5, // 처음에 성이 쌓이는 시간
    platformSize: 26, // 성 아래 돌바닥 한 변 칸 수
    reach: 14, // 적이 성 중심에서 이 거리(정사각형 둘레)까지 오면 멈추고 공격
    // 성 수비대: 성 위에서 가까운 적에게 화살을 쏨 (타워가 없는 쪽도 조금은 막아 줌)
    guard: { range: 21, fireInterval: 0.9, damage: 6, projectileSpeed: 30 },
    repairPerWave: 20, // 웨이브를 막을 때마다 성 체력을 이만큼 수리 (떨어진 블록이 다시 쌓임)
  },

  // 타워 자리
  towerPads: {
    count: 8, // 성 둘레 타워 자리 수
    radius: 19, // 성 중심에서 타워 자리까지 거리
    size: 5, // 타워 자리 받침의 한 변 칸 수
  },

  // 타워 종류
  towers: {
    archer: {
      name: '화살 타워',
      description: '빠르게 화살을 쏴요',
      cost: 50,
      columns: 8, // 타워 그림 가로 블록 수
      depth: 2,
      buildSeconds: 2.5, // 다 쌓여야 공격 시작
      range: 14,
      fireInterval: 0.55, // 몇 초마다 쏘는지
      damage: 8,
      projectile: 'arrow',
      projectileSpeed: 34,
    },
    cannon: {
      name: '대포 타워',
      description: '느리지만 여러 마리를 한꺼번에 맞혀요',
      cost: 80,
      columns: 9,
      depth: 2,
      buildSeconds: 3.5,
      range: 15,
      fireInterval: 1.6,
      damage: 18,
      splashRadius: 3.5, // 맞은 곳 둘레 이 거리 안의 적도 피해
      projectile: 'cannonball',
      projectileSpeed: 20,
    },
    ice: {
      name: '얼음 타워',
      description: '맞은 적을 느리게 만들어요',
      cost: 60,
      columns: 8,
      depth: 2,
      buildSeconds: 3,
      range: 12,
      fireInterval: 0.8,
      damage: 4,
      slow: 0.45, // 이동 속도를 이만큼 줄임 (0.45 = 45% 느려짐)
      slowSeconds: 1.8,
      projectile: 'ice',
      projectileSpeed: 26,
    },
  },

  // 타워 강화
  upgrade: {
    maxLevel: 3,
    costRate: [0, 0.8, 1.2], // 레벨 2, 3으로 올릴 때 비용 = 타워 값 × 이 비율
    damageRate: 1.45, // 레벨이 오를 때마다 공격력 배율
    rangeBonus: 1.5, // 레벨이 오를 때마다 사거리 증가
    fireIntervalRate: 0.9, // 레벨이 오를 때마다 쏘는 간격 배율 (작을수록 빨라짐)
    crownRows: 2, // 강화할 때 타워 위에 더 쌓이는 블록 줄 수
    crownColor: '#F2CD37', // 강화 블록 색 (노랑)
  },
  sellRate: 0.6, // 팔 때 돌려받는 비율 (쓴 돈 기준)

  // 적 몬스터 종류
  enemies: {
    slime: { name: '슬라임', columns: 8, depth: 2, hp: 28, speed: 2.6, damage: 2, attackInterval: 1.2, gold: 7, motion: 'hop' },
    bat: { name: '박쥐', columns: 9, depth: 1, hp: 14, speed: 4.5, damage: 1, attackInterval: 0.9, gold: 5, motion: 'fly' },
    golem: { name: '골렘', columns: 10, depth: 3, hp: 85, speed: 1.6, damage: 5, attackInterval: 1.6, gold: 16, motion: 'stomp' },
    boss: { name: '대장 골렘', columns: 15, depth: 3, hp: 340, speed: 1.2, damage: 8, attackInterval: 2, gold: 90, motion: 'stomp' },
    custom: { name: '내 몬스터', columns: 9, depth: 2, hp: 40, speed: 2.8, damage: 3, attackInterval: 1.2, gold: 8, motion: 'hop' },
  },
  enemyArriveSeconds: 0.7, // 적이 나타날 때 블록이 모여 몸이 만들어지는 시간

  // 웨이브 (적이 몰려오는 차례)
  waves: {
    // 웨이브마다 나오는 적의 수. 줄을 추가하면 웨이브가 늘어납니다.
    list: [
      { slime: 6 },
      { slime: 8, bat: 3 },
      { slime: 6, bat: 6 },
      { slime: 8, bat: 4, golem: 2 },
      { slime: 6, boss: 1 },
      { slime: 6, bat: 10, golem: 2 },
      { slime: 10, golem: 4 },
      { bat: 14, golem: 4 },
      { slime: 12, bat: 8, golem: 6 },
      { bat: 10, golem: 6, boss: 2 },
    ],
    customFromWave: 2, // '내 몬스터'를 올렸다면 이 웨이브부터 섞여 나옴
    customPerWave: 0.5, // 웨이브 번호 × 이 값만큼 '내 몬스터'가 추가로 나옴 (반올림)
    directions: [1, 2, 2, 2, 3, 3, 3, 4, 4, 4], // 웨이브마다 적이 몰려오는 방향 수
    spawnInterval: 0.9, // 적이 한 마리씩 나오는 간격
    hpGrowth: 0.15, // 웨이브가 하나 늘 때마다 적 체력 15%씩 증가
    firstBreakSeconds: 5, // 첫 웨이브 전 준비 시간
    breakSeconds: 8, // 웨이브 사이 쉬는 시간
  },

  // 돈
  economy: {
    startGold: 180,
    waveBonus: 30, // 웨이브를 막을 때마다 받는 돈
    waveBonusGrowth: 5, // 웨이브 번호마다 보너스 추가
  },

  // 부서진 블록 조각
  debris: {
    capacity: 2500, // 한꺼번에 날아다닐 수 있는 조각 수
    gravity: 32,
    lifeSeconds: 1.6,
  },

  speedOptions: [1, 2, 3], // 게임 속도 버튼
};
