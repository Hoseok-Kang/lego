// 괴수 공격: 꼬리 철퇴 (웅크려 꼬리를 감아올렸다가 → 빙글 한 바퀴! → 비틀 돌아오기)
// 바닥에 빨간 원(닿는 범위)이 차오른 뒤 몸 전체가 세로축으로 한 바퀴 돌고, 꼬리 끝 쇠공이 지나가는 순서대로
// 둘레(range 칸 안)의 건물·영웅을 모두 칩니다. 맞은 영웅은 바깥으로 knockback 칸 밀려나요. 둘러싸였을 때 가장 좋아요.
// monsterAttacks.js 의 startAttack('tailMace', …) 가 이것을 부릅니다.
//
//   tailMace(ctx, target, mount) → { type, update(dt) → 끝났으면 true, cancel() }
//   보내는 소식: attack { kind: 'tailWind' } (감아올림) → attack { kind: 'tailSpin' } (돌기 시작), hit { kind: 'tailMace' }
//
// 피해·간격·거리·밀쳐 내는 칸은 villainConfig.js 의 parts.types.tailMace, 동작 시간·크기는 아래 상수에서 바꿉니다.

import * as THREE from '../../lib/three.js';
import { VILLAIN } from '../villainConfig.js';
import { smooth, clamp01, setAct, hitPoint, isHero, clampToTown } from './attackKit.js';

const WINDUP = 0.34; // 웅크리고 꼬리를 감아올리는 시간 (바닥에 빨간 원이 차오름)
const SPIN = 0.42; // 한 바퀴 도는 시간
const RECOVER = 0.26; // 다 돌고 비틀비틀 제자리로
const BACKSWING = 0.55; // 돌기 전에 반대쪽으로 비트는 각도 (라디안)
const TAIL_UP = 0.95; // 감아올릴 때 꼬리 각도
const MACE_GROW = 1.75; // 돌 때 철퇴가 커 보이는 배율 (멀리까지 닿는 느낌)
const SHOVE_SECONDS = 0.32; // 영웅이 밀려나는 시간
const ARC_HEIGHT = 0.45; // 휘두른 띠를 그리는 높이 (괴수 키의 몇 배)
const SPARK_HEX = '#F2CD37';

const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();
const TWO_PI = Math.PI * 2;
const wrap = (a) => ((a % TWO_PI) + TWO_PI) % TWO_PI;

