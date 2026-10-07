// 조작 받기 (키보드 · 마우스 · 휴대폰 터치)
// 여러 가지 조작을 게임이 읽기 쉬운 한 가지 모양(input.state)으로 모읍니다.
// 게임은 매 장면 input.update() → (게임 계산) → input.endFrame() 순서로 부르고, input.state 만 읽으면 됩니다.
//
//   const input = createInput(element, { screenToGround })
//       element: 싸움터 상자(#arena) 또는 그림판. 여기서 누른 마우스·손가락만 공격·조작이 됨
//       screenToGround(x, y, 높이) → Vector3 | null   화면 위 점 → 땅 위치 (followCamera.js 의 view.screenToGround)
//   input.state = {
//       move: { x, z }            움직일 방향 (길이 0~1, 대각선도 1을 넘지 않음. 화면 위쪽 = -z)
//       aimPoint: Vector3 | null  마우스가 가리키는 땅 위치 (총알 높이 AIM_HEIGHT). 휴대폰에서는 null
//       aimDir: { x, z } | null   휴대폰 조준 막대 방향. 컴퓨터에서는 null
//       fire                      공격 버튼을 누르고 있음
//       firePressed               이번 장면에 막 누름
//       autoAim                   가까운 미친토끼를 자동으로 겨누기 (휴대폰 오른쪽 톡 · 꾹)
//       rollPressed, switchPressed, reloadPressed, pausePressed   이번 장면에 막 누름
//       slot: null | 'blaster' | 'sword'                          숫자 키 1 / 2
//       usingTouch                지금 휴대폰 터치로 조작 중 (body 에 touch-mode 를 붙임)
//   }
//   input.update()             매 장면 게임 계산 전에 한 번 (카메라가 움직여도 마우스 조준 위치를 다시 계산)
//   input.endFrame()           게임 계산이 끝난 뒤 ('막 누름' 표시 지우기)
//   input.setOverride(일부 | null)   자동 조종·시험용: 이 값들이 진짜 조작 위에 덮어씌워짐 (null 이면 끝)
//   input.setEnabled(참/거짓)        메뉴가 열려 있는 동안 끄기 (누르고 있던 것도 모두 놓음)
//   input.enabled / input.touch (휴대폰 막대) / input.dispose()
//
// 컴퓨터 조작: WASD·화살표 이동, 마우스 조준, 왼쪽 버튼 공격(누르고 있으면 계속),
//   오른쪽 버튼·Space·Shift 구르기, Q·마우스 휠 무기 바꾸기, 1·2 무기 고르기, R 장전, Esc·P 멈춤
// 휴대폰 조작: js/fight/ui/touchControls.js (왼쪽 막대 이동, 오른쪽 막대 조준·공격, 단추)
// 정보판의 멈춤 단추(data-input="pause")도 여기서 받습니다.
// 어떤 키가 무엇을 하는지는 아래 MOVE_KEYS / PRESS_KEYS 에서 바꿉니다.
// (한글 입력 상태여도 되도록 글자가 아니라 '키 자리'(event.code)로 봅니다)

import * as THREE from '../../lib/three.js';
import { createTouchControls } from '../ui/touchControls.js';

const AIM_HEIGHT = 5; // 총알이 날아가는 높이. 마우스가 가리키는 곳을 이 높이의 평면에서 찾음
const WHEEL_GAP = 0.15; // 마우스 휠이 이 시간(초) 동안 조용해야 다음 무기 바꾸기 (트랙패드가 여러 번 바꾸지 않게)

