// 괴수 공격: 레이저 눈 (눈빛 모으기 → 곧은 빛줄기 → 식히기)
// 눈앞에 노란 빛 덩어리가 점점 커지고 흐릿한 조준선이 깜빡인 뒤(chargeSeconds), beamSeconds 동안 네모난 빛줄기를 쏩니다.
// 빛줄기는 노린 상대를 지나 range 끝까지 뻗고, 그 줄 위에 걸친 건물·영웅을 모두 tick 초마다 꿰뚫어 칩니다.
// 맞은 자리에는 불티가 튀고, 빛줄기가 훑은 땅에는 그을린 검은 블록이 떨어져 남아요.
// 영웅이 움직이면 빛줄기가 천천히 따라갑니다 (TRACK). 황금 수호자의 방패는 레이저도 반 막아요 (방패를 깨지는 못함).
// monsterAttacks.js 의 startAttack('laserEye', …) 가 이것을 부릅니다.
//
//   laserEye(ctx, target, mount) → { type, update(dt) → 끝났으면 true, cancel() }
//   laserReach(ctx, dir)            몸 가운데에서 빛줄기 끝까지 거리 (몸 두께 + range)
//   보내는 소식: attack { kind: 'laserCharge' } (모으기) → attack { kind: 'laser' } (쏘기), hit { kind: 'laser' }
//
// 피해·간격·거리·모으는 시간·쏘는 시간·굵기는 villainConfig.js 의 parts.types.laserEye,
// 몸짓·불티·그을림 숫자는 아래 상수, 빛 색·굵기는 laserBeam.js 에서 바꿉니다.

import * as THREE from '../../lib/three.js';
import { VILLAIN } from '../villainConfig.js';
import { smooth, clamp01, setAct } from './attackKit.js';
import { createLaserBeam } from './laserBeam.js';

const RECOVER = 0.3; // 다 쏘고 눈을 식히는 시간
const TRACK = 1.1; // 빛줄기가 움직이는 상대를 따라가는 빠르기 (초당 라디안)
const AIM_LOW = 1.4; // 빛줄기가 상대를 지나가는 높이 범위 [낮게, 높게] (칸)
const AIM_HIGH = 3.6;
const END_DROP = 0.55; // 빛줄기 끝은 지나가는 높이의 이만큼으로 (멀리 갈수록 땅으로 살짝 내려감)
const EYE_GROW = 0.65; // 힘을 다 모았을 때 눈이 커지는 정도
const SCORCH_PER_TICK = 1; // 한 번 칠 때마다 땅에 떨어지는 그을린 블록 수
const SCORCH_HEX = ['#1B2A34', '#1B2A34', '#6C6E68', '#582A12'];
const EMBER_HEX = ['#FFF03A', '#FE8A18', '#C91A09'];
const SPARK_HEX = '#FF4A2A';

const SCORCH_COLORS = SCORCH_HEX.map((hex) => new THREE.Color(hex));
const EMBER_COLORS = EMBER_HEX.map((hex) => new THREE.Color(hex));
const tmp = new THREE.Vector3();
const velocity = new THREE.Vector3();

export function laserReach(ctx, dir) {
  return ctx.extent(dir.x, dir.z) + VILLAIN.parts.types.laserEye.range;
}

