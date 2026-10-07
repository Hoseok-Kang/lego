// 체력과 귀 블록
// 체력이 줄어드는 만큼 토끼 귀(와 꼬리) 블록이 끝에서부터 하나씩 터집니다.
// 남아 있는 귀 블록 수 = 올림(귀 블록 전체 × 남은 체력 / 최대 체력)
// 그래서 체력이 조금만 줄면 귀 끝 한두 칸만, 많이 줄면 여러 칸이 한꺼번에 터집니다.
//
//   const health = createHealth({ maxHp, popTotal })   popTotal: 터질 수 있는 귀·꼬리 블록 수
//   health.damage(양) → { popped, dead }                popped: 이번에 터져야 할 블록 수
//   health.heal(양)   → { restored }                    restored: 다시 붙여야 할 블록 수
//   health.reset()                                      처음 체력으로
//   health.hp / health.maxHp / health.ratio / health.remainingBlocks

export function createHealth({ maxHp, popTotal }) {
  let hp = maxHp;

  const blocksFor = (value) => Math.ceil((popTotal * Math.max(0, value)) / maxHp);

  return {
    damage(amount) {
      if (hp <= 0) return { popped: 0, dead: false };
      const before = blocksFor(hp);
      hp = Math.max(0, hp - amount);
      return { popped: before - blocksFor(hp), dead: hp <= 0 };
    },
    heal(amount) {
      if (hp <= 0) return { restored: 0 };
      const before = blocksFor(hp);
      hp = Math.min(maxHp, hp + amount);
      return { restored: blocksFor(hp) - before };
    },
    reset() {
      hp = maxHp;
    },
    get hp() {
      return hp;
    },
    get maxHp() {
      return maxHp;
    },
    get ratio() {
      return hp / maxHp;
    },
    get remainingBlocks() {
      return blocksFor(hp);
    },
  };
}
