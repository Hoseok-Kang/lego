// 휴대폰 조작 (손가락 밑에 나타나는 막대 두 개 + 큰 단추)
// 왼쪽 반에 손가락을 대면 그 자리에 '움직이기 막대'가, 오른쪽 반에 대면 '조준 막대'가 나타납니다.
//   조준 막대를 끌면 → 그쪽을 겨누고 계속 공격
//   오른쪽을 톡 치면 → 가까운 미친토끼를 자동으로 겨눠 한 번 공격
//   오른쪽을 끌지 않고 꾹 누르고 있으면 → 자동 조준으로 계속 공격
// 손가락 여러 개를 동시에 써도 됩니다 (손가락마다 번호로 따로 기억).
// 손가락이 막대 밖으로 멀리 나가면 막대 바탕이 손가락을 따라옵니다.
// 이 파일은 js/fight/core/input.js 가 만들어 씁니다. (게임은 input.state 만 읽으면 됨)
//
//   const touch = createTouchControls(element, { root, onPress, onTouch })
//       element: 손가락을 받는 곳 (싸움터 상자 #arena 또는 그 안의 그림판)
//       root: 막대·단추 그림이 든 곳 (fight.html 의 #touchControls)
//       onPress(이름)   단추·톡 → 'roll' | 'switch' | 'reload' | 'tap' (오른쪽 톡) | 'aimStart' (조준 막대를 끌기 시작)
//       onTouch()       손가락이 닿을 때마다 (휴대폰 조작 모드로 바꾸라는 뜻)
//   touch.move → { x, z }          움직이기 막대 (길이 0~1, 화면 위쪽 = -z, 오른쪽 = +x)
//   touch.aimDir → { x, z } | null  조준 막대를 끈 방향 (길이 1). 끌지 않았으면 null
//   touch.aiming                   조준 막대를 끌어서 공격하는 중
//   touch.holding                  오른쪽을 끌지 않고 꾹 누르는 중 (자동 조준 연속 공격)
//   touch.setEnabled(참/거짓)       끄면 막대를 모두 놓고 숨김 (메뉴가 열렸을 때)
//   touch.dispose()
//
// 막대 크기·톡 시간은 아래 상수, 막대·단추 모양과 자리는 css/fight-touch.css 에서 바꿉니다.

const STICK_RADIUS = 52; // 손잡이가 가운데에서 움직일 수 있는 거리 (px)
const MOVE_DEADZONE = 0.14; // 움직이기 막대를 이 비율보다 조금 밀면 가만히 (0~1)
const AIM_DEADZONE = 14; // 조준 막대를 이만큼(px) 끌어야 조준 시작 (덜 끌고 떼면 '톡')
const TAP_SECONDS = 0.22; // 이보다 짧게 눌렀다 떼면 '톡' (자동 조준 한 번 공격)
const MOVE_ZONE = 0.5; // 화면 왼쪽 이 비율까지는 움직이기, 나머지는 조준
const BUZZ_MS = 8; // 단추를 누를 때 휴대폰 진동 (안드로이드만, 0 이면 끔)

