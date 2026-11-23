// ─────────────────────────────────────────────────────────────
// 악당 타이쿤: 소리 단추와 단추 딸깍 소리
// 화면 곳곳의 소리 단추(data-sound-toggle 가 붙은 단추)를 한꺼번에 맡습니다. 켜고 끈 것은 브라우저에 기억해 둡니다.
// 브라우저 규칙 때문에 소리는 화면을 처음 누른 순간부터 납니다 (그래서 첫 누름에 소리를 켭니다).
//
// 쓰는 법
//   const toggle = bindSoundButtons(sounds)      sounds: createVillainSounds() 로 만든 것
//   toggle.wanted            사용자가 소리를 켜 두었는지
//   toggle.set(true|false)   켜기 / 끄기
//   단추(button, .vt-btn)를 누르면 'click' 소리가 저절로 납니다. 소리를 내고 싶지 않은 단추에는 data-quiet 를 붙이세요.
// ─────────────────────────────────────────────────────────────

import { icon } from './uiIcons.js';

const PREF_KEY = 'villainTycoon.sound'; // 'off' 면 꺼 둔 것

function readPref() {
  try {
    return localStorage.getItem(PREF_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function bindSoundButtons(sounds, { root = document } = {}) {
  let wanted = readPref();

  function paint() {
    for (const button of root.querySelectorAll('[data-sound-toggle]')) {
      button.innerHTML = icon(wanted ? 'soundOn' : 'soundOff');
      button.setAttribute('aria-pressed', String(wanted));
      button.title = wanted ? '소리 끄기' : '소리 켜기';
      button.classList.toggle('is-off', !wanted);
    }
  }

  function set(on) {
    wanted = !!on;
    try {
      localStorage.setItem(PREF_KEY, wanted ? 'on' : 'off');
    } catch {
      /* 저장이 막힌 브라우저: 이번에만 적용 */
    }
    sounds.setEnabled(wanted);
    paint();
  }

  // 첫 누름에 소리 장치를 깨움
  const wake = () => {
    if (wanted && !sounds.isEnabled()) sounds.setEnabled(true);
  };
  root.addEventListener('pointerdown', wake, { capture: true, passive: true });
  root.addEventListener('keydown', wake, { capture: true, passive: true });

  root.addEventListener('click', (event) => {
    const toggle = event.target.closest?.('[data-sound-toggle]');
    if (toggle) {
      set(!wanted);
      if (wanted) sounds.play('click');
      return;
    }
    const button = event.target.closest?.('button');
    if (button && !button.hasAttribute('data-quiet')) sounds.play(button.getAttribute('aria-disabled') === 'true' ? 'nope' : 'click');
  });

  paint();
  return {
    get wanted() {
      return wanted;
    },
    set,
    refresh: paint, // 소리 단추가 새로 생겼을 때 그림 맞추기
  };
}
