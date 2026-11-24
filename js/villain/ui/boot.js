// ─────────────────────────────────────────────────────────────
// 악당 타이쿤: 문 열기 (villain.html 이 가장 먼저 부르는 파일)
// 진짜 게임(js/villain/main.js)이 있으면 그것을 엽니다.
// 아직 없거나 주소 끝에 ?uidemo 를 붙이면 '화면 미리보기'(demoGame.js: 화면은 진짜, 습격은 흉내)를 엽니다.
// 여는 데 실패하면 화면에 한 줄로 알려 줍니다 (자세한 내용은 브라우저 개발자 도구의 콘솔).
// 가장 먼저 말(한국어 / 영어)을 정합니다 (js/villain/lang/lang.js).
// 게임보다 먼저: 화면 크기 배율(uiScale.js)을 맞추고, 휴대폰을 세로로 들면 "가로로 돌려 주세요" 안내판(landscapeGuard.js)을 띄웁니다.
// ─────────────────────────────────────────────────────────────

import { L, GAME_TITLE } from '../lang/lang.js'; // 맨 먼저: 한국어 / 영어를 정함 (다른 파일들의 글자가 이걸 보고 골라짐)
import { initUiScale } from './uiScale.js';
import { installLandscapeGuard } from '../../core/landscapeGuard.js';
import { enableWheelRows } from './wheelRows.js';

initUiScale();
enableWheelRows(); // 옆으로 미는 카드 줄(낮은 화면의 부품 상점)을 마우스 휠로도 넘기기
installLandscapeGuard(); // 게임을 멈추는 일은 main.js 가 이 안내판을 한 번 더 불러 onChange 로 함
// 아이폰 사파리는 user-scalable=no 를 무시하고 두 손가락으로 페이지를 확대함 → 막음 (3D 확대는 게임 안 기능으로)
document.addEventListener('gesturestart', (event) => event.preventDefault());

// 화면에 보이는 글자
const TEXT = L({
  ko: { failed: '앗, 문을 여는 중에 문제가 생겼어요. 새로 고침을 해 보세요.' },
  en: { failed: 'Oops, something went wrong while opening the game. Please reload the page.' },
});

const params = new URLSearchParams(location.search);
const message = document.getElementById('bootMessage');

async function hasGame() {
  try {
    const response = await fetch(new URL('../main.js', import.meta.url), { method: 'HEAD', cache: 'no-store' });
    return response.ok;
  } catch {
    return false;
  }
}

async function boot() {
  try {
    if (!params.has('uidemo') && (await hasGame())) {
      await import('../main.js');
    } else {
      const demo = await import('./demoGame.js');
      await demo.startDemo();
    }
    message?.remove();
  } catch (error) {
    console.error(`[${GAME_TITLE}] 게임을 여는 중 문제가 생겼어요`, error);
    if (message) {
      message.textContent = TEXT.failed;
      message.classList.add('is-error');
    }
  }
}

boot();
