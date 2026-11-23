// ─────────────────────────────────────────────────────────────
// 악당 타이쿤: 화면 바꾸개
// 소굴 · 상점 · 그리기 · 습격 · 결과 가운데 지금 보여 줄 화면 하나를 고릅니다.
// 화면 이름은 body 에 data-screen="lair" 와 class="screen-lair" 로도 적혀서 css 가 화면마다 다르게 꾸밀 수 있습니다.
//
// 쓰는 법
//   const screens = createScreens()
//   screens.add('lair', { el, show(data), hide() })   화면 등록. el 만 줘도 됩니다 (hidden 으로 켜고 끔)
//       overlay: true 로 등록하면 앞 화면을 그대로 둔 채 위에 겹쳐 뜹니다 (결과 화면이 습격 화면 위에)
//   screens.show('lair', data)    그 화면으로 바꿈 (data 는 그 화면의 show 로 전달)
//   screens.current               지금 화면 이름
//   screens.onChange((이름, 앞 화면 이름) => …) → 그만 듣기 함수
//
// 녹화용: body 에 class="capture" 가 붙으면 화면 위 정보판·창이 모두 숨습니다 (css/villain.css 맨 아래).
// ─────────────────────────────────────────────────────────────

export function createScreens({ body = document.body } = {}) {
  const table = new Map();
  const listeners = new Set();
  let current = null;
  let under = null; // 겹쳐 뜬 화면 아래에 남아 있는 화면

  function setVisible(name, on, data) {
    const screen = table.get(name);
    if (!screen) return;
    if (on) {
      if (screen.show) screen.show(data);
      else if (screen.el) screen.el.hidden = false;
    } else if (screen.hide) screen.hide();
    else if (screen.el) screen.el.hidden = true;
  }

  function show(name, data) {
    if (!table.has(name)) return false;
    const previous = current;
    const next = table.get(name);
    if (next.overlay && previous && previous !== name) {
      under = table.get(previous).overlay ? under : previous; // 앞 화면은 그대로 둠
    } else {
      if (previous && previous !== name) setVisible(previous, false);
      if (under && under !== name) setVisible(under, false);
      under = null;
    }
    current = name;
    for (const key of table.keys()) body.classList.toggle(`screen-${key}`, key === name);
    body.dataset.screen = name;
    setVisible(name, true, data);
    for (const fn of listeners) fn(name, previous);
    return true;
  }

  return {
    add(name, screen) {
      table.set(name, screen);
      return this;
    },
    show,
    get current() {
      return current;
    },
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
