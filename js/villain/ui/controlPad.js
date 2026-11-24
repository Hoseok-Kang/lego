// ─────────────────────────────────────────────────────────────
// 악당 타이쿤: 직접 조종 단추판 (습격 화면 위에 뜸)
// 왼쪽: 손가락을 대면 그 자리에 나타나는 움직이기 막대 (휴대폰. 쉴 때는 왼쪽 아래에 흐린 막대 자리만)
// 오른쪽: 아래 단추 줄 위에 둥근 공격 단추 — 큰 박치기 단추 + 그 둘레에 호 모양으로 부품 단추 (부품 그림)
//         식는 동안은 어둡게 덮였다가 시계 방향으로 걷히고, 떨어져 나간 부품 단추는 잿빛
// 왼쪽 위 (괴수 체력 아래): '직접 조종 중' / '자동' 칩 (누르면 바뀜)
// 그 밖: 노리는 건물 · 영웅 위의 통통 튀는 화살표, 첫 습격 때 한 번 뜨는 안내 글
// 이 파일은 그리기와 손가락 받기만 합니다. 괴수를 움직이는 일은 raid/monsterControl.js 가 합니다.
//
//   const pad = createControlPad(host, { surface, onPress, onRelease, onTap, onChip, onStick })
//       host: 넣을 상자 (습격 정보판 hud.el),  surface: 손가락 · 마우스를 받는 3D 그림판 (캔버스)
//       onPress(type) / onRelease(type)  공격 단추를 누름 / 뗌 (type: 부품 이름 또는 'headbutt')
//       onTap(x, y)   3D 마을을 짧게 톡 · 마우스 클릭 (화면 px) → 건물 · 영웅 고르기
//       onChip()      모드 칩을 누름,  onStick()  움직이기 막대를 미는 동안 매번
//   pad.stick                          { x, z, held } 막대 방향 (길이 0~1, 화면 위쪽 = -z), held = 손가락이 막대 위에 있음
//   pad.setParts(types)                부품 단추 만들기 (부품 이름 목록, 이 차례가 키 1 2 3 …) + 박치기 단추
//   pad.setCooldown(type, 0~1, lost)   식는 정도 (0 = 준비됨), lost = 떨어져 나감 (잿빛)
//   pad.setMode('auto' | 'manual', idle)   칩 글자 · 색. idle 0~1 = 곧 자동으로 돌아가는 정도 (칩 아래 막대)
//   pad.setState('off' | 'wait' | 'on')    숨김 / 흐리게 (괴수 쌓이는 중 · 영웅 출동 경보) / 쓸 수 있음
//   pad.setKeys(참/거짓)                단추 귀퉁이에 키 이름 (1 2 3 … Space) 보이기
//   pad.mark({ x, y } | null)          노리는 것 위 화살표 (화면 px)
//   pad.nope(type)                     못 쓰는 단추를 눌렀을 때 도리도리
//   pad.hint(on, kind)                 첫 습격 안내 글 (kind: 'touch' | 'keys')
//   pad.release()                      누르고 있던 막대 · 단추를 모두 놓음
//   pad.el
//
// 두 손가락: 3D 마을에 손가락이 둘 닿으면 막대를 놓고 확대(raid/raidZoom.js)에 맡깁니다.
// 글자는 아래 TEXT, 막대 크기 · 끄는 거리 · 톡 길이는 villainConfig.js 의 control, 모양 · 자리는 css/villain-control.css
// ─────────────────────────────────────────────────────────────

import { VILLAIN } from '../villainConfig.js';
import { el, bump } from './uiKit.js';
import { pixelArt } from './uiIcons.js';
import { partIconURL } from '../draw/partIcons.js';

const TEXT = {
  group: '공격 단추',
  headbutt: '박치기',
  manual: '직접 조종 중',
  auto: '자동',
  toAuto: '눌러서 자동으로 바꾸기',
  toManual: '눌러서 직접 조종하기',
  lost: '떨어져 나갔어요',
  space: 'Space',
  hintTouch: '왼쪽을 끌면 움직이고, 오른쪽 단추로 공격해요 · 가만두면 알아서 싸워요',
  hintKeys: 'W A S D 로 움직이고, 1~5 · 스페이스로 공격해요 · 가만두면 알아서 싸워요',
};

const BUZZ_MS = 8; // 단추를 누를 때 휴대폰 진동 (안드로이드만, 0 이면 끔)

