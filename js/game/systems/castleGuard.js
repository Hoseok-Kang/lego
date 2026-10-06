// 성 수비대
// 성 꼭대기에서 가장 가까운 몬스터에게 화살을 쏩니다.
// 타워가 아직 없는 쪽에서 몬스터가 와도 성이 조금은 버틸 수 있게 해 줍니다.
// 사거리·공격력·쏘는 간격은 gameConfig.js 의 castle.guard 에서 바꿉니다.
// 한 번에 쏘는 화살 수는 보상 카드('성 수비대 증원')가 올려 줍니다 (modifiers.js 의 guardShots).
// 화살이 여러 발이면 가까운 몬스터부터 한 마리에 한 발씩 나눠 쏩니다.
//
//   guard.update(dt)
//   guard.reset()

import * as THREE from '../../lib/three.js';

// ── 바꿔도 되는 숫자 ──
const MAX_SHOTS = 6; // 한 번에 쏘는 화살 수의 최댓값
const SHOT_SPREAD = 1.2; // 여러 발을 쏠 때 화살이 나가는 곳 사이 간격 (칸)
const REPEAT_ON_FEW = true; // true: 몬스터가 화살 수보다 적으면 남는 화살도 가까운 몬스터에게 쏨

export function createCastleGuard({ castle, enemies, projectiles, config, modifiers = null }) {
  const guard = config.castle.guard;
  const muzzle = new THREE.Vector3();
  const targets = []; // 이번에 쏠 몬스터 (가까운 순서, 재사용)
  const targetDistances = [];
  let cooldown = 0;

  function shotCount() {
    const shots = Math.floor(modifiers?.values?.guardShots ?? 1);
    return Math.max(1, Math.min(MAX_SHOTS, shots));
  }

  // 사거리 안에서 성에 가까운 몬스터를 최대 count 마리까지 (서로 다른 몬스터, 가까운 순서)
  function findTargets(count) {
    targets.length = 0;
    targetDistances.length = 0;
    const list = enemies.list();
    for (let k = 0; k < list.length; k++) {
      const enemy = list[k];
      if (!enemy.alive || enemy.state === 'arriving' || enemy.state === 'dead' || enemy.assembling) continue;
      const distance = Math.hypot(enemy.position.x, enemy.position.z);
      if (distance > guard.range) continue;
      let n = targets.length;
      if (n === count) {
        if (distance >= targetDistances[n - 1]) continue;
        n -= 1; // 가장 먼 몬스터를 빼고 자리를 만듦
      }
      let i = n;
      while (i > 0 && targetDistances[i - 1] > distance) {
        targets[i] = targets[i - 1];
        targetDistances[i] = targetDistances[i - 1];
        i--;
      }
      targets[i] = enemy;
      targetDistances[i] = distance;
      targets.length = n + 1;
      targetDistances.length = n + 1;
    }
    return targets.length;
  }

  // 성 위쪽, 몬스터가 있는 쪽 가장자리에서 쏨 (여러 발이면 옆으로 조금씩 떨어져서)
  function shoot(target, lateral) {
    const distance = Math.max(0.001, Math.hypot(target.position.x, target.position.z));
    const dirX = target.position.x / distance;
    const dirZ = target.position.z / distance;
    const edge = Math.min(config.castle.columns / 2, 6);
    muzzle.set(dirX * edge - dirZ * lateral, 1 + castle.figureHeight * 0.8, dirZ * edge + dirX * lateral);
    projectiles.fire({ kind: 'arrow', from: muzzle, target, damage: guard.damage, speed: guard.projectileSpeed });
  }

  return {
    update(dt) {
      if (!castle.isBuilt || castle.isDestroyed) return;
      cooldown -= dt;
      if (cooldown > 0) return;
      const shots = shotCount();
      const found = findTargets(shots);
      if (found === 0) return;
      cooldown = guard.fireInterval;
      const fired = REPEAT_ON_FEW ? shots : found;
      for (let s = 0; s < fired; s++) {
        const lateral = fired > 1 ? (s - (fired - 1) / 2) * SHOT_SPREAD : 0;
        shoot(targets[s % found], lateral);
      }
    },
    reset() {
      cooldown = 0;
      targets.length = 0;
      targetDistances.length = 0;
    },
  };
}
