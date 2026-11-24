// ─────────────────────────────────────────────────────────────
// 악당 타이쿤: 시작 파일 (ui/boot.js 가 이 파일을 엽니다)
// 게임을 만들고 화면 갱신을 시작합니다.
//
// 주소 끝에 ?capture 를 붙이면 (영상 녹화용) 화면 위 정보판이 숨고, 바깥 도구가 한 장면씩 넘기며 찍을 수 있습니다:
//   window.villain.startRaid('builtin-dino', 'harbor')       습격 시작 (괴수 id, 마을 id: village · harbor · castle)
//   window.villainCapture.step(dt, { render }) → { screen, phase, time, earned, destroyed, monsterHp, heroHp, result, townId }
//   소굴 화면에서는 3D 소굴만 화면 가득 보이고, step 이 3D 소굴도 한 장면씩 넘깁니다.
//   window.villain.lair.place('paint', 1, 5) / upgrade(id) / evaluate()   소굴에 짓기 (돈을 냄) · 강화 · 계책 계산
//   window.villain.mods() / setNotoriety(n) / setMoney(n)                  지금 소굴 효과 · 악명 · 돈 바꾸기
// 시험·디버그용으로 언제나 window.villain = game.debug (game.js 맨 위 설명 참고) 에 아래 두 가지를 더해 둡니다:
//   window.villain.setManual(true)     자동 재생을 멈춤 (false 로 다시 재생)
//   window.villain.step(dt, { render })  멈춘 동안 한 장면씩 넘기기 (?capture 의 step 과 같음)
// ─────────────────────────────────────────────────────────────

import { createVillainGame } from './game.js';
import { startFrameLoop } from '../core/frameLoop.js';

const captureMode = new URLSearchParams(location.search).has('capture');
if (captureMode) document.body.classList.add('capture');

let game = null;
try {
  game = createVillainGame({
    container: document.getElementById('stage'),
    uiRoot: document.getElementById('ui'),
    capture: captureMode,
  });
} catch (error) {
  // 3D 화면을 열 수 없는 브라우저 (WebGL 없음 등)
  const message = document.getElementById('bootMessage');
  if (message) {
    message.textContent = '이 브라우저에서는 3D 마을을 열 수 없어요. 다른 브라우저로 열어 주세요.';
    message.classList.add('is-error');
  }
  throw error;
}

let manual = captureMode;

function status() {
  const { state, raid } = game.debug;
  return {
    screen: state.screen,
    phase: raid.state.phase,
    time: raid.state.time,
    earned: raid.state.earned,
    destroyed: raid.state.destroyedRatio,
    monsterHp: raid.monster?.hp ?? 0,
    heroHp: raid.hero?.hp ?? 0,
    result: raid.result,
    townId: game.debug.world.townId,
  };
}

function step(dt, { render = true } = {}) {
  game.update(dt);
  if (render) game.render();
  return status();
}

window.villain = Object.assign(game.debug, {
  step,
  status,
  setManual(on) {
    manual = !!on;
  },
});
if (captureMode) window.villainCapture = { step, status };

startFrameLoop((dt) => {
  if (manual) return;
  game.update(dt);
  game.render();
});
