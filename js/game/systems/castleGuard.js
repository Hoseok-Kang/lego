// 성 수비대
// 성 꼭대기에서 가장 가까운 몬스터에게 화살을 쏩니다.
// 타워가 아직 없는 쪽에서 몬스터가 와도 성이 조금은 버틸 수 있게 해 줍니다.
// 사거리·공격력·쏘는 간격은 gameConfig.js 의 castle.guard 에서 바꿉니다.
//
//   guard.update(dt)
//   guard.reset()

import * as THREE from '../../lib/three.js';

export function createCastleGuard({ castle, enemies, projectiles, config }) {
  const guard = config.castle.guard;
  const muzzle = new THREE.Vector3();
  let cooldown = 0;

  function findTarget() {
    let best = null;
    let bestDistance = guard.range;
    for (const enemy of enemies.list()) {
      if (!enemy.alive || enemy.state === 'arriving') continue;
      const distance = Math.hypot(enemy.position.x, enemy.position.z);
      if (distance <= bestDistance) {
        best = enemy;
        bestDistance = distance;
      }
    }
    return best;
  }

  return {
    update(dt) {
      if (!castle.isBuilt || castle.isDestroyed) return;
      cooldown -= dt;
      if (cooldown > 0) return;
      const target = findTarget();
      if (!target) return;
      cooldown = guard.fireInterval;
      // 성 위쪽, 적이 있는 쪽 가장자리에서 쏨
      const distance = Math.max(0.001, Math.hypot(target.position.x, target.position.z));
      const edge = Math.min(config.castle.columns / 2, 6);
      muzzle.set((target.position.x / distance) * edge, 1 + castle.figureHeight * 0.8, (target.position.z / distance) * edge);
      projectiles.fire({ kind: 'arrow', from: muzzle, target, damage: guard.damage, speed: guard.projectileSpeed });
    },
    reset() {
      cooldown = 0;
    },
  };
}
