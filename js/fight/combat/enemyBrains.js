// 미친토끼 머리 (무엇을 할지 정하기) — 세 종류가 함께 쓰는 부분
// 상태: idle(쉬기) → alert('!' 깜짝) → chase(쫓기) → windup(공격 준비) → attack(공격) → recover(멍함) → chase …
//   idle   처음 자리 둘레를 깡충깡충 돌아다니고, 멈춰서 두리번거림
//          내 토끼가 보이면(sightRange 안 + 가리는 것 없음) 또는 맞으면 깨어남 → 근처 친구도 차례로 깨움
//   alert  머리 위에 빨간 '!' 가 뜨고 깜짝 뛰며 내 토끼 쪽으로 돎 → alertDelay 뒤 쫓기 시작
//   chase 부터는 종류마다 다름 (enemyAttacks.js)
//   내 토끼가 터지면 모두 공격을 멈추고 그 자리에서 다시 쉼 (깡충깡충 = 신난 모습)
//
//   createBrainMemory() → 미친토끼마다 하나씩 들고 있는 기억 칸
//   resetBrain(enemy)                         처음 상태(idle)로 (다시 하기)
//   updateEnemyBrain(enemy, ctx, dt)           매 장면: 보고 → 정하고 → 움직이고 → 몸짓(pose) 채우기
//   becomeAlert(enemy, ctx, 친구도깨우기)       깨우기 ('!' + enemyAlert 소식)
//       ctx = { collision, bullets, fx, debris, events, view, player, nav, list, look, dt, wakeFriends(e), canAttack(e) }
//
// 돌아다니는 거리·두리번 빠르기 같은 '보이는 느낌' 숫자는 아래 상수, 게임 숫자는 fightConfig.js 의 enemies.

import { FIGHT } from '../fightConfig.js';
import { turnToward, facingFromDir } from './combatMath.js';
import { moveEnemy } from './enemySteering.js';
import { updateFight } from './enemyAttacks.js';
import { enterChase, cancelAttack } from './enemyActions.js';

const E = FIGHT.enemies;
const WANDER_RADIUS = 5; // 쉴 때 처음 자리에서 이만큼 안을 돌아다님 (칸)
const WANDER_SPEED = 0.3; // 쉴 때 걷는 빠르기 (그 토끼 빠르기의 비율)
const WANDER_PAUSE = [1.2, 3.0]; // 한 번 멈춰서 두리번거리는 시간 (최소, 최대 초)
const WANDER_GIVE_UP = 3; // 이만큼 걸어도 못 가면 그냥 멈춤 (초)
const LOOK_GAP = [0.5, 1.4]; // 두리번: 고개(몸) 돌리는 간격 (초)
const LOOK_SWING = 1.3; // 두리번: 한 번에 도는 최대 각도 (라디안)
const IDLE_TURN = 4; // 쉴 때 도는 빠르기 (라디안/초)
const ALERT_TURN = 16; // '!' 할 때 내 토끼 쪽으로 홱 도는 빠르기
const ALERT_HOP = 0.28; // '!' 할 때 깜짝 뛰는 시간 (초)
const ALERT_SHOW = 1.1; // '!' 가 머리 위에 떠 있는 시간 (초)
const SIGHT_SLACK = 1.4; // 깨어난 뒤에는 sightRange × 이만큼까지 내 토끼를 봄 (가리는 것 확인)
const RECOIL_DECAY = 7; // 총 반동 자세가 풀리는 빠르기
const MOVE_SMOOTH = 10; // 뛰는 몸짓이 빠르기를 따라가는 정도
const MOVE_LOOK = { knife: 1, gunner: 0.85, brute: 0.75 }; // 최고 빠르기로 뛸 때 깡충 세기 (망치 토끼는 묵직하게)

const rand = (min, max) => min + Math.random() * (max - min);

