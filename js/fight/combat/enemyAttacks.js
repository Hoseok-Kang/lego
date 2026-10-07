// 미친토끼 싸우는 법 (종류마다 다름) — enemyBrains.js 가 chase 부터 여기로 넘김
//   칼 토끼   지그재그로 달려옴 → 가까우면(attackRange) 웅크리며 빨갛게 떨기(windup) → 정한 쪽으로 휙 찌르며 돌진(lunge)
//             → 돌진 중 내 토끼가 칼끝 hitRadius 안이면 한 번 맞힘 → 멍하니 비틀(recover, 반격 기회)
//             공격 차례(동시에 공격하는 수 제한)를 기다릴 때는 공격 거리 바로 바깥에서 옆으로 빙빙
//   총 토끼   enemyGunner.js
//   망치 토끼 느릿느릿 쫓아옴 → 가까우면 바닥에 빨간 원(fx.telegraph) 이 차오름(windup) → 쾅!(slam)
//             원 안의 내 토끼는 크게 밀려나며 아픔 + 원 안 나무 상자도 맞음 + 땅 블록이 튀고 충격 고리 + 화면 흔들림
//             → 멍함(recover, 반격 기회) → 잠깐 쉼(cooldown)
//   공격하는 동안은 내 토끼 쪽을 바라봄. 칼 토끼는 준비 끝 무렵 방향을 정해서, 옆으로 피하거나 구르면 피할 수 있음.
//
//   updateFight(enemy, ctx, dt) → 이번에 걸은 빠르기 (몸짓용, 서 있으면 0)
//   enterChase(enemy) / cancelAttack(enemy)   (enemyActions.js 에 있는 것을 그대로 내보냄)
//
// 소식: enemyWindup { enemy, kind: 'stab'|'shoot'|'slam' }, slam { enemy, position, radius }
//       (맞는 소식 hit 는 fighterBody 가 보냄, 총 소리 shot 은 enemyGunner.js)
// 데미지·빠르기·준비 시간은 fightConfig.js 의 enemies, 아래는 움직임 느낌 숫자와 설정에 없는 몇 가지.

import { FIGHT } from '../fightConfig.js';
import { facingFromDir, turnToward } from './combatMath.js';
import { moveEnemy } from './enemySteering.js';
import { updateGunner } from './enemyGunner.js';
import { AIM_TURN, CHASE_TURN, setState, startWindup, enterChase, cancelAttack, facePlayer, faceWhileChasing, standStill } from './enemyActions.js';

export { enterChase, cancelAttack };

const DEG = Math.PI / 180;

// 칼 토끼
const ZIG_ANGLE = 0.5; // 지그재그 각도 (라디안)
const ZIG_RATE = 6.5; // 지그재그 빠르기
const ZIG_FADE = 9; // 공격 거리 + 이만큼 안으로 들어오면 지그재그가 점점 줄어 곧장 옴
const STAB_LOCK = 0.6; // 준비 시간의 이 비율이 지나면 찌를 방향이 정해짐 (그 뒤로는 안 따라옴 → 피할 수 있음)
const STAB_KNOCKBACK = 12; // 찔린 내 토끼가 밀리는 세기
const STAB_STOP_GAP = 0.3; // 돌진하다 내 토끼 몸에 이만큼 붙으면 멈춤
const STAB_ARC = 70 * DEG; // 찌를 때 그리는 칼 자국 부채꼴
const STAB_HEIGHT = 6 * FIGHT.figureScale; // 찌르는 높이 (불티 위치)
const STAB_SPARK_HEX = '#C91A09'; // 찔렸을 때 불티 색 (빨강)
const WAIT_MARGIN = 1.5; // 공격 차례를 기다릴 때: 공격 거리 + 이만큼에서 옆으로 빙빙 (내 토끼를 밀어붙이지 않게)
const WAIT_SPEED = 0.45; // 기다리며 옆걸음하는 빠르기 (그 토끼 빠르기의 비율)

// 망치 토끼
const SLAM_REACH = 5.5; // 망치가 떨어지는 곳: 몸 가운데에서 앞으로 이만큼 (× 크기)
const SLAM_IMPACT = 0.08; // 준비가 끝나고 망치가 땅에 닿기까지 (초)
const SLAM_SHAKE = 0.75; // 쾅 할 때 화면 흔들림 (내 토끼가 가까울 때)
const SLAM_SHAKE_RANGE = 45; // 이 거리보다 멀면 화면이 흔들리지 않음
const SLAM_DUST = 2.4; // 쾅 할 때 먼지 크기
const CRATE_REACH = 2; // 상자 가운데에서 이만큼까지 원에 걸리면 상자도 맞음
const SLAM_SPARK_HEX = '#F2CD37'; // 망치에 맞았을 때 불티 색 (노랑)
const BRUTE_TURN = 0.55; // 망치 토끼는 도는 것도 느릿 (다른 토끼의 이 비율)

