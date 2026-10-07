// 내 토끼의 무기 (블록 총 + 블록 칼)
// 블록 총: 누르고 있으면 계속 쏨. 탄이 조금 퍼지고, 쏠 때마다 반동. 탄창이 비면 저절로 장전.
//          장전 중에 방아쇠를 누르면 '딸깍'(dryFire). 칼을 들고 있어도 장전은 계속됨.
// 블록 칼: 휘두르면 앞으로 살짝 나가며(lunge) 넓은 부채꼴을 휙 쓸어 냄. 칼날이 지나가는 순서대로
//          미친토끼를 맞힘 (한 번 휘두를 때 한 마리당 한 번만). 맞히면 아주 잠깐 멈칫(hitStop).
//          휘두르는 동안 칼에 닿은 적 총알은 지워짐. 나무 상자도 칼로 부술 수 있음.
// three.js 를 직접 쓰지 않아서 node 에서도 시험할 수 있습니다.
//
//   const weapons = createPlayerWeapons({ bullets, fx, events, getEnemies, props })
//       getEnemies() → 미친토끼 목록 (fighter), props: 상자 부수기용 (없으면 bullets.props 를 씀)
//   weapons.update(dt, { holding, pressed, position, facing, muzzle, target }) → frame
//       holding: 공격 버튼을 누르고 있음, pressed: 이번 장면에 막 누름
//       position: 내 토끼 발밑 (Vector3), facing: 바라보는 각도, muzzle: 총구 세상 위치 (Vector3)
//       target: 겨눈 곳 { x, z } | null (조준 도움: 바라보는 쪽에서 조금 벗어나 있어도 그쪽으로 쏨)
//       총알은 총구에서 나오지만, 맞는 계산은 '토끼 가운데 → 겨눈 쪽' 길로 함 (bullets.fire 의 origin)
//       frame = { recoil 0~1, swing -1|0~1, swingSide ±1, hitStop 초, lunge 앞으로 나가는 빠르기,
//                 swingFacing 휘두르는 방향, fired 쐈는지, swung 휘두르기 시작했는지, hits 이번에 맞힌 수 }
//   weapons.switchTo('blaster'|'sword') → 바뀌었는지 ; weapons.cycle() ; weapons.reload()
//   weapons.cancelSwing()                  (구르기 시작할 때)
//   weapons.reset()                        (다시 하기)
//   weapons.info() → { id, name, ammo, magazine, reloading, reloadProgress }   (HUD 에 그대로 넘기기)
//   weapons.current ('blaster'|'sword') / ammo / magazine / reloading / reloadProgress 0~1 / swinging / swingFacing
//
// 소식: shot, swing, reloadStart, reloadDone, dryFire, weaponSwitched
// 데미지·빠르기·탄창 같은 숫자는 fightConfig.js 의 weapons 에서 바꿉니다. 아래는 손맛(보이는 느낌) 숫자.

import { FIGHT } from '../fightConfig.js';
import { wrapAngle, facingFromDir, inArc } from './combatMath.js';

const BLASTER = FIGHT.weapons.blaster;
const SWORD = FIGHT.weapons.sword;
export const WEAPON_IDS = ['blaster', 'sword'];
const DEG = Math.PI / 180;

const RECOIL_DECAY = 9; // 총 반동 자세가 풀리는 빠르기 (1초에 이만큼)
const FIRST_SHOT_SPREAD = 0.25; // 잠깐 쉬었다 쏜 첫 발은 덜 퍼짐 (퍼짐 비율)
const SETTLE_SECONDS = 0.3; // 이만큼 안 쏘면 다음 발이 '첫 발'
const MAX_ASSIST = 0.35; // 겨눈 곳(target) 쪽으로 총알을 꺾어 줄 수 있는 최대 각도 (바라보는 쪽 기준, 라디안)
const MIN_AIM_DISTANCE = 1.5; // 겨눈 곳이 토끼 가운데에서 이보다 가까우면 그냥 바라보는 쪽으로 쏨
const DRY_FIRE_GAP = 0.25; // 빈 총 '딸깍' 최소 간격 (초)
// 칼날이 맞히는 순서를 화면 속 칼 모션(rabbitRig)과 맞춤: 처음 SWING_WINDUP 비율은 칼을 뒤로 빼는 중,
// 그 뒤 점점 느려지며 끝까지 (팔이 따라오는 시간까지 계산한 곡선)
const SWING_WINDUP = 0.22;
const SLASH_AT = 0.18; // 휘두르기 이 비율에서 칼 자국 효과를 그림 (칼이 움직이기 시작할 때)
const LUNGE_HOLD = 0.5; // 휘두르기 이 비율까지는 lunge 최고 빠르기, 그 뒤 줄어듦
const CRATE_REACH = 2.4; // 칼이 상자에 닿는 크기 (상자 반지름)
const SPARK_HEIGHT = 5.5; // 칼에 맞은 자리 불꽃 높이
const SPARK_HEX = '#F4F4F4';

