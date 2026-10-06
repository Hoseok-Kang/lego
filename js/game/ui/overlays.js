// 시작 · 결과 화면
// 처음 화면(게임 방법 + [게임 시작] [내 그림 넣기]),
// 성이 무너졌을 때, 모든 웨이브를 막았을 때 나오는 안내 카드를 맡습니다.
// 뒤에서 성이 쌓이는 모습이 보이도록 화면 한쪽만 반투명하게 덮습니다.
// 문구는 game.html 의 #startOverlay, #gameOverOverlay, #victoryOverlay 에서,
// 모양은 css/game.css 의 '8. 시작 · 결과 화면' 에서 바꿉니다.
//
//   const overlays = createOverlays({ onStart, onRestart, onOpenArt })
//   overlays.showStart()
//   overlays.showGameOver({ wave, total, kills })
//   overlays.showVictory({ wave, total, kills, hp })
//   overlays.hide()
// 결과 카드의 숫자는 game.html 에서 data-field="wave" 처럼 이름 붙은 칸에 채워 넣습니다.

export function createOverlays({ onStart, onRestart, onOpenArt }) {
  const el = (id) => document.getElementById(id);
  const screens = {
    start: el('startOverlay'),
    gameOver: el('gameOverOverlay'),
    victory: el('victoryOverlay'),
  };

  // 게임이 준비되면 '블록을 꺼내는 중…' 글자를 치움
  const bootMessage = el('bootMessage');
  if (bootMessage) bootMessage.hidden = true;

  el('startBtn').addEventListener('click', () => onStart?.());
  el('startArtBtn').addEventListener('click', () => onOpenArt?.());
  for (const screen of [screens.gameOver, screens.victory]) {
    screen.querySelector('[data-action="restart"]').addEventListener('click', () => onRestart?.());
    screen.querySelector('[data-action="art"]')?.addEventListener('click', () => onOpenArt?.());
  }

  function show(name, values = {}, { focus = true } = {}) {
    for (const [key, screen] of Object.entries(screens)) screen.hidden = key !== name;
    const screen = screens[name];
    for (const field of screen.querySelectorAll('[data-field]')) {
      const value = values[field.dataset.field];
      if (value !== undefined) field.textContent = formatValue(value);
    }
    // 키보드로도 바로 누를 수 있게 첫 버튼에 초점 (처음 화면은 아직 아무것도 누르기 전이라 생략)
    if (focus) screen.querySelector('.btn-primary')?.focus({ preventScroll: true });
  }

  return {
    showStart: () => show('start', {}, { focus: false }),
    showGameOver: ({ wave, total, kills }) => show('gameOver', { wave, total, kills }),
    showVictory: ({ wave, total, kills, hp }) => show('victory', { wave, total, kills, hp }),
    hide() {
      for (const screen of Object.values(screens)) screen.hidden = true;
    },
  };
}

function formatValue(value) {
  return typeof value === 'number' ? Math.max(0, Math.ceil(value)).toLocaleString('ko-KR') : String(value);
}