export function updateFight(e, ctx, dt) {
  if (e.kind === 'gunner') return updateGunner(e, ctx, dt);
  if (e.kind === 'brute') return brute(e, ctx, dt);
  return knife(e, ctx, dt);
}

// ── 칼 토끼 ──
function knife(e, ctx, dt) {
  const c = e.cfg;
  const ai = e.ai;
  const p = ctx.player;
  if (e.state === 'chase') {
    const ready = ctx.canAttack(e);
    if (!ready && ai.los && ai.dist <= c.attackRange + WAIT_MARGIN) return circleWhileWaiting(e, ctx, dt);
    const dir = ctx.nav.toward(e.position, e.radius, p.position, ai.dir);
    // 지그재그 (가까워지면 곧장)
    const fade = Math.max(0, Math.min(1, (ai.dist - c.attackRange) / ZIG_FADE));
    if (fade > 0 && (dir.x !== 0 || dir.z !== 0)) {
      const angle = facingFromDir(dir.x, dir.z) + ZIG_ANGLE * fade * Math.sin(ai.time * ZIG_RATE + ai.seed);
      dir.x = Math.sin(angle);
      dir.z = Math.cos(angle);
    }
    const speed = moveEnemy(e, ctx, dir.x, dir.z, c.speed, dt);
    faceWhileChasing(e, dir.x, dir.z, CHASE_TURN, dt);
    if (ai.dist <= c.attackRange && ai.los && ready) startWindup(e, ctx, 'stab');
    return speed;
  }
  if (e.state === 'windup') {
    const k = e.stateTime / c.windup;
    if (k < STAB_LOCK) facePlayer(e, AIM_TURN, dt); // 끝 무렵에는 방향 고정 → 피할 수 있음
    e.pose.windup = Math.min(1, k);
    standStill(e, ctx, dt);
    if (k >= 1) {
      setState(e, 'attack');
      ai.lungeX = Math.sin(e.facing);
      ai.lungeZ = Math.cos(e.facing);
      ai.struck = false;
      ctx.fx?.slashArc?.(e.position, e.facing, STAB_ARC, e.radius + c.hitRadius, ai.side);
    }
    return 0;
  }
  if (e.state === 'attack') {
    // 돌진: 내 토끼 몸에 닿으면 멈춤
    let lunge = c.lungeSpeed;
    if (p.alive) {
      const ahead = (p.position.x - e.position.x) * ai.lungeX + (p.position.z - e.position.z) * ai.lungeZ;
      if (ahead > 0 && ai.dist - e.radius - p.radius <= STAB_STOP_GAP) lunge = 0;
    }
    e.facing = facingFromDir(ai.lungeX, ai.lungeZ);
    const speed = moveEnemy(e, ctx, ai.lungeX, ai.lungeZ, lunge, dt);
    if (!ai.struck && p.alive) tryStab(e, ctx);
    if (e.stateTime >= c.lungeSeconds) setState(e, 'recover');
    return lunge > 0 ? speed : 0;
  }
  // recover: 멍하니 비틀 (반격 기회)
  e.pose.stunned = true;
  standStill(e, ctx, dt);
  if (e.stateTime >= c.recover) enterChase(e);
  return 0;
}

// 공격 차례를 기다리는 동안: 공격 거리 바로 바깥에서 내 토끼를 바라보며 옆으로 빙빙
function circleWhileWaiting(e, ctx, dt) {
  const ai = e.ai;
  const hold = e.cfg.attackRange + WAIT_MARGIN * 0.5;
  const radial = Math.max(-1, Math.min(1, (ai.dist - hold) * 0.6));
  const x = ai.toZ * ai.side + ai.toX * radial;
  const z = -ai.toX * ai.side + ai.toZ * radial;
  const length = Math.hypot(x, z) || 1;
  if (e.steer.blockedTime > 0.15) {
    ai.side = -ai.side;
    e.steer.blockedTime = 0;
  }
  const speed = moveEnemy(e, ctx, x / length, z / length, e.cfg.speed * WAIT_SPEED, dt);
  facePlayer(e, AIM_TURN, dt);
  return speed;
}

// 칼끝(몸 앞) 에서 hitRadius 안에 내 토끼가 있으면 찌름 (구르는 중이면 안 맞고, 돌진 동안 다시 해 봄)
function tryStab(e, ctx) {
  const c = e.cfg;
  const ai = e.ai;
  const p = ctx.player;
  const tipX = e.position.x + ai.lungeX * e.radius;
  const tipZ = e.position.z + ai.lungeZ * e.radius;
  if (Math.hypot(p.position.x - tipX, p.position.z - tipZ) > c.hitRadius) return;
  const result = p.takeDamage({ amount: c.damage, from: e.position, knockback: STAB_KNOCKBACK, kind: 'melee' });
  if (!result.hit) return;
  ai.struck = true;
  e.spark.set((tipX + p.position.x) / 2, STAB_HEIGHT, (tipZ + p.position.z) / 2);
  ctx.fx?.hitSpark?.(e.spark, STAB_SPARK_HEX);
}

