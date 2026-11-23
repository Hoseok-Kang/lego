// 괴수 공격 동작 (박치기, 집게발 휘두르기, 불 뿜기, 뿔 돌진)
// 공격마다 '준비 → 한 방 → 돌아오기' 를 몸짓으로 보여 주고, 한 방 순간에 상대에게 피해를 줍니다.
// monster.js 가 "지금 이 공격을 써" 하고 고르면 여기 동작이 매 장면 조금씩 진행됩니다.
//
//   startAttack(type, ctx, target, mount) → { type, update(dt) → 끝났으면 true }
//       type: 'headbutt' | 'claw' | 'fireMouth' | 'horn'   mount: 그 부품 (박치기는 null)
//       ctx: monster.js 가 주는 도구 모음 (위치, 몸짓, 효과, 피해 주기 등)
//   attackCooldown(type) → 다음에 또 쓸 수 있을 때까지 시간(초)
//
// 피해량·거리·간격은 villainConfig.js, 동작 시간·크기는 아래 상수에서 바꿉니다.

import * as THREE from '../../lib/three.js';
import { VILLAIN } from '../villainConfig.js';

const PARTS = VILLAIN.parts.types;
const FIRE_HEXES = ['#FFF03A', '#F2CD37', '#FE8A18', '#FE8A18', '#C91A09'];
const FIRE_COLORS = FIRE_HEXES.map((hex) => new THREE.Color(hex));
const FIRE_RATE = 95; // 초당 불 블록 수
const FIRE_SPEED = 30; // 불 블록 빠르기 (초당 칸)
const FIRE_CONE = 0.38; // 불이 닿는 부채꼴 반쪽 각도 (라디안)
const HORN_WINDUP = 0.55; // 뿔 돌진 전 웅크리는 시간 (바닥에 빨간 원이 차오름)
const HORN_MIN_GAP = 3; // 이보다 가까우면 돌진하지 않음

const smooth = (t) => t * t * (3 - 2 * t);
const clamp01 = (t) => Math.min(1, Math.max(0, t));
const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();
const velocity = new THREE.Vector3();

export const HORN_MIN_DISTANCE = HORN_MIN_GAP;

export function attackCooldown(type) {
  if (type === 'headbutt') return VILLAIN.monster.headbutt.interval;
  const cfg = PARTS[type];
  if (type === 'fireMouth') return cfg.burstSeconds + cfg.restSeconds;
  return cfg.interval;
}

export function startAttack(type, ctx, target, mount) {
  if (type === 'claw') return claw(ctx, target, mount);
  if (type === 'fireMouth') return fire(ctx, target, mount);
  if (type === 'horn') return horn(ctx, target, mount);
  return headbutt(ctx, target);
}

// 상대 몸에서 맞는 자리 (괴수 쪽 겉면, 적당한 높이)
function hitPoint(ctx, target, out) {
  const dir = ctx.dirTo(target);
  const y = Math.min(Math.max(1, (target.height || 4) * 0.5), ctx.model.height * 0.6 + 1);
  return out.set(target.position.x - dir.x * (target.radius || 1) * 0.7, y, target.position.z - dir.z * (target.radius || 1) * 0.7);
}

// ── 박치기: 몸을 뒤로 뺐다가 쿵 ──
function headbutt(ctx, target) {
  const cfg = VILLAIN.monster.headbutt;
  const dir = { ...ctx.dirTo(target) };
  const reach = Math.min(2.6, Math.max(0.8, ctx.gapTo(target) + 0.7));
  let t = 0;
  let struck = false;
  ctx.events.emit('attack', { who: ctx.self, kind: 'headbutt', position: ctx.position });
  return {
    type: 'headbutt',
    update(dt) {
      t += dt;
      const act = ctx.motion.act;
      if (t < 0.2) {
        const p = smooth(t / 0.2);
        setAct(act, dir, -0.9 * p, -0.2 * p, -0.14 * p);
      } else if (t < 0.28) {
        const p = (t - 0.2) / 0.08;
        setAct(act, dir, -0.9 + (reach + 0.9) * p, -0.2 + 0.48 * p, 0.12 * p);
      } else {
        if (!struck) {
          struck = true;
          ctx.motion.bounce(1.2);
          if (target.alive) ctx.strike(target, cfg.damage, 'headbutt', hitPoint(ctx, target, tmp));
        }
        const p = smooth(clamp01((t - 0.28) / 0.3));
        setAct(act, dir, reach * (1 - p), 0.28 * (1 - p), 0);
      }
      return t >= 0.58;
    },
  };
}

function setAct(act, dir, offset, tilt, squash) {
  act.x = dir.x * offset;
  act.z = dir.z * offset;
  act.tiltX = dir.x * tilt;
  act.tiltZ = dir.z * tilt;
  act.squash = squash;
}

