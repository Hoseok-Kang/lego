// 괴수 직접 조종 (습격 중에 놀이하는 사람이 괴수를 움직이고 공격 단추를 누를 때)
// monster.js 가 만들어 씁니다. 직접 조종 중에는 괴수의 자동 판단(노릴 상대 고르기 · 공격 고르기)이 쉬고,
// 여기서 걷기(막대 · 키 방향)와 공격(누른 단추)을 맡습니다. 걷는 빠르기 · 공격 피해 · 식는 시간은 자동일 때와 똑같습니다.
//
//   const drive = createManualDrive(ctx, attacks, speed)
//       ctx: monster.js 의 도구 모음 (위치, 거리 재기, 상대 목록, 움직이기)
//       attacks: 괴수의 공격 목록 (부품이 떨어지면 줄어듦),  speed: 괴수 걷는 빠르기 (초당 칸)
//   drive.on / drive.setOn(참/거짓)       직접 조종 중인지 (끄면 걷던 방향 · 노리던 상대를 잊음)
//   drive.steer({ x, z } | null)          걷는 방향 (길이 0~1, 화면 위쪽 = -z, 오른쪽 = +x). null 이면 멈춤
//   drive.aimAt(상대 | null) / drive.aim   노릴 상대 (마우스 · 손가락으로 누른 건물 · 영웅). 막대를 놓고 있으면 그쪽으로 걸어감
//   drive.face(x, z)                      바라보는 방향 기억 (자동으로 걸을 때도 monster.js 가 알려 줌)
//   drive.walk(dt, pace) → { x, z, speed } | null   한 장면 걷기 (pace: 얼음으로 느려진 배율)
//       건물은 뚫고 지나가지 않고 옆으로 미끄러짐, 마을 밖으로는 못 나감 (moveBy 가 막음)
//   drive.start(type, mustHit) → 공격 동작 | null   그 공격을 지금 시작 (식는 중 · 부품이 떨어졌으면 null)
//       mustHit: 참이면 닿는 상대가 있을 때만 (허공에는 안 씀)
//   drive.cooldownOf(type) → 0~1          0 = 바로 쓸 수 있음, 1 = 막 썼음 (그 부품이 없거나 떨어졌어도 1)
//
// 노릴 것 고르기 (공격이 닿는 것 가운데): ① 누른 상대 ② 가까운 영웅 ③ 걷는 방향 앞쪽의 가까운 건물.
// 닿는 것이 없으면 걷는 방향 앞 허공에 씁니다 (뿔은 앞으로 돌진, 레이저는 앞으로 쏘고, 꼬리는 제자리에서 빙글).
// 숫자는 villainConfig.js 의 control 에서 바꿉니다.

import * as THREE from '../../lib/three.js';
import { VILLAIN } from '../villainConfig.js';
import { startAttack, attackCooldown } from './monsterAttacks.js';
import { isHero } from './attackKit.js';

const CLOSE_GAP = 0.5; // 누른 상대에게 이만큼 가까워지면 더 다가가지 않음 (monster.js 와 같음)
const AIR_REACH = 0.8; // 닿는 것이 없을 때 허공 과녁을 공격 거리의 이만큼 앞에 둠
const STUCK_SHARE = 0.15; // 가려던 거리의 이만큼도 못 가면 (벽 · 건물에 막힘) 제자리에 선 것으로 봄

