// ─────────────────────────────────────────────────────────────
// 악당 타이쿤: 문 열기 (villain.html 이 가장 먼저 부르는 파일)
// 진짜 게임(js/villain/main.js)이 있으면 그것을 엽니다.
// 아직 없거나 주소 끝에 ?uidemo 를 붙이면 '화면 미리보기'(demoGame.js: 화면은 진짜, 습격은 흉내)를 엽니다.
// 여는 데 실패하면 화면에 한 줄로 알려 줍니다 (자세한 내용은 브라우저 개발자 도구의 콘솔).
// ─────────────────────────────────────────────────────────────

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
    console.error('[악당 타이쿤] 게임을 여는 중 문제가 생겼어요', error);
    if (message) {
      message.textContent = '앗, 문을 여는 중에 문제가 생겼어요. 새로 고침을 해 보세요.';
      message.classList.add('is-error');
    }
  }
}

boot();