// ── 집게발: 번쩍 들었다가 크게 휘둘러 내려침 ──
function claw(ctx, target, mount) {
  const cfg = PARTS.claw;
  const dir = { ...ctx.dirTo(target) };
  const rest = mount.art.rest.z;
  const s = mount.side;
  let t = 0;
  let struck = false;
  ctx.events.emit('attack', { who: ctx.self, kind: 'claw', position: ctx.position });
  return {
    type: 'claw',
    update(dt) {
      if (!mount.attached) return true;
      t += dt;
      const node = mount.node;
      const act = ctx.motion.act;
      if (t < 0.24) {
        const p = smooth(t / 0.24);
        node.rotation.z = rest + (s * 2.0 - rest) * p; // 머리 위로 번쩍
        node.scale.setScalar(1 + 0.45 * p);
        setAct(act, dir, -0.6 * p, -0.16 * p, 0.06 * p);
      } else if (t < 0.33) {
        const p = (t - 0.24) / 0.09;
        node.rotation.z = s * (2.0 - 2.9 * p); // 휙 내려침
        node.scale.setScalar(1.45 + 0.15 * p);
        setAct(act, dir, -0.6 + 2.1 * p, -0.16 + 0.42 * p, 0.06 - 0.16 * p);
      } else {
        if (!struck) {
          struck = true;
          ctx.motion.bounce(0.8);
          const reach = ctx.extent(dir.x, dir.z) + cfg.range + 1.5;
          tmp.set(ctx.position.x, Math.min(ctx.model.height * 0.4 + 1, 5), ctx.position.z);
          ctx.fx?.slashArc?.(tmp, Math.atan2(dir.x, dir.z), 2.3, reach, s);
          // 휘두른 범위 안의 것은 다 맞음 (노린 상대는 꼭)
          for (const other of ctx.others()) {
            if (other === target) continue;
            const od = ctx.dirTo(other);
            if (ctx.gapTo(other) <= cfg.range * 0.6 && od.x * dir.x + od.z * dir.z > 0.45) ctx.strike(other, cfg.damage * 0.5, 'claw', hitPoint(ctx, other, tmp2));
          }
          if (target.alive) ctx.strike(target, cfg.damage, 'claw', hitPoint(ctx, target, tmp2));
        }
        const p = smooth(clamp01((t - 0.33) / 0.32));
        node.rotation.z = s * -0.9 + (rest - s * -0.9) * p;
        node.scale.setScalar(1.6 - 0.6 * p);
        setAct(act, dir, 1.5 * (1 - p), 0.26 * (1 - p), -0.1 * (1 - p));
      }
      return t >= 0.65;
    },
  };
}

// ── 불 뿜기: 입에서 불 블록이 줄줄이 날아가 부채꼴 안을 태움 ──
function fire(ctx, target, mount) {
  const cfg = PARTS.fireMouth;
  const gravity = VILLAIN.debris.gravity;
  let t = 0;
  let spawnDebt = 0;
  let tick = 0.12;
  let lastDir = { ...ctx.dirTo(target) };
  const aim = new THREE.Vector3();
  ctx.events.emit('attack', { who: ctx.self, kind: 'fire', position: ctx.position });
  return {
    type: 'fireMouth',
    update(dt) {
      if (!mount.attached) return true;
      t += dt;
      const node = mount.node;
      const act = ctx.motion.act;
      const burning = t < cfg.burstSeconds;
      if (target.alive) lastDir = { ...ctx.dirTo(target) };
      const dir = lastDir;
      if (!burning) {
        node.scale.setScalar(1);
        return true;
      }
      // 몸: 뒤로 젖히고 부르르
      const lean = smooth(clamp01(t / 0.15));
      setAct(act, dir, -0.5 * lean, -0.14 * lean, 0.05 * Math.sin(t * 40));
      act.shake = 0.07;
      node.scale.setScalar(1.25 + 0.12 * Math.sin(t * 46));

      // 불 블록: 입 → 상대 발치 쪽으로 포물선
      const mouth = ctx.figure.partWorld(mount, 'tip', tmp);
      if (target.alive) aim.set(target.position.x, Math.min(2.5, (target.height || 3) * 0.4), target.position.z);
      else aim.set(mouth.x + dir.x * cfg.range * 0.7, 1, mouth.z + dir.z * cfg.range * 0.7);
      const flat = Math.max(1.5, Math.hypot(aim.x - mouth.x, aim.z - mouth.z));
      const flight = flat / FIRE_SPEED;
      const fx = (aim.x - mouth.x) / flat;
      const fz = (aim.z - mouth.z) / flat;
      spawnDebt += FIRE_RATE * dt;
      while (spawnDebt >= 1 && ctx.debris) {
        spawnDebt -= 1;
        const wobble = (Math.random() - 0.5) * 0.3;
        const speed = FIRE_SPEED * (0.85 + Math.random() * 0.3);
        velocity.set((fx + fz * wobble) * speed, (aim.y - mouth.y) / flight + 0.5 * gravity * flight + (Math.random() - 0.5) * 5, (fz - fx * wobble) * speed);
        ctx.debris.spawn(mouth, FIRE_COLORS[(Math.random() * FIRE_COLORS.length) | 0], velocity, {
          lifetime: flight + 0.42,
          settle: false,
          scale: 0.6 + Math.random() * 0.6,
        });
      }

      // 일정 간격으로 부채꼴 안의 모든 것에 피해
      tick -= dt;
      if (tick <= 0) {
        tick += cfg.interval;
        for (const other of ctx.others()) {
          const od = ctx.dirTo(other);
          const inCone = od.x * dir.x + od.z * dir.z >= Math.cos(FIRE_CONE);
          if (other !== target && !(inCone && ctx.gapTo(other) <= cfg.range)) continue;
          if (other === target && ctx.gapTo(other) > cfg.range + 2) continue;
          ctx.strike(other, cfg.damage, 'fire', hitPoint(ctx, other, tmp2), '#FE8A18');
        }
      }
      return false;
    },
  };
}