export function createManualDrive(ctx, attacks, speed) {
  const cfg = VILLAIN.control;
  const facing = { x: 1, z: 0 };
  const steerVec = { x: 0, z: 0 };
  // 허공 과녁: 아무것도 아님 (상대 목록에 없어서 맞을 일이 없음). 뿔은 살아 있어야 끝까지 달리므로 그때만 alive
  const air = { team: 'none', kind: 'air', alive: false, radius: 0.4, height: 3, position: new THREE.Vector3() };
  let on = false;
  let aim = null;

  // 그 이름의 공격 가운데 가장 먼저 준비되는 것 (같은 부품이 둘 붙은 괴수도 있음)
  function readiest(type) {
    let best = null;
    for (const attack of attacks) if (attack.type === type && (!best || attack.cd < best.cd)) best = attack;
    return best;
  }

  // 건물과 겹치면 밖으로 밀어냄 (옆으로 미끄러지게)
  function pushOut() {
    for (const other of ctx.others()) {
      if (!other.totalBlocks) continue; // 건물만 (영웅은 스스로 비킴)
      const gap = ctx.gapTo(other);
      if (gap >= 0) continue;
      const d = ctx.dirTo(other);
      ctx.moveBy(d.x * gap, d.z * gap);
    }
  }

  function walk(dt, pace) {
    let dx = steerVec.x;
    let dz = steerVec.z;
    let strength = Math.min(1, Math.hypot(dx, dz));
    let limit = Infinity;
    if (strength < 0.02) {
      // 막대를 놓고 있음: 누른 상대가 있으면 그쪽으로 (가까워지면 멈춤)
      if (!aim || !aim.alive) return null;
      const gap = ctx.gapTo(aim);
      if (gap <= CLOSE_GAP) return null;
      const d = ctx.dirTo(aim);
      dx = d.x;
      dz = d.z;
      strength = 1;
      limit = gap - CLOSE_GAP + 0.01;
    }
    const length = Math.hypot(dx, dz) || 1;
    dx /= length;
    dz /= length;
    facing.x = dx;
    facing.z = dz;
    const velocity = speed * pace * strength;
    const want = Math.min(velocity * dt, limit);
    const beforeX = ctx.position.x;
    const beforeZ = ctx.position.z;
    ctx.moveBy(dx * want, dz * want);
    pushOut();
    const moved = Math.hypot(ctx.position.x - beforeX, ctx.position.z - beforeZ);
    return moved >= want * STUCK_SHARE ? { x: dx, z: dz, speed: velocity } : null;
  }

  // 공격이 닿는 것 가운데 노릴 것 하나 (없으면 허공)
  function pick(type, range) {
    const reach = range; // 자동일 때와 같은 거리 (더 멀리서 치지 않음)
    if (aim && aim.alive && ctx.gapTo(aim) <= reach) return aim;
    let best = null;
    let bestScore = Infinity;
    for (const other of ctx.others()) {
      const gap = ctx.gapTo(other);
      if (gap > reach) continue;
      if (isHero(other) && gap <= cfg.heroFirst) return other; // 가까운 영웅이 먼저
      const d = ctx.dirTo(other);
      const score = gap + cfg.frontWeight * (1 - (d.x * facing.x + d.z * facing.z)); // 뒤쪽일수록 먼 것처럼
      if (score < bestScore) {
        bestScore = score;
        best = other;
      }
    }
    if (best) return best;
    const along = ctx.extent(facing.x, facing.z) + Math.max(1.5, range * AIR_REACH);
    air.position.set(ctx.position.x + facing.x * along, 0, ctx.position.z + facing.z * along);
    air.alive = type === 'horn';
    return air;
  }

  function start(type, mustHit = false) {
    const attack = readiest(type);
    if (!attack || attack.cd > 0) return null;
    const foe = pick(type, attack.range);
    if (mustHit && foe === air) return null; // 누르고 있을 때는 닿는 것이 있을 때만 (허공만 치다가 못 걷는 일이 없게)
    attack.cd = attackCooldown(type); // 자동일 때와 같은 식는 시간
    return startAttack(type, ctx, foe, attack.mount);
  }

  return {
    get on() {
      return on;
    },
    get aim() {
      return aim && aim.alive ? aim : null;
    },
    setOn(next) {
      on = !!next;
      if (!on) {
        steerVec.x = 0;
        steerVec.z = 0;
        aim = null;
      }
    },
    steer(vector) {
      steerVec.x = Number(vector?.x) || 0;
      steerVec.z = Number(vector?.z) || 0;
      const length = Math.hypot(steerVec.x, steerVec.z);
      if (length > 1) {
        steerVec.x /= length;
        steerVec.z /= length;
      }
      if (length > 0.02) {
        facing.x = steerVec.x / length; // 공격 중이라 못 걸어도 막대 쪽을 봄 (다음 공격이 그쪽을 노림)
        facing.z = steerVec.z / length;
      }
    },
    aimAt(other) {
      aim = other && other.alive && other.team !== 'villain' ? other : null;
    },
    face(x, z) {
      facing.x = x;
      facing.z = z;
    },
    walk,
    start,
    cooldownOf(type) {
      const attack = readiest(type);
      if (!attack) return 1;
      return Math.max(0, Math.min(1, attack.cd / attackCooldown(type)));
    },
  };
}