export function createBrainMemory() {
  return {
    time: 0,
    seed: Math.random() * 10,
    dist: Infinity, // 내 토끼까지 거리
    toX: 0, // 내 토끼 쪽 방향 (길이 1)
    toZ: 1,
    los: false, // 내 토끼가 보이는지 (가리는 것 없음)
    seen: 0, // 계속 보인 시간 (초)
    unseen: 99, // 안 보인 지 얼마나 됐는지 (초)
    move: 0, // 몸짓에 넘기는 깡충 세기 (부드럽게)
    wakeDelay: -1, // 친구가 깨워서 깨어나기까지 남은 시간 (-1 = 없음)
    wanderX: 0,
    wanderZ: 0,
    wanderTime: 0,
    pause: 0,
    lookTimer: 0,
    lookFacing: 0,
    dir: { x: 0, z: 0 }, // 가려는 방향 (돌려 씀)
    // 공격 (enemyAttacks.js)
    cooldown: 0,
    side: 1,
    sideTimer: 0,
    lungeX: 0,
    lungeZ: 1,
    struck: false,
    burstLeft: 0,
    burstTimer: 0,
    telegraph: null,
    engaged: false,
  };
}

export function resetBrain(e) {
  Object.assign(e.ai, createBrainMemory(), { dir: e.ai.dir });
  e.state = 'idle';
  e.stateTime = 0;
  e.ai.pause = rand(0.2, WANDER_PAUSE[1]);
  e.ai.lookFacing = e.facing;
  e.pose.windup = 0;
  e.pose.recoil = 0;
  e.pose.stunned = false;
  e.pose.aiming = false;
  e.pose.move = 0;
}

export function updateEnemyBrain(e, ctx, dt) {
  const ai = e.ai;
  const pose = e.pose;
  ai.time += dt;
  e.stateTime += dt;
  sense(e, ctx);
  pose.recoil = Math.max(0, pose.recoil - dt * RECOIL_DECAY);
  pose.windup = 0;
  pose.stunned = false;
  pose.aiming = false;

  // 내 토끼가 터졌으면 공격을 멈추고 쉬기
  if (!(ctx.player && ctx.player.alive) && e.state !== 'idle') calmDown(e);

  let speed;
  let hop = -1; // 0 이상이면 몸짓 깡충 세기를 이 값으로
  if (e.state === 'idle') speed = idle(e, ctx, dt);
  else if (e.state === 'alert') {
    speed = alert(e, ctx, dt);
    if (e.stateTime < ALERT_HOP) hop = 0.9;
  } else speed = updateFight(e, ctx, dt);

  const target = Math.min(1, speed / e.cfg.speed) * (MOVE_LOOK[e.kind] ?? 1);
  ai.move += (target - ai.move) * Math.min(1, dt * MOVE_SMOOTH);
  if (target === 0 && ai.move < 0.04) ai.move = 0;
  pose.move = hop >= 0 ? hop : ai.move;
  pose.facing = e.facing;
  pose.hurt = e.hurt;
}

// 보기: 내 토끼까지 거리·방향, 가리는 것이 없는지
function sense(e, ctx) {
  const ai = e.ai;
  const p = ctx.player;
  if (!p) {
    ai.dist = Infinity;
    ai.los = false;
    return;
  }
  const dx = p.position.x - e.position.x;
  const dz = p.position.z - e.position.z;
  const d = Math.hypot(dx, dz);
  ai.dist = d;
  if (d > 1e-6) {
    ai.toX = dx / d;
    ai.toZ = dz / d;
  }
  const range = e.state === 'idle' ? E.sightRange : E.sightRange * SIGHT_SLACK;
  ai.los = p.alive && d <= range && ctx.collision.lineOfSight(e.position, p.position);
  if (ai.los) {
    ai.seen += ctx.dt;
    ai.unseen = 0;
  } else {
    ai.seen = 0;
    ai.unseen += ctx.dt;
  }
}

