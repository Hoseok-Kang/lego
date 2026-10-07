// 시작 · 결과 · 멈춤 화면
// 처음 화면('펑펑 토끼' 큰 글자 + 이야기 한 줄 + 조작 안내 + [시작]),
// 다 터뜨렸을 때('다 터뜨렸어요!' + 걸린 시간·남은 체력·명중률),
// 내 토끼가 터졌을 때('펑! 내 토끼가 터졌어요' + [다시 하기]), 잠깐 멈춤([계속하기] [처음부터]) 을 맡습니다.
// 단추를 누르면 화면을 스스로 닫고 받은 함수를 한 번만 부릅니다.
//
//   const overlays = createOverlays({ sounds })   sounds 는 없어도 됨 (있으면 단추 누를 때 '딸깍')
//   overlays.showTitle(onStart)                  Enter·Space 로도 시작
//   overlays.showWin(stats, onRestart)
//   overlays.showLose(stats, onRestart)
//   overlays.showPause(onResume, onRestart)      Esc·P 로도 계속하기
//   overlays.hideAll()
//   overlays.isOpen                              무엇이든 열려 있으면 참 (그동안 input.setEnabled(false) 권장)
//   overlays.current                             'title' | 'win' | 'lose' | 'pause' | null
//
//   stats = { time: 걸린 초, hp: 남은 체력, accuracy: 0~1 (또는 0~100),
//             kills: 터뜨린 수, total: 전체 미친토끼 수, shots, hits }   (없는 값은 알아서 채움)
//
// 글자는 fight.html 의 #titleOverlay, #winOverlay, #loseOverlay, #pauseOverlay 에서,
// 모양은 css/fight-title.css (시작 화면), css/fight-screens.css (결과·멈춤 화면) 에서 바꿉니다.

const ARM_SECONDS = 0.7; // 결과 화면이 뜬 뒤 이 시간 동안은 단추가 눌리지 않음 (누르던 키·클릭으로 바로 넘어가지 않게)

export function createOverlays({ sounds = null } = {}) {
  const el = (id) => document.getElementById(id);
  const screens = {
    title: el('titleOverlay'),
    win: el('winOverlay'),
    lose: el('loseOverlay'),
    pause: el('pauseOverlay'),
  };
  let current = null;
  let handlers = {};
  let armTimer = 0;

  for (const screen of Object.values(screens)) {
    for (const button of screen?.querySelectorAll('[data-action]') ?? []) {
      button.addEventListener('click', () => act(button.dataset.action));
    }
  }

  // 단추 하나 → 화면 닫고 함수 한 번 부르기
  function act(action) {
    const fn = handlers[action];
    if (!fn) return;
    hideAll();
    fn();
    sounds?.play?.('click'); // 시작 단추는 fn 에서 소리를 켠 뒤라 바로 들림
  }

  // 키보드: 처음 화면은 Enter·Space 로 시작, 멈춤 화면은 Esc·P 로 계속하기
  // (input.js 보다 먼저 받아서, 같은 Esc 가 곧바로 다시 멈추게 하지 않음)
  function onKeyDown(event) {
    if (!current || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
    const code = event.code;
    let action = null;
    if (current === 'title' && (code === 'Enter' || code === 'NumpadEnter' || code === 'Space')) action = 'start';
    if (current === 'pause' && (code === 'Escape' || code === 'KeyP')) action = 'resume';
    if (!action) return;
    event.preventDefault();
    event.stopPropagation();
    act(action);
  }
  window.addEventListener('keydown', onKeyDown, true);

  function show(name, actions, values = {}, { arm = 0, focus = true } = {}) {
    hideAll();
    el('bootMessage')?.setAttribute('hidden', '');
    const screen = screens[name];
    if (!screen) return;
    current = name;
    handlers = actions;
    for (const field of screen.querySelectorAll('[data-field]')) {
      const value = values[field.dataset.field];
      if (value !== undefined) field.textContent = String(value);
    }
    screen.hidden = false;
    document.body.classList.add('overlay-open');
    const card = screen.querySelector('.overlay-card');
    const ready = () => {
      if (card) card.inert = false;
      // 키보드로도 바로 누를 수 있게 첫 단추에 초점 (휴대폰에서는 파란 테두리만 생겨서 생략)
      if (focus && !document.body.classList.contains('touch-mode')) screen.querySelector('.btn-primary')?.focus({ preventScroll: true });
    };
    if (arm > 0) {
      if (card) card.inert = true;
      armTimer = setTimeout(ready, arm * 1000);
    } else {
      ready();
    }
  }

  function hideAll() {
    clearTimeout(armTimer);
    const focused = document.activeElement;
    for (const screen of Object.values(screens)) {
      if (!screen) continue;
      if (focused && screen.contains(focused)) focused.blur(); // 숨긴 단추에 초점이 남아 Space 가 눌리지 않게
      screen.hidden = true;
    }
    current = null;
    handlers = {};
    document.body.classList.remove('overlay-open');
  }

  return {
    showTitle(onStart) {
      show('title', { start: onStart }, {}, { focus: false });
    },
    showWin(stats = {}, onRestart) {
      show('win', { restart: onRestart }, resultValues(stats), { arm: ARM_SECONDS });
    },
    showLose(stats = {}, onRestart) {
      show('lose', { restart: onRestart }, resultValues(stats), { arm: ARM_SECONDS });
    },
    showPause(onResume, onRestart) {
      show('pause', { resume: onResume, restart: onRestart });
    },
    hideAll,
    get isOpen() {
      return current !== null;
    },
    get current() {
      return current;
    },
  };
}

// 결과 숫자를 보기 좋은 글자로
function resultValues({ time, hp, hpLeft, accuracy, shots, hits, kills, total } = {}) {
  const left = hp ?? hpLeft;
  return {
    time: formatTime(time),
    hp: Number.isFinite(left) ? String(Math.max(0, Math.ceil(left))) : '-',
    accuracy: formatAccuracy(accuracy, shots, hits),
    kills: Number.isFinite(kills) ? String(kills) : '0',
    total: Number.isFinite(total) ? String(total) : '5',
  };
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '-';
  const whole = Math.max(0, Math.round(seconds));
  if (whole < 60) return `${whole}초`;
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  return rest ? `${minutes}분 ${rest}초` : `${minutes}분`;
}

function formatAccuracy(accuracy, shots, hits) {
  let ratio = accuracy;
  if (!Number.isFinite(ratio)) ratio = Number.isFinite(shots) && shots > 0 && Number.isFinite(hits) ? hits / shots : NaN;
  else if (ratio > 1) ratio /= 100; // 0~100 으로 받은 경우
  if (!Number.isFinite(ratio)) return '-';
  return `${Math.round(Math.min(1, Math.max(0, ratio)) * 100)}%`;
}
