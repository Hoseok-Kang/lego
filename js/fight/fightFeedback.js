// 싸움 반응 (게임 소식 → 떠오르는 글자 · 화면 반응 · 당근 떨어뜨리기 · 기록 세기)
// 맞으면 '-10', 터지면 '펑!', 당근을 먹으면 '+30' 이 떠오르고, 내 토끼가 맞으면 화면 가장자리가 빨갛게 번쩍.
// 미친토끼가 터지거나 상자가 부서지면 정해진 확률로 당근이 톡 튀어나옵니다.
// 한 판 동안 쏜 수·맞힌 수·터뜨린 수를 세어 결과 화면(명중률)에 씁니다.
//
//   const stats = createRoundStats()
//   stats.reset() ; stats.shots / hits / swings / swingHits / kills ; stats.accuracy (0~1, 쏜 적 없으면 NaN)
//   connectFightFeedback({ world, hud, floats, stats, hitStop }) → 연결 끊는 함수
//       hitStop(초): 멈칫 요청 (game.js 가 받아서 잠깐 멈춤)
//
// 당근 확률은 fightConfig.js 의 carrots.dropChance / crates.carrotChance,
// 글자 높이·화면 흔들림 세기는 아래 상수에서 바꿉니다.

import { FIGHT } from './fightConfig.js';

const HEAD_HEIGHT = 19; // 떠오르는 글자를 시작하는 높이 (토끼 귀 끝쯤, 큰 토끼는 크기만큼 곱함)
const POP_TEXT_HEIGHT = 10; // '펑!' 글자 높이 (터진 자리 가운데쯤)
const DEFLECT_TEXT_HEIGHT = 1; // '팅!' 은 총알 높이에서 조금 위
const BIG_HIT = 20; // 이만큼 이상 맞히면 큰 글자
const PLAYER_HIT_SHAKE = 0.3; // 내 토끼가 맞았을 때 화면 흔들림
const CRATE_BREAK_SHAKE = 0.25; // 상자가 와르르 부서질 때 화면 흔들림
const POP_HIT_STOP = 0.06; // 미친토끼가 '펑' 할 때 아주 잠깐 멈칫 (타격감)

export function createRoundStats() {
  const stats = {
    shots: 0, // 블록 총 발사 수
    hits: 0, // 블록 총알이 미친토끼에 맞은 수
    swings: 0, // 칼 휘두른 수
    swingHits: 0, // 미친토끼를 하나라도 맞힌 휘두르기 수
    kills: 0,
    swingHit: false, // 이번 휘두르기가 이미 맞혔는지
    reset() {
      stats.shots = stats.hits = stats.swings = stats.swingHits = stats.kills = 0;
      stats.swingHit = false;
    },
    // 명중률 = (맞은 총알 + 맞힌 휘두르기) / (쏜 총알 + 휘두르기)
    get accuracy() {
      const tries = stats.shots + stats.swings;
      return tries > 0 ? Math.min(1, (stats.hits + stats.swingHits) / tries) : NaN;
    },
  };
  return stats;
}

export function connectFightFeedback({ world, hud, floats, stats, hitStop = () => {} }) {
  const { events, view, pickups, player } = world;
  const offs = [];
  const on = (name, fn) => offs.push(events.on(name, fn));

  on('shot', ({ team }) => {
    if (team !== 'player') return;
    stats.shots++;
    hud.pulseCrosshair?.();
  });

  on('swing', ({ team }) => {
    if (team !== 'player') return;
    stats.swings++;
    stats.swingHit = false;
  });

  // hit 의 team = 맞은 쪽
  on('hit', ({ target, team, damage, position, kind }) => {
    const scale = target?.rig?.scale ?? 1;
    const amount = Math.max(1, Math.round(damage));
    if (team === 'player') {
      floats.add(position, `-${amount}`, { kind: 'hurt', height: HEAD_HEIGHT * scale });
      hud.flashDamage();
      view.shake(PLAYER_HIT_SHAKE);
      return;
    }
    floats.add(position, `-${amount}`, { kind: amount >= BIG_HIT ? 'big' : 'damage', height: HEAD_HEIGHT * scale });
    if (kind === 'bullet') stats.hits++;
    else if (kind === 'melee' && !stats.swingHit) {
      stats.swingHit = true;
      stats.swingHits++;
    }
  });

  on('rabbitPopped', ({ target, team, position }) => {
    const scale = target?.rig?.scale ?? 1;
    floats.add(position, '펑!', { kind: 'pop', height: POP_TEXT_HEIGHT * scale });
    if (team !== 'enemy') return;
    stats.kills++;
    hitStop(POP_HIT_STOP);
    if (Math.random() < FIGHT.carrots.dropChance) pickups.spawn(position.x, position.z);
  });

  on('crateBroken', ({ position }) => {
    view.shake(CRATE_BREAK_SHAKE);
    if (Math.random() < FIGHT.crates.carrotChance) pickups.spawn(position.x, position.z);
  });

  on('carrotEaten', ({ healed }) => {
    if (healed > 0) floats.add(player.position, `+${Math.round(healed)}`, { kind: 'heal' });
  });

  on('reloadStart', () => floats.add(player.position, '장전!', { kind: 'info' }));

  on('bulletBlocked', ({ position, surface }) => {
    if (surface === 'deflect') floats.add(position, '팅!', { kind: 'deflect', height: DEFLECT_TEXT_HEIGHT });
  });

  return () => offs.forEach((off) => off?.());
}
