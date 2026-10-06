// ─────────────────────────────────────────────────────────────
// 게임 설정 (성 지키기)
// 게임 밸런스(돈, 체력, 공격력, 속도, 웨이브 구성)는 전부 여기서 바꿉니다.
// 다른 파일은 이 값들을 읽어서 움직이기만 합니다.
// 거리 단위: 블록 한 칸 = 1, 시간 단위: 초
// ─────────────────────────────────────────────────────────────

export const GAME = {
  // 전장 (바닥판) — 웨이브를 막을 때마다 둘레에 블록이 쌓이며 넓어집니다
  arena: {
    startSize: 56, // 처음 바닥판 한 변의 칸 수 (짝수)
    growthPerWave: 4, // 웨이브를 막을 때마다 넓어지는 칸 수 (짝수, 양쪽으로 절반씩)
    maxSize: 84, // 가장 넓어졌을 때 한 변의 칸 수
    growSeconds: 2.5, // 땅이 넓어지는 모션 시간
    groundColor: '#4B9F4A', // 잔디색
    studSegments: 8, // 바닥판 돌기를 몇 조각으로 그릴지 (작을수록 가벼움)
    spawnMargin: 3, // 적이 나타나는 거리 = 바닥판 절반 - 이 값
  },

  // 카메라
  camera: {
    fov: 34,
    pitchDeg: 55, // 위에서 내려다보는 각도
    portraitPitchDeg: 68, // 세로로 긴 화면(휴대폰)에서 내려다보는 각도
    yawDeg: 0, // 처음 보는 방향 (0 = 정면)
    fitMargin: 1, // 화면에 다 들어오게 맞출 원의 반지름 = 바닥판 절반 + 이 값
    minZoom: 0.55, // 최대로 확대했을 때 거리 배율
    maxZoom: 1.2, // 최대로 축소했을 때 거리 배율
  },

  // 우리 성 (지켜야 할 기지)
  castle: {
    columns: 22, // 성 그림의 가로 블록 수
    depth: 3, // 성의 두께 (블록 줄 수)
    maxHp: 150, // 성 체력
    buildSeconds: 5, // 처음에 성이 쌓이는 시간
    platformSize: 30, // 성 아래 돌바닥 한 변 칸 수 (성 부품 자리 포함)
    reach: 16, // 적이 성 중심에서 이 거리(정사각형 둘레)까지 오면 멈추고 공격
    // 성 수비대: 성 위에서 가까운 적에게 화살을 쏨 (타워가 없는 쪽도 조금은 막아 줌)
    guard: { range: 24, fireInterval: 0.9, damage: 6, projectileSpeed: 30 },
    repairPerWave: 20, // 웨이브를 막을 때마다 성 체력을 이만큼 수리 (떨어진 블록이 다시 쌓임)
  },

  // 타워 자리: 땅이 넓어지면 바깥쪽 고리가 새로 열립니다
  towerPads: {
    size: 5, // 타워 자리 받침의 한 변 칸 수
    rings: [
      { radius: 21, count: 8, landSize: 0 }, // 처음부터 있는 자리
      { radius: 29, count: 12, landSize: 72 }, // 땅이 72칸이 되면 열림
      { radius: 36, count: 16, landSize: 84 }, // 땅이 84칸이 되면 열림
    ],
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
    golem: { name: '골렘', columns: 10, depth: 3, hp: 85, speed: 1.6, damage: 6, attackInterval: 1.6, gold: 16, motion: 'stomp' },
    boss: { name: '대장 골렘', columns: 11, depth: 3, hp: 420, speed: 1.2, damage: 10, attackInterval: 2, gold: 90, motion: 'stomp' },
    custom: { name: '내 몬스터', columns: 9, depth: 2, hp: 40, speed: 2.8, damage: 3, attackInterval: 1.2, gold: 8, motion: 'hop' },
  },
  enemyArriveSeconds: 0.7, // 적이 나타날 때 블록이 모여 몸이 만들어지는 시간

  // 웨이브 (적이 몰려오는 차례)
  waves: {
    // 웨이브마다 나오는 적의 수. 줄을 추가하면 웨이브가 늘어납니다.
    list: [
      { slime: 6 },
      { slime: 8, bat: 4 },
      { slime: 8, bat: 6, golem: 1 },
      { slime: 10, bat: 4, golem: 3 },
      { slime: 8, golem: 2, boss: 1 },
      { slime: 10, bat: 10, golem: 4 },
      { slime: 12, bat: 4, golem: 6 },
      { slime: 6, bat: 16, golem: 6 },
      { slime: 14, bat: 10, golem: 8 },
      { slime: 8, bat: 12, golem: 8, boss: 2 },
    ],
    customFromWave: 2, // '내 몬스터'를 올렸다면 이 웨이브부터 섞여 나옴
    customPerWave: 0.5, // 웨이브 번호 × 이 값만큼 '내 몬스터'가 추가로 나옴 (반올림)
    directions: [1, 2, 2, 2, 3, 3, 3, 4, 4, 4], // 웨이브마다 적이 몰려오는 방향 수
    spawnInterval: 0.9, // 적이 한 마리씩 나오는 간격
    hpGrowth: 0.5, // 웨이브가 하나 늘 때마다 적 체력 50%씩 증가 (땅이 넓어지고 타워 자리가 늘어나는 만큼)
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
    rubbleCapacity: 1000, // 바닥에 남아 있을 수 있는 잔해 수 (대장이 나올 때 모여서 대장이 됨)
    gravity: 32,
    lifeSeconds: 1.6,
  },

  // 성 부품: 성 둘레 자리에 붙여서 성을 키웁니다 (돌바닥 위, 성 그림 둘레)
  castleParts: {
    // 자리: x, z = 위치 (성 중심 기준), kind = 'corner'(모서리) | 'side'(옆면), facing = 바깥쪽 방향 각도(도)
    sockets: [
      { x: 12, z: 12, kind: 'corner', facing: 45 },
      { x: -12, z: 12, kind: 'corner', facing: 135 },
      { x: -12, z: -12, kind: 'corner', facing: 225 },
      { x: 12, z: -12, kind: 'corner', facing: 315 },
      { x: 0, z: 13, kind: 'side', facing: 90 },
      { x: -13, z: 0, kind: 'side', facing: 180 },
      { x: 0, z: -13, kind: 'side', facing: 270 },
      { x: 13, z: 0, kind: 'side', facing: 0 },
    ],
    footprint: { corner: { width: 5, depth: 5 }, side: { width: 10, depth: 3 } }, // 부품이 차지하는 칸 (넘지 않게)
    maxLevel: 3,
    upgradeCostRate: [0, 0.8, 1.2], // 레벨 2, 3으로 올릴 때 비용 = 부품 값 × 이 비율
    levelBoost: 0.5, // 레벨이 하나 오를 때마다 효과 +50%
    types: {
      watchtower: { name: '망루', socket: 'corner', cost: 90, buildSeconds: 2.5, description: '성 모서리에서 화살을 쏴요',
        range: 17, damage: 7, fireInterval: 0.8, projectile: 'arrow', projectileSpeed: 34 },
      bombard: { name: '대포 포대', socket: 'corner', cost: 130, buildSeconds: 3, description: '느리지만 넓게 터지는 대포를 쏴요',
        range: 19, damage: 20, fireInterval: 2.2, splashRadius: 4, projectile: 'cannonball', projectileSpeed: 20 },
      wall: { name: '성벽', socket: 'side', cost: 60, buildSeconds: 2, description: '성 체력 +40. 이쪽에서 오는 공격을 먼저 막아요',
        hpBonus: 40 },
      treasury: { name: '창고', socket: 'side', cost: 100, buildSeconds: 2.5, description: '웨이브를 막을 때마다 돈 +25',
        goldPerWave: 25 },
      workshop: { name: '수리소', socket: 'side', cost: 80, buildSeconds: 2.5, description: '웨이브마다 성 수리 +15, 타워를 20% 빨리 지어요',
        repairBonus: 15, buildSpeedBonus: 0.2 },
    },
  },

  // 대장 등장: 바닥에 남은 잔해 블록이 떠올라 모여서 대장 몬스터가 됨
  bossAssembly: {
    gatherSeconds: 0.9, // 잔해가 들썩이며 떠오르는 시간
    flySeconds: 1.4, // 블록 하나가 날아가는 시간
    spreadSeconds: 1.8, // 블록들이 차례로 출발하는 데 걸리는 시간 (대장 아래쪽 블록부터)
    lift: 9, // 날아갈 때 위로 솟는 높이
    skyHeight: 24, // 잔해가 모자라면 나머지 블록은 이 높이에서 떨어짐
  },

  // 그림 크기 제한: 세로로 긴 사진을 넣어도 성·타워·몬스터가 너무 커지지 않게 (넘으면 대신 좁아짐)
  artLimits: {
    castleRows: 28, // 성 그림 최대 세로 블록 수
    towerRows: 20, // 타워 그림 최대 세로 블록 수
    monsterRowsPerColumn: 1.6, // 몬스터 그림 최대 세로 = 가로 블록 수 × 이 값 (최소 12)
  },

  // 웨이브 보상 카드: 웨이브를 막을 때마다 이 중 몇 장이 나오고 하나를 고릅니다
  // effect 종류: add(더하기) / mul(곱하기) 는 js/game/core/modifiers.js 의 이름, gold(돈), unlockSkill(스킬 열기), freePart(무료 부품)
  cards: {
    choices: 3,
    pool: [
      { id: 'sharpArrows', name: '날카로운 화살', description: '화살 타워와 망루 공격력 +25%', weight: 3,
        effect: { mul: { 'towerDamage.archer': 1.25, 'partDamage.watchtower': 1.25 } } },
      { id: 'bigBoom', name: '더 큰 폭발', description: '대포 폭발 범위 +1.5, 공격력 +15%', weight: 3,
        effect: { add: { splashBonus: 1.5 }, mul: { 'towerDamage.cannon': 1.15, 'partDamage.bombard': 1.15 } } },
      { id: 'deepFreeze', name: '꽁꽁 얼음', description: '얼음 타워가 더 오래, 더 느리게 만들어요', weight: 3,
        effect: { add: { slowBonus: 0.15, slowSecondsBonus: 1 }, mul: { 'towerDamage.ice': 1.2 } } },
      { id: 'eagleEye', name: '매의 눈', description: '모든 타워 사거리 +1.5', weight: 2, effect: { add: { towerRange: 1.5 } } },
      { id: 'quickHands', name: '빠른 손', description: '모든 타워가 15% 더 빨리 쏴요', weight: 2, effect: { mul: { towerFireRate: 1.15 } } },
      { id: 'goldPouch', name: '금화 주머니', description: '바로 120골드를 받아요', weight: 3, effect: { gold: 120 } },
      { id: 'bounty', name: '현상금', description: '몬스터를 쓰러뜨릴 때마다 돈 +2', weight: 2, effect: { add: { killGoldBonus: 2 } } },
      { id: 'interest', name: '저금통', description: '웨이브가 끝날 때마다 남은 돈의 10%를 더 받아요', weight: 1, effect: { add: { interestRate: 0.1 } } },
      { id: 'doubleShot', name: '성 수비대 증원', description: '성이 화살을 한 번에 2발씩 쏴요', weight: 1, maxPicks: 1,
        effect: { add: { guardShots: 1 } } },
      { id: 'freeWatchtower', name: '공짜 망루', description: '다음 망루를 무료로 지어요', weight: 2, effect: { freePart: 'watchtower' } },
      { id: 'freeWall', name: '공짜 성벽', description: '다음 성벽을 무료로 지어요', weight: 2, effect: { freePart: 'wall' } },
      { id: 'masons', name: '석공 조합', description: '성 부품 값 25% 할인', weight: 1, maxPicks: 2, effect: { add: { partDiscount: 0.25 } } },
      { id: 'unlockFreeze', name: '새 스킬: 얼려라', description: '모든 몬스터를 잠깐 거의 멈추게 하는 스킬', weight: 4, maxPicks: 1,
        effect: { unlockSkill: 'freeze' } },
      { id: 'unlockRepair', name: '새 스킬: 긴급 수리', description: '성 체력을 바로 채우는 스킬', weight: 4, maxPicks: 1,
        effect: { unlockSkill: 'repair' } },
      { id: 'heavyBlocks', name: '무거운 블록', description: '블록 떨어뜨리기 위력 +40%, 범위 +1', weight: 2,
        effect: { mul: { 'skillPower.blockDrop': 1.4 }, add: { 'skillRadius.blockDrop': 1 } } },
      { id: 'quickSkills', name: '빠른 재충전', description: '모든 스킬 대기시간 -20%', weight: 2, effect: { mul: { skillCooldown: 0.8 } } },
    ],
  },

  // 스킬: 아래 단추를 누른 뒤 (블록 떨어뜨리기는 땅을 한 번 더 눌러서) 씁니다
  skills: {
    blockDrop: { name: '블록 떨어뜨리기', description: '누른 곳에 큰 블록 덩어리를 떨어뜨려요', cooldown: 18, damage: 70,
      radius: 4.5, size: 5, fallSeconds: 0.7, unlocked: true, needsTarget: true },
    freeze: { name: '얼려라', description: '모든 몬스터를 4초 동안 거의 멈추게 해요', cooldown: 35, slow: 0.85, seconds: 4,
      unlocked: false, needsTarget: false },
    repair: { name: '긴급 수리', description: '성 체력을 바로 30 채워요', cooldown: 45, amount: 30, unlocked: false, needsTarget: false },
  },

  speedOptions: [1, 2, 3], // 게임 속도 버튼
};