export function createPlayerWeapons({ bullets, fx = null, events, getEnemies = () => [], props = null }) {
  let current = WEAPON_IDS.includes(FIGHT.player.startWeapon) ? FIGHT.player.startWeapon : 'blaster';
  let ammo = BLASTER.magazine;
  let reloading = false;
  let reloadTimer = 0;
  let fireCooldown = 0;
  let sinceShot = 99;
  let dryTimer = 0;
  let recoil = 0;

  let swingCooldown = 0;
  let swingTime = -1; // -1 = 휘두르는 중 아님
  let swingSide = -1; // 처음 휘두르면 +1 (오른쪽 → 왼쪽)
  let swingFacing = 0;
  let prevRel = 0;
  let slashShown = false;
  const hitEnemies = []; // 이번 휘두르기에서 이미 맞힌 적
  const hitCrates = [];
  const spark = { x: 0, y: 0, z: 0 };
  let cratePoint = null;

  const frame = { recoil: 0, swing: -1, swingSide: 1, hitStop: 0, lunge: 0, swingFacing: 0, fired: false, swung: false, hits: 0 };
  const hudInfo = { id: current, name: '', ammo: 0, magazine: BLASTER.magazine, reloading: false, reloadProgress: 0 };

  const copy = (v) => (v && v.clone ? v.clone() : { x: v.x, y: v.y, z: v.z });

  // ── 장전 ──
  function startReload() {
    if (reloading || ammo >= BLASTER.magazine) return false;
    reloading = true;
    reloadTimer = BLASTER.reloadSeconds;
    events.emit('reloadStart', { weapon: 'blaster' });
    return true;
  }

  function finishReload() {
    reloading = false;
    reloadTimer = 0;
    ammo = BLASTER.magazine;
    events.emit('reloadDone', { weapon: 'blaster' });
  }

  // ── 총 ──
  function updateBlaster(trigger, pressed, input) {
    if (!trigger) {
      if (fireCooldown < 0) fireCooldown = 0;
      return;
    }
    if (reloading || ammo <= 0) {
      if (fireCooldown < 0) fireCooldown = 0;
      if (!reloading) startReload();
      if (pressed && dryTimer <= 0) {
        dryTimer = DRY_FIRE_GAP;
        events.emit('dryFire', {});
      }
      return;
    }
    if (fireCooldown > 0) return;
    shoot(input);
    fireCooldown += BLASTER.interval;
    if (fireCooldown < 0) fireCooldown = 0; // 너무 밀린 박자는 버림 (한 장면에 한 발까지만)
  }

  function shoot({ position, facing, muzzle, target }) {
    ammo -= 1;
    recoil = 1;
    // 총알 길은 토끼 가운데에서 시작 (bullets.js 의 origin). 겨눈 곳이 있으면 그쪽으로
    let base = facing;
    if (target) {
      const dx = target.x - position.x;
      const dz = target.z - position.z;
      if (Math.hypot(dx, dz) >= MIN_AIM_DISTANCE) {
        const diff = wrapAngle(facingFromDir(dx, dz) - facing);
        base = facing + Math.max(-MAX_ASSIST, Math.min(MAX_ASSIST, diff));
      }
    }
    const spread = BLASTER.spreadDeg * DEG * (sinceShot > SETTLE_SECONDS ? FIRST_SHOT_SPREAD : 1);
    const angle = base + (Math.random() - 0.5) * spread;
    sinceShot = 0;
    bullets.fire({
      from: muzzle,
      origin: position,
      dir: { x: Math.sin(angle), z: Math.cos(angle) },
      speed: BLASTER.bulletSpeed,
      damage: BLASTER.damage,
      range: BLASTER.bulletRange,
      team: 'player',
      hex: BLASTER.bulletColor,
      knockback: BLASTER.knockback,
    });
    fx?.muzzleFlash?.(muzzle, angle, BLASTER.bulletColor);
    events.emit('shot', { team: 'player', weapon: 'blaster', position: copy(muzzle) });
    frame.fired = true;
    if (ammo <= 0) startReload();
  }

  // ── 칼 ──
  // 칼날 각도 (휘두르는 방향 기준): 처음엔 뒤로 살짝 뺐다가 휙 (rabbitRig 의 팔 모션과 같은 곡선)
  function bladeRel(k) {
    const e = k < SWING_WINDUP ? 0 : easeOutQuad((k - SWING_WINDUP) / (1 - SWING_WINDUP));
    const arc = SWORD.arcDeg * DEG;
    return swingSide * (-arc / 2 + arc * e);
  }

  function startSwing({ position, facing }) {
    swingSide = -swingSide;
    swingTime = 0;
    swingFacing = facing;
    swingCooldown = SWORD.interval;
    prevRel = bladeRel(0);
    hitEnemies.length = 0;
    hitCrates.length = 0;
    slashShown = false;
    events.emit('swing', { team: 'player', weapon: 'sword', position: copy(position) });
    frame.swung = true;
  }

  function advanceSwing(dt, { position }) {
    swingTime += dt;
    const k = Math.min(1, swingTime / SWORD.swingSeconds);
    if (!slashShown && k >= SLASH_AT) {
      slashShown = true;
      fx?.slashArc?.(position, swingFacing, SWORD.arcDeg * DEG, SWORD.range, swingSide);
    }
    const rel = bladeRel(k);
    // 지난 장면 칼날 ~ 지금 칼날 사이 부채꼴만 검사 → 칼날이 지나가는 순서대로 맞음
    const center = swingFacing + (prevRel + rel) / 2;
    const width = Math.abs(rel - prevRel);
    prevRel = rel;
    sweepEnemies(position, center, width);
    sweepCrates(position, center, width);
    if (SWORD.deflectBullets) bullets.deflect?.(position, swingFacing, SWORD.arcDeg * DEG, SWORD.range, 'player');
    frame.lunge = SWORD.lunge * (k < LUNGE_HOLD ? 1 : (1 - k) / (1 - LUNGE_HOLD));
    if (k >= 1) swingTime = -1;
  }

  function sweepEnemies(position, center, width) {
    const enemies = getEnemies() || [];
    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];
      if (!enemy || !enemy.alive || hitEnemies.includes(enemy)) continue;
      if (!inArc(position.x, position.z, center, width, SWORD.range, enemy.position.x, enemy.position.z, enemy.radius || 0)) continue;
      hitEnemies.push(enemy);
      const result = enemy.takeDamage({ amount: SWORD.damage, from: position, knockback: SWORD.knockback, kind: 'melee' });
      if (!result || !result.hit) continue;
      frame.hits += 1;
      frame.hitStop = Math.max(frame.hitStop, SWORD.hitStop);
      // 불꽃: 적 몸 가장자리 (내 쪽)
      const dx = position.x - enemy.position.x;
      const dz = position.z - enemy.position.z;
      const d = Math.hypot(dx, dz) || 1;
      const r = Math.min(enemy.radius || 0, d);
      spark.x = enemy.position.x + (dx / d) * r;
      spark.y = SPARK_HEIGHT;
      spark.z = enemy.position.z + (dz / d) * r;
      fx?.hitSpark?.(spark, SPARK_HEX);
    }
  }

  function sweepCrates(position, center, width) {
    const source = props || bullets.props;
    const crates = source?.crates;
    if (!crates || !source.damageCrate) return;
    for (let i = 0; i < crates.length; i++) {
      const crate = crates[i];
      if (!crate || crate.alive === false || hitCrates.includes(crate) || !crate.position) continue;
      if (!inArc(position.x, position.z, center, width, SWORD.range, crate.position.x, crate.position.z, CRATE_REACH)) continue;
      hitCrates.push(crate);
      if (!cratePoint) cratePoint = position.clone ? position.clone() : { x: 0, y: 0, z: 0 };
      const dx = position.x - crate.position.x;
      const dz = position.z - crate.position.z;
      const d = Math.hypot(dx, dz) || 1;
      cratePoint.x = crate.position.x + (dx / d) * CRATE_REACH * 0.8;
      cratePoint.y = SPARK_HEIGHT * 0.5;
      cratePoint.z = crate.position.z + (dz / d) * CRATE_REACH * 0.8;
      source.damageCrate(crate, SWORD.damage, cratePoint);
    }
  }

  // ── 매 장면 ──
  function update(dt, input) {
    frame.hitStop = 0;
    frame.fired = false;
    frame.swung = false;
    frame.hits = 0;
    frame.lunge = 0;

    if (reloading) {
      reloadTimer -= dt;
      if (reloadTimer <= 0) finishReload();
    }
    fireCooldown -= dt;
    swingCooldown = Math.max(0, swingCooldown - dt);
    dryTimer = Math.max(0, dryTimer - dt);
    sinceShot += dt;
    recoil = Math.max(0, recoil - dt * RECOIL_DECAY);

    const pressed = !!input.pressed;
    const trigger = !!input.holding || pressed;
    if (current === 'blaster') updateBlaster(trigger, pressed, input);
    else if (trigger && swingCooldown <= 0 && swingTime < 0) startSwing(input);
    if (swingTime >= 0) advanceSwing(dt, input);

    frame.recoil = recoil;
    frame.swing = swingTime >= 0 ? Math.min(1, swingTime / SWORD.swingSeconds) : -1;
    frame.swingSide = swingSide;
    frame.swingFacing = swingFacing;
    return frame;
  }

  function switchTo(id) {
    if (!WEAPON_IDS.includes(id) || id === current) return false;
    current = id;
    swingTime = -1;
    fireCooldown = Math.max(fireCooldown, 0);
    events.emit('weaponSwitched', { weapon: id });
    if (id === 'blaster' && ammo <= 0) startReload();
    return true;
  }

  function reset() {
    current = WEAPON_IDS.includes(FIGHT.player.startWeapon) ? FIGHT.player.startWeapon : 'blaster';
    ammo = BLASTER.magazine;
    reloading = false;
    reloadTimer = 0;
    fireCooldown = 0;
    swingCooldown = 0;
    swingTime = -1;
    swingSide = -1;
    sinceShot = 99;
    dryTimer = 0;
    recoil = 0;
    hitEnemies.length = 0;
    hitCrates.length = 0;
  }

  function info() {
    hudInfo.id = current;
    hudInfo.name = FIGHT.weapons[current].name;
    hudInfo.ammo = ammo;
    hudInfo.magazine = BLASTER.magazine;
    hudInfo.reloading = reloading;
    hudInfo.reloadProgress = reloading ? 1 - reloadTimer / BLASTER.reloadSeconds : 0;
    return hudInfo;
  }

  return {
    update,
    switchTo,
    cycle: () => switchTo(WEAPON_IDS[(WEAPON_IDS.indexOf(current) + 1) % WEAPON_IDS.length]),
    reload: () => startReload(),
    cancelSwing() {
      swingTime = -1;
    },
    reset,
    info,
    get current() {
      return current;
    },
    get name() {
      return FIGHT.weapons[current].name;
    },
    get ammo() {
      return ammo;
    },
    get magazine() {
      return BLASTER.magazine;
    },
    get reloading() {
      return reloading;
    },
    get reloadProgress() {
      return reloading ? 1 - reloadTimer / BLASTER.reloadSeconds : 0;
    },
    get swinging() {
      return swingTime >= 0;
    },
    get swingFacing() {
      return swingFacing;
    },
  };
}

function easeOutQuad(t) {
  const u = 1 - Math.min(1, Math.max(0, t));
  return 1 - u * u;
}
