// 총 토끼 (총 미친토끼) 싸우는 법 — enemyAttacks.js 가 chase 부터 여기로 넘김
//   거리(keepDistance) 를 지키며 내 토끼 둘레를 옆걸음으로 빙빙 (가끔·막히면 방향 바꿈, 구석이면 물러나거나 돌아감)
//   보일 때만 쏨: 총구가 반짝(windup, 노랑·분홍 빛 블록) → 세 발(burst, 내 토끼가 가는 쪽으로 살짝 앞) → 잠깐 쉼(cooldown)
//   안 보이면 같은 거리로 빙 돌며 보이는 곳을 찾고, 오래 안 보이면 벽을 돌아 다가감
//
//   updateGunner(enemy, ctx, dt) → 이번에 걸은 빠르기 (몸짓용, 서 있으면 0)
//
// 소식: enemyWindup { kind: 'shoot' }, shot { team: 'enemy', weapon: 'enemyGun', position }
// 데미지·탄 빠르기·거리는 fightConfig.js 의 enemies.gunner, 아래는 움직임 느낌 숫자와 설정에 없는 몇 가지.

import { FIGHT } from '../fightConfig.js';
import { turnToward, facingFromDir } from './combatMath.js';
import { moveEnemy } from './enemySteering.js';
import { AIM_TURN, CHASE_TURN, SIDE_SWITCH, rand, setState, startWindup, enterChase, facePlayer, standStill } from './enemyActions.js';

const E = FIGHT.enemies;
const DEG = Math.PI / 180;

// 총 토끼
const BAND_SLACK = 4; // 지키는 거리 바깥 이만큼까지는 쏠 수 있음
const STRAFE_SPEED = 0.75; // 옆걸음 빠르기 (그 토끼 빠르기의 비율)
const RADIAL_WEIGHT = 1.3; // 너무 가깝거나 멀 때 거리를 맞추려는 힘 (옆걸음 = 1)
const SIDE_PROBE = 4; // 옆걸음 앞 이만큼 안에 벽·경계가 있으면 방향 바꿈 (칸)
const LOST_COOLDOWN = 0.6; // 쏘려다 내 토끼가 가려지면 이만큼 뒤 다시
const SEEN_BEFORE_SHOOT = 0.3; // 내 토끼가 이만큼 계속 보여야 쏠 준비 (벽 모서리에서 깜빡이지 않게)
const HUNT_AFTER = 2.5; // 내 토끼가 이만큼 안 보이면 빙 돌기를 그만두고 벽을 돌아 다가감 (초)
const LEAD = 0.5; // 내 토끼가 움직이는 쪽으로 조금 앞을 겨눔 (0 = 지금 자리, 1 = 정확히 앞질러)
const GUN_KNOCKBACK = 3; // 총알에 맞은 내 토끼가 밀리는 세기

const shotDir = { x: 0, z: 1 };
const probeFrom = { x: 0, z: 0 };
const probeTo = { x: 0, z: 0 };
const probeOut = { hit: false, point: { x: 0, z: 0 }, distance: 0, obstacle: null, normal: { x: 0, z: 0 } };

export function updateGunner(e, ctx, dt) {
  const c = e.cfg;
  const ai = e.ai;
  const p = ctx.player;
  const far = c.keepDistance[1];
  const canSee = ai.los && ai.dist <= far + BAND_SLACK;
  if (e.state === 'chase') {
    ai.cooldown -= dt;
    const dir = ai.dir;
    let want = c.speed;
    // 보이면 거리를 맞추며 옆걸음. 안 보이면 같은 거리로 빙 돌며 보이는 곳을 찾고,
    // 그래도 오래(HUNT_AFTER) 안 보이거나 너무 멀면 벽을 돌아 다가감 (보이면 다시 물러남)
    const hunting = !canSee && (ai.dist > far + BAND_SLACK || ai.unseen > HUNT_AFTER);
    if (hunting) {
      ctx.nav.toward(e.position, e.radius, p.position, dir);
    } else {
      strafeDir(e, ctx, dt, dir, canSee);
      want = c.speed * STRAFE_SPEED;
    }
    const speed = moveEnemy(e, ctx, dir.x, dir.z, want, dt);
    if (ai.los && ai.dist <= E.sightRange) {
      facePlayer(e, AIM_TURN, dt);
      e.pose.aiming = true;
    } else if (dir.x !== 0 || dir.z !== 0) {
      e.facing = turnToward(e.facing, facingFromDir(dir.x, dir.z), CHASE_TURN * dt);
    }
    if (ai.cooldown <= 0 && canSee && ai.seen >= SEEN_BEFORE_SHOOT && ctx.canAttack(e)) startWindup(e, ctx, 'shoot');
    return speed;
  }
  if (e.state === 'windup') {
    const k = Math.min(1, e.stateTime / c.windup);
    facePlayer(e, AIM_TURN, dt);
    e.pose.aiming = true;
    e.pose.windup = k;
    ctx.look.glow(e.glowIndex, e.muzzle, 0.25 + 0.75 * k);
    standStill(e, ctx, dt);
    if (!ai.los) {
      // 내 토끼가 숨었음 → 조금 뒤 다시
      ai.cooldown = LOST_COOLDOWN;
      enterChase(e);
    } else if (k >= 1) {
      setState(e, 'attack');
      ai.burstLeft = c.burst;
      ai.burstTimer = 0;
    }
    return 0;
  }
  // attack: 세 발 연속
  facePlayer(e, AIM_TURN, dt);
  e.pose.aiming = true;
  standStill(e, ctx, dt);
  ai.burstTimer -= dt;
  if (ai.burstLeft > 0) {
    ctx.look.glow(e.glowIndex, e.muzzle, 0.6);
    if (ai.burstTimer <= 0) {
      shoot(e, ctx);
      ai.burstLeft--;
      ai.burstTimer += c.burstInterval;
    }
  } else if (ai.burstTimer <= 0) {
    ai.cooldown = rand(c.cooldown[0], c.cooldown[1]);
    enterChase(e);
  }
  return 0;
}

