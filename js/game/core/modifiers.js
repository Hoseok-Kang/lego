// 게임 보정값 (카드 효과가 쌓이는 곳)
// 웨이브 보상 카드를 고르면 여기 값이 바뀌고, 타워·성·스킬·돈 계산이 이 값을 곱하거나 더해서 씁니다.
// 'towerDamage.archer' 처럼 점(.)으로 안쪽 값을 가리킬 수 있습니다.
//
//   modifiers.values            지금 값 (읽기만 하세요)
//   modifiers.get('이름')        값 하나 읽기 (예: 'towerDamage.archer')
//   modifiers.add('이름', 수)    더하기
//   modifiers.mul('이름', 수)    곱하기
//   modifiers.reset()           처음 값으로 (다시 하기)

function defaults() {
  return {
    towerDamage: { archer: 1, cannon: 1, ice: 1 }, // 타워 종류별 공격력 배율
    partDamage: { watchtower: 1, bombard: 1 }, // 성 부품(망루·대포 포대) 공격력 배율
    towerRange: 0, // 모든 타워 사거리에 더하기 (칸)
    towerFireRate: 1, // 쏘는 빠르기 배율 (클수록 자주 쏨)
    splashBonus: 0, // 대포 폭발 반지름에 더하기
    slowBonus: 0, // 얼음 감속에 더하기 (0.15 = 15% 더 느리게)
    slowSecondsBonus: 0, // 얼음 지속 시간에 더하기 (초)
    buildSpeed: 1, // 타워 짓는 빠르기 배율 (클수록 빨리 지음)
    killGoldBonus: 0, // 몬스터를 쓰러뜨릴 때 받는 돈에 더하기
    waveGoldBonus: 0, // 웨이브를 막을 때 받는 돈에 더하기
    interestRate: 0, // 웨이브가 끝날 때 남은 돈 × 이 비율을 더 받음
    guardShots: 1, // 성 수비대가 한 번에 쏘는 화살 수
    repairBonus: 0, // 웨이브마다 성 수리량에 더하기
    skillCooldown: 1, // 스킬 대기시간 배율 (작을수록 빨리 다시 씀)
    skillPower: { blockDrop: 1, freeze: 1, repair: 1 }, // 스킬 위력 배율
    skillRadius: { blockDrop: 0 }, // 스킬 범위에 더하기
    partDiscount: 0, // 성 부품 할인 비율 (0.25 = 25% 싸게)
  };
}

export function createModifiers() {
  let values = defaults();

  function locate(path) {
    const keys = path.split('.');
    let holder = values;
    for (let i = 0; i < keys.length - 1; i++) holder = holder?.[keys[i]];
    const last = keys[keys.length - 1];
    if (!holder || typeof holder[last] !== 'number') throw new Error(`없는 보정값 이름: ${path}`);
    return { holder, last };
  }

  return {
    get values() {
      return values;
    },
    get(path) {
      const { holder, last } = locate(path);
      return holder[last];
    },
    add(path, amount) {
      const { holder, last } = locate(path);
      holder[last] += amount;
    },
    mul(path, factor) {
      const { holder, last } = locate(path);
      holder[last] *= factor;
    },
    reset() {
      values = defaults();
    },
  };
}
