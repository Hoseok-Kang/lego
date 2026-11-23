// ─────────────────────────────────────────────────────────────
// 악당 타이쿤: 3D 세상 묶음 (무대 + 잔해 + 효과 + 마을 + 습격 감독 + 손맛)
// 습격에 필요한 3D 부품을 한곳에서 만들고, 매 장면 한꺼번에 움직입니다. 화면(소굴·정보판)은 game.js 가 맡습니다.
//
//   const world = createGameWorld({ container, events, saveStore, floatLayer })
//   world.stage / world.debris / world.fx / world.town / world.raid / world.feedback
//   world.reset()                 새 판 준비: 괴수·영웅 치우기, 마을 새것으로, 잔해·효과·떠 있는 글자 지우기
//   world.update(dt, 배율)         한 장면. 배율: 0 = 멈춤, 1 = 보통, 2 = 두 배 빠르게 (카메라와 글자는 늘 진짜 시간으로 움직임)
//   world.render()                한 장면 그리기
//
// 여기에는 게임 숫자가 없습니다. 숫자는 villainConfig.js, 판의 흐름은 raid/raidDirector.js 에 있습니다.
// ─────────────────────────────────────────────────────────────

import { VILLAIN } from './villainConfig.js';
import { createDebris } from '../game/core/debris.js';
import { createEffects } from '../fight/render/effects.js';
import { createVillainStage } from './core/stage.js';
import { createTown } from './town/town.js';
import { createMonster } from './monster/monster.js';
import { createHero } from './hero/hero.js';
import { createRaid } from './raid/raidDirector.js';
import { createRaidFeedback } from './raid/raidFeedback.js';

const MAX_STEP = 1 / 30; // 한 번에 계산하는 가장 긴 시간 (초). 2배속이나 느린 휴대폰에서는 이만큼씩 나눠 계산

export function createGameWorld({ container, events, saveStore, floatLayer = null }) {
  const stage = createVillainStage(container);
  const debris = createDebris(stage.scene, { ...VILLAIN.debris, bounds: stage.bounds });
  const fx = createEffects(stage.scene, { pitchDeg: VILLAIN.camera.pitchDeg });
  const town = createTown(stage.scene, { debris, events, fx });
  debris.setGroundHeight(town.groundHeight); // 잔해가 길 위에 얹히게

  const raid = createRaid({
    stage,
    town,
    events,
    debris,
    fx,
    saveStore,
    makeMonster: (design) => createMonster(stage.scene, design, { debris, fx, events }),
    // 영웅은 남아 있는 건물을 돌아서 감
    makeHero: () => createHero(stage.scene, { debris, fx, events, obstacles: () => town.buildings }),
  });

  // '영웅 출동!' 은 정보판의 큰 사이렌 띠가 알리므로, 떠오르는 글자 쪽은 끔 (겹쳐 보이지 않게)
  const feedback = createRaidFeedback({ events, view: stage.view, layer: floatLayer, alertText: false });

  function reset() {
    raid.clear();
    town.reset();
    debris.clear();
    fx.clear();
    feedback.clear();
  }

  function update(dt, scale = 1) {
    const step = scale > 0 ? feedback.scale(dt * scale) : 0;
    if (step > 0) {
      const parts = Math.min(8, Math.ceil(step / MAX_STEP - 1e-6));
      const each = step / parts;
      for (let i = 0; i < parts; i++) {
        raid.update(each); // 괴수·영웅도 여기서 움직임
        town.update(each);
        debris.update(each);
        fx.update(each);
      }
    }
    if (scale > 0) feedback.update(dt);
    stage.update(dt);
  }

  return {
    stage,
    debris,
    fx,
    town,
    raid,
    feedback,
    reset,
    update,
    render: () => stage.render(),
    dispose() {
      raid.dispose();
      feedback.dispose();
      town.dispose?.();
      stage.dispose();
    },
  };
}
