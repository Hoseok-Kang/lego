// 싸우는 토끼의 몸 (내 토끼와 미친토끼가 함께 씀)
// 맞았을 때 일어나는 일을 한곳에서 처리해서, 누가 맞든 똑같이 반응합니다.
//   맞음 → 밀려남 + 하얗게 반짝 + 귀 블록이 톡톡 터져 날아감
//   체력 0 → '펑!' 하고 몸 전체가 블록으로 흩어짐 (블록은 바닥에 잔해로 남음)
//
//   const body = createFighterBody({ team, rig, maxHp, radius, debris, fx, events, view })
//   body.takeDamage({ amount, from, knockback, kind }) → { hit, dead }   공격은 반드시 이것으로
//   body.heal(양) → 다시 붙은 블록 수                                     (당근 먹기)
//   body.updateBody(dt)       매 장면마다: 반짝임·밀려남·무적 시간 줄이기 → body.knockDelta 계산
//   body.knockDelta           이번 장면에 밀려나야 할 거리 { x, z } (움직일 때 더해 주기)
//   body.reset(x, z)          처음 상태로 (다시 하기)
//   body.extraInvulnerable    () => true 이면 맞지 않음 (구르는 중 등, 주인이 정함)
//   body.position / velocity / radius / facing / alive / hurt / health / team
//
// 맞는 세기·튀는 블록 세기는 fightConfig.js 의 pop 설정에서 바꿉니다.

import * as THREE from '../../lib/three.js';
import { FIGHT } from '../fightConfig.js';
import { createHealth } from './health.js';

const HURT_DECAY = 6; // 하얗게 반짝이는 것이 사라지는 빠르기
const KNOCK_DECAY = 9; // 밀려나는 힘이 줄어드는 빠르기
const CHEST_HEIGHT = 6; // 블록이 튀어나가는 기준 높이 (토끼 가슴쯤)

export function createFighterBody({ team, rig, maxHp, radius, debris, fx, events, view, hurtInvulnerable = 0 }) {
  const health = createHealth({ maxHp, popTotal: rig.figure.popTotal ?? rig.popTotal ?? 0 });
  const knock = new THREE.Vector3();
  const hitPoint = new THREE.Vector3();

  const body = {
    team,
    position: new THREE.Vector3(),
    velocity: new THREE.Vector3(),
    radius,
    facing: 0,
    alive: true,
    hurt: 0, // 1 → 0 (맞은 직후 반짝임·뒤로 젖힘)
    iframes: 0, // 남은 무적 시간
    health,
    rig,
    knockDelta: { x: 0, z: 0 },
    extraInvulnerable: () => false,

    invulnerable() {
      return !body.alive || body.iframes > 0 || body.extraInvulnerable();
    },

    takeDamage({ amount, from = null, knockback = 0, kind = 'bullet' }) {
      if (body.invulnerable()) return { hit: false, dead: false };
      const { popped, dead } = health.damage(amount);
      body.hurt = 1;
      body.iframes = hurtInvulnerable;

      // 밀려나는 방향: 공격한 곳에서 멀어지는 쪽
      if (from && knockback > 0) {
        const dx = body.position.x - from.x;
        const dz = body.position.z - from.z;
        const length = Math.hypot(dx, dz) || 1;
        knock.x += (dx / length) * knockback;
        knock.z += (dz / length) * knockback;
      }

      hitPoint.set(from ? from.x : body.position.x, CHEST_HEIGHT * scaleOf(rig), from ? from.z : body.position.z);
      const position = body.position.clone();

      if (popped > 0 && !dead) {
        const blocks = rig.popBlocks(popped);
        debris.burst(blocks, { from: hitPoint, power: FIGHT.pop.blockPower, upward: FIGHT.pop.blockUpward });
        events.emit('earPop', { target: body, count: popped, position });
      }
      events.emit('hit', { target: body, team, damage: amount, position, kind, popped });

      if (dead) die(position);
      return { hit: true, dead };
    },

    heal(amount) {
      if (!body.alive) return 0;
      const { restored } = health.heal(amount);
      if (restored > 0) rig.restoreBlocks(restored);
      return restored;
    },

    updateBody(dt) {
      body.hurt = Math.max(0, body.hurt - dt * HURT_DECAY);
      body.iframes = Math.max(0, body.iframes - dt);
      body.knockDelta.x = knock.x * dt;
      body.knockDelta.z = knock.z * dt;
      const fade = Math.exp(-dt * KNOCK_DECAY);
      knock.x *= fade;
      knock.z *= fade;
    },

    reset(x = 0, z = 0) {
      health.reset();
      body.alive = true;
      body.hurt = 0;
      body.iframes = 0;
      knock.set(0, 0, 0);
      body.knockDelta.x = 0;
      body.knockDelta.z = 0;
      body.velocity.set(0, 0, 0);
      body.position.set(x, 0, z);
    },
  };

  // 마지막 '펑!': 남은 블록 전부가 사방으로 흩어짐
  function die(position) {
    body.alive = false;
    knock.set(0, 0, 0);
    const blocks = rig.explode();
    debris.burst(blocks, { from: hitPoint.set(position.x, CHEST_HEIGHT * 0.6 * scaleOf(rig), position.z), power: FIGHT.pop.deathPower, upward: FIGHT.pop.deathUpward });
    fx?.popRing?.(position, scaleOf(rig));
    view?.shake?.(team === 'player' ? FIGHT.pop.deathShake : FIGHT.pop.deathShake * 0.5);
    events.emit('rabbitPopped', { target: body, team, position });
  }

  return body;
}

function scaleOf(rig) {
  return rig.scale ?? 1;
}
