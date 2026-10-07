// 펑펑 토끼 시작 파일
// 게임을 만들고 화면 갱신을 시작합니다.
// 주소 끝에 ?capture 를 붙이면 영상 녹화 도구가 한 장면씩 넘기며 찍을 수 있습니다:
//   window.rabbitCapture.step(dt, { render }) → { phase, time, hp, alive, total }
//   (녹화 도구는 window.rabbitFight.startGame() 으로 싸움을 시작)
// 주소 끝에 ?mute 를 붙이면 소리 없이 시작합니다.
// 시험·디버그용으로 언제나 window.rabbitFight = game.debug (game.js 맨 위 설명 참고)

import { createFightGame } from './game.js';
import { startFrameLoop } from '../core/frameLoop.js';

const captureMode = new URLSearchParams(location.search).has('capture');
if (captureMode) document.body.classList.add('capture');

let game = null;
try {
  game = createFightGame({ container: document.getElementById('arena'), capture: captureMode });
} catch (error) {
  // 3D 화면을 열 수 없는 브라우저 (WebGL 없음 등)
  const message = document.getElementById('bootMessage');
  if (message) {
    message.hidden = false;
    message.textContent = '이 브라우저에서는 3D 싸움터를 열 수 없어요. 다른 브라우저로 열어 주세요.';
  }
  throw error;
}
window.rabbitFight = game.debug;

if (captureMode) {
  window.rabbitCapture = {
    step(dt, { render = true } = {}) {
      game.update(dt);
      if (render) game.render();
      const { state, player, enemies } = game.debug;
      return { phase: state.phase, time: state.time, hp: player.health.hp, alive: enemies.aliveCount(), total: enemies.total };
    },
  };
} else {
  startFrameLoop((dt) => {
    game.update(dt);
    game.render();
  });
}