function idle(e, ctx, dt) {
  const ai = e.ai;
  const playerUp = ctx.player && ctx.player.alive;
  if (ai.wakeDelay >= 0 && playerUp) {
    ai.wakeDelay -= dt;
    if (ai.wakeDelay <= 0) {
      becomeAlert(e, ctx, true); // 깨어난 친구도 그 둘레 친구를 깨움 (차례차례 몰려옴)
      return 0;
    }
  }
  if (playerUp && ai.dist <= E.sightRange && ai.los) {
    becomeAlert(e, ctx, true);
    return 0;
  }

  // 멈춰서 두리번
  if (ai.pause > 0) {
    ai.pause -= dt;
    ai.lookTimer -= dt;
    if (ai.lookTimer <= 0) {
      ai.lookFacing = e.facing + rand(-LOOK_SWING, LOOK_SWING);
      ai.lookTimer = rand(LOOK_GAP[0], LOOK_GAP[1]);
    }
    e.facing = turnToward(e.facing, ai.lookFacing, IDLE_TURN * dt);
    moveEnemy(e, ctx, 0, 0, 0, dt);
    if (ai.pause <= 0) pickWanderTarget(e, ctx);
    return 0;
  }

  // 처음 자리 둘레의 한 곳으로 깡충깡충
  ai.wanderTime += dt;
  const dx = ai.wanderX - e.position.x;
  const dz = ai.wanderZ - e.position.z;
  const d = Math.hypot(dx, dz);
  if (d < 0.8 || ai.wanderTime > WANDER_GIVE_UP) {
    ai.pause = rand(WANDER_PAUSE[0], WANDER_PAUSE[1]);
    ai.lookTimer = rand(0.2, 0.6);
    moveEnemy(e, ctx, 0, 0, 0, dt);
    return 0;
  }
  e.facing = turnToward(e.facing, facingFromDir(dx, dz), IDLE_TURN * 2 * dt);
  return moveEnemy(e, ctx, dx / d, dz / d, e.cfg.speed * WANDER_SPEED, dt);
}

function pickWanderTarget(e, ctx) {
  const ai = e.ai;
  const bounds = ctx.collision.bounds;
  ai.wanderTime = 0;
  for (let tries = 0; tries < 8; tries++) {
    const angle = Math.random() * Math.PI * 2;
    const r = rand(1.5, WANDER_RADIUS);
    const x = e.spawn.x + Math.sin(angle) * r;
    const z = e.spawn.z + Math.cos(angle) * r;
    if (x - e.radius < bounds.minX || x + e.radius > bounds.maxX || z - e.radius < bounds.minZ || z + e.radius > bounds.maxZ) continue;
    if (ctx.collision.overlapsCircle(x, z, e.radius)) continue;
    ai.wanderX = x;
    ai.wanderZ = z;
    return;
  }
  // 갈 곳이 없으면 조금 더 쉬기
  ai.wanderX = e.position.x;
  ai.wanderZ = e.position.z;
  ai.pause = rand(WANDER_PAUSE[0], WANDER_PAUSE[1]);
}

export function becomeAlert(e, ctx, spread) {
  if (!e.alive || e.state !== 'idle') return;
  e.state = 'alert';
  e.stateTime = 0;
  e.ai.wakeDelay = -1;
  ctx.fx?.alert?.(() => (e.alive ? e.position : null), ALERT_SHOW, e.alertLift); // 터지면 '!' 도 바로 숨김
  ctx.events?.emit('enemyAlert', { enemy: e });
  if (spread) ctx.wakeFriends(e);
}

function alert(e, ctx, dt) {
  const ai = e.ai;
  e.facing = turnToward(e.facing, facingFromDir(ai.toX, ai.toZ), ALERT_TURN * dt);
  moveEnemy(e, ctx, 0, 0, 0, dt);
  if (e.stateTime >= E.alertDelay) enterChase(e);
  return 0;
}

// 내 토끼가 터짐 → 그 자리 둘레에서 다시 쉬기
function calmDown(e) {
  cancelAttack(e);
  e.state = 'idle';
  e.stateTime = 0;
  e.spawn.x = e.position.x;
  e.spawn.z = e.position.z;
  e.ai.wakeDelay = -1;
  e.ai.pause = rand(0.3, 1.2);
  e.ai.lookFacing = e.facing;
}
