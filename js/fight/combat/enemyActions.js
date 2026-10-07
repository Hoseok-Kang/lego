// 미친토끼 행동 도우미 (enemyAttacks.js · enemyGunner.js · enemyBrains.js 가 함께 씀)
// 상태 바꾸기, 공격 준비 시작('enemyWindup' 소식), 쫓기로 돌아가기, 하던 공격 그만두기, 내 토끼 쪽으로 돌기 같은
// 작은 동작들을 모아 둡니다.
//
//   setState(enemy, 상태)                   상태 이름 바꾸고 상태 시간 0 으로
//   startWindup(enemy, ctx, kind)           공격 준비 시작 + enemyWindup { enemy, kind: 'stab'|'shoot'|'slam' } 소식
//   enterChase(enemy)                       쫓기 상태로 ('!' 끝난 뒤, 공격 끝난 뒤). 처음이면 총 토끼 첫 기다림·옆걸음 방향 정함
//   cancelAttack(enemy)                     하던 공격 그만 (빨간 원 지우기) — 내 토끼가 터졌을 때, 다시 하기, 터졌을 때
//   facePlayer(enemy, 빠르기, dt)            내 토끼 쪽으로 돌기
//   faceWhileChasing(enemy, 방향x, 방향z, 빠르기, dt)   가까우면 내 토끼, 멀면 걷는 쪽을 바라봄
//   standStill(enemy, ctx, dt) → 0          제자리 (밀려나기·겹침 풀기는 함)
//   rand(최소, 최대) ; CHASE_TURN, AIM_TURN, SIDE_SWITCH
//
// 도는 빠르기 같은 숫자는 아래 상수에서 바꿉니다.

import { turnToward, facingFromDir } from './combatMath.js';
import { moveEnemy } from './enemySteering.js';

export const CHASE_TURN = 9; // 쫓을 때 도는 빠르기 (라디안/초)
export const AIM_TURN = 14; // 공격 준비할 때 내 토끼 쪽으로 도는 빠르기
export const SIDE_SWITCH = [1.4, 3.2]; // 옆걸음 방향을 바꾸는 간격 (초)
const FACE_NEAR = 6; // 공격 거리 + 이만큼 안이면 걷는 쪽 대신 내 토끼를 바라봄
const FIRST_COOLDOWN = 0.5; // 총 토끼가 처음 쫓기 시작할 때 기다림 = cooldown × 이 값

export const rand = (min, max) => min + Math.random() * (max - min);

export function setState(e, state) {
  e.state = state;
  e.stateTime = 0;
}

export function startWindup(e, ctx, kind) {
  setState(e, 'windup');
  ctx.events?.emit('enemyWindup', { enemy: e, kind });
}

export function enterChase(e) {
  const ai = e.ai;
  if (!ai.engaged) {
    ai.engaged = true;
    if (e.kind === 'gunner') ai.cooldown = rand(e.cfg.cooldown[0], e.cfg.cooldown[1]) * FIRST_COOLDOWN;
    ai.side = Math.random() < 0.5 ? -1 : 1;
    ai.sideTimer = rand(SIDE_SWITCH[0], SIDE_SWITCH[1]);
  }
  setState(e, 'chase');
}

export function cancelAttack(e) {
  const ai = e.ai;
  ai.telegraph?.cancel?.();
  ai.telegraph = null;
  ai.burstLeft = 0;
}

export function facePlayer(e, rate, dt) {
  e.facing = turnToward(e.facing, facingFromDir(e.ai.toX, e.ai.toZ), rate * dt);
}

export function faceWhileChasing(e, dirX, dirZ, rate, dt) {
  const ai = e.ai;
  if (ai.los && ai.dist < (e.cfg.attackRange ?? 0) + FACE_NEAR) facePlayer(e, rate, dt);
  else if (dirX !== 0 || dirZ !== 0) e.facing = turnToward(e.facing, facingFromDir(dirX, dirZ), rate * dt);
}

export function standStill(e, ctx, dt) {
  moveEnemy(e, ctx, 0, 0, 0, dt);
  return 0;
}
