// 영웅 만들기 (마을마다 다른 영웅: 꼬마 마을 = 번개 기사, 바닷가 마을 = 얼음 마법사, 왕궁 성곽 = 황금 수호자)
// 마을이 부서지면 하늘에서 내려와 괴수와 싸웁니다. 싸움은 전부 저절로 흘러가요.
//
//   const hero = createHero(scene, { kind, hpMul, debris, fx, events, bounds?, obstacles? })
//       kind: 'knight' | 'iceMage' | 'guardian' (안 주면 'knight'),  hpMul: 체력 배율 (소굴의 함정 효과, 1 = 그대로)
//       obstacles: () => 건물 목록 (예: () => town.buildings) — 주면 남아 있는 건물을 뚫고 지나가지 않고 돌아서 감
//   hero.enter(position)          그 자리에 하늘에서 떨어져 등장. 착지하면 'heroArrived' 소식
//   hero.setTarget(monster)       싸울 상대 (과녁: position, radius, alive, takeDamage)
//   hero.setObstacles(() => 건물 목록)
//   hero.update(dt)
//   hero.active                   마을에 나와 있고 살아 있음
//   hero.team('town') / kind / name / position(바닥 점) / radius / height / alive / hp / maxHp / state
//   hero.takeDamage({ amount, from, kind }) → { dead }     (떨어지는 중에는 안 맞음, 수호자는 방패로 앞쪽 피해를 줄임)
//   hero.reset() (다시 숨김, 새 체력) ; hero.dispose()
//   heroStats(kind) → 그 영웅의 숫자 (VILLAIN.heroes[kind]. 나오는 시점 숫자가 없으면 VILLAIN.hero 에서)
//   HERO_KINDS                    영웅 종류 목록
//
// 보내는 소식: heroArrived { hero }, attack { who, kind, position }, hit { target, amount, position, kind },
//            blocksBroken { count, source: 'hero', position }, heroPopped { hero }, heroLanded { position, kind }
//            + 얼음 마법사: heroBlink { from, to }, 황금 수호자: heroShield { on, position }, heroBlocked { position, amount }
// 영웅 숫자(체력·빠르기·공격)는 villainConfig.js 의 heroes (번개 기사는 hero), 몸짓 느낌은 각 영웅 파일 위쪽 상수에서 바꿉니다.

import { VILLAIN } from '../villainConfig.js';
import { createKnight } from './knight.js';
import { createIceMage } from './iceMage.js';
import { createGuardian } from './guardian.js';

const MAKERS = { knight: createKnight, iceMage: createIceMage, guardian: createGuardian };

export const HERO_KINDS = Object.keys(MAKERS);

// 영웅이 나오는 시점 같은 공통 숫자는 영웅 숫자에 없으면 번개 기사(VILLAIN.hero) 것을 씀
const SHARED = ['appearAtDestroyed', 'appearLatestSeconds', 'alertSeconds'];

export function heroStats(kind = 'knight') {
  const key = MAKERS[kind] ? kind : 'knight';
  const own = VILLAIN.heroes?.[key] || (key === 'knight' ? VILLAIN.hero : {});
  const out = { ...own };
  for (const name of SHARED) if (out[name] === undefined) out[name] = VILLAIN.hero[name];
  return out;
}

export function createHero(scene, { kind = 'knight', hpMul = 1, ...options } = {}) {
  const key = MAKERS[kind] ? kind : 'knight';
  return MAKERS[key](scene, { ...options, stats: heroStats(key), hpMul });
}