export function laserEye(ctx, target, mount) {
  const cfg = VILLAIN.parts.types.laserEye;
  const scene = ctx.figure.fig.root.parent;
  const beam = createLaserBeam(scene);
  const dir = { ...ctx.dirTo(target) };
  const eye = new THREE.Vector3();
  const points = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  let t = 0;
  let phase = 'charge';
  let tick = 0; // 쏘기 시작하자마자 한 번
  let zaps = Math.max(1, Math.round(cfg.beamSeconds / cfg.tick)); // 한 번 쏠 때 지지는 횟수
  let ended = false;
  ctx.events.emit('attack', { who: ctx.self, kind: 'laserCharge', position: ctx.position });

  // 노린 상대 쪽으로 방향을 천천히 돌림 (힘 모을 때는 바로 맞춤)
  function follow(dt, instant) {
    if (!target.alive) return;
    const want = ctx.dirTo(target);
    if (instant) {
      dir.x = want.x;
      dir.z = want.z;
      return;
    }
    const now = Math.atan2(dir.x, dir.z);
    const goal = Math.atan2(want.x, want.z);
    const diff = Math.atan2(Math.sin(goal - now), Math.cos(goal - now));
    const turn = now + Math.max(-TRACK * dt, Math.min(TRACK * dt, diff));
    dir.x = Math.sin(turn);
    dir.z = Math.cos(turn);
  }

  // 빛줄기 세 점: 눈 → 노린 상대를 지나는 점 → 끝
  function layout() {
    ctx.figure.partWorld(mount, 'tip', eye);
    const p = ctx.position;
    const reach = laserReach(ctx, dir);
    const aimY = Math.min(AIM_HIGH, Math.max(AIM_LOW, (target.height || 4) * 0.4));
    const along = target.alive ? Math.min(reach, Math.max(1.5, (target.position.x - p.x) * dir.x + (target.position.z - p.z) * dir.z)) : Math.min(reach, 8);
    points[0].copy(eye);
    points[1].set(p.x + dir.x * along, aimY, p.z + dir.z * along);
    points[2].set(p.x + dir.x * reach, Math.max(0.7, aimY * END_DROP), p.z + dir.z * reach);
    return { reach, along, aimY };
  }

  // 빛줄기 위의 높이 (몸 가운데에서 along 칸)
  function heightAt(along, line) {
    if (along <= line.along) return eye.y + (line.aimY - eye.y) * clamp01(along / Math.max(0.1, line.along));
    return line.aimY + (points[2].y - line.aimY) * clamp01((along - line.along) / Math.max(0.1, line.reach - line.along));
  }

  // 한 번 지짐: 줄 위에 걸친 것은 다 맞음
  function zap(line) {
    const p = ctx.position;
    for (const other of ctx.others()) {
      const dx = other.position.x - p.x;
      const dz = other.position.z - p.z;
      const along = dx * dir.x + dz * dir.z;
      const r = other.radius || 0;
      if (along + r <= 0 || along - r > line.reach) continue;
      if (Math.abs(dx * dir.z - dz * dir.x) - r > cfg.width) continue;
      const at = Math.max(0.5, along - r * 0.7);
      tmp.set(p.x + dir.x * at, heightAt(at, line), p.z + dir.z * at);
      ctx.strike(other, cfg.damage, 'laser', tmp, SPARK_HEX);
    }
    scorch(line);
  }

  // 그을린 블록 + 끝자리 불티
  function scorch(line) {
    if (!ctx.debris) return;
    const p = ctx.position;
    for (let i = 0; i < SCORCH_PER_TICK; i++) {
      const at = line.along * 0.6 + Math.random() * (line.reach - line.along * 0.6);
      tmp.set(p.x + dir.x * at + (Math.random() - 0.5), 0.6, p.z + dir.z * at + (Math.random() - 0.5));
      velocity.set((Math.random() - 0.5) * 3, 5 + Math.random() * 4, (Math.random() - 0.5) * 3);
      ctx.debris.spawn(tmp, SCORCH_COLORS[(Math.random() * SCORCH_COLORS.length) | 0], velocity, { lifetime: 4, settle: true, scale: 0.55 + Math.random() * 0.35 });
    }
    for (let i = 0; i < 3; i++) {
      velocity.set((Math.random() - 0.5) * 12 - dir.x * 4, 7 + Math.random() * 9, (Math.random() - 0.5) * 12 - dir.z * 4);
      ctx.debris.spawn(points[2], EMBER_COLORS[i % EMBER_COLORS.length], velocity, { lifetime: 0.45, settle: false, scale: 0.3 + Math.random() * 0.2 });
    }
  }

  function finish() {
    if (ended) return;
    ended = true;
    beam.dispose();
    ctx.motion.act.charge = 0;
    if (mount.node) mount.node.scale.setScalar(1);
  }

  return {
    type: 'laserEye',
    cancel: finish,
    update(dt) {
      if (!mount.attached) {
        finish();
        return true;
      }
      t += dt;
      const act = ctx.motion.act;
      const node = mount.node;
      if (phase === 'charge') {
        // 눈이 점점 커지며 빛을 모음, 몸은 살짝 떠올라 부르르
        follow(dt, true);
        const p = clamp01(t / cfg.chargeSeconds);
        const e = smooth(p);
        act.charge = e;
        setAct(act, dir, -0.2 * e, -0.06 * e, 0);
        node.scale.setScalar(1 + EYE_GROW * e + 0.08 * e * Math.sin(t * (20 + 40 * p)));
        layout();
        beam.glow(eye, 0.3 + 1.5 * e + 0.15 * Math.sin(t * 50));
        const blink = Math.sin(t * (14 + 26 * p)) > -0.2 ? 1 : 0.25;
        beam.aim(eye, points[2], (0.25 + 0.6 * e) * blink);
        if (t >= cfg.chargeSeconds) {
          phase = 'beam';
          t = 0;
          beam.aim(eye, eye, 0);
          ctx.events.emit('attack', { who: ctx.self, kind: 'laser', position: ctx.position });
          ctx.motion.bounce(0.6);
          ctx.fx?.hitSpark?.(eye, '#FFF03A');
        }
        return false;
      }
      if (phase === 'beam') {
        // 빛줄기! 뒤로 살짝 밀리며 부르르, 눈은 번쩍번쩍
        follow(dt, false);
        const line = layout();
        const fadeIn = clamp01(t / 0.06);
        const fadeOut = clamp01((cfg.beamSeconds - t) / 0.1);
        const strength = Math.min(fadeIn, fadeOut) * (0.85 + 0.15 * Math.sin(t * 70));
        beam.fire(points, strength);
        beam.glow(eye, 1.2 + 0.3 * Math.sin(t * 45));
        act.charge = 0.35;
        setAct(act, dir, -0.45, -0.12, 0.04);
        act.shake = 0.05;
        node.scale.setScalar(1 + EYE_GROW * 0.8 + 0.06 * Math.sin(t * 60));
        tick -= dt;
        while (tick <= 0 && zaps > 0) {
          tick += cfg.tick;
          zaps--;
          zap(line);
        }
        if (t >= cfg.beamSeconds) {
          phase = 'recover';
          t = 0;
          beam.fire(null, 0);
        }
        return false;
      }
      // 식히기: 빛이 사그라들고 눈이 제 크기로
      const p = smooth(clamp01(t / RECOVER));
      beam.glow(eye, 1.1 * (1 - p));
      act.charge = 0.35 * (1 - p);
      act.shake = 0;
      node.scale.setScalar(1 + EYE_GROW * 0.8 * (1 - p));
      ctx.figure.partWorld(mount, 'tip', eye);
      if (t >= RECOVER) {
        finish();
        return true;
      }
      return false;
    },
  };
}