export function createTouchControls(element, { root = document.getElementById('touchControls'), onPress = () => {}, onTouch = () => {} } = {}) {
  const move = { x: 0, z: 0 };
  const aimDir = { x: 0, z: 0 };
  const sticks = { move: makeStick('move'), aim: makeStick('aim') };
  let enabled = true;
  const cleanups = [];

  function makeStick(role) {
    return { role, el: root?.querySelector(`[data-stick="${role}"]`) ?? null, pointerId: null, cx: 0, cy: 0, startTime: 0, dragged: false };
  }

  function listen(target, type, handler, options = { passive: false }) {
    target.addEventListener(type, handler, options);
    cleanups.push(() => target.removeEventListener(type, handler, options));
  }

  const isTouch = (event) => event.pointerType === 'touch' || event.pointerType === 'pen';
  const stickFor = (pointerId) => (sticks.move.pointerId === pointerId ? sticks.move : sticks.aim.pointerId === pointerId ? sticks.aim : null);

  // ── 손가락이 싸움터에 닿음 → 왼쪽이면 움직이기, 오른쪽이면 조준 ──
  function onDown(event) {
    if (!isTouch(event)) return;
    onTouch();
    if (!enabled) return;
    const rect = element.getBoundingClientRect();
    const role = event.clientX < rect.left + rect.width * MOVE_ZONE ? 'move' : 'aim';
    const stick = sticks[role];
    if (stick.pointerId !== null) return; // 그쪽 막대는 이미 다른 손가락이 쓰는 중
    event.preventDefault();
    try {
      element.setPointerCapture(event.pointerId);
    } catch {
      // 손가락을 붙잡지 못해도 window 에서 계속 받음
    }
    stick.pointerId = event.pointerId;
    stick.startTime = nowSeconds();
    stick.dragged = false;
    stick.cx = event.clientX;
    stick.cy = event.clientY;
    if (stick.el) {
      stick.el.style.setProperty('--x', `${stick.cx}px`);
      stick.el.style.setProperty('--y', `${stick.cy}px`);
      stick.el.classList.add('is-active');
    }
    root?.classList.add('is-played'); // 한 번 써 보면 막대 설명 글자를 숨김
    drag(stick, event.clientX, event.clientY);
  }

  function onMove(event) {
    const stick = stickFor(event.pointerId);
    if (!stick) return;
    event.preventDefault();
    drag(stick, event.clientX, event.clientY);
  }

  function onUp(event) {
    const stick = stickFor(event.pointerId);
    if (!stick) return;
    release(stick, event.type === 'pointerup');
  }

  // 손잡이를 손가락 쪽으로. 막대 밖으로 나가면 바탕이 따라옴
  function drag(stick, x, y) {
    let dx = x - stick.cx;
    let dy = y - stick.cy;
    let dist = Math.hypot(dx, dy);
    if (dist > STICK_RADIUS) {
      const pull = (dist - STICK_RADIUS) / dist;
      stick.cx += dx * pull;
      stick.cy += dy * pull;
      dx = x - stick.cx;
      dy = y - stick.cy;
      dist = STICK_RADIUS;
      stick.el?.style.setProperty('--x', `${stick.cx}px`);
      stick.el?.style.setProperty('--y', `${stick.cy}px`);
    }
    stick.el?.style.setProperty('--kx', `${dx}px`);
    stick.el?.style.setProperty('--ky', `${dy}px`);

    if (stick.role === 'move') {
      const amount = Math.min(1, dist / STICK_RADIUS);
      const strength = amount < MOVE_DEADZONE ? 0 : (amount - MOVE_DEADZONE) / (1 - MOVE_DEADZONE);
      move.x = dist > 0 ? (dx / dist) * strength : 0;
      move.z = dist > 0 ? (dy / dist) * strength : 0; // 화면 아래쪽 = +z
      return;
    }
    if (!stick.dragged && dist >= AIM_DEADZONE) {
      stick.dragged = true;
      stick.el?.classList.add('is-firing');
      onPress('aimStart');
    }
    if (stick.dragged && dist > 2) {
      aimDir.x = dx / dist;
      aimDir.z = dy / dist;
    }
  }

  function release(stick, lifted) {
    if (stick.role === 'aim' && lifted && !stick.dragged && nowSeconds() - stick.startTime <= TAP_SECONDS) onPress('tap');
    try {
      if (element.hasPointerCapture?.(stick.pointerId)) element.releasePointerCapture(stick.pointerId);
    } catch {
      // 이미 놓친 손가락
    }
    stick.pointerId = null;
    stick.dragged = false;
    if (stick.el) {
      stick.el.classList.remove('is-active', 'is-firing');
      for (const name of ['--x', '--y', '--kx', '--ky']) stick.el.style.removeProperty(name);
    }
    if (stick.role === 'move') {
      move.x = 0;
      move.z = 0;
    }
  }

  // ── 단추 (구르기 · 무기 바꾸기 · 장전): 누르는 순간 바로 ──
  function onButtonDown(event) {
    const button = event.currentTarget;
    if (isTouch(event)) onTouch();
    event.preventDefault();
    if (!enabled) return;
    button.classList.add('is-pressed');
    if (BUZZ_MS && isTouch(event)) safely(() => navigator.vibrate?.(BUZZ_MS));
    onPress(button.dataset.input);
  }

  function onButtonUp(event) {
    event.currentTarget.classList.remove('is-pressed');
  }

  listen(element, 'pointerdown', onDown);
  listen(element, 'lostpointercapture', onUp);
  // 움직임·뗌은 window 에서 받음 (붙잡은 손가락도, 붙잡기에 실패한 손가락도 여기로 올라옴)
  listen(window, 'pointermove', onMove);
  listen(window, 'pointerup', onUp);
  listen(window, 'pointercancel', onUp);
  for (const button of root?.querySelectorAll('[data-input]') ?? []) {
    listen(button, 'pointerdown', onButtonDown);
    for (const type of ['pointerup', 'pointercancel', 'pointerleave']) listen(button, type, onButtonUp);
    listen(button, 'contextmenu', preventDefault);
  }
  // 아이폰: 두 손가락 확대·두 번 톡 확대 막기
  listen(document, 'gesturestart', preventDefault);
  listen(document, 'dblclick', preventDefault);

  function setEnabled(on) {
    enabled = !!on;
    if (!enabled) {
      for (const stick of Object.values(sticks)) if (stick.pointerId !== null) release(stick, false);
      for (const button of root?.querySelectorAll('.is-pressed') ?? []) button.classList.remove('is-pressed');
    }
    root?.classList.toggle('is-off', !enabled);
  }

  return {
    get move() {
      return move;
    },
    get aimDir() {
      return sticks.aim.pointerId !== null && sticks.aim.dragged ? aimDir : null;
    },
    get aiming() {
      return sticks.aim.pointerId !== null && sticks.aim.dragged;
    },
    get holding() {
      const stick = sticks.aim;
      return stick.pointerId !== null && !stick.dragged && nowSeconds() - stick.startTime > TAP_SECONDS;
    },
    setEnabled,
    dispose() {
      setEnabled(false);
      cleanups.forEach((off) => off());
      cleanups.length = 0;
    },
  };
}

function preventDefault(event) {
  event.preventDefault();
}

function nowSeconds() {
  return (globalThis.performance?.now?.() ?? Date.now()) / 1000;
}

function safely(action) {
  try {
    return action();
  } catch {
    return undefined;
  }
}
