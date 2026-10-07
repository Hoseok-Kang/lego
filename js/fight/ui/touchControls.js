// 휴대폰 조작 (왼쪽 움직이기 막대 + 오른쪽 큰 단추들)
// 왼쪽 반에 손가락을 대면 그 자리에 '움직이기 막대'가 나타납니다.
// 오른손 엄지 자리에는 단추가 있습니다.
//   공격 단추 (구르기 왼쪽)
//     누르고 있으면 → 가까운 미친토끼를 자동으로 겨눠 계속 공격 (칼이면 계속 휘두름)
//     누른 채로 끌면 → 끄는 쪽으로 겨눠 계속 공격 (단추 안의 손잡이가 손가락을 따라감)
//   구르기 · 장전 · 총⇄칼 바꾸기 단추 → 누르는 순간 바로
// 손가락 여러 개를 동시에 써도 됩니다 (손가락마다 번호로 따로 기억).
// 휴대폰을 돌리면(세로 ⇄ 가로) 막대와 공격 단추를 놓습니다 → 손가락을 떼고 다시 대면 새 화면에 맞게 시작
// (창 크기만 바뀔 때, 예를 들어 아이폰 주소창이 숨거나 나타날 때는 놓지 않음)
// 이 파일은 js/fight/core/input.js 가 만들어 씁니다. (게임은 input.state 만 읽으면 됨)
//
//   const touch = createTouchControls(element, { root, onPress, onTouch })
//       element: 손가락을 받는 곳 (싸움터 상자 #arena 또는 그 안의 그림판)
//       root: 막대·단추 그림이 든 곳 (fight.html 의 #touchControls)
//       onPress(이름)   'roll' | 'switch' | 'reload' (단추) | 'attackStart' (공격 단추를 막 누름)
//       onTouch()       손가락이 닿을 때마다 (휴대폰 조작 모드로 바꾸라는 뜻)
//   touch.move → { x, z }          움직이기 막대 (길이 0~1, 화면 위쪽 = -z, 오른쪽 = +x)
//   touch.attacking                공격 단추를 누르고 있음
//   touch.aiming                   공격 단추를 끌어서 직접 겨누는 중
//   touch.aimDir → { x, z } | null  공격 단추를 끈 방향 (길이 1). 끌지 않았으면 null (→ 자동 조준)
//   touch.setEnabled(참/거짓)       끄면 막대·단추를 모두 놓고 숨김 (메뉴가 열렸을 때)
//   touch.dispose()
//
// 막대 크기·끄는 거리는 아래 상수, 막대·단추 모양과 자리는 css/fight-touch.css 에서 바꿉니다.

const STICK_RADIUS = 52; // 움직이기 손잡이가 가운데에서 움직일 수 있는 거리 (px)
const MOVE_DEADZONE = 0.14; // 움직이기 막대를 이 비율보다 조금 밀면 가만히 (0~1)
const MOVE_ZONE = 0.5; // 화면 왼쪽 이 비율까지 손가락을 대면 움직이기 막대
const AIM_DEADZONE = 18; // 공격 단추를 이만큼(px) 끌어야 직접 겨누기 시작 (덜 끌면 자동 조준)
const AIM_KNOB_MAX = 30; // 공격 단추 안 손잡이가 따라가는 최대 거리 (px)
const BUZZ_MS = 8; // 단추를 누를 때 휴대폰 진동 (안드로이드만, 0 이면 끔)