// ── 망치 토끼 ──
function brute(e, ctx, dt) {
  const c = e.cfg;
  const ai = e.ai;
  const p = ctx.player;
  if (e.state === 'chase') {
    ai.cooldown -= dt;
    const dir = ctx.nav.toward(e.position, e.radius, p.position, ai.dir);
    const speed = moveEnemy(e, ctx, dir.x, dir.z, c.speed, dt);
    faceWhileChasing(e, dir.x, dir.z, CHASE_TURN * BRUTE_TURN, dt);
    if (ai.dist <= c.attackRange && ai.los && ai.cooldown <= 0 && ctx.canAttack(e)) startSlam(e, ctx);
    return speed;
  }
  if (e.state === 'windup') {
    const k = Math.min(1, e.stateTime / c.windup);
    const angle = facingFromDir(e.slamPoint.x - e.position.x, e.slamPoint.z - e.position.z);
    e.facing = turnToward(e.facing, angle, AIM_TURN * dt);
    e.pose.windup = k;
    standStill(e, ctx, dt);
    if (k >= 1) setState(e, 'attack');
    return 0;
  }
  if (e.state === 'attack') {
    standStill(e, ctx, dt);
    if (e.stateTime >= SLAM_IMPACT) {
      slam(e, ctx);
      setState(e, 'recover');
    }
    return 0;
  }
  // recover
  e.pose.stunned = true;
  standStill(e, ctx, dt);
  if (e.stateTime >= c.recover) {
    ai.cooldown = c.cooldown;
    enterChase(e);
  }
  return 0;
}

function startSlam(e, ctx) {
  const c = e.cfg;
  const ai = e.ai;
  const bounds = ctx.collision.bounds;
  // 망치가 떨어질 곳: 내 토끼 쪽으로 몸 앞 (전장 안으로)
  const angle = facingFromDir(ai.toX, ai.toZ);
  const reach = SLAM_REACH * e.scale; // (내 토끼가 더 가까워도 원 안에 들어감)
  const x = e.position.x + Math.sin(angle) * reach;
  const z = e.position.z + Math.cos(angle) * reach;
  e.slamPoint.set(Math.max(bounds.minX, Math.min(bounds.maxX, x)), 0, Math.max(bounds.minZ, Math.min(bounds.maxZ, z)));
  ai.telegraph?.cancel?.();
  ai.telegraph = ctx.fx?.telegraph?.(e.slamPoint, c.slamRadius, c.windup + SLAM_IMPACT) ?? null;
  startWindup(e, ctx, 'slam');
}

function slam(e, ctx) {
  const c = e.cfg;
  const p = ctx.player;
  const point = e.slamPoint;
  e.ai.telegraph = null; // 빨간 원은 다 차서 저절로 사라짐
  ctx.events?.emit('slam', { enemy: e, position: point.clone(), radius: c.slamRadius });
  if (p.alive && Math.hypot(p.position.x - point.x, p.position.z - point.z) <= c.slamRadius) {
    const result = p.takeDamage({ amount: c.damage, from: point, knockback: c.knockback, kind: 'slam' });
    if (result.hit) {
      e.spark.set(p.position.x, STAB_HEIGHT, p.position.z);
      ctx.fx?.hitSpark?.(e.spark, SLAM_SPARK_HEX);
    }
  }
  // 원 안의 나무 상자도 쾅
  const props = ctx.bullets?.props;
  if (props?.crates && props.damageCrate) {
    for (const crate of props.crates) {
      if (!crate || crate.alive === false || !crate.position) continue;
      if (Math.hypot(crate.position.x - point.x, crate.position.z - point.z) > c.slamRadius + CRATE_REACH) continue;
      e.spark.set(crate.position.x, 2, crate.position.z);
      props.damageCrate(crate, c.damage, e.spark.clone());
    }
  }
  ctx.look.slamBurst(ctx.debris, point, c.slamRadius);
  ctx.fx?.dust?.(point, SLAM_DUST);
  // 망치 머리가 땅에 닿은 자리에도 먼지
  e.rig.weaponTipWorld(e.spark);
  e.spark.y = 0;
  ctx.fx?.dust?.(e.spark, SLAM_DUST * 0.5);
  const far = Math.hypot(p.position.x - point.x, p.position.z - point.z);
  if (far < SLAM_SHAKE_RANGE) ctx.view?.shake?.(SLAM_SHAKE * (1 - far / SLAM_SHAKE_RANGE));
}

