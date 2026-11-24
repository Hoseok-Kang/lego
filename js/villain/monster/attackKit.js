// 괴수 공격 도우미 (공격 파일들이 같이 쓰는 작은 계산)
// monsterAttacks.js(박치기·집게발·불·뿔), tailMaceAttack.js(꼬리 철퇴), laserEyeAttack.js(레이저 눈)가 가져다 씁니다.
//
//   smooth(t) / clamp01(t)              0~1 부드럽게 · 0~1 로 자르기
//   setAct(act, dir, offset, tilt, squash)   몸짓 값 한 번에 (dir 쪽으로 offset 칸 나가고 tilt 만큼 숙이고 squash 만큼 눌림)
//   hitPoint(ctx, target, out)          상대 몸에서 맞는 자리 (괴수 쪽 겉면, 적당한 높이)
//   isHero(other)                       영웅인지 (건물은 totalBlocks 가 있음)
//   clampToTown(position)               마을 바닥판 안으로 (영웅을 밀쳐 낼 때 바깥으로 나가지 않게)
//   countNear(ctx, range) / countInLine(ctx, dir, reach, width)   둘레 · 한 줄 위에 있는 상대 수
//
// 숫자는 각 공격 파일과 villainConfig.js 에서 바꿉니다.

import { VILLAIN } from '../villainConfig.js';

export const smooth = (t) => t * t * (3 - 2 * t);
export const clamp01 = (t) => Math.min(1, Math.max(0, t));

export function setAct(act, dir, offset, tilt, squash) {
  act.x = dir.x * offset;
  act.z = dir.z * offset;
  act.tiltX = dir.x * tilt;
  act.tiltZ = dir.z * tilt;
  act.squash = squash;
}

export function hitPoint(ctx, target, out) {
  const dir = ctx.dirTo(target);
  const y = Math.min(Math.max(1, (target.height || 4) * 0.5), ctx.model.height * 0.6 + 1);
  return out.set(target.position.x - dir.x * (target.radius || 1) * 0.7, y, target.position.z - dir.z * (target.radius || 1) * 0.7);
}

export const isHero = (other) => !!other && !other.totalBlocks && other.team !== 'villain';

// 영웅·괴수가 쓰는 기본 바닥판 범위 (monster.js · heroBody.js 와 같은 계산)
export function clampToTown(position) {
  const town = VILLAIN.town;
  position.x = Math.min(town.width / 2 - 1, Math.max(-town.width / 2 + 1, position.x));
  position.z = Math.min(town.depth / 2 - 1, Math.max(-town.depth / 2 + 1, position.z));
  return position;
}

// 몸에서 range 칸 안에 있는 상대 수
export function countNear(ctx, range) {
  let n = 0;
  for (const other of ctx.others()) if (ctx.gapTo(other) <= range) n++;
  return n;
}

// (dir 쪽으로) 몸 가운데에서 reach 칸 안, 줄에서 width 칸 안에 걸치는 상대 수
export function countInLine(ctx, dir, reach, width) {
  let n = 0;
  const p = ctx.position;
  for (const other of ctx.others()) {
    const dx = other.position.x - p.x;
    const dz = other.position.z - p.z;
    const along = dx * dir.x + dz * dir.z;
    const r = other.radius || 0;
    if (along + r <= 0 || along - r > reach) continue;
    if (Math.abs(dx * dir.z - dz * dir.x) - r <= width) n++;
  }
  return n;
}