export function createTouchControls(element, { root = document.getElementById('touchControls'), onPress = () => {}, onTouch = () => {} } = {}) {
  const move = { x: 0, z: 0 };
  const aimDir = { x: 0, z: 0 };
  const moveStick = { el: root?.querySelector('[data-stick="move"]') ?? null, pointerId: null, cx: 0, cy: 0 };
  const attack = { el: root?.querySelector('[data-stick="attack"]') ?? null, pointerId: null, cx: 0, cy: 0, dragged: false };
  let enabled = true;
  const cleanups = [];

  function listen(target, type, handler, options = { passive: false }) {
    target.addEventListener(type, handler, options);
    cleanups.push(() => target.removeEventListener(type, handler, options));
  }

  const isTouch = (event) => event.pointerType === 'touch' || event.pointerType === 'pen';

  function capture(target, pointerId) {
    try {
      target.setPointerCapture(pointerId);
    } catch {
      // 손가락을 붙잡지 못해도 window 에서 계속 받음
    }
  }

  function uncapture(target, pointerId) {
    try {
      if (target?.hasPointerCapture?.(pointerId)) target.releasePointerCapture(pointerId);
    } catch {
      // 이미 놓친 손가락
    }
  }

  // ── 왼쪽 반에 손가락이 닿음 → 그 자리에 움직이기 막대 ──
  function onDown(event) {
    if (!isTouch(event)) return;
    onTouch();
    event.preventDefault(); // 오른쪽 빈 곳을 눌러도 화면이 끌리거나 확대되지 않게
    if (!enabled) return;
    const rect = element.getBoundingClientRect();
    if (event.clientX >= rect.left + rect.width * MOVE_ZONE) return; // 오른쪽 빈 곳은 아무 일 없음 (공격은 공격 단추로)
    if (moveStick.pointerId !== null) return; // 다른 손가락이 이미 움직이는 중
    capture(element, event.pointerId);
    moveStick.pointerId = event.pointerId;
    moveStick.cx = event.clientX;
    moveStick.cy = event.clientY;
    if (moveStick.el) {
      moveStick.el.style.setProperty('--x', `${moveStick.cx}px`);
      moveStick.el.style.setProperty('--y', `${moveStick.cy}px`);
      moveStick.el.classList.add('is-active');
    }
    root?.classList.add('is-played'); // 한 번 써 보면 막대 설명 글자를 숨김
    dragMove(event.clientX, event.clientY);
  }

  // 손잡이를 손가락 쪽으로. 막대 밖으로 나가면 바탕이 따라옴
  function dragMove(x, y) {
    let dx = x - moveStick.cx;
    let dy = y - moveStick.cy;
    let dist = Math.hypot(dx, dy);
    if (dist > STICK_RADIUS) {
      const pull = (dist - STICK_RADIUS) / dist;
      moveStick.cx += dx * pull;
      moveStick.cy += dy * pull;
      dx = x - moveStick.cx;
      dy = y - moveStick.cy;
      dist = STICK_RADIUS;
      moveStick.el?.style.setProperty('--x', `${moveStick.cx}px`);
      moveStick.el?.style.setProperty('--y', `${moveStick.cy}px`);
    }
    moveStick.el?.style.setProperty('--kx', `${dx}px`);
    moveStick.el?.style.setProperty('--ky', `${dy}px`);
    const amount = Math.min(1, dist / STICK_RADIUS);
    const strength = amount < MOVE_DEADZONE ? 0 : (amount - MOVE_DEADZONE) / (1 - MOVE_DEADZONE);
    move.x = dist > 0 ? (dx / dist) * strength : 0;
    move.z = dist > 0 ? (dy / dist) * strength : 0; // 화면 아래쪽 = +z
  }

  function releaseMove() {
    uncapture(element, moveStick.pointerId);
    moveStick.pointerId = null;
    move.x = 0;
    move.z = 0;
    if (moveStick.el) {
      moveStick.el.classList.remove('is-active');
      for (const name of ['--x', '--y', '--kx', '--ky']) moveStick.el.style.removeProperty(name);
    }
  }

  // ── 공격 단추: 누르면 자동 조준 공격, 끌면 그쪽으로 공격 ──
  function onAttackDown(event) {
    if (isTouch(event)) onTouch();
    event.preventDefault();
    event.stopPropagation();
    if (!enabled || attack.pointerId !== null) return;
    const rect = attack.el.getBoundingClientRect();
    attack.cx = rect.left + rect.width / 2;
    attack.cy = rect.top + rect.height / 2;
    attack.pointerId = event.pointerId;
    attack.dragged = false;
    capture(attack.el, event.pointerId);
    attack.el.classList.add('is-pressed');
    root?.classList.add('is-played');
    if (BUZZ_MS && isTouch(event)) safely(() => navigator.vibrate?.(BUZZ_MS));
    onPress('attackStart');
    dragAttack(event.clientX, event.clientY);
  }

  function dragAttack(x, y) {
    const dx = x - attack.cx;
    const dy = y - attack.cy;
    const dist = Math.hypot(dx, dy);
    if (!attack.dragged && dist >= AIM_DEADZONE) {
      attack.dragged = true;
      attack.el.classList.add('is-aiming');
    }
    if (attack.dragged && dist > 2) {
      aimDir.x = dx / dist;
      aimDir.z = dy / dist; // 화면 아래쪽 = +z
    }
    const knob = Math.min(dist, AIM_KNOB_MAX) / (dist || 1);
    attack.el.style.setProperty('--kx', `${dx * knob}px`);
    attack.el.style.setProperty('--ky', `${dy * knob}px`);
    attack.el.style.setProperty('--aim-angle', `${Math.atan2(dx, -dy)}rad`); // 위쪽 = 0, 시계 방향
  }

  function releaseAttack() {
    uncapture(attack.el, attack.pointerId);
    attack.pointerId = null;
    attack.dragged = false;
    if (attack.el) {
      attack.el.classList.remove('is-pressed', 'is-aiming');
      for (const name of ['--kx', '--ky', '--aim-angle']) attack.el.style.removeProperty(name);
    }
  }

  // ── 손가락 움직임·뗌 (붙잡은 손가락도, 붙잡기에 실패한 손가락도 window 로 올라옴) ──
  function onPointerMove(event) {
    if (event.pointerId === moveStick.pointerId) {
      event.preventDefault();
      dragMove(event.clientX, event.clientY);
    } else if (event.pointerId === attack.pointerId) {
      event.preventDefault();
      dragAttack(event.clientX, event.clientY);
    }
  }

  function onPointerUp(event) {
    if (event.pointerId === moveStick.pointerId) releaseMove();
    if (event.pointerId === attack.pointerId) releaseAttack();
  }

  // ── 다른 단추 (구르기 · 총⇄칼 · 장전): 누르는 순간 바로 ──
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
  listen(element, 'lostpointercapture', onPointerUp);
  listen(window, 'pointermove', onPointerMove);
  listen(window, 'pointerup', onPointerUp);
  listen(window, 'pointercancel', onPointerUp);
  if (attack.el) {
    listen(attack.el, 'pointerdown', onAttackDown);
    listen(attack.el, 'lostpointercapture', onPointerUp);
    listen(attack.el, 'contextmenu', preventDefault);
  }
  for (const button of root?.querySelectorAll('[data-input]') ?? []) {
    listen(button, 'pointerdown', onButtonDown);
    for (const type of ['pointerup', 'pointercancel', 'pointerleave']) listen(button, type, onButtonUp);
    listen(button, 'contextmenu', preventDefault);
  }
  // 아이폰: 두 손가락 확대·두 번 톡 확대 막기
  listen(document, 'gesturestart', preventDefault);
  listen(document, 'dblclick', preventDefault);

  // 화면을 돌리면 막대·공격 단추를 놓음 (막대 가운데가 옛 화면 자리에 남아 엉뚱한 쪽으로 달리지 않게)
  // 창 크기 바뀜(resize)이 아니라 세로 ⇄ 가로가 진짜 바뀔 때만 (주소창이 숨을 때 달리던 손가락이 끊기지 않게)
  function releaseOnRotate() {
    if (moveStick.pointerId !== null) releaseMove();
    if (attack.pointerId !== null) releaseAttack();
  }
  const portrait = safely(() => globalThis.matchMedia?.('(orientation: portrait)'));
  if (portrait?.addEventListener) listen(portrait, 'change', releaseOnRotate, { passive: true });
  else if (portrait?.addListener) {
    portrait.addListener(releaseOnRotate); // 옛 아이폰(사파리 13 이하)
    cleanups.push(() => portrait.removeListener(releaseOnRotate));
  }

  function setEnabled(on) {
    enabled = !!on;
    if (!enabled) {
      if (moveStick.pointerId !== null) releaseMove();
      if (attack.pointerId !== null) releaseAttack();
      for (const button of root?.querySelectorAll('.is-pressed') ?? []) button.classList.remove('is-pressed');
    }
    root?.classList.toggle('is-off', !enabled);
  }

  return {
    get move() {
      return move;
    },
    get attacking() {
      return attack.pointerId !== null;
    },
    get aiming() {
      return attack.pointerId !== null && attack.dragged;
    },
    get aimDir() {
      return attack.pointerId !== null && attack.dragged ? aimDir : null;
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

function safely(action) {
  try {
    return action();
  } catch {
    return undefined;
  }
}
