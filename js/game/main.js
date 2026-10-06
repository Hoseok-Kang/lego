// 성 지키기 시작 파일
// 게임을 만들고 화면 갱신을 시작합니다.
// 주소 끝에 ?capture 를 붙이면 영상 녹화 도구가 한 장면씩 넘기며 찍을 수 있습니다.

import { createGame } from './game.js';
import { startFrameLoop } from '../core/frameLoop.js';

const captureMode = new URLSearchParams(location.search).has('capture');

const game = await createGame({ container: document.getElementById('arena') });
window.blockDefense = game.debug;

if (captureMode) {
  document.body.classList.add('capture');
  window.blockCapture = {
    step(dt, { render = true } = {}) {
      game.update(dt);
      if (render) game.render();
      return { phase: game.debug.state.phase, wave: game.debug.state.wave };
    },
  };
} else {
  startFrameLoop((dt) => {
    game.update(dt);
    game.render();
  });
}