export function tailMace(ctx, target, mount) {
  const cfg = VILLAIN.parts.types.tailMace;
  const dir = { ...ctx.dirTo(target) };
  const s = mount.side; // +1 오른쪽 꼬리, -1 왼쪽 꼬리
  const turn = s; // 오른쪽 꼬리는 + 방향, 왼쪽 꼬리는 - 방향으로 돎
  const rest = mount.art.rest.z;
  const reach = (ctx.extent(1, 0) + ctx.extent(0, 1)) / 2 + cfg.range; // 바닥 원 반지름 (몸은 옆으로 넓고 앞뒤로 얇아서 그 가운데쯤)
  let t = 0;
  let phase = 'windup';
  let swept = []; // 돌면서 칠 상대 [{ other, at(지나가야 할 각도) }]
  let arcs = 0; // 그린 휘두름 띠 수
  const shoves = []; // 밀려나는 영웅 [{ other, x, z, dist, t, done }]
  tmp.set(ctx.position.x, 0, ctx.position.z);
  const warning = ctx.fx?.telegraph?.(tmp, reach, WINDUP);
  ctx.events.emit('attack', { who: ctx.self, kind: 'tailWind', position: ctx.position });

  // 꼬리가 몸 회전 spin 일 때 가리키는 방향 (atan2(x, z) 각도): 오른쪽 꼬리 = +x 에서 시작
  const tailAngle = (spin) => (s * Math.PI) / 2 + spin;

  function beginSpin() {
    phase = 'spin';
    t = 0;
    ctx.events.emit('attack', { who: ctx.self, kind: 'tailSpin', position: ctx.position });
    const start = tailAngle(-turn * BACKSWING);
    swept = [];
    for (const other of ctx.others()) {
      if (ctx.gapTo(other) > cfg.range && other !== target) continue;
      if (other === target && ctx.gapTo(other) > cfg.range + 1.5) continue;
      const d = ctx.dirTo(other);
      const angle = Math.atan2(d.x, d.z);
      swept.push({ other, at: wrap(turn * (angle - start)) });
    }
    swept.sort((a, b) => a.at - b.at);
    ctx.fx?.dust?.(ctx.position, 1);
  }

  function hit(other) {
    if (!other.alive) return;
    const result = ctx.strike(other, cfg.damage, 'tailMace', hitPoint(ctx, other, tmp2), SPARK_HEX);
    if (!isHero(other) || result?.dead || !other.alive) return;
    const d = ctx.dirTo(other);
    const dist = cfg.knockback * (cfg.knockMul?.[other.kind] ?? 1);
    if (dist > 0) shoves.push({ other, x: d.x, z: d.z, dist, t: 0, moved: 0 });
  }

  // 밀려남: 처음엔 휙, 끝엔 스르르 (바닥판 밖으로는 안 나감)
  function pushHeroes(dt) {
    for (const shove of shoves) {
      if (shove.t >= SHOVE_SECONDS || !shove.other.alive) continue;
      shove.t = Math.min(SHOVE_SECONDS, shove.t + dt);
      const p = shove.t / SHOVE_SECONDS;
      const want = shove.dist * (1 - (1 - p) * (1 - p));
      const step = want - shove.moved;
      shove.moved = want;
      const pos = shove.other.position;
      pos.x += shove.x * step;
      pos.z += shove.z * step;
      clampToTown(pos);
    }
  }

  function finish() {
    const act = ctx.motion.act;
    act.spin = 0;
    if (mount.node) {
      mount.node.rotation.z = rest;
      mount.node.scale.setScalar(1);
    }
  }

  return {
    type: 'tailMace',
    cancel() {
      warning?.cancel?.();
      finish();
    },
    update(dt) {
      if (!mount.attached) {
        warning?.cancel?.();
        finish();
        return true;
      }
      t += dt;
      const act = ctx.motion.act;
      const node = mount.node;
      pushHeroes(dt);
      if (phase === 'windup') {
        // 웅크리며 반대쪽으로 몸을 비틀고 꼬리를 번쩍 감아올림
        const p = smooth(clamp01(t / WINDUP));
        setAct(act, dir, -0.3 * p, -0.08 * p, -0.2 * p);
        act.spin = -turn * BACKSWING * p;
        act.shake = 0.05 * p;
        node.rotation.z = rest + (s * TAIL_UP - rest) * p;
        node.scale.setScalar(1 + 0.35 * p + 0.06 * Math.sin(t * 40) * p);
        if (t >= WINDUP) beginSpin();
        return false;
      }
      if (phase === 'spin') {
        // 빙글! 꼬리를 쭉 펴고 한 바퀴 (처음엔 휙, 끝으로 갈수록 살짝 느려짐)
        const p = clamp01(t / SPIN);
        const sweep = (1 - (1 - p) * (1 - p)) * (TWO_PI + BACKSWING); // 비튼 자리에서 한 바퀴 + 비튼 만큼
        act.spin = turn * (sweep - BACKSWING);
        act.y = 0.5 * Math.sin(p * Math.PI);
        act.squash = 0.08 * Math.sin(p * Math.PI);
        act.shake = 0;
        node.rotation.z = s * TAIL_UP * (1 - smooth(clamp01(p * 3))); // 꼬리를 옆으로 쭉
        node.scale.setScalar(1.35 + (MACE_GROW - 1.35) * Math.sin(Math.min(1, p * 1.4) * Math.PI * 0.5));
        while (swept.length && swept[0].at <= sweep) hit(swept.shift().other);
        // 휘두른 자리에 반투명 띠 (반 바퀴 돌 때마다 지나온 반원에 하나)
        if (arcs < 2 && sweep >= Math.PI * (arcs + 1)) {
          arcs++;
          arc(act.spin);
        }
        if (t >= SPIN) {
          for (const left of swept) hit(left.other); // 빠뜨린 것 없이
          swept = [];
          phase = 'recover';
          t = 0;
          act.spin = 0; // 한 바퀴 다 돎 = 처음 방향
          ctx.motion.bounce(1.4);
          ctx.fx?.dust?.(ctx.position, 1.3);
        }
        return false;
      }
      // 다 돌고: 비틀비틀 꼬리를 내림
      const p = smooth(clamp01(t / RECOVER));
      act.spin = turn * 0.18 * Math.sin(p * Math.PI) * (1 - p);
      setAct(act, dir, 0, 0.1 * Math.sin(p * Math.PI * 2) * (1 - p), 0);
      node.rotation.z = rest * p;
      node.scale.setScalar(MACE_GROW + (1 - MACE_GROW) * p);
      if (t >= RECOVER) {
        finish();
        return shoves.every((shove) => shove.t >= SHOVE_SECONDS || !shove.other.alive);
      }
      return false;
    },
  };

  // 꼬리가 방금 지나온 반원 (지금 꼬리 방향에서 반 바퀴 뒤쪽 가운데)
  function arc(spin) {
    const facing = tailAngle(spin) - (turn * Math.PI) / 2;
    tmp.set(ctx.position.x, Math.max(1.2, ctx.model.height * ARC_HEIGHT), ctx.position.z);
    ctx.fx?.slashArc?.(tmp, facing, Math.PI * 1.05, reach, turn);
  }
}