// 박치기 그림 (초록 괴수 머리가 쿵! — 한 글자 = 한 칸, 색은 아래 표)
const HEADBUTT_ART = [
  '...........',
  '..KKKKK..Y.',
  '.KGGGGGK.Y.',
  'KGGWWGGGK..',
  'KGGWKGGGKYY',
  'KGGGGGGgK..',
  'KGRRRRGgK..',
  '.KGWGWGK.Y.',
  '..KKKKK..Y.',
];
const HEADBUTT_COLORS = { K: '#1B2A34', G: '#4B9F4A', g: '#BBE90B', W: '#F4F4F4', R: '#C91A09', Y: '#F2CD37' };

// 부품 수에 따라 단추를 놓는 각도 (박치기 단추 가운데에서 왼쪽 = 180°, 위 = 90°)
const ANGLES = { 1: [135], 2: [180, 90], 3: [180, 135, 90], 4: [180, 150, 120, 90] };

export function createControlPad(host, { surface, onPress, onRelease, onTap, onChip, onStick } = {}) {
  const cfg = VILLAIN.control;
  const root = el(`
    <div class="cpad" data-state="off">
      <div class="cpad-stick" aria-hidden="true"><i class="cpad-knob"></i></div>
      <button type="button" class="cpad-chip" data-chip>
        <i class="cpad-chip-dot" aria-hidden="true"></i><b data-chiptext>${TEXT.auto}</b>
        <i class="cpad-chip-idle" aria-hidden="true"></i>
      </button>
      <div class="cpad-attack" role="group" aria-label="${TEXT.group}"></div>
      <div class="cpad-mark" aria-hidden="true" hidden><svg viewBox="0 0 28 24" focusable="false"><path d="M3 3h22L14 21z" fill="#BBE90B" stroke="#1B2A34" stroke-width="3.4" stroke-linejoin="round"/></svg></div>
      <p class="cpad-hint" role="status" hidden></p>
    </div>`);
  const alert = host.querySelector('.hud-alert');
  if (alert) host.insertBefore(root, alert); // 영웅 출동 띠 · 확인 창 아래에
  else host.append(root);

  const stickEl = root.querySelector('.cpad-stick');
  const chip = root.querySelector('[data-chip]');
  const chipText = root.querySelector('[data-chiptext]');
  const attackBox = root.querySelector('.cpad-attack');
  const markEl = root.querySelector('.cpad-mark');
  const hintEl = root.querySelector('.cpad-hint');
  const buttons = new Map(); // type → { el, cd, lost }
  const held = new Map(); // pointerId → type (누르고 있는 공격 단추)
  const touches = new Map(); // 3D 마을 위 손가락 · 마우스 pointerId → { x, y, t, far, pinch }
  const stick = { x: 0, z: 0, held: false, id: null, cx: 0, cy: 0 };
  let state = 'off';
  let mode = '';
  let idleShown = '';

  const coarse = () => {
    try {
      return window.matchMedia('(pointer: coarse)').matches;
    } catch {
      return false;
    }
  };
  root.classList.toggle('is-touch', coarse());

  // 화면 px ↔ 단추판 안 px (#ui 는 화면 크기 배율만큼 줄어 있음)
  function frame() {
    const rect = root.getBoundingClientRect();
    return { left: rect.left, top: rect.top, k: rect.width / Math.max(1, root.offsetWidth) || 1 };
  }

  // ── 공격 단추 ──
  function makeButton(type, index, count) {
    const main = type === 'headbutt';
    const name = main ? TEXT.headbutt : VILLAIN.parts.types[type]?.name ?? type;
    const art = main ? pixelArt(HEADBUTT_ART, HEADBUTT_COLORS, { className: 'cpad-art' }) : `<img class="cpad-art" alt="" draggable="false" src="${partIconURL(type, 66)}">`;
    const key = main ? TEXT.space : String(index + 1);
    const button = el(`<button type="button" class="cpad-btn${main ? ' cpad-btn--main' : ''}" data-type="${type}" aria-label="${name}" title="${name}">${art}<i class="cpad-lost" aria-hidden="true"></i><kbd class="cpad-key">${key}</kbd></button>`);
    if (!main) {
      const angle = ((ANGLES[count] ?? ANGLES[4])[index] * Math.PI) / 180;
      button.style.setProperty('--dx', Math.cos(angle).toFixed(3));
      button.style.setProperty('--dy', (-Math.sin(angle)).toFixed(3));
    }
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (state !== 'on' || held.has(event.pointerId)) return;
      try {
        button.setPointerCapture(event.pointerId);
      } catch {
        // 붙잡지 못해도 window 에서 뗌을 받음
      }
      held.set(event.pointerId, type);
      button.classList.add('is-pressed');
      if (BUZZ_MS && event.pointerType === 'touch') safely(() => navigator.vibrate?.(BUZZ_MS));
      onPress?.(type);
    });
    // 키보드로 단추에 와서 Enter (손가락 · 마우스는 위 pointerdown 이 이미 함)
    button.addEventListener('click', (event) => {
      if (event.detail !== 0 || state !== 'on') return;
      onPress?.(type);
      onRelease?.(type);
    });
    button.addEventListener('contextmenu', (event) => event.preventDefault());
    buttons.set(type, { el: button, cd: -1, lost: false });
    return button;
  }

  function letGo(pointerId) {
    const type = held.get(pointerId);
    if (!type) return;
    held.delete(pointerId);
    if (![...held.values()].includes(type)) buttons.get(type)?.el.classList.remove('is-pressed');
    onRelease?.(type);
  }

  function setParts(types = []) {
    releaseButtons();
    buttons.clear();
    attackBox.textContent = '';
    const parts = types.slice(0, 5);
    attackBox.dataset.count = String(parts.length);
    attackBox.append(makeButton('headbutt', 0, parts.length));
    parts.forEach((type, i) => attackBox.append(makeButton(type, i, parts.length)));
  }

  function setCooldown(type, ratio, lost = false) {
    const item = buttons.get(type);
    if (!item) return;
    const cd = lost ? 1 : Math.round(Math.max(0, Math.min(1, ratio)) * 50) / 50;
    if (cd !== item.cd) {
      if (item.cd > 0 && cd === 0 && !lost) bump(item.el, 'is-ready'); // 다 식음: 뿅
      item.cd = cd;
      item.el.style.setProperty('--cd', String(cd));
      item.el.classList.toggle('is-cooling', cd > 0);
    }
    if (lost !== item.lost) {
      item.lost = lost;
      item.el.classList.toggle('is-lost', lost);
      item.el.setAttribute('aria-disabled', lost ? 'true' : 'false');
      item.el.title = lost ? `${item.el.getAttribute('aria-label')} · ${TEXT.lost}` : item.el.getAttribute('aria-label');
    }
  }

  // ── 움직이기 막대 (3D 마을 왼쪽에 손가락을 대면 그 자리에) ──
  const radius = () => cfg.stickRadius * frame().k; // 화면 px

  function placeStick() {
    const { left, top, k } = frame();
    stickEl.style.setProperty('--x', `${((stick.cx - left) / k).toFixed(1)}px`);
    stickEl.style.setProperty('--y', `${((stick.cy - top) / k).toFixed(1)}px`);
  }

  function dragStick(x, y) {
    const r = radius();
    let dx = x - stick.cx;
    let dy = y - stick.cy;
    let dist = Math.hypot(dx, dy);
    if (dist > r) {
      // 막대 밖으로 나가면 바탕이 손가락을 따라옴
      const pull = (dist - r) / dist;
      stick.cx += dx * pull;
      stick.cy += dy * pull;
      dx = x - stick.cx;
      dy = y - stick.cy;
      dist = r;
      placeStick();
    }
    const k = frame().k;
    stickEl.style.setProperty('--kx', `${(dx / k).toFixed(1)}px`);
    stickEl.style.setProperty('--ky', `${(dy / k).toFixed(1)}px`);
    const amount = Math.min(1, dist / r);
    const strength = amount < cfg.stickDeadzone ? 0 : (amount - cfg.stickDeadzone) / (1 - cfg.stickDeadzone);
    stick.x = dist > 0 ? (dx / dist) * strength : 0;
    stick.z = dist > 0 ? (dy / dist) * strength : 0; // 화면 아래쪽 = +z
    if (strength > 0) onStick?.();
  }

  function releaseStick() {
    if (stick.id !== null) {
      try {
        if (surface?.hasPointerCapture?.(stick.id)) surface.releasePointerCapture(stick.id);
      } catch {
        // 이미 놓친 손가락
      }
    }
    stick.id = null;
    stick.held = false;
    stick.x = 0;
    stick.z = 0;
    stickEl.classList.remove('is-held');
    for (const name of ['--kx', '--ky']) stickEl.style.removeProperty(name);
  }

  function onDown(event) {
    const now = performance.now();
    const touch = event.pointerType !== 'mouse';
    if (!touch && event.button !== 0) return;
    touches.set(event.pointerId, { x: event.clientX, y: event.clientY, t: now, far: false, pinch: false, mouse: !touch });
    if (!touch) return;
    root.classList.add('is-touch');
    if (touches.size >= 2) {
      // 두 손가락 = 확대 (raidZoom.js 가 받음) → 막대를 놓음
      for (const item of touches.values()) item.pinch = true;
      releaseStick();
      return;
    }
    if (state !== 'on' || stick.id !== null) return;
    const rect = surface.getBoundingClientRect();
    if (event.clientX >= rect.left + rect.width * cfg.stickZone) return; // 오른쪽은 톡(노리기)만
    try {
      surface.setPointerCapture(event.pointerId);
    } catch {
      // 붙잡지 못해도 window 에서 계속 받음
    }
    stick.id = event.pointerId;
    stick.held = true;
    stick.cx = event.clientX;
    stick.cy = event.clientY;
    placeStick();
    stickEl.classList.add('is-held');
    dragStick(event.clientX, event.clientY);
  }

  function onMove(event) {
    const item = touches.get(event.pointerId);
    if (item && Math.hypot(event.clientX - item.x, event.clientY - item.y) > cfg.tapPixels) item.far = true;
    if (event.pointerId === stick.id) {
      event.preventDefault();
      dragStick(event.clientX, event.clientY);
    }
  }

  function onUp(event) {
    letGo(event.pointerId);
    const item = touches.get(event.pointerId);
    touches.delete(event.pointerId);
    if (event.pointerId === stick.id) releaseStick();
    if (!item || event.type === 'pointercancel') return;
    const quick = item.mouse || performance.now() - item.t <= cfg.tapSeconds * 1000; // 마우스 클릭은 길어도 됨 (끌지만 않으면)
    if (quick && !item.far && !item.pinch && state === 'on') onTap?.(event.clientX, event.clientY);
  }

  const cleanups = [];
  function listen(target, type, handler, options = { passive: false }) {
    target?.addEventListener(type, handler, options);
    cleanups.push(() => target?.removeEventListener(type, handler, options));
  }
  listen(surface, 'pointerdown', onDown);
  listen(window, 'pointermove', onMove);
  listen(window, 'pointerup', onUp);
  listen(window, 'pointercancel', onUp);
  listen(surface, 'lostpointercapture', (event) => {
    if (event.pointerId === stick.id) releaseStick();
  });
  listen(chip, 'click', () => {
    if (state === 'on') onChip?.();
  });
  // 휴대폰을 돌리면 막대를 놓음 (옛 화면 자리에 막대 가운데가 남지 않게)
  listen(window, 'orientationchange', () => release());

  function releaseButtons() {
    for (const id of [...held.keys()]) letGo(id);
  }

  function release() {
    releaseStick();
    releaseButtons();
  }

  // ── 바깥에서 부르는 것들 ──
  function setState(next) {
    if (next === state) return;
    state = next;
    root.dataset.state = next;
    if (next !== 'on') release();
  }

  function setMode(next, idle = 0) {
    const fill = (Math.round(Math.max(0, Math.min(1, idle)) * 40) / 40).toFixed(3);
    if (fill !== idleShown) {
      idleShown = fill;
      root.style.setProperty('--idle', fill);
    }
    if (next === mode) return;
    mode = next;
    const manual = next === 'manual';
    root.classList.toggle('is-manual', manual);
    chipText.textContent = manual ? TEXT.manual : TEXT.auto;
    chip.setAttribute('aria-label', `${manual ? TEXT.manual : TEXT.auto} · ${manual ? TEXT.toAuto : TEXT.toManual}`);
    chip.title = manual ? TEXT.toAuto : TEXT.toManual;
    if (state === 'on') bump(chip, 'is-flip');
  }

  function mark(point) {
    if (!point) {
      markEl.hidden = true;
      return;
    }
    const { left, top, k } = frame();
    markEl.hidden = false;
    markEl.style.setProperty('--x', `${((point.x - left) / k).toFixed(1)}px`);
    markEl.style.setProperty('--y', `${((point.y - top) / k).toFixed(1)}px`);
  }

  return {
    el: root,
    get stick() {
      return stick;
    },
    setParts,
    setCooldown,
    setMode,
    setState,
    setKeys: (on) => root.classList.toggle('is-keys', !!on),
    mark,
    nope(type) {
      const item = buttons.get(type);
      if (item) bump(item.el, 'is-nope');
    },
    hint(on, kind = 'touch') {
      hintEl.textContent = kind === 'keys' ? TEXT.hintKeys : TEXT.hintTouch;
      if (on && hintEl.hidden) bump(hintEl, 'is-enter');
      hintEl.hidden = !on;
    },
    release,
    dispose() {
      release();
      cleanups.forEach((off) => off());
      root.remove();
    },
  };
}

function safely(action) {
  try {
    return action();
  } catch {
    return undefined;
  }
}