// 움직이는 키 → [x, z]
const MOVE_KEYS = {
  KeyW: [0, -1],
  ArrowUp: [0, -1],
  KeyS: [0, 1],
  ArrowDown: [0, 1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

// 한 번 누르는 키 → 하는 일
const PRESS_KEYS = {
  Space: 'roll',
  ShiftLeft: 'roll',
  ShiftRight: 'roll',
  KeyQ: 'switch',
  KeyR: 'reload',
  Escape: 'pause',
  KeyP: 'pause',
  Digit1: 'slot:blaster',
  Numpad1: 'slot:blaster',
  Digit2: 'slot:sword',
  Numpad2: 'slot:sword',
};

const EDGE_NAMES = { roll: 'rollPressed', switch: 'switchPressed', reload: 'reloadPressed', pause: 'pausePressed' };

export function createInput(element, { screenToGround = null, touchRoot = document.getElementById('touchControls') } = {}) {
  const moveVec = { x: 0, z: 0 };
  const state = {
    move: moveVec,
    aimPoint: null,
    aimDir: null,
    fire: false,
    firePressed: false,
    autoAim: false,
    rollPressed: false,
    switchPressed: false,
    slot: null,
    reloadPressed: false,
    pausePressed: false,
    usingTouch: false,
  };
  // 장면과 장면 사이에 '막 누른' 것들 (update 때 state 로 옮기고 endFrame 때 지움)
  const edges = { firePressed: false, rollPressed: false, switchPressed: false, reloadPressed: false, pausePressed: false, slot: null, tap: false };
  const heldKeys = new Set();
  const mouse = { x: 0, y: 0, seen: false, buttons: 0, fire: false };
  const aimOut = new THREE.Vector3();
  let override = null;
  let enabled = true;
  let lastWheel = -Infinity;
  const cleanups = [];

  const touch = createTouchControls(element, {
    root: touchRoot,
    onPress: pressFromTouch,
    onTouch: () => setUsingTouch(true),
  });

  function listen(target, type, handler, options = false) {
    target.addEventListener(type, handler, options);
    cleanups.push(() => target.removeEventListener(type, handler, options));
  }

  function setUsingTouch(on) {
    if (state.usingTouch === on) return;
    state.usingTouch = on;
    document.body.classList.toggle('touch-mode', on);
    if (on) mouse.fire = false;
  }

  function press(action) {
    if (!enabled) return;
    if (action.startsWith('slot:')) edges.slot = action.slice(5);
    else if (EDGE_NAMES[action]) edges[EDGE_NAMES[action]] = true;
  }

  function pressFromTouch(name) {
    if (name === 'tap') {
      edges.tap = true; // 톡 → 이번 장면에 자동 조준 공격 한 번
      edges.firePressed = true;
    } else if (name === 'aimStart') {
      edges.firePressed = true; // 조준 막대를 끌기 시작한 순간 바로 한 방 (칼은 바로 휘두름)
    } else {
      press(name);
    }
  }

  // ── 키보드 ──
  function onKeyDown(event) {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
    const code = event.code;
    if (MOVE_KEYS[code]) {
      if (!enabled) return;
      heldKeys.add(code);
      event.preventDefault();
      return;
    }
    const action = PRESS_KEYS[code];
    if (!action || !enabled) return;
    event.preventDefault(); // Space 로 화면이 내려가거나 단추가 눌리지 않게
    if (!event.repeat) press(action);
  }

  function onKeyUp(event) {
    heldKeys.delete(event.code);
  }

  // ── 마우스 (버튼 여러 개를 함께 눌러도 되게 buttons 묶음을 직접 비교) ──
  function onMouse(event) {
    if (event.pointerType !== 'mouse') return;
    setUsingTouch(false);
    mouse.x = event.clientX;
    mouse.y = event.clientY;
    mouse.seen = true;
    const buttons = event.buttons;
    const newlyPressed = buttons & ~mouse.buttons;
    mouse.buttons = buttons;
    if (!(buttons & 1)) mouse.fire = false;
    if (!enabled || !newlyPressed || !inPlayArea(event.target)) return;
    if (event.type === 'pointerdown') event.preventDefault();
    if (newlyPressed & 1) {
      mouse.fire = true;
      edges.firePressed = true;
    }
    if (newlyPressed & 2) edges.rollPressed = true;
  }

  function onWheel(event) {
    event.preventDefault(); // 화면 확대·스크롤 막기
    const now = nowSeconds();
    const quiet = now - lastWheel > WHEEL_GAP;
    lastWheel = now;
    if (quiet && Math.abs(event.deltaY) + Math.abs(event.deltaX) > 0) press('switch');
  }

  function inPlayArea(target) {
    return target instanceof Node && element.contains(target);
  }

  // 창을 벗어나면 누르고 있던 키·버튼을 모두 놓은 것으로 (키가 눌린 채로 남지 않게)
  function releaseAll() {
    heldKeys.clear();
    mouse.fire = false;
    mouse.buttons = 0;
  }

  listen(window, 'keydown', onKeyDown);
  listen(window, 'keyup', onKeyUp);
  for (const type of ['pointerdown', 'pointermove', 'pointerup']) listen(window, type, onMouse);
  listen(element, 'wheel', onWheel, { passive: false });
  listen(element, 'contextmenu', preventDefault);
  if (touchRoot) listen(touchRoot, 'contextmenu', preventDefault);
  listen(window, 'blur', releaseAll);
  listen(document, 'visibilitychange', () => document.hidden && releaseAll());
  // 정보판의 멈춤 단추 등 (휴대폰 단추는 touchControls.js 가 받음)
  for (const button of document.querySelectorAll('[data-input]')) {
    if (touchRoot?.contains(button)) continue;
    listen(button, 'click', (event) => {
      if (event.detail > 0) button.blur(); // 눌러서 생긴 초점을 치움 (나중에 Space 가 이 단추를 누르지 않게)
      press(button.dataset.input);
    });
  }

  // 처음 화면부터 휴대폰이면 휴대폰 조작 안내·단추를 보여 줌
  setUsingTouch(!!globalThis.matchMedia?.('(hover: none) and (pointer: coarse)').matches);

  function update() {
    // 움직이기: 키보드(대각선도 길이 1) + 움직이기 막대
    let kx = 0;
    let kz = 0;
    for (const code of heldKeys) {
      kx += MOVE_KEYS[code][0];
      kz += MOVE_KEYS[code][1];
    }
    kx = Math.sign(kx);
    kz = Math.sign(kz);
    const keyLength = Math.hypot(kx, kz) || 1;
    let mx = kx / keyLength + touch.move.x;
    let mz = kz / keyLength + touch.move.z;
    const length = Math.hypot(mx, mz);
    if (length > 1) {
      mx /= length;
      mz /= length;
    }
    moveVec.x = enabled ? mx : 0;
    moveVec.z = enabled ? mz : 0;
    state.move = moveVec;

    // 조준·공격
    if (!enabled) {
      state.aimPoint = null;
      state.aimDir = null;
      state.fire = false;
      state.autoAim = false;
    } else if (state.usingTouch) {
      state.aimPoint = null;
      state.aimDir = touch.aimDir;
      state.fire = touch.aiming || touch.holding;
      state.autoAim = !touch.aiming && (touch.holding || edges.tap);
    } else {
      state.aimPoint = mouse.seen && screenToGround ? screenToGround(mouse.x, mouse.y, AIM_HEIGHT, aimOut) : null;
      state.aimDir = null;
      state.fire = mouse.fire;
      state.autoAim = false;
    }

    state.firePressed = edges.firePressed;
    state.rollPressed = edges.rollPressed;
    state.switchPressed = edges.switchPressed;
    state.reloadPressed = edges.reloadPressed;
    state.pausePressed = edges.pausePressed;
    state.slot = edges.slot;
    applyOverride();
    return state;
  }

  function applyOverride() {
    if (!override) return;
    for (const key of Object.keys(override)) state[key] = override[key];
  }

  function clearEdges() {
    edges.firePressed = edges.rollPressed = edges.switchPressed = edges.reloadPressed = edges.pausePressed = edges.tap = false;
    edges.slot = null;
    state.firePressed = state.rollPressed = state.switchPressed = state.reloadPressed = state.pausePressed = false;
    state.slot = null;
  }

  return {
    state,
    update,
    endFrame: clearEdges,
    setOverride(partial) {
      override = partial ?? null;
      applyOverride(); // update 뒤에 불러도 이번 장면부터 바로 적용
    },
    setEnabled(on) {
      enabled = !!on;
      touch.setEnabled(enabled);
      if (!enabled) {
        releaseAll();
        clearEdges();
        moveVec.x = moveVec.z = 0;
        state.fire = false;
        state.aimDir = null;
        state.autoAim = false;
      }
    },
    get enabled() {
      return enabled;
    },
    touch,
    dispose() {
      touch.dispose();
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