// 옆걸음 방향: 내 토끼 둘레를 돌면서 거리 맞추기. 벽·경계·막힘이면 반대로
function strafeDir(e, ctx, dt, out, canSee) {
  const c = e.cfg;
  const ai = e.ai;
  const [near, far] = c.keepDistance;
  const mid = (near + far) / 2;
  ai.sideTimer -= dt;
  if (ai.sideTimer <= 0) {
    ai.side = -ai.side;
    ai.sideTimer = rand(SIDE_SWITCH[0], SIDE_SWITCH[1]);
  }
  let radial;
  if (!canSee) radial = ai.dist > mid ? 0.4 : 0; // 안 보일 때는 물러나지 않고 빙 돌기만
  else if (ai.dist < near) radial = -1;
  else if (ai.dist > far) radial = 1;
  else radial = ((ai.dist - mid) / (far - mid)) * 0.35;
  for (let attempt = 0; attempt < 2; attempt++) {
    const x = ai.toZ * ai.side + ai.toX * radial * RADIAL_WEIGHT;
    const z = -ai.toX * ai.side + ai.toZ * radial * RADIAL_WEIGHT;
    const length = Math.hypot(x, z) || 1;
    out.x = x / length;
    out.z = z / length;
    if (!(e.steer.blockedTime > 0.15 || blockedAhead(e, ctx, out))) return out;
    // 막힘 → 반대쪽으로
    ai.side = -ai.side;
    ai.sideTimer = rand(SIDE_SWITCH[0], SIDE_SWITCH[1]);
    e.steer.blockedTime = 0;
  }
  // 양쪽 다 막힘 (구석) → 너무 가까우면 물러나고, 아니면 돌아서 다가감
  if (canSee && ai.dist < near) {
    out.x = -ai.toX;
    out.z = -ai.toZ;
    return out;
  }
  return ctx.nav.toward(e.position, e.radius, ctx.player.position, out);
}

function blockedAhead(e, ctx, dir) {
  const bounds = ctx.collision.bounds;
  const x = e.position.x + dir.x * SIDE_PROBE;
  const z = e.position.z + dir.z * SIDE_PROBE;
  if (x - e.radius < bounds.minX || x + e.radius > bounds.maxX || z - e.radius < bounds.minZ || z + e.radius > bounds.maxZ) return true;
  probeFrom.x = e.position.x;
  probeFrom.z = e.position.z;
  probeTo.x = x;
  probeTo.z = z;
  return ctx.collision.raycast(probeFrom, probeTo, { radius: e.radius * 0.9, out: probeOut }).hit;
}

function shoot(e, ctx) {
  const c = e.cfg;
  const p = ctx.player;
  const muzzle = e.muzzle;
  // 내 토끼가 가는 쪽으로 살짝 앞을 겨눔 + 조금 퍼짐
  const time = e.ai.dist / c.bulletSpeed;
  const aimX = p.position.x + (p.velocity?.x || 0) * time * LEAD;
  const aimZ = p.position.z + (p.velocity?.z || 0) * time * LEAD;
  const angle = facingFromDir(aimX - e.position.x, aimZ - e.position.z) + (Math.random() - 0.5) * c.spreadDeg * DEG;
  shotDir.x = Math.sin(angle);
  shotDir.z = Math.cos(angle);
  ctx.bullets?.fire({
    from: muzzle,
    origin: e.position,
    dir: shotDir,
    speed: c.bulletSpeed,
    damage: c.damage,
    range: c.bulletRange,
    team: 'enemy',
    hex: c.bulletColor,
    knockback: GUN_KNOCKBACK,
  });
  ctx.fx?.muzzleFlash?.(muzzle, angle, c.bulletColor);
  ctx.events?.emit('shot', { team: 'enemy', weapon: 'enemyGun', position: muzzle.clone() });
  e.pose.recoil = 1;
}