// ── 뿔 돌진: 웅크렸다가 한 줄로 달려가 쿵 ──
function horn(ctx, target, mount) {
  const cfg = PARTS.horn;
  const dir = { ...ctx.dirTo(target) };
  const distance = Math.min(cfg.range + 4, ctx.gapTo(target) + 1.2);
  const struckSet = new Set();
  let t = 0;
  let travelled = 0;
  let phase = 'windup';
  let dustDebt = 0;
  tmp.set(target.position.x, 0, target.position.z);
  const warning = ctx.fx?.telegraph?.(tmp, Math.max(2.2, (target.radius || 1) + 1), HORN_WINDUP);
  ctx.events.emit('attack', { who: ctx.self, kind: 'horn', position: ctx.position });

  function impact(big) {
    phase = 'recover';
    t = 0;
    ctx.motion.bounce(big ? 2.2 : 1);
    ctx.fx?.dust?.(ctx.position, 1.2);
  }

  return {
    type: 'horn',
    update(dt) {
      if (!mount.attached) {
        warning?.cancel?.();
        return true;
      }
      t += dt;
      const act = ctx.motion.act;
      if (phase === 'windup') {
        const p = smooth(clamp01(t / (HORN_WINDUP * 0.6)));
        setAct(act, dir, -1.2 * p, -0.24 * p, -0.2 * p);
        act.shake = 0.09 * p;
        mount.node.scale.setScalar(1 + 0.4 * p);
        if (t >= HORN_WINDUP) {
          phase = 'dash';
          t = 0;
          ctx.events.emit('attack', { who: ctx.self, kind: 'hornDash', position: ctx.position });
        }
        return false;
      }
      if (phase === 'dash') {
        const move = Math.min(cfg.dashSpeed * dt, distance - travelled);
        const moved = ctx.moveBy(dir.x * move, dir.z * move);
        travelled += move;
        setAct(act, dir, 0.6, 0.42, 0.1);
        act.y = 0.35 + 0.25 * Math.sin(t * 30);
        dustDebt += dt;
        if (dustDebt > 0.07) {
          dustDebt = 0;
          ctx.fx?.dust?.(ctx.position, 0.8);
        }
        // 지나가며 닿는 것은 다 들이받음 (하나에 한 번)
        let hitMain = false;
        for (const other of ctx.others()) {
          if (struckSet.has(other) || ctx.gapTo(other) > 0.35) continue;
          const od = ctx.dirTo(other);
          if (other !== target && od.x * dir.x + od.z * dir.z < 0.2) continue;
          struckSet.add(other);
          ctx.strike(other, cfg.damage, 'horn', hitPoint(ctx, other, tmp2), '#FFF03A');
          if (other === target) hitMain = true;
        }
        if (hitMain) impact(true);
        else if (travelled >= distance - 1e-3 || moved < move * 0.5 || !target.alive) impact(struckSet.size > 0);
        return false;
      }
      // 부딪힌 뒤: 살짝 튕겨 물러나며 자세 풀기
      const p = smooth(clamp01(t / 0.4));
      if (t < 0.12) ctx.moveBy(-dir.x * 9 * dt, -dir.z * 9 * dt);
      setAct(act, dir, 0.6 * (1 - p), 0.42 * (1 - p), 0);
      mount.node.scale.setScalar(1.4 - 0.4 * p);
      return t >= 0.4;
    },
  };
}
